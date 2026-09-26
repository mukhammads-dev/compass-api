import { Injectable } from '@nestjs/common';

@Injectable()
export class CompassBatchService {
  getHello(): string {
    return 'Welcome to Compass Batch Server !';
  }
}
