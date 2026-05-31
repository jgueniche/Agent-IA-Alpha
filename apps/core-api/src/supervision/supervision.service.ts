import { Injectable } from '@nestjs/common';
import { $Enums } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

/** Métriques de supervision de l'agent (aucune donnée patient). */
export interface SupervisionMetrics {
  period: { from: string; to: string };
  calls: {
    total: number;
    resolvedByAgent: number;
    transferredToHuman: number;
    missed: number;
    inProgress: number;
    resolutionRate: number;
    transferRate: number;
  };
  latency: { avgPerceivedMs: number | null; targetMs: number; withinTarget: boolean | null };
  avgDurationSeconds: number | null;
  byIntent: Record<string, number>;
  byUrgency: Record<string, number>;
  callbacks: { pending: number };
  followups: { sent: number; failed: number };
}

const LATENCY_TARGET_MS = 800;

/**
 * Service de supervision : taux de résolution / transfert, latence perçue,
 * répartition des motifs et urgences. Lecture agrégée, sans donnée de santé.
 */
@Injectable()
export class SupervisionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async metrics(actorId: string, fromIso?: string, toIso?: string): Promise<SupervisionMetrics> {
    const to = toIso ? new Date(toIso) : new Date();
    const from = fromIso
      ? new Date(fromIso)
      : new Date(to.getTime() - 30 * 24 * 3600 * 1000);
    const window = { startedAt: { gte: from, lte: to } };

    const [total, resolved, transferred, missed, inProgress] = await Promise.all([
      this.prisma.call.count({ where: window }),
      this.prisma.call.count({ where: { ...window, outcome: $Enums.CallOutcome.resolved_by_agent } }),
      this.prisma.call.count({ where: { ...window, outcome: $Enums.CallOutcome.transferred_to_human } }),
      this.prisma.call.count({ where: { ...window, outcome: $Enums.CallOutcome.missed } }),
      this.prisma.call.count({ where: { ...window, outcome: $Enums.CallOutcome.in_progress } }),
    ]);

    const agg = await this.prisma.call.aggregate({
      where: window,
      _avg: { duration: true, agentLatencyMs: true },
    });

    const intents = await this.prisma.transcript.groupBy({
      by: ['intent'],
      _count: { _all: true },
      where: { call: { is: window } },
    });
    const urgencies = await this.prisma.transcript.groupBy({
      by: ['urgencyFlag'],
      _count: { _all: true },
      where: { call: { is: window } },
    });

    const [pendingCallbacks, sentFollowups, failedFollowups] = await Promise.all([
      this.prisma.callbackTask.count({ where: { status: $Enums.CallbackStatus.pending } }),
      this.prisma.followup.count({ where: { status: $Enums.FollowupStatus.sent } }),
      this.prisma.followup.count({ where: { status: $Enums.FollowupStatus.failed } }),
    ]);

    const avgLatency = agg._avg.agentLatencyMs;
    const rate = (n: number) => (total > 0 ? Math.round((n / total) * 1000) / 1000 : 0);

    await this.audit.record({
      actorId,
      action: 'read',
      resourceType: 'supervision',
      metadata: { total },
    });

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      calls: {
        total,
        resolvedByAgent: resolved,
        transferredToHuman: transferred,
        missed,
        inProgress,
        resolutionRate: rate(resolved),
        transferRate: rate(transferred),
      },
      latency: {
        avgPerceivedMs: avgLatency != null ? Math.round(avgLatency) : null,
        targetMs: LATENCY_TARGET_MS,
        withinTarget: avgLatency != null ? avgLatency <= LATENCY_TARGET_MS : null,
      },
      avgDurationSeconds: agg._avg.duration != null ? Math.round(agg._avg.duration) : null,
      byIntent: Object.fromEntries(intents.map((i) => [i.intent ?? 'inconnu', i._count._all])),
      byUrgency: Object.fromEntries(urgencies.map((u) => [u.urgencyFlag, u._count._all])),
      callbacks: { pending: pendingCallbacks },
      followups: { sent: sentFollowups, failed: failedFollowups },
    };
  }
}
