import { registerEnumType } from '@nestjs/graphql';

/**
 * What Compass Lens can find in a room photo.
 * The order is the class order the detector was exported with (models/lens/export.py): do not reorder.
 */
export enum LensLabel {
	SOFA = 'SOFA',
	ARMCHAIR = 'ARMCHAIR',
	CHAIR = 'CHAIR',
	DINING_TABLE = 'DINING_TABLE',
	COFFEE_TABLE = 'COFFEE_TABLE',
	SIDE_TABLE = 'SIDE_TABLE',
	DESK = 'DESK',
	BED = 'BED',
	FLOOR_LAMP = 'FLOOR_LAMP',
	TABLE_LAMP = 'TABLE_LAMP',
	PENDANT_LAMP = 'PENDANT_LAMP',
	RUG = 'RUG',
	SHELF = 'SHELF',
	CABINET = 'CABINET',
	DRESSER = 'DRESSER',
	MIRROR = 'MIRROR',
	PLANT = 'PLANT',
	VASE = 'VASE',
	CUSHION = 'CUSHION',
	CURTAIN = 'CURTAIN',
	STOOL = 'STOOL',
	BENCH = 'BENCH',
	TV_STAND = 'TV_STAND',
	WALL_ART = 'WALL_ART',
}
registerEnumType(LensLabel, { name: 'LensLabel' });
