import { Field, InputType, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsBoolean,
	IsEnum,
	IsNotEmpty,
	IsOptional,
	Length,
	Matches,
	Max,
	Min,
	ValidateNested,
} from 'class-validator';
import { MAX_CART_ITEMS, MAX_PAGE_LIMIT } from '../../config';
import { OrderStatus, OrderType, PaymentMethod } from '../../enums/order.enum';

@InputType()
export class QuoteInput {
	/** a subset of the cart ("Buy now"); empty means every available cart item */
	@IsOptional()
	@ArrayMaxSize(MAX_CART_ITEMS)
	@Field(() => [String], { nullable: true })
	productIds?: string[];

	@IsNotEmpty()
	@Min(1)
	@Max(80)
	@Field(() => Int)
	floor: number;

	@IsBoolean()
	@Field(() => Boolean)
	elevator: boolean;
}

@InputType()
export class ShippingInput {
	@IsNotEmpty()
	@Length(2, 30)
	@Field(() => String)
	recipient: string;

	@IsNotEmpty()
	@Matches(/^0\d{1,2}-?\d{3,4}-?\d{4}$/)
	@Field(() => String)
	phone: string;

	@IsNotEmpty()
	@Length(5, 100)
	@Field(() => String)
	address: string;

	@IsOptional()
	@Length(0, 100)
	@Field(() => String, { nullable: true })
	addressDetail?: string;

	@IsNotEmpty()
	@Matches(/^\d{5}$/)
	@Field(() => String)
	postalCode: string;

	@IsNotEmpty()
	@Min(1)
	@Max(80)
	@Field(() => Int)
	floor: number;

	@IsBoolean()
	@Field(() => Boolean)
	elevator: boolean;
}

@InputType()
export class StoreDeliveryInput {
	@IsNotEmpty()
	@Field(() => String)
	sellerId: string;

	@IsNotEmpty()
	@Field(() => Date)
	preferredDate: Date;

	@IsOptional()
	@Length(0, 200)
	@Field(() => String, { nullable: true })
	memo?: string;
}

/** Simulated payment. The full card number is checked and never stored, only its last 4 digits. */
@InputType()
export class PaymentInput {
	@IsEnum(PaymentMethod)
	@Field(() => PaymentMethod)
	method: PaymentMethod;

	@IsOptional()
	@Matches(/^[\d ]{15,23}$/)
	@Field(() => String, { nullable: true })
	cardNumber?: string;

	@IsOptional()
	@Matches(/^(0[1-9]|1[0-2])\/\d{2}$/)
	@Field(() => String, { nullable: true })
	cardExpiry?: string;

	@IsOptional()
	@Length(2, 40)
	@Field(() => String, { nullable: true })
	cardHolder?: string;
}

@InputType()
export class CheckoutInput {
	@IsOptional()
	@ArrayMaxSize(MAX_CART_ITEMS)
	@Field(() => [String], { nullable: true })
	productIds?: string[];

	@ValidateNested()
	@Type(() => ShippingInput)
	@Field(() => ShippingInput)
	shipping: ShippingInput;

	@ArrayMinSize(1)
	@ArrayMaxSize(MAX_CART_ITEMS)
	@ValidateNested({ each: true })
	@Type(() => StoreDeliveryInput)
	@Field(() => [StoreDeliveryInput])
	deliveries: StoreDeliveryInput[];

	@ValidateNested()
	@Type(() => PaymentInput)
	@Field(() => PaymentInput)
	payment: PaymentInput;
}

@InputType()
export class ReserveInput {
	@IsNotEmpty()
	@Field(() => String)
	productId: string;

	@IsNotEmpty()
	@Field(() => Date)
	meetupDate: Date;

	@IsOptional()
	@Length(0, 200)
	@Field(() => String, { nullable: true })
	note?: string;

	@ValidateNested()
	@Type(() => PaymentInput)
	@Field(() => PaymentInput)
	payment: PaymentInput;
}

@InputType()
class OISearch {
	@IsOptional()
	@Field(() => OrderStatus, { nullable: true })
	orderStatus?: OrderStatus;

	@IsOptional()
	@Field(() => OrderType, { nullable: true })
	orderType?: OrderType;

	/** order number, or a product title inside the order */
	@IsOptional()
	@Length(1, 50)
	@Field(() => String, { nullable: true })
	text?: string;
}

@InputType()
export class OrdersInquiry {
	@IsNotEmpty()
	@Min(1)
	@Field(() => Int)
	page: number;

	@IsNotEmpty()
	@Min(1)
	@Max(MAX_PAGE_LIMIT)
	@Field(() => Int)
	limit: number;

	@ValidateNested()
	@Type(() => OISearch)
	@Field(() => OISearch)
	search: OISearch;
}

@InputType()
export class OrderStatusUpdate {
	@IsNotEmpty()
	@Field(() => String)
	orderId: string;

	@IsEnum(OrderStatus)
	@Field(() => OrderStatus)
	orderStatus: OrderStatus;

	@IsOptional()
	@Length(0, 200)
	@Field(() => String, { nullable: true })
	sellerNote?: string;
}

@InputType()
export class CancelOrderInput {
	@IsNotEmpty()
	@Field(() => String)
	orderId: string;

	@IsNotEmpty()
	@Length(2, 200)
	@Field(() => String)
	reason: string;
}
