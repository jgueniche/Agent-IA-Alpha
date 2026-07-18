'use client';

import { useEffect, useState } from 'react';
import {
  KnowledgeItem,
  listKnowledge,
  updateKnowledgeContent,
  validateKnowledge,
} from '../../lib/knowledge';
import { AppShell } from '../../components/AppShell';
import {
  Alerts,
  Badge,
  EmptyState,
  IconBook,
  IconCheck,
  LoadingCard,
  PageHeader,
} from '../../components/ui';
import {
  KNOWLEDGE_TYPE,
  MODALITY,
  SITE,
  labelOf,
  textOf,
} from '../../lib/labels';

/**
 * Base de connaissance imagerie : contenus que l'agent utilise pour répondre.
 * Chaque modification crée une nouvelle version ; la validation est tracée.
 */
export default function KnowledgePage() {
  const [items, setItems] = useState<KnowledgeItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

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
    void reload();
  }, []);

  async function onSave(id: string) {
    setError(null);
    setInfo(null);
    setSavingId(id);
    try {
      await updateKnowledgeContent(id, drafts[id] ?? '');
      setInfo('Contenu enregistré (nouvelle version à valider)');
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSavingId(null);
    }
  }

  async function onValidate(id: string) {
    setError(null);
    setInfo(null);
    try {
      await validateKnowledge(id);
      setInfo('Contenu validé — l’agent peut désormais l’utiliser');
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Base de connaissance imagerie"
        sub="Ce que l'agent répond aux patients : préparations, contre-indications, horaires, accès. Toute modification doit être validée."
      />
      <Alerts error={error} info={info} />

      {!items && !error && <LoadingCard lines={4} />}

      {items && items.length === 0 && (
        <div className="card">
          <EmptyState
            icon={IconBook}
            title="Base de connaissance vide"
            hint="Les contenus seront ajoutés lors de l'initialisation (seed) ou par un responsable."
          />
        </div>
      )}

      {items?.map((it) => {
        const dirty = (drafts[it.id] ?? '') !== it.content;
        return (
          <div key={it.id} className="card card-pad" style={{ marginBottom: 12 }}>
            <div className="row" style={{ marginBottom: 8 }}>
              <span className="td-strong" style={{ fontSize: 14.5 }}>{it.title}</span>
              <Badge info={labelOf(KNOWLEDGE_TYPE, it.type)} />
              {it.modality && (
                <span className="badge neutral">{textOf(MODALITY, it.modality)}</span>
              )}
              {it.siteSlug && (
                <span className="badge neutral">{textOf(SITE, it.siteSlug)}</span>
              )}
              <span className="spacer" />
              <span className="td-muted">v{it.version}</span>
              {it.validatedById ? (
                <Badge info={{ label: 'Validé', tone: 'green' }} />
              ) : (
                <Badge info={{ label: 'À valider', tone: 'amber' }} />
              )}
            </div>
            <textarea
              className="textarea"
              rows={3}
              value={drafts[it.id] ?? ''}
              onChange={(e) =>
                setDrafts((d) => ({ ...d, [it.id]: e.target.value }))
              }
            />
            <div className="row" style={{ marginTop: 10 }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => onSave(it.id)}
                disabled={!dirty || savingId === it.id}
              >
                {savingId === it.id ? 'Enregistrement…' : 'Enregistrer'}
              </button>
              {!it.validatedById && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => onValidate(it.id)}
                >
                  <IconCheck />
                  Valider
                </button>
              )}
              {dirty && (
                <span className="td-muted">Modifications non enregistrées</span>
              )}
            </div>
          </div>
        );
      })}
    </AppShell>
  );
}
