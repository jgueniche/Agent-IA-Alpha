'use client';

import { useEffect, useState } from 'react';
import { SupervisionMetrics, getMetrics } from '../../lib/supervision';
import { AppShell } from '../../components/AppShell';
import { Alerts, LoadingCard, PageHeader } from '../../components/ui';
import { INTENT, URGENCY, formatDuration, labelOf, textOf } from '../../lib/labels';

function Stat({
  label,
  value,
  hint,
  mood,
}: {
  label: string;
  value: string;
  hint?: string;
  mood?: 'good' | 'warn' | 'bad';
}) {
  return (
    <div className={`stat${mood ? ` ${mood}` : ''}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

function BarList({
  title,
  data,
  labelFor,
  toneFor,
}: {
  title: string;
  data: Record<string, number>;
  labelFor: (key: string) => string;
  toneFor?: (key: string) => string;
}) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <div className="card card-pad">
      <div className="card-title">{title}</div>
      {entries.length === 0 && (
        <p className="td-muted" style={{ margin: 0 }}>
          Aucune donnée sur la période.
        </p>
      )}
      {entries.map(([key, count]) => (
        <div key={key} className="bar-row">
          <span className="bar-label">{labelFor(key)}</span>
          <div className="bar-track">
            <div
              className={`bar-fill${toneFor ? ` ${toneFor(key)}` : ''}`}
              style={{ width: `${(count / max) * 100}%` }}
            />
          </div>
          <span className="bar-count">{count}</span>
        </div>
      ))}
    </div>
  );
}

/** Supervision de l'agent : volumes, qualité, latence, répartitions. */
export default function SupervisionPage() {
  const [m, setM] = useState<SupervisionMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMetrics()
      .then(setM)
      .catch((e) => setError(e.message));
  }, []);

  const pct = (n: number) => `${Math.round(n * 100)} %`;

  return (
    <AppShell>
      <PageHeader
        title="Supervision de l'agent"
        sub="Volumes et qualité de service de l'agent vocal sur la période."
      />
      <Alerts error={error} />
      {!m && !error && <LoadingCard lines={4} />}

      {m && (
        <>
          <div className="stats">
            <Stat label="Appels traités" value={String(m.calls.total)} />
            <Stat
              label="Résolution par l'IA"
              value={pct(m.calls.resolutionRate)}
              hint={`${m.calls.resolvedByAgent} appel(s) résolu(s) sans humain`}
              mood={m.calls.resolutionRate >= 0.5 ? 'good' : 'warn'}
            />
            <Stat
              label="Transferts vers un humain"
              value={pct(m.calls.transferRate)}
              hint={`${m.calls.transferredToHuman} transfert(s)`}
            />
            <Stat
              label="Appels manqués"
              value={String(m.calls.missed)}
              mood={m.calls.missed > 0 ? 'bad' : 'good'}
            />
            <Stat
              label="Latence perçue"
              value={
                m.latency.avgPerceivedMs != null
                  ? `${m.latency.avgPerceivedMs} ms`
                  : '—'
              }
              hint={`cible : ${m.latency.targetMs} ms`}
              mood={
                m.latency.withinTarget == null
                  ? undefined
                  : m.latency.withinTarget
                    ? 'good'
                    : 'bad'
              }
            />
            <Stat
              label="Durée moyenne d'appel"
              value={formatDuration(m.avgDurationSeconds)}
            />
            <Stat
              label="Rappels en attente"
              value={String(m.callbacks.pending)}
              mood={m.callbacks.pending > 0 ? 'warn' : 'good'}
            />
            <Stat
              label="Relances envoyées"
              value={String(m.followups.sent)}
              hint={m.followups.failed > 0 ? `${m.followups.failed} en échec` : undefined}
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 14,
            }}
          >
            <BarList
              title="Motifs d'appel"
              data={m.byIntent}
              labelFor={(k) => textOf(INTENT, k)}
            />
            <BarList
              title="Niveaux d'urgence"
              data={m.byUrgency}
              labelFor={(k) => labelOf(URGENCY, k).label}
              toneFor={(k) =>
                k === 'critical' || k === 'high'
                  ? 'red'
                  : k === 'medium'
                    ? 'amber'
                    : ''
              }
            />
          </div>
        </>
      )}
    </AppShell>
  );
}
