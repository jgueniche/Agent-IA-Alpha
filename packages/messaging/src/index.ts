import type { FollowupChannel } from '@alpha/domain';

/**
 * Contrats des canaux de relance (Phase 6). Squelette en Phase 0.
 * Fournisseurs EEE/FR uniquement (WhatsApp via BSP EEE type 360dialog, SMS FR).
 * Respect du consentement (transactionnel vs marketing) et de l'opt-out.
 */

export interface OutboundMessage {
  channel: FollowupChannel;
  to: string;
  template: string;
  variables?: Record<string, string>;
}

export interface MessagingProvider {
  /** Envoie un message via le canal cible. Retourne une reference d'envoi. */
  send(message: OutboundMessage): Promise<{ providerRef: string }>;
}
