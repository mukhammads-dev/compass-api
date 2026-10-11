/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- GraphQL responses are untyped JSON */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Connection, Model } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { MemberService } from '../src/components/member/member.service';

/**
 * The whole purchase flow through GraphQL against a real database:
 * cart → quote → checkout (declined card, then paid) → store moves the delivery → buyer confirms,
 * the last piece selling out and coming back on cancel, two buyers racing for one piece,
 * and a used piece reserved, held and picked up.
 *
 * Needs a MongoDB-compatible server: MONGO_E2E (default mongodb://127.0.0.1:27017/compass_e2e).
 * The database is dropped before the run. Member counters are updated with a plain updateOne here, because
 * FerretDB (a MongoDB-compatible server handy for local runs) cannot do findAndModify with a projection.
 */

const MONGO = process.env.MONGO_E2E ?? 'mongodb://127.0.0.1:27017/compass_e2e';
/**
 * The race test relies on MongoDB's single-document atomicity. FerretDB on SQLite does not provide it,
 * so set MONGO_E2E_NOT_ATOMIC=1 when running against FerretDB.
 */
const raceIt = process.env.MONGO_E2E_NOT_ATOMIC ? it.skip : it;

const CARD = { method: 'CARD', cardNumber: '4242 4242 4242 4242', cardExpiry: '12/30', cardHolder: 'Kim Minji' };
const DECLINED = { ...CARD, cardNumber: '4000 0000 0000 0002' };
const SHIPPING = {
	recipient: 'Kim Minji',
	phone: '010-1234-5678',
	address: '12 Wausan-ro, Mapo-gu, Seoul',
	addressDetail: 'Apt 402',
	postalCode: '04039',
	floor: 4,
	elevator: false,
};

const ORDER_FIELDS = `_id orderNo checkoutId orderType orderStatus sellerNick itemsTotal deliveryFee assemblyTotal stairsFee orderTotal
	items { productTitle unitPrice quantity assembly assemblyFee }
	payment { method amount cardBrand cardLast4 refundedAt }
	history { status actor }`;

describe('Orders (e2e)', () => {
	let app: INestApplication;
	let earliestDate: string;

	const gql = async (query: string, variables: Record<string, unknown> = {}, token?: string) => {
		let req = request(app.getHttpServer()).post('/graphql');
		if (token) req = req.set('Authorization', `Bearer ${token}`);
		const res = await req.send({ query, variables });
		return res.body as { data?: any; errors?: { message: string }[] };
	};
	const ok = async (query: string, variables: Record<string, unknown> = {}, token?: string) => {
		const body = await gql(query, variables, token);
		if (body.errors?.length) throw new Error(body.errors[0].message);
		return body.data;
	};
	const failMessage = async (query: string, variables: Record<string, unknown>, token?: string) =>
		(await gql(query, variables, token)).errors?.[0]?.message;

	const signup = async (memberNick: string, memberType: 'USER' | 'AGENT', phone: string) =>
		(
			await ok(`mutation ($input: MemberInput!) { signup(input: $input) { accessToken } }`, {
				input: { memberNick, memberPassword: 'secret1', memberPhone: phone, memberType },
			})
		).signup.accessToken as string;

	const createProduct = async (token: string, input: Record<string, unknown>) =>
		(
			await ok(
				`mutation ($input: ProductInput!) { createProduct(input: $input) { _id productStock productStatus } }`,
				{
					input: {
						productType: 'FURNITURE',
						productRoom: 'LIVING',
						productStyle: 'NATURAL',
						productMaterial: 'WOOD',
						productLocation: 'SEOUL',
						productAddress: 'Mapo-gu, Seoul',
						productWidth: 200,
						productDepth: 90,
						productHeight: 80,
						productColor: 'Oak',
						productImages: ['uploads/product/test.jpg'],
						...input,
					},
				},
				token,
			)
		).createProduct as { _id: string; productStock: number; productStatus: string };

	const productState = async (productId: string) =>
		(await ok(`query ($id: String!) { getProduct(productId: $id) { productStock productStatus } }`, { id: productId }))
			.getProduct as { productStock: number; productStatus: string };

	const addToCart = (token: string, productId: string, quantity = 1, assembly = false) =>
		ok(
			`mutation ($input: CartItemInput!) { addToCart(input: $input) { quantity assembly available maxQuantity } }`,
			{
				input: { productId, quantity, assembly },
			},
			token,
		);

	const checkout = (token: string, sellerId: string, payment = CARD, productIds?: string[]) =>
		gql(
			`mutation ($input: CheckoutInput!) { createOrders(input: $input) { ${ORDER_FIELDS} } }`,
			{ input: { productIds, shipping: SHIPPING, deliveries: [{ sellerId, preferredDate: earliestDate }], payment } },
			token,
		);

	const sellerStep = (token: string, orderId: string, orderStatus: string, sellerNote?: string) =>
		gql(
			`mutation ($input: OrderStatusUpdate!) { updateOrderBySeller(input: $input) { orderStatus sellerNote } }`,
			{ input: { orderId, orderStatus, sellerNote } },
			token,
		);

	const cancel = (token: string, orderId: string) =>
		gql(
			`mutation ($input: CancelOrderInput!) { cancelOrder(input: $input) { orderStatus canceledBy payment { refundedAt } } }`,
			{ input: { orderId, reason: 'Changed my mind' } },
			token,
		);

	let store: string, buyer: string, rival: string, neighbour: string;
	let storeId: string;
	let sofa: { _id: string; productStock: number; productStatus: string };

	beforeAll(async () => {
		process.env.MONGO_DEV = MONGO;
		process.env.SECRET_TOKEN = process.env.SECRET_TOKEN ?? 'order-e2e-secret';
		delete process.env.NODE_ENV;

		const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
		app = moduleRef.createNestApplication();
		app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
		await app.init();
		await app.get<Connection>(getConnectionToken()).dropDatabase();

		const memberModel = app.get<Model<unknown>>(getModelToken('Member'));
		jest.spyOn(app.get(MemberService), 'memberStatsEditor').mockImplementation(async ({ _id, targetKey, modifier }) => {
			await memberModel.updateOne({ _id }, { $inc: { [targetKey]: modifier } }).exec();
			return null;
		});

		store = await signup('oakhouse', 'AGENT', '01011110000');
		buyer = await signup('minji', 'USER', '01022220000');
		rival = await signup('sora', 'USER', '01033330000');
		neighbour = await signup('jun', 'USER', '01044440000');
		storeId = JSON.parse(Buffer.from(store.split('.')[1], 'base64url').toString())._id;

		sofa = await createProduct(store, {
			productCondition: 'NEW',
			productTitle: 'Linen 3-seat sofa',
			productPrice: 890_000,
			productSalePrice: 790_000,
			productStock: 2,
			productDeliveryFee: 30_000,
			productAssembly: true,
		});
	}, 60_000);

	afterAll(async () => {
		await app?.close();
	});

	it('keeps NEW stock, and makes a USED piece one of a kind', async () => {
		expect(sofa.productStock).toBe(2);
		const used = await createProduct(neighbour, {
			productCondition: 'USED',
			productTitle: 'Rattan chair',
			productPrice: 60_000,
			productStock: 5,
		});
		expect(used.productStock).toBe(1);
	});

	it('refuses to put your own product in the cart', async () => {
		expect(
			await failMessage(
				`mutation ($input: CartItemInput!) { addToCart(input: $input) { quantity } }`,
				{ input: { productId: sofa._id, quantity: 1 } },
				store,
			),
		).toBe('You cannot buy your own product!');
	});

	it('caps the cart quantity at the stock', async () => {
		const { addToCart: line } = await addToCart(buyer, sofa._id, 5, true);
		expect(line).toEqual({ quantity: 2, assembly: true, available: true, maxQuantity: 2 });
		await ok(
			`mutation ($input: CartItemUpdate!) { updateCartItem(input: $input) { quantity } }`,
			{ input: { productId: sofa._id, quantity: 1 } },
			buyer,
		);
	});

	it('quotes the checkout on the server: sale price, one truck, assembly, stairs', async () => {
		const { getCheckoutQuote: quote } = await ok(
			`query ($input: QuoteInput!) { getCheckoutQuote(input: $input) {
				itemsTotal deliveryTotal assemblyTotal stairsTotal grandTotal earliestDate
				stores { sellerNick orderTotal items { unitPrice quantity assemblyFee } }
			} }`,
			{ input: { floor: 4, elevator: false } },
			buyer,
		);
		expect(quote).toMatchObject({
			itemsTotal: 790_000,
			deliveryTotal: 30_000,
			assemblyTotal: 30_000,
			stairsTotal: 20_000,
			grandTotal: 870_000,
			stores: [
				{
					sellerNick: 'oakhouse',
					orderTotal: 870_000,
					items: [{ unitPrice: 790_000, quantity: 1, assemblyFee: 30_000 }],
				},
			],
		});
		earliestDate = quote.earliestDate;
	});

	it('takes nothing when the card is declined', async () => {
		const res = await checkout(buyer, storeId, DECLINED);
		expect(res.errors?.[0].message).toBe('Payment was declined, please try another card!');
		expect((await productState(sofa._id)).productStock).toBe(2);
	});

	let orderId: string;

	it('charges once, creates the order and empties the cart', async () => {
		const res = await checkout(buyer, storeId);
		expect(res.errors).toBeUndefined();
		const [order] = res.data.createOrders;
		expect(order).toMatchObject({
			orderType: 'DELIVERY',
			orderStatus: 'PAID',
			sellerNick: 'oakhouse',
			orderTotal: 870_000,
			payment: { method: 'CARD', amount: 870_000, cardBrand: 'Visa', cardLast4: '4242', refundedAt: null },
			history: [{ status: 'PAID', actor: 'BUYER' }],
		});
		expect(order.orderNo).toMatch(/^CP\d{6}-[2-9A-Z]{6}$/);
		orderId = order._id;

		expect((await productState(sofa._id)).productStock).toBe(1);
		expect((await ok(`query { getMyCart { productId } }`, {}, buyer)).getMyCart).toEqual([]);
	});

	it('lets only the store see it in its orders, and only both sides open it', async () => {
		const storeOrders = (
			await ok(
				`query ($input: OrdersInquiry!) { getStoreOrders(input: $input) { list { _id } metaCounter { total } } }`,
				{ input: { page: 1, limit: 10, search: {} } },
				store,
			)
		).getStoreOrders;
		expect(storeOrders.metaCounter[0].total).toBe(1);
		expect(await failMessage(`query ($id: String!) { getOrder(orderId: $id) { _id } }`, { id: orderId }, rival)).toBe(
			'No data found!',
		);
	});

	it('moves the delivery one step at a time, and locks buyer cancellation once preparing', async () => {
		expect((await sellerStep(store, orderId, 'SHIPPING')).errors?.[0].message).toBe(
			'This order can no longer be changed!',
		);
		expect((await sellerStep(store, orderId, 'PREPARING')).data.updateOrderBySeller.orderStatus).toBe('PREPARING');
		expect((await cancel(buyer, orderId)).errors?.[0].message).toBe('This order can no longer be changed!');
		const shipping = await sellerStep(store, orderId, 'SHIPPING', 'Truck arrives between 10 and 12');
		expect(shipping.data.updateOrderBySeller).toEqual({
			orderStatus: 'SHIPPING',
			sellerNote: 'Truck arrives between 10 and 12',
		});
		expect((await sellerStep(store, orderId, 'DELIVERED')).data.updateOrderBySeller.orderStatus).toBe('DELIVERED');
	});

	it('lets the buyer confirm the delivery', async () => {
		const { completeOrder } = await ok(
			`mutation ($id: String!) { completeOrder(orderId: $id) { orderStatus history { status actor } } }`,
			{ id: orderId },
			buyer,
		);
		expect(completeOrder.orderStatus).toBe('COMPLETED');
		expect((completeOrder.history as { status: string }[]).map((event) => event.status)).toEqual([
			'PAID',
			'PREPARING',
			'SHIPPING',
			'DELIVERED',
			'COMPLETED',
		]);
	});

	it('sells out with the last piece and comes back on sale when that order is canceled', async () => {
		await addToCart(rival, sofa._id);
		const res = await checkout(rival, storeId);
		expect(await productState(sofa._id)).toEqual({ productStock: 0, productStatus: 'SOLD' });

		const canceled = await cancel(rival, res.data.createOrders[0]._id);
		expect(canceled.data.cancelOrder.orderStatus).toBe('CANCELED');
		expect(canceled.data.cancelOrder.canceledBy).toBe('BUYER');
		expect(canceled.data.cancelOrder.payment.refundedAt).toBeTruthy();
		expect(await productState(sofa._id)).toEqual({ productStock: 1, productStatus: 'ACTIVE' });
	});

	raceIt('gives the last piece to exactly one of two buyers checking out at the same time', async () => {
		await addToCart(buyer, sofa._id);
		await addToCart(rival, sofa._id);
		const results = await Promise.all([checkout(buyer, storeId), checkout(rival, storeId)]);
		const winners = results.filter((res) => !res.errors);
		expect(winners).toHaveLength(1);
		expect(results.find((res) => res.errors)?.errors?.[0].message).toContain('not enough left in stock');
		expect(await productState(sofa._id)).toEqual({ productStock: 0, productStatus: 'SOLD' });

		// the winner cancels: the piece is back on sale and the payment refunded
		const winnerToken = results[0].errors ? rival : buyer;
		const canceled = await cancel(winnerToken, winners[0].data.createOrders[0]._id);
		expect(canceled.data.cancelOrder.orderStatus).toBe('CANCELED');
		expect(canceled.data.cancelOrder.canceledBy).toBe('BUYER');
		expect(canceled.data.cancelOrder.payment.refundedAt).toBeTruthy();
		expect(await productState(sofa._id)).toEqual({ productStock: 1, productStatus: 'ACTIVE' });
	});

	it('reserves a used piece, holds the money, and releases it on pick-up', async () => {
		const chair = await createProduct(neighbour, {
			productCondition: 'USED',
			productTitle: 'Oak stool',
			productPrice: 40_000,
		});
		const reserve = (token: string) =>
			gql(
				`mutation ($input: ReserveInput!) { reserveProduct(input: $input) { _id orderType orderStatus orderTotal meetup { meetupPlace } payment { method } } }`,
				{ input: { productId: chair._id, meetupDate: new Date().toISOString(), payment: { method: 'KAKAO_PAY' } } },
				token,
			);

		const first = await reserve(buyer);
		expect(first.data.reserveProduct).toMatchObject({
			orderType: 'MEETUP',
			orderStatus: 'PAID',
			orderTotal: 40_000,
			meetup: { meetupPlace: 'Mapo-gu, Seoul' },
			payment: { method: 'KAKAO_PAY' },
		});
		expect((await productState(chair._id)).productStatus).toBe('RESERVED');
		expect((await reserve(rival)).errors?.[0].message).toBe('This product is no longer available!');

		const done = await ok(
			`mutation ($id: String!) { completeOrder(orderId: $id) { orderStatus } }`,
			{ id: first.data.reserveProduct._id },
			buyer,
		);
		expect(done.completeOrder.orderStatus).toBe('COMPLETED');
		expect((await productState(chair._id)).productStatus).toBe('SOLD');
	});

	it('puts the pick-up back on sale when the seller cancels the reservation', async () => {
		const lamp = await createProduct(neighbour, {
			productCondition: 'USED',
			productTitle: 'Brass lamp',
			productPrice: 30_000,
			productType: 'LIGHTING',
		});
		const { reserveProduct } = await ok(
			`mutation ($input: ReserveInput!) { reserveProduct(input: $input) { _id } }`,
			{ input: { productId: lamp._id, meetupDate: new Date().toISOString(), payment: CARD } },
			rival,
		);
		const canceled = await cancel(neighbour, reserveProduct._id);
		expect(canceled.data.cancelOrder).toMatchObject({ orderStatus: 'CANCELED', canceledBy: 'SELLER' });
		expect((await productState(lamp._id)).productStatus).toBe('ACTIVE');
	});
});
