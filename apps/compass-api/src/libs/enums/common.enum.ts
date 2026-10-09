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

	CART_LIMIT_REACHED = 'Your cart is full, check out or remove something first!',
	CART_IS_EMPTY = 'Your cart is empty!',
	NOT_FOR_DELIVERY = 'Used furniture is reserved and picked up, not delivered!',
	NOT_FOR_MEETUP = 'Only used furniture can be reserved for pick-up!',
	OWN_PRODUCT = 'You cannot buy your own product!',
	OUT_OF_STOCK = 'Sorry, not enough left in stock!',
	PRODUCT_NOT_AVAILABLE = 'This product is no longer available!',
	ASSEMBLY_NOT_OFFERED = 'Assembly is not offered for this product!',
	INVALID_DELIVERY_DATE = 'Please choose an available delivery date!',
	MISSING_DELIVERY_DATE = 'Please choose a delivery date for every store!',
	PAYMENT_DECLINED = 'Payment was declined, please try another card!',
	INVALID_CARD = 'Please check the card number and expiry date!',
	ORDER_STATUS_LOCKED = 'This order can no longer be changed!',

	LENS_UNAVAILABLE = 'Photo search is not available right now, please try again later!',
}

export enum Direction {
	ASC = 1,
	DESC = -1,
}
registerEnumType(Direction, { name: 'Direction' });
