import { registerEnumType } from '@nestjs/graphql';

export enum Message {
	SOMETHING_WENT_WRONG = 'Something went wrong!',
	NO_DATA_FOUND = 'No data found!',
	CREATE_FAILED = 'Create failed!',
	UPDATE_FAILED = 'Update failed!',
	REMOVE_FAILED = 'Remove failed!',
	UPLOAD_FAILED = 'Upload failed!',
	BAD_REQUEST = 'Bad Request',

	USED_MEMBER_NICK_OR_PHONE = 'Already used member nick or phone!',
	NO_MEMBER_NICK = 'No member with that member nick!',
	BLOCKED_USER = 'You have been blocked!',
	WRONG_PASSWORD = 'Wrong password, try again!',
	NOT_AUTHENTICATED = 'You are not authenticated, please login first!',
	TOKEN_NOT_EXIST = 'Bearer Token is not provided!',
	ONLY_SPECIFIC_ROLES_ALLOWED = 'Allowed only for members with specific roles!',
	NOT_ALLOWED_REQUEST = 'Not Allowed Request!',
	PROVIDE_ALLOWED_FORMAT = 'Please provide jpg, jpeg, png or webp images!',
	SELF_SUBSCRIPTION_DENIED = 'Self subscription is denied!',

	USER_CAN_SELL_ONLY_USED = 'Users can list only USED products!',
	USED_LISTING_LIMIT_REACHED = 'You have reached the limit of active USED listings!',
	ROOM_TOUR_REQUIRES_IMAGES = 'Room Tour requires at least one room image!',
	INVALID_TAGGED_PRODUCTS = 'Tagged products must exist and be active!',
	INVALID_TAG_IMAGE_INDEX = 'Tag image index is out of room images range!',
	MY_ROOM_LIMIT_REACHED = 'You have reached the limit of saved rooms!',

	CHAT_EMPTY_MESSAGE = 'Write something before sending!',
	CHAT_MESSAGE_TOO_LONG = 'Message is too long!',
	CHAT_TOO_FAST = 'You are sending messages too fast!',

	LENS_UNAVAILABLE = 'Photo search is not available right now, please try again later!',
}

export enum Direction {
	ASC = 1,
	DESC = -1,
}
registerEnumType(Direction, { name: 'Direction' });
