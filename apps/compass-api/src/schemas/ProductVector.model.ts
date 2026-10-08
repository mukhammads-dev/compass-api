import { Schema } from 'mongoose';
import { LensLabel } from '../libs/enums/lens.enum';

/**
 * Compass Lens index: one visual fingerprint per product, taken from its first image.
 * Kept apart from products so product queries never carry 1280 numbers around.
 */
const ProductVectorSchema = new Schema(
	{
		productId: { type: Schema.Types.ObjectId, required: true, ref: 'Product' },
		/** the image the vector was made from; a new first image makes the vector stale */
		vectorImage: { type: String, required: true },
		/** what the product is, from its title or the detector; empty when neither could tell */
		vectorLabel: { type: String, enum: LensLabel },
		vectorData: { type: [Number], required: true },
	},
	{ timestamps: true, collection: 'productVectors' },
);

ProductVectorSchema.index({ productId: 1 }, { unique: true });

export default ProductVectorSchema;
