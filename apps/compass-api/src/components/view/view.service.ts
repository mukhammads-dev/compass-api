import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { ObjectId } from '../../libs/types/common';
import { errorMessage, isDuplicateKeyError, lookupVisit } from '../../libs/config';
import { OrdinaryInquiry } from '../../libs/dto/product/product.input';
import { Product, Products } from '../../libs/dto/product/product';
import { TotalCounter } from '../../libs/dto/member/member';
import { View } from '../../libs/dto/view/view';
import { ViewInput } from '../../libs/dto/view/view.input';
import { ViewGroup } from '../../libs/enums/view.enum';
import { T } from '../../libs/types/common';

@Injectable()
export class ViewService {
	private readonly logger = new Logger(ViewService.name);

	constructor(@InjectModel('View') private readonly viewModel: Model<View>) {}

	/** Records a view once per member and target. Returns null when it is not a new view. */
	public async recordView(input: ViewInput): Promise<View | null> {
		const viewExist = await this.checkViewExistence(input);
		if (viewExist) return null;

		try {
			return await this.viewModel.create(input);
		} catch (err) {
			if (isDuplicateKeyError(err)) return null;
			this.logger.error(`recordView: ${errorMessage(err)}`);
			throw err;
		}
	}

	private async checkViewExistence(input: ViewInput): Promise<View | null> {
		const { memberId, viewRefId } = input;
		return await this.viewModel.findOne({ memberId, viewRefId }).exec();
	}

	public async getVisitedProducts(memberId: ObjectId, input: OrdinaryInquiry): Promise<Products> {
		const { page, limit } = input;
		const match: T = { viewGroup: ViewGroup.PRODUCT, memberId };

		const data = await this.viewModel
			.aggregate<{ list: { visitedProduct: Product }[]; metaCounter: TotalCounter[] }>([
				{ $match: match },
				{ $sort: { updatedAt: -1 } },
				{
					$lookup: {
						from: 'products',
						localField: 'viewRefId',
						foreignField: '_id',
						as: 'visitedProduct',
					},
				},
				{ $unwind: '$visitedProduct' },
				{
					$facet: {
						list: [
							{ $skip: (page - 1) * limit },
							{ $limit: limit },
							lookupVisit,
							{ $unwind: '$visitedProduct.memberData' },
						],
						metaCounter: [{ $count: 'total' }],
					},
				},
			])
			.exec();

		const result: Products = { list: [], metaCounter: data[0].metaCounter };
		result.list = data[0].list.map((element) => element.visitedProduct);
		return result;
	}
}
