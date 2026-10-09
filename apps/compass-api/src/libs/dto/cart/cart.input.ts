import { Field, InputType, Int } from '@nestjs/graphql';
import { IsBoolean, IsNotEmpty, IsOptional, Max, Min } from 'class-validator';
import { MAX_ITEM_QUANTITY } from '../../config';

@InputType()
export class CartItemInput {
	@IsNotEmpty()
	@Field(() => String)
	productId: string;

	@IsNotEmpty()
	@Min(1)
	@Max(MAX_ITEM_QUANTITY)
	@Field(() => Int)
	quantity: number;

	@IsOptional()
	@IsBoolean()
	@Field(() => Boolean, { nullable: true })
	assembly?: boolean;
}

@InputType()
export class CartItemUpdate {
	@IsNotEmpty()
	@Field(() => String)
	productId: string;

	@IsOptional()
	@Min(1)
	@Max(MAX_ITEM_QUANTITY)
	@Field(() => Int, { nullable: true })
	quantity?: number;

	@IsOptional()
	@IsBoolean()
	@Field(() => Boolean, { nullable: true })
	assembly?: boolean;
}
