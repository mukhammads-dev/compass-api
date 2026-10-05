import { Logger, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { ObjectId } from '../../libs/types/common';
import { shapeIntoMongoObjectId } from '../../libs/config';
import { Member } from '../../libs/dto/member/member';
import { Product, Products } from '../../libs/dto/product/product';
import {
	AgentProductsInquiry,
	AllProductsInquiry,
	OrdinaryInquiry,
	ProductInput,
	ProductsInquiry,
} from '../../libs/dto/product/product.input';
import { ProductUpdate } from '../../libs/dto/product/product.update';
import { MemberType } from '../../libs/enums/member.enum';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { WithoutGuard } from '../auth/guards/without.guard';
import { ProductService } from './product.service';

@Resolver()
export class ProductResolver {
	private readonly logger = new Logger(ProductResolver.name);

	constructor(private readonly productService: ProductService) {}

	/** AGENT sells NEW or USED, USER sells USED only (rules live in the service). */
	@Roles(MemberType.AGENT, MemberType.USER)
	@UseGuards(RolesGuard)
	@Mutation(() => Product)
	public async createProduct(@Args('input') input: ProductInput, @AuthMember() authMember: Member): Promise<Product> {
		this.logger.log('Mutation: createProduct');
		return await this.productService.createProduct(authMember, input);
	}

	@UseGuards(WithoutGuard)
	@Query(() => Product)
	public async getProduct(@Args('productId') input: string, @AuthMember('_id') memberId: ObjectId): Promise<Product> {
		this.logger.log('Query: getProduct');
		const productId = shapeIntoMongoObjectId(input);
		return await this.productService.getProduct(memberId, productId);
	}

	@Roles(MemberType.AGENT, MemberType.USER)
	@UseGuards(RolesGuard)
	@Mutation(() => Product)
	public async updateProduct(
		@Args('input') input: ProductUpdate,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Product> {
		this.logger.log('Mutation: updateProduct');
		input._id = shapeIntoMongoObjectId(input._id);
		return await this.productService.updateProduct(memberId, input);
	}

	@UseGuards(WithoutGuard)
	@Query(() => Products)
	public async getProducts(
		@Args('input') input: ProductsInquiry,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Products> {
		this.logger.log('Query: getProducts');
		return await this.productService.getProducts(memberId, input);
	}

	@UseGuards(WithoutGuard)
	@Query(() => [Product])
	public async getSimilarProducts(
		@Args('productId') input: string,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Product[]> {
		this.logger.log('Query: getSimilarProducts');
		const productId = shapeIntoMongoObjectId(input);
		return await this.productService.getSimilarProducts(memberId, productId);
	}

	@UseGuards(AuthGuard)
	@Query(() => Products)
	public async getFavorites(
		@Args('input') input: OrdinaryInquiry,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Products> {
		this.logger.log('Query: getFavorites');
		return await this.productService.getFavorites(memberId, input);
	}

	@UseGuards(AuthGuard)
	@Query(() => Products)
	public async getVisited(
		@Args('input') input: OrdinaryInquiry,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Products> {
		this.logger.log('Query: getVisited');
		return await this.productService.getVisited(memberId, input);
	}

	@Roles(MemberType.AGENT, MemberType.USER)
	@UseGuards(RolesGuard)
	@Query(() => Products)
	public async getAgentProducts(
		@Args('input') input: AgentProductsInquiry,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Products> {
		this.logger.log('Query: getAgentProducts');
		return await this.productService.getAgentProducts(memberId, input);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => Product)
	public async likeTargetProduct(
		@Args('productId') input: string,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Product> {
		this.logger.log('Mutation: likeTargetProduct');
		const likeRefId = shapeIntoMongoObjectId(input);
		return await this.productService.likeTargetProduct(memberId, likeRefId);
	}

	/* ------------------------------------------------------------------ */
	/*  ADMIN                                                             */
	/* ------------------------------------------------------------------ */

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Query(() => Products)
	public async getAllProductsByAdmin(@Args('input') input: AllProductsInquiry): Promise<Products> {
		this.logger.log('Query: getAllProductsByAdmin');
		return await this.productService.getAllProductsByAdmin(input);
	}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => Product)
	public async updateProductByAdmin(@Args('input') input: ProductUpdate): Promise<Product> {
		this.logger.log('Mutation: updateProductByAdmin');
		input._id = shapeIntoMongoObjectId(input._id);
		return await this.productService.updateProductByAdmin(input);
	}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => Product)
	public async removeProductByAdmin(@Args('productId') input: string): Promise<Product> {
		this.logger.log('Mutation: removeProductByAdmin');
		const productId = shapeIntoMongoObjectId(input);
		return await this.productService.removeProductByAdmin(productId);
	}
}
