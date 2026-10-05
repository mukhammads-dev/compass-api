import { Schema } from 'mongoose';
import { BoardArticleCategory, BoardArticleStatus, HomeType, TagSource } from '../libs/enums/board-article.enum';
import { ProductStyle } from '../libs/enums/product.enum';

const TaggedProductSchema = new Schema(
	{
		productId: { type: Schema.Types.ObjectId, required: true, ref: 'Product' },
		imageIndex: { type: Number, required: true },
		x: { type: Number, required: true },
		y: { type: Number, required: true },
		source: { type: String, enum: TagSource, default: TagSource.MANUAL },
	},
	{ _id: false },
);

const BoardArticleSchema = new Schema(
	{
		articleCategory: { type: String, enum: BoardArticleCategory, required: true },
		articleStatus: { type: String, enum: BoardArticleStatus, default: BoardArticleStatus.ACTIVE },

		articleTitle: { type: String, required: true },
		articleContent: { type: String, required: true },
		articleImage: { type: String },

		/** ROOM_TOUR only */
		roomImages: { type: [String], default: [] },
		homeType: { type: String, enum: HomeType },
		homeSize: { type: Number },
		homeStyle: { type: String, enum: ProductStyle },
		taggedProducts: { type: [TaggedProductSchema], default: [] },

		articleViews: { type: Number, default: 0 },
		articleLikes: { type: Number, default: 0 },
		articleComments: { type: Number, default: 0 },
		articleRank: { type: Number, default: 0 },

		memberId: { type: Schema.Types.ObjectId, required: true, ref: 'Member' },

		deletedAt: { type: Date },
	},
	{ timestamps: true, collection: 'boardArticles' },
);

BoardArticleSchema.index({ articleCategory: 1, articleStatus: 1, createdAt: -1 });
BoardArticleSchema.index({ 'taggedProducts.productId': 1 });

export default BoardArticleSchema;
