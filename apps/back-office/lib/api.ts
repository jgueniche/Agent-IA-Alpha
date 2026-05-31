/**
 * Petit client HTTP vers core-api (Phase 0).
 * Le jeton d'acces est stocke cote client (localStorage) pour la demo ;
 * en production il sera porte par un cookie HttpOnly + refresh securise.
 */
const API_URL =
  process.env.NEXT_PUBLIC_CORE_API_URL ?? 'http://localhost:4000';

const TOKEN_KEY = 'alpha_access_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

export interface LoginResult {
  user: {
    id: string;
    email: string;
    displayName: string;
    role: string;
    permissions: string[];
  };
  tokens: { accessToken: string; refreshToken: string; expiresIn: number };
}

export async function login(
  email: string,
  password: string,
  mfaToken?: string,
): Promise<LoginResult> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, mfaToken }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? 'Echec de connexion');
  }
  return res.json();
}

export async function me() {
  const token = getToken();
  const res = await fetch(`${API_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Session expiree');
  return res.json();
}
