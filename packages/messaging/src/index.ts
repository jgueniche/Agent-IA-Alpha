import type { FollowupChannel } from '@alpha/domain';

/**
 * Contrats et implémentations des canaux de relance (Phase 6).
 * Fournisseurs EEE/FR uniquement (WhatsApp via BSP EEE type 360dialog, SMS FR,
 * voix sortante via la passerelle). Respect du consentement (transactionnel vs
 * marketing) et de l'opt-out — géré côté core-api avant l'appel à send().
 */

export interface OutboundMessage {
  channel: FollowupChannel;
  to: string;
  template: string;
  variables?: Record<string, string>;
}

export interface MessagingProvider {
  /** Envoie un message via le canal cible. Retourne une référence d'envoi. */
  send(message: OutboundMessage): Promise<{ providerRef: string }>;
}

/** Configuration des fournisseurs (tokens EEE/FR), depuis l'environnement. */
export interface MessagingConfig {
  whatsappBspToken?: string;
  whatsappEndpoint?: string;
  smsGatewayKey?: string;
  smsEndpoint?: string;
}

/**
 * Provider de repli (Phase 6) : n'envoie RIEN réellement — il génère une
 * référence et trace l'intention. Les fournisseurs réels (HTTP) sont activés dès
 * que les tokens/endpoints sont fournis. Aucun numéro n'est logué.
 */
export class LoggingMessagingProvider implements MessagingProvider {
  constructor(private readonly log: (msg: string) => void = () => {}) {}

  async send(message: OutboundMessage): Promise<{ providerRef: string }> {
    this.log(`[messaging] envoi simulé via ${message.channel} (template ${message.template})`);
    return { providerRef: `sim-${message.channel}-${Date.now()}` };
  }
}

/**
 * Provider HTTP générique (squelette) pour BSP WhatsApp EEE / passerelle SMS FR.
 * À adapter au contrat exact du fournisseur retenu. Aucun envoi hors EEE.
 */
export class HttpMessagingProvider implements MessagingProvider {
  constructor(private readonly config: MessagingConfig) {}

  async send(message: OutboundMessage): Promise<{ providerRef: string }> {
    const f = (globalThis as {
      fetch?: (url: string, init?: unknown) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;
    }).fetch;
    if (!f) throw new Error('fetch indisponible');

    if (message.channel === 'whatsapp') {
      if (!this.config.whatsappEndpoint || !this.config.whatsappBspToken) {
        throw new Error('WhatsApp BSP non configuré');
      }
      const res = await f(this.config.whatsappEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.whatsappBspToken}`,
        },
        body: JSON.stringify({
          to: message.to,
          template: message.template,
          variables: message.variables ?? {},
        }),
      });
      if (!res.ok) throw new Error(`WhatsApp HTTP ${res.status}`);
      const body = (await res.json()) as { id?: string };
      return { providerRef: body.id ?? 'whatsapp' };
    }

    if (message.channel === 'sms') {
      if (!this.config.smsEndpoint || !this.config.smsGatewayKey) {
        throw new Error('Passerelle SMS non configurée');
      }
      const res = await f(this.config.smsEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.smsGatewayKey,
        },
        body: JSON.stringify({ to: message.to, text: message.template }),
      });
      if (!res.ok) throw new Error(`SMS HTTP ${res.status}`);
      const body = (await res.json()) as { id?: string };
      return { providerRef: body.id ?? 'sms' };
    }

    // Voix sortante : déléguée à la passerelle téléphonie (Phase 2).
    throw new Error('Canal voix : à brancher via la passerelle téléphonie (Phase 2)');
  }
}

/** Construit le provider selon la configuration (logging par défaut). */
export function buildMessagingProvider(config: MessagingConfig): MessagingProvider {
  if (config.whatsappEndpoint || config.smsEndpoint) {
    return new HttpMessagingProvider(config);
  }
  return new LoggingMessagingProvider();
}
