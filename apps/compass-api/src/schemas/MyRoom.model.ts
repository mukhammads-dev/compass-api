import { Schema } from 'mongoose';
import { MyRoomStatus } from '../libs/enums/my-room.enum';
import { ProductRoom, ProductStyle } from '../libs/enums/product.enum';

/** A room saved by a member for fit checks and AI planning. Sizes in cm, budget in KRW. */
const MyRoomSchema = new Schema(
	{
		myRoomStatus: { type: String, enum: MyRoomStatus, default: MyRoomStatus.ACTIVE },
		myRoomName: { type: String, required: true },
		myRoomType: { type: String, enum: ProductRoom, required: true },

		myRoomWidth: { type: Number, required: true },
		myRoomDepth: { type: Number, required: true },
		myRoomHeight: { type: Number },
		myRoomDoorWidth: { type: Number },
		myRoomDoorHeight: { type: Number },

		myRoomStyle: { type: String, enum: ProductStyle },
		myRoomBudget: { type: Number },
		myRoomImage: { type: String },

		memberId: { type: Schema.Types.ObjectId, required: true, ref: 'Member' },
	},
	{ timestamps: true, collection: 'myRooms' },
);

MyRoomSchema.index({ memberId: 1, myRoomStatus: 1 });

export default MyRoomSchema;
