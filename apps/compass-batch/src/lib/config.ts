export const BATCH_ROLLBACK = 'BATCH_ROLLBACK';
export const BATCH_TOP_AGENTS = 'BATCH_TOP_AGENTS';
export const BATCH_TOP_PRODUCTS = 'BATCH_TOP_PRODUCTS';
export const BATCH_TOP_ROOM_TOURS = 'BATCH_TOP_ROOM_TOURS';
export const BATCH_LENS_CLEANUP = 'BATCH_LENS_CLEANUP';

/** Room Tours newer than this get a freshness boost in the weekly ranking. */
export const ROOM_TOUR_FRESH_DAYS = 7;

/** Photos uploaded to Compass Lens are only needed while the member looks at the results. */
export const LENS_PHOTO_TTL_HOURS = 24;
