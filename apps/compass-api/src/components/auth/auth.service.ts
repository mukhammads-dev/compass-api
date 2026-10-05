import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { shapeIntoMongoObjectId } from '../../libs/config';
import { Member } from '../../libs/dto/member/member';
import { AuthMemberPayload, TokenPayload } from './auth.types';

@Injectable()
export class AuthService {
	constructor(private readonly jwtService: JwtService) {}

	public async hashPassword(memberPassword: string): Promise<string> {
		const salt = await bcrypt.genSalt();
		return await bcrypt.hash(memberPassword, salt);
	}

	public async comparePasswords(password: string, hashedPassword: string): Promise<boolean> {
		return await bcrypt.compare(password, hashedPassword);
	}

	/** Only these fields travel inside the JWT. Profile data is always read fresh from the DB. */
	public async createToken(member: Member): Promise<string> {
		const payload: TokenPayload = {
			_id: String(member._id),
			memberType: member.memberType,
			memberStatus: member.memberStatus,
			memberNick: member.memberNick,
			memberImage: member.memberImage,
		};
		return await this.jwtService.signAsync(payload);
	}

	public async verifyToken(token: string): Promise<AuthMemberPayload> {
		const payload = await this.jwtService.verifyAsync<TokenPayload>(token);
		return {
			_id: shapeIntoMongoObjectId(payload._id),
			memberType: payload.memberType,
			memberStatus: payload.memberStatus,
			memberNick: payload.memberNick,
			memberImage: payload.memberImage,
		};
	}
}
