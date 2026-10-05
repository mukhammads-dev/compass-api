import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { AnyBulkWriteOperation, Model } from 'mongoose';
import { BoardArticle } from '../../compass-api/src/libs/dto/board-article/board-article';
import { Member } from '../../compass-api/src/libs/dto/member/member';
import { Product } from '../../compass-api/src/libs/dto/product/product';
import { BoardArticleCategory, BoardArticleStatus } from '../../compass-api/src/libs/enums/board-article.enum';
import { MemberStatus, MemberType } from '../../compass-api/src/libs/enums/member.enum';
import { ProductStatus } from '../../compass-api/src/libs/enums/product.enum';
import { ROOM_TOUR_FRESH_DAYS } from './lib/config';

@Injectable()
export class BatchService {
	constructor(
		@InjectModel('Member') private readonly memberModel: Model<Member>,
		@InjectModel('Product') private readonly productModel: Model<Product>,
		@InjectModel('BoardArticle') private readonly boardArticleModel: Model<BoardArticle>,
	) {}

	/** Step 1: flag every rankable document by resetting its rank to 0. */
	public async batchRollback(): Promise<void> {
		await this.productModel.updateMany({ productStatus: ProductStatus.ACTIVE }, { productRank: 0 }).exec();
		await this.memberModel
			.updateMany({ memberStatus: MemberStatus.ACTIVE, memberType: MemberType.AGENT }, { memberRank: 0 })
			.exec();
		await this.boardArticleModel
			.updateMany(
				{ articleStatus: BoardArticleStatus.ACTIVE, articleCategory: BoardArticleCategory.ROOM_TOUR },
				{ articleRank: 0 },
			)
			.exec();
	}

	public async batchTopAgents(): Promise<number> {
		const agents = await this.memberModel
			.find({ memberStatus: MemberStatus.ACTIVE, memberType: MemberType.AGENT, memberRank: 0 })
			.select('memberProducts memberArticles memberLikes memberViews memberFollowers')
			.lean()
			.exec();

		const operations: AnyBulkWriteOperation<Member>[] = agents.map((agent) => {
			const rank =
				agent.memberProducts * 2 +
				agent.memberArticles * 3 +
				agent.memberLikes * 2 +
				agent.memberViews +
				agent.memberFollowers * 3;
			return { updateOne: { filter: { _id: agent._id }, update: { $set: { memberRank: rank } } } };
		});

		if (operations.length) await this.memberModel.bulkWrite(operations);
		return operations.length;
	}

	/** Room Tour tags weigh the most: being used in real homes is the strongest signal. */
	public async batchTopProducts(): Promise<number> {
		const products = await this.productModel
			.find({ productStatus: ProductStatus.ACTIVE, productRank: 0 })
			.select('productLikes productViews productComments productRoomTours')
			.lean()
			.exec();

		const operations: AnyBulkWriteOperation<Product>[] = products.map((product) => {
			const rank =
				product.productLikes * 2 + product.productViews + product.productComments + product.productRoomTours * 5;
			return { updateOne: { filter: { _id: product._id }, update: { $set: { productRank: rank } } } };
		});

		if (operations.length) await this.productModel.bulkWrite(operations);
		return operations.length;
	}

	/** Weekly "Room Tour of the week": recent tours get a 2x boost. */
	public async batchTopRoomTours(): Promise<number> {
		const freshSince = new Date(Date.now() - ROOM_TOUR_FRESH_DAYS * 24 * 60 * 60 * 1000);

		const roomTours = await this.boardArticleModel
			.find({
				articleStatus: BoardArticleStatus.ACTIVE,
				articleCategory: BoardArticleCategory.ROOM_TOUR,
				articleRank: 0,
			})
			.select('articleLikes articleViews articleComments createdAt')
			.lean()
			.exec();

		const operations: AnyBulkWriteOperation<BoardArticle>[] = roomTours.map((article) => {
			const score = article.articleLikes * 2 + article.articleViews + article.articleComments * 3;
			const rank = article.createdAt >= freshSince ? score * 2 : score;
			return { updateOne: { filter: { _id: article._id }, update: { $set: { articleRank: rank } } } };
		});

		if (operations.length) await this.boardArticleModel.bulkWrite(operations);
		return operations.length;
	}
}
