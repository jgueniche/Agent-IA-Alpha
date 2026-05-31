/** Accès API à la file de rappel (back-office). */
import { getToken } from './api';

const API_URL = process.env.NEXT_PUBLIC_CORE_API_URL ?? 'http://localhost:4000';

function authHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
  };
}

export interface CallbackTask {
  id: string;
  motif: string;
  urgency: string;
  status: string;
  notes: string | null;
  dueAt: string | null;
  createdAt: string;
  assignedTo: { id: string; displayName: string } | null;
  call: { id: string; startedAt: string; outcome: string; site: { slug: string } | null } | null;
}

export async function listCallbacks(status?: string): Promise<CallbackTask[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await fetch(`${API_URL}/api/callbacks${qs}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Lecture de la file impossible');
  return res.json();
}

export async function assignMe(id: string): Promise<CallbackTask> {
  const res = await fetch(`${API_URL}/api/callbacks/${id}/assign-me`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Assignation impossible');
  return res.json();
}

export async function updateCallback(
  id: string,
  body: { status?: string; notes?: string },
): Promise<CallbackTask> {
  const res = await fetch(`${API_URL}/api/callbacks/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Mise à jour impossible');
  return res.json();
}

export async function clickToCall(id: string): Promise<{ status: string; to: string }> {
  const res = await fetch(`${API_URL}/api/callbacks/${id}/click-to-call`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Rappel impossible (numéro manquant ?)');
  return res.json();
}
