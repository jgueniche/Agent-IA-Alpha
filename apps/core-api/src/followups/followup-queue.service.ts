import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { FollowupsService } from './followups.service';

/**
 * Planification des relances via BullMQ (Redis) — stack imposée (§4).
 *
 * Désactivé par défaut (FOLLOWUPS_QUEUE_ENABLED) pour que l'application démarre
 * sans Redis (dev / tests). En production (docker-compose / HDS), on l'active :
 * un job répétable déclenche périodiquement le traitement des relances dues,
 * avec retries gérés par BullMQ. La logique métier reste dans FollowupsService
 * (dispatchDue), ce qui la garde testable hors file.
 */
@Injectable()
export class FollowupQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FollowupQueueService.name);
  private queue?: Queue;
  private worker?: Worker;

  constructor(private readonly followups: FollowupsService) {}

  async onModuleInit(): Promise<void> {
    if (process.env.FOLLOWUPS_QUEUE_ENABLED !== 'true') {
      this.logger.log('File de relances désactivée (FOLLOWUPS_QUEUE_ENABLED!=true)');
      return;
    }
    const url = process.env.REDIS_URL ?? 'redis://redis:6379';
    const connection = { url } as unknown as { url: string };
    const intervalMs = parseInt(process.env.FOLLOWUP_DISPATCH_INTERVAL_MS ?? '60000', 10);

    this.queue = new Queue('followups', { connection });
    // Job répétable : traite les relances dues à intervalle régulier.
    await this.queue.add(
      'dispatch-due',
      {},
      {
        repeat: { every: intervalMs },
        removeOnComplete: true,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );

    this.worker = new Worker(
      'followups',
      async () => {
        await this.followups.dispatchDue(new Date());
      },
      { connection },
    );
    this.worker.on('failed', (_job, err) => {
      this.logger.warn(`Traitement de relances en échec : ${err?.message ?? 'inconnu'}`);
    });
    this.logger.log(`File de relances active (intervalle ${intervalMs} ms)`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }
}
