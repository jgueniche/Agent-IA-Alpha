import { Module } from '@nestjs/common';
import { FollowupsService } from './followups.service';
import { FollowupsController } from './followups.controller';
import { FollowupQueueService } from './followup-queue.service';
import { PatientsModule } from '../patients/patients.module';

/** Module moteur de relances multicanal (+ file BullMQ optionnelle). */
@Module({
  imports: [PatientsModule],
  controllers: [FollowupsController],
  providers: [FollowupsService, FollowupQueueService],
  exports: [FollowupsService],
})
export class FollowupsModule {}
