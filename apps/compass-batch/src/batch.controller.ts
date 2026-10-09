import { Controller, Get, Logger } from '@nestjs/common';
import { Cron, Timeout } from '@nestjs/schedule';
import { BatchService } from './batch.service';
import {
	BATCH_COMPLETE_ORDERS,
	BATCH_LENS_CLEANUP,
	BATCH_ROLLBACK,
	BATCH_TOP_AGENTS,
	BATCH_TOP_PRODUCTS,
	BATCH_TOP_ROOM_TOURS,
} from './lib/config';

/**
 * Scheduling only, the work lives in BatchService. Jobs run hourly and never overlap:
 * rollback (xx:00:00) → agents (xx:00:20) → products (xx:00:40) → room tours (xx:01:00).
 * Lens photo cleanup runs once a night (03:30), delivered orders are auto-confirmed at 04:00.
 */
@Controller()
export class BatchController {
	private readonly logger: Logger = new Logger('BatchController');

	constructor(private readonly batchService: BatchService) {}

	@Timeout(1000)
	handleTimeout() {
		this.logger.debug('BATCH SERVER READY!');
	}

	@Cron('00 00 * * * *', { name: BATCH_ROLLBACK })
	public async batchRollback() {
		try {
			await this.batchService.batchRollback();
			this.logger.debug('EXECUTED!', BATCH_ROLLBACK);
		} catch (err) {
			this.logger.error(err, BATCH_ROLLBACK);
		}
	}

	@Cron('20 00 * * * *', { name: BATCH_TOP_AGENTS })
	public async batchTopAgents() {
		try {
			const updated = await this.batchService.batchTopAgents();
			this.logger.debug(`EXECUTED! updated: ${updated}`, BATCH_TOP_AGENTS);
		} catch (err) {
			this.logger.error(err, BATCH_TOP_AGENTS);
		}
	}

	@Cron('40 00 * * * *', { name: BATCH_TOP_PRODUCTS })
	public async batchTopProducts() {
		try {
			const updated = await this.batchService.batchTopProducts();
			this.logger.debug(`EXECUTED! updated: ${updated}`, BATCH_TOP_PRODUCTS);
		} catch (err) {
			this.logger.error(err, BATCH_TOP_PRODUCTS);
		}
	}

	@Cron('00 01 * * * *', { name: BATCH_TOP_ROOM_TOURS })
	public async batchTopRoomTours() {
		try {
			const updated = await this.batchService.batchTopRoomTours();
			this.logger.debug(`EXECUTED! updated: ${updated}`, BATCH_TOP_ROOM_TOURS);
		} catch (err) {
			this.logger.error(err, BATCH_TOP_ROOM_TOURS);
		}
	}

	@Cron('00 30 03 * * *', { name: BATCH_LENS_CLEANUP })
	public async batchLensCleanup() {
		try {
			const removed = await this.batchService.batchLensCleanup();
			this.logger.debug(`EXECUTED! removed: ${removed}`, BATCH_LENS_CLEANUP);
		} catch (err) {
			this.logger.error(err, BATCH_LENS_CLEANUP);
		}
	}

	@Cron('00 00 04 * * *', { name: BATCH_COMPLETE_ORDERS })
	public async batchCompleteOrders() {
		try {
			const completed = await this.batchService.batchCompleteOrders();
			this.logger.debug(`EXECUTED! completed: ${completed}`, BATCH_COMPLETE_ORDERS);
		} catch (err) {
			this.logger.error(err, BATCH_COMPLETE_ORDERS);
		}
	}

	@Get()
	getHello(): string {
		return 'Compass Batch Server';
	}
}
