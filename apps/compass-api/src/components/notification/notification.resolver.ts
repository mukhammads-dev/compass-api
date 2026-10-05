import { Logger, UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { ObjectId } from '../../libs/types/common';
import { shapeIntoMongoObjectId } from '../../libs/config';
import { Notification, Notifications } from '../../libs/dto/notification/notification';
import { NotificationsInquiry } from '../../libs/dto/notification/notification.input';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { NotificationService } from './notification.service';

@Resolver()
export class NotificationResolver {
	private readonly logger = new Logger(NotificationResolver.name);

	constructor(private readonly notificationService: NotificationService) {}

	@UseGuards(AuthGuard)
	@Query(() => Notifications)
	public async getNotifications(
		@Args('input') input: NotificationsInquiry,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Notifications> {
		this.logger.log('Query: getNotifications');
		return await this.notificationService.getNotifications(memberId, input);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => Notification)
	public async readNotification(
		@Args('notificationId') input: string,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Notification> {
		this.logger.log('Mutation: readNotification');
		const notificationId = shapeIntoMongoObjectId(input);
		return await this.notificationService.readNotification(memberId, notificationId);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => Int)
	public async readAllNotifications(@AuthMember('_id') memberId: ObjectId): Promise<number> {
		this.logger.log('Mutation: readAllNotifications');
		return await this.notificationService.readAllNotifications(memberId);
	}
}
