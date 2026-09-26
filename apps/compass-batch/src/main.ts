import { NestFactory } from '@nestjs/core';
import { CompassBatchModule } from './compass-batch.module';

async function bootstrap() {
  const app = await NestFactory.create(CompassBatchModule);
  await app.listen(process.env.PORT_BATCH ?? 3000);
}
bootstrap();
