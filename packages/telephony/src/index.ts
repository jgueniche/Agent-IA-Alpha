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
