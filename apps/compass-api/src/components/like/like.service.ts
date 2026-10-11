import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { ObjectId } from '../../libs/types/common';
import { errorMessage, isDuplicateKeyError, lookupFavorite } from '../../libs/config';
import { Like, MeLiked } from '../../libs/dto/like/like';
import { LikeInput } from '../../libs/dto/like/like.input';
import { OrdinaryInquiry } from '../../libs/dto/product/product.input';
import { Product, Products } from '../../libs/dto/product/product';
import { TotalCounter } from '../../libs/dto/member/member';
import { LikeGroup } from '../../libs/enums/like.enum';
import { T } from '../../libs/types/common';

@Injectable()
export class LikeService {
	private readonly logger = new Logger(LikeService.name);

	constructor(@InjectModel('Like') private readonly likeModel: Model<Like>) {}

	/**
	 * Adds the like if it does not exist, removes it if it does.
	 * Returns the counter modifier for the caller: +1, -1, or 0 when a concurrent request already won.
	 */
	public async toggleLike(input: LikeInput): Promise<number> {
		const search: T = { memberId: input.memberId, likeRefId: input.likeRefId };

		const removed = await this.likeModel.findOneAndDelete(search).exec();
		if (removed) return -1;

		try {
			await this.likeModel.create(input);
			return 1;
		} catch (err) {
			if (isDuplicateKeyError(err)) return 0;
			this.logger.error(`toggleLike: ${errorMessage(err)}`);
			throw err;
		}
	}

	/** What the liker sees after a toggle, so the client can update without refetching the list. */
	public likedState(memberId: ObjectId, likeRefId: ObjectId, modifier: number): MeLiked[] {
		return modifier === -1 ? [] : [{ memberId, likeRefId, myFavorite: true }];
	}

	public async checkLikeExistence(input: LikeInput): Promise<MeLiked[]> {
		const { memberId, likeRefId } = input;
		const result = await this.likeModel.findOne({ memberId, likeRefId }).exec();
		return result ? [{ memberId, likeRefId, myFavorite: true }] : [];
	}

	public async getFavoriteProducts(memberId: ObjectId, input: OrdinaryInquiry): Promise<Products> {
		const { page, limit } = input;
		const match: T = { likeGroup: LikeGroup.PRODUCT, memberId };

		const data = await this.likeModel
			.aggregate<{ list: { favoriteProduct: Product }[]; metaCounter: TotalCounter[] }>([
				{ $match: match },
				{ $sort: { updatedAt: -1 } },
				{
					$lookup: {
						from: 'products',
						localField: 'likeRefId',
						foreignField: '_id',
						as: 'favoriteProduct',
					},
				},
				{ $unwind: '$favoriteProduct' },
				{
					$facet: {
						list: [
							{ $skip: (page - 1) * limit },
							{ $limit: limit },
							lookupFavorite,
							{ $unwind: '$favoriteProduct.memberData' },
						],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();

		const result: Products = { list: [], metaCounter: data[0].metaCounter };
		result.list = data[0].list.map((element) => element.favoriteProduct);
		return result;
	}
}
