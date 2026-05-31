import type { AvailabilitySlot, Modality, SiteSlug } from '@alpha/domain';
import type { CalendarProvider } from './calendar-provider';
import { WriteNotSupportedError } from './calendar-provider';

/**
 * Adaptateur de repli (lecture seule) basé sur un flux iCal synchronise depuis
 * Doctolib (export/sync calendrier). Fonctionne SANS accreditation partenaire.
 *
 * Phase 0 : contrat pose, implementation reelle (parsing iCal + cache DB) en Phase 4.
 */
export class ICalSyncAdapter implements CalendarProvider {
  constructor(
    private readonly feedUrls: Partial<Record<SiteSlug, string>>,
  ) {}

  async getAvailabilities(_query: {
    site: SiteSlug;
    modality: Modality;
    from: Date;
    to: Date;
  }): Promise<AvailabilitySlot[]> {
    // Phase 4 : recuperer le flux, parser les VEVENT, normaliser, lire le cache.
    throw new Error('ICalSyncAdapter.getAvailabilities : implementation en Phase 4');
  }

  async getAppointment(_externalId: string): Promise<AvailabilitySlot | null> {
    throw new Error('ICalSyncAdapter.getAppointment : implementation en Phase 4');
  }

  // Pas de createAppointment : la creation n'est pas possible via iCal.
  // Le metier doit deporter vers une tache de rappel (WriteNotSupportedError documente l'intention).
  readonly writeError = new WriteNotSupportedError();
}
