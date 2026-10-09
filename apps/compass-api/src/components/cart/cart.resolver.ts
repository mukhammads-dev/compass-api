import { Logger, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { ObjectId } from '../../libs/types/common';
import { CartItem } from '../../libs/dto/cart/cart';
import { CartItemInput, CartItemUpdate } from '../../libs/dto/cart/cart.input';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CartService } from './cart.service';

@Resolver()
export class CartResolver {
	private readonly logger = new Logger(CartResolver.name);

	constructor(private readonly cartService: CartService) {}

	@UseGuards(AuthGuard)
	@Query(() => [CartItem])
	public async getMyCart(@AuthMember('_id') memberId: ObjectId): Promise<CartItem[]> {
		this.logger.log('Query: getMyCart');
		return await this.cartService.getMyCart(memberId);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => CartItem)
	public async addToCart(
		@Args('input') input: CartItemInput,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<CartItem> {
		this.logger.log('Mutation: addToCart');
		return await this.cartService.addToCart(memberId, input);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => CartItem)
	public async updateCartItem(
		@Args('input') input: CartItemUpdate,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<CartItem> {
		this.logger.log('Mutation: updateCartItem');
		return await this.cartService.updateCartItem(memberId, input);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => Boolean)
	public async removeCartItem(
		@Args('productId') productId: string,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<boolean> {
		this.logger.log('Mutation: removeCartItem');
		return await this.cartService.removeCartItem(memberId, productId);
	}
}
