'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CallSummary, listCalls } from '../../lib/calls';
import { AppShell } from '../../components/AppShell';
import {
  Alerts,
  Badge,
  EmptyState,
  IconPhone,
  LoadingCard,
  PageHeader,
} from '../../components/ui';
import {
  DIRECTION,
  OUTCOME,
  SITE,
  URGENCY,
  formatDateTime,
  formatDuration,
  labelOf,
  textOf,
} from '../../lib/labels';

/** Journal des appels pris par l'agent vocal. */
export default function CallsPage() {
  const router = useRouter();
  const [calls, setCalls] = useState<CallSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCalls()
      .then(setCalls)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <AppShell>
      <PageHeader
        title="Journal d'appels"
        sub="Tous les appels traités par l'agent vocal, du plus récent au plus ancien."
      />
      <Alerts error={error} />

      {!calls && !error && <LoadingCard lines={4} />}

      {calls && calls.length === 0 && (
        <div className="card">
          <EmptyState
            icon={IconPhone}
            title="Aucun appel pour le moment"
            hint="Les appels apparaîtront ici dès que l'agent vocal en aura traité."
          />
        </div>
      )}

      {calls && calls.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Site</th>
                <th>Sens</th>
                <th>Résultat</th>
                <th>Urgence</th>
                <th>Durée</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((c) => (
                <tr
                  key={c.id}
                  className="clickable"
                  onClick={() => router.push(`/calls/${c.id}`)}
                >
                  <td className="td-strong">{formatDateTime(c.startedAt)}</td>
                  <td>{textOf(SITE, c.site)}</td>
                  <td className="td-muted">{textOf(DIRECTION, c.direction)}</td>
                  <td>
                    <Badge info={labelOf(OUTCOME, c.outcome)} />
                  </td>
                  <td>
                    {c.urgency && c.urgency !== 'none' ? (
                      <Badge info={labelOf(URGENCY, c.urgency)} />
                    ) : (
                      <span className="td-muted">—</span>
                    )}
                  </td>
                  <td className="td-muted">{formatDuration(c.durationSeconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
