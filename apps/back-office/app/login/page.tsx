'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login, setToken } from '../../lib/api';

/** Page de connexion secretaire/admin (Phase 0). */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await login(email, password, mfaToken || undefined);
      setToken(result.tokens.accessToken);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="center">
      <form className="card" onSubmit={onSubmit}>
        <h1>Alpha Imagerie — Back-office</h1>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
        />
        <label htmlFor="password">Mot de passe</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        <label htmlFor="mfa">Code MFA (si active)</label>
        <input
          id="mfa"
          type="text"
          inputMode="numeric"
          value={mfaToken}
          onChange={(e) => setMfaToken(e.target.value)}
          placeholder="123456"
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </main>
  );
}
