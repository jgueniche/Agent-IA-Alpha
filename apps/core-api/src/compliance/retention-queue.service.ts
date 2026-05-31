import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { RetentionService } from './retention.service';

/**
 * Purge périodique par rétention via BullMQ (Redis). Désactivée par défaut
 * (RETENTION_QUEUE_ENABLED) pour démarrer sans Redis ; activée en production.
 */
@Injectable()
export class RetentionQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RetentionQueueService.name);
  private queue?: Queue;
  private worker?: Worker;

  constructor(private readonly retention: RetentionService) {}

  async onModuleInit(): Promise<void> {
    if (process.env.RETENTION_QUEUE_ENABLED !== 'true') {
      this.logger.log('Purge par rétention désactivée (RETENTION_QUEUE_ENABLED!=true)');
      return;
    }
    const connection = { url: process.env.REDIS_URL ?? 'redis://redis:6379' } as unknown as {
      url: string;
    };
    // Une fois par jour par défaut.
    const everyMs = parseInt(process.env.RETENTION_INTERVAL_MS ?? '86400000', 10);
    this.queue = new Queue('retention', { connection });
    await this.queue.add('purge', {}, { repeat: { every: everyMs }, removeOnComplete: true });
    this.worker = new Worker(
      'retention',
      async () => {
        await this.retention.purge(new Date());
      },
      { connection },
    );
    this.logger.log(`Purge par rétention active (intervalle ${everyMs} ms)`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }
}
