import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Message } from '../../../libs/enums/common.enum';
import { AuthService } from '../auth.service';
import { extractBearerToken, getGqlRequest, isGraphqlContext } from '../auth.types';

/** Token is required. */
@Injectable()
export class AuthGuard implements CanActivate {
	private readonly logger = new Logger(AuthGuard.name);

	constructor(private readonly authService: AuthService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		if (!isGraphqlContext(context)) return false;

		const request = getGqlRequest(context);
		const token = extractBearerToken(request);
		if (!token) throw new UnauthorizedException(Message.TOKEN_NOT_EXIST);

		try {
			const authMember = await this.authService.verifyToken(token);
			request.body.authMember = authMember;
			this.logger.debug(`memberNick[auth]: ${authMember.memberNick}`);
			return true;
		} catch {
			throw new UnauthorizedException(Message.NOT_AUTHENTICATED);
		}
	}
}
