'use client';

import { useEffect, useState } from 'react';
import {
  CallbackTask,
  assignMe,
  clickToCall,
  listCallbacks,
  updateCallback,
} from '../../lib/callbacks';
import { AppShell } from '../../components/AppShell';
import {
  Alerts,
  Badge,
  EmptyState,
  IconPhone,
  IconPhoneCallback,
  LoadingCard,
  PageHeader,
} from '../../components/ui';
import {
  CALLBACK_STATUS,
  SITE,
  URGENCY,
  formatDateTime,
  labelOf,
  textOf,
} from '../../lib/labels';

const STATUSES = ['pending', 'assigned', 'in_progress', 'done', 'cancelled'];

/** File de rappel : appels non résolus, à traiter par les secrétaires. */
export default function CallbacksPage() {
  const [tasks, setTasks] = useState<CallbackTask[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function reload() {
    try {
      setTasks(await listCallbacks());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function act(fn: () => Promise<unknown>, ok?: string) {
    setError(null);
    setInfo(null);
    try {
      await fn();
      if (ok) setInfo(ok);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    }
  }

  async function onCall(id: string) {
    setError(null);
    setInfo(null);
    try {
      const r = await clickToCall(id);
      setInfo(`Rappel initié vers ${r.to}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    }
  }

  const open = tasks?.filter((t) => !['done', 'cancelled'].includes(t.status)) ?? [];
  const closed = tasks?.filter((t) => ['done', 'cancelled'].includes(t.status)) ?? [];

  function TaskCard({ t }: { t: CallbackTask }) {
    return (
      <div className="card card-pad" style={{ marginBottom: 10 }}>
        <div className="row" style={{ marginBottom: 8 }}>
          <span className="td-strong" style={{ fontSize: 14.5 }}>{t.motif}</span>
          <Badge info={labelOf(CALLBACK_STATUS, t.status)} />
          {t.urgency !== 'none' && <Badge info={labelOf(URGENCY, t.urgency)} />}
          <span className="spacer" />
          <span className="td-muted">
            {t.call?.site ? `${textOf(SITE, t.call.site.slug)} · ` : ''}
            {formatDateTime(t.createdAt)}
          </span>
        </div>
        <div className="row" style={{ marginBottom: 10 }}>
          <span className="td-muted">
            {t.assignedTo
              ? `Assignée à ${t.assignedTo.displayName}`
              : 'Non assignée'}
            {t.dueAt ? ` · à rappeler avant ${formatDateTime(t.dueAt)}` : ''}
          </span>
        </div>
        {t.notes && (
          <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text-2)' }}>
            {t.notes}
          </p>
        )}
        <div className="row">
          {!['done', 'cancelled'].includes(t.status) && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => onCall(t.id)}
            >
              <IconPhone />
              Rappeler
            </button>
          )}
          {!t.assignedTo && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => act(() => assignMe(t.id), 'Tâche assignée')}
            >
              Me l'assigner
            </button>
          )}
          <span className="spacer" />
          <select
            className="select select-sm"
            value={t.status}
            onChange={(e) => act(() => updateCallback(t.id, { status: e.target.value }))}
            aria-label="Changer le statut"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {labelOf(CALLBACK_STATUS, s).label}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="File de rappel"
        sub="Patients à rappeler suite aux appels que l'agent n'a pas pu résoudre."
      />
      <Alerts error={error} info={info} />

      {!tasks && !error && <LoadingCard lines={4} />}

      {tasks && tasks.length === 0 && (
        <div className="card">
          <EmptyState
            icon={IconPhoneCallback}
            title="Aucun rappel en attente"
            hint="Bravo, la file est vide. Les nouvelles demandes apparaîtront ici."
          />
        </div>
      )}

      {open.map((t) => (
        <TaskCard key={t.id} t={t} />
      ))}

      {closed.length > 0 && (
        <>
          <h2 className="section-title">Traitées récemment</h2>
          {closed.map((t) => (
            <TaskCard key={t.id} t={t} />
          ))}
        </>
      )}
    </AppShell>
  );
}
