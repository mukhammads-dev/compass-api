import { LENS_TITLE_KEYWORDS } from '../../libs/config';
import { LensLabel } from '../../libs/enums/lens.enum';
import { ProductType } from '../../libs/enums/product.enum';
import { LensIndex, labelFromTitle } from './lens.matcher';

const item = (productId: string, label: LensLabel | null, type: ProductType, vector: number[]) => ({
	productId,
	label,
	type,
	vector,
});

describe('LensIndex', () => {
	const index = new LensIndex([
		item('sofa-grey', LensLabel.SOFA, ProductType.FURNITURE, [1, 0, 0, 0]),
		item('sofa-green', LensLabel.SOFA, ProductType.FURNITURE, [0.6, 0.8, 0, 0]),
		item('chair', LensLabel.CHAIR, ProductType.FURNITURE, [0.9, 0.1, 0.1, 0]),
		item('lamp', LensLabel.FLOOR_LAMP, ProductType.LIGHTING, [0, 0, 1, 0]),
		item('rug', LensLabel.RUG, ProductType.TEXTILE, [0, 0, 0, 1]),
	]);

	it('ranks products with the same label first, closest first', () => {
		const ranked = index.rank([0.62, 0.78, 0, 0], LensLabel.SOFA, ProductType.FURNITURE, 3);
		expect(ranked.map((match) => match.productId)).toEqual(['sofa-green', 'sofa-grey', 'chair']);
	});

	it('fills up with the same product type, never with other types', () => {
		const ranked = index.rank([0.9, 0.1, 0.1, 0], LensLabel.ARMCHAIR, ProductType.FURNITURE, 5);
		expect(ranked.map((match) => match.productId).sort()).toEqual(['chair', 'sofa-green', 'sofa-grey']);
	});

	it('returns nothing for a label and type the catalog does not have', () => {
		expect(index.rank([0, 1, 0, 0], LensLabel.MIRROR, ProductType.DECOR, 4)).toEqual([]);
	});

	it('names a hand-picked region after its closest product', () => {
		expect(index.nearestLabel([0, 0, 0.9, 0.1])).toBe(LensLabel.FLOOR_LAMP);
	});

	it('is safe to use before any product is indexed', () => {
		const empty = new LensIndex([]);
		expect(empty.size).toBe(0);
		expect(empty.rank([1, 0], LensLabel.SOFA, ProductType.FURNITURE, 4)).toEqual([]);
		expect(empty.nearestLabel([1, 0])).toBeNull();
	});
});

describe('labelFromTitle', () => {
	it.each([
		['Walnut coffee table', LensLabel.COFFEE_TABLE],
		['Oak dining table for 4', LensLabel.DINING_TABLE],
		['Boucle lounge chair', LensLabel.ARMCHAIR],
		['3-seat fabric sofa', LensLabel.SOFA],
		['원목 식탁 의자', LensLabel.DINING_TABLE],
		['Arch standing mirror', LensLabel.MIRROR],
		['Brass floor lamp', LensLabel.FLOOR_LAMP],
		['A glowing bulb lamp', LensLabel.PENDANT_LAMP],
		['Hand-woven wool rug', LensLabel.RUG],
		['Linen sheer curtain', LensLabel.CURTAIN],
	])('%s -> %s', (title, label) => {
		expect(labelFromTitle(title, LENS_TITLE_KEYWORDS)).toBe(label);
	});

	it('gives up on titles that do not say what the product is', () => {
		expect(labelFromTitle('Spring collection no.3', LENS_TITLE_KEYWORDS)).toBeNull();
	});
});
