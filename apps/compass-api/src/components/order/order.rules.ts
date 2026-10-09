import { randomBytes, randomInt } from 'crypto';
import {
	ASSEMBLY_FEE,
	DELIVERY_MAX_DAYS,
	DELIVERY_MIN_DAYS,
	MEETUP_MAX_DAYS,
	STAIRS_FEE_PER_FLOOR,
	STAIRS_FREE_FLOORS,
	TEST_DECLINED_CARD,
} from '../../libs/config';
import { Message } from '../../libs/enums/common.enum';
import type { ObjectId } from '../../libs/types/common';
import { OrderActor, OrderStatus, OrderType, PaymentMethod } from '../../libs/enums/order.enum';

/**
 * Pure order rules: prices, dates, status changes and the simulated payment.
 * No database here, so every rule is unit tested (order.rules.spec.ts) and the quote shown at checkout
 * is computed by exactly the same code that charges the order.
 */

/* ------------------------------------------------------------------ */
/*  Prices                                                            */
/* ------------------------------------------------------------------ */

export interface PricedLine {
	productId: ObjectId;
	productTitle: string;
	productImage: string;
	productWidth: number;
	productDepth: number;
	productHeight: number;
	unitPrice: number;
	quantity: number;
	assembly: boolean;
	assemblyFee: number;
	/** the store's delivery fee for this product */
	deliveryFee: number;
}

export interface PriceBreakdown {
	itemsTotal: number;
	deliveryFee: number;
	assemblyTotal: number;
	stairsFee: number;
	orderTotal: number;
}

/** Sale price when it is a real discount, otherwise the list price. */
export const unitPriceOf = (product: { productPrice: number; productSalePrice?: number | null }): number =>
	product.productSalePrice && product.productSalePrice > 0 && product.productSalePrice < product.productPrice
		? product.productSalePrice
		: product.productPrice;

export const assemblyFeeOf = (assembly: boolean, quantity: number): number => (assembly ? ASSEMBLY_FEE * quantity : 0);

/** Carrying furniture up the stairs: free up to STAIRS_FREE_FLOORS, then per floor. Lifts make it free. */
export const stairsFeeOf = (floor: number, elevator: boolean): number =>
	elevator ? 0 : Math.max(0, floor - STAIRS_FREE_FLOORS) * STAIRS_FEE_PER_FLOOR;

/**
 * One store = one truck: its delivery fee is the highest fee among the pieces, not their sum.
 * The stairs fee is charged once per truck.
 */
export const priceStoreOrder = (lines: PricedLine[], floor: number, elevator: boolean): PriceBreakdown => {
	const itemsTotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
	const assemblyTotal = lines.reduce((sum, line) => sum + line.assemblyFee, 0);
	const deliveryFee = lines.reduce((max, line) => Math.max(max, line.deliveryFee), 0);
	const stairsFee = lines.length ? stairsFeeOf(floor, elevator) : 0;
	return {
		itemsTotal,
		deliveryFee,
		assemblyTotal,
		stairsFee,
		orderTotal: itemsTotal + deliveryFee + assemblyTotal + stairsFee,
	};
};

/* ------------------------------------------------------------------ */
/*  Dates (Korea time: a "day" is a KST calendar day)                 */
/* ------------------------------------------------------------------ */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Days since epoch in KST. */
export const kstDay = (date: Date): number => Math.floor((date.getTime() + KST_OFFSET_MS) / DAY_MS);

/** Noon KST of a KST day number: a safe instant to store for "that day". */
export const kstNoon = (day: number): Date => new Date(day * DAY_MS - KST_OFFSET_MS + 12 * 60 * 60 * 1000);

const isSunday = (day: number): boolean => new Date(day * DAY_MS).getUTCDay() === 0;

/** Furniture trucks run Monday to Saturday, from DELIVERY_MIN_DAYS to DELIVERY_MAX_DAYS ahead. */
export const deliveryWindow = (now: Date): { earliest: Date; latest: Date } => {
	const today = kstDay(now);
	let first = today + DELIVERY_MIN_DAYS;
	while (isSunday(first)) first++;
	let last = today + DELIVERY_MAX_DAYS;
	while (isSunday(last)) last--;
	return { earliest: kstNoon(first), latest: kstNoon(last) };
};

export const isDeliveryDateAllowed = (date: Date, now: Date): boolean => {
	if (!(date instanceof Date) || Number.isNaN(date.getTime())) return false;
	const day = kstDay(date);
	const today = kstDay(now);
	return day >= today + DELIVERY_MIN_DAYS && day <= today + DELIVERY_MAX_DAYS && !isSunday(day);
};

/** A pick-up can be any day from today to MEETUP_MAX_DAYS ahead. */
export const isMeetupDateAllowed = (date: Date, now: Date): boolean => {
	if (!(date instanceof Date) || Number.isNaN(date.getTime())) return false;
	const day = kstDay(date);
	const today = kstDay(now);
	return day >= today && day <= today + MEETUP_MAX_DAYS;
};

/* ------------------------------------------------------------------ */
/*  Status changes                                                    */
/* ------------------------------------------------------------------ */

/** Next steps a seller may take on a DELIVERY order. MEETUP orders move only by the buyer's confirmation. */
const SELLER_STEPS: Partial<Record<OrderStatus, OrderStatus>> = {
	[OrderStatus.PAID]: OrderStatus.PREPARING,
	[OrderStatus.PREPARING]: OrderStatus.SHIPPING,
	[OrderStatus.SHIPPING]: OrderStatus.DELIVERED,
};

export const canSellerMoveTo = (type: OrderType, from: OrderStatus, to: OrderStatus): boolean =>
	type === OrderType.DELIVERY && SELLER_STEPS[from] === to;

/**
 * Who may cancel, and until when:
 * - buyer: until the store starts preparing (DELIVERY) / until the pick-up is confirmed (MEETUP)
 * - seller: until the truck leaves (DELIVERY) / until the pick-up is confirmed (MEETUP)
 * - admin: anything that is not finished yet
 */
export const canCancel = (type: OrderType, status: OrderStatus, actor: OrderActor): boolean => {
	if (status === OrderStatus.CANCELED || status === OrderStatus.COMPLETED) return false;
	if (actor === OrderActor.ADMIN || actor === OrderActor.SYSTEM) return status !== OrderStatus.DELIVERED;
	if (type === OrderType.MEETUP) return status === OrderStatus.PAID;
	if (actor === OrderActor.BUYER) return status === OrderStatus.PAID;
	return status === OrderStatus.PAID || status === OrderStatus.PREPARING;
};

/** Buyer closes the order: after delivery, or after picking a used item up (this releases the held money). */
export const canBuyerComplete = (type: OrderType, status: OrderStatus): boolean =>
	type === OrderType.DELIVERY ? status === OrderStatus.DELIVERED : status === OrderStatus.PAID;

/* ------------------------------------------------------------------ */
/*  Simulated payment                                                 */
/* ------------------------------------------------------------------ */

export interface PaymentRequest {
	method: PaymentMethod;
	cardNumber?: string;
	cardExpiry?: string;
	cardHolder?: string;
}

export interface PaymentRecord {
	method: PaymentMethod;
	amount: number;
	approvalNo: string;
	cardBrand?: string;
	cardLast4?: string;
	paidAt: Date;
}

export class PaymentError extends Error {}

/** Standard Luhn checksum used by every card network. */
export const isLuhnValid = (digits: string): boolean => {
	let sum = 0;
	for (let i = 0; i < digits.length; i++) {
		let digit = Number(digits[digits.length - 1 - i]);
		if (i % 2 === 1) {
			digit *= 2;
			if (digit > 9) digit -= 9;
		}
		sum += digit;
	}
	return digits.length >= 15 && sum % 10 === 0;
};

export const cardBrandOf = (digits: string): string => {
	if (/^4/.test(digits)) return 'Visa';
	if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard';
	if (/^3[47]/.test(digits)) return 'Amex';
	if (/^9/.test(digits)) return 'Local';
	return 'Card';
};

const isExpired = (expiry: string, now: Date): boolean => {
	const [month, year] = expiry.split('/').map(Number);
	const lastValidMonth = new Date(Date.UTC(2000 + year, month, 1)); // first day after the expiry month
	return lastValidMonth.getTime() <= now.getTime();
};

/**
 * Stands in for a payment gateway. Card payments are validated like a real one would
 * (Luhn, expiry, holder), TEST_DECLINED_CARD is always declined; wallets and bank transfer always pass.
 */
export const simulatePayment = (request: PaymentRequest, amount: number, now: Date): PaymentRecord => {
	const approvalNo = String(randomInt(10_000_000, 99_999_999));
	if (request.method !== PaymentMethod.CARD) return { method: request.method, amount, approvalNo, paidAt: now };

	const digits = (request.cardNumber ?? '').replace(/\D/g, '');
	if (
		!isLuhnValid(digits) ||
		!request.cardExpiry ||
		isExpired(request.cardExpiry, now) ||
		!request.cardHolder?.trim()
	) {
		throw new PaymentError(Message.INVALID_CARD);
	}
	if (digits === TEST_DECLINED_CARD) throw new PaymentError(Message.PAYMENT_DECLINED);

	return {
		method: request.method,
		amount,
		approvalNo,
		cardBrand: cardBrandOf(digits),
		cardLast4: digits.slice(-4),
		paidAt: now,
	};
};

/* ------------------------------------------------------------------ */
/*  Identifiers                                                       */
/* ------------------------------------------------------------------ */

/** Human-friendly order number, e.g. CP261009-4K7Q2M (date in KST + 6 random characters). */
export const makeOrderNo = (now: Date): string => {
	const kst = new Date(now.getTime() + KST_OFFSET_MS);
	const date = kst.toISOString().slice(2, 10).replace(/-/g, '');
	const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
	const random = Array.from(randomBytes(6), (byte) => alphabet[byte % alphabet.length]).join('');
	return `CP${date}-${random}`;
};

export const makeCheckoutId = (): string => randomBytes(12).toString('hex');
