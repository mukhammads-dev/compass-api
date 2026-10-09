import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import BoardArticleSchema from '../../compass-api/src/schemas/BoardArticle.model';
import MemberSchema from '../../compass-api/src/schemas/Member.model';
import OrderSchema from '../../compass-api/src/schemas/Order.model';
import ProductSchema from '../../compass-api/src/schemas/Product.model';
import { BatchController } from './batch.controller';
import { BatchService } from './batch.service';
import { DatabaseModule } from './database/database.module';

@Module({
	imports: [
		ConfigModule.forRoot(),
		DatabaseModule,
		ScheduleModule.forRoot(),
		MongooseModule.forFeature([
			{ name: 'Member', schema: MemberSchema },
			{ name: 'Product', schema: ProductSchema },
			{ name: 'BoardArticle', schema: BoardArticleSchema },
			{ name: 'Order', schema: OrderSchema },
		]),
	],
	controllers: [BatchController],
	providers: [BatchService],
})
export class BatchModule {}
