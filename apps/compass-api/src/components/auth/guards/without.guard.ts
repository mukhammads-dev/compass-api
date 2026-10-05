import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { extractBearerToken, getGqlRequest, isGraphqlContext } from '../auth.types';

/** Token is optional: a valid token identifies the member, otherwise the request continues as a guest. */
@Injectable()
export class WithoutGuard implements CanActivate {
	constructor(private readonly authService: AuthService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		if (!isGraphqlContext(context)) return false;

		const request = getGqlRequest(context);
		const token = extractBearerToken(request);

		request.body.authMember = null;
		if (token) {
			try {
				request.body.authMember = await this.authService.verifyToken(token);
			} catch {
				// invalid or expired token: continue as a guest
			}
		}
		return true;
	}
}
