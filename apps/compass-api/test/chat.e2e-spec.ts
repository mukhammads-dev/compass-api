import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsAdapter } from '@nestjs/platform-ws';
import { Test } from '@nestjs/testing';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { WebSocket } from 'ws';
import { SocketModule } from '../src/socket/socket.module';
import type { ServerEvent } from '../src/socket/socket.types';

const SECRET = 'chat-e2e-secret';

/** A ws client that records every server event. */
class TestClient {
	public readonly events: ServerEvent[] = [];
	private constructor(public readonly socket: WebSocket) {
		socket.on('message', (data: Buffer) => this.events.push(JSON.parse(data.toString()) as ServerEvent));
	}

	static open(url: string): Promise<TestClient> {
		return new Promise((resolve, reject) => {
			const socket = new WebSocket(url);
			const client = new TestClient(socket);
			socket.once('open', () => resolve(client));
			socket.once('error', reject);
		});
	}

	say(text: string): void {
		this.socket.send(JSON.stringify({ event: 'message', data: text }));
	}

	ofType<E extends ServerEvent['event']>(event: E): Extract<ServerEvent, { event: E }>[] {
		return this.events.filter((item): item is Extract<ServerEvent, { event: E }> => item.event === event);
	}
}

const settle = (ms = 150) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Live chat gateway (e2e)', () => {
	let app: INestApplication;
	let url: string;
	let tokenFor: (nick: string, status?: string) => Promise<string>;
	const open: TestClient[] = [];
	const connect = async (token?: string) => {
		const client = await TestClient.open(token ? `${url}?token=${token}` : url);
		open.push(client);
		await settle(50);
		return client;
	};

	beforeAll(async () => {
		process.env.SECRET_TOKEN = SECRET;
		const moduleRef = await Test.createTestingModule({ imports: [SocketModule] }).compile();
		app = moduleRef.createNestApplication();
		app.useWebSocketAdapter(new WsAdapter(app));
		await app.listen(0);
		url = `ws://localhost:${((app.getHttpServer() as Server).address() as AddressInfo).port}`;

		const jwt = new JwtService({ secret: SECRET });
		let seq = 0;
		tokenFor = (memberNick, memberStatus = 'ACTIVE') =>
			jwt.signAsync({
				_id: `65f0000000000000000000${String(++seq).padStart(2, '0')}`,
				memberType: 'USER',
				memberStatus,
				memberNick,
				memberImage: '',
			});
	});

	afterEach(async () => {
		open.splice(0).forEach((client) => client.socket.close());
		await settle();
	});

	afterAll(async () => {
		await app.close();
	});

	it('greets a new connection with history and the online count', async () => {
		const guest = await connect();
		const [history] = guest.ofType('history');
		expect(history.online).toBe(1);
		expect(Array.isArray(history.list)).toBe(true);
	});

	it('delivers a member message to everyone, trimmed and signed by the server', async () => {
		const sora = await connect(await tokenFor('sora'));
		const guest = await connect();
		sora.say('  Hello Compass!  ');
		await settle();

		for (const client of [sora, guest]) {
			const [event] = client.ofType('message');
			expect(event.message.text).toBe('Hello Compass!');
			expect(event.message.member.memberNick).toBe('sora');
		}
	});

	it('lets guests and blocked members read but not write', async () => {
		const guest = await connect();
		const blocked = await connect(await tokenFor('bad', 'BLOCK'));
		guest.say('hi');
		blocked.say('hi');
		await settle();

		expect(guest.ofType('error')[0]?.message).toMatch(/not authenticated/i);
		expect(blocked.ofType('error')[0]?.message).toMatch(/not authenticated/i);
		expect(guest.ofType('message')).toHaveLength(0);
	});

	it('rejects empty, too long and too fast messages', async () => {
		const jun = await connect(await tokenFor('jun'));
		jun.say('   ');
		jun.say('x'.repeat(501));
		jun.say('first');
		jun.say('second, right away');
		await settle();

		const errors = jun.ofType('error').map((event) => event.message);
		expect(errors).toEqual(
			expect.arrayContaining([
				'Write something before sending!',
				'Message is too long!',
				'You are sending messages too fast!',
			]),
		);
		expect(jun.ofType('message').map((event) => event.message.text)).toEqual(['first']);
	});

	it('tells the others when someone joins and leaves', async () => {
		const first = await connect();
		const second = await connect(await tokenFor('mina'));
		second.socket.close();
		await settle();

		const actions = first.ofType('presence').map((event) => `${event.action}:${event.member?.memberNick ?? 'guest'}`);
		expect(actions).toEqual(['joined:mina', 'left:mina']);
	});

	it('gives a late visitor the recent history', async () => {
		const late = await connect();
		const texts = late.ofType('history')[0].list.map((message) => message.text);
		expect(texts).toEqual(expect.arrayContaining(['Hello Compass!', 'first']));
	});
});
