/**
 * Contrats des briques IA (STT / LLM / TTS), pour rester interchangeables (§4).
 *
 * NB : l'implementation runtime temps reel vit dans `apps/voice-gateway` (Python,
 * LiveKit/Pipecat). Ces interfaces TypeScript documentent le contrat partage et
 * servent aux orchestrations cote core-api (ex. resume LLM hors temps reel).
 *
 * Contrainte HDS (§2.3) : par defaut, aucun envoi de transcription/audio patient
 * hors EEE. Cibles : modeles auto-heberges ou heberges en EEE.
 */

export interface SttProvider {
  /** Transcrit un flux audio FR en texte. */
  transcribe(audio: ArrayBuffer, opts?: { language?: string }): Promise<string>;
}

export interface LlmProvider {
  /** Complete un prompt (orchestrateur / resume). */
  complete(input: {
    system: string;
    messages: { role: 'user' | 'assistant'; content: string }[];
    tools?: unknown[];
  }): Promise<{ content: string; toolCalls?: unknown[] }>;
}

export interface TtsProvider {
  /** Synthetise un texte FR en audio. */
  synthesize(text: string, opts?: { voice?: string }): Promise<ArrayBuffer>;
}
