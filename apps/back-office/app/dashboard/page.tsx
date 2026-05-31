'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearToken, getToken, me } from '../../lib/api';

interface Profile {
  email: string;
  displayName: string;
  role: string;
  permissions: string[];
}

/** Tableau de bord (coquille Phase 0) : confirme la session et le role. */
export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    me()
      .then(setProfile)
      .catch((e) => setError(e.message));
  }, [router]);

  function logout() {
    clearToken();
    router.replace('/login');
  }

  if (error) {
    return (
      <main className="center">
        <div className="card">
          <p className="error">{error}</p>
          <button onClick={() => router.replace('/login')}>Se reconnecter</button>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="center">
        <div className="card">Chargement…</div>
      </main>
    );
  }

  return (
    <main className="center">
      <div className="card">
        <h1>Bonjour {profile.displayName}</h1>
        <p>
          Role : <strong>{profile.role}</strong>
        </p>
        <p style={{ fontSize: '0.8rem', opacity: 0.8 }}>
          {profile.permissions.length} permission(s) — le tableau de bord
          temps reel arrive en Phase 5.
        </p>
        <a href="/calls" style={{ color: 'var(--accent)', display: 'block' }}>
          → Journal d'appels
        </a>
        <a href="/callbacks" style={{ color: 'var(--accent)', display: 'block' }}>
          → File de rappel
        </a>
        <a href="/followups" style={{ color: 'var(--accent)', display: 'block' }}>
          → Relances
        </a>
        <a href="/knowledge" style={{ color: 'var(--accent)', display: 'block' }}>
          → Base de connaissance imagerie
        </a>
        <button onClick={logout} style={{ marginTop: '0.75rem' }}>
          Se deconnecter
        </button>
      </div>
    </main>
  );
}
