import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import ProductSchema from '../../schemas/Product.model';
import ProductVectorSchema from '../../schemas/ProductVector.model';
import { AuthModule } from '../auth/auth.module';
import { LensResolver } from './lens.resolver';
import { LensService } from './lens.service';
import { VisionService } from './vision.service';

@Module({
	imports: [
		MongooseModule.forFeature([
			{ name: 'Product', schema: ProductSchema },
			{ name: 'ProductVector', schema: ProductVectorSchema },
		]),
		AuthModule,
	],
	providers: [LensResolver, LensService, VisionService],
})
export class LensModule {}
