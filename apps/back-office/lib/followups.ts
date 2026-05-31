/** Accès API au moteur de relances (back-office). */
import { getToken } from './api';

const API_URL = process.env.NEXT_PUBLIC_CORE_API_URL ?? 'http://localhost:4000';

function authHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
  };
}

export interface Followup {
  id: string;
  patientId: string | null;
  channel: string;
  template: string;
  marketing: boolean;
  scheduledAt: string;
  status: string;
  sentAt: string | null;
  providerRef: string | null;
}

export async function listFollowups(): Promise<Followup[]> {
  const res = await fetch(`${API_URL}/api/followups`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Lecture des relances impossible');
  return res.json();
}

export async function createFollowup(body: {
  patientId?: string;
  channel: string;
  template: string;
  scheduledAt: string;
  marketing?: boolean;
}): Promise<Followup> {
  const res = await fetch(`${API_URL}/api/followups`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Création impossible');
  return res.json();
}

export async function cancelFollowup(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/followups/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Annulation impossible');
}

export async function dispatchFollowups(): Promise<{ sent: number }> {
  const res = await fetch(`${API_URL}/api/followups/dispatch`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Traitement impossible');
  return res.json();
}
