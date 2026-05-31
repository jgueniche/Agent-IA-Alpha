import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { $Enums } from '@prisma/client';
import {
  DoctolibPartnerAdapter,
  ICalSyncAdapter,
  type CalendarProvider,
  type FetchText,
  type SyncedSlot,
} from '@alpha/providers';
import type { AvailabilitySlot, Modality, SiteSlug } from '@alpha/domain';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

/** Récupère un flux texte : supporte http(s) et file:// (sync depuis un fichier). */
const fetchText: FetchText = async (url: string): Promise<string> => {
  if (url.startsWith('file://')) {
    return readFile(fileURLToPath(url), 'utf8');
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`iCal HTTP ${res.status}`);
  return res.text();
};

/**
 * Service agenda : synchronise les flux (iCal en lecture) vers appointments_cache,
 * sert les disponibilités à l'agent (depuis la sync), et déporte les prises de RDV
 * vers une tâche de rappel back-office quand l'écriture n'est pas possible (§2.1).
 */
@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);
  private readonly provider: CalendarProvider & { pull?: (s: SiteSlug) => Promise<SyncedSlot[]> };

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {
    this.provider = this.buildProvider();
  }

  /** Construit l'adaptateur selon CALENDAR_PROVIDER (ical par défaut). */
  private buildProvider() {
    const kind = process.env.CALENDAR_PROVIDER ?? 'ical';
    if (kind === 'doctolib_partner') {
      return new DoctolibPartnerAdapter({
        clientId: process.env.DOCTOLIB_PARTNER_CLIENT_ID ?? '',
        clientSecret: process.env.DOCTOLIB_PARTNER_SECRET ?? '',
      });
    }
    const feedUrls: Partial<Record<SiteSlug, string>> = {};
    if (process.env.ICAL_FEED_URL_CERGY) {
      feedUrls['cergy' as SiteSlug] = process.env.ICAL_FEED_URL_CERGY;
    }
    if (process.env.ICAL_FEED_URL_GOUSSAINVILLE) {
      feedUrls['goussainville' as SiteSlug] = process.env.ICAL_FEED_URL_GOUSSAINVILLE;
    }
    return new ICalSyncAdapter(feedUrls, { fetchText });
  }

  /** Synchronise les créneaux des sites configurés dans appointments_cache. */
  async sync(actorId?: string): Promise<{ synced: number }> {
    if (typeof this.provider.pull !== 'function') {
      throw new Error("L'adaptateur agenda actif ne supporte pas la synchro iCal");
    }
    let synced = 0;
    const sites = await this.prisma.site.findMany({ select: { id: true, slug: true } });
    const siteIdBySlug = new Map(sites.map((s) => [s.slug, s.id]));

    for (const slug of siteIdBySlug.keys()) {
      let slots: SyncedSlot[];
      try {
        slots = await this.provider.pull(slug as SiteSlug);
      } catch (err) {
        this.logger.warn(`Synchro iCal échouée pour le site ${slug}`);
        continue;
      }
      for (const slot of slots) {
        await this.prisma.appointmentCache.upsert({
          where: { externalId: slot.externalId },
          create: {
            externalId: slot.externalId,
            siteId: siteIdBySlug.get(slot.site) ?? null,
            modality: slot.modality as $Enums.Modality,
            startAt: slot.startAt,
            endAt: slot.endAt,
            status: slot.status as $Enums.AppointmentStatus,
          },
          update: {
            startAt: slot.startAt,
            endAt: slot.endAt,
            status: slot.status as $Enums.AppointmentStatus,
            syncedAt: new Date(),
          },
        });
        synced += 1;
      }
    }
    await this.audit.record({
      actorId: actorId ?? null,
      action: 'sync',
      resourceType: 'appointments_cache',
      metadata: { synced },
    });
    return { synced };
  }

  /** Disponibilités lues depuis la sync (cache), filtrées site/modalité/fenêtre. */
  async getAvailabilities(query: {
    site: SiteSlug;
    modality: Modality;
    from?: string;
    to?: string;
    limit?: number;
  }): Promise<AvailabilitySlot[]> {
    const from = query.from ? new Date(query.from) : new Date();
    const to = query.to
      ? new Date(query.to)
      : new Date(Date.now() + 30 * 24 * 3600 * 1000);
    const site = await this.prisma.site.findUnique({
      where: { slug: query.site },
      select: { id: true },
    });
    const rows = await this.prisma.appointmentCache.findMany({
      where: {
        siteId: site?.id ?? undefined,
        modality: query.modality as $Enums.Modality,
        status: $Enums.AppointmentStatus.free,
        startAt: { gte: from, lte: to },
      },
      orderBy: { startAt: 'asc' },
      take: query.limit ?? 5,
    });
    await this.audit.record({
      action: 'read',
      resourceType: 'appointments_cache',
      metadata: { site: query.site, modality: query.modality, results: rows.length },
    });
    return rows.map((r) => ({
      site: query.site,
      modality: query.modality,
      startAt: r.startAt.toISOString(),
      endAt: r.endAt.toISOString(),
    }));
  }

  /**
   * Déporte une prise de RDV vers une tâche de rappel (écriture agenda non
   * disponible sans API partenaire). Retourne l'identifiant de la tâche.
   */
  async deferBooking(input: {
    site: SiteSlug;
    modality: Modality;
    desiredStartAt?: string;
    callId?: string;
    patientId?: string;
    note?: string;
  }): Promise<{ taskId: string }> {
    const desired = input.desiredStartAt
      ? ` souhaité vers ${input.desiredStartAt}`
      : '';
    const task = await this.prisma.callbackTask.create({
      data: {
        callId: input.callId ?? null,
        patientId: input.patientId ?? null,
        motif: `Prise de RDV ${input.modality} — ${input.site}${desired}`,
        urgency: $Enums.Urgency.none,
        status: $Enums.CallbackStatus.pending,
        notes: input.note ?? null,
      },
      select: { id: true },
    });
    await this.audit.record({
      action: 'create',
      resourceType: 'callback_task',
      resourceId: task.id,
      metadata: { reason: 'booking_deferred', modality: input.modality, site: input.site },
    });
    return { taskId: task.id };
  }
}
