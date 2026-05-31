'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '../../lib/api';
import {
  KnowledgeItem,
  listKnowledge,
  updateKnowledgeContent,
  validateKnowledge,
} from '../../lib/knowledge';

/**
 * Édition de la base de connaissance imagerie (Phase 3).
 * Versioning + validation gérés côté core-api ; ici une vue d'édition simple
 * (le tableau de bord complet arrive en Phase 5).
 */
export default function KnowledgePage() {
  const router = useRouter();
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  async function reload() {
    try {
      const data = await listKnowledge();
      setItems(data);
      setDrafts(Object.fromEntries(data.map((i) => [i.id, i.content])));
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

  async function onSave(id: string) {
    setError(null);
    try {
      await updateKnowledgeContent(id, drafts[id] ?? '');
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    }
  }

  async function onValidate(id: string) {
    setError(null);
    try {
      await validateKnowledge(id);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    }
  }

  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1>Base de connaissance imagerie</h1>
      {error && <p className="error">{error}</p>}
      {items.map((it) => (
        <div key={it.id} className="card" style={{ maxWidth: '100%', marginBottom: '1rem' }}>
          <strong>{it.title}</strong>{' '}
          <span style={{ opacity: 0.7, fontSize: '0.8rem' }}>
            [{it.type}
            {it.modality ? ` · ${it.modality}` : ''}
            {it.siteSlug ? ` · ${it.siteSlug}` : ''}] v{it.version} —{' '}
            {it.validatedById ? '✅ validé' : '⏳ à valider'}
          </span>
          <textarea
            rows={3}
            style={{ width: '100%', marginTop: '0.5rem' }}
            value={drafts[it.id] ?? ''}
            onChange={(e) =>
              setDrafts((d) => ({ ...d, [it.id]: e.target.value }))
            }
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button style={{ width: 'auto' }} onClick={() => onSave(it.id)}>
              Enregistrer
            </button>
            <button style={{ width: 'auto' }} onClick={() => onValidate(it.id)}>
              Valider
            </button>
          </div>
        </div>
      ))}
    </main>
  );
}
