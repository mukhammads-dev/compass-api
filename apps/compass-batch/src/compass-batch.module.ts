import { Module } from '@nestjs/common';
import { CompassBatchController } from './compass-batch.controller';
import { CompassBatchService } from './compass-batch.service';

@Module({
  imports: [],
  controllers: [CompassBatchController],
  providers: [CompassBatchService],
})
export class CompassBatchModule {}
