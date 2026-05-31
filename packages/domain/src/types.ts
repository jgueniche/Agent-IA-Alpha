import type {
  CallDirection,
  CallOutcome,
  Modality,
  Permission,
  RoleName,
  SiteSlug,
  Urgency,
} from './enums';

/**
 * DTO et contrats transverses. Volontairement minimaux en Phase 0 ;
 * etoffes au fil des phases. Les entites persistees vivent dans le schema Prisma.
 */

/** Utilisateur authentifie tel qu'expose par l'API (sans secret). */
export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  role: RoleName;
  permissions: Permission[];
}

/** Charge utile du JWT d'acces. */
export interface AccessTokenPayload {
  sub: string; // user id
  email: string;
  role: RoleName;
  permissions: Permission[];
}

/** Reponse d'authentification. */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** Segment de transcription (un tour de parole). */
export interface TranscriptSegment {
  speaker: 'patient' | 'agent';
  ts: number; // offset en secondes depuis le debut de l'appel
  text: string;
}

/** Creneau de disponibilite normalise (sortie du CalendarProvider). */
export interface AvailabilitySlot {
  site: SiteSlug;
  modality: Modality;
  startAt: string; // ISO 8601
  endAt: string; // ISO 8601
}

/** Metadonnees minimales d'un appel (vue back-office). */
export interface CallSummary {
  id: string;
  site: SiteSlug;
  direction: CallDirection;
  startedAt: string;
  durationSeconds: number | null;
  outcome: CallOutcome;
  urgency: Urgency;
}
