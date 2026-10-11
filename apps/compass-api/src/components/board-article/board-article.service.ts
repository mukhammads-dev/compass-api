import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { ObjectId } from '../../libs/types/common';
import {
	errorMessage,
	escapeRegex,
	lookupAuthMemberLiked,
	lookupMember,
	ROOM_TOUR_POINTS,
	shapeIntoMongoObjectId,
} from '../../libs/config';
import { BoardArticle, BoardArticles, TaggedProduct } from '../../libs/dto/board-article/board-article';
import {
	AllBoardArticlesInquiry,
	BoardArticleInput,
	BoardArticlesInquiry,
	ProductRoomToursInquiry,
	TaggedProductInput,
} from '../../libs/dto/board-article/board-article.input';
import { BoardArticleUpdate } from '../../libs/dto/board-article/board-article.update';
import { BoardArticleCategory, BoardArticleStatus, TagSource } from '../../libs/enums/board-article.enum';
import { Direction, Message } from '../../libs/enums/common.enum';
import { LikeGroup } from '../../libs/enums/like.enum';
import { NotificationGroup, NotificationType } from '../../libs/enums/notification.enum';
import { ViewGroup } from '../../libs/enums/view.enum';
import { StatisticModifier, T } from '../../libs/types/common';
import { LikeService } from '../like/like.service';
import { MemberService } from '../member/member.service';
import { NotificationService } from '../notification/notification.service';
import { ProductService } from '../product/product.service';
import { ViewService } from '../view/view.service';

@Injectable()
export class BoardArticleService {
	private readonly logger = new Logger(BoardArticleService.name);

	constructor(
		@InjectModel('BoardArticle') private readonly boardArticleModel: Model<BoardArticle>,
		private readonly memberService: MemberService,
		private readonly productService: ProductService,
		private readonly viewService: ViewService,
		private readonly likeService: LikeService,
		private readonly notificationService: NotificationService,
	) {}

	/* ------------------------------------------------------------------ */
	/*  CREATE                                                            */
	/* ------------------------------------------------------------------ */

	public async createBoardArticle(memberId: ObjectId, input: BoardArticleInput): Promise<BoardArticle> {
		input.memberId = memberId;
		const isRoomTour = input.articleCategory === BoardArticleCategory.ROOM_TOUR;

		if (isRoomTour) {
			input.taggedProducts = await this.validateTags(input.taggedProducts ?? [], input.roomImages ?? []);
		} else {
			this.stripRoomTourFields(input);
		}

		let result: BoardArticle;
		try {
			result = await this.boardArticleModel.create(input);
		} catch (err) {
			this.logger.error(`createBoardArticle: ${errorMessage(err)}`);
			throw new BadRequestException(Message.CREATE_FAILED);
		}

		await this.memberService.memberStatsEditor({ _id: memberId, targetKey: 'memberArticles', modifier: 1 });

		if (isRoomTour) {
			await this.memberService.memberStatsEditor({
				_id: memberId,
				targetKey: 'memberPoints',
				modifier: ROOM_TOUR_POINTS,
			});

			const taggedIds = this.uniqueProductIds(result.taggedProducts);
			await this.productService.productRoomToursEditor(taggedIds, 1);
			await this.notifyTaggedOwners(memberId, result._id, taggedIds);
		}

		return result;
	}

	/**
	 * Room Tour rules: at least one image, every tag points to an existing image,
	 * every tagged product exists and is ACTIVE.
	 */
	private async validateTags(tags: TaggedProductInput[], roomImages: string[]): Promise<TaggedProductInput[]> {
		if (!roomImages.length) throw new BadRequestException(Message.ROOM_TOUR_REQUIRES_IMAGES);

		const shapedTags = tags.map((tag) => {
			if (tag.imageIndex >= roomImages.length) throw new BadRequestException(Message.INVALID_TAG_IMAGE_INDEX);
			return { ...tag, productId: shapeIntoMongoObjectId(tag.productId), source: tag.source ?? TagSource.MANUAL };
		});

		const uniqueIds = this.uniqueProductIds(shapedTags);
		if (uniqueIds.length) {
			const activeProducts = await this.productService.findActiveProducts(uniqueIds);
			if (activeProducts.length !== uniqueIds.length) {
				throw new BadRequestException(Message.INVALID_TAGGED_PRODUCTS);
			}
		}

		return shapedTags;
	}

	private stripRoomTourFields(input: BoardArticleInput | BoardArticleUpdate): void {
		input.roomImages = [];
		input.taggedProducts = [];
		delete input.homeType;
		delete input.homeSize;
		delete input.homeStyle;
	}

	private uniqueProductIds(tags: (TaggedProduct | TaggedProductInput)[]): ObjectId[] {
		const unique = new Map<string, ObjectId>();
		tags.forEach((tag) => unique.set(String(tag.productId), tag.productId));
		return [...unique.values()];
	}

	private async notifyTaggedOwners(authorId: ObjectId, articleId: ObjectId, productIds: ObjectId[]): Promise<void> {
		if (!productIds.length) return;

		const products = await this.productService.findActiveProducts(productIds);
		await Promise.all(
			products.map((product) =>
				this.notificationService.createNotification({
					notificationType: NotificationType.TAG,
					notificationGroup: NotificationGroup.ARTICLE,
					notificationTitle: `"${product.productTitle}" was tagged in a Room Tour`,
					authorId,
					receiverId: product.memberId,
					productId: product._id,
					articleId,
				}),
			),
		);
	}

	/* ------------------------------------------------------------------ */
	/*  READ                                                              */
	/* ------------------------------------------------------------------ */

	public async getBoardArticle(memberId: ObjectId | null, articleId: ObjectId): Promise<BoardArticle> {
		const search: T = { _id: articleId, articleStatus: BoardArticleStatus.ACTIVE };

		const targetArticle = (await this.boardArticleModel.findOne(search).lean().exec()) as BoardArticle | null;
		if (!targetArticle) throw new NotFoundException(Message.NO_DATA_FOUND);

		if (memberId) {
			const newView = await this.viewService.recordView({
				memberId,
				viewRefId: articleId,
				viewGroup: ViewGroup.ARTICLE,
			});
			if (newView) {
				await this.boardArticleStatsEditor({ _id: articleId, targetKey: 'articleViews', modifier: 1 });
				targetArticle.articleViews++;
			}

			targetArticle.meLiked = await this.likeService.checkLikeExistence({
				memberId,
				likeRefId: articleId,
				likeGroup: LikeGroup.ARTICLE,
			});
		}

		targetArticle.memberData = await this.memberService.getMember(null, targetArticle.memberId);

		const taggedIds = this.uniqueProductIds(targetArticle.taggedProducts ?? []);
		if (taggedIds.length) {
			targetArticle.taggedProductsData = await this.productService.getProductsByIds(taggedIds);
		}

		return targetArticle;
	}

	public async getBoardArticles(memberId: ObjectId | null, input: BoardArticlesInquiry): Promise<BoardArticles> {
		const match: T = { articleStatus: BoardArticleStatus.ACTIVE };
		const sort: T = { [input?.sort ?? 'createdAt']: input?.direction ?? Direction.DESC };

		this.shapeMatchQuery(match, input);

		const result = await this.boardArticleModel
			.aggregate<BoardArticles>([
				{ $match: match },
				{ $sort: sort },
				{
					$facet: {
						list: [
							{ $skip: (input.page - 1) * input.limit },
							{ $limit: input.limit },
							lookupAuthMemberLiked(memberId),
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

	private shapeMatchQuery(match: T, input: BoardArticlesInquiry): void {
		const { articleCategory, homeTypeList, homeSizeRange, styleList, memberId, text } = input.search;

		if (articleCategory) match.articleCategory = articleCategory;
		if (homeTypeList?.length) match.homeType = { $in: homeTypeList };
		if (homeSizeRange) match.homeSize = { $gte: homeSizeRange.start, $lte: homeSizeRange.end };
		if (styleList?.length) match.homeStyle = { $in: styleList };
		if (memberId) match.memberId = shapeIntoMongoObjectId(memberId);
		if (text) match.articleTitle = { $regex: new RegExp(escapeRegex(text), 'i') };
	}

	/** Room Tours in which the given product is tagged ("Seen in these homes"). */
	public async getProductRoomTours(memberId: ObjectId | null, input: ProductRoomToursInquiry): Promise<BoardArticles> {
		const match: T = {
			articleStatus: BoardArticleStatus.ACTIVE,
			articleCategory: BoardArticleCategory.ROOM_TOUR,
			'taggedProducts.productId': shapeIntoMongoObjectId(input.productId),
		};

		const result = await this.boardArticleModel
			.aggregate<BoardArticles>([
				{ $match: match },
				{ $sort: { articleRank: -1, createdAt: -1 } },
				{
					$facet: {
						list: [
							{ $skip: (input.page - 1) * input.limit },
							{ $limit: input.limit },
							lookupAuthMemberLiked(memberId),
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
	/*  UPDATE                                                            */
	/* ------------------------------------------------------------------ */

	public async updateBoardArticle(memberId: ObjectId, input: BoardArticleUpdate): Promise<BoardArticle> {
		const search: T = { _id: input._id, memberId, articleStatus: BoardArticleStatus.ACTIVE };

		const current = (await this.boardArticleModel.findOne(search).lean().exec()) as BoardArticle | null;
		if (!current) throw new NotFoundException(Message.UPDATE_FAILED);

		const isRoomTour = current.articleCategory === BoardArticleCategory.ROOM_TOUR;
		const isDeleting = input.articleStatus === BoardArticleStatus.DELETE;

		if (!isRoomTour) {
			this.stripRoomTourFields(input);
		} else if (!isDeleting && (input.taggedProducts || input.roomImages)) {
			input.taggedProducts = await this.validateTags(
				input.taggedProducts ?? current.taggedProducts,
				input.roomImages ?? current.roomImages,
			);
		}
		if (isDeleting) input.deletedAt = new Date();

		const result = await this.boardArticleModel.findOneAndUpdate(search, input, { new: true }).exec();
		if (!result) throw new NotFoundException(Message.UPDATE_FAILED);

		if (isDeleting) {
			await this.onArticleDeleted(current);
		} else if (isRoomTour && input.taggedProducts) {
			await this.syncTagCounters(memberId, current, result);
		}

		return result;
	}

	/** Keeps productRoomTours in line with the new tag list and notifies owners of newly tagged products. */
	private async syncTagCounters(memberId: ObjectId, before: BoardArticle, after: BoardArticle): Promise<void> {
		const beforeIds = this.uniqueProductIds(before.taggedProducts);
		const afterIds = this.uniqueProductIds(after.taggedProducts);
		const beforeSet = new Set(beforeIds.map(String));
		const afterSet = new Set(afterIds.map(String));

		const added = afterIds.filter((id) => !beforeSet.has(String(id)));
		const removed = beforeIds.filter((id) => !afterSet.has(String(id)));

		await this.productService.productRoomToursEditor(added, 1);
		await this.productService.productRoomToursEditor(removed, -1);
		await this.notifyTaggedOwners(memberId, after._id, added);
	}

	/** Reverts every counter that creating the article increased. */
	private async onArticleDeleted(article: BoardArticle): Promise<void> {
		await this.memberService.memberStatsEditor({ _id: article.memberId, targetKey: 'memberArticles', modifier: -1 });

		if (article.articleCategory === BoardArticleCategory.ROOM_TOUR) {
			await this.memberService.memberStatsEditor({
				_id: article.memberId,
				targetKey: 'memberPoints',
				modifier: -ROOM_TOUR_POINTS,
			});
			await this.productService.productRoomToursEditor(this.uniqueProductIds(article.taggedProducts), -1);
		}
	}

	/* ------------------------------------------------------------------ */
	/*  LIKE                                                              */
	/* ------------------------------------------------------------------ */

	public async likeTargetBoardArticle(memberId: ObjectId, likeRefId: ObjectId): Promise<BoardArticle> {
		const target = await this.boardArticleModel
			.findOne({ _id: likeRefId, articleStatus: BoardArticleStatus.ACTIVE }, { articleTitle: 1, memberId: 1 })
			.lean()
			.exec();
		if (!target) throw new NotFoundException(Message.NO_DATA_FOUND);

		const modifier = await this.likeService.toggleLike({ memberId, likeRefId, likeGroup: LikeGroup.ARTICLE });
		const result = await this.boardArticleModel
			.findByIdAndUpdate(likeRefId, { $inc: { articleLikes: modifier } }, { new: true })
			.lean()
			.exec();
		if (!result) throw new BadRequestException(Message.SOMETHING_WENT_WRONG);

		/* author points and the notification run after the reply */
		const background: Promise<unknown>[] = [];
		if (modifier !== 0) {
			background.push(
				this.memberService.memberStatsEditor({ _id: target.memberId, targetKey: 'memberPoints', modifier }),
			);
		}
		if (modifier === 1) {
			background.push(
				this.notificationService.createNotification({
					notificationType: NotificationType.LIKE,
					notificationGroup: NotificationGroup.ARTICLE,
					notificationTitle: `Someone liked "${target.articleTitle}"`,
					authorId: memberId,
					receiverId: target.memberId,
					articleId: likeRefId,
				}),
			);
		}
		Promise.all(background).catch((err: Error) => this.logger.error(`like side effects: ${err.message}`));

		return { ...result, meLiked: this.likeService.likedState(memberId, likeRefId, modifier) } as BoardArticle;
	}

	/* ------------------------------------------------------------------ */
	/*  ADMIN                                                             */
	/* ------------------------------------------------------------------ */

	public async getAllBoardArticlesByAdmin(input: AllBoardArticlesInquiry): Promise<BoardArticles> {
		const { articleStatus, articleCategory } = input.search;
		const match: T = {};
		const sort: T = { [input?.sort ?? 'createdAt']: input?.direction ?? Direction.DESC };

		if (articleStatus) match.articleStatus = articleStatus;
		if (articleCategory) match.articleCategory = articleCategory;

		const result = await this.boardArticleModel
			.aggregate<BoardArticles>([
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

	/** Moderation: admins change status and text, never the author's tags or images. */
	public async updateBoardArticleByAdmin(input: BoardArticleUpdate): Promise<BoardArticle> {
		const search: T = { _id: input._id, articleStatus: BoardArticleStatus.ACTIVE };
		delete input.taggedProducts;
		delete input.roomImages;

		const current = (await this.boardArticleModel.findOne(search).lean().exec()) as BoardArticle | null;
		if (!current) throw new NotFoundException(Message.UPDATE_FAILED);

		const isDeleting = input.articleStatus === BoardArticleStatus.DELETE;
		if (isDeleting) input.deletedAt = new Date();

		const result = await this.boardArticleModel.findOneAndUpdate(search, input, { new: true }).exec();
		if (!result) throw new NotFoundException(Message.UPDATE_FAILED);

		if (isDeleting) await this.onArticleDeleted(current);
		return result;
	}

	/** Permanently purges an article that is already soft-deleted. */
	public async removeBoardArticleByAdmin(articleId: ObjectId): Promise<BoardArticle> {
		const search: T = { _id: articleId, articleStatus: BoardArticleStatus.DELETE };
		const result = await this.boardArticleModel.findOneAndDelete(search).exec();
		if (!result) throw new NotFoundException(Message.REMOVE_FAILED);
		return result;
	}

	/* ------------------------------------------------------------------ */
	/*  STATS                                                             */
	/* ------------------------------------------------------------------ */

	public async boardArticleStatsEditor(input: StatisticModifier): Promise<BoardArticle | null> {
		const { _id, targetKey, modifier } = input;
		return await this.boardArticleModel
			.findByIdAndUpdate(_id, { $inc: { [targetKey]: modifier } }, { new: true })
			.exec();
	}
}
