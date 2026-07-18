'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login, setToken } from '../../lib/api';
import { Alerts } from '../../components/ui';

/** Page de connexion secrétaire / responsable / admin. */
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
    <main className="login-page">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="login-brand">
          <div className="brand-mark">AI</div>
          <div>
            <div className="login-title">Alpha Imagerie</div>
            <div className="brand-sub">Back-office de l'agent vocal</div>
          </div>
        </div>

        <div className="field">
          <label htmlFor="email">Adresse e-mail</label>
          <input
            id="email"
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            placeholder="prenom.nom@alpha-imagerie.fr"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="password">Mot de passe</label>
          <input
            id="password"
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="mfa">Code MFA (si activé)</label>
          <input
            id="mfa"
            className="input"
            type="text"
            inputMode="numeric"
            value={mfaToken}
            onChange={(e) => setMfaToken(e.target.value)}
            placeholder="123456"
          />
        </div>

        <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>

        <div style={{ marginTop: 14 }}>
          <Alerts error={error} />
        </div>

        <div className="login-hint">
          Accès réservé au personnel d'Alpha Imagerie (Cergy · Goussainville).
          En cas de problème de connexion, contactez votre responsable.
        </div>
      </form>
    </main>
  );
}
