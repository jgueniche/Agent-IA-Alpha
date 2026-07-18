/**
 * Libellés français + tonalité visuelle (badge) pour les valeurs métier.
 * Les valeurs brutes viennent de @alpha/domain (persistées en base) ; ici on ne
 * fait que la présentation.
 */

export type Tone = 'neutral' | 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'teal';

export interface LabelInfo {
  label: string;
  tone: Tone;
}

const fallback = (value: string): LabelInfo => ({
  label: value ? value.replaceAll('_', ' ') : '—',
  tone: 'neutral',
});

export const OUTCOME: Record<string, LabelInfo> = {
  resolved_by_agent: { label: "Résolu par l'IA", tone: 'green' },
  transferred_to_human: { label: 'Transféré', tone: 'blue' },
  missed: { label: 'Manqué', tone: 'red' },
  callback_queued: { label: 'Rappel programmé', tone: 'amber' },
  in_progress: { label: 'En cours', tone: 'violet' },
};

export const URGENCY: Record<string, LabelInfo> = {
  none: { label: 'Sans urgence', tone: 'neutral' },
  low: { label: 'Urgence faible', tone: 'neutral' },
  medium: { label: 'Urgence modérée', tone: 'amber' },
  high: { label: 'Urgence élevée', tone: 'red' },
  critical: { label: 'Urgence critique', tone: 'red' },
};

export const CALLBACK_STATUS: Record<string, LabelInfo> = {
  pending: { label: 'À traiter', tone: 'amber' },
  assigned: { label: 'Assignée', tone: 'blue' },
  in_progress: { label: 'En cours', tone: 'violet' },
  done: { label: 'Terminée', tone: 'green' },
  cancelled: { label: 'Annulée', tone: 'neutral' },
};

export const FOLLOWUP_STATUS: Record<string, LabelInfo> = {
  scheduled: { label: 'Programmée', tone: 'blue' },
  sent: { label: 'Envoyée', tone: 'green' },
  failed: { label: 'Échec', tone: 'red' },
  cancelled: { label: 'Annulée', tone: 'neutral' },
  opted_out: { label: 'Opt-out', tone: 'red' },
};

export const CHANNEL: Record<string, LabelInfo> = {
  sms: { label: 'SMS', tone: 'teal' },
  whatsapp: { label: 'WhatsApp', tone: 'green' },
  voice: { label: 'Appel vocal', tone: 'blue' },
};

export const KNOWLEDGE_TYPE: Record<string, LabelInfo> = {
  prep: { label: 'Préparation', tone: 'blue' },
  contre_indication: { label: 'Contre-indication', tone: 'red' },
  doc: { label: 'Documents', tone: 'violet' },
  acces: { label: 'Accès', tone: 'teal' },
  horaires: { label: 'Horaires', tone: 'amber' },
};

export const SITE: Record<string, string> = {
  cergy: 'Cergy',
  goussainville: 'Goussainville',
};

export const DIRECTION: Record<string, string> = {
  inbound: 'Entrant',
  outbound: 'Sortant',
};

export const INTENT: Record<string, string> = {
  prise_rdv: 'Prise de RDV',
  preparation_examen: "Préparation d'examen",
  horaires_acces: 'Horaires & accès',
  resultat: 'Résultats',
  urgence: 'Urgence',
  autre: 'Autre',
};

export const ROLE: Record<string, string> = {
  secretary: 'Secrétaire',
  manager: 'Responsable',
  admin: 'Administrateur',
};

export const MODALITY: Record<string, string> = {
  irm: 'IRM',
  scanner: 'Scanner',
  radiographie: 'Radiographie',
  echographie: 'Échographie',
  mammographie: 'Mammographie',
  cone_beam: 'Cone beam',
};

export function labelOf(map: Record<string, LabelInfo>, value: string | null | undefined): LabelInfo {
  if (!value) return fallback('');
  return map[value] ?? fallback(value);
}

export function textOf(map: Record<string, string>, value: string | null | undefined): string {
  if (!value) return '—';
  return map[value] ?? value.replaceAll('_', ' ');
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m} min ${String(s).padStart(2, '0')} s` : `${s} s`;
}
