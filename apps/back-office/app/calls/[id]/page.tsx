'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '../../../lib/api';
import {
  CallDetail,
  Transcript,
  getCall,
  getTranscript,
} from '../../../lib/calls';

/** Détail d'un appel : métadonnées, numéro (tracé) et transcription. */
export default function CallDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [call, setCall] = useState<CallDetail | null>(null);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    getCall(id)
      .then(setCall)
      .catch((e) => setError(e.message));
    getTranscript(id)
      .then(setTranscript)
      .catch(() => setTranscript(null));
  }, [id, router]);

  if (error) return <main className="center"><p className="error">{error}</p></main>;
  if (!call) return <main className="center"><div className="card">Chargement…</div></main>;

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '2rem 1rem' }}>
      <a href="/calls" style={{ color: 'var(--accent)' }}>← Journal</a>
      <h1>Appel — {call.site ?? '?'}</h1>
      <div className="card" style={{ maxWidth: '100%' }}>
        <p>Début : {new Date(call.startedAt).toLocaleString('fr-FR')}</p>
        <p>Résultat : <strong>{call.outcome}</strong> {call.agentResolved ? '(résolu IA)' : ''}</p>
        <p>Numéro : {call.callerNumber ?? 'non communiqué'}</p>
        {call.transferredTo && <p>Transféré vers : {call.transferredTo}</p>}
      </div>

      <h2>Transcription</h2>
      {!transcript && <p>Pas de transcription.</p>}
      {transcript && (
        <div className="card" style={{ maxWidth: '100%' }}>
          {transcript.summary && (
            <p style={{ opacity: 0.85 }}>
              <em>Résumé : {transcript.summary}</em>
            </p>
          )}
          <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>
            Intention : {transcript.intent ?? '—'} · Urgence : {transcript.urgency}
          </p>
          {transcript.segments.map((s, i) => (
            <p key={i} style={{ margin: '0.3rem 0' }}>
              <strong>{s.speaker === 'patient' ? 'Patient' : 'Agent'} :</strong> {s.text}
            </p>
          ))}
        </div>
      )}
    </main>
  );
}
