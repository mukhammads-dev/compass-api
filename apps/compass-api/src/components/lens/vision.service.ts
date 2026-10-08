import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { existsSync } from 'fs';
import * as path from 'path';
import * as ort from 'onnxruntime-node';
import sharp from 'sharp';
import { errorMessage, LENS_MIN_AREA, LENS_MIN_SCORE, LENS_MODEL_DIR } from '../../libs/config';
import { LensLabel } from '../../libs/enums/lens.enum';
import type { LensBox, LensDetection } from '../../libs/types/lens';

const DETECT_SIZE = 640;
const EMBED_SIZE = 224;
const LETTERBOX_GREY = { r: 114, g: 114, b: 114 };
const CROP_MARGIN = 0.04; // a little context around a find helps the embedder
const LABELS = Object.values(LensLabel);

/** Decoded, upright RGB pixels. */
export interface RawImage {
	data: Buffer;
	width: number;
	height: number;
}

/**
 * Runs the two Compass Lens models on CPU:
 * - detector.onnx: open-vocabulary YOLOE with the LensLabel vocabulary baked in (boxes + labels, NMS inside)
 * - embedder.onnx: image classifier backbone that turns a crop into a unit-length 1280-d vector
 */
@Injectable()
export class VisionService implements OnModuleInit {
	private readonly logger = new Logger(VisionService.name);
	private detector: ort.InferenceSession | null = null;
	private embedder: ort.InferenceSession | null = null;
	private loading: Promise<void> | null = null;

	/** Models are loaded in the background so the first search does not pay for it. */
	public onModuleInit(): void {
		this.ready().catch((err) => this.logger.warn(`Compass Lens is off: ${errorMessage(err)}`));
	}

	public async ready(): Promise<void> {
		if (this.detector && this.embedder) return;
		this.loading ??= this.load();
		try {
			await this.loading;
		} catch (err) {
			this.loading = null;
			throw err;
		}
	}

	private async load(): Promise<void> {
		const dir = path.resolve(LENS_MODEL_DIR);
		const detectorPath = path.join(dir, 'detector.onnx');
		const embedderPath = path.join(dir, 'embedder.onnx');
		if (!existsSync(detectorPath) || !existsSync(embedderPath)) throw new Error(`models not found in ${dir}`);

		this.detector = await ort.InferenceSession.create(detectorPath);
		this.embedder = await ort.InferenceSession.create(embedderPath);
		this.logger.log('Compass Lens models loaded');
	}

	/** EXIF-rotated RGB pixels, decoded once and reused for detection and every crop. */
	public async decode(input: Buffer | string): Promise<RawImage> {
		const { data, info } = await sharp(input).rotate().removeAlpha().raw().toBuffer({ resolveWithObject: true });
		return { data, width: info.width, height: info.height };
	}

	/** Finds furniture and decor in a photo, most confident first. */
	public async detect(image: RawImage): Promise<LensDetection[]> {
		await this.ready();

		const scale = Math.min(DETECT_SIZE / image.width, DETECT_SIZE / image.height);
		const width = Math.round(image.width * scale);
		const height = Math.round(image.height * scale);
		const left = Math.round((DETECT_SIZE - width) / 2 - 0.1);
		const top = Math.round((DETECT_SIZE - height) / 2 - 0.1);

		const pixels = await this.pipeline(image)
			.resize(width, height, { kernel: 'linear' })
			.extend({
				top,
				bottom: DETECT_SIZE - height - top,
				left,
				right: DETECT_SIZE - width - left,
				background: LETTERBOX_GREY,
			})
			.raw()
			.toBuffer();

		const feeds = { images: new ort.Tensor('float32', toChw(pixels, DETECT_SIZE), [1, 3, DETECT_SIZE, DETECT_SIZE]) };
		const output = (await this.detector!.run(feeds)).output0;
		const [, rows, stride] = output.dims;
		const values = output.data as Float32Array;

		const detections: LensDetection[] = [];
		for (let i = 0; i < rows; i++) {
			const row = i * stride;
			const score = values[row + 4];
			if (score < LENS_MIN_SCORE) continue;

			const x1 = clamp01((values[row] - left) / scale / image.width);
			const y1 = clamp01((values[row + 1] - top) / scale / image.height);
			const x2 = clamp01((values[row + 2] - left) / scale / image.width);
			const y2 = clamp01((values[row + 3] - top) / scale / image.height);
			const box = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
			if (box.w * box.h < LENS_MIN_AREA) continue;

			detections.push({ label: LABELS[Math.round(values[row + 5])], score, box });
		}
		return detections.sort((a, b) => b.score - a.score);
	}

	/** One unit-length vector per region (the whole photo when no region is given). */
	public async embed(image: RawImage, boxes: LensBox[] = [{ x: 0, y: 0, w: 1, h: 1 }]): Promise<Float32Array[]> {
		await this.ready();
		if (!boxes.length) return [];

		const planeSize = 3 * EMBED_SIZE * EMBED_SIZE;
		const batch = new Float32Array(boxes.length * planeSize);
		for (let i = 0; i < boxes.length; i++) {
			const pixels = await this.pipeline(image)
				.extract(toPixelRegion(boxes[i], image))
				.resize(EMBED_SIZE, EMBED_SIZE, { fit: 'cover', kernel: 'linear' })
				.raw()
				.toBuffer();
			batch.set(toChw(pixels, EMBED_SIZE), i * planeSize);
		}

		const feeds = { images: new ort.Tensor('float32', batch, [boxes.length, 3, EMBED_SIZE, EMBED_SIZE]) };
		const output = (await this.embedder!.run(feeds)).embedding;
		const [, dims] = output.dims;
		const values = output.data as Float32Array;
		return boxes.map((_, i) => values.slice(i * dims, (i + 1) * dims));
	}

	private pipeline(image: RawImage): sharp.Sharp {
		return sharp(image.data, { raw: { width: image.width, height: image.height, channels: 3 } });
	}
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** Normalized box (plus a small margin) to whole pixels inside the image. */
const toPixelRegion = (box: LensBox, image: RawImage) => {
	const marginX = box.w * CROP_MARGIN;
	const marginY = box.h * CROP_MARGIN;
	const left = Math.floor(clamp01(box.x - marginX) * image.width);
	const top = Math.floor(clamp01(box.y - marginY) * image.height);
	const right = Math.ceil(clamp01(box.x + box.w + marginX) * image.width);
	const bottom = Math.ceil(clamp01(box.y + box.h + marginY) * image.height);
	return {
		left: Math.min(left, image.width - 1),
		top: Math.min(top, image.height - 1),
		width: Math.max(1, Math.min(right, image.width) - left),
		height: Math.max(1, Math.min(bottom, image.height) - top),
	};
};

/** HWC uint8 RGB -> CHW float32 in 0..1, the layout both models expect. */
const toChw = (pixels: Buffer, size: number): Float32Array => {
	const plane = size * size;
	const chw = new Float32Array(3 * plane);
	for (let i = 0; i < plane; i++) {
		chw[i] = pixels[i * 3] / 255;
		chw[plane + i] = pixels[i * 3 + 1] / 255;
		chw[2 * plane + i] = pixels[i * 3 + 2] / 255;
	}
	return chw;
};
