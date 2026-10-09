import { Logger, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { ObjectId } from '../../libs/types/common';
import type { AuthMemberPayload } from '../auth/auth.types';
import { CheckoutQuote, Order, Orders } from '../../libs/dto/order/order';
import {
	CancelOrderInput,
	CheckoutInput,
	OrdersInquiry,
	OrderStatusUpdate,
	QuoteInput,
	ReserveInput,
} from '../../libs/dto/order/order.input';
import { MemberType } from '../../libs/enums/member.enum';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrderService } from './order.service';

@Resolver()
export class OrderResolver {
	private readonly logger = new Logger(OrderResolver.name);

	constructor(private readonly orderService: OrderService) {}

	/* ------------------------------------------------------------------ */
	/*  BUYER                                                             */
	/* ------------------------------------------------------------------ */

	@UseGuards(AuthGuard)
	@Query(() => CheckoutQuote)
	public async getCheckoutQuote(
		@Args('input') input: QuoteInput,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<CheckoutQuote> {
		this.logger.log('Query: getCheckoutQuote');
		return await this.orderService.getCheckoutQuote(memberId, input);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => [Order])
	public async createOrders(
		@Args('input') input: CheckoutInput,
		@AuthMember() member: AuthMemberPayload,
	): Promise<Order[]> {
		this.logger.log('Mutation: createOrders');
		return await this.orderService.createOrders(member, input);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => Order)
	public async reserveProduct(
		@Args('input') input: ReserveInput,
		@AuthMember() member: AuthMemberPayload,
	): Promise<Order> {
		this.logger.log('Mutation: reserveProduct');
		return await this.orderService.reserveProduct(member, input);
	}

	@UseGuards(AuthGuard)
	@Query(() => Orders)
	public async getMyOrders(
		@Args('input') input: OrdersInquiry,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Orders> {
		this.logger.log('Query: getMyOrders');
		return await this.orderService.getMyOrders(memberId, input);
	}

	@UseGuards(AuthGuard)
	@Query(() => [Order])
	public async getCheckoutOrders(
		@Args('checkoutId') checkoutId: string,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Order[]> {
		this.logger.log('Query: getCheckoutOrders');
		return await this.orderService.getCheckoutOrders(memberId, checkoutId);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => Order)
	public async completeOrder(
		@Args('orderId') orderId: string,
		@AuthMember() member: AuthMemberPayload,
	): Promise<Order> {
		this.logger.log('Mutation: completeOrder');
		return await this.orderService.completeOrder(member, orderId);
	}

	/* ------------------------------------------------------------------ */
	/*  BOTH SIDES                                                        */
	/* ------------------------------------------------------------------ */

	@UseGuards(AuthGuard)
	@Query(() => Order)
	public async getOrder(@Args('orderId') orderId: string, @AuthMember() member: AuthMemberPayload): Promise<Order> {
		this.logger.log('Query: getOrder');
		return await this.orderService.getOrder(member, orderId);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => Order)
	public async cancelOrder(
		@Args('input') input: CancelOrderInput,
		@AuthMember() member: AuthMemberPayload,
	): Promise<Order> {
		this.logger.log('Mutation: cancelOrder');
		return await this.orderService.cancelOrder(member, input);
	}

	/* ------------------------------------------------------------------ */
	/*  SELLER (stores, and members selling used pieces)                  */
	/* ------------------------------------------------------------------ */

	@Roles(MemberType.AGENT, MemberType.USER)
	@UseGuards(RolesGuard)
	@Query(() => Orders)
	public async getStoreOrders(
		@Args('input') input: OrdersInquiry,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Orders> {
		this.logger.log('Query: getStoreOrders');
		return await this.orderService.getStoreOrders(memberId, input);
	}

	@Roles(MemberType.AGENT, MemberType.USER)
	@UseGuards(RolesGuard)
	@Mutation(() => Order)
	public async updateOrderBySeller(
		@Args('input') input: OrderStatusUpdate,
		@AuthMember() member: AuthMemberPayload,
	): Promise<Order> {
		this.logger.log('Mutation: updateOrderBySeller');
		return await this.orderService.updateOrderBySeller(member, input);
	}

	/* ------------------------------------------------------------------ */
	/*  ADMIN                                                             */
	/* ------------------------------------------------------------------ */

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Query(() => Orders)
	public async getAllOrdersByAdmin(@Args('input') input: OrdersInquiry): Promise<Orders> {
		this.logger.log('Query: getAllOrdersByAdmin');
		return await this.orderService.getAllOrdersByAdmin(input);
	}
}
