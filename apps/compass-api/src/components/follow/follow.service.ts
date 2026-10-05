import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { ObjectId } from '../../libs/types/common';
import {
	errorMessage,
	lookupAuthMemberFollowed,
	lookupAuthMemberLiked,
	lookupFollowerData,
	lookupFollowingData,
	shapeIntoMongoObjectId,
} from '../../libs/config';
import { Follower, Followers, Following, Followings } from '../../libs/dto/follow/follow';
import { FollowInquiry } from '../../libs/dto/follow/follow.input';
import { Direction, Message } from '../../libs/enums/common.enum';
import { NotificationGroup, NotificationType } from '../../libs/enums/notification.enum';
import { T } from '../../libs/types/common';
import { MemberService } from '../member/member.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class FollowService {
	private readonly logger = new Logger(FollowService.name);

	constructor(
		@InjectModel('Follow') private readonly followModel: Model<Follower | Following>,
		private readonly memberService: MemberService,
		private readonly notificationService: NotificationService,
	) {}

	public async subscribe(followerId: ObjectId, followingId: ObjectId): Promise<Follower> {
		if (String(followerId) === String(followingId)) {
			throw new BadRequestException(Message.SELF_SUBSCRIPTION_DENIED);
		}

		await this.memberService.getMember(null, followingId);

		let result: Follower;
		try {
			result = (await this.followModel.create({ followingId, followerId })) as Follower;
		} catch (err) {
			this.logger.error(`subscribe: ${errorMessage(err)}`);
			throw new BadRequestException(Message.CREATE_FAILED);
		}

		await this.memberService.memberStatsEditor({ _id: followerId, targetKey: 'memberFollowings', modifier: 1 });
		await this.memberService.memberStatsEditor({ _id: followingId, targetKey: 'memberFollowers', modifier: 1 });
		await this.notificationService.createNotification({
			notificationType: NotificationType.FOLLOW,
			notificationGroup: NotificationGroup.MEMBER,
			notificationTitle: 'You have a new follower',
			authorId: followerId,
			receiverId: followingId,
		});

		return result;
	}

	public async unsubscribe(followerId: ObjectId, followingId: ObjectId): Promise<Follower> {
		const result = (await this.followModel.findOneAndDelete({ followingId, followerId }).exec()) as Follower | null;
		if (!result) throw new NotFoundException(Message.NO_DATA_FOUND);

		await this.memberService.memberStatsEditor({ _id: followerId, targetKey: 'memberFollowings', modifier: -1 });
		await this.memberService.memberStatsEditor({ _id: followingId, targetKey: 'memberFollowers', modifier: -1 });

		return result;
	}

	public async getMemberFollowings(memberId: ObjectId | null, input: FollowInquiry): Promise<Followings> {
		const { page, limit, search } = input;
		if (!search?.followerId) throw new BadRequestException(Message.BAD_REQUEST);

		const match: T = { followerId: shapeIntoMongoObjectId(search.followerId) };

		const result = await this.followModel
			.aggregate<Followings>([
				{ $match: match },
				{ $sort: { createdAt: input?.direction ?? Direction.DESC } },
				{
					$facet: {
						list: [
							{ $skip: (page - 1) * limit },
							{ $limit: limit },
							lookupAuthMemberLiked(memberId, '$followingId'),
							lookupAuthMemberFollowed({ followerId: memberId, followingId: '$followingId' }),
							lookupFollowingData,
							{ $unwind: '$followingData' },
						],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();

		return result[0];
	}

	public async getMemberFollowers(memberId: ObjectId | null, input: FollowInquiry): Promise<Followers> {
		const { page, limit, search } = input;
		if (!search?.followingId) throw new BadRequestException(Message.BAD_REQUEST);

		const match: T = { followingId: shapeIntoMongoObjectId(search.followingId) };

		const result = await this.followModel
			.aggregate<Followers>([
				{ $match: match },
				{ $sort: { createdAt: input?.direction ?? Direction.DESC } },
				{
					$facet: {
						list: [
							{ $skip: (page - 1) * limit },
							{ $limit: limit },
							lookupAuthMemberLiked(memberId, '$followerId'),
							lookupAuthMemberFollowed({ followerId: memberId, followingId: '$followerId' }),
							lookupFollowerData,
							{ $unwind: '$followerData' },
						],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();

		return result[0];
	}
}
