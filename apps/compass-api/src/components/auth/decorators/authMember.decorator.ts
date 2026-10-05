import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthMemberPayload, AuthRequest, getGqlRequest, isGraphqlContext } from '../auth.types';

/**
 * Reads the member that a guard attached to `request.body.authMember`.
 * `@AuthMember()` returns the whole payload, `@AuthMember('_id')` a single field.
 */
export const AuthMember = createParamDecorator(
	(data: keyof AuthMemberPayload | undefined, context: ExecutionContext) => {
		const request = isGraphqlContext(context)
			? getGqlRequest(context)
			: context.switchToHttp().getRequest<AuthRequest>();

		const member = request.body?.authMember;
		if (!member) return null;

		member.authorization = request.headers.authorization;
		return data ? member[data] : member;
	},
);
