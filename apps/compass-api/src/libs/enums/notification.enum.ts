import { registerEnumType } from '@nestjs/graphql';

export enum NotificationType {
	LIKE = 'LIKE',
	COMMENT = 'COMMENT',
	FOLLOW = 'FOLLOW',
	TAG = 'TAG',
}
registerEnumType(NotificationType, { name: 'NotificationType' });

export enum NotificationStatus {
	WAIT = 'WAIT',
	READ = 'READ',
}
registerEnumType(NotificationStatus, { name: 'NotificationStatus' });

export enum NotificationGroup {
	MEMBER = 'MEMBER',
	PRODUCT = 'PRODUCT',
	ARTICLE = 'ARTICLE',
}
registerEnumType(NotificationGroup, { name: 'NotificationGroup' });
