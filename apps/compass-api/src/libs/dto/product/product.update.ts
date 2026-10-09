import { Field, InputType, Int } from '@nestjs/graphql';
import { ArrayMaxSize, ArrayMinSize, IsNotEmpty, IsOptional, Length, Max, Min } from 'class-validator';
import { MAX_PRODUCT_STOCK } from '../../config';
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

@InputType()
export class ProductUpdate {
	@IsNotEmpty()
	@Field(() => String)
	_id: ObjectId;

	@IsOptional()
	@Field(() => ProductType, { nullable: true })
	productType?: ProductType;

	@IsOptional()
	@Field(() => ProductRoom, { nullable: true })
	productRoom?: ProductRoom;

	@IsOptional()
	@Field(() => ProductStyle, { nullable: true })
	productStyle?: ProductStyle;

	@IsOptional()
	@Field(() => ProductMaterial, { nullable: true })
	productMaterial?: ProductMaterial;

	@IsOptional()
	@Field(() => ProductCondition, { nullable: true })
	productCondition?: ProductCondition;

	@IsOptional()
	@Field(() => ProductStatus, { nullable: true })
	productStatus?: ProductStatus;

	@IsOptional()
	@Field(() => ProductLocation, { nullable: true })
	productLocation?: ProductLocation;

	@IsOptional()
	@Length(3, 100)
	@Field(() => String, { nullable: true })
	productAddress?: string;

	@IsOptional()
	@Length(3, 100)
	@Field(() => String, { nullable: true })
	productTitle?: string;

	@IsOptional()
	@Min(0)
	@Field(() => Int, { nullable: true })
	productPrice?: number;

	@IsOptional()
	@Min(0)
	@Field(() => Int, { nullable: true })
	productSalePrice?: number;

	@IsOptional()
	@Min(1)
	@Field(() => Int, { nullable: true })
	productWidth?: number;

	@IsOptional()
	@Min(1)
	@Field(() => Int, { nullable: true })
	productDepth?: number;

	@IsOptional()
	@Min(1)
	@Field(() => Int, { nullable: true })
	productHeight?: number;

	@IsOptional()
	@Length(2, 30)
	@Field(() => String, { nullable: true })
	productColor?: string;

	@IsOptional()
	@Min(0)
	@Max(MAX_PRODUCT_STOCK)
	@Field(() => Int, { nullable: true })
	productStock?: number;

	@IsOptional()
	@Min(0)
	@Field(() => Int, { nullable: true })
	productDeliveryFee?: number;

	@IsOptional()
	@Field(() => Boolean, { nullable: true })
	productAssembly?: boolean;

	@IsOptional()
	@ArrayMinSize(1)
	@ArrayMaxSize(10)
	@Field(() => [String], { nullable: true })
	productImages?: string[];

	@IsOptional()
	@Length(5, 1000)
	@Field(() => String, { nullable: true })
	productDesc?: string;

	/** set by the server when status changes */
	soldAt?: Date;

	/** set by the server when status changes */
	deletedAt?: Date;
}
