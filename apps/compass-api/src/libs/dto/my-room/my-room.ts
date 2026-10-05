import { Field, Int, ObjectType } from '@nestjs/graphql';
import type { ObjectId } from '../../types/common';
import { MyRoomStatus } from '../../enums/my-room.enum';
import { ProductRoom, ProductStyle } from '../../enums/product.enum';

@ObjectType()
export class MyRoom {
	@Field(() => String)
	_id: ObjectId;

	@Field(() => MyRoomStatus)
	myRoomStatus: MyRoomStatus;

	@Field(() => String)
	myRoomName: string;

	@Field(() => ProductRoom)
	myRoomType: ProductRoom;

	@Field(() => Int)
	myRoomWidth: number;

	@Field(() => Int)
	myRoomDepth: number;

	@Field(() => Int, { nullable: true })
	myRoomHeight?: number;

	@Field(() => Int, { nullable: true })
	myRoomDoorWidth?: number;

	@Field(() => Int, { nullable: true })
	myRoomDoorHeight?: number;

	@Field(() => ProductStyle, { nullable: true })
	myRoomStyle?: ProductStyle;

	@Field(() => Int, { nullable: true })
	myRoomBudget?: number;

	@Field(() => String, { nullable: true })
	myRoomImage?: string;

	@Field(() => String)
	memberId: ObjectId;

	@Field(() => Date)
	createdAt: Date;

	@Field(() => Date)
	updatedAt: Date;
}

/** Result of checking one product against one saved room. */
@ObjectType()
export class ProductFit {
	@Field(() => String)
	productId: ObjectId;

	@Field(() => String)
	myRoomId: ObjectId;

	/** fits the floor area (either orientation) and the ceiling */
	@Field(() => Boolean)
	fitsRoom: boolean;

	/** can be carried through the room door */
	@Field(() => Boolean, { nullable: true })
	fitsDoor?: boolean;

	/** human readable reasons when something does not fit */
	@Field(() => [String])
	warnings: string[];
}
