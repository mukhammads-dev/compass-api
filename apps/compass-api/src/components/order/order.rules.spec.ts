import { Types } from 'mongoose';
import { ASSEMBLY_FEE, STAIRS_FEE_PER_FLOOR, TEST_DECLINED_CARD } from '../../libs/config';
import { Message } from '../../libs/enums/common.enum';
import { OrderActor, OrderStatus, OrderType, PaymentMethod } from '../../libs/enums/order.enum';
import {
	assemblyFeeOf,
	canBuyerComplete,
	canCancel,
	canSellerMoveTo,
	cardBrandOf,
	deliveryWindow,
	isDeliveryDateAllowed,
	isLuhnValid,
	isMeetupDateAllowed,
	kstDay,
	kstNoon,
	makeOrderNo,
	PricedLine,
	priceStoreOrder,
	simulatePayment,
	stairsFeeOf,
	unitPriceOf,
} from './order.rules';

const line = (unitPrice: number, quantity: number, deliveryFee: number, assembly = false): PricedLine => ({
	productId: new Types.ObjectId(),
	productTitle: 'Sofa',
	productImage: 'uploads/product/a.jpg',
	productWidth: 200,
	productDepth: 90,
	productHeight: 80,
	unitPrice,
	quantity,
	assembly,
	assemblyFee: assemblyFeeOf(assembly, quantity),
	deliveryFee,
});

/** 2026-10-09 is a Friday; 10:00 KST. */
const NOW = new Date('2026-10-09T01:00:00Z');
const kstDate = (iso: string) => new Date(`${iso}T12:00:00+09:00`);

describe('prices', () => {
	it('uses the sale price only when it is a real discount', () => {
		expect(unitPriceOf({ productPrice: 100, productSalePrice: 80 })).toBe(80);
		expect(unitPriceOf({ productPrice: 100, productSalePrice: 120 })).toBe(100);
		expect(unitPriceOf({ productPrice: 100, productSalePrice: 0 })).toBe(100);
		expect(unitPriceOf({ productPrice: 100 })).toBe(100);
	});

	it('charges one truck per store: the highest delivery fee, not the sum', () => {
		const price = priceStoreOrder([line(300_000, 1, 30_000), line(50_000, 2, 5_000)], 1, true);
		expect(price).toEqual({
			itemsTotal: 400_000,
			deliveryFee: 30_000,
			assemblyTotal: 0,
			stairsFee: 0,
			orderTotal: 430_000,
		});
	});

	it('adds assembly per unit and stairs once per delivery', () => {
		const price = priceStoreOrder([line(100_000, 2, 0, true)], 5, false);
		expect(price.assemblyTotal).toBe(2 * ASSEMBLY_FEE);
		expect(price.stairsFee).toBe(3 * STAIRS_FEE_PER_FLOOR);
		expect(price.orderTotal).toBe(200_000 + 2 * ASSEMBLY_FEE + 3 * STAIRS_FEE_PER_FLOOR);
	});

	it('carries for free with a lift or up to the 2nd floor', () => {
		expect(stairsFeeOf(10, true)).toBe(0);
		expect(stairsFeeOf(2, false)).toBe(0);
		expect(stairsFeeOf(3, false)).toBe(STAIRS_FEE_PER_FLOOR);
	});
});

describe('dates (Korea time)', () => {
	it('treats a day as a KST calendar day', () => {
		// 23:30 KST on the 9th is still the 9th, 00:30 KST is already the 10th
		expect(kstDay(new Date('2026-10-09T14:30:00Z'))).toBe(kstDay(kstDate('2026-10-09')));
		expect(kstDay(new Date('2026-10-09T15:30:00Z'))).toBe(kstDay(kstDate('2026-10-10')));
		expect(kstNoon(kstDay(kstDate('2026-10-12'))).toISOString()).toBe('2026-10-12T03:00:00.000Z');
	});

	it('books deliveries 3 to 30 days ahead, never on Sunday', () => {
		expect(isDeliveryDateAllowed(kstDate('2026-10-11'), NOW)).toBe(false); // too soon
		expect(isDeliveryDateAllowed(kstDate('2026-10-12'), NOW)).toBe(true); // Monday, +3
		expect(isDeliveryDateAllowed(kstDate('2026-10-18'), NOW)).toBe(false); // Sunday
		expect(isDeliveryDateAllowed(kstDate('2026-11-07'), NOW)).toBe(true); // Saturday, +29
		expect(isDeliveryDateAllowed(kstDate('2026-11-08'), NOW)).toBe(false); // +30 but Sunday
		expect(isDeliveryDateAllowed(kstDate('2026-11-09'), NOW)).toBe(false); // +31
		expect(isDeliveryDateAllowed(new Date('nope'), NOW)).toBe(false);
	});

	it('moves the window edges off Sundays', () => {
		const saturday = new Date('2026-10-08T01:00:00Z'); // Thursday → +3 is Sunday the 11th
		expect(deliveryWindow(saturday).earliest.toISOString()).toBe(kstDate('2026-10-12').toISOString());
	});

	it('allows a pick-up from today up to 14 days', () => {
		expect(isMeetupDateAllowed(kstDate('2026-10-09'), NOW)).toBe(true);
		expect(isMeetupDateAllowed(kstDate('2026-10-08'), NOW)).toBe(false);
		expect(isMeetupDateAllowed(kstDate('2026-10-23'), NOW)).toBe(true);
		expect(isMeetupDateAllowed(kstDate('2026-10-24'), NOW)).toBe(false);
	});
});

describe('status changes', () => {
	it('lets a store move a delivery forward one step at a time', () => {
		expect(canSellerMoveTo(OrderType.DELIVERY, OrderStatus.PAID, OrderStatus.PREPARING)).toBe(true);
		expect(canSellerMoveTo(OrderType.DELIVERY, OrderStatus.PREPARING, OrderStatus.SHIPPING)).toBe(true);
		expect(canSellerMoveTo(OrderType.DELIVERY, OrderStatus.SHIPPING, OrderStatus.DELIVERED)).toBe(true);
		expect(canSellerMoveTo(OrderType.DELIVERY, OrderStatus.PAID, OrderStatus.SHIPPING)).toBe(false);
		expect(canSellerMoveTo(OrderType.DELIVERY, OrderStatus.DELIVERED, OrderStatus.COMPLETED)).toBe(false);
		expect(canSellerMoveTo(OrderType.MEETUP, OrderStatus.PAID, OrderStatus.PREPARING)).toBe(false);
	});

	it('closes cancellation once the goods are on their way', () => {
		expect(canCancel(OrderType.DELIVERY, OrderStatus.PAID, OrderActor.BUYER)).toBe(true);
		expect(canCancel(OrderType.DELIVERY, OrderStatus.PREPARING, OrderActor.BUYER)).toBe(false);
		expect(canCancel(OrderType.DELIVERY, OrderStatus.PREPARING, OrderActor.SELLER)).toBe(true);
		expect(canCancel(OrderType.DELIVERY, OrderStatus.SHIPPING, OrderActor.SELLER)).toBe(false);
		expect(canCancel(OrderType.DELIVERY, OrderStatus.SHIPPING, OrderActor.ADMIN)).toBe(true);
		expect(canCancel(OrderType.MEETUP, OrderStatus.PAID, OrderActor.SELLER)).toBe(true);
		expect(canCancel(OrderType.MEETUP, OrderStatus.COMPLETED, OrderActor.ADMIN)).toBe(false);
		expect(canCancel(OrderType.DELIVERY, OrderStatus.CANCELED, OrderActor.ADMIN)).toBe(false);
	});

	it('lets the buyer confirm a delivery, or a pick-up while the money is held', () => {
		expect(canBuyerComplete(OrderType.DELIVERY, OrderStatus.DELIVERED)).toBe(true);
		expect(canBuyerComplete(OrderType.DELIVERY, OrderStatus.SHIPPING)).toBe(false);
		expect(canBuyerComplete(OrderType.MEETUP, OrderStatus.PAID)).toBe(true);
		expect(canBuyerComplete(OrderType.MEETUP, OrderStatus.CANCELED)).toBe(false);
	});
});

describe('simulated payment', () => {
	const card = {
		method: PaymentMethod.CARD,
		cardNumber: '4242 4242 4242 4242',
		cardExpiry: '12/29',
		cardHolder: 'Kim Minji',
	};

	it('approves a valid card and keeps only its last 4 digits', () => {
		const payment = simulatePayment(card, 50_000, NOW);
		expect(payment).toMatchObject({ method: PaymentMethod.CARD, amount: 50_000, cardBrand: 'Visa', cardLast4: '4242' });
		expect(payment.approvalNo).toMatch(/^\d{8}$/);
		expect(JSON.stringify(payment)).not.toContain('4242424242424242');
	});

	it('rejects a wrong number, an expired card, or a missing holder', () => {
		expect(() => simulatePayment({ ...card, cardNumber: '4242 4242 4242 4241' }, 1, NOW)).toThrow(Message.INVALID_CARD);
		expect(() => simulatePayment({ ...card, cardExpiry: '09/26' }, 1, NOW)).toThrow(Message.INVALID_CARD);
		expect(() => simulatePayment({ ...card, cardExpiry: '10/26' }, 1, NOW)).not.toThrow();
		expect(() => simulatePayment({ ...card, cardHolder: ' ' }, 1, NOW)).toThrow(Message.INVALID_CARD);
	});

	it('always declines the test card', () => {
		expect(() => simulatePayment({ ...card, cardNumber: TEST_DECLINED_CARD }, 1, NOW)).toThrow(
			Message.PAYMENT_DECLINED,
		);
	});

	it('approves wallets and bank transfer without card data', () => {
		expect(simulatePayment({ method: PaymentMethod.KAKAO_PAY }, 9, NOW).cardLast4).toBeUndefined();
		expect(simulatePayment({ method: PaymentMethod.BANK_TRANSFER }, 9, NOW).amount).toBe(9);
	});

	it('knows the card networks', () => {
		expect(isLuhnValid('5555555555554444')).toBe(true);
		expect(cardBrandOf('5555555555554444')).toBe('Mastercard');
		expect(cardBrandOf('378282246310005')).toBe('Amex');
	});
});

describe('order numbers', () => {
	it('start with the KST date and are hard to guess', () => {
		const late = new Date('2026-10-09T16:00:00Z'); // already the 10th in Korea
		expect(makeOrderNo(late)).toMatch(/^CP261010-[2-9A-Z]{6}$/);
		expect(new Set(Array.from({ length: 50 }, () => makeOrderNo(NOW))).size).toBe(50);
	});
});
