import { Injectable } from '@nestjs/common';
import { $Enums } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { loadConfig } from '../config/configuration';

export interface PurgeResult {
  calls: number;
  followups: number;
  callbackTasks: number;
  appointments: number;
  auditLogs: number;
}

/**
 * Politique de rétention et purge automatique (RGPD/HDS).
 *
 * Supprime les données opérationnelles au-delà de DATA_RETENTION_DAYS et les
 * entrées d'audit au-delà de AUDIT_LOG_RETENTION_DAYS. Les transcriptions sont
 * supprimées en cascade avec leurs appels. La purge des journaux d'audit
 * (sinon immuables) passe par un drapeau de session contrôlé (cf. trigger).
 */
@Injectable()
export class RetentionService {
  private readonly config = loadConfig();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async purge(now: Date = new Date(), actorId?: string): Promise<PurgeResult> {
    const dataCutoff = new Date(
      now.getTime() - this.config.retention.dataDays * 86_400_000,
    );
    const auditCutoff = new Date(
      now.getTime() - this.config.retention.auditDays * 86_400_000,
    );

    // Tâches de rappel terminées au-delà de la rétention.
    const callbackTasks = await this.prisma.callbackTask.deleteMany({
      where: {
        createdAt: { lt: dataCutoff },
        status: { in: [$Enums.CallbackStatus.done, $Enums.CallbackStatus.cancelled] },
      },
    });

    // Appels (et transcriptions en cascade) au-delà de la rétention.
    const calls = await this.prisma.call.deleteMany({
      where: { startedAt: { lt: dataCutoff } },
    });

    // Relances traitées au-delà de la rétention.
    const followups = await this.prisma.followup.deleteMany({
      where: {
        createdAt: { lt: dataCutoff },
        status: {
          in: [
            $Enums.FollowupStatus.sent,
            $Enums.FollowupStatus.failed,
            $Enums.FollowupStatus.cancelled,
            $Enums.FollowupStatus.opted_out,
          ],
        },
      },
    });

    // Créneaux d'agenda passés (hygiène du cache).
    const appointments = await this.prisma.appointmentCache.deleteMany({
      where: { endAt: { lt: now } },
    });

    // Journaux d'audit au-delà de la rétention : purge contrôlée (append-only).
    const auditLogs = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL app.allow_audit_purge = 'on'");
      return tx.$executeRaw`DELETE FROM audit_log WHERE "createdAt" < ${auditCutoff}`;
    });

    const result: PurgeResult = {
      calls: calls.count,
      followups: followups.count,
      callbackTasks: callbackTasks.count,
      appointments: appointments.count,
      auditLogs: Number(auditLogs),
    };
    await this.audit.record({
      actorId: actorId ?? null,
      action: 'retention_purge',
      resourceType: 'system',
      metadata: { ...result, dataDays: this.config.retention.dataDays },
    });
    return result;
  }
}
