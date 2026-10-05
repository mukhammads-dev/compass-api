import { Types } from 'mongoose';
import { randomUUID } from 'crypto';
import * as path from 'path';
import type { ObjectId, T } from './types/common';

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
/*  Upload                                                            */
/* ------------------------------------------------------------------ */

export const validMimeTypes = ['image/png', 'image/jpg', 'image/jpeg', 'image/webp'];
export const allowedUploadTargets = ['member', 'product', 'article', 'my-room'];

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
