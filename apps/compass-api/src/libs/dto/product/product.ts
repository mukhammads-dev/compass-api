import { Field, Int, ObjectType } from '@nestjs/graphql';
import type { ObjectId } from '../../types/common';
import {
	ProductCondition,
	ProductLocation,
	ProductMaterial,
	ProductRoom,
	ProductStatus,
	ProductStyle,
	ProductType,
} from '../../enums/product.enum';
import { MeLiked } from '../like/like';
import { Member, TotalCounter } from '../member/member';

@ObjectType()
export class Product {
	@Field(() => String)
	_id: ObjectId;

	@Field(() => ProductType)
	productType: ProductType;

	@Field(() => ProductRoom)
	productRoom: ProductRoom;

	@Field(() => ProductStyle)
	productStyle: ProductStyle;

	@Field(() => ProductMaterial)
	productMaterial: ProductMaterial;

	@Field(() => ProductCondition)
	productCondition: ProductCondition;

	@Field(() => ProductStatus)
	productStatus: ProductStatus;

	@Field(() => ProductLocation)
	productLocation: ProductLocation;

	@Field(() => String)
	productAddress: string;

	@Field(() => String)
	productTitle: string;

	@Field(() => Int)
	productPrice: number;

	@Field(() => Int, { nullable: true })
	productSalePrice?: number;

	@Field(() => Int)
	productWidth: number;

	@Field(() => Int)
	productDepth: number;

	@Field(() => Int)
	productHeight: number;

	@Field(() => String)
	productColor: string;

	/** nullable on the wire as a safety net; ProductService fills missing values with 1 on start */
	@Field(() => Int, { nullable: true })
	productStock: number;

	@Field(() => Int)
	productDeliveryFee: number;

	@Field(() => Boolean)
	productAssembly: boolean;

	@Field(() => [String])
	productImages: string[];

	@Field(() => String, { nullable: true })
	productDesc?: string;

	@Field(() => Int)
	productViews: number;

	@Field(() => Int)
	productLikes: number;

	@Field(() => Int)
	productComments: number;

	@Field(() => Int)
	productRank: number;

	@Field(() => Int)
	productRoomTours: number;

	@Field(() => String)
	memberId: ObjectId;

	@Field(() => Date, { nullable: true })
	soldAt?: Date;

	@Field(() => Date, { nullable: true })
	deletedAt?: Date;

	@Field(() => Date)
	createdAt: Date;

	@Field(() => Date)
	updatedAt: Date;

	/** from aggregation */
	@Field(() => [MeLiked], { nullable: true })
	meLiked?: MeLiked[];

	/** from aggregation */
	@Field(() => Member, { nullable: true })
	memberData?: Member;
}

@ObjectType()
export class Products {
	@Field(() => [Product])
	list: Product[];

	@Field(() => [TotalCounter], { nullable: true })
	metaCounter: TotalCounter[];
}
