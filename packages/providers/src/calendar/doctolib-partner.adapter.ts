import type { AvailabilitySlot, Modality, SiteSlug } from '@alpha/domain';
import type { CalendarProvider } from './calendar-provider';

/**
 * Adaptateur API officielle partenaire Doctolib — STUB.
 *
 * A activer UNIQUEMENT si l'accreditation partenaire Doctolib est obtenue
 * (variables DOCTOLIB_PARTNER_CLIENT_ID / DOCTOLIB_PARTNER_SECRET).
 * Implementation reelle au moment du branchement officiel. Aucun appel a une
 * "API publique" : l'acces partenaire est contractuel.
 */
export class DoctolibPartnerAdapter implements CalendarProvider {
  constructor(
    private readonly credentials: { clientId: string; clientSecret: string },
  ) {}

  async getAvailabilities(_query: {
    site: SiteSlug;
    modality: Modality;
    from: Date;
    to: Date;
  }): Promise<AvailabilitySlot[]> {
    throw new Error(
      'DoctolibPartnerAdapter : a implementer apres obtention de l accreditation partenaire',
    );
  }

  async getAppointment(_externalId: string): Promise<AvailabilitySlot | null> {
    throw new Error('DoctolibPartnerAdapter : non implemente (accreditation requise)');
  }

  async createAppointment(_input: {
    site: SiteSlug;
    modality: Modality;
    startAt: Date;
    patientRef: string;
  }): Promise<{ externalId: string }> {
    throw new Error('DoctolibPartnerAdapter : non implemente (accreditation requise)');
  }
}
