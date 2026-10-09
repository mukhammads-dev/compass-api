import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import CartItemSchema from '../../schemas/CartItem.model';
import MemberSchema from '../../schemas/Member.model';
import { AuthModule } from '../auth/auth.module';
import { ProductModule } from '../product/product.module';
import { CartResolver } from './cart.resolver';
import { CartService } from './cart.service';

@Module({
	imports: [
		MongooseModule.forFeature([
			{ name: 'CartItem', schema: CartItemSchema },
			{ name: 'Member', schema: MemberSchema },
		]),
		AuthModule,
		ProductModule,
	],
	providers: [CartResolver, CartService],
	exports: [CartService],
})
export class CartModule {}
