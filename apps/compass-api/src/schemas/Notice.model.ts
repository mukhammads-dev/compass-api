import { Schema } from 'mongoose';
import { NoticeCategory, NoticeStatus } from '../libs/enums/notice.enum';

const NoticeSchema = new Schema(
	{
		noticeCategory: { type: String, enum: NoticeCategory, required: true },
		noticeStatus: { type: String, enum: NoticeStatus, default: NoticeStatus.ACTIVE },
		noticeTitle: { type: String, required: true },
		noticeContent: { type: String, required: true },

		/** EVENT only */
		eventStartAt: { type: Date },
		eventEndAt: { type: Date },

		memberId: { type: Schema.Types.ObjectId, required: true, ref: 'Member' },
	},
	{ timestamps: true, collection: 'notices' },
);

NoticeSchema.index({ noticeCategory: 1, noticeStatus: 1, createdAt: -1 });

export default NoticeSchema;
