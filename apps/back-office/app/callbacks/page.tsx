'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '../../lib/api';
import {
  CallbackTask,
  assignMe,
  clickToCall,
  listCallbacks,
  updateCallback,
} from '../../lib/callbacks';

const STATUSES = ['pending', 'assigned', 'in_progress', 'done', 'cancelled'];

/** File de rappel : appels non résolus à traiter par les secrétaires. */
export default function CallbacksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<CallbackTask[]>([]);
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
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    void reload();
  }, [router]);

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
    try {
      const r = await clickToCall(id);
      setInfo(`Rappel initié vers ${r.to}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    }
  }

  return (
    <main style={{ maxWidth: 920, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1>File de rappel</h1>
      {error && <p className="error">{error}</p>}
      {info && <p style={{ color: '#34d399' }}>{info}</p>}
      {tasks.length === 0 && <p>Aucune tâche de rappel.</p>}
      {tasks.map((t) => (
        <div key={t.id} className="card" style={{ maxWidth: '100%', marginBottom: '0.75rem' }}>
          <strong>{t.motif}</strong>{' '}
          <span style={{ opacity: 0.7, fontSize: '0.8rem' }}>
            [{t.status}
            {t.urgency !== 'none' ? ` · urgence ${t.urgency}` : ''}
            {t.assignedTo ? ` · ${t.assignedTo.displayName}` : ' · non assigné'}]
            {t.call?.site ? ` · ${t.call.site.slug}` : ''}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            <button style={{ width: 'auto' }} onClick={() => act(() => assignMe(t.id), 'Assigné')}>
              S'assigner
            </button>
            <button style={{ width: 'auto' }} onClick={() => onCall(t.id)}>
              📞 Rappeler
            </button>
            <select
              value={t.status}
              onChange={(e) => act(() => updateCallback(t.id, { status: e.target.value }))}
              style={{ padding: '0.4rem', borderRadius: 8 }}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      ))}
    </main>
  );
}
