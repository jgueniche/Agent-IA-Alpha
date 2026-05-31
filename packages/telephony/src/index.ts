/**
 * Contrats telephonie 3CX (Phase 2). Squelette en Phase 0.
 *
 * Rappel (§2.2) : l'integration trunk SIP personnalisee impose une instance 3CX
 * self-hosted / private-cloud (non supportee sur le cloud 3CX heberge).
 */

/** Demande de transfert via SIP REFER vers une extension/file. */
export interface ReferRequest {
  callId: string;
  targetExtension: string;
  reason?: string;
}

/** Contrat du connecteur telephonie (implemente en Phase 2). */
export interface TelephonyConnector {
  /** Transfere l'appel courant vers un humain (SIP REFER). */
  transfer(req: ReferRequest): Promise<void>;
  /** Declenche un appel sortant (click-to-call back-office, relance vocale). */
  clickToCall(fromExtension: string, toNumber: string): Promise<void>;
}

/**
 * Connecteur de repli (Phase 5) : ne passe PAS d'appel reel — il enregistre
 * l'intention. Le vrai connecteur 3CX (trunk SIP, REFER, click-to-call via API)
 * est branche en Phase 2, en remplacant cette implementation derriere la meme
 * interface. Aucun numero n'est journalise en clair ici.
 */
export class LoggingTelephonyConnector implements TelephonyConnector {
  constructor(private readonly log: (msg: string) => void = () => {}) {}

  async transfer(req: ReferRequest): Promise<void> {
    this.log(`[telephony] REFER demande pour l'appel ${req.callId} -> ${req.targetExtension}`);
  }

  async clickToCall(fromExtension: string, _toNumber: string): Promise<void> {
    // _toNumber volontairement non logue (donnee sensible).
    this.log(`[telephony] click-to-call demande depuis ${fromExtension}`);
  }
}
