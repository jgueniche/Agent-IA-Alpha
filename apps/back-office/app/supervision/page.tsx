'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '../../lib/api';
import { SupervisionMetrics, getMetrics } from '../../lib/supervision';

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="card" style={{ maxWidth: 220, display: 'inline-block', margin: '0.4rem' }}>
      <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{label}</div>
    </div>
  );
}

/** Tableau de supervision : résolution, transfert, latence, motifs, urgences. */
export default function SupervisionPage() {
  const router = useRouter();
  const [m, setM] = useState<SupervisionMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    getMetrics()
      .then(setM)
      .catch((e) => setError(e.message));
  }, [router]);

  if (error) return <main className="center"><p className="error">{error}</p></main>;
  if (!m) return <main className="center"><div className="card">Chargement…</div></main>;

  const pct = (n: number) => `${Math.round(n * 100)}%`;
  return (
    <main style={{ maxWidth: 920, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1>Supervision de l'agent</h1>
      <div>
        <Card label="Appels" value={String(m.calls.total)} />
        <Card label="Taux de résolution IA" value={pct(m.calls.resolutionRate)} />
        <Card label="Taux de transfert" value={pct(m.calls.transferRate)} />
        <Card label="Manqués" value={String(m.calls.missed)} />
        <Card
          label={`Latence perçue (cible ${m.latency.targetMs}ms)`}
          value={m.latency.avgPerceivedMs != null ? `${m.latency.avgPerceivedMs}ms` : '—'}
        />
        <Card label="Rappels en attente" value={String(m.callbacks.pending)} />
        <Card label="Relances envoyées" value={String(m.followups.sent)} />
      </div>

      <h2>Motifs</h2>
      <div className="card" style={{ maxWidth: '100%' }}>
        {Object.entries(m.byIntent).map(([k, v]) => (
          <span key={k} style={{ marginRight: '1rem' }}>{k} : <strong>{v}</strong></span>
        ))}
        {Object.keys(m.byIntent).length === 0 && <span>Aucune donnée.</span>}
      </div>

      <h2>Urgences</h2>
      <div className="card" style={{ maxWidth: '100%' }}>
        {Object.entries(m.byUrgency).map(([k, v]) => (
          <span key={k} style={{ marginRight: '1rem' }}>{k} : <strong>{v}</strong></span>
        ))}
        {Object.keys(m.byUrgency).length === 0 && <span>Aucune donnée.</span>}
      </div>
    </main>
  );
}
