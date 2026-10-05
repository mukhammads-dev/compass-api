import { BadRequestException, Logger, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { createWriteStream, mkdirSync } from 'fs';
import { GraphQLUpload } from 'graphql-upload';
import type { ObjectId } from '../../libs/types/common';
import {
	allowedUploadTargets,
	errorMessage,
	getSerialForImage,
	shapeIntoMongoObjectId,
	validMimeTypes,
} from '../../libs/config';
import { Member, Members } from '../../libs/dto/member/member';
import { AgentsInquiry, LoginInput, MemberInput, MembersInquiry } from '../../libs/dto/member/member.input';
import { MemberUpdate, MemberUpdateByAdmin } from '../../libs/dto/member/member.update';
import { Message } from '../../libs/enums/common.enum';
import { MemberType } from '../../libs/enums/member.enum';
import type { FileUpload, UploadPromise } from '../../libs/types/common';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { WithoutGuard } from '../auth/guards/without.guard';
import { MemberService } from './member.service';

@Resolver()
export class MemberResolver {
	private readonly logger = new Logger(MemberResolver.name);

	constructor(private readonly memberService: MemberService) {}

	@Mutation(() => Member)
	public async signup(@Args('input') input: MemberInput): Promise<Member> {
		this.logger.log('Mutation: signup');
		return await this.memberService.signup(input);
	}

	@Mutation(() => Member)
	public async login(@Args('input') input: LoginInput): Promise<Member> {
		this.logger.log('Mutation: login');
		return await this.memberService.login(input);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => Member)
	public async updateMember(
		@Args('input') input: MemberUpdate,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Member> {
		this.logger.log('Mutation: updateMember');
		delete input._id;
		return await this.memberService.updateMember(memberId, input);
	}

	@UseGuards(WithoutGuard)
	@Query(() => Member)
	public async getMember(@Args('memberId') input: string, @AuthMember('_id') memberId: ObjectId): Promise<Member> {
		this.logger.log('Query: getMember');
		const targetId = shapeIntoMongoObjectId(input);
		return await this.memberService.getMember(memberId, targetId);
	}

	@UseGuards(WithoutGuard)
	@Query(() => Members)
	public async getAgents(@Args('input') input: AgentsInquiry, @AuthMember('_id') memberId: ObjectId): Promise<Members> {
		this.logger.log('Query: getAgents');
		return await this.memberService.getAgents(memberId, input);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => Member)
	public async likeTargetMember(
		@Args('memberId') input: string,
		@AuthMember('_id') memberId: ObjectId,
	): Promise<Member> {
		this.logger.log('Mutation: likeTargetMember');
		const likeRefId = shapeIntoMongoObjectId(input);
		return await this.memberService.likeTargetMember(memberId, likeRefId);
	}

	/* ------------------------------------------------------------------ */
	/*  ADMIN                                                             */
	/* ------------------------------------------------------------------ */

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Query(() => Members)
	public async getAllMembersByAdmin(@Args('input') input: MembersInquiry): Promise<Members> {
		this.logger.log('Query: getAllMembersByAdmin');
		return await this.memberService.getAllMembersByAdmin(input);
	}

	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => Member)
	public async updateMemberByAdmin(@Args('input') input: MemberUpdateByAdmin): Promise<Member> {
		this.logger.log('Mutation: updateMemberByAdmin');
		input._id = shapeIntoMongoObjectId(input._id);
		return await this.memberService.updateMemberByAdmin(input);
	}

	/* ------------------------------------------------------------------ */
	/*  UPLOADER                                                          */
	/* ------------------------------------------------------------------ */

	@UseGuards(AuthGuard)
	@Mutation(() => String)
	public async imageUploader(
		@Args({ name: 'file', type: () => GraphQLUpload }) file: UploadPromise,
		@Args('target') target: string,
	): Promise<string> {
		this.logger.log('Mutation: imageUploader');
		return await this.saveImage(await file, target);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => [String])
	public async imagesUploader(
		@Args('files', { type: () => [GraphQLUpload] }) files: UploadPromise[],
		@Args('target') target: string,
	): Promise<string[]> {
		this.logger.log('Mutation: imagesUploader');

		const uploadedImages: string[] = [];
		const promisedList = files.map(async (promisedFile, index) => {
			try {
				uploadedImages[index] = await this.saveImage(await promisedFile, target);
			} catch (err) {
				this.logger.error(`imagesUploader[${index}]: ${errorMessage(err)}`);
			}
		});
		await Promise.all(promisedList);

		return uploadedImages.filter(Boolean);
	}

	private async saveImage(file: FileUpload, target: string): Promise<string> {
		const { createReadStream, filename, mimetype } = file;

		if (!allowedUploadTargets.includes(target)) throw new BadRequestException(Message.NOT_ALLOWED_REQUEST);
		if (!filename) throw new BadRequestException(Message.UPLOAD_FAILED);
		if (!validMimeTypes.includes(mimetype)) throw new BadRequestException(Message.PROVIDE_ALLOWED_FORMAT);

		const directory = `uploads/${target}`;
		mkdirSync(directory, { recursive: true });
		const url = `${directory}/${getSerialForImage(filename)}`;

		const isSaved = await new Promise<boolean>((resolve) => {
			createReadStream()
				.pipe(createWriteStream(url))
				.on('finish', () => resolve(true))
				.on('error', () => resolve(false));
		});
		if (!isSaved) throw new BadRequestException(Message.UPLOAD_FAILED);

		return url;
	}
}
