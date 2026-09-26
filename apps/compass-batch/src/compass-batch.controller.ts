import { Controller, Get } from '@nestjs/common';
import { CompassBatchService } from './compass-batch.service';

@Controller()
export class CompassBatchController {
  constructor(private readonly compassBatchService: CompassBatchService) {}

  @Get()
  getHello(): string {
    return this.compassBatchService.getHello();
  }
}
