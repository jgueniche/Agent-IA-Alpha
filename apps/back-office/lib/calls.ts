/** Accès API au journal d'appels + transcriptions (back-office). */
import { getToken } from './api';

const API_URL = process.env.NEXT_PUBLIC_CORE_API_URL ?? 'http://localhost:4000';

function authHeaders(): HeadersInit {
  return { Authorization: `Bearer ${getToken()}` };
}

export interface CallSummary {
  id: string;
  site: string;
  direction: string;
  startedAt: string;
  durationSeconds: number | null;
  outcome: string;
  urgency: string;
}

export interface CallDetail extends CallSummary {
  endedAt: string | null;
  agentResolved: boolean;
  transferredTo: string | null;
  callerNumber: string | null;
}

export interface TranscriptSegment {
  speaker: string;
  ts: number;
  text: string;
}

export interface Transcript {
  callId: string;
  segments: TranscriptSegment[];
  summary: string | null;
  intent: string | null;
  urgency: string;
}

export async function listCalls(): Promise<CallSummary[]> {
  const res = await fetch(`${API_URL}/api/calls`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Lecture du journal impossible');
  return res.json();
}

export async function getCall(id: string): Promise<CallDetail> {
  const res = await fetch(`${API_URL}/api/calls/${id}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Appel introuvable');
  return res.json();
}

export async function getTranscript(id: string): Promise<Transcript | null> {
  const res = await fetch(`${API_URL}/api/calls/${id}/transcript`, {
    headers: authHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Transcription indisponible');
  return res.json();
}
