import { Field, InputType, Int } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, Max, Min } from 'class-validator';
import type { ObjectId } from '../../types/common';
import { MAX_PAGE_LIMIT } from '../../config';
import { NotificationGroup, NotificationStatus, NotificationType } from '../../enums/notification.enum';

/** Internal input, created by services only (never exposed as a mutation argument). */
export interface NotificationInput {
	notificationType: NotificationType;
	notificationGroup: NotificationGroup;
	notificationTitle: string;
	notificationDesc?: string;
	authorId: ObjectId;
	receiverId: ObjectId;
	productId?: ObjectId;
	articleId?: ObjectId;
}

@InputType()
class NISearch {
	@IsOptional()
	@Field(() => NotificationStatus, { nullable: true })
	notificationStatus?: NotificationStatus;
}

@InputType()
export class NotificationsInquiry {
	@IsNotEmpty()
	@Min(1)
	@Field(() => Int)
	page: number;

	@IsNotEmpty()
	@Min(1)
	@Max(MAX_PAGE_LIMIT)
	@Field(() => Int)
	limit: number;

	@IsNotEmpty()
	@Field(() => NISearch)
	search: NISearch;
}
