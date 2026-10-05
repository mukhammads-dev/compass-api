import { Logger, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { ObjectId } from '../../libs/types/common';
import { shapeIntoMongoObjectId } from '../../libs/config';
import { Notice, Notices } from '../../libs/dto/notice/notice';
import { AllNoticesInquiry, NoticeInput, NoticesInquiry } from '../../libs/dto/notice/notice.input';
import { NoticeUpdate } from '../../libs/dto/notice/notice.update';
import { MemberType } from '../../libs/enums/member.enum';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { NoticeService } from './notice.service';

@Resolver()
export class NoticeResolver {
	private readonly logger = new Logger(NoticeResolver.name);

	constructor(private readonly noticeService: NoticeService) {}

	@Query(() => Notice)
	public async getNotice(@Args('noticeId') input: string): Promise<Notice> {
		this.logger.log('Query: getNotice');
		const noticeId = shapeIntoMongoObjectId(input);
		return await this.noticeService.getNotice(noticeId);
	}

	@Query(() => Notices)
	public async getNotices(@Args('input') input: NoticesInquiry): Promise<Notices> {
		this.logger.log('Query: getNotices');
		return await this.noticeService.getNotices(input);
	}

	/* ------------------------------------------------------------------ */
	/*  ADMIN                                                             */
	/* ------------------------------------------------------------------ */

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => Notice)
	public async createNotice(@Args('input') input: NoticeInput, @AuthMember('_id') memberId: ObjectId): Promise<Notice> {
		this.logger.log('Mutation: createNotice');
		return await this.noticeService.createNotice(memberId, input);
	}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Query(() => Notices)
	public async getAllNoticesByAdmin(@Args('input') input: AllNoticesInquiry): Promise<Notices> {
		this.logger.log('Query: getAllNoticesByAdmin');
		return await this.noticeService.getAllNoticesByAdmin(input);
	}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => Notice)
	public async updateNotice(@Args('input') input: NoticeUpdate): Promise<Notice> {
		this.logger.log('Mutation: updateNotice');
		input._id = shapeIntoMongoObjectId(input._id);
		return await this.noticeService.updateNotice(input);
	}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => Notice)
	public async removeNotice(@Args('noticeId') input: string): Promise<Notice> {
		this.logger.log('Mutation: removeNotice');
		const noticeId = shapeIntoMongoObjectId(input);
		return await this.noticeService.removeNotice(noticeId);
	}
}
