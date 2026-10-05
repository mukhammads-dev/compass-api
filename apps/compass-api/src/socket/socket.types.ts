import type { MemberType } from '../libs/enums/member.enum';

/** The public part of a member that the chat shows. Never the full profile. */
export interface ChatMember {
	_id: string;
	memberNick: string;
	memberImage: string;
	memberType: MemberType;
}

export interface ChatMessage {
	id: string;
	text: string;
	member: ChatMember;
	createdAt: string; // ISO date
}

/**
 * Everything the server sends. The browser switches on `event`.
 * - history:  the last messages, sent once to a fresh connection
 * - presence: someone connected or left (member is null for guests)
 * - message:  a new chat message
 * - error:    only to the sender, e.g. a guest trying to write
 */
export type ServerEvent =
	| { event: 'history'; list: ChatMessage[]; online: number }
	| { event: 'presence'; action: 'joined' | 'left'; member: ChatMember | null; online: number }
	| { event: 'message'; message: ChatMessage }
	| { event: 'error'; message: string };

/** Per-connection state kept by the gateway. */
export interface ChatClient {
	member: ChatMember | null;
	isAlive: boolean;
	lastMessageAt: number;
}
