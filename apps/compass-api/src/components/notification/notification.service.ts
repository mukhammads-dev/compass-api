import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { ObjectId } from '../../libs/types/common';
import { Notification, Notifications } from '../../libs/dto/notification/notification';
import { NotificationInput, NotificationsInquiry } from '../../libs/dto/notification/notification.input';
import { Message } from '../../libs/enums/common.enum';
import { NotificationStatus } from '../../libs/enums/notification.enum';
import { T } from '../../libs/types/common';
import { errorMessage } from '../../libs/config';

@Injectable()
export class NotificationService {
	private readonly logger = new Logger(NotificationService.name);

	constructor(@InjectModel('Notification') private readonly notificationModel: Model<Notification>) {}

	/**
	 * Called by other services. Never notifies a member about their own action,
	 * and never breaks the caller: a failed notification is only logged.
	 */
	public async createNotification(input: NotificationInput): Promise<void> {
		if (String(input.authorId) === String(input.receiverId)) return;

		try {
			await this.notificationModel.create(input);
		} catch (err) {
			this.logger.error(`createNotification: ${errorMessage(err)}`);
		}
	}

	public async getNotifications(memberId: ObjectId, input: NotificationsInquiry): Promise<Notifications> {
		const { page, limit, search } = input;
		const match: T = { receiverId: memberId };
		if (search?.notificationStatus) match.notificationStatus = search.notificationStatus;

		const result = await this.notificationModel
			.aggregate<Notifications>([
				{ $match: match },
				{ $sort: { createdAt: -1 } },
				{
					$facet: {
						list: [
							{ $skip: (page - 1) * limit },
							{ $limit: limit },
							{
								$lookup: {
									from: 'members',
									localField: 'authorId',
									foreignField: '_id',
									as: 'authorData',
								},
							},
							{ $unwind: { path: '$authorData', preserveNullAndEmptyArrays: true } },
						],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();

		return result[0];
	}

	public async readNotification(memberId: ObjectId, notificationId: ObjectId): Promise<Notification> {
		const result = await this.notificationModel
			.findOneAndUpdate(
				{ _id: notificationId, receiverId: memberId },
				{ notificationStatus: NotificationStatus.READ },
				{ new: true },
			)
			.exec();
		if (!result) throw new NotFoundException(Message.NO_DATA_FOUND);
		return result;
	}

	public async readAllNotifications(memberId: ObjectId): Promise<number> {
		const result = await this.notificationModel
			.updateMany(
				{ receiverId: memberId, notificationStatus: NotificationStatus.WAIT },
				{ notificationStatus: NotificationStatus.READ },
			)
			.exec();
		return result.modifiedCount;
	}
}
