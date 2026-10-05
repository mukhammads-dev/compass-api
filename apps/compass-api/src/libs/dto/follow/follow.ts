import { Field, ObjectType } from '@nestjs/graphql';
import type { ObjectId } from '../../types/common';
import { MeLiked } from '../like/like';
import { Member, TotalCounter } from '../member/member';

@ObjectType()
export class MeFollowed {
	@Field(() => String)
	followingId: ObjectId;

	@Field(() => String)
	followerId: ObjectId;

	@Field(() => Boolean)
	myFollowing: boolean;
}

@ObjectType()
export class Follower {
	@Field(() => String)
	_id: ObjectId;

	@Field(() => String)
	followingId: ObjectId;

	@Field(() => String)
	followerId: ObjectId;

	@Field(() => Date)
	createdAt: Date;

	@Field(() => Date)
	updatedAt: Date;

	/** from aggregation */
	@Field(() => [MeLiked], { nullable: true })
	meLiked?: MeLiked[];

	/** from aggregation */
	@Field(() => [MeFollowed], { nullable: true })
	meFollowed?: MeFollowed[];

	/** from aggregation */
	@Field(() => Member, { nullable: true })
	followerData?: Member;
}

@ObjectType()
export class Following {
	@Field(() => String)
	_id: ObjectId;

	@Field(() => String)
	followingId: ObjectId;

	@Field(() => String)
	followerId: ObjectId;

	@Field(() => Date)
	createdAt: Date;

	@Field(() => Date)
	updatedAt: Date;

	/** from aggregation */
	@Field(() => [MeLiked], { nullable: true })
	meLiked?: MeLiked[];

	/** from aggregation */
	@Field(() => [MeFollowed], { nullable: true })
	meFollowed?: MeFollowed[];

	/** from aggregation */
	@Field(() => Member, { nullable: true })
	followingData?: Member;
}

@ObjectType()
export class Followers {
	@Field(() => [Follower])
	list: Follower[];

	@Field(() => [TotalCounter], { nullable: true })
	metaCounter: TotalCounter[];
}

@ObjectType()
export class Followings {
	@Field(() => [Following])
	list: Following[];

	@Field(() => [TotalCounter], { nullable: true })
	metaCounter: TotalCounter[];
}
