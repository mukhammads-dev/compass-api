import { randomUUID } from 'crypto';
import type { IncomingMessage } from 'http';
import { Logger, type OnModuleDestroy } from '@nestjs/common';
import {
	ConnectedSocket,
	MessageBody,
	type OnGatewayConnection,
	type OnGatewayDisconnect,
	type OnGatewayInit,
	SubscribeMessage,
	WebSocketGateway,
	WebSocketServer,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { AuthService } from '../components/auth/auth.service';
import {
	CHAT_HEARTBEAT_MS,
	CHAT_HISTORY_LIMIT,
	CHAT_MESSAGE_MAX_LENGTH,
	CHAT_MIN_INTERVAL_MS,
	errorMessage,
} from '../libs/config';
import { Message } from '../libs/enums/common.enum';
import { MemberStatus } from '../libs/enums/member.enum';
import type { ChatClient, ChatMember, ChatMessage, ServerEvent } from './socket.types';

/**
 * Compass live chat: one public room for everyone on the site.
 *
 * - The browser connects to ws://<api>?token=<jwt>. A valid token of an ACTIVE member makes
 *   the connection a member; anything else is a guest. Guests can read, only members can write.
 * - A fresh connection receives the last messages and the online count.
 * - History lives in memory (like Nestar): it resets when the server restarts.
 * - A ping/pong heartbeat drops sockets whose browser vanished without closing them.
 */
@WebSocketGateway({ transports: ['websocket'] })
export class SocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
	private readonly logger = new Logger('LiveChat');
	private readonly clients = new Map<WebSocket, ChatClient>();
	private readonly history: ChatMessage[] = [];
	private heartbeat?: NodeJS.Timeout;

	@WebSocketServer()
	private readonly server!: Server;

	constructor(private readonly authService: AuthService) {}

	/* ------------------------------------------------------------------ */
	/*  Lifecycle                                                         */
	/* ------------------------------------------------------------------ */

	public afterInit(): void {
		this.heartbeat = setInterval(() => this.checkHeartbeats(), CHAT_HEARTBEAT_MS);
		this.logger.log('WebSocket server ready');
	}

	public onModuleDestroy(): void {
		if (this.heartbeat) clearInterval(this.heartbeat);
	}

	public async handleConnection(client: WebSocket, request: IncomingMessage): Promise<void> {
		const member = await this.authenticate(request);
		this.clients.set(client, { member, isAlive: true, lastMessageAt: 0 });
		client.on('pong', () => this.markAlive(client));

		this.send(client, { event: 'history', list: this.history, online: this.clients.size });
		this.broadcast({ event: 'presence', action: 'joined', member, online: this.clients.size }, client);

		this.logger.log(`+ ${member?.memberNick ?? 'guest'} (online ${this.clients.size})`);
	}

	public handleDisconnect(client: WebSocket): void {
		const member = this.clients.get(client)?.member ?? null;
		this.clients.delete(client);
		this.broadcast({ event: 'presence', action: 'left', member, online: this.clients.size });

		this.logger.log(`- ${member?.memberNick ?? 'guest'} (online ${this.clients.size})`);
	}

	/* ------------------------------------------------------------------ */
	/*  Messages                                                          */
	/* ------------------------------------------------------------------ */

	/** Browser sends: {"event":"message","data":"<text>"} */
	@SubscribeMessage('message')
	public handleMessage(@ConnectedSocket() client: WebSocket, @MessageBody() data: unknown): void {
		const state = this.clients.get(client);
		if (!state) return;

		if (!state.member) return this.sendError(client, Message.NOT_AUTHENTICATED);

		const text = typeof data === 'string' ? data.trim() : '';
		if (!text) return this.sendError(client, Message.CHAT_EMPTY_MESSAGE);
		if (text.length > CHAT_MESSAGE_MAX_LENGTH) return this.sendError(client, Message.CHAT_MESSAGE_TOO_LONG);

		const now = Date.now();
		if (now - state.lastMessageAt < CHAT_MIN_INTERVAL_MS) return this.sendError(client, Message.CHAT_TOO_FAST);
		state.lastMessageAt = now;

		const message: ChatMessage = {
			id: randomUUID(),
			text,
			member: state.member,
			createdAt: new Date(now).toISOString(),
		};

		this.history.push(message);
		if (this.history.length > CHAT_HISTORY_LIMIT) this.history.splice(0, this.history.length - CHAT_HISTORY_LIMIT);

		this.broadcast({ event: 'message', message });
	}

	/* ------------------------------------------------------------------ */
	/*  Helpers                                                           */
	/* ------------------------------------------------------------------ */

	/** Reads ?token= from the connection URL. Invalid, expired or inactive → guest (null). */
	private async authenticate(request: IncomingMessage): Promise<ChatMember | null> {
		const token = new URL(request.url ?? '/', 'http://localhost').searchParams.get('token');
		if (!token) return null;

		try {
			const auth = await this.authService.verifyToken(token);
			if (auth.memberStatus !== MemberStatus.ACTIVE) return null;
			return {
				_id: auth._id.toString(),
				memberNick: auth.memberNick,
				memberImage: auth.memberImage,
				memberType: auth.memberType,
			};
		} catch (err) {
			this.logger.warn(`Rejected chat token: ${errorMessage(err)}`);
			return null;
		}
	}

	private markAlive(client: WebSocket): void {
		const state = this.clients.get(client);
		if (state) state.isAlive = true;
	}

	/** Every interval: drop sockets that did not answer the last ping, ping the rest. */
	private checkHeartbeats(): void {
		this.clients.forEach((state, client) => {
			if (!state.isAlive) {
				client.terminate(); // fires handleDisconnect
				return;
			}
			state.isAlive = false;
			client.ping();
		});
	}

	private send(client: WebSocket, payload: ServerEvent): void {
		if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(payload));
	}

	private sendError(client: WebSocket, message: Message): void {
		this.send(client, { event: 'error', message });
	}

	/** To every open connection, optionally skipping one (the newcomer already got the count). */
	private broadcast(payload: ServerEvent, except?: WebSocket): void {
		const data = JSON.stringify(payload);
		this.server.clients.forEach((client) => {
			if (client !== except && client.readyState === WebSocket.OPEN) client.send(data);
		});
	}
}
