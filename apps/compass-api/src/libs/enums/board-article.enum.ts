import { registerEnumType } from '@nestjs/graphql';

export enum BoardArticleCategory {
	ROOM_TOUR = 'ROOM_TOUR',
	QNA = 'QNA',
	TIPS = 'TIPS',
	FREE = 'FREE',
}
registerEnumType(BoardArticleCategory, { name: 'BoardArticleCategory' });

export enum BoardArticleStatus {
	ACTIVE = 'ACTIVE',
	DELETE = 'DELETE',
}
registerEnumType(BoardArticleStatus, { name: 'BoardArticleStatus' });

export enum HomeType {
	ONE_ROOM = 'ONE_ROOM',
	OFFICETEL = 'OFFICETEL',
	VILLA = 'VILLA',
	APARTMENT = 'APARTMENT',
	HOUSE = 'HOUSE',
}
registerEnumType(HomeType, { name: 'HomeType' });

export enum TagSource {
	MANUAL = 'MANUAL',
	AI = 'AI',
}
registerEnumType(TagSource, { name: 'TagSource' });
