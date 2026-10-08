import type { LensLabel } from '../enums/lens.enum';

/** A region of a photo, all values 0..1 of the photo's width / height. */
export interface LensBox {
	x: number;
	y: number;
	w: number;
	h: number;
}

/** One thing the detector found in a photo. */
export interface LensDetection {
	label: LensLabel;
	score: number;
	box: LensBox;
}
