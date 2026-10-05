import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { ObjectId } from '../../libs/types/common';
import { errorMessage, escapeRegex } from '../../libs/config';
import { Notice, Notices } from '../../libs/dto/notice/notice';
import { AllNoticesInquiry, NoticeInput, NoticesInquiry } from '../../libs/dto/notice/notice.input';
import { NoticeUpdate } from '../../libs/dto/notice/notice.update';
import { Direction, Message } from '../../libs/enums/common.enum';
import { NoticeStatus } from '../../libs/enums/notice.enum';
import { T } from '../../libs/types/common';

@Injectable()
export class NoticeService {
	private readonly logger = new Logger(NoticeService.name);

	constructor(@InjectModel('Notice') private readonly noticeModel: Model<Notice>) {}

	/* ------------------------------------------------------------------ */
	/*  PUBLIC                                                            */
	/* ------------------------------------------------------------------ */

	public async getNotice(noticeId: ObjectId): Promise<Notice> {
		const result = await this.noticeModel.findOne({ _id: noticeId, noticeStatus: NoticeStatus.ACTIVE }).exec();
		if (!result) throw new NotFoundException(Message.NO_DATA_FOUND);
		return result;
	}

	public async getNotices(input: NoticesInquiry): Promise<Notices> {
		const { noticeCategory, text } = input.search;
		const match: T = { noticeStatus: NoticeStatus.ACTIVE };
		if (noticeCategory) match.noticeCategory = noticeCategory;
		if (text) match.noticeTitle = { $regex: new RegExp(escapeRegex(text), 'i') };

		return await this.paginate(match, input);
	}

	/* ------------------------------------------------------------------ */
	/*  ADMIN                                                             */
	/* ------------------------------------------------------------------ */

	public async createNotice(memberId: ObjectId, input: NoticeInput): Promise<Notice> {
		input.memberId = memberId;
		try {
			return await this.noticeModel.create(input);
		} catch (err) {
			this.logger.error(`createNotice: ${errorMessage(err)}`);
			throw new BadRequestException(Message.CREATE_FAILED);
		}
	}

	public async getAllNoticesByAdmin(input: AllNoticesInquiry): Promise<Notices> {
		const { noticeCategory, noticeStatus } = input.search;
		const match: T = {};
		if (noticeCategory) match.noticeCategory = noticeCategory;
		if (noticeStatus) match.noticeStatus = noticeStatus;

		return await this.paginate(match, input);
	}

	public async updateNotice(input: NoticeUpdate): Promise<Notice> {
		const result = await this.noticeModel.findOneAndUpdate({ _id: input._id }, input, { new: true }).exec();
		if (!result) throw new NotFoundException(Message.UPDATE_FAILED);
		return result;
	}

	/** Permanently purges a notice that is already soft-deleted. */
	public async removeNotice(noticeId: ObjectId): Promise<Notice> {
		const result = await this.noticeModel.findOneAndDelete({ _id: noticeId, noticeStatus: NoticeStatus.DELETE }).exec();
		if (!result) throw new NotFoundException(Message.REMOVE_FAILED);
		return result;
	}

	/* ------------------------------------------------------------------ */

	private async paginate(match: T, input: NoticesInquiry | AllNoticesInquiry): Promise<Notices> {
		const sort: T = { [input?.sort ?? 'createdAt']: input?.direction ?? Direction.DESC };

		const result = await this.noticeModel
			.aggregate<Notices>([
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
}
