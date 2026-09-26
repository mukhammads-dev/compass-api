import { NestFactory } from '@nestjs/core';
import { CompassBatchModule } from './compass-batch.module';

async function bootstrap() {
  const app = await NestFactory.create(CompassBatchModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
