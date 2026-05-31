import { Injectable, NotFoundException } from '@nestjs/common';
import { $Enums, Prisma } from '@prisma/client';
import type {
  CallDirection,
  CallOutcome,
  CallSummary,
  Urgency,
} from '@alpha/domain';
import { SiteSlug } from '@alpha/domain';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { AuditService } from '../audit/audit.service';
import { CreateCallDto } from './dto/create-call.dto';
import { UpdateCallDto } from './dto/update-call.dto';
import { UpsertTranscriptDto } from './dto/upsert-transcript.dto';

/**
 * Service appels : ingestion (ecrite par la voice-gateway) et lecture (back-office).
 * Le numero appelant est chiffre ; tout acces patient est journalise (audit).
 */
@Injectable()
export class CallsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
  ) {}

  /** Cree un appel au demarrage (gateway). Retourne l'identifiant. */
  async createCall(
    dto: CreateCallDto,
    ip?: string,
  ): Promise<{ id: string }> {
    const site = dto.site
      ? await this.prisma.site.findUnique({ where: { slug: dto.site } })
      : null;

    const call = await this.prisma.call.create({
      data: {
        siteId: site?.id ?? null,
        callerNumber: this.crypto.encrypt(dto.callerNumber),
        direction: (dto.direction ?? 'inbound') as $Enums.CallDirection,
        outcome: 'in_progress',
      },
      select: { id: true },
    });

    await this.audit.record({
      action: 'create',
      resourceType: 'call',
      resourceId: call.id,
      ip,
      metadata: { site: dto.site ?? null }, // pas de numero en clair
    });
    return { id: call.id };
  }

  /** Met a jour un appel (fin d'appel / transfert). */
  async updateCall(id: string, dto: UpdateCallDto, ip?: string): Promise<void> {
    await this.ensureCall(id);
    await this.prisma.call.update({
      where: { id },
      data: {
        outcome: dto.outcome
          ? (dto.outcome as $Enums.CallOutcome)
          : undefined,
        endedAt: dto.endedAt ? new Date(dto.endedAt) : undefined,
        duration: dto.durationSeconds,
        agentResolved: dto.agentResolved,
        transferredTo: dto.transferredTo,
      },
    });
    await this.audit.record({
      action: 'update',
      resourceType: 'call',
      resourceId: id,
      ip,
      metadata: { outcome: dto.outcome ?? null },
    });
  }

  /** Cree ou remplace la transcription d'un appel. */
  async upsertTranscript(
    callId: string,
    dto: UpsertTranscriptDto,
    ip?: string,
  ): Promise<void> {
    await this.ensureCall(callId);
    const urgency = (dto.urgency ?? 'none') as $Enums.Urgency;
    const segments = dto.segments as unknown as Prisma.InputJsonValue;
    await this.prisma.transcript.upsert({
      where: { callId },
      create: {
        callId,
        segments,
        summary: dto.summary,
        intent: dto.intent,
        urgencyFlag: urgency,
      },
      update: {
        segments,
        summary: dto.summary,
        intent: dto.intent,
        urgencyFlag: urgency,
      },
    });
    await this.audit.record({
      action: 'upsert',
      resourceType: 'transcript',
      resourceId: callId,
      ip,
      // Aucun contenu de transcription dans l'audit (segments/summary caviardes).
      metadata: { segmentsCount: dto.segments.length, urgency },
    });
  }

  /** Liste des appels (back-office) — metadonnees uniquement, numero non expose. */
  async listCalls(actorId: string): Promise<CallSummary[]> {
    const calls = await this.prisma.call.findMany({
      orderBy: { startedAt: 'desc' },
      take: 100,
      include: { site: true, transcript: { select: { urgencyFlag: true } } },
    });
    await this.audit.record({
      actorId,
      action: 'read',
      resourceType: 'call',
      metadata: { count: calls.length },
    });
    // Les valeurs d'enum Prisma sont identiques a celles du domaine (memes chaines).
    return calls.map((c) => ({
      id: c.id,
      site: (c.site?.slug as SiteSlug) ?? SiteSlug.CERGY,
      direction: c.direction as unknown as CallDirection,
      startedAt: c.startedAt.toISOString(),
      durationSeconds: c.duration,
      outcome: c.outcome as unknown as CallOutcome,
      urgency: (c.transcript?.urgencyFlag ??
        $Enums.Urgency.none) as unknown as Urgency,
    }));
  }

  private async ensureCall(id: string): Promise<void> {
    const exists = await this.prisma.call.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException('Appel introuvable');
    }
  }
}
