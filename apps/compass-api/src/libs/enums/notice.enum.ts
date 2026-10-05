import { registerEnumType } from '@nestjs/graphql';

export enum NoticeCategory {
	NOTICE = 'NOTICE',
	FAQ = 'FAQ',
	EVENT = 'EVENT',
}
registerEnumType(NoticeCategory, { name: 'NoticeCategory' });

export enum NoticeStatus {
	HOLD = 'HOLD',
	ACTIVE = 'ACTIVE',
	DELETE = 'DELETE',
}
registerEnumType(NoticeStatus, { name: 'NoticeStatus' });
