import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { ObjectId } from '../../libs/types/common';
import { errorMessage, lookupMember, shapeIntoMongoObjectId } from '../../libs/config';
import { Comment, Comments } from '../../libs/dto/comment/comment';
import { CommentInput, CommentsInquiry } from '../../libs/dto/comment/comment.input';
import { CommentUpdate } from '../../libs/dto/comment/comment.update';
import { CommentGroup, CommentStatus } from '../../libs/enums/comment.enum';
import { Direction, Message } from '../../libs/enums/common.enum';
import { NotificationGroup, NotificationType } from '../../libs/enums/notification.enum';
import { T } from '../../libs/types/common';
import { BoardArticleService } from '../board-article/board-article.service';
import { MemberService } from '../member/member.service';
import { NotificationService } from '../notification/notification.service';
import { ProductService } from '../product/product.service';

interface CommentTarget {
	receiverId: ObjectId;
	title: string;
	notificationGroup: NotificationGroup;
}

@Injectable()
export class CommentService {
	private readonly logger = new Logger(CommentService.name);

	constructor(
		@InjectModel('Comment') private readonly commentModel: Model<Comment>,
		private readonly memberService: MemberService,
		private readonly productService: ProductService,
		private readonly boardArticleService: BoardArticleService,
		private readonly notificationService: NotificationService,
	) {}

	public async createComment(memberId: ObjectId, input: CommentInput): Promise<Comment> {
		input.memberId = memberId;
		input.commentRefId = shapeIntoMongoObjectId(input.commentRefId);

		const target = await this.findCommentTarget(input.commentGroup, input.commentRefId);

		let result: Comment;
		try {
			result = await this.commentModel.create(input);
		} catch (err) {
			this.logger.error(`createComment: ${errorMessage(err)}`);
			throw new BadRequestException(Message.CREATE_FAILED);
		}

		await this.commentCounterEditor(input.commentGroup, input.commentRefId, 1);
		await this.notificationService.createNotification({
			notificationType: NotificationType.COMMENT,
			notificationGroup: target.notificationGroup,
			notificationTitle: `New comment on ${target.title}`,
			notificationDesc: input.commentContent,
			authorId: memberId,
			receiverId: target.receiverId,
			productId: input.commentGroup === CommentGroup.PRODUCT ? input.commentRefId : undefined,
			articleId: input.commentGroup === CommentGroup.ARTICLE ? input.commentRefId : undefined,
		});

		return result;
	}

	/** Validates that the commented target exists and returns who should be notified. */
	private async findCommentTarget(group: CommentGroup, refId: ObjectId): Promise<CommentTarget> {
		switch (group) {
			case CommentGroup.MEMBER: {
				const member = await this.memberService.getMember(null, refId);
				return { receiverId: member._id, title: 'your profile', notificationGroup: NotificationGroup.MEMBER };
			}
			case CommentGroup.PRODUCT: {
				const product = await this.productService.getProduct(null, refId);
				return {
					receiverId: product.memberId,
					title: `"${product.productTitle}"`,
					notificationGroup: NotificationGroup.PRODUCT,
				};
			}
			case CommentGroup.ARTICLE: {
				const article = await this.boardArticleService.getBoardArticle(null, refId);
				return {
					receiverId: article.memberId,
					title: `"${article.articleTitle}"`,
					notificationGroup: NotificationGroup.ARTICLE,
				};
			}
			default:
				throw new BadRequestException(Message.BAD_REQUEST);
		}
	}

	private async commentCounterEditor(group: CommentGroup, refId: ObjectId, modifier: number): Promise<void> {
		switch (group) {
			case CommentGroup.MEMBER:
				await this.memberService.memberStatsEditor({ _id: refId, targetKey: 'memberComments', modifier });
				break;
			case CommentGroup.PRODUCT:
				await this.productService.productStatsEditor({ _id: refId, targetKey: 'productComments', modifier });
				break;
			case CommentGroup.ARTICLE:
				await this.boardArticleService.boardArticleStatsEditor({ _id: refId, targetKey: 'articleComments', modifier });
				break;
		}
	}

	public async updateComment(memberId: ObjectId, input: CommentUpdate): Promise<Comment> {
		const search: T = { _id: input._id, memberId, commentStatus: CommentStatus.ACTIVE };

		const result = await this.commentModel.findOneAndUpdate(search, input, { new: true }).exec();
		if (!result) throw new NotFoundException(Message.UPDATE_FAILED);

		if (input.commentStatus === CommentStatus.DELETE) {
			await this.commentCounterEditor(result.commentGroup, result.commentRefId, -1);
		}
		return result;
	}

	public async getComments(input: CommentsInquiry): Promise<Comments> {
		const match: T = {
			commentRefId: shapeIntoMongoObjectId(input.search.commentRefId),
			commentStatus: CommentStatus.ACTIVE,
		};
		const sort: T = { [input?.sort ?? 'createdAt']: input?.direction ?? Direction.DESC };

		const result = await this.commentModel
			.aggregate<Comments>([
				{ $match: match },
				{ $sort: sort },
				{
					$facet: {
						list: [
							{ $skip: (input.page - 1) * input.limit },
							{ $limit: input.limit },
							lookupMember,
							{ $unwind: '$memberData' },
						],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();

		return result[0];
	}

	/* ------------------------------------------------------------------ */
	/*  ADMIN                                                             */
	/* ------------------------------------------------------------------ */

	public async removeCommentByAdmin(commentId: ObjectId): Promise<Comment> {
		const result = await this.commentModel.findByIdAndDelete(commentId).exec();
		if (!result) throw new NotFoundException(Message.REMOVE_FAILED);

		if (result.commentStatus === CommentStatus.ACTIVE) {
			await this.commentCounterEditor(result.commentGroup, result.commentRefId, -1);
		}
		return result;
	}
}
