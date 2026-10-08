import { LensLabel } from '../../libs/enums/lens.enum';
import { ProductType } from '../../libs/enums/product.enum';

export interface LensIndexItem {
	productId: string;
	label: LensLabel | null;
	type: ProductType;
	vector: ArrayLike<number>;
}

export interface LensMatch {
	productId: string;
	score: number;
}

interface Entry extends LensIndexItem {
	centered: Float32Array;
}

/**
 * In-memory nearest-neighbour index over product vectors.
 * Vectors are centred on the catalog mean first: raw backbone features all point roughly the same way,
 * centring spreads them out so cosine similarity separates "this sofa" from "any sofa".
 * Brute force is fine for a catalog of thousands; past that this is the place for a vector index.
 */
export class LensIndex {
	private readonly entries: Entry[];
	private readonly mean: Float32Array;

	constructor(items: LensIndexItem[]) {
		const dims = items[0]?.vector.length ?? 0;
		this.mean = new Float32Array(dims);
		for (const item of items) for (let d = 0; d < dims; d++) this.mean[d] += item.vector[d] / items.length;
		this.entries = items.map((item) => ({ ...item, centered: this.center(item.vector) }));
	}

	public get size(): number {
		return this.entries.length;
	}

	/** Label of the single closest product, for a region the member picked by hand. */
	public nearestLabel(vector: ArrayLike<number>): LensLabel | null {
		const query = this.center(vector);
		let best: Entry | null = null;
		let bestScore = -Infinity;
		for (const entry of this.entries) {
			const score = dot(query, entry.centered);
			if (score > bestScore) [best, bestScore] = [entry, score];
		}
		return best?.label ?? null;
	}

	/**
	 * Products with the same label first, then (when there are too few) others of the same product type.
	 * With neither known, the whole catalog is ranked.
	 */
	public rank(
		vector: ArrayLike<number>,
		label: LensLabel | null,
		type: ProductType | null,
		limit: number,
	): LensMatch[] {
		const query = this.center(vector);
		const score = (entry: Entry): LensMatch => ({ productId: entry.productId, score: dot(query, entry.centered) });
		const best = (entries: Entry[]) => entries.map(score).sort((a, b) => b.score - a.score);

		if (!label && !type) return best(this.entries).slice(0, limit);

		const same = label ? best(this.entries.filter((entry) => entry.label === label)) : [];
		if (same.length >= limit || !type) return same.slice(0, limit);

		const related = best(this.entries.filter((entry) => entry.type === type && (!label || entry.label !== label)));
		return [...same, ...related].slice(0, limit);
	}

	private center(vector: ArrayLike<number>): Float32Array {
		const centered = new Float32Array(this.mean.length);
		let norm = 0;
		for (let d = 0; d < centered.length; d++) {
			centered[d] = vector[d] - this.mean[d];
			norm += centered[d] * centered[d];
		}
		norm = Math.sqrt(norm) || 1;
		for (let d = 0; d < centered.length; d++) centered[d] /= norm;
		return centered;
	}
}

/** Label a seller gave the product in its title, if any. */
export const labelFromTitle = (title: string, keywords: [LensLabel, RegExp][]): LensLabel | null => {
	return keywords.find(([, pattern]) => pattern.test(title))?.[0] ?? null;
};

const dot = (a: Float32Array, b: Float32Array): number => {
	let sum = 0;
	for (let d = 0; d < a.length; d++) sum += a[d] * b[d];
	return sum;
};
