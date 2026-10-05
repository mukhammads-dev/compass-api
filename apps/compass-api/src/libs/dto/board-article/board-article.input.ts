import { Field, Float, InputType, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsIn, IsNotEmpty, IsOptional, Length, Max, Min, ValidateNested } from 'class-validator';
import type { ObjectId } from '../../types/common';
import { availableBoardArticleSorts, MAX_PAGE_LIMIT, MAX_ROOM_TOUR_IMAGES, MAX_ROOM_TOUR_TAGS } from '../../config';
import { BoardArticleCategory, BoardArticleStatus, HomeType, TagSource } from '../../enums/board-article.enum';
import { Direction } from '../../enums/common.enum';
import { ProductStyle } from '../../enums/product.enum';

@InputType()
export class TaggedProductInput {
	@IsNotEmpty()
	@Field(() => String)
	productId: ObjectId;

	@IsNotEmpty()
	@Min(0)
	@Field(() => Int)
	imageIndex: number;

	@IsNotEmpty()
	@Min(0)
	@Max(100)
	@Field(() => Float)
	x: number;

	@IsNotEmpty()
	@Min(0)
	@Max(100)
	@Field(() => Float)
	y: number;

	@IsOptional()
	@Field(() => TagSource, { nullable: true })
	source?: TagSource;
}

@InputType()
export class BoardArticleInput {
	@IsNotEmpty()
	@Field(() => BoardArticleCategory)
	articleCategory: BoardArticleCategory;

	@IsNotEmpty()
	@Length(3, 100)
	@Field(() => String)
	articleTitle: string;

	@IsNotEmpty()
	@Length(3, 5000)
	@Field(() => String)
	articleContent: string;

	@IsOptional()
	@Field(() => String, { nullable: true })
	articleImage?: string;

	/** ROOM_TOUR only */
	@IsOptional()
	@ArrayMaxSize(MAX_ROOM_TOUR_IMAGES)
	@Field(() => [String], { nullable: true })
	roomImages?: string[];

	/** ROOM_TOUR only */
	@IsOptional()
	@Field(() => HomeType, { nullable: true })
	homeType?: HomeType;

	/** ROOM_TOUR only, in pyeong (평) */
	@IsOptional()
	@Min(1)
	@Max(200)
	@Field(() => Float, { nullable: true })
	homeSize?: number;

	/** ROOM_TOUR only */
	@IsOptional()
	@Field(() => ProductStyle, { nullable: true })
	homeStyle?: ProductStyle;

	/** ROOM_TOUR only */
	@IsOptional()
	@ArrayMaxSize(MAX_ROOM_TOUR_TAGS)
	@ValidateNested({ each: true })
	@Type(() => TaggedProductInput)
	@Field(() => [TaggedProductInput], { nullable: true })
	taggedProducts?: TaggedProductInput[];

	/** filled by the server from the token */
	memberId?: ObjectId;
}

@InputType()
class HomeSizeRange {
	@Field(() => Float)
	start: number;

	@Field(() => Float)
	end: number;
}

@InputType()
class BAISearch {
	@IsOptional()
	@Field(() => BoardArticleCategory, { nullable: true })
	articleCategory?: BoardArticleCategory;

	@IsOptional()
	@Field(() => [HomeType], { nullable: true })
	homeTypeList?: HomeType[];

	@IsOptional()
	@Field(() => HomeSizeRange, { nullable: true })
	homeSizeRange?: HomeSizeRange;

	@IsOptional()
	@Field(() => [ProductStyle], { nullable: true })
	styleList?: ProductStyle[];

	@IsOptional()
	@Field(() => String, { nullable: true })
	memberId?: ObjectId;

	@IsOptional()
	@Field(() => String, { nullable: true })
	text?: string;
}

@InputType()
export class BoardArticlesInquiry {
	@IsNotEmpty()
	@Min(1)
	@Field(() => Int)
	page: number;

	@IsNotEmpty()
	@Min(1)
	@Max(MAX_PAGE_LIMIT)
	@Field(() => Int)
	limit: number;

	@IsOptional()
	@IsIn(availableBoardArticleSorts)
	@Field(() => String, { nullable: true })
	sort?: string;

	@IsOptional()
	@Field(() => Direction, { nullable: true })
	direction?: Direction;

	@IsNotEmpty()
	@Field(() => BAISearch)
	search: BAISearch;
}

@InputType()
export class ProductRoomToursInquiry {
	@IsNotEmpty()
	@Field(() => String)
	productId: ObjectId;

	@IsNotEmpty()
	@Min(1)
	@Field(() => Int)
	page: number;

	@IsNotEmpty()
	@Min(1)
	@Max(MAX_PAGE_LIMIT)
	@Field(() => Int)
	limit: number;
}

@InputType()
class ABAISearch {
	@IsOptional()
	@Field(() => BoardArticleStatus, { nullable: true })
	articleStatus?: BoardArticleStatus;

	@IsOptional()
	@Field(() => BoardArticleCategory, { nullable: true })
	articleCategory?: BoardArticleCategory;
}

@InputType()
export class AllBoardArticlesInquiry {
	@IsNotEmpty()
	@Min(1)
	@Field(() => Int)
	page: number;

	@IsNotEmpty()
	@Min(1)
	@Max(MAX_PAGE_LIMIT)
	@Field(() => Int)
	limit: number;

	@IsOptional()
	@IsIn(availableBoardArticleSorts)
	@Field(() => String, { nullable: true })
	sort?: string;

	@IsOptional()
	@Field(() => Direction, { nullable: true })
	direction?: Direction;

	@IsNotEmpty()
	@Field(() => ABAISearch)
	search: ABAISearch;
}
