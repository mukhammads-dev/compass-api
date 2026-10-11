import { Field, InputType, Int } from '@nestjs/graphql';
import { ArrayMaxSize, ArrayMinSize, IsIn, IsNotEmpty, IsOptional, Length, Max, Min } from 'class-validator';
import type { ObjectId } from '../../types/common';
import { availableProductSorts, MAX_PAGE_LIMIT, MAX_PRODUCT_STOCK, MIN_PRODUCT_PRICE } from '../../config';
import { Direction } from '../../enums/common.enum';
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
export class ProductInput {
	@IsNotEmpty()
	@Field(() => ProductType)
	productType: ProductType;

	@IsNotEmpty()
	@Field(() => ProductRoom)
	productRoom: ProductRoom;

	@IsNotEmpty()
	@Field(() => ProductStyle)
	productStyle: ProductStyle;

	@IsNotEmpty()
	@Field(() => ProductMaterial)
	productMaterial: ProductMaterial;

	@IsNotEmpty()
	@Field(() => ProductCondition)
	productCondition: ProductCondition;

	@IsNotEmpty()
	@Field(() => ProductLocation)
	productLocation: ProductLocation;

	@IsNotEmpty()
	@Length(3, 100)
	@Field(() => String)
	productAddress: string;

	@IsNotEmpty()
	@Length(3, 100)
	@Field(() => String)
	productTitle: string;

	@IsNotEmpty()
	@Min(MIN_PRODUCT_PRICE)
	@Field(() => Int)
	productPrice: number;

	@IsOptional()
	@Min(MIN_PRODUCT_PRICE)
	@Field(() => Int, { nullable: true })
	productSalePrice?: number;

	@IsNotEmpty()
	@Min(1)
	@Field(() => Int)
	productWidth: number;

	@IsNotEmpty()
	@Min(1)
	@Field(() => Int)
	productDepth: number;

	@IsNotEmpty()
	@Min(1)
	@Field(() => Int)
	productHeight: number;

	@IsNotEmpty()
	@Length(2, 30)
	@Field(() => String)
	productColor: string;

	/** NEW only; USED items are single pieces */
	@IsOptional()
	@Min(1)
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

	@IsNotEmpty()
	@ArrayMinSize(1)
	@ArrayMaxSize(10)
	@Field(() => [String])
	productImages: string[];

	@IsOptional()
	@Length(5, 1000)
	@Field(() => String, { nullable: true })
	productDesc?: string;

	/** filled by the server from the token */
	memberId?: ObjectId;
}

@InputType()
class PricesRange {
	@Field(() => Int)
	start: number;

	@Field(() => Int)
	end: number;
}

/** "Fits my space" filter, all values in cm. */
@InputType()
class SizeFit {
	@IsOptional()
	@Min(1)
	@Field(() => Int, { nullable: true })
	maxWidth?: number;

	@IsOptional()
	@Min(1)
	@Field(() => Int, { nullable: true })
	maxDepth?: number;

	@IsOptional()
	@Min(1)
	@Field(() => Int, { nullable: true })
	maxHeight?: number;
}

@InputType()
class PISearch {
	@IsOptional()
	@Field(() => String, { nullable: true })
	memberId?: ObjectId;

	@IsOptional()
	@Field(() => [ProductType], { nullable: true })
	typeList?: ProductType[];

	@IsOptional()
	@Field(() => [ProductRoom], { nullable: true })
	roomList?: ProductRoom[];

	@IsOptional()
	@Field(() => [ProductStyle], { nullable: true })
	styleList?: ProductStyle[];

	@IsOptional()
	@Field(() => [ProductMaterial], { nullable: true })
	materialList?: ProductMaterial[];

	@IsOptional()
	@Field(() => [ProductCondition], { nullable: true })
	conditionList?: ProductCondition[];

	@IsOptional()
	@Field(() => [ProductLocation], { nullable: true })
	locationList?: ProductLocation[];

	@IsOptional()
	@Field(() => PricesRange, { nullable: true })
	pricesRange?: PricesRange;

	@IsOptional()
	@Field(() => SizeFit, { nullable: true })
	sizeFit?: SizeFit;

	@IsOptional()
	@Field(() => String, { nullable: true })
	text?: string;

	/** only products with a sale price lower than the price */
	@IsOptional()
	@Field(() => Boolean, { nullable: true })
	onSale?: boolean;
}

@InputType()
export class ProductsInquiry {
	@IsNotEmpty()
	@Min(1)
	@Field(() => Int)
	page: number;

	@IsNotEmpty()
	@Min(1)
	@Max(MAX_PAGE_LIMIT)
	@Field(() => Int)
	limit: number;

	@IsOptional()
	@IsIn(availableProductSorts)
	@Field(() => String, { nullable: true })
	sort?: string;

	@IsOptional()
	@Field(() => Direction, { nullable: true })
	direction?: Direction;

	@IsNotEmpty()
	@Field(() => PISearch)
	search: PISearch;
}

@InputType()
class APISearch {
	@IsOptional()
	@Field(() => ProductStatus, { nullable: true })
	productStatus?: ProductStatus;
}

@InputType()
export class AgentProductsInquiry {
	@IsNotEmpty()
	@Min(1)
	@Field(() => Int)
	page: number;

	@IsNotEmpty()
	@Min(1)
	@Max(MAX_PAGE_LIMIT)
	@Field(() => Int)
	limit: number;

	@IsOptional()
	@IsIn(availableProductSorts)
	@Field(() => String, { nullable: true })
	sort?: string;

	@IsOptional()
	@Field(() => Direction, { nullable: true })
	direction?: Direction;

	@IsNotEmpty()
	@Field(() => APISearch)
	search: APISearch;
}

@InputType()
class ALPISearch {
	@IsOptional()
	@Field(() => ProductStatus, { nullable: true })
	productStatus?: ProductStatus;

	@IsOptional()
	@Field(() => [ProductLocation], { nullable: true })
	productLocationList?: ProductLocation[];

	@IsOptional()
	@Field(() => String, { nullable: true })
	text?: string;
}

@InputType()
export class AllProductsInquiry {
	@IsNotEmpty()
	@Min(1)
	@Field(() => Int)
	page: number;

	@IsNotEmpty()
	@Min(1)
	@Max(MAX_PAGE_LIMIT)
	@Field(() => Int)
	limit: number;

	@IsOptional()
	@IsIn(availableProductSorts)
	@Field(() => String, { nullable: true })
	sort?: string;

	@IsOptional()
	@Field(() => Direction, { nullable: true })
	direction?: Direction;

	@IsNotEmpty()
	@Field(() => ALPISearch)
	search: ALPISearch;
}

@InputType()
export class OrdinaryInquiry {
	@IsNotEmpty()
	@Min(1)
	@Field(() => Int)
	page: number;

	@IsNotEmpty()
	@Min(1)
	@Max(MAX_PAGE_LIMIT)
	@Field(() => Int)
	limit: number;
}
