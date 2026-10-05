import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { BatchModule } from './batch.module';

async function bootstrap() {
	const app = await NestFactory.create(BatchModule);

	const port = process.env.PORT_BATCH ?? 3001;
	await app.listen(port);
	new Logger('Bootstrap').log(`Compass Batch is running on port ${port}`);
}

void bootstrap();
