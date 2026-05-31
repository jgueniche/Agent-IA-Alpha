'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '../../lib/api';
import {
  Followup,
  cancelFollowup,
  createFollowup,
  dispatchFollowups,
  listFollowups,
} from '../../lib/followups';

/** Gestion des relances (programmation, suivi, opt-out via statut). */
export default function FollowupsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Followup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [patientId, setPatientId] = useState('');
  const [channel, setChannel] = useState('sms');
  const [template, setTemplate] = useState('rappel_rdv');

  async function reload() {
    try {
      setItems(await listFollowups());
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

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
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
    }
  }

  async function onDispatch() {
    setError(null);
    try {
      const r = await dispatchFollowups();
      setInfo(`${r.sent} relance(s) envoyée(s)`);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    }
  }

  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1>Relances</h1>
      {error && <p className="error">{error}</p>}
      {info && <p style={{ color: '#34d399' }}>{info}</p>}

      <form className="card" onSubmit={onCreate} style={{ maxWidth: '100%' }}>
        <strong>Programmer une relance</strong>
        <input placeholder="patientId (optionnel)" value={patientId} onChange={(e) => setPatientId(e.target.value)} />
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} style={{ padding: '0.4rem', borderRadius: 8 }}>
            <option value="sms">sms</option>
            <option value="whatsapp">whatsapp</option>
            <option value="voice">voice</option>
          </select>
          <input placeholder="template" value={template} onChange={(e) => setTemplate(e.target.value)} />
        </div>
        <button type="submit">Programmer (maintenant)</button>
      </form>

      <button onClick={onDispatch} style={{ width: 'auto', margin: '1rem 0' }}>
        Traiter les relances dues
      </button>

      {items.map((f) => (
        <div key={f.id} className="card" style={{ maxWidth: '100%', marginBottom: '0.5rem' }}>
          <strong>{f.template}</strong>{' '}
          <span style={{ opacity: 0.7, fontSize: '0.8rem' }}>
            [{f.channel} · {f.status}
            {f.marketing ? ' · marketing' : ' · transactionnel'}]
            {f.sentAt ? ` · envoyé ${new Date(f.sentAt).toLocaleString('fr-FR')}` : ''}
          </span>
          {(f.status === 'scheduled') && (
            <button
              style={{ width: 'auto', marginTop: '0.5rem' }}
              onClick={() => cancelFollowup(f.id).then(reload)}
            >
              Annuler
            </button>
          )}
        </div>
      ))}
    </main>
  );
}
