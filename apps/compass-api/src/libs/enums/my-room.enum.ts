import { registerEnumType } from '@nestjs/graphql';

export enum MyRoomStatus {
	ACTIVE = 'ACTIVE',
	DELETE = 'DELETE',
}
registerEnumType(MyRoomStatus, { name: 'MyRoomStatus' });
