import { Field, InputType, Int } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, Length, Max, Min } from 'class-validator';
import type { ObjectId } from '../../types/common';
import { ProductRoom, ProductStyle } from '../../enums/product.enum';

/** All sizes are in cm, budget in KRW. */
@InputType()
export class MyRoomInput {
	@IsNotEmpty()
	@Length(1, 30)
	@Field(() => String)
	myRoomName: string;

	@IsNotEmpty()
	@Field(() => ProductRoom)
	myRoomType: ProductRoom;

	@IsNotEmpty()
	@Min(50)
	@Max(3000)
	@Field(() => Int)
	myRoomWidth: number;

	@IsNotEmpty()
	@Min(50)
	@Max(3000)
	@Field(() => Int)
	myRoomDepth: number;

	@IsOptional()
	@Min(150)
	@Max(600)
	@Field(() => Int, { nullable: true })
	myRoomHeight?: number;

	@IsOptional()
	@Min(40)
	@Max(300)
	@Field(() => Int, { nullable: true })
	myRoomDoorWidth?: number;

	@IsOptional()
	@Min(150)
	@Max(400)
	@Field(() => Int, { nullable: true })
	myRoomDoorHeight?: number;

	@IsOptional()
	@Field(() => ProductStyle, { nullable: true })
	myRoomStyle?: ProductStyle;

	@IsOptional()
	@Min(0)
	@Field(() => Int, { nullable: true })
	myRoomBudget?: number;

	@IsOptional()
	@Field(() => String, { nullable: true })
	myRoomImage?: string;

	/** filled by the server from the token */
	memberId?: ObjectId;
}

@InputType()
export class ProductFitInput {
	@IsNotEmpty()
	@Field(() => String)
	productId: ObjectId;

	@IsNotEmpty()
	@Field(() => String)
	myRoomId: ObjectId;
}
