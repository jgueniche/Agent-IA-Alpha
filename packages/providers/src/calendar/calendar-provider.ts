import type { AvailabilitySlot, Modality, SiteSlug } from '@alpha/domain';

/**
 * Abstraction agenda (cf. contrainte §2.1 : Doctolib n'expose PAS d'API publique).
 *
 * L'application fonctionne des le jour 1 via un adaptateur de lecture (iCal), et
 * pourra basculer sur l'API officielle partenaire SANS reecriture du metier :
 * il suffit d'activer un autre adaptateur derriere cette interface.
 *
 * IMPORTANT : ne JAMAIS appeler une "API Doctolib" publique inexistante, ni
 * scraper/automatiser Doctolib en RPA.
 */
export interface CalendarProvider {
  /** Lit des creneaux disponibles (lecture seule). */
  getAvailabilities(query: {
    site: SiteSlug;
    modality: Modality;
    from: Date;
    to: Date;
  }): Promise<AvailabilitySlot[]>;

  /** Lit un rendez-vous existant par identifiant source. */
  getAppointment(externalId: string): Promise<AvailabilitySlot | null>;

  /**
   * Creation de RDV — optionnelle. N'est disponible QUE via l'API officielle
   * partenaire. Si l'adaptateur ne la supporte pas, il leve
   * `WriteNotSupportedError` ; le metier deporte alors vers une tache de rappel.
   */
  createAppointment?(input: {
    site: SiteSlug;
    modality: Modality;
    startAt: Date;
    patientRef: string;
  }): Promise<{ externalId: string }>;
}

/** Levee quand l'ecriture n'est pas possible (mode lecture seule). */
export class WriteNotSupportedError extends Error {
  constructor() {
    super(
      "Ecriture agenda non supportee par cet adaptateur (lecture seule). " +
        'Deporter vers une tache de rappel back-office ou envoyer le lien Doctolib au patient.',
    );
    this.name = 'WriteNotSupportedError';
  }
}
