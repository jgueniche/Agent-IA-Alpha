import type { AvailabilitySlot, Modality, SiteSlug } from '@alpha/domain';
import type { CalendarProvider } from './calendar-provider';
import { WriteNotSupportedError } from './calendar-provider';
import { parseICalEvents } from './ical-parser';

/** Créneau normalisé issu d'un flux iCal (pour la synchronisation en cache). */
export interface SyncedSlot {
  site: SiteSlug;
  modality: Modality;
  startAt: Date;
  endAt: Date;
  externalId: string;
  status: 'free' | 'booked';
}

/** Récupère le texte d'une URL. Injectable pour les tests / le support file://. */
export type FetchText = (url: string) => Promise<string>;

const MODALITY_KEYWORDS: [RegExp, Modality][] = [
  [/\birm\b/i, 'irm' as Modality],
  [/scanner|tdm|tomodensito/i, 'scanner' as Modality],
  [/mammograph/i, 'mammographie' as Modality],
  [/echograph|écho/i, 'echographie' as Modality],
  [/cone\s*beam|cbct|dentaire/i, 'cone_beam' as Modality],
  [/radiograph|\bradio\b/i, 'radiographie' as Modality],
];

/** Déduit la modalité depuis le résumé / les catégories de l'événement. */
function mapModality(text: string): Modality | null {
  for (const [re, modality] of MODALITY_KEYWORDS) {
    if (re.test(text)) return modality;
  }
  return null;
}

function defaultFetchText(url: string): Promise<string> {
  // fetch global (Node >= 18) ; typé via globalThis pour ne pas dépendre de @types/node ici.
  const f = (globalThis as { fetch?: (u: string) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }> }).fetch;
  if (!f) {
    throw new Error('fetch indisponible : fournir deps.fetchText à ICalSyncAdapter');
  }
  return f(url).then((r) => {
    if (!r.ok) throw new Error(`iCal HTTP ${r.status} pour ${url}`);
    return r.text();
  });
}

/**
 * Adaptateur de lecture (lecture seule) basé sur un flux iCal synchronisé depuis
 * Doctolib (export/sync calendrier). Fonctionne SANS accréditation partenaire.
 *
 * Convention : chaque VEVENT décrit un créneau. La modalité est déduite du
 * SUMMARY/CATEGORIES ; un créneau est "free" sauf si marqué réservé/annulé.
 * La création de RDV n'est pas possible (lève WriteNotSupportedError) → déport
 * vers une tâche de rappel back-office.
 */
export class ICalSyncAdapter implements CalendarProvider {
  private readonly fetchText: FetchText;

  constructor(
    private readonly feedUrls: Partial<Record<SiteSlug, string>>,
    deps: { fetchText?: FetchText } = {},
  ) {
    this.fetchText = deps.fetchText ?? defaultFetchText;
  }

  /** Récupère et normalise tous les créneaux d'un site (pour la synchro/cache). */
  async pull(site: SiteSlug): Promise<SyncedSlot[]> {
    const url = this.feedUrls[site];
    if (!url) return [];
    const text = await this.fetchText(url);
    const events = parseICalEvents(text);
    const slots: SyncedSlot[] = [];
    for (const ev of events) {
      if (!ev.start || !ev.end || !ev.uid) continue;
      const label = `${ev.summary ?? ''} ${ev.categories.join(' ')}`;
      const modality = mapModality(label);
      if (!modality) continue; // on ignore les événements non catégorisables
      const booked =
        ev.status === 'CANCELLED' || /réserv|reserv|occup|booked/i.test(label);
      slots.push({
        site,
        modality,
        startAt: ev.start,
        endAt: ev.end,
        externalId: ev.uid,
        status: booked ? 'booked' : 'free',
      });
    }
    return slots;
  }

  async getAvailabilities(query: {
    site: SiteSlug;
    modality: Modality;
    from: Date;
    to: Date;
  }): Promise<AvailabilitySlot[]> {
    const slots = await this.pull(query.site);
    return slots
      .filter(
        (s) =>
          s.status === 'free' &&
          s.modality === query.modality &&
          s.startAt >= query.from &&
          s.startAt <= query.to,
      )
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
      .map((s) => ({
        site: s.site,
        modality: s.modality,
        startAt: s.startAt.toISOString(),
        endAt: s.endAt.toISOString(),
      }));
  }

  async getAppointment(externalId: string): Promise<AvailabilitySlot | null> {
    for (const site of Object.keys(this.feedUrls) as SiteSlug[]) {
      const slot = (await this.pull(site)).find((s) => s.externalId === externalId);
      if (slot) {
        return {
          site: slot.site,
          modality: slot.modality,
          startAt: slot.startAt.toISOString(),
          endAt: slot.endAt.toISOString(),
        };
      }
    }
    return null;
  }

  // Pas de createAppointment : écriture impossible via iCal → déport back-office.
  readonly writeError = new WriteNotSupportedError();
}
