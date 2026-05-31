/**
 * Enumerations metier partagees entre les services (core-api, back-office, voice-gateway).
 * Les valeurs (chaines) doivent rester stables : elles sont persistees en base.
 */

/** Sites du centre d'imagerie. */
export enum SiteSlug {
  CERGY = 'cergy',
  GOUSSAINVILLE = 'goussainville',
}

/** Modalites d'imagerie proposees. */
export enum Modality {
  IRM = 'irm',
  SCANNER = 'scanner', // TDM
  RADIOGRAPHIE = 'radiographie',
  ECHOGRAPHIE = 'echographie',
  MAMMOGRAPHIE = 'mammographie',
  CONE_BEAM = 'cone_beam',
}

/** Sens de l'appel telephonique. */
export enum CallDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
}

/** Resultat d'un appel, du point de vue du parcours. */
export enum CallOutcome {
  RESOLVED_BY_AGENT = 'resolved_by_agent',
  TRANSFERRED_TO_HUMAN = 'transferred_to_human',
  MISSED = 'missed',
  CALLBACK_QUEUED = 'callback_queued',
  IN_PROGRESS = 'in_progress',
}

/** Niveau d'urgence detecte / qualifie. */
export enum Urgency {
  NONE = 'none',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical', // ex. suspicion d'urgence vitale -> redirection 15
}

/** Statut d'une tache de rappel dans le back-office. */
export enum CallbackStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  DONE = 'done',
  CANCELLED = 'cancelled',
}

/** Canaux de relance multicanal. */
export enum FollowupChannel {
  WHATSAPP = 'whatsapp',
  SMS = 'sms',
  VOICE = 'voice',
}

/** Statut d'une relance. */
export enum FollowupStatus {
  SCHEDULED = 'scheduled',
  SENT = 'sent',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  OPTED_OUT = 'opted_out',
}

/** Type d'item de la base de connaissance imagerie. */
export enum KnowledgeType {
  PREPARATION = 'prep',
  CONTRE_INDICATION = 'contre_indication',
  DOCUMENT = 'doc',
  ACCES = 'acces',
  HORAIRES = 'horaires',
}

/** Types de consentement traces (distincts). */
export enum ConsentType {
  RECORDING = 'recording',
  FOLLOWUP_TRANSACTIONAL = 'followup_transactional',
  FOLLOWUP_MARKETING = 'followup_marketing',
  DATA_PROCESSING = 'data_processing',
}

/** Roles RBAC. */
export enum RoleName {
  SECRETARY = 'secretary',
  MANAGER = 'manager',
  ADMIN = 'admin',
}

/** Codes de permission (granularite fine, mappes aux roles). */
export enum Permission {
  CALLS_READ = 'calls:read',
  TRANSCRIPTS_READ = 'transcripts:read',
  RECORDINGS_READ = 'recordings:read',
  CALLBACKS_READ = 'callbacks:read',
  CALLBACKS_WRITE = 'callbacks:write',
  FOLLOWUPS_READ = 'followups:read',
  FOLLOWUPS_WRITE = 'followups:write',
  KNOWLEDGE_READ = 'knowledge:read',
  KNOWLEDGE_WRITE = 'knowledge:write',
  KNOWLEDGE_VALIDATE = 'knowledge:validate',
  PATIENTS_READ = 'patients:read',
  USERS_MANAGE = 'users:manage',
  AUDIT_READ = 'audit:read',
  SUPERVISION_READ = 'supervision:read',
}
