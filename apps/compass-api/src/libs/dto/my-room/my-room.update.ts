import { Field, InputType, Int } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, Length, Max, Min } from 'class-validator';
import type { ObjectId } from '../../types/common';
import { MyRoomStatus } from '../../enums/my-room.enum';
import { ProductRoom, ProductStyle } from '../../enums/product.enum';

@InputType()
export class MyRoomUpdate {
	@IsNotEmpty()
	@Field(() => String)
	_id: ObjectId;

	@IsOptional()
	@Field(() => MyRoomStatus, { nullable: true })
	myRoomStatus?: MyRoomStatus;

	@IsOptional()
	@Length(1, 30)
	@Field(() => String, { nullable: true })
	myRoomName?: string;

	@IsOptional()
	@Field(() => ProductRoom, { nullable: true })
	myRoomType?: ProductRoom;

	@IsOptional()
	@Min(50)
	@Max(3000)
	@Field(() => Int, { nullable: true })
	myRoomWidth?: number;

	@IsOptional()
	@Min(50)
	@Max(3000)
	@Field(() => Int, { nullable: true })
	myRoomDepth?: number;

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
}
