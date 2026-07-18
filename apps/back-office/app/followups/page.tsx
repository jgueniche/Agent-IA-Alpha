'use client';

import { useEffect, useState } from 'react';
import {
  Followup,
  cancelFollowup,
  createFollowup,
  dispatchFollowups,
  listFollowups,
} from '../../lib/followups';
import { AppShell } from '../../components/AppShell';
import {
  Alerts,
  Badge,
  EmptyState,
  IconSend,
  LoadingCard,
  PageHeader,
} from '../../components/ui';
import {
  CHANNEL,
  FOLLOWUP_STATUS,
  formatDateTime,
  labelOf,
} from '../../lib/labels';

/** Relances multicanal : programmation, envoi et suivi. */
export default function FollowupsPage() {
  const [items, setItems] = useState<Followup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [patientId, setPatientId] = useState('');
  const [channel, setChannel] = useState('sms');
  const [template, setTemplate] = useState('rappel_rdv');
  const [busy, setBusy] = useState(false);

  async function reload() {
    try {
      setItems(await listFollowups());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      await createFollowup({
        patientId: patientId || undefined,
        channel,
        template,
        scheduledAt: new Date().toISOString(),
      });
      setInfo('Relance programmée');
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  async function onDispatch() {
    setError(null);
    setInfo(null);
    try {
      const r = await dispatchFollowups();
      setInfo(`${r.sent} relance(s) envoyée(s)`);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    }
  }

  async function onCancel(id: string) {
    setError(null);
    setInfo(null);
    try {
      await cancelFollowup(id);
      setInfo('Relance annulée');
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Relances"
        sub="Rappels SMS, WhatsApp ou vocaux envoyés aux patients (consentement et fenêtres horaires gérés automatiquement)."
        actions={
          <button className="btn btn-secondary" onClick={onDispatch}>
            <IconSend />
            Traiter les relances dues
          </button>
        }
      />
      <Alerts error={error} info={info} />

      <form className="card card-pad" onSubmit={onCreate} style={{ marginBottom: 20 }}>
        <div className="card-title">Programmer une relance</div>
        <div className="row" style={{ alignItems: 'flex-end', gap: 12 }}>
          <div className="field" style={{ flex: 2, minWidth: 180, marginBottom: 0 }}>
            <label htmlFor="patientId">Identifiant patient (optionnel)</label>
            <input
              id="patientId"
              className="input"
              placeholder="ex. pat_0192…"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
            />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 130, marginBottom: 0 }}>
            <label htmlFor="channel">Canal</label>
            <select
              id="channel"
              className="select"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
            >
              <option value="sms">SMS</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="voice">Appel vocal</option>
            </select>
          </div>
          <div className="field" style={{ flex: 1, minWidth: 140, marginBottom: 0 }}>
            <label htmlFor="template">Modèle</label>
            <input
              id="template"
              className="input"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            Programmer
          </button>
        </div>
      </form>

      {!items && !error && <LoadingCard lines={4} />}

      {items && items.length === 0 && (
        <div className="card">
          <EmptyState
            icon={IconSend}
            title="Aucune relance"
            hint="Programmez une relance ci-dessus, ou attendez que l'agent en génère."
          />
        </div>
      )}

      {items && items.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Modèle</th>
                <th>Canal</th>
                <th>Statut</th>
                <th>Type</th>
                <th>Programmée / envoyée</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((f) => (
                <tr key={f.id}>
                  <td className="td-strong">{f.template}</td>
                  <td>
                    <Badge info={labelOf(CHANNEL, f.channel)} />
                  </td>
                  <td>
                    <Badge info={labelOf(FOLLOWUP_STATUS, f.status)} />
                  </td>
                  <td className="td-muted">
                    {f.marketing ? 'Marketing' : 'Transactionnel'}
                  </td>
                  <td className="td-muted">
                    {f.sentAt
                      ? `Envoyée ${formatDateTime(f.sentAt)}`
                      : formatDateTime(f.scheduledAt)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {f.status === 'scheduled' && (
                      <button
                        className="btn btn-danger-ghost btn-sm"
                        onClick={() => onCancel(f.id)}
                      >
                        Annuler
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
