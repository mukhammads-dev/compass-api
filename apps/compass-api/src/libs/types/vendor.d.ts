/**
 * Type declarations for the two runtime packages that ship without types
 * (bcryptjs 2.x and graphql-upload 13.x). Only the parts this API uses are declared.
 */

declare module 'bcryptjs' {
	export function genSalt(rounds?: number): Promise<string>;
	export function hash(value: string, salt: string | number): Promise<string>;
	export function compare(value: string, hashed: string): Promise<boolean>;
}

declare module 'graphql-upload' {
	import type { RequestHandler } from 'express';
	import type { GraphQLScalarType } from 'graphql';

	export interface UploadOptions {
		maxFieldSize?: number;
		maxFileSize?: number;
		maxFiles?: number;
	}

	export function graphqlUploadExpress(options?: UploadOptions): RequestHandler;
	export const GraphQLUpload: GraphQLScalarType;
}
