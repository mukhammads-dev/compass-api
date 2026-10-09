import { Field, Int, ObjectType } from '@nestjs/graphql';
import type { ObjectId } from '../../types/common';
import { Product } from '../product/product';

@ObjectType()
export class CartItem {
	@Field(() => String)
	_id: ObjectId;

	@Field(() => String)
	productId: ObjectId;

	@Field(() => Int)
	quantity: number;

	@Field(() => Boolean)
	assembly: boolean;

	/** false when the product was sold out, removed, or is no longer for delivery */
	@Field(() => Boolean)
	available: boolean;

	/** what can be ordered right now: stock, capped by the per-item limit */
	@Field(() => Int)
	maxQuantity: number;

	@Field(() => Product, { nullable: true })
	productData?: Product;
}
