/** Accès API à la base de connaissance (back-office). */
import { getToken } from './api';

const API_URL = process.env.NEXT_PUBLIC_CORE_API_URL ?? 'http://localhost:4000';

export interface KnowledgeItem {
  id: string;
  key: string;
  modality: string | null;
  type: string;
  title: string;
  content: string;
  siteSlug: string | null;
  version: number;
  isActive: boolean;
  validatedById: string | null;
  validatedAt: string | null;
}

function authHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
  };
}

export async function listKnowledge(): Promise<KnowledgeItem[]> {
  const res = await fetch(`${API_URL}/api/knowledge`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Lecture de la base de connaissance impossible');
  return res.json();
}

export async function updateKnowledgeContent(
  id: string,
  content: string,
): Promise<KnowledgeItem> {
  const res = await fetch(`${API_URL}/api/knowledge/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error('Enregistrement impossible (droits insuffisants ?)');
  return res.json();
}

export async function validateKnowledge(id: string): Promise<KnowledgeItem> {
  const res = await fetch(`${API_URL}/api/knowledge/${id}/validate`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Validation impossible (droits insuffisants ?)');
  return res.json();
}
