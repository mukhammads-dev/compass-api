import { Logger, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { ObjectId } from '../../libs/types/common';
import { shapeIntoMongoObjectId } from '../../libs/config';
import { BoardArticle, BoardArticles } from '../../libs/dto/board-article/board-article';
import {
	AllBoardArticlesInquiry,
	BoardArticleInput,
	BoardArticlesInquiry,
	ProductRoomToursInquiry,
} from '../../libs/dto/board-article/board-article.input';
import { BoardArticleUpdate } from '../../libs/dto/board-article/board-article.update';
import { MemberType } from '../../libs/enums/member.enum';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { WithoutGuard } from '../auth/guards/without.guard';
import { BoardArticleService } from './board-article.service';

@Resolver()
export class BoardArticleResolver {
	private readonly logger = new Logger(BoardArticleResolver.name);

	constructor(private readonly boardArticleService: BoardArticleService) {}

	@UseGuards(AuthGuard)
	@Mutation(() => BoardArticle)
	public async createBoardArticle(
		@Args('input') input: BoardArticleInput,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<BoardArticle> {
		this.logger.log('Mutation: createBoardArticle');
		return await this.boardArticleService.createBoardArticle(memberId, input);
	}

	@UseGuards(WithoutGuard)
	@Query(() => BoardArticle)
	public async getBoardArticle(
		@Args('articleId') input: string,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<BoardArticle> {
		this.logger.log('Query: getBoardArticle');
		const articleId = shapeIntoMongoObjectId(input);
		return await this.boardArticleService.getBoardArticle(memberId, articleId);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => BoardArticle)
	public async updateBoardArticle(
		@Args('input') input: BoardArticleUpdate,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<BoardArticle> {
		this.logger.log('Mutation: updateBoardArticle');
		input._id = shapeIntoMongoObjectId(input._id);
		return await this.boardArticleService.updateBoardArticle(memberId, input);
	}

	@UseGuards(WithoutGuard)
	@Query(() => BoardArticles)
	public async getBoardArticles(
		@Args('input') input: BoardArticlesInquiry,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<BoardArticles> {
		this.logger.log('Query: getBoardArticles');
		return await this.boardArticleService.getBoardArticles(memberId, input);
	}

	@UseGuards(WithoutGuard)
	@Query(() => BoardArticles)
	public async getProductRoomTours(
		@Args('input') input: ProductRoomToursInquiry,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<BoardArticles> {
		this.logger.log('Query: getProductRoomTours');
		return await this.boardArticleService.getProductRoomTours(memberId, input);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => BoardArticle)
	public async likeTargetBoardArticle(
		@Args('articleId') input: string,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<BoardArticle> {
		this.logger.log('Mutation: likeTargetBoardArticle');
		const likeRefId = shapeIntoMongoObjectId(input);
		return await this.boardArticleService.likeTargetBoardArticle(memberId, likeRefId);
	}

	/* ------------------------------------------------------------------ */
	/*  ADMIN                                                             */
	/* ------------------------------------------------------------------ */

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Query(() => BoardArticles)
	public async getAllBoardArticlesByAdmin(@Args('input') input: AllBoardArticlesInquiry): Promise<BoardArticles> {
		this.logger.log('Query: getAllBoardArticlesByAdmin');
		return await this.boardArticleService.getAllBoardArticlesByAdmin(input);
	}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => BoardArticle)
	public async updateBoardArticleByAdmin(@Args('input') input: BoardArticleUpdate): Promise<BoardArticle> {
		this.logger.log('Mutation: updateBoardArticleByAdmin');
		input._id = shapeIntoMongoObjectId(input._id);
		return await this.boardArticleService.updateBoardArticleByAdmin(input);
	}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => BoardArticle)
	public async removeBoardArticleByAdmin(@Args('articleId') input: string): Promise<BoardArticle> {
		this.logger.log('Mutation: removeBoardArticleByAdmin');
		const articleId = shapeIntoMongoObjectId(input);
		return await this.boardArticleService.removeBoardArticleByAdmin(articleId);
	}
}
