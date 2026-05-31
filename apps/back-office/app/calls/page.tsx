'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '../../lib/api';
import { CallSummary, listCalls } from '../../lib/calls';

/** Journal d'appels (back-office). */
export default function CallsPage() {
  const router = useRouter();
  const [calls, setCalls] = useState<CallSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    listCalls()
      .then(setCalls)
      .catch((e) => setError(e.message));
  }, [router]);

  return (
    <main style={{ maxWidth: 920, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1>Journal d'appels</h1>
      {error && <p className="error">{error}</p>}
      {calls.length === 0 && <p>Aucun appel.</p>}
      {calls.map((c) => (
        <div key={c.id} className="card" style={{ maxWidth: '100%', marginBottom: '0.5rem' }}>
          <a href={`/calls/${c.id}`} style={{ color: 'var(--accent)' }}>
            {new Date(c.startedAt).toLocaleString('fr-FR')} — {c.site} · {c.direction}
          </a>
          <span style={{ opacity: 0.7, fontSize: '0.8rem' }}>
            {' '}
            · {c.outcome}
            {c.urgency !== 'none' ? ` · urgence ${c.urgency}` : ''}
            {c.durationSeconds != null ? ` · ${c.durationSeconds}s` : ''}
          </span>
        </div>
      ))}
    </main>
  );
}
