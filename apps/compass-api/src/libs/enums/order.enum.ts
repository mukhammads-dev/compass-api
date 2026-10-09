import { registerEnumType } from '@nestjs/graphql';

/** NEW furniture is delivered by the store; USED furniture is reserved and picked up from the seller. */
export enum OrderType {
	DELIVERY = 'DELIVERY',
	MEETUP = 'MEETUP',
}
registerEnumType(OrderType, { name: 'OrderType' });

/**
 * DELIVERY: PAID → PREPARING → SHIPPING → DELIVERED → COMPLETED
 * MEETUP:   PAID (money held by Compass) → COMPLETED (buyer confirms the pick-up)
 * Either can become CANCELED before the goods leave the seller.
 */
export enum OrderStatus {
	PAID = 'PAID',
	PREPARING = 'PREPARING',
	SHIPPING = 'SHIPPING',
	DELIVERED = 'DELIVERED',
	COMPLETED = 'COMPLETED',
	CANCELED = 'CANCELED',
}
registerEnumType(OrderStatus, { name: 'OrderStatus' });

export enum PaymentMethod {
	CARD = 'CARD',
	KAKAO_PAY = 'KAKAO_PAY',
	BANK_TRANSFER = 'BANK_TRANSFER',
}
registerEnumType(PaymentMethod, { name: 'PaymentMethod' });

export enum OrderActor {
	BUYER = 'BUYER',
	SELLER = 'SELLER',
	ADMIN = 'ADMIN',
	SYSTEM = 'SYSTEM',
}
registerEnumType(OrderActor, { name: 'OrderActor' });
