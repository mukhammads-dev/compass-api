import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
	OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { ObjectId } from '../../libs/types/common';
import {
	errorMessage,
	escapeRegex,
	lookupAuthMemberLiked,
	lookupMember,
	MAX_ACTIVE_USED_LISTINGS,
	shapeIntoMongoObjectId,
	SIMILAR_PRODUCTS_LIMIT,
} from '../../libs/config';
import { Member } from '../../libs/dto/member/member';
import { Product, Products } from '../../libs/dto/product/product';
import {
	AgentProductsInquiry,
	AllProductsInquiry,
	OrdinaryInquiry,
	ProductInput,
	ProductsInquiry,
} from '../../libs/dto/product/product.input';
import { ProductUpdate } from '../../libs/dto/product/product.update';
import { Direction, Message } from '../../libs/enums/common.enum';
import { LikeGroup } from '../../libs/enums/like.enum';
import { MemberType } from '../../libs/enums/member.enum';
import { NotificationGroup, NotificationType } from '../../libs/enums/notification.enum';
import { ProductCondition, ProductStatus } from '../../libs/enums/product.enum';
import { ViewGroup } from '../../libs/enums/view.enum';
import { StatisticModifier, T } from '../../libs/types/common';
import { LikeService } from '../like/like.service';
import { MemberService } from '../member/member.service';
import { NotificationService } from '../notification/notification.service';
import { ViewService } from '../view/view.service';

@Injectable()
export class ProductService implements OnModuleInit {
	private readonly logger = new Logger(ProductService.name);

	constructor(
		@InjectModel('Product') private readonly productModel: Model<Product>,
		private readonly memberService: MemberService,
		private readonly viewService: ViewService,
		private readonly likeService: LikeService,
		private readonly notificationService: NotificationService,
	) {}

	/**
	 * Products listed before stock existed have no productStock in the database.
	 * List queries read raw documents (no schema defaults), so fill the gap once: one piece each.
	 */
	public async onModuleInit(): Promise<void> {
		try {
			const result = await this.productModel
				.updateMany({ productStock: { $exists: false } }, { $set: { productStock: 1 } })
				.exec();
			if (result.modifiedCount) this.logger.log(`productStock set to 1 on ${result.modifiedCount} older product(s)`);
		} catch (err) {
			this.logger.error(`productStock backfill: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	/* ------------------------------------------------------------------ */
	/*  CREATE                                                            */
	/* ------------------------------------------------------------------ */

	public async createProduct(authMember: Member, input: ProductInput): Promise<Product> {
		await this.checkListingPermission(authMember, input.productCondition);
		input.memberId = authMember._id;
		// a used piece is one of a kind
		if (input.productCondition === ProductCondition.USED) input.productStock = 1;

		try {
			const result = await this.productModel.create(input);
			await this.memberService.memberStatsEditor({ _id: result.memberId, targetKey: 'memberProducts', modifier: 1 });
			return result;
		} catch (err) {
			this.logger.error(`createProduct: ${errorMessage(err)}`);
			throw new BadRequestException(Message.CREATE_FAILED);
		}
	}

	/** AGENT: NEW or USED. USER: USED only, limited number of active listings. */
	private async checkListingPermission(authMember: Member, condition: ProductCondition): Promise<void> {
		if (authMember.memberType === MemberType.AGENT) return;

		if (authMember.memberType !== MemberType.USER) {
			throw new ForbiddenException(Message.ONLY_SPECIFIC_ROLES_ALLOWED);
		}
		if (condition !== ProductCondition.USED) {
			throw new ForbiddenException(Message.USER_CAN_SELL_ONLY_USED);
		}

		const activeListings = await this.productModel
			.countDocuments({ memberId: authMember._id, productStatus: ProductStatus.ACTIVE })
			.exec();
		if (activeListings >= MAX_ACTIVE_USED_LISTINGS) {
			throw new BadRequestException(Message.USED_LISTING_LIMIT_REACHED);
		}
	}

	/* ------------------------------------------------------------------ */
	/*  READ                                                              */
	/* ------------------------------------------------------------------ */

	public async getProduct(memberId: ObjectId | null, productId: ObjectId): Promise<Product> {
		const search: T = {
			_id: productId,
			productStatus: { $in: [ProductStatus.ACTIVE, ProductStatus.RESERVED, ProductStatus.SOLD] },
		};

		const targetProduct = (await this.productModel.findOne(search).lean().exec()) as Product | null;
		if (!targetProduct) throw new NotFoundException(Message.NO_DATA_FOUND);

		if (memberId) {
			const newView = await this.viewService.recordView({
				memberId,
				viewRefId: productId,
				viewGroup: ViewGroup.PRODUCT,
			});
			if (newView) {
				await this.productStatsEditor({ _id: productId, targetKey: 'productViews', modifier: 1 });
				targetProduct.productViews++;
			}

			targetProduct.meLiked = await this.likeService.checkLikeExistence({
				memberId,
				likeRefId: productId,
				likeGroup: LikeGroup.PRODUCT,
			});
		}

		targetProduct.memberData = await this.memberService.getMember(null, targetProduct.memberId);
		return targetProduct;
	}

	public async getProducts(memberId: ObjectId | null, input: ProductsInquiry): Promise<Products> {
		const match: T = { productStatus: ProductStatus.ACTIVE };
		const sort: T = { [input?.sort ?? 'createdAt']: input?.direction ?? Direction.DESC };

		this.shapeMatchQuery(match, input);

		const result = await this.productModel
			.aggregate<Products>([
				{ $match: match },
				{ $sort: sort },
				{
					$facet: {
						list: [
							{ $skip: (input.page - 1) * input.limit },
							{ $limit: input.limit },
							lookupAuthMemberLiked(memberId),
							lookupMember,
							{ $unwind: '$memberData' },
						],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();

		return result[0];
	}

	private shapeMatchQuery(match: T, input: ProductsInquiry): void {
		const {
			memberId,
			typeList,
			roomList,
			styleList,
			materialList,
			conditionList,
			locationList,
			pricesRange,
			sizeFit,
			onSale,
			text,
		} = input.search;

		if (memberId) match.memberId = shapeIntoMongoObjectId(memberId);
		if (typeList?.length) match.productType = { $in: typeList };
		if (roomList?.length) match.productRoom = { $in: roomList };
		if (styleList?.length) match.productStyle = { $in: styleList };
		if (materialList?.length) match.productMaterial = { $in: materialList };
		if (conditionList?.length) match.productCondition = { $in: conditionList };
		if (locationList?.length) match.productLocation = { $in: locationList };

		if (pricesRange) match.productPrice = { $gte: pricesRange.start, $lte: pricesRange.end };

		if (sizeFit?.maxWidth) match.productWidth = { $lte: sizeFit.maxWidth };
		if (sizeFit?.maxDepth) match.productDepth = { $lte: sizeFit.maxDepth };
		if (sizeFit?.maxHeight) match.productHeight = { $lte: sizeFit.maxHeight };
		if (onSale) {
			match.productSalePrice = { $gt: 0 };
			match.$expr = { $lt: ['$productSalePrice', '$productPrice'] };
		}

		if (text) match.productTitle = { $regex: new RegExp(escapeRegex(text), 'i') };
	}

	public async getSimilarProducts(memberId: ObjectId | null, productId: ObjectId): Promise<Product[]> {
		const target = await this.productModel.findById(productId).lean().exec();
		if (!target) throw new NotFoundException(Message.NO_DATA_FOUND);

		const match: T = {
			_id: { $ne: productId },
			productStatus: ProductStatus.ACTIVE,
			productStyle: target.productStyle,
			productRoom: target.productRoom,
		};

		return await this.productModel
			.aggregate<Product>([
				{ $match: match },
				{ $sort: { productRank: -1, createdAt: -1 } },
				{ $limit: SIMILAR_PRODUCTS_LIMIT },
				lookupAuthMemberLiked(memberId),
				lookupMember,
				{ $unwind: '$memberData' },
			])
			.exec();
	}

	public async getFavorites(memberId: ObjectId, input: OrdinaryInquiry): Promise<Products> {
		return await this.likeService.getFavoriteProducts(memberId, input);
	}

	public async getVisited(memberId: ObjectId, input: OrdinaryInquiry): Promise<Products> {
		return await this.viewService.getVisitedProducts(memberId, input);
	}

	public async getAgentProducts(memberId: ObjectId, input: AgentProductsInquiry): Promise<Products> {
		const { productStatus } = input.search;
		if (productStatus === ProductStatus.DELETE) throw new BadRequestException(Message.NOT_ALLOWED_REQUEST);

		const match: T = {
			memberId,
			productStatus: productStatus ?? { $ne: ProductStatus.DELETE },
		};
		const sort: T = { [input?.sort ?? 'createdAt']: input?.direction ?? Direction.DESC };

		const result = await this.productModel
			.aggregate<Products>([
				{ $match: match },
				{ $sort: sort },
				{
					$facet: {
						list: [
							{ $skip: (input.page - 1) * input.limit },
							{ $limit: input.limit },
							lookupMember,
							{ $unwind: '$memberData' },
						],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();

		return result[0];
	}

	/* ------------------------------------------------------------------ */
	/*  UPDATE                                                            */
	/* ------------------------------------------------------------------ */

	public async updateProduct(memberId: ObjectId, input: ProductUpdate): Promise<Product> {
		const { productStatus } = input;
		const search: T = {
			_id: input._id,
			memberId,
			productStatus: ProductStatus.ACTIVE,
		};

		if (productStatus === ProductStatus.SOLD) input.soldAt = new Date();
		else if (productStatus === ProductStatus.DELETE) input.deletedAt = new Date();
		// stock only means something for NEW pieces; a used piece always has exactly one
		if (input.productStock !== undefined) {
			const current = await this.productModel.findOne(search).select('productCondition').lean().exec();
			const condition = input.productCondition ?? current?.productCondition;
			if (condition === ProductCondition.USED) input.productStock = 1;
		}

		const result = await this.productModel.findOneAndUpdate(search, input, { new: true }).exec();
		if (!result) throw new NotFoundException(Message.UPDATE_FAILED);

		if (input.soldAt || input.deletedAt) {
			await this.memberService.memberStatsEditor({ _id: memberId, targetKey: 'memberProducts', modifier: -1 });
		}
		return result;
	}

	/* ------------------------------------------------------------------ */
	/*  LIKE                                                              */
	/* ------------------------------------------------------------------ */

	public async likeTargetProduct(memberId: ObjectId, likeRefId: ObjectId): Promise<Product> {
		const target = await this.productModel
			.findOne({ _id: likeRefId, productStatus: ProductStatus.ACTIVE }, { productTitle: 1, memberId: 1 })
			.lean()
			.exec();
		if (!target) throw new NotFoundException(Message.NO_DATA_FOUND);

		const modifier = await this.likeService.toggleLike({ memberId, likeRefId, likeGroup: LikeGroup.PRODUCT });
		const result = await this.productModel
			.findByIdAndUpdate(likeRefId, { $inc: { productLikes: modifier } }, { new: true })
			.lean()
			.exec();
		if (!result) throw new BadRequestException(Message.SOMETHING_WENT_WRONG);

		/* the liker does not wait for the seller's notification */
		if (modifier === 1) {
			this.notificationService
				.createNotification({
					notificationType: NotificationType.LIKE,
					notificationGroup: NotificationGroup.PRODUCT,
					notificationTitle: `Someone liked "${target.productTitle}"`,
					authorId: memberId,
					receiverId: target.memberId,
					productId: likeRefId,
				})
				.catch((err: Error) => this.logger.error(`like notification: ${err.message}`));
		}
		return { ...result, meLiked: this.likeService.likedState(memberId, likeRefId, modifier) } as Product;
	}

	/* ------------------------------------------------------------------ */
	/*  ADMIN                                                             */
	/* ------------------------------------------------------------------ */

	public async getAllProductsByAdmin(input: AllProductsInquiry): Promise<Products> {
		const { productStatus, productLocationList, text } = input.search;
		const match: T = {};
		const sort: T = { [input?.sort ?? 'createdAt']: input?.direction ?? Direction.DESC };

		if (productStatus) match.productStatus = productStatus;
		if (productLocationList?.length) match.productLocation = { $in: productLocationList };
		if (text) match.productTitle = { $regex: new RegExp(escapeRegex(text), 'i') };

		const result = await this.productModel
			.aggregate<Products>([
				{ $match: match },
				{ $sort: sort },
				{
					$facet: {
						list: [
							{ $skip: (input.page - 1) * input.limit },
							{ $limit: input.limit },
							lookupMember,
							{ $unwind: '$memberData' },
						],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();

		return result[0];
	}

	public async updateProductByAdmin(input: ProductUpdate): Promise<Product> {
		const { productStatus } = input;
		const search: T = {
			_id: input._id,
			productStatus: ProductStatus.ACTIVE,
		};

		if (productStatus === ProductStatus.SOLD) input.soldAt = new Date();
		else if (productStatus === ProductStatus.DELETE) input.deletedAt = new Date();

		const result = await this.productModel.findOneAndUpdate(search, input, { new: true }).exec();
		if (!result) throw new NotFoundException(Message.UPDATE_FAILED);

		if (input.soldAt || input.deletedAt) {
			await this.memberService.memberStatsEditor({
				_id: result.memberId,
				targetKey: 'memberProducts',
				modifier: -1,
			});
		}
		return result;
	}

	/** Permanently purges a product that is already soft-deleted. */
	public async removeProductByAdmin(productId: ObjectId): Promise<Product> {
		const search: T = { _id: productId, productStatus: ProductStatus.DELETE };
		const result = await this.productModel.findOneAndDelete(search).exec();
		if (!result) throw new NotFoundException(Message.REMOVE_FAILED);
		return result;
	}

	/* ------------------------------------------------------------------ */
	/*  USED BY OTHER MODULES                                             */
	/* ------------------------------------------------------------------ */

	/** Returns the subset of ids that are ACTIVE products, with their owners. */
	public async findActiveProducts(
		productIds: ObjectId[],
	): Promise<Pick<Product, '_id' | 'memberId' | 'productTitle'>[]> {
		return await this.productModel
			.find({ _id: { $in: productIds }, productStatus: ProductStatus.ACTIVE })
			.select('_id memberId productTitle')
			.lean()
			.exec();
	}

	/** Products referenced by Room Tour tags. SOLD ones are kept so the tag can show a "Sold" badge. */
	public async getProductsByIds(productIds: ObjectId[]): Promise<Product[]> {
		return await this.productModel
			.find({ _id: { $in: productIds }, productStatus: { $ne: ProductStatus.DELETE } })
			.lean()
			.exec();
	}

	public async productRoomToursEditor(productIds: ObjectId[], modifier: number): Promise<void> {
		if (!productIds.length) return;
		await this.productModel.updateMany({ _id: { $in: productIds } }, { $inc: { productRoomTours: modifier } }).exec();
	}

	/* ------------------------------------------------------------------ */
	/*  STATS                                                             */
	/* ------------------------------------------------------------------ */

	/* ------------------------------------------------------------------ */
	/*  STOCK (used by orders)                                            */
	/* ------------------------------------------------------------------ */

	/**
	 * Takes units of a NEW product in one atomic update, so two buyers can never get the last piece.
	 * The product turns SOLD when its stock reaches 0. Returns null when there is not enough left.
	 */
	public async takeStock(productId: ObjectId, quantity: number): Promise<Product | null> {
		const result = await this.productModel
			.findOneAndUpdate(
				{
					_id: productId,
					productStatus: ProductStatus.ACTIVE,
					productCondition: ProductCondition.NEW,
					productStock: { $gte: quantity },
				},
				{ $inc: { productStock: -quantity } },
				{ new: true },
			)
			.lean()
			.exec();
		if (!result) return null;

		if (result.productStock === 0) {
			const soldOut = await this.productModel
				.updateOne(
					{ _id: productId, productStatus: ProductStatus.ACTIVE, productStock: 0 },
					{ productStatus: ProductStatus.SOLD, soldAt: new Date() },
				)
				.exec();
			if (soldOut.modifiedCount) {
				await this.memberService.memberStatsEditor({ _id: result.memberId, targetKey: 'memberProducts', modifier: -1 });
			}
		}
		return result as Product;
	}

	/** Gives units back after a cancellation; a product that sold out through orders becomes ACTIVE again. */
	public async returnStock(productId: ObjectId, quantity: number): Promise<void> {
		const before = await this.productModel
			.findOneAndUpdate(
				{ _id: productId, productStatus: { $in: [ProductStatus.ACTIVE, ProductStatus.SOLD] } },
				{ $inc: { productStock: quantity } },
			)
			.lean()
			.exec();
		if (before?.productStatus !== ProductStatus.SOLD || before.productStock !== 0) return;

		await this.productModel
			.updateOne(
				{ _id: productId, productStatus: ProductStatus.SOLD },
				{ productStatus: ProductStatus.ACTIVE, $unset: { soldAt: 1 } },
			)
			.exec();
		await this.memberService.memberStatsEditor({ _id: before.memberId, targetKey: 'memberProducts', modifier: 1 });
	}

	/** USED piece paid for and waiting for pick-up: hidden from the shop, nobody else can buy it. */
	public async reserveUsed(productId: ObjectId): Promise<Product | null> {
		return (await this.productModel
			.findOneAndUpdate(
				{ _id: productId, productStatus: ProductStatus.ACTIVE, productCondition: ProductCondition.USED },
				{ productStatus: ProductStatus.RESERVED },
				{ new: true },
			)
			.lean()
			.exec()) as Product | null;
	}

	public async releaseReserved(productId: ObjectId): Promise<void> {
		await this.productModel
			.updateOne({ _id: productId, productStatus: ProductStatus.RESERVED }, { productStatus: ProductStatus.ACTIVE })
			.exec();
	}

	public async completeReserved(productId: ObjectId): Promise<void> {
		const result = await this.productModel
			.findOneAndUpdate(
				{ _id: productId, productStatus: ProductStatus.RESERVED },
				{ productStatus: ProductStatus.SOLD, soldAt: new Date() },
			)
			.lean()
			.exec();
		if (result) {
			await this.memberService.memberStatsEditor({ _id: result.memberId, targetKey: 'memberProducts', modifier: -1 });
		}
	}

	/** Plain product documents by id (no lookups), for cart and checkout. */
	public async findProductsByIds(ids: ObjectId[]): Promise<Product[]> {
		if (!ids.length) return [];
		return (await this.productModel
			.find({ _id: { $in: ids } })
			.lean()
			.exec()) as Product[];
	}

	public async productStatsEditor(input: StatisticModifier): Promise<Product | null> {
		const { _id, targetKey, modifier } = input;
		return await this.productModel.findByIdAndUpdate(_id, { $inc: { [targetKey]: modifier } }, { new: true }).exec();
	}
}
