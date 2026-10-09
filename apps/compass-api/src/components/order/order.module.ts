import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import MemberSchema from '../../schemas/Member.model';
import OrderSchema from '../../schemas/Order.model';
import { AuthModule } from '../auth/auth.module';
import { CartModule } from '../cart/cart.module';
import { NotificationModule } from '../notification/notification.module';
import { ProductModule } from '../product/product.module';
import { OrderResolver } from './order.resolver';
import { OrderService } from './order.service';

@Module({
	imports: [
		MongooseModule.forFeature([
			{ name: 'Order', schema: OrderSchema },
			{ name: 'Member', schema: MemberSchema },
		]),
		AuthModule,
		CartModule,
		ProductModule,
		NotificationModule,
	],
	providers: [OrderResolver, OrderService],
})
export class OrderModule {}
