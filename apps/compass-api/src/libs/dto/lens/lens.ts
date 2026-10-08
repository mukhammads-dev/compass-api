import { Field, Float, ObjectType } from '@nestjs/graphql';
import { LensLabel } from '../../enums/lens.enum';
import { ProductType } from '../../enums/product.enum';
import { Product } from '../product/product';

/** Something Compass Lens recognised in the photo, with the closest products in the catalog. */
@ObjectType()
export class LensFind {
	@Field(() => LensLabel, { nullable: true })
	label?: LensLabel;

	@Field(() => ProductType, { nullable: true })
	productType?: ProductType;

	/** detector confidence, 1 for a region the member picked */
	@Field(() => Float)
	score: number;

	/** position in the photo, 0..1 of its width / height */
	@Field(() => Float)
	x: number;

	@Field(() => Float)
	y: number;

	@Field(() => Float)
	w: number;

	@Field(() => Float)
	h: number;

	@Field(() => [Product])
	products: Product[];
}

@ObjectType()
export class LensResult {
	/** the stored photo, used again for lensRegion */
	@Field(() => String)
	image: string;

	@Field(() => [LensFind])
	finds: LensFind[];
}
