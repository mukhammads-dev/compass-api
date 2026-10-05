import { Field, InputType, Int } from '@nestjs/graphql';
import { IsIn, IsNotEmpty, IsOptional, Length, Max, Min } from 'class-validator';
import type { ObjectId } from '../../types/common';
import { availableCommentSorts, MAX_PAGE_LIMIT } from '../../config';
import { CommentGroup } from '../../enums/comment.enum';
import { Direction } from '../../enums/common.enum';

@InputType()
export class CommentInput {
	@IsNotEmpty()
	@Field(() => CommentGroup)
	commentGroup: CommentGroup;

	@IsNotEmpty()
	@Length(1, 500)
	@Field(() => String)
	commentContent: string;

	@IsNotEmpty()
	@Field(() => String)
	commentRefId: ObjectId;

	/** filled by the server from the token */
	memberId?: ObjectId;
}

@InputType()
class CISearch {
	@IsNotEmpty()
	@Field(() => String)
	commentRefId: ObjectId;
}

@InputType()
export class CommentsInquiry {
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
	@IsIn(availableCommentSorts)
	@Field(() => String, { nullable: true })
	sort?: string;

	@IsOptional()
	@Field(() => Direction, { nullable: true })
	direction?: Direction;

	@IsNotEmpty()
	@Field(() => CISearch)
	search: CISearch;
}
