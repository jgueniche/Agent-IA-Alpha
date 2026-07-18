'use client';

import { use, useEffect, useState } from 'react';
import {
  CallDetail,
  Transcript,
  getCall,
  getTranscript,
} from '../../../lib/calls';
import { AppShell } from '../../../components/AppShell';
import {
  Alerts,
  Badge,
  EmptyState,
  IconArrowLeft,
  LoadingCard,
  PageHeader,
} from '../../../components/ui';
import {
  DIRECTION,
  INTENT,
  OUTCOME,
  SITE,
  URGENCY,
  formatDateTime,
  labelOf,
  textOf,
} from '../../../lib/labels';

/** Détail d'un appel : fiche, qualification et transcription. */
export default function CallDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [call, setCall] = useState<CallDetail | null>(null);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCall(id)
      .then(setCall)
      .catch((e) => setError(e.message));
    getTranscript(id)
      .then(setTranscript)
      .catch(() => setTranscript(null));
  }, [id]);

  return (
    <AppShell>
      <a href="/calls" className="back-link">
        <IconArrowLeft style={{ width: 15, height: 15 }} />
        Journal d'appels
      </a>

      <Alerts error={error} />
      {!call && !error && <LoadingCard lines={4} />}

      {call && (
        <>
          <PageHeader
            title={`Appel — ${textOf(SITE, call.site)}`}
            sub={`${textOf(DIRECTION, call.direction)} · ${formatDateTime(call.startedAt)}`}
            actions={
              <>
                <Badge info={labelOf(OUTCOME, call.outcome)} />
                {call.urgency !== 'none' && (
                  <Badge info={labelOf(URGENCY, call.urgency)} />
                )}
              </>
            }
          />

          <div className="card card-pad" style={{ marginBottom: 20 }}>
            <div className="meta-grid">
              <div>
                <div className="meta-label">Début</div>
                <div className="meta-value">{formatDateTime(call.startedAt)}</div>
              </div>
              <div>
                <div className="meta-label">Fin</div>
                <div className="meta-value">{formatDateTime(call.endedAt)}</div>
              </div>
              <div>
                <div className="meta-label">Numéro appelant</div>
                <div className="meta-value">
                  {call.callerNumber ?? 'Non communiqué'}
                </div>
              </div>
              <div>
                <div className="meta-label">Résolu par l'IA</div>
                <div className="meta-value">{call.agentResolved ? 'Oui' : 'Non'}</div>
              </div>
              {call.transferredTo && (
                <div>
                  <div className="meta-label">Transféré vers</div>
                  <div className="meta-value">{call.transferredTo}</div>
                </div>
              )}
              {transcript?.intent && (
                <div>
                  <div className="meta-label">Motif détecté</div>
                  <div className="meta-value">{textOf(INTENT, transcript.intent)}</div>
                </div>
              )}
            </div>
          </div>

          {transcript?.summary && (
            <div
              className="card card-pad"
              style={{ marginBottom: 20, background: 'var(--surface-2)' }}
            >
              <div className="card-title">Résumé de l'appel</div>
              <p style={{ margin: 0, color: 'var(--text-2)' }}>{transcript.summary}</p>
            </div>
          )}

          <h2 className="section-title">Transcription</h2>
          {!transcript && (
            <div className="card">
              <EmptyState
                title="Pas de transcription"
                hint="Cet appel n'a pas de transcription disponible."
              />
            </div>
          )}
          {transcript && transcript.segments.length > 0 && (
            <div className="card card-pad">
              <div className="transcript">
                {transcript.segments.map((s, i) => {
                  const isPatient = s.speaker === 'patient';
                  return (
                    <div key={i} className={`bubble-row ${isPatient ? 'patient' : 'agent'}`}>
                      <div className="bubble">
                        <div className="bubble-speaker">
                          {isPatient ? 'Patient' : 'Agent IA'}
                        </div>
                        {s.text}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {transcript && transcript.segments.length === 0 && (
            <div className="card">
              <EmptyState
                title="Transcription vide"
                hint="Aucun échange n'a été capté sur cet appel (appel manqué ou raccroché)."
              />
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
