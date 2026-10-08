import {
	BadRequestException,
	Injectable,
	Logger,
	NotFoundException,
	OnModuleInit,
	ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { Model } from 'mongoose';
import type { FileUpload, ObjectId } from '../../libs/types/common';
import type { LensBox, LensDetection } from '../../libs/types/lens';
import {
	errorMessage,
	LENS_INDEX_TTL_MS,
	LENS_LABEL_TYPE,
	LENS_MATCH_LIMIT,
	LENS_MAX_CONCURRENT,
	LENS_MAX_FINDS,
	LENS_TITLE_KEYWORDS,
	LENS_UPLOAD_DIR,
	lookupAuthMemberLiked,
	lookupMember,
	shapeIntoMongoObjectId,
	validMimeTypes,
} from '../../libs/config';
import { LensFind, LensResult } from '../../libs/dto/lens/lens';
import { LensRegionInput } from '../../libs/dto/lens/lens.input';
import { Product } from '../../libs/dto/product/product';
import { Message } from '../../libs/enums/common.enum';
import { LensLabel } from '../../libs/enums/lens.enum';
import { ProductStatus, ProductType } from '../../libs/enums/product.enum';
import { LensIndex, LensIndexItem, labelFromTitle } from './lens.matcher';
import { RawImage, VisionService } from './vision.service';

interface ProductVectorDoc {
	productId: ObjectId;
	vectorImage: string;
	vectorLabel?: LensLabel;
	vectorData: number[];
}

/** A find before its products are loaded. */
type PendingFind = Omit<LensFind, 'products'> & { productIds: string[] };

@Injectable()
export class LensService implements OnModuleInit {
	private readonly logger = new Logger(LensService.name);
	private index = new LensIndex([]);
	private indexedAt = 0;
	private syncing: Promise<void> | null = null;
	private running = 0;
	private readonly waiting: (() => void)[] = [];

	constructor(
		@InjectModel('Product') private readonly productModel: Model<Product>,
		@InjectModel('ProductVector') private readonly productVectorModel: Model<ProductVectorDoc>,
		private readonly visionService: VisionService,
	) {}

	/** Build the index in the background, so the first search does not wait for every product. */
	public onModuleInit(): void {
		this.ensureIndex().catch((err) => this.logger.warn(`Lens index not built yet: ${errorMessage(err)}`));
	}

	/* ------------------------------------------------------------------ */
	/*  SEARCH                                                            */
	/* ------------------------------------------------------------------ */

	/** Stores the photo, finds what is in it and the closest products for each find. */
	public async lensSearch(memberId: ObjectId | null, file: FileUpload): Promise<LensResult> {
		await this.prepare();
		const photo = await this.storePhoto(file);

		const pending = await this.withSlot(async () => {
			const image = await this.visionService.decode(photo);
			const detections = (await this.visionService.detect(image)).slice(0, LENS_MAX_FINDS);
			const vectors = await this.visionService.embed(
				image,
				detections.map((detection) => detection.box),
			);
			return detections.map((d, i) => this.toFind(d.label, d.score, d.box, vectors[i]));
		});

		return { image: photo, finds: await this.attachProducts(memberId, pending) };
	}

	/** Closest products for a spot the member tapped on a stored photo. */
	public async lensRegion(memberId: ObjectId | null, input: LensRegionInput): Promise<LensFind> {
		if (!existsSync(input.image)) throw new NotFoundException(Message.NO_DATA_FOUND);
		const box: LensBox = {
			x: input.x,
			y: input.y,
			w: Math.min(input.w, 1 - input.x),
			h: Math.min(input.h, 1 - input.y),
		};

		const pending = await this.withSlot(async () => {
			await this.prepare();
			const image = await this.visionService.decode(input.image);
			const [vector] = await this.visionService.embed(image, [box]);
			return this.toFind(this.index.nearestLabel(vector), 1, box, vector);
		});

		const [find] = await this.attachProducts(memberId, [pending]);
		return find;
	}

	private toFind(label: LensLabel | null, score: number, box: LensBox, vector: Float32Array): PendingFind {
		const productType = label ? LENS_LABEL_TYPE[label] : null;
		const matches = this.index.rank(vector, label, productType, LENS_MATCH_LIMIT);
		return {
			label: label ?? undefined,
			productType: productType ?? undefined,
			score,
			...box,
			productIds: matches.map((match) => match.productId),
		};
	}

	/** One query for every product in every find, then back into each find's order. */
	private async attachProducts(memberId: ObjectId | null, finds: PendingFind[]): Promise<LensFind[]> {
		const ids = [...new Set(finds.flatMap((find) => find.productIds))].map((id) => shapeIntoMongoObjectId(id));
		const products = ids.length
			? await this.productModel
					.aggregate<Product>([
						{ $match: { _id: { $in: ids }, productStatus: ProductStatus.ACTIVE } },
						lookupAuthMemberLiked(memberId),
						lookupMember,
						{ $unwind: '$memberData' },
					])
					.exec()
			: [];
		const byId = new Map(products.map((product) => [String(product._id), product]));

		return finds.map(({ productIds, ...find }) => ({
			...find,
			products: productIds.map((id) => byId.get(id)).filter((product): product is Product => Boolean(product)),
		}));
	}

	/* ------------------------------------------------------------------ */
	/*  PHOTO                                                             */
	/* ------------------------------------------------------------------ */

	/** Stored re-encoded (see VisionService.normalizePhoto), never as uploaded. */
	private async storePhoto(file: FileUpload): Promise<string> {
		if (!file?.filename) throw new BadRequestException(Message.UPLOAD_FAILED);
		if (!validMimeTypes.includes(file.mimetype)) throw new BadRequestException(Message.PROVIDE_ALLOWED_FORMAT);

		try {
			const original = await readStream(file.createReadStream());
			const photo = await this.visionService.normalizePhoto(original);

			await mkdir(LENS_UPLOAD_DIR, { recursive: true });
			const url = `${LENS_UPLOAD_DIR}/${randomUUID()}.jpg`;
			await writeFile(url, photo);
			return url;
		} catch (err) {
			this.logger.error(`storePhoto: ${errorMessage(err)}`);
			throw new BadRequestException(Message.UPLOAD_FAILED);
		}
	}

	/* ------------------------------------------------------------------ */
	/*  INDEX                                                             */
	/* ------------------------------------------------------------------ */

	private async prepare(): Promise<void> {
		try {
			await this.visionService.ready();
			await this.ensureIndex();
		} catch (err) {
			this.logger.error(`Lens unavailable: ${errorMessage(err)}`);
			throw new ServiceUnavailableException(Message.LENS_UNAVAILABLE);
		}
	}

	/** Re-syncs at most once per LENS_INDEX_TTL_MS; concurrent callers share one sync. */
	private async ensureIndex(): Promise<void> {
		if (Date.now() - this.indexedAt < LENS_INDEX_TTL_MS) return;
		this.syncing ??= this.syncIndex().finally(() => (this.syncing = null));
		await this.syncing;
	}

	/** Vectors for new products, or products whose first image changed, are made here and saved. */
	private async syncIndex(): Promise<void> {
		const products = await this.productModel
			.find({ productStatus: ProductStatus.ACTIVE })
			.select('productTitle productType productImages')
			.lean()
			.exec();
		const stored = await this.productVectorModel
			.find({ productId: { $in: products.map((product) => product._id) } })
			.lean()
			.exec();
		const storedById = new Map(stored.map((doc) => [String(doc.productId), doc]));

		const items: LensIndexItem[] = [];
		let created = 0;
		for (const product of products) {
			const image = product.productImages?.[0];
			if (!image) continue;

			let doc: ProductVectorDoc | null = storedById.get(String(product._id)) ?? null;
			if (!doc || doc.vectorImage !== image) {
				doc = await this.createVector(product._id, product.productTitle, product.productType, image);
				if (!doc) continue;
				created++;
			}
			items.push({
				productId: String(product._id),
				label: doc.vectorLabel ?? null,
				type: product.productType,
				vector: doc.vectorData,
			});
		}

		this.index = new LensIndex(items);
		this.indexedAt = Date.now();
		if (created) this.logger.log(`Lens index: ${items.length} products (${created} new vectors)`);
	}

	/**
	 * The product's main object is cropped before embedding, so a sofa photographed in a full room
	 * is compared as a sofa, not as a room.
	 */
	private async createVector(
		productId: ObjectId,
		title: string,
		type: ProductType,
		image: string,
	): Promise<ProductVectorDoc | null> {
		if (!existsSync(image)) {
			this.logger.warn(`Lens: image missing for product ${String(productId)}: ${image}`);
			return null;
		}

		try {
			const raw = await this.visionService.decode(image);
			const main = await this.mainObject(raw, type);
			const label = labelFromTitle(title, LENS_TITLE_KEYWORDS) ?? main?.label ?? null;
			const [vector] = await this.visionService.embed(raw, main ? [main.box] : undefined);

			const doc: ProductVectorDoc = {
				productId,
				vectorImage: image,
				vectorLabel: label ?? undefined,
				vectorData: Array.from(vector),
			};
			await this.productVectorModel.updateOne({ productId }, { $set: doc }, { upsert: true }).exec();
			return doc;
		} catch (err) {
			this.logger.warn(`Lens: could not index product ${String(productId)}: ${errorMessage(err)}`);
			return null;
		}
	}

	/**
	 * Largest confident find that fits the product's type: a lamp photographed next to a sofa is the lamp.
	 * When nothing fits, the whole photo is used.
	 */
	private async mainObject(raw: RawImage, type: ProductType): Promise<LensDetection | null> {
		const weight = (d: LensDetection) => d.score * Math.sqrt(d.box.w * d.box.h);
		return (await this.visionService.detect(raw))
			.filter((d) => LENS_LABEL_TYPE[d.label] === type)
			.reduce<LensDetection | null>((best, d) => (!best || weight(d) > weight(best) ? d : best), null);
	}

	/* ------------------------------------------------------------------ */
	/*  CONCURRENCY                                                       */
	/* ------------------------------------------------------------------ */

	/** Model runs are CPU heavy: at most LENS_MAX_CONCURRENT at once, the rest wait their turn. */
	private async withSlot<R>(task: () => Promise<R>): Promise<R> {
		if (this.running < LENS_MAX_CONCURRENT) this.running++;
		else await new Promise<void>((resolve) => this.waiting.push(resolve)); // the slot is handed over below
		try {
			return await task();
		} finally {
			const next = this.waiting.shift();
			if (next) next();
			else this.running--;
		}
	}
}

const readStream = async (stream: NodeJS.ReadableStream): Promise<Buffer> => {
	const chunks: Buffer[] = [];
	for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
	return Buffer.concat(chunks);
};
