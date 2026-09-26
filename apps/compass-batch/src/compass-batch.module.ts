import { Module } from '@nestjs/common';
import { CompassBatchController } from './compass-batch.controller';
import { CompassBatchService } from './compass-batch.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot()
  ],
  controllers: [CompassBatchController],
  providers: [CompassBatchService],
})
export class CompassBatchModule { }
