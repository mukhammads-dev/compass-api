import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, Length } from 'class-validator';
import type { ObjectId } from '../../types/common';
import { NoticeCategory, NoticeStatus } from '../../enums/notice.enum';

@InputType()
export class NoticeUpdate {
	@IsNotEmpty()
	@Field(() => String)
	_id: ObjectId;

	@IsOptional()
	@Field(() => NoticeCategory, { nullable: true })
	noticeCategory?: NoticeCategory;

	@IsOptional()
	@Field(() => NoticeStatus, { nullable: true })
	noticeStatus?: NoticeStatus;

	@IsOptional()
	@Length(3, 100)
	@Field(() => String, { nullable: true })
	noticeTitle?: string;

	@IsOptional()
	@Length(3, 5000)
	@Field(() => String, { nullable: true })
	noticeContent?: string;

	@IsOptional()
	@Field(() => Date, { nullable: true })
	eventStartAt?: Date;

	@IsOptional()
	@Field(() => Date, { nullable: true })
	eventEndAt?: Date;
}
