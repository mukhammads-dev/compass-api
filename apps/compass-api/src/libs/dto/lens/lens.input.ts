import { Field, Float, InputType } from '@nestjs/graphql';
import { IsNotEmpty, Matches, Max, Min } from 'class-validator';

/** A spot the member tapped on a photo that lensSearch stored. Box values are 0..1. */
@InputType()
export class LensRegionInput {
	@IsNotEmpty()
	@Matches(/^uploads\/lens\/[\w-]+\.jpg$/)
	@Field(() => String)
	image: string;

	@Min(0)
	@Max(1)
	@Field(() => Float)
	x: number;

	@Min(0)
	@Max(1)
	@Field(() => Float)
	y: number;

	@Min(0.02)
	@Max(1)
	@Field(() => Float)
	w: number;

	@Min(0.02)
	@Max(1)
	@Field(() => Float)
	h: number;
}
