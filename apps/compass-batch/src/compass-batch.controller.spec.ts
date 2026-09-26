import { Test, TestingModule } from '@nestjs/testing';
import { CompassBatchController } from './compass-batch.controller';
import { CompassBatchService } from './compass-batch.service';

describe('CompassBatchController', () => {
  let compassBatchController: CompassBatchController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [CompassBatchController],
      providers: [CompassBatchService],
    }).compile();

    compassBatchController = app.get<CompassBatchController>(CompassBatchController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(compassBatchController.getHello()).toBe('Hello World!');
    });
  });
});
