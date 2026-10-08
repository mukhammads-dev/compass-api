import { Logger, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GraphQLUpload } from 'graphql-upload';
import type { ObjectId, UploadPromise } from '../../libs/types/common';
import { LensFind, LensResult } from '../../libs/dto/lens/lens';
import { LensRegionInput } from '../../libs/dto/lens/lens.input';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { WithoutGuard } from '../auth/guards/without.guard';
import { LensService } from './lens.service';

/** Compass Lens: shop the furniture in any room photo. Open to guests. */
@Resolver()
export class LensResolver {
	private readonly logger = new Logger(LensResolver.name);

	constructor(private readonly lensService: LensService) {}

	@UseGuards(WithoutGuard)
	@Mutation(() => LensResult)
	public async lensSearch(
		@Args({ name: 'file', type: () => GraphQLUpload }) file: UploadPromise,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<LensResult> {
		this.logger.log('Mutation: lensSearch');
		return await this.lensService.lensSearch(memberId, await file);
	}

	@UseGuards(WithoutGuard)
	@Query(() => LensFind)
	public async lensRegion(
		@Args('input') input: LensRegionInput,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<LensFind> {
		this.logger.log('Query: lensRegion');
		return await this.lensService.lensRegion(memberId, input);
	}
}
