import { Module } from '@nestjs/common';
import { SupervisionService } from './supervision.service';
import { SupervisionController } from './supervision.controller';

/** Module supervision & qualité (métriques agent). */
@Module({
  controllers: [SupervisionController],
  providers: [SupervisionService],
  exports: [SupervisionService],
})
export class SupervisionModule {}
