import { Module } from '@nestjs/common';
import { RetentionService } from './retention.service';
import { RetentionQueueService } from './retention-queue.service';
import { ComplianceController } from './compliance.controller';

/** Module conformité : rétention / purge automatique. */
@Module({
  controllers: [ComplianceController],
  providers: [RetentionService, RetentionQueueService],
  exports: [RetentionService],
})
export class ComplianceModule {}
