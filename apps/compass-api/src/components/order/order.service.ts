import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { ObjectId, T } from '../../libs/types/common';
import type { AuthMemberPayload } from '../auth/auth.types';
import { errorMessage, escapeRegex, shapeIntoMongoObjectId } from '../../libs/config';
import { Member } from '../../libs/dto/member/member';
import { CheckoutQuote, Order, Orders, StoreQuote } from '../../libs/dto/order/order';
import {
	CancelOrderInput,
	CheckoutInput,
	OrdersInquiry,
	OrderStatusUpdate,
	QuoteInput,
	ReserveInput,
} from '../../libs/dto/order/order.input';
import { Message } from '../../libs/enums/common.enum';
import { MemberType } from '../../libs/enums/member.enum';
import { NotificationGroup, NotificationType } from '../../libs/enums/notification.enum';
import { OrderActor, OrderStatus, OrderType } from '../../libs/enums/order.enum';
import { ProductCondition, ProductStatus } from '../../libs/enums/product.enum';
import { CartLine, CartService } from '../cart/cart.service';
import { NotificationService } from '../notification/notification.service';
import { ProductService } from '../product/product.service';
import {
	assemblyFeeOf,
	canBuyerComplete,
	canCancel,
	canSellerMoveTo,
	deliveryWindow,
	isDeliveryDateAllowed,
	isMeetupDateAllowed,
	kstDay,
	kstNoon,
	makeCheckoutId,
	makeOrderNo,
	PaymentError,
	PaymentRecord,
	PaymentRequest,
	PricedLine,
	priceStoreOrder,
	simulatePayment,
	unitPriceOf,
} from './order.rules';

type OrderDoc = Order;

/** Buyer-facing words for each step, used in notifications. */
const STEP_MESSAGES: Partial<Record<OrderStatus, string>> = {
	[OrderStatus.PREPARING]: 'is being prepared by the store',
	[OrderStatus.SHIPPING]: 'is on its way',
	[OrderStatus.DELIVERED]: 'has been delivered',
};

@Injectable()
export class OrderService {
	private readonly logger = new Logger(OrderService.name);

	constructor(
		@InjectModel('Order') private readonly orderModel: Model<OrderDoc>,
		@InjectModel('Member') private readonly memberModel: Model<Member>,
		private readonly cartService: CartService,
		private readonly productService: ProductService,
		private readonly notificationService: NotificationService,
	) {}

	/* ------------------------------------------------------------------ */
	/*  CHECKOUT (NEW furniture, delivered by each store)                 */
	/* ------------------------------------------------------------------ */

	public async getCheckoutQuote(memberId: ObjectId, input: QuoteInput): Promise<CheckoutQuote> {
		const lines = await this.cartService.getCartLines(memberId, input.productIds);
		return this.buildQuote(lines, input.floor, input.elevator, new Date());
	}

	/**
	 * Cart → one paid order per store. Order of operations keeps the data consistent without transactions:
	 * price (same code as the quote) → validate dates → charge → take stock atomically (rolled back if any
	 * piece ran out) → save orders (stock returned if that fails) → empty those cart lines → tell the stores.
	 */
	public async createOrders(buyer: AuthMemberPayload, input: CheckoutInput): Promise<Order[]> {
		const now = new Date();
		const lines = await this.cartService.getCartLines(buyer._id, input.productIds);
		const { shipping } = input;
		const quote = this.buildQuote(lines, shipping.floor, shipping.elevator, now);

		const deliveryBySeller = new Map(input.deliveries.map((delivery) => [delivery.sellerId, delivery]));
		for (const store of quote.stores) {
			const delivery = deliveryBySeller.get(String(store.sellerId));
			if (!delivery) throw new BadRequestException(Message.MISSING_DELIVERY_DATE);
			if (!isDeliveryDateAllowed(new Date(delivery.preferredDate), now)) {
				throw new BadRequestException(Message.INVALID_DELIVERY_DATE);
			}
		}

		const payment = this.charge(input.payment, quote.grandTotal, now);
		const taken = await this.takeAllStock(lines);

		const checkoutId = makeCheckoutId();
		const docs = quote.stores.map((store) => {
			const delivery = deliveryBySeller.get(String(store.sellerId))!;
			return {
				orderNo: makeOrderNo(now),
				checkoutId,
				orderType: OrderType.DELIVERY,
				orderStatus: OrderStatus.PAID,
				buyerId: buyer._id,
				buyerNick: buyer.memberNick,
				sellerId: store.sellerId,
				sellerNick: store.sellerNick,
				sellerImage: store.sellerImage,
				items: store.items,
				itemsTotal: store.itemsTotal,
				deliveryFee: store.deliveryFee,
				assemblyTotal: store.assemblyTotal,
				stairsFee: store.stairsFee,
				orderTotal: store.orderTotal,
				delivery: {
					recipient: shipping.recipient.trim(),
					phone: shipping.phone,
					address: shipping.address.trim(),
					addressDetail: shipping.addressDetail?.trim(),
					postalCode: shipping.postalCode,
					floor: shipping.floor,
					elevator: shipping.elevator,
					preferredDate: kstNoon(kstDay(new Date(delivery.preferredDate))),
					memo: delivery.memo?.trim(),
				},
				payment: { ...payment, amount: store.orderTotal },
				history: [{ status: OrderStatus.PAID, actor: OrderActor.BUYER, at: now }],
			};
		});

		let orders: Order[];
		try {
			orders = (await this.orderModel.insertMany(docs)).map((doc) => doc.toObject() as Order);
		} catch (err) {
			this.logger.error(`createOrders: ${errorMessage(err)}`);
			await this.returnAllStock(taken);
			throw new BadRequestException(Message.CREATE_FAILED);
		}

		await this.cartService.removeCartItems(
			buyer._id,
			lines.map((line) => line.item.productId),
		);
		for (const order of orders) {
			await this.notify(order, OrderActor.BUYER, `New order ${order.orderNo}: ${this.summary(order)}`);
		}
		return orders;
	}

	/* ------------------------------------------------------------------ */
	/*  RESERVE (USED furniture, picked up from the seller)               */
	/* ------------------------------------------------------------------ */

	/**
	 * The buyer pays now and Compass holds the money; the piece is RESERVED so nobody else can buy it.
	 * The seller is paid when the buyer confirms the pick-up (completeOrder).
	 */
	public async reserveProduct(buyer: AuthMemberPayload, input: ReserveInput): Promise<Order> {
		const now = new Date();
		const productId = shapeIntoMongoObjectId(input.productId);
		const [product] = await this.productService.findProductsByIds([productId]);

		if (!product || product.productStatus !== ProductStatus.ACTIVE) {
			throw new BadRequestException(Message.PRODUCT_NOT_AVAILABLE);
		}
		if (product.productCondition !== ProductCondition.USED) throw new BadRequestException(Message.NOT_FOR_MEETUP);
		if (String(product.memberId) === String(buyer._id)) throw new BadRequestException(Message.OWN_PRODUCT);
		if (!isMeetupDateAllowed(new Date(input.meetupDate), now)) {
			throw new BadRequestException(Message.INVALID_DELIVERY_DATE);
		}

		const price = unitPriceOf(product);
		const payment = this.charge(input.payment, price, now);
		if (!(await this.productService.reserveUsed(productId))) {
			throw new BadRequestException(Message.PRODUCT_NOT_AVAILABLE);
		}

		const seller = await this.memberModel.findById(product.memberId).select('memberNick memberImage').lean().exec();
		try {
			const order = await this.orderModel.create({
				orderNo: makeOrderNo(now),
				checkoutId: makeCheckoutId(),
				orderType: OrderType.MEETUP,
				orderStatus: OrderStatus.PAID,
				buyerId: buyer._id,
				buyerNick: buyer.memberNick,
				sellerId: product.memberId,
				sellerNick: seller?.memberNick ?? '',
				sellerImage: seller?.memberImage,
				items: [this.toOrderItem(product, 1, false)],
				itemsTotal: price,
				orderTotal: price,
				meetup: {
					meetupDate: kstNoon(kstDay(new Date(input.meetupDate))),
					meetupPlace: product.productAddress,
					note: input.note?.trim(),
				},
				payment,
				history: [{ status: OrderStatus.PAID, actor: OrderActor.BUYER, at: now }],
			});
			const result = order.toObject() as Order;
			await this.notify(
				result,
				OrderActor.BUYER,
				`"${product.productTitle}" was reserved, meet the buyer to hand it over`,
			);
			return result;
		} catch (err) {
			this.logger.error(`reserveProduct: ${errorMessage(err)}`);
			await this.productService.releaseReserved(productId);
			throw new BadRequestException(Message.CREATE_FAILED);
		}
	}

	/* ------------------------------------------------------------------ */
	/*  READ                                                              */
	/* ------------------------------------------------------------------ */

	public async getMyOrders(memberId: ObjectId, input: OrdersInquiry): Promise<Orders> {
		return await this.findOrders({ buyerId: memberId }, input);
	}

	public async getStoreOrders(memberId: ObjectId, input: OrdersInquiry): Promise<Orders> {
		return await this.findOrders({ sellerId: memberId }, input);
	}

	public async getAllOrdersByAdmin(input: OrdersInquiry): Promise<Orders> {
		return await this.findOrders({}, input);
	}

	/** Visible to its buyer, its seller and admins. */
	public async getOrder(member: AuthMemberPayload, orderId: string): Promise<Order> {
		const order = await this.orderModel.findById(shapeIntoMongoObjectId(orderId)).lean().exec();
		if (!order || !this.actorOf(member, order)) throw new NotFoundException(Message.NO_DATA_FOUND);
		return order as Order;
	}

	/** The orders created by one checkout, for the confirmation page. */
	public async getCheckoutOrders(memberId: ObjectId, checkoutId: string): Promise<Order[]> {
		return (await this.orderModel
			.find({ checkoutId, buyerId: memberId })
			.sort({ createdAt: 1 })
			.lean()
			.exec()) as Order[];
	}

	/* ------------------------------------------------------------------ */
	/*  STATUS                                                            */
	/* ------------------------------------------------------------------ */

	/** Seller moves a delivery forward one step: PAID → PREPARING → SHIPPING → DELIVERED. */
	public async updateOrderBySeller(seller: AuthMemberPayload, input: OrderStatusUpdate): Promise<Order> {
		const order = await this.findOwnOrder(input.orderId, { sellerId: seller._id });
		if (!canSellerMoveTo(order.orderType, order.orderStatus, input.orderStatus)) {
			throw new BadRequestException(Message.ORDER_STATUS_LOCKED);
		}

		const note = input.sellerNote?.trim();
		const updated = await this.moveOrder(
			order,
			input.orderStatus,
			OrderActor.SELLER,
			note,
			note ? { sellerNote: note } : {},
		);
		await this.notify(updated, OrderActor.SELLER, `Your order ${updated.orderNo} ${STEP_MESSAGES[input.orderStatus]}`);
		return updated;
	}

	/** Buyer, seller or admin cancels; stock or the reservation is given back and the payment refunded. */
	public async cancelOrder(member: AuthMemberPayload, input: CancelOrderInput): Promise<Order> {
		const order = await this.orderModel.findById(shapeIntoMongoObjectId(input.orderId)).lean().exec();
		const actor = order ? this.actorOf(member, order) : null;
		if (!order || !actor) throw new NotFoundException(Message.NO_DATA_FOUND);
		if (!canCancel(order.orderType, order.orderStatus, actor))
			throw new BadRequestException(Message.ORDER_STATUS_LOCKED);

		const now = new Date();
		const reason = input.reason.trim();
		const updated = await this.moveOrder(order as Order, OrderStatus.CANCELED, actor, reason, {
			cancelReason: reason,
			canceledBy: actor,
			'payment.refundedAt': now,
		});

		if (order.orderType === OrderType.MEETUP) {
			await this.productService.releaseReserved(order.items[0].productId);
		} else {
			await this.returnAllStock(order.items.map((item) => ({ productId: item.productId, quantity: item.quantity })));
		}

		const who = actor === OrderActor.BUYER ? 'The buyer' : actor === OrderActor.SELLER ? 'The seller' : 'Compass';
		await this.notify(updated, actor, `${who} canceled order ${updated.orderNo}. The payment is refunded.`);
		return updated;
	}

	/** Buyer confirms: delivered order received, or used piece picked up (releases the held payment). */
	public async completeOrder(buyer: AuthMemberPayload, orderId: string): Promise<Order> {
		const order = await this.findOwnOrder(orderId, { buyerId: buyer._id });
		if (!canBuyerComplete(order.orderType, order.orderStatus))
			throw new BadRequestException(Message.ORDER_STATUS_LOCKED);

		const updated = await this.moveOrder(order, OrderStatus.COMPLETED, OrderActor.BUYER);
		if (order.orderType === OrderType.MEETUP) await this.productService.completeReserved(order.items[0].productId);

		const message =
			order.orderType === OrderType.MEETUP
				? `The buyer picked up "${order.items[0].productTitle}". The payment is released to you.`
				: `The buyer confirmed order ${order.orderNo}`;
		await this.notify(updated, OrderActor.BUYER, message);
		return updated;
	}

	/* ------------------------------------------------------------------ */
	/*  HELPERS                                                           */
	/* ------------------------------------------------------------------ */

	private buildQuote(lines: CartLine[], floor: number, elevator: boolean, now: Date): CheckoutQuote {
		const bySeller = new Map<string, CartLine[]>();
		for (const line of lines) {
			const key = String(line.product.memberId);
			bySeller.set(key, [...(bySeller.get(key) ?? []), line]);
		}

		const stores: StoreQuote[] = [...bySeller.values()].map((storeLines) => {
			const priced: PricedLine[] = storeLines.map((line) => ({
				...this.toOrderItem(line.product, line.item.quantity, line.item.assembly),
				deliveryFee: line.product.productDeliveryFee ?? 0,
			}));
			const { seller, product } = storeLines[0];
			return {
				sellerId: product.memberId,
				sellerNick: seller?.memberNick ?? '',
				sellerImage: seller?.memberImage,
				items: priced.map(({ deliveryFee: _deliveryFee, ...item }) => item),
				...priceStoreOrder(priced, floor, elevator),
			};
		});

		const sum = (key: keyof StoreQuote) => stores.reduce((total, store) => total + (store[key] as number), 0);
		const { earliest, latest } = deliveryWindow(now);
		return {
			stores,
			itemsTotal: sum('itemsTotal'),
			deliveryTotal: sum('deliveryFee'),
			assemblyTotal: sum('assemblyTotal'),
			stairsTotal: sum('stairsFee'),
			grandTotal: sum('orderTotal'),
			earliestDate: earliest,
			latestDate: latest,
		};
	}

	private toOrderItem(
		product: CartLine['product'],
		quantity: number,
		assembly: boolean,
	): Omit<PricedLine, 'deliveryFee'> {
		const withAssembly = Boolean(assembly && product.productAssembly);
		return {
			productId: product._id,
			productTitle: product.productTitle,
			productImage: product.productImages?.[0] ?? '',
			productWidth: product.productWidth,
			productDepth: product.productDepth,
			productHeight: product.productHeight,
			unitPrice: unitPriceOf(product),
			quantity,
			assembly: withAssembly,
			assemblyFee: assemblyFeeOf(withAssembly, quantity),
		};
	}

	private charge(request: PaymentRequest, amount: number, now: Date): PaymentRecord {
		try {
			return simulatePayment(request, amount, now);
		} catch (err) {
			if (err instanceof PaymentError) throw new BadRequestException(err.message);
			throw err;
		}
	}

	/** All or nothing: if one piece is gone, what was already taken is given back. */
	private async takeAllStock(lines: CartLine[]): Promise<{ productId: ObjectId; quantity: number }[]> {
		const taken: { productId: ObjectId; quantity: number }[] = [];
		for (const line of lines) {
			const product = await this.productService.takeStock(line.item.productId, line.item.quantity);
			if (!product) {
				await this.returnAllStock(taken);
				throw new BadRequestException(`${Message.OUT_OF_STOCK} (${line.product.productTitle})`);
			}
			taken.push({ productId: line.item.productId, quantity: line.item.quantity });
		}
		return taken;
	}

	private async returnAllStock(taken: { productId: ObjectId | string; quantity: number }[]): Promise<void> {
		for (const { productId, quantity } of taken) {
			await this.productService.returnStock(shapeIntoMongoObjectId(productId), quantity);
		}
	}

	private async findOrders(base: T, input: OrdersInquiry): Promise<Orders> {
		const { orderStatus, orderType, text } = input.search ?? {};
		const match: T = { ...base };
		if (orderStatus) match.orderStatus = orderStatus;
		if (orderType) match.orderType = orderType;
		if (text) {
			const pattern = new RegExp(escapeRegex(text.trim()), 'i');
			match.$or = [{ orderNo: pattern }, { 'items.productTitle': pattern }, { buyerNick: pattern }];
		}

		const [list, total] = await Promise.all([
			this.orderModel
				.find(match)
				.sort({ createdAt: -1 })
				.skip((input.page - 1) * input.limit)
				.limit(input.limit)
				.lean()
				.exec(),
			this.orderModel.countDocuments(match).exec(),
		]);
		return { list: list as Order[], metaCounter: [{ total }] };
	}

	private async findOwnOrder(orderId: string, owner: T): Promise<Order> {
		const order = await this.orderModel
			.findOne({ _id: shapeIntoMongoObjectId(orderId), ...owner })
			.lean()
			.exec();
		if (!order) throw new NotFoundException(Message.NO_DATA_FOUND);
		return order as Order;
	}

	/** The update only applies if nobody changed the order meanwhile (optimistic check on the status). */
	private async moveOrder(
		order: Order,
		status: OrderStatus,
		actor: OrderActor,
		note?: string,
		extra: T = {},
	): Promise<Order> {
		const updated = await this.orderModel
			.findOneAndUpdate(
				{ _id: order._id, orderStatus: order.orderStatus },
				{ $set: { orderStatus: status, ...extra }, $push: { history: { status, actor, note, at: new Date() } } },
				{ new: true },
			)
			.lean()
			.exec();
		if (!updated) throw new BadRequestException(Message.ORDER_STATUS_LOCKED);
		return updated as Order;
	}

	private actorOf(member: AuthMemberPayload, order: { buyerId: ObjectId; sellerId: ObjectId }): OrderActor | null {
		if (String(order.buyerId) === String(member._id)) return OrderActor.BUYER;
		if (String(order.sellerId) === String(member._id)) return OrderActor.SELLER;
		if (member.memberType === MemberType.ADMIN) return OrderActor.ADMIN;
		return null;
	}

	/** Tells the other side of the order. Admin actions notify both. */
	private async notify(order: Order, actor: OrderActor, title: string): Promise<void> {
		const receivers =
			actor === OrderActor.BUYER
				? [order.sellerId]
				: actor === OrderActor.SELLER
					? [order.buyerId]
					: [order.buyerId, order.sellerId];
		for (const receiverId of receivers) {
			const toBuyer = String(receiverId) === String(order.buyerId);
			await this.notificationService.createNotification({
				notificationType: NotificationType.ORDER,
				notificationGroup: NotificationGroup.ORDER,
				notificationTitle: title,
				authorId: toBuyer ? order.sellerId : order.buyerId,
				receiverId,
				orderId: order._id,
			});
		}
	}

	private summary(order: Order): string {
		const [first, ...rest] = order.items;
		return rest.length ? `${first.productTitle} and ${rest.length} more` : first.productTitle;
	}
}
