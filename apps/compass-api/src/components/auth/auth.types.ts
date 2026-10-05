import type { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext, type GqlContextType } from '@nestjs/graphql';
import type { Request } from 'express';
import type { MemberStatus, MemberType } from '../../libs/enums/member.enum';
import type { ObjectId } from '../../libs/types/common';

/** What travels inside the JWT (kept small on purpose). */
export interface TokenPayload {
	_id: string;
	memberType: MemberType;
	memberStatus: MemberStatus;
	memberNick: string;
	memberImage: string;
}

/** The signed-in member as guards attach it to the request. */
export interface AuthMemberPayload extends Omit<TokenPayload, '_id'> {
	_id: ObjectId;
	/** raw "Bearer …" header, kept for resolvers that call other services on the member's behalf */
	authorization?: string;
}

export interface AuthRequest extends Request {
	body: { authMember?: AuthMemberPayload | null } & Record<string, unknown>;
}

export const isGraphqlContext = (context: ExecutionContext): boolean => context.getType<GqlContextType>() === 'graphql';

/** The HTTP request behind a GraphQL resolver call. */
export const getGqlRequest = (context: ExecutionContext): AuthRequest =>
	GqlExecutionContext.create(context).getContext<{ req: AuthRequest }>().req;

/** "Bearer <token>" → "<token>", or null when the header is missing or malformed. */
export const extractBearerToken = (request: AuthRequest): string | null => {
	const header = request.headers.authorization;
	if (!header) return null;
	const [scheme, token] = header.split(' ');
	return scheme === 'Bearer' && token ? token : null;
};
