import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import MyRoomSchema from '../../schemas/MyRoom.model';
import { AuthModule } from '../auth/auth.module';
import { ProductModule } from '../product/product.module';
import { MyRoomResolver } from './my-room.resolver';
import { MyRoomService } from './my-room.service';

@Module({
	imports: [MongooseModule.forFeature([{ name: 'MyRoom', schema: MyRoomSchema }]), AuthModule, ProductModule],
	providers: [MyRoomResolver, MyRoomService],
	exports: [MyRoomService],
})
export class MyRoomModule {}
