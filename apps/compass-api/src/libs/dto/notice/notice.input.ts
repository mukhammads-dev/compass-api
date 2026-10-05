import { Field, InputType, Int } from '@nestjs/graphql';
import { IsIn, IsNotEmpty, IsOptional, Length, Max, Min } from 'class-validator';
import type { ObjectId } from '../../types/common';
import { availableNoticeSorts, MAX_PAGE_LIMIT } from '../../config';
import { Direction } from '../../enums/common.enum';
import { NoticeCategory, NoticeStatus } from '../../enums/notice.enum';

@InputType()
export class NoticeInput {
	@IsNotEmpty()
	@Field(() => NoticeCategory)
	noticeCategory: NoticeCategory;

	@IsOptional()
	@Field(() => NoticeStatus, { nullable: true })
	noticeStatus?: NoticeStatus;

	@IsNotEmpty()
	@Length(3, 100)
	@Field(() => String)
	noticeTitle: string;

	@IsNotEmpty()
	@Length(3, 5000)
	@Field(() => String)
	noticeContent: string;

	@IsOptional()
	@Field(() => Date, { nullable: true })
	eventStartAt?: Date;

	@IsOptional()
	@Field(() => Date, { nullable: true })
	eventEndAt?: Date;

	/** filled by the server from the token */
	memberId?: ObjectId;
}

@InputType()
class NTISearch {
	@IsOptional()
	@Field(() => NoticeCategory, { nullable: true })
	noticeCategory?: NoticeCategory;

	@IsOptional()
	@Field(() => String, { nullable: true })
	text?: string;
}

@InputType()
export class NoticesInquiry {
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
	@IsIn(availableNoticeSorts)
	@Field(() => String, { nullable: true })
	sort?: string;

	@IsOptional()
	@Field(() => Direction, { nullable: true })
	direction?: Direction;

	@IsNotEmpty()
	@Field(() => NTISearch)
	search: NTISearch;
}

@InputType()
class ANTISearch {
	@IsOptional()
	@Field(() => NoticeCategory, { nullable: true })
	noticeCategory?: NoticeCategory;

	@IsOptional()
	@Field(() => NoticeStatus, { nullable: true })
	noticeStatus?: NoticeStatus;
}

@InputType()
export class AllNoticesInquiry {
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
	@IsIn(availableNoticeSorts)
	@Field(() => String, { nullable: true })
	sort?: string;

	@IsOptional()
	@Field(() => Direction, { nullable: true })
	direction?: Direction;

	@IsNotEmpty()
	@Field(() => ANTISearch)
	search: ANTISearch;
}
