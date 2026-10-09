import { Schema } from 'mongoose';
import { MAX_ITEM_QUANTITY } from '../libs/config';

/** One line of a member's cart. Prices are never stored here: they are read live at checkout. */
const CartItemSchema = new Schema(
	{
		memberId: { type: Schema.Types.ObjectId, required: true, ref: 'Member' },
		productId: { type: Schema.Types.ObjectId, required: true, ref: 'Product' },
		quantity: { type: Number, required: true, min: 1, max: MAX_ITEM_QUANTITY },
		/** installer assembles it on delivery day (only offered when productAssembly is true) */
		assembly: { type: Boolean, default: false },
	},
	{ timestamps: true, collection: 'cartItems' },
);

CartItemSchema.index({ memberId: 1, productId: 1 }, { unique: true });

export default CartItemSchema;
