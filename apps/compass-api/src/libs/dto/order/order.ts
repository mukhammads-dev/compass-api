import { Field, Int, ObjectType } from '@nestjs/graphql';
import type { ObjectId } from '../../types/common';
import { OrderActor, OrderStatus, OrderType, PaymentMethod } from '../../enums/order.enum';
import { TotalCounter } from '../member/member';

@ObjectType()
export class OrderItem {
	@Field(() => String)
	productId: ObjectId;

	@Field(() => String)
	productTitle: string;

	@Field(() => String)
	productImage: string;

	@Field(() => Int)
	productWidth: number;

	@Field(() => Int)
	productDepth: number;

	@Field(() => Int)
	productHeight: number;

	@Field(() => Int)
	unitPrice: number;

	@Field(() => Int)
	quantity: number;

	@Field(() => Boolean)
	assembly: boolean;

	@Field(() => Int)
	assemblyFee: number;
}

@ObjectType()
export class OrderDelivery {
	@Field(() => String)
	recipient: string;

	@Field(() => String)
	phone: string;

	@Field(() => String)
	address: string;

	@Field(() => String, { nullable: true })
	addressDetail?: string;

	@Field(() => String)
	postalCode: string;

	@Field(() => Int)
	floor: number;

	@Field(() => Boolean)
	elevator: boolean;

	@Field(() => Date)
	preferredDate: Date;

	@Field(() => String, { nullable: true })
	memo?: string;
}

@ObjectType()
export class OrderMeetup {
	@Field(() => Date)
	meetupDate: Date;

	@Field(() => String)
	meetupPlace: string;

	@Field(() => String, { nullable: true })
	note?: string;
}

@ObjectType()
export class OrderPayment {
	@Field(() => PaymentMethod)
	method: PaymentMethod;

	@Field(() => Int)
	amount: number;

	@Field(() => String)
	approvalNo: string;

	@Field(() => String, { nullable: true })
	cardBrand?: string;

	@Field(() => String, { nullable: true })
	cardLast4?: string;

	@Field(() => Date)
	paidAt: Date;

	@Field(() => Date, { nullable: true })
	refundedAt?: Date;
}

@ObjectType()
export class OrderEvent {
	@Field(() => OrderStatus)
	status: OrderStatus;

	@Field(() => OrderActor)
	actor: OrderActor;

	@Field(() => String, { nullable: true })
	note?: string;

	@Field(() => Date)
	at: Date;
}

@ObjectType()
export class Order {
	@Field(() => String)
	_id: ObjectId;

	@Field(() => String)
	orderNo: string;

	@Field(() => String)
	checkoutId: string;

	@Field(() => OrderType)
	orderType: OrderType;

	@Field(() => OrderStatus)
	orderStatus: OrderStatus;

	@Field(() => String)
	buyerId: ObjectId;

	@Field(() => String)
	buyerNick: string;

	@Field(() => String)
	sellerId: ObjectId;

	@Field(() => String)
	sellerNick: string;

	@Field(() => String, { nullable: true })
	sellerImage?: string;

	@Field(() => [OrderItem])
	items: OrderItem[];

	@Field(() => Int)
	itemsTotal: number;

	@Field(() => Int)
	deliveryFee: number;

	@Field(() => Int)
	assemblyTotal: number;

	@Field(() => Int)
	stairsFee: number;

	@Field(() => Int)
	orderTotal: number;

	@Field(() => OrderDelivery, { nullable: true })
	delivery?: OrderDelivery;

	@Field(() => OrderMeetup, { nullable: true })
	meetup?: OrderMeetup;

	@Field(() => OrderPayment)
	payment: OrderPayment;

	@Field(() => String, { nullable: true })
	sellerNote?: string;

	@Field(() => String, { nullable: true })
	cancelReason?: string;

	@Field(() => OrderActor, { nullable: true })
	canceledBy?: OrderActor;

	@Field(() => [OrderEvent])
	history: OrderEvent[];

	@Field(() => Date)
	createdAt: Date;

	@Field(() => Date)
	updatedAt: Date;
}

@ObjectType()
export class Orders {
	@Field(() => [Order])
	list: Order[];

	@Field(() => [TotalCounter], { nullable: true })
	metaCounter: TotalCounter[];
}

/** Server-side price for a checkout, one block per store. The same numbers are charged when ordering. */
@ObjectType()
export class StoreQuote {
	@Field(() => String)
	sellerId: ObjectId;

	@Field(() => String)
	sellerNick: string;

	@Field(() => String, { nullable: true })
	sellerImage?: string;

	@Field(() => [OrderItem])
	items: OrderItem[];

	@Field(() => Int)
	itemsTotal: number;

	@Field(() => Int)
	deliveryFee: number;

	@Field(() => Int)
	assemblyTotal: number;

	@Field(() => Int)
	stairsFee: number;

	@Field(() => Int)
	orderTotal: number;
}

@ObjectType()
export class CheckoutQuote {
	@Field(() => [StoreQuote])
	stores: StoreQuote[];

	@Field(() => Int)
	itemsTotal: number;

	@Field(() => Int)
	deliveryTotal: number;

	@Field(() => Int)
	assemblyTotal: number;

	@Field(() => Int)
	stairsTotal: number;

	@Field(() => Int)
	grandTotal: number;

	/** first and last day a delivery can be booked (Sundays excluded) */
	@Field(() => Date)
	earliestDate: Date;

	@Field(() => Date)
	latestDate: Date;
}
