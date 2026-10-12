import { Types } from 'mongoose';
import { randomUUID } from 'crypto';
import * as path from 'path';
import type { ObjectId, T } from './types/common';
import { LensLabel } from './enums/lens.enum';
import { ProductType } from './enums/product.enum';

/* ------------------------------------------------------------------ */
/*  Sort whitelists (used by @IsIn in inquiry DTOs)                    */
/* ------------------------------------------------------------------ */

export const availableAgentSorts = ['createdAt', 'updatedAt', 'memberLikes', 'memberViews', 'memberRank'];
export const availableMemberSorts = ['createdAt', 'updatedAt', 'memberLikes', 'memberViews'];
export const availableProductSorts = [
	'createdAt',
	'updatedAt',
	'productLikes',
	'productViews',
	'productRank',
	'productPrice',
	'productRoomTours',
	'productWidth',
];
export const availableBoardArticleSorts = ['createdAt', 'updatedAt', 'articleLikes', 'articleViews', 'articleRank'];
export const availableCommentSorts = ['createdAt', 'updatedAt'];
export const availableNoticeSorts = ['createdAt', 'updatedAt'];

/* ------------------------------------------------------------------ */
/*  Business limits                                                   */
/* ------------------------------------------------------------------ */

export const MAX_PAGE_LIMIT = 100;
export const MAX_ACTIVE_USED_LISTINGS = 5;
export const MAX_ROOM_TOUR_TAGS = 20;
export const MAX_ROOM_TOUR_IMAGES = 10;
export const MAX_MY_ROOMS = 5;
export const SIMILAR_PRODUCTS_LIMIT = 8;
export const ROOM_TOUR_POINTS = 100;
export const DEFAULT_DOOR_HEIGHT = 200; // cm

/* ------------------------------------------------------------------ */
/*  Live chat (WebSocket)                                             */
/* ------------------------------------------------------------------ */

export const CHAT_HISTORY_LIMIT = 30; // messages a new visitor sees on connect
export const CHAT_MESSAGE_MAX_LENGTH = 500;
export const CHAT_MIN_INTERVAL_MS = 700; // per connection, simple flood guard
export const CHAT_HEARTBEAT_MS = 30_000; // ping interval; silent sockets are dropped

/* ------------------------------------------------------------------ */
/*  Compass Lens (shop a room photo)                                  */
/* ------------------------------------------------------------------ */

export const LENS_MODEL_DIR = 'models/lens'; // detector.onnx + embedder.onnx, see models/lens/export.py
/** photos people search with (Compass Lens); temporary, the batch deletes them after a day */
export const LENS_UPLOAD_DIR = 'uploads/photo-search';
export const LENS_MAX_IMAGE_SIDE = 1600; // px, uploads are downscaled before they are stored
export const LENS_MIN_SCORE = 0.3; // detector confidence
export const LENS_MIN_AREA = 0.01; // share of the photo; smaller finds are noise
export const LENS_MAX_FINDS = 8;
export const LENS_MATCH_LIMIT = 4; // products per find
export const LENS_MAX_CONCURRENT = 2; // searches running the models at the same time
export const LENS_INDEX_TTL_MS = 60_000; // product vectors are re-synced at most once a minute

/** Where each find belongs in the catalog; used when no product has the exact same label. */
export const LENS_LABEL_TYPE: Record<LensLabel, ProductType> = {
	[LensLabel.SOFA]: ProductType.FURNITURE,
	[LensLabel.ARMCHAIR]: ProductType.FURNITURE,
	[LensLabel.CHAIR]: ProductType.FURNITURE,
	[LensLabel.DINING_TABLE]: ProductType.FURNITURE,
	[LensLabel.COFFEE_TABLE]: ProductType.FURNITURE,
	[LensLabel.SIDE_TABLE]: ProductType.FURNITURE,
	[LensLabel.DESK]: ProductType.FURNITURE,
	[LensLabel.BED]: ProductType.FURNITURE,
	[LensLabel.STOOL]: ProductType.FURNITURE,
	[LensLabel.BENCH]: ProductType.FURNITURE,
	[LensLabel.TV_STAND]: ProductType.FURNITURE,
	[LensLabel.FLOOR_LAMP]: ProductType.LIGHTING,
	[LensLabel.TABLE_LAMP]: ProductType.LIGHTING,
	[LensLabel.PENDANT_LAMP]: ProductType.LIGHTING,
	[LensLabel.RUG]: ProductType.TEXTILE,
	[LensLabel.CUSHION]: ProductType.TEXTILE,
	[LensLabel.CURTAIN]: ProductType.TEXTILE,
	[LensLabel.SHELF]: ProductType.STORAGE,
	[LensLabel.CABINET]: ProductType.STORAGE,
	[LensLabel.DRESSER]: ProductType.STORAGE,
	[LensLabel.MIRROR]: ProductType.DECOR,
	[LensLabel.VASE]: ProductType.DECOR,
	[LensLabel.WALL_ART]: ProductType.DECOR,
	[LensLabel.PLANT]: ProductType.PLANT,
};

/**
 * A product's label comes from its title first (sellers name what they sell); the detector is the fallback.
 * Checked top to bottom, so the specific names come before the general ones ("coffee table" before "table").
 */
export const LENS_TITLE_KEYWORDS: [LensLabel, RegExp][] = [
	[LensLabel.FLOOR_LAMP, /floor lamp|standing lamp|장스탠드|플로어/i],
	[LensLabel.TABLE_LAMP, /table lamp|desk lamp|bedside lamp|무드등|단스탠드/i],
	[LensLabel.PENDANT_LAMP, /pendant|ceiling|chandelier|bulb|펜던트|조명/i],
	[LensLabel.COFFEE_TABLE, /coffee table|tea table|low table|좌식|커피 ?테이블/i],
	[LensLabel.SIDE_TABLE, /side table|end table|nightstand|bedside table|협탁|사이드 ?테이블/i],
	[LensLabel.DINING_TABLE, /dining|식탁/i],
	[LensLabel.TV_STAND, /tv (stand|console|cabinet)|media console|거실장/i],
	[LensLabel.ARMCHAIR, /armchair|lounge chair|accent chair|recliner|안락의자|라운지/i],
	[LensLabel.SOFA, /sofa|couch|loveseat|소파/i],
	[LensLabel.STOOL, /stool|ottoman|pouf|floor cushion|스툴/i],
	[LensLabel.BENCH, /bench|벤치/i],
	[LensLabel.CHAIR, /chair|의자|체어/i],
	[LensLabel.DESK, /desk|workstation|책상/i],
	[LensLabel.BED, /\bbed\b|bed frame|mattress|duvet|bedding|침대|매트리스|이불/i],
	[LensLabel.DRESSER, /dresser|chest of drawers|drawer|서랍/i],
	[LensLabel.SHELF, /shelf|shelves|bookcase|bookshelf|선반|책장/i],
	[LensLabel.CABINET, /cabinet|sideboard|wardrobe|closet|cupboard|수납장|옷장|장식장/i],
	[LensLabel.MIRROR, /mirror|거울/i],
	[LensLabel.RUG, /\brug\b|carpet|mat\b|러그|카펫/i],
	[LensLabel.CURTAIN, /curtain|drape|blind|커튼|블라인드/i],
	[LensLabel.CUSHION, /cushion|pillow|throw|쿠션/i],
	[LensLabel.VASE, /vase|화병|꽃병/i],
	[LensLabel.PLANT, /plant|monstera|tree|ficus|leaf|식물|화분/i],
	[LensLabel.WALL_ART, /poster|print|painting|canvas|wall art|frame|액자|포스터/i],
	[LensLabel.PENDANT_LAMP, /lamp|light|램프/i],
	[LensLabel.DINING_TABLE, /table|테이블/i],
];

/* ------------------------------------------------------------------ */
/*  Cart & orders                                                     */
/* ------------------------------------------------------------------ */

export const MAX_CART_ITEMS = 30;
export const MAX_ITEM_QUANTITY = 10;
export const MAX_PRODUCT_STOCK = 999;
/** Whole won; anything under ₩1,000 means the zeros were left off. */
export const MIN_PRODUCT_PRICE = 1_000;
export const ASSEMBLY_FEE = 30_000; // KRW per unit, installer assembles on delivery day
export const STAIRS_FREE_FLOORS = 2; // carrying up to the 2nd floor without a lift is free
export const STAIRS_FEE_PER_FLOOR = 10_000; // KRW per floor above that, per delivery
export const DELIVERY_MIN_DAYS = 3; // stores need time to prepare a truck
export const DELIVERY_MAX_DAYS = 30;
export const MEETUP_MAX_DAYS = 14;
export const AUTO_COMPLETE_DAYS = 7; // a delivered order is confirmed automatically after this
/** Simulated payment: this card number is always declined, so the failure path can be shown. */
export const TEST_DECLINED_CARD = '4000000000000002';

/* ------------------------------------------------------------------ */
/*  Upload                                                            */
/* ------------------------------------------------------------------ */

export const validMimeTypes = ['image/png', 'image/jpg', 'image/jpeg', 'image/webp'];
/**
 * uploads/<target>:
 *   member     → profile photos
 *   product    → product photos
 *   community  → photos in community posts and room tours
 *   my-room    → room photos people save in "Will it fit?"
 */
export const allowedUploadTargets = ['member', 'product', 'community', 'my-room'];

export const getSerialForImage = (filename: string): string => {
	const ext = path.parse(filename).ext;
	return randomUUID() + ext;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/** Ids arrive from GraphQL as strings; queries need ObjectIds. */
export const shapeIntoMongoObjectId = (target: string | ObjectId): ObjectId => {
	return typeof target === 'string' ? new Types.ObjectId(target) : target;
};

/** Readable message from anything that was thrown. */
export const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/** MongoDB unique-index violation (E11000), e.g. a like or view that a parallel request already created. */
export const isDuplicateKeyError = (err: unknown): boolean =>
	typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 11000;

/** Escapes user text before it is used inside a RegExp (ReDoS protection). */
export const escapeRegex = (text: string): string => {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/* ------------------------------------------------------------------ */
/*  Aggregation lookups                                               */
/* ------------------------------------------------------------------ */

export const lookupMember = {
	$lookup: {
		from: 'members',
		localField: 'memberId',
		foreignField: '_id',
		as: 'memberData',
	},
};

export const lookupAuthMemberLiked = (memberId: T | null, targetRefId: string = '$_id') => {
	return {
		$lookup: {
			from: 'likes',
			let: {
				localLikeRefId: targetRefId,
				localMemberId: memberId,
				localMyFavorite: true,
			},
			pipeline: [
				{
					$match: {
						$expr: {
							$and: [{ $eq: ['$likeRefId', '$$localLikeRefId'] }, { $eq: ['$memberId', '$$localMemberId'] }],
						},
					},
				},
				{
					$project: {
						_id: 0,
						memberId: 1,
						likeRefId: 1,
						myFavorite: '$$localMyFavorite',
					},
				},
			],
			as: 'meLiked',
		},
	};
};

interface LookupAuthMemberFollowed {
	followerId: T | null;
	followingId: string;
}

export const lookupAuthMemberFollowed = (input: LookupAuthMemberFollowed) => {
	const { followerId, followingId } = input;
	return {
		$lookup: {
			from: 'follows',
			let: {
				localFollowerId: followerId,
				localFollowingId: followingId,
				localMyFollowing: true,
			},
			pipeline: [
				{
					$match: {
						$expr: {
							$and: [{ $eq: ['$followerId', '$$localFollowerId'] }, { $eq: ['$followingId', '$$localFollowingId'] }],
						},
					},
				},
				{
					$project: {
						_id: 0,
						followerId: 1,
						followingId: 1,
						myFollowing: '$$localMyFollowing',
					},
				},
			],
			as: 'meFollowed',
		},
	};
};

export const lookupFollowingData = {
	$lookup: {
		from: 'members',
		localField: 'followingId',
		foreignField: '_id',
		as: 'followingData',
	},
};

export const lookupFollowerData = {
	$lookup: {
		from: 'members',
		localField: 'followerId',
		foreignField: '_id',
		as: 'followerData',
	},
};

export const lookupFavorite = {
	$lookup: {
		from: 'members',
		localField: 'favoriteProduct.memberId',
		foreignField: '_id',
		as: 'favoriteProduct.memberData',
	},
};

export const lookupVisit = {
	$lookup: {
		from: 'members',
		localField: 'visitedProduct.memberId',
		foreignField: '_id',
		as: 'visitedProduct.memberData',
	},
};
