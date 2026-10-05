import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { ObjectId } from '../../libs/types/common';
import { DEFAULT_DOOR_HEIGHT, errorMessage, MAX_MY_ROOMS } from '../../libs/config';
import { MyRoom, ProductFit } from '../../libs/dto/my-room/my-room';
import { MyRoomInput, ProductFitInput } from '../../libs/dto/my-room/my-room.input';
import { MyRoomUpdate } from '../../libs/dto/my-room/my-room.update';
import { Product } from '../../libs/dto/product/product';
import { Message } from '../../libs/enums/common.enum';
import { MyRoomStatus } from '../../libs/enums/my-room.enum';
import { T } from '../../libs/types/common';
import { ProductService } from '../product/product.service';

@Injectable()
export class MyRoomService {
	private readonly logger = new Logger(MyRoomService.name);

	constructor(
		@InjectModel('MyRoom') private readonly myRoomModel: Model<MyRoom>,
		private readonly productService: ProductService,
	) {}

	public async saveMyRoom(memberId: ObjectId, input: MyRoomInput): Promise<MyRoom> {
		const activeRooms = await this.myRoomModel.countDocuments({ memberId, myRoomStatus: MyRoomStatus.ACTIVE }).exec();
		if (activeRooms >= MAX_MY_ROOMS) throw new BadRequestException(Message.MY_ROOM_LIMIT_REACHED);

		input.memberId = memberId;
		try {
			return await this.myRoomModel.create(input);
		} catch (err) {
			this.logger.error(`saveMyRoom: ${errorMessage(err)}`);
			throw new BadRequestException(Message.CREATE_FAILED);
		}
	}

	public async getMyRooms(memberId: ObjectId): Promise<MyRoom[]> {
		return await this.myRoomModel.find({ memberId, myRoomStatus: MyRoomStatus.ACTIVE }).sort({ createdAt: -1 }).exec();
	}

	public async updateMyRoom(memberId: ObjectId, input: MyRoomUpdate): Promise<MyRoom> {
		const search: T = { _id: input._id, memberId, myRoomStatus: MyRoomStatus.ACTIVE };
		const result = await this.myRoomModel.findOneAndUpdate(search, input, { new: true }).exec();
		if (!result) throw new NotFoundException(Message.UPDATE_FAILED);
		return result;
	}

	/**
	 * Checks one product against one saved room:
	 *  - fitsRoom: the footprint fits the floor in either orientation and the product is below the ceiling
	 *  - fitsDoor: the two smallest dimensions pass through the door opening
	 */
	public async checkProductFit(memberId: ObjectId, input: ProductFitInput): Promise<ProductFit> {
		const room = await this.myRoomModel
			.findOne({ _id: input.myRoomId, memberId, myRoomStatus: MyRoomStatus.ACTIVE })
			.lean()
			.exec();
		if (!room) throw new NotFoundException(Message.NO_DATA_FOUND);

		const product = await this.productService.getProduct(null, input.productId);
		return this.calculateFit(product, room as MyRoom);
	}

	private calculateFit(product: Product, room: MyRoom): ProductFit {
		const { productWidth: width, productDepth: depth, productHeight: height } = product;
		const warnings: string[] = [];

		const fitsFloor =
			(width <= room.myRoomWidth && depth <= room.myRoomDepth) ||
			(width <= room.myRoomDepth && depth <= room.myRoomWidth);
		if (!fitsFloor) {
			warnings.push(
				`Footprint ${width}×${depth} cm is larger than the room ${room.myRoomWidth}×${room.myRoomDepth} cm`,
			);
		}

		const fitsCeiling = !room.myRoomHeight || height <= room.myRoomHeight;
		if (!fitsCeiling) warnings.push(`Height ${height} cm is taller than the ceiling ${room.myRoomHeight} cm`);

		let fitsDoor: boolean | undefined;
		if (room.myRoomDoorWidth) {
			const doorHeight = room.myRoomDoorHeight ?? DEFAULT_DOOR_HEIGHT;
			const [smallest, middle] = [width, depth, height].sort((a, b) => a - b);
			fitsDoor = smallest <= room.myRoomDoorWidth && middle <= doorHeight;
			if (!fitsDoor) {
				warnings.push(`Needs a ${smallest}×${middle} cm opening, the door is ${room.myRoomDoorWidth}×${doorHeight} cm`);
			}
		}

		return {
			productId: product._id,
			myRoomId: room._id,
			fitsRoom: fitsFloor && fitsCeiling,
			fitsDoor,
			warnings,
		};
	}
}
