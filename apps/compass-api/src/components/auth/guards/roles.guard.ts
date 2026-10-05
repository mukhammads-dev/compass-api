import {
	CanActivate,
	ExecutionContext,
	ForbiddenException,
	Injectable,
	Logger,
	UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Message } from '../../../libs/enums/common.enum';
import { MemberType } from '../../../libs/enums/member.enum';
import { AuthService } from '../auth.service';
import { AuthMemberPayload, extractBearerToken, getGqlRequest, isGraphqlContext } from '../auth.types';

/** Token is required and the member type must be listed in @Roles(). */
@Injectable()
export class RolesGuard implements CanActivate {
	private readonly logger = new Logger(RolesGuard.name);

	constructor(
		private readonly reflector: Reflector,
		private readonly authService: AuthService,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const roles = this.reflector.get<MemberType[] | undefined>('roles', context.getHandler());
		if (!roles) return true;

		if (!isGraphqlContext(context)) return false;

		const request = getGqlRequest(context);
		const token = extractBearerToken(request);
		if (!token) throw new UnauthorizedException(Message.TOKEN_NOT_EXIST);

		let authMember: AuthMemberPayload;
		try {
			authMember = await this.authService.verifyToken(token);
		} catch {
			throw new UnauthorizedException(Message.NOT_AUTHENTICATED);
		}

		if (!roles.includes(authMember.memberType)) throw new ForbiddenException(Message.ONLY_SPECIFIC_ROLES_ALLOWED);

		this.logger.debug(`memberNick[roles]: ${authMember.memberNick}`);
		request.body.authMember = authMember;
		return true;
	}
}
