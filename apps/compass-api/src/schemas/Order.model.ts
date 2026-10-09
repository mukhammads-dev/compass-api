import { Schema } from 'mongoose';
import { OrderActor, OrderStatus, OrderType, PaymentMethod } from '../libs/enums/order.enum';

/**
 * One order = one seller. A checkout with three stores creates three orders sharing a checkoutId,
 * because every store prepares, delivers and can cancel on its own.
 * Titles, prices and images are copied in: an order must not change when the product does.
 */
const OrderItemSchema = new Schema(
	{
		productId: { type: Schema.Types.ObjectId, required: true, ref: 'Product' },
		productTitle: { type: String, required: true },
		productImage: { type: String, required: true },
		productWidth: { type: Number, required: true },
		productDepth: { type: Number, required: true },
		productHeight: { type: Number, required: true },
		unitPrice: { type: Number, required: true },
		quantity: { type: Number, required: true, min: 1 },
		assembly: { type: Boolean, default: false },
		assemblyFee: { type: Number, default: 0 },
	},
	{ _id: false },
);

const OrderDeliverySchema = new Schema(
	{
		recipient: { type: String, required: true },
		phone: { type: String, required: true },
		address: { type: String, required: true },
		addressDetail: { type: String },
		postalCode: { type: String, required: true },
		floor: { type: Number, required: true },
		elevator: { type: Boolean, required: true },
		preferredDate: { type: Date, required: true },
		memo: { type: String },
	},
	{ _id: false },
);

const OrderMeetupSchema = new Schema(
	{
		meetupDate: { type: Date, required: true },
		/** where the item is, copied from the listing */
		meetupPlace: { type: String, required: true },
		note: { type: String },
	},
	{ _id: false },
);

const OrderPaymentSchema = new Schema(
	{
		method: { type: String, enum: PaymentMethod, required: true },
		amount: { type: Number, required: true },
		approvalNo: { type: String, required: true },
		cardBrand: { type: String },
		cardLast4: { type: String },
		paidAt: { type: Date, required: true },
		refundedAt: { type: Date },
	},
	{ _id: false },
);

const OrderEventSchema = new Schema(
	{
		status: { type: String, enum: OrderStatus, required: true },
		actor: { type: String, enum: OrderActor, required: true },
		note: { type: String },
		at: { type: Date, required: true },
	},
	{ _id: false },
);

const OrderSchema = new Schema(
	{
		orderNo: { type: String, required: true },
		checkoutId: { type: String, required: true },
		orderType: { type: String, enum: OrderType, required: true },
		orderStatus: { type: String, enum: OrderStatus, default: OrderStatus.PAID },

		buyerId: { type: Schema.Types.ObjectId, required: true, ref: 'Member' },
		buyerNick: { type: String, required: true },
		sellerId: { type: Schema.Types.ObjectId, required: true, ref: 'Member' },
		sellerNick: { type: String, required: true },
		sellerImage: { type: String },

		items: { type: [OrderItemSchema], required: true },
		itemsTotal: { type: Number, required: true },
		deliveryFee: { type: Number, default: 0 },
		assemblyTotal: { type: Number, default: 0 },
		stairsFee: { type: Number, default: 0 },
		orderTotal: { type: Number, required: true },

		delivery: { type: OrderDeliverySchema },
		meetup: { type: OrderMeetupSchema },
		payment: { type: OrderPaymentSchema, required: true },

		/** what the seller tells the buyer, e.g. "Truck arrives between 10 and 12" */
		sellerNote: { type: String },
		cancelReason: { type: String },
		canceledBy: { type: String, enum: OrderActor },
		history: { type: [OrderEventSchema], default: [] },
	},
	{ timestamps: true, collection: 'orders' },
);

OrderSchema.index({ orderNo: 1 }, { unique: true });
OrderSchema.index({ buyerId: 1, createdAt: -1 });
OrderSchema.index({ sellerId: 1, orderStatus: 1, createdAt: -1 });
OrderSchema.index({ checkoutId: 1 });
OrderSchema.index({ orderStatus: 1, updatedAt: 1 });

export default OrderSchema;
