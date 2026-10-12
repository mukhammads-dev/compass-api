import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { ObjectId } from '../../libs/types/common';
import { MAX_CART_ITEMS, MAX_ITEM_QUANTITY, shapeIntoMongoObjectId } from '../../libs/config';
import { CartItem } from '../../libs/dto/cart/cart';
import { CartItemInput, CartItemUpdate } from '../../libs/dto/cart/cart.input';
import { Member } from '../../libs/dto/member/member';
import { Product } from '../../libs/dto/product/product';
import { Message } from '../../libs/enums/common.enum';
import { ProductCondition, ProductStatus } from '../../libs/enums/product.enum';
import { ProductService } from '../product/product.service';

interface CartItemDoc {
	_id: ObjectId;
	memberId: ObjectId;
	productId: ObjectId;
	quantity: number;
	assembly: boolean;
}

/** A cart line joined with its live product and seller, as checkout needs it. */
export interface CartLine {
	item: CartItemDoc;
	product: Product;
	seller: Member;
}

/** every Member field the client asks for on a cart seller (non-null fields must be loaded) */
const SELLER_FIELDS = 'memberNick memberImage memberType memberStatus memberFollowers memberProducts';

/**
 * The cart holds NEW furniture only (USED pieces are reserved for pick-up instead).
 * Product data is always read live, so a price change or a sell-out shows up in the cart right away.
 */
@Injectable()
export class CartService {
	constructor(
		@InjectModel('CartItem') private readonly cartItemModel: Model<CartItemDoc>,
		@InjectModel('Member') private readonly memberModel: Model<Member>,
		private readonly productService: ProductService,
	) {}

	/* ------------------------------------------------------------------ */
	/*  READ                                                              */
	/* ------------------------------------------------------------------ */

	public async getMyCart(memberId: ObjectId): Promise<CartItem[]> {
		const items = await this.cartItemModel.find({ memberId }).sort({ createdAt: 1 }).lean().exec();
		const products = await this.productService.findProductsByIds(items.map((item) => item.productId));
		const sellers = await this.findSellers(products);

		const productById = new Map(products.map((product) => [String(product._id), product]));
		return items.map((item) => this.toCartItem(memberId, item, productById.get(String(item.productId)), sellers));
	}

	/**
	 * Cart lines ready to be ordered. `productIds` narrows the cart ("Buy now");
	 * a requested line that cannot be ordered fails the whole checkout instead of being skipped silently.
	 */
	public async getCartLines(memberId: ObjectId, productIds?: string[]): Promise<CartLine[]> {
		const filter: Record<string, unknown> = { memberId };
		if (productIds?.length) filter.productId = { $in: productIds.map((id) => shapeIntoMongoObjectId(id)) };

		const items = await this.cartItemModel.find(filter).sort({ createdAt: 1 }).lean().exec();
		if (!items.length) throw new BadRequestException(Message.CART_IS_EMPTY);

		const products = await this.productService.findProductsByIds(items.map((item) => item.productId));
		const sellers = await this.findSellers(products);
		const productById = new Map(products.map((product) => [String(product._id), product]));

		return items.map((item) => {
			const product = productById.get(String(item.productId));
			const line = this.toCartItem(memberId, item, product, sellers);
			if (!product || !line.available) throw new BadRequestException(Message.PRODUCT_NOT_AVAILABLE);
			if (item.quantity > line.maxQuantity) throw new BadRequestException(Message.OUT_OF_STOCK);
			return { item, product, seller: sellers.get(String(product.memberId)) as Member };
		});
	}

	/* ------------------------------------------------------------------ */
	/*  WRITE                                                             */
	/* ------------------------------------------------------------------ */

	public async addToCart(memberId: ObjectId, input: CartItemInput): Promise<CartItem> {
		const productId = shapeIntoMongoObjectId(input.productId);
		const product = await this.findOrderableProduct(memberId, productId);
		if (input.assembly && !product.productAssembly) throw new BadRequestException(Message.ASSEMBLY_NOT_OFFERED);

		const existing = await this.cartItemModel.findOne({ memberId, productId }).lean().exec();
		if (!existing && (await this.cartItemModel.countDocuments({ memberId }).exec()) >= MAX_CART_ITEMS) {
			throw new BadRequestException(Message.CART_LIMIT_REACHED);
		}

		const limit = Math.min(product.productStock, MAX_ITEM_QUANTITY);
		if (limit < 1) throw new BadRequestException(Message.OUT_OF_STOCK);
		const quantity = Math.min((existing?.quantity ?? 0) + input.quantity, limit);

		const item = await this.cartItemModel
			.findOneAndUpdate(
				{ memberId, productId },
				{ quantity, assembly: input.assembly ?? existing?.assembly ?? false },
				{ new: true, upsert: true },
			)
			.lean()
			.exec();
		return this.toCartItem(memberId, item as CartItemDoc, product, await this.findSellers([product]));
	}

	public async updateCartItem(memberId: ObjectId, input: CartItemUpdate): Promise<CartItem> {
		const productId = shapeIntoMongoObjectId(input.productId);
		const existing = await this.cartItemModel.findOne({ memberId, productId }).lean().exec();
		if (!existing) throw new NotFoundException(Message.NO_DATA_FOUND);

		const product = await this.findOrderableProduct(memberId, productId);
		if (input.assembly && !product.productAssembly) throw new BadRequestException(Message.ASSEMBLY_NOT_OFFERED);

		const update: Partial<CartItemDoc> = {};
		if (input.quantity !== undefined) {
			const limit = Math.min(product.productStock, MAX_ITEM_QUANTITY);
			if (input.quantity > limit) throw new BadRequestException(Message.OUT_OF_STOCK);
			update.quantity = input.quantity;
		}
		if (input.assembly !== undefined) update.assembly = input.assembly;

		const item = await this.cartItemModel
			.findOneAndUpdate({ memberId, productId }, update, { new: true })
			.lean()
			.exec();
		return this.toCartItem(memberId, item as CartItemDoc, product, await this.findSellers([product]));
	}

	public async removeCartItem(memberId: ObjectId, productId: string): Promise<boolean> {
		const result = await this.cartItemModel
			.deleteOne({ memberId, productId: shapeIntoMongoObjectId(productId) })
			.exec();
		return result.deletedCount > 0;
	}

	/** After a successful checkout. */
	public async removeCartItems(memberId: ObjectId, productIds: ObjectId[]): Promise<void> {
		await this.cartItemModel.deleteMany({ memberId, productId: { $in: productIds } }).exec();
	}

	/* ------------------------------------------------------------------ */
	/*  HELPERS                                                           */
	/* ------------------------------------------------------------------ */

	private async findOrderableProduct(memberId: ObjectId, productId: ObjectId): Promise<Product> {
		const [product] = await this.productService.findProductsByIds([productId]);
		if (!product || product.productStatus !== ProductStatus.ACTIVE) {
			throw new BadRequestException(Message.PRODUCT_NOT_AVAILABLE);
		}
		if (product.productCondition !== ProductCondition.NEW) throw new BadRequestException(Message.NOT_FOR_DELIVERY);
		if (String(product.memberId) === String(memberId)) throw new BadRequestException(Message.OWN_PRODUCT);
		return product;
	}

	private async findSellers(products: Product[]): Promise<Map<string, Member>> {
		const ids = [...new Set(products.map((product) => String(product.memberId)))];
		if (!ids.length) return new Map();
		const sellers = await this.memberModel
			.find({ _id: { $in: ids.map((id) => shapeIntoMongoObjectId(id)) } })
			.select(SELLER_FIELDS)
			.lean()
			.exec();
		return new Map(sellers.map((seller) => [String(seller._id), seller as Member]));
	}

	private toCartItem(
		memberId: ObjectId,
		item: CartItemDoc,
		product: Product | undefined,
		sellers: Map<string, Member>,
	): CartItem {
		const available = Boolean(
			product &&
			product.productStatus === ProductStatus.ACTIVE &&
			product.productCondition === ProductCondition.NEW &&
			product.productStock > 0 &&
			String(product.memberId) !== String(memberId),
		);
		return {
			_id: item._id,
			productId: item.productId,
			quantity: item.quantity,
			assembly: Boolean(item.assembly && product?.productAssembly),
			available,
			maxQuantity: available && product ? Math.min(product.productStock, MAX_ITEM_QUANTITY) : 0,
			productData: product ? { ...product, memberData: sellers.get(String(product.memberId)) } : undefined,
		};
	}
}
