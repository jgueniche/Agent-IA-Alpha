import { Injectable, NotFoundException } from '@nestjs/common';
import { $Enums } from '@prisma/client';
import {
  buildMessagingProvider,
  type MessagingProvider,
} from '@alpha/messaging';
import { ConsentType, type FollowupChannel } from '@alpha/domain';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PatientsService } from '../patients/patients.service';

function maskNumber(n: string): string {
  const d = n.replace(/\D/g, '');
  return d.length <= 2 ? '••' : `••••••${d.slice(-2)}`;
}

export interface DispatchResult {
  sent: number;
  rescheduled: number;
  skipped: number;
  failed: number;
}

/**
 * Moteur de relances : programmation, opt-out, fenêtre horaire autorisée,
 * consentement (transactionnel vs marketing) et envoi tracé. L'exécution
 * périodique est portée par une file (BullMQ) en production ; `dispatchDue` est
 * la logique métier, testable avec un "now" injecté.
 */
@Injectable()
export class FollowupsService {
  // Provider messaging : logging par défaut, réel si tokens/endpoints fournis.
  private readonly messaging: MessagingProvider = buildMessagingProvider({
    whatsappBspToken: process.env.WHATSAPP_BSP_TOKEN,
    whatsappEndpoint: process.env.WHATSAPP_ENDPOINT,
    smsGatewayKey: process.env.SMS_GATEWAY_KEY,
    smsEndpoint: process.env.SMS_ENDPOINT,
  });
  private readonly windowStart = parseInt(process.env.FOLLOWUP_HOURS_START ?? '8', 10);
  private readonly windowEnd = parseInt(process.env.FOLLOWUP_HOURS_END ?? '20', 10);
  // Jours autorisés en ISO (1=lundi … 7=dimanche). Par défaut lundi→samedi.
  private readonly allowedDays = new Set(
    (process.env.FOLLOWUP_DAYS ?? '1,2,3,4,5,6')
      .split(',')
      .map((d) => parseInt(d.trim(), 10))
      .filter((d) => d >= 1 && d <= 7),
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly patients: PatientsService,
  ) {}

  /** Programme une relance. */
  async schedule(input: {
    patientId?: string;
    channel: FollowupChannel;
    template: string;
    scheduledAt: string;
    marketing?: boolean;
  }, actorId?: string) {
    const followup = await this.prisma.followup.create({
      data: {
        patientId: input.patientId ?? null,
        channel: input.channel as $Enums.FollowupChannel,
        template: input.template,
        marketing: input.marketing ?? false,
        scheduledAt: new Date(input.scheduledAt),
      },
    });
    await this.audit.record({
      actorId: actorId ?? null,
      action: 'create',
      resourceType: 'followup',
      resourceId: followup.id,
      metadata: { channel: input.channel, marketing: input.marketing ?? false },
    });
    return followup;
  }

  async list(actorId: string, status?: string) {
    const items = await this.prisma.followup.findMany({
      where: status ? { status: status as $Enums.FollowupStatus } : {},
      orderBy: { scheduledAt: 'asc' },
      take: 200,
    });
    await this.audit.record({
      actorId,
      action: 'read',
      resourceType: 'followup',
      metadata: { count: items.length },
    });
    return items;
  }

  /** Annule une relance programmée. */
  async cancel(id: string, actorId: string) {
    await this.ensure(id);
    const f = await this.prisma.followup.update({
      where: { id },
      data: { status: $Enums.FollowupStatus.cancelled },
    });
    await this.audit.record({
      actorId,
      action: 'cancel',
      resourceType: 'followup',
      resourceId: id,
    });
    return f;
  }

  /** Opt-out : marque la relance (et bloque l'envoi). */
  async optOut(id: string, actorId?: string) {
    await this.ensure(id);
    const f = await this.prisma.followup.update({
      where: { id },
      data: { optOut: true, status: $Enums.FollowupStatus.opted_out },
    });
    await this.audit.record({
      actorId: actorId ?? null,
      action: 'opt_out',
      resourceType: 'followup',
      resourceId: id,
    });
    return f;
  }

  /**
   * Traite les relances dues : opt-out, consentement, fenêtre horaire, envoi.
   * `now` est injectable pour les tests.
   */
  async dispatchDue(now: Date = new Date(), actorId?: string): Promise<DispatchResult> {
    const due = await this.prisma.followup.findMany({
      where: {
        status: $Enums.FollowupStatus.scheduled,
        scheduledAt: { lte: now },
      },
      take: 500,
    });
    const result: DispatchResult = { sent: 0, rescheduled: 0, skipped: 0, failed: 0 };

    for (const f of due) {
      if (f.optOut) {
        await this.mark(f.id, $Enums.FollowupStatus.opted_out);
        result.skipped += 1;
        continue;
      }

      // Consentement requis selon transactionnel / marketing.
      if (f.patientId) {
        const type = f.marketing
          ? ConsentType.FOLLOWUP_MARKETING
          : ConsentType.FOLLOWUP_TRANSACTIONAL;
        const ok = await this.patients.hasConsent(f.patientId, type);
        if (!ok) {
          await this.mark(f.id, $Enums.FollowupStatus.cancelled, 'no_consent');
          await this.audit.record({
            action: 'followup_blocked',
            resourceType: 'followup',
            resourceId: f.id,
            metadata: { reason: 'no_consent' },
          });
          result.skipped += 1;
          continue;
        }
      }

      // Fenêtre horaire autorisée : sinon reprogrammer au prochain créneau.
      if (!this.isWithinWindow(now)) {
        const next = this.nextWindowStart(now);
        await this.prisma.followup.update({
          where: { id: f.id },
          data: { scheduledAt: next },
        });
        result.rescheduled += 1;
        continue;
      }

      // Résolution du destinataire (téléphone du patient).
      const phone = f.patientId ? await this.patients.getPhone(f.patientId) : null;
      if (!phone) {
        await this.mark(f.id, $Enums.FollowupStatus.failed, 'no_destination');
        result.failed += 1;
        continue;
      }

      try {
        const { providerRef } = await this.messaging.send({
          channel: f.channel as FollowupChannel,
          to: phone,
          template: f.template,
        });
        await this.prisma.followup.update({
          where: { id: f.id },
          data: {
            status: $Enums.FollowupStatus.sent,
            sentAt: now,
            providerRef,
          },
        });
        await this.audit.record({
          action: 'send',
          resourceType: 'followup',
          resourceId: f.id,
          // Destinataire masqué : jamais en clair.
          metadata: { channel: f.channel, to: maskNumber(phone), providerRef },
        });
        result.sent += 1;
      } catch (err) {
        await this.mark(f.id, $Enums.FollowupStatus.failed, 'provider_error');
        result.failed += 1;
      }
    }

    await this.audit.record({
      actorId: actorId ?? null,
      action: 'dispatch',
      resourceType: 'followup',
      metadata: { ...result },
    });
    return result;
  }

  // --- helpers fenêtre horaire ---------------------------------------------

  /** Numéro de jour ISO (1=lundi … 7=dimanche). */
  private isoDay(date: Date): number {
    const d = date.getDay();
    return d === 0 ? 7 : d;
  }

  isWithinWindow(date: Date): boolean {
    const hour = date.getHours();
    return (
      this.allowedDays.has(this.isoDay(date)) &&
      hour >= this.windowStart &&
      hour < this.windowEnd
    );
  }

  nextWindowStart(date: Date): Date {
    const next = new Date(date);
    // Si l'heure est dépassée (ou jour non autorisé), passer au jour suivant.
    if (date.getHours() >= this.windowEnd || !this.allowedDays.has(this.isoDay(date))) {
      next.setDate(next.getDate() + 1);
    }
    next.setHours(this.windowStart, 0, 0, 0);
    // Avancer jusqu'à un jour autorisé (max 7 itérations).
    for (let i = 0; i < 7 && !this.allowedDays.has(this.isoDay(next)); i += 1) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  }

  private async mark(id: string, status: $Enums.FollowupStatus, reason?: string) {
    await this.prisma.followup.update({
      where: { id },
      data: { status, failureReason: reason ?? null },
    });
  }

  private async ensure(id: string) {
    const f = await this.prisma.followup.findUnique({ where: { id }, select: { id: true } });
    if (!f) throw new NotFoundException('Relance introuvable');
  }
}
