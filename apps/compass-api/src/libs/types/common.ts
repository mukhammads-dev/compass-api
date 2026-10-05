import type { Types } from 'mongoose';

/** Id of a stored document. (mongoose's own `ObjectId` export is the schema type, not the id value.) */
export type ObjectId = Types.ObjectId;

/** Dynamic object shape. Use only for truly dynamic objects such as Mongo match/sort stages. */
export interface T {
	[key: string]: any;
}

export interface StatisticModifier {
	_id: ObjectId;
	targetKey: string;
	modifier: number;
}

/** Shape of a file received through graphql-upload. */
export interface FileUpload {
	filename: string;
	mimetype: string;
	encoding: string;
	createReadStream: () => NodeJS.ReadableStream;
}

/**
 * What graphql-upload passes to a resolver: a promise of the file.
 * Declared as an interface on purpose: decorator metadata then reports `Object`, so the global
 * ValidationPipe (transform: true) skips it. Typed as `Promise<FileUpload>` the pipe would call
 * `new Promise()` on it and fail with "Promise resolver undefined is not a function".
 */
export interface UploadPromise extends Promise<FileUpload> {
	readonly [Symbol.toStringTag]: string;
}
