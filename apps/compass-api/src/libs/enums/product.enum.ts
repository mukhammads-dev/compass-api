import { registerEnumType } from '@nestjs/graphql';

export enum ProductType {
	FURNITURE = 'FURNITURE',
	LIGHTING = 'LIGHTING',
	TEXTILE = 'TEXTILE',
	KITCHEN = 'KITCHEN',
	DECOR = 'DECOR',
	PLANT = 'PLANT',
	STORAGE = 'STORAGE',
	APPLIANCE = 'APPLIANCE',
}
registerEnumType(ProductType, { name: 'ProductType' });

export enum ProductRoom {
	LIVING = 'LIVING',
	BEDROOM = 'BEDROOM',
	KITCHEN = 'KITCHEN',
	BATHROOM = 'BATHROOM',
	OFFICE = 'OFFICE',
	KIDS = 'KIDS',
	BALCONY = 'BALCONY',
}
registerEnumType(ProductRoom, { name: 'ProductRoom' });

export enum ProductStyle {
	SCANDINAVIAN = 'SCANDINAVIAN',
	MINIMAL = 'MINIMAL',
	MODERN = 'MODERN',
	NATURAL = 'NATURAL',
	VINTAGE = 'VINTAGE',
	INDUSTRIAL = 'INDUSTRIAL',
	KOREAN_MODERN = 'KOREAN_MODERN',
}
registerEnumType(ProductStyle, { name: 'ProductStyle' });

export enum ProductMaterial {
	WOOD = 'WOOD',
	METAL = 'METAL',
	FABRIC = 'FABRIC',
	LEATHER = 'LEATHER',
	GLASS = 'GLASS',
	PLASTIC = 'PLASTIC',
	RATTAN = 'RATTAN',
	MARBLE = 'MARBLE',
}
registerEnumType(ProductMaterial, { name: 'ProductMaterial' });

export enum ProductCondition {
	NEW = 'NEW',
	USED = 'USED',
}
registerEnumType(ProductCondition, { name: 'ProductCondition' });

export enum ProductStatus {
	ACTIVE = 'ACTIVE',
	/** USED item paid for and waiting to be picked up */
	RESERVED = 'RESERVED',
	SOLD = 'SOLD',
	DELETE = 'DELETE',
}
registerEnumType(ProductStatus, { name: 'ProductStatus' });

export enum ProductLocation {
	SEOUL = 'SEOUL',
	BUSAN = 'BUSAN',
	INCHEON = 'INCHEON',
	DAEGU = 'DAEGU',
	DAEJEON = 'DAEJEON',
	GWANGJU = 'GWANGJU',
	ULSAN = 'ULSAN',
	GYEONGGI = 'GYEONGGI',
	JEJU = 'JEJU',
}
registerEnumType(ProductLocation, { name: 'ProductLocation' });
