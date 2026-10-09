import { Schema } from 'mongoose';
import {
	ProductCondition,
	ProductLocation,
	ProductMaterial,
	ProductRoom,
	ProductStatus,
	ProductStyle,
	ProductType,
} from '../libs/enums/product.enum';

const ProductSchema = new Schema(
	{
		productType: { type: String, enum: ProductType, required: true },
		productRoom: { type: String, enum: ProductRoom, required: true },
		productStyle: { type: String, enum: ProductStyle, required: true },
		productMaterial: { type: String, enum: ProductMaterial, required: true },
		productCondition: { type: String, enum: ProductCondition, required: true },
		productStatus: { type: String, enum: ProductStatus, default: ProductStatus.ACTIVE },
		productLocation: { type: String, enum: ProductLocation, required: true },

		productAddress: { type: String, required: true },
		productTitle: { type: String, required: true },
		productPrice: { type: Number, required: true },
		productSalePrice: { type: Number },

		/** sizes in cm, used by "Fits my space" and My Room fit check */
		productWidth: { type: Number, required: true },
		productDepth: { type: Number, required: true },
		productHeight: { type: Number, required: true },

		productColor: { type: String, required: true },
		/** units left; USED items are always 1. Reaching 0 marks the product SOLD */
		productStock: { type: Number, default: 1, min: 0 },
		productDeliveryFee: { type: Number, default: 0 },
		productAssembly: { type: Boolean, default: false },
		productImages: { type: [String], required: true },
		productDesc: { type: String },

		productViews: { type: Number, default: 0 },
		productLikes: { type: Number, default: 0 },
		productComments: { type: Number, default: 0 },
		productRank: { type: Number, default: 0 },
		productRoomTours: { type: Number, default: 0 },

		memberId: { type: Schema.Types.ObjectId, required: true, ref: 'Member' },

		soldAt: { type: Date },
		deletedAt: { type: Date },
	},
	{ timestamps: true, collection: 'products' },
);

/** one seller cannot list two products with the same title */
ProductSchema.index({ memberId: 1, productTitle: 1 }, { unique: true });
ProductSchema.index({ productStatus: 1, productRank: -1 });
ProductSchema.index({ productStatus: 1, productStyle: 1, productRoom: 1 });

export default ProductSchema;
