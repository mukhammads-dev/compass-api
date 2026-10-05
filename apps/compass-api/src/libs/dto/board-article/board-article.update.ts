import { Field, Float, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsNotEmpty, IsOptional, Length, Max, Min, ValidateNested } from 'class-validator';
import type { ObjectId } from '../../types/common';
import { MAX_ROOM_TOUR_IMAGES, MAX_ROOM_TOUR_TAGS } from '../../config';
import { BoardArticleStatus, HomeType } from '../../enums/board-article.enum';
import { ProductStyle } from '../../enums/product.enum';
import { TaggedProductInput } from './board-article.input';

@InputType()
export class BoardArticleUpdate {
	@IsNotEmpty()
	@Field(() => String)
	_id: ObjectId;

	@IsOptional()
	@Field(() => BoardArticleStatus, { nullable: true })
	articleStatus?: BoardArticleStatus;

	@IsOptional()
	@Length(3, 100)
	@Field(() => String, { nullable: true })
	articleTitle?: string;

	@IsOptional()
	@Length(3, 5000)
	@Field(() => String, { nullable: true })
	articleContent?: string;

	@IsOptional()
	@Field(() => String, { nullable: true })
	articleImage?: string;

	@IsOptional()
	@ArrayMaxSize(MAX_ROOM_TOUR_IMAGES)
	@Field(() => [String], { nullable: true })
	roomImages?: string[];

	@IsOptional()
	@Field(() => HomeType, { nullable: true })
	homeType?: HomeType;

	@IsOptional()
	@Min(1)
	@Max(200)
	@Field(() => Float, { nullable: true })
	homeSize?: number;

	@IsOptional()
	@Field(() => ProductStyle, { nullable: true })
	homeStyle?: ProductStyle;

	/** Replaces the whole tag list. Counters are re-synced by diff. */
	@IsOptional()
	@ArrayMaxSize(MAX_ROOM_TOUR_TAGS)
	@ValidateNested({ each: true })
	@Type(() => TaggedProductInput)
	@Field(() => [TaggedProductInput], { nullable: true })
	taggedProducts?: TaggedProductInput[];

	/** set by the server when status changes */
	deletedAt?: Date;
}
