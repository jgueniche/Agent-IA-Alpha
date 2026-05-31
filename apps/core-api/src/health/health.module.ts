import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/** Module de sonde de sante. */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
