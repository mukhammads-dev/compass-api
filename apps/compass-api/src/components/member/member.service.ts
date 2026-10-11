import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';
import type { ObjectId } from '../../libs/types/common';
import { errorMessage, escapeRegex, lookupAuthMemberFollowed, lookupAuthMemberLiked } from '../../libs/config';
import { MeFollowed } from '../../libs/dto/follow/follow';
import { Member, Members } from '../../libs/dto/member/member';
import { AgentsInquiry, LoginInput, MemberInput, MembersInquiry } from '../../libs/dto/member/member.input';
import { MemberUpdate, MemberUpdateByAdmin } from '../../libs/dto/member/member.update';
import { Direction, Message } from '../../libs/enums/common.enum';
import { LikeGroup } from '../../libs/enums/like.enum';
import { ProductStatus } from '../../libs/enums/product.enum';
import { MemberStatus, MemberType } from '../../libs/enums/member.enum';
import { NotificationGroup, NotificationType } from '../../libs/enums/notification.enum';
import { ViewGroup } from '../../libs/enums/view.enum';
import { StatisticModifier, T } from '../../libs/types/common';
import { AuthService } from '../auth/auth.service';
import { LikeService } from '../like/like.service';
import { NotificationService } from '../notification/notification.service';
import { ViewService } from '../view/view.service';

/** The store's three newest active products, first photo only: the "shop window" of a store card. */
const lookupStoreWindow: PipelineStage.Lookup = {
	$lookup: {
		from: 'products',
		let: { storeId: '$_id' },
		pipeline: [
			{ $match: { $expr: { $eq: ['$memberId', '$$storeId'] }, productStatus: ProductStatus.ACTIVE } },
			{ $sort: { createdAt: -1 } },
			{ $limit: 3 },
			{ $project: { _id: 0, image: { $first: '$productImages' } } },
		],
		as: 'storeWindow',
	},
};

const addStoreWindow: PipelineStage.AddFields = { $addFields: { storeWindow: '$storeWindow.image' } };

@Injectable()
export class MemberService {
	private readonly logger = new Logger(MemberService.name);

	constructor(
		@InjectModel('Member') private readonly memberModel: Model<Member>,
		@InjectModel('Follow') private readonly followModel: Model<MeFollowed>,
		private readonly authService: AuthService,
		private readonly viewService: ViewService,
		private readonly likeService: LikeService,
		private readonly notificationService: NotificationService,
	) {}

	/* ------------------------------------------------------------------ */
	/*  AUTH                                                              */
	/* ------------------------------------------------------------------ */

	public async signup(input: MemberInput): Promise<Member> {
		input.memberPassword = await this.authService.hashPassword(input.memberPassword);

		try {
			const result = await this.memberModel.create(input);
			result.accessToken = await this.authService.createToken(result);
			return result;
		} catch (err) {
			this.logger.error(`signup: ${errorMessage(err)}`);
			throw new BadRequestException(Message.USED_MEMBER_NICK_OR_PHONE);
		}
	}

	public async login(input: LoginInput): Promise<Member> {
		const { memberNick, memberPassword } = input;

		const response = await this.memberModel.findOne({ memberNick }).select('+memberPassword').exec();
		if (!response || response.memberStatus === MemberStatus.DELETE) {
			throw new NotFoundException(Message.NO_MEMBER_NICK);
		}
		if (response.memberStatus === MemberStatus.BLOCK) {
			throw new ForbiddenException(Message.BLOCKED_USER);
		}

		const isMatch = await this.authService.comparePasswords(memberPassword, response.memberPassword as string);
		if (!isMatch) throw new BadRequestException(Message.WRONG_PASSWORD);

		response.accessToken = await this.authService.createToken(response);
		return response;
	}

	/* ------------------------------------------------------------------ */
	/*  MEMBER                                                            */
	/* ------------------------------------------------------------------ */

	public async updateMember(memberId: ObjectId, input: MemberUpdate): Promise<Member> {
		if (input.memberPassword) {
			input.memberPassword = await this.authService.hashPassword(input.memberPassword);
		}

		let result: Member | null;
		try {
			result = await this.memberModel
				.findOneAndUpdate({ _id: memberId, memberStatus: MemberStatus.ACTIVE }, input, { new: true })
				.exec();
		} catch (err) {
			this.logger.error(`updateMember: ${errorMessage(err)}`);
			throw new BadRequestException(Message.USED_MEMBER_NICK_OR_PHONE);
		}
		if (!result) throw new NotFoundException(Message.UPDATE_FAILED);

		result.accessToken = await this.authService.createToken(result);
		return result;
	}

	/**
	 * @param memberId viewer, or null when the call must not be counted as a view
	 */
	public async getMember(memberId: ObjectId | null, targetId: ObjectId): Promise<Member> {
		const search: T = {
			_id: targetId,
			memberStatus: { $in: [MemberStatus.ACTIVE, MemberStatus.BLOCK] },
		};

		const targetMember = (await this.memberModel.findOne(search).lean().exec()) as Member | null;
		if (!targetMember) throw new NotFoundException(Message.NO_DATA_FOUND);

		if (memberId) {
			const newView = await this.viewService.recordView({
				memberId,
				viewRefId: targetId,
				viewGroup: ViewGroup.MEMBER,
			});
			if (newView) {
				await this.memberStatsEditor({ _id: targetId, targetKey: 'memberViews', modifier: 1 });
				targetMember.memberViews++;
			}

			targetMember.meLiked = await this.likeService.checkLikeExistence({
				memberId,
				likeRefId: targetId,
				likeGroup: LikeGroup.MEMBER,
			});
			targetMember.meFollowed = await this.checkSubscription(memberId, targetId);
		}

		return targetMember;
	}

	private async checkSubscription(followerId: ObjectId, followingId: ObjectId): Promise<MeFollowed[]> {
		const result = await this.followModel.findOne({ followingId, followerId }).exec();
		return result ? [{ followerId, followingId, myFollowing: true }] : [];
	}

	public async getAgents(memberId: ObjectId | null, input: AgentsInquiry): Promise<Members> {
		const { text } = input.search;
		const match: T = { memberType: MemberType.AGENT, memberStatus: MemberStatus.ACTIVE };
		const sort: T = { [input?.sort ?? 'createdAt']: input?.direction ?? Direction.DESC };

		if (text) match.memberNick = { $regex: new RegExp(escapeRegex(text), 'i') };

		const result = await this.memberModel
			.aggregate<Members>([
				{ $match: match },
				{ $sort: sort },
				{
					$facet: {
						list: [
							{ $skip: (input.page - 1) * input.limit },
							{ $limit: input.limit },
							lookupAuthMemberLiked(memberId),
							lookupAuthMemberFollowed({ followerId: memberId, followingId: '$_id' }),
							lookupStoreWindow,
							addStoreWindow,
						],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();

		return result[0];
	}

	public async likeTargetMember(memberId: ObjectId, likeRefId: ObjectId): Promise<Member> {
		const target = await this.memberModel.exists({ _id: likeRefId, memberStatus: MemberStatus.ACTIVE }).exec();
		if (!target) throw new NotFoundException(Message.NO_DATA_FOUND);

		const modifier = await this.likeService.toggleLike({ memberId, likeRefId, likeGroup: LikeGroup.MEMBER });
		const result = await this.memberModel
			.findByIdAndUpdate(
				likeRefId,
				{ $inc: { memberLikes: modifier } },
				{ new: true, projection: { memberPassword: 0 } },
			)
			.lean()
			.exec();
		if (!result) throw new BadRequestException(Message.SOMETHING_WENT_WRONG);

		if (modifier === 1) {
			this.notificationService
				.createNotification({
					notificationType: NotificationType.LIKE,
					notificationGroup: NotificationGroup.MEMBER,
					notificationTitle: 'Someone liked your profile',
					authorId: memberId,
					receiverId: likeRefId,
				})
				.catch((err: Error) => this.logger.error(`like notification: ${err.message}`));
		}
		return { ...result, meLiked: this.likeService.likedState(memberId, likeRefId, modifier) } as Member;
	}

	/* ------------------------------------------------------------------ */
	/*  ADMIN                                                             */
	/* ------------------------------------------------------------------ */

	public async getAllMembersByAdmin(input: MembersInquiry): Promise<Members> {
		const { memberStatus, memberType, text } = input.search;
		const match: T = {};
		const sort: T = { [input?.sort ?? 'createdAt']: input?.direction ?? Direction.DESC };

		if (memberStatus) match.memberStatus = memberStatus;
		if (memberType) match.memberType = memberType;
		if (text) match.memberNick = { $regex: new RegExp(escapeRegex(text), 'i') };

		const result = await this.memberModel
			.aggregate<Members>([
				{ $match: match },
				{ $sort: sort },
				{
					$facet: {
						list: [{ $skip: (input.page - 1) * input.limit }, { $limit: input.limit }],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();

		return result[0];
	}

	public async updateMemberByAdmin(input: MemberUpdateByAdmin): Promise<Member> {
		if (input.memberStatus === MemberStatus.DELETE) input.deletedAt = new Date();

		const result = await this.memberModel.findOneAndUpdate({ _id: input._id }, input, { new: true }).exec();
		if (!result) throw new NotFoundException(Message.UPDATE_FAILED);
		return result;
	}

	/* ------------------------------------------------------------------ */
	/*  STATS                                                             */
	/* ------------------------------------------------------------------ */

	public async memberStatsEditor(input: StatisticModifier): Promise<Member | null> {
		const { _id, targetKey, modifier } = input;
		return await this.memberModel.findByIdAndUpdate(_id, { $inc: { [targetKey]: modifier } }, { new: true }).exec();
	}
}
