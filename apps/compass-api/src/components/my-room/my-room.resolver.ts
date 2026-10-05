import { Logger, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { ObjectId } from '../../libs/types/common';
import { shapeIntoMongoObjectId } from '../../libs/config';
import { MyRoom, ProductFit } from '../../libs/dto/my-room/my-room';
import { MyRoomInput, ProductFitInput } from '../../libs/dto/my-room/my-room.input';
import { MyRoomUpdate } from '../../libs/dto/my-room/my-room.update';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { MyRoomService } from './my-room.service';

@Resolver()
export class MyRoomResolver {
	private readonly logger = new Logger(MyRoomResolver.name);

	constructor(private readonly myRoomService: MyRoomService) {}

	@UseGuards(AuthGuard)
	@Mutation(() => MyRoom)
	public async saveMyRoom(@Args('input') input: MyRoomInput, @AuthMember('_id') memberId: ObjectId): Promise<MyRoom> {
		this.logger.log('Mutation: saveMyRoom');
		return await this.myRoomService.saveMyRoom(memberId, input);
	}

	@UseGuards(AuthGuard)
	@Query(() => [MyRoom])
	public async getMyRooms(@AuthMember('_id') memberId: ObjectId): Promise<MyRoom[]> {
		this.logger.log('Query: getMyRooms');
		return await this.myRoomService.getMyRooms(memberId);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => MyRoom)
	public async updateMyRoom(
		@Args('input') input: MyRoomUpdate,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<MyRoom> {
		this.logger.log('Mutation: updateMyRoom');
		input._id = shapeIntoMongoObjectId(input._id);
		return await this.myRoomService.updateMyRoom(memberId, input);
	}

	@UseGuards(AuthGuard)
	@Query(() => ProductFit)
	public async checkProductFit(
		@Args('input') input: ProductFitInput,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<ProductFit> {
		this.logger.log('Query: checkProductFit');
		input.productId = shapeIntoMongoObjectId(input.productId);
		input.myRoomId = shapeIntoMongoObjectId(input.myRoomId);
		return await this.myRoomService.checkProductFit(memberId, input);
	}
}
