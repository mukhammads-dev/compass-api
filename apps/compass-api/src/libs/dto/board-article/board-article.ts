import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
import type { ObjectId } from '../../types/common';
import { BoardArticleCategory, BoardArticleStatus, HomeType, TagSource } from '../../enums/board-article.enum';
import { ProductStyle } from '../../enums/product.enum';
import { MeLiked } from '../like/like';
import { Member, TotalCounter } from '../member/member';
import { Product } from '../product/product';

/** A product pin placed on a Room Tour image. x and y are percentages (0-100). */
@ObjectType()
export class TaggedProduct {
	@Field(() => String)
	productId: ObjectId;

	@Field(() => Int)
	imageIndex: number;

	@Field(() => Float)
	x: number;

	@Field(() => Float)
	y: number;

	@Field(() => TagSource)
	source: TagSource;
}

@ObjectType()
export class BoardArticle {
	@Field(() => String)
	_id: ObjectId;

	@Field(() => BoardArticleCategory)
	articleCategory: BoardArticleCategory;

	@Field(() => BoardArticleStatus)
	articleStatus: BoardArticleStatus;

	@Field(() => String)
	articleTitle: string;

	@Field(() => String)
	articleContent: string;

	@Field(() => String, { nullable: true })
	articleImage?: string;

	@Field(() => [String])
	roomImages: string[];

	@Field(() => HomeType, { nullable: true })
	homeType?: HomeType;

	@Field(() => Float, { nullable: true })
	homeSize?: number;

	@Field(() => ProductStyle, { nullable: true })
	homeStyle?: ProductStyle;

	@Field(() => [TaggedProduct])
	taggedProducts: TaggedProduct[];

	@Field(() => Int)
	articleViews: number;

	@Field(() => Int)
	articleLikes: number;

	@Field(() => Int)
	articleComments: number;

	@Field(() => Int)
	articleRank: number;

	@Field(() => String)
	memberId: ObjectId;

	@Field(() => Date, { nullable: true })
	deletedAt?: Date;

	@Field(() => Date)
	createdAt: Date;

	@Field(() => Date)
	updatedAt: Date;

	/** from aggregation */
	@Field(() => [MeLiked], { nullable: true })
	meLiked?: MeLiked[];

	/** from aggregation */
	@Field(() => Member, { nullable: true })
	memberData?: Member;

	/** from aggregation: products referenced by taggedProducts (sold ones included) */
	@Field(() => [Product], { nullable: true })
	taggedProductsData?: Product[];
}

@ObjectType()
export class BoardArticles {
	@Field(() => [BoardArticle])
	list: BoardArticle[];

	@Field(() => [TotalCounter], { nullable: true })
	metaCounter: TotalCounter[];
}
