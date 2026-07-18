'use client';

import { useEffect, useRef, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import {
  Alerts,
  IconMic,
  IconPhone,
  IconStop,
  PageHeader,
} from '../../components/ui';

const VOICE_URL =
  process.env.NEXT_PUBLIC_VOICE_GATEWAY_URL ?? 'http://localhost:8080';

type CallState =
  | 'idle'
  | 'connecting'
  | 'loading_models'
  | 'ready'
  | 'recording'
  | 'thinking'
  | 'ended'
  | 'error';

interface Turn {
  speaker: 'patient' | 'agent';
  text: string;
}

const STATE_LABELS: Record<CallState, string> = {
  idle: 'Prêt à appeler',
  connecting: 'Connexion…',
  loading_models: 'Préparation des modèles vocaux (long au 1er lancement)…',
  ready: 'En ligne — à vous de parler',
  recording: 'Je vous écoute…',
  thinking: "L'agent réfléchit…",
  ended: 'Appel terminé',
  error: 'Erreur',
};

/** Encode des échantillons Float32 en WAV PCM16 mono. */
function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  v.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  writeStr(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buf;
}

/**
 * Appel de test : parler à l'agent vocal depuis le navigateur (micro),
 * sans téléphonie. L'appel est journalisé comme un appel réel.
 */
export default function TestAgentPage() {
  const [site, setSite] = useState('cergy');
  const [state, setState] = useState<CallState>('idle');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [callId, setCallId] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const playerRef = useRef<HTMLAudioElement | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: 999999, behavior: 'smooth' });
  }, [turns]);

  useEffect(() => () => cleanup(), []);

  function cleanup() {
    wsRef.current?.close();
    wsRef.current = null;
    processorRef.current?.disconnect();
    processorRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void audioCtxRef.current?.close();
    audioCtxRef.current = null;
  }

  function playWav(data: ArrayBuffer) {
    const url = URL.createObjectURL(new Blob([data], { type: 'audio/wav' }));
    if (playerRef.current) {
      playerRef.current.src = url;
      void playerRef.current.play().catch(() => undefined);
    }
  }

  async function startCall() {
    setError(null);
    setInfo(null);
    setTurns([]);
    setCallId(null);
    setState('connecting');
    try {
      // Micro d'abord (permission), puis WebSocket.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      const wsUrl = `${VOICE_URL.replace(/^http/, 'ws')}/ws/test-call?site=${site}`;
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        if (ev.data instanceof ArrayBuffer) {
          playWav(ev.data);
          setState('ready');
          return;
        }
        const msg = JSON.parse(ev.data as string);
        switch (msg.type) {
          case 'status':
            if (msg.state === 'loading_models') setState('loading_models');
            break;
          case 'ready':
            setCallId(msg.callId);
            setState('ready');
            break;
          case 'turn':
            setTurns((t) => [
              ...t,
              ...(msg.patient
                ? [{ speaker: 'patient' as const, text: msg.patient }]
                : []),
              { speaker: 'agent' as const, text: msg.agent },
            ]);
            break;
          case 'empty':
            setInfo("Je n'ai rien entendu — parlez un peu plus longtemps.");
            setState('ready');
            break;
          case 'transfer':
            setInfo(
              `En téléphonie réelle, l'appel serait transféré ici vers le poste ${msg.target} (secrétaire).`,
            );
            break;
          case 'ended':
            setState('ended');
            break;
          case 'error':
            setError(msg.message);
            setState('error');
            break;
        }
      };
      ws.onerror = () => {
        setError(
          `Impossible de joindre la passerelle voix (${VOICE_URL}). ` +
            'Vérifiez que le conteneur voice-gateway est démarré.',
        );
        setState('error');
      };
      ws.onclose = () => {
        setState((s) => (s === 'error' || s === 'ended' ? s : 'ended'));
      };
    } catch {
      setError(
        "Accès au micro refusé. Autorisez le micro pour ce site dans votre navigateur.",
      );
      setState('error');
    }
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream || state !== 'ready') return;
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;
    chunksRef.current = [];
    processor.onaudioprocess = (e) => {
      chunksRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    };
    source.connect(processor);
    processor.connect(ctx.destination);
    setInfo(null);
    setState('recording');
  }

  function stopRecording() {
    const ctx = audioCtxRef.current;
    const ws = wsRef.current;
    processorRef.current?.disconnect();
    processorRef.current = null;
    if (!ctx || !ws || ws.readyState !== WebSocket.OPEN) return;
    const sampleRate = ctx.sampleRate;
    void ctx.close();
    audioCtxRef.current = null;

    const total = chunksRef.current.reduce((n, c) => n + c.length, 0);
    const merged = new Float32Array(total);
    let off = 0;
    for (const c of chunksRef.current) {
      merged.set(c, off);
      off += c.length;
    }
    chunksRef.current = [];
    ws.send(encodeWav(merged, sampleRate));
    setState('thinking');
  }

  function endCall() {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'end' }));
    }
    processorRef.current?.disconnect();
    processorRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  const inCall = !['idle', 'ended', 'error'].includes(state);
  const statusClass =
    state === 'ready' || state === 'recording'
      ? 'live'
      : state === 'error'
        ? 'err'
        : inCall
          ? 'busy'
          : '';

  return (
    <AppShell>
      <PageHeader
        title="Tester l'agent"
        sub="Parlez à l'agent vocal depuis votre micro, sans téléphonie. L'appel est journalisé comme un appel réel (journal, transcription, métriques)."
      />
      <Alerts error={error} info={info} />

      <div className="call-panel">
        <div className="card card-pad" style={{ textAlign: 'center' }}>
          <div className="field" style={{ textAlign: 'left' }}>
            <label htmlFor="site">Site appelé</label>
            <select
              id="site"
              className="select"
              value={site}
              onChange={(e) => setSite(e.target.value)}
              disabled={inCall}
            >
              <option value="cergy">Cergy</option>
              <option value="goussainville">Goussainville</option>
            </select>
          </div>

          <div style={{ margin: '12px 0 16px' }}>
            <span className={`call-status ${statusClass}`}>
              {STATE_LABELS[state]}
            </span>
          </div>

          {!inCall && (
            <button className="btn btn-primary btn-block" onClick={startCall}>
              <IconPhone />
              Démarrer un appel de test
            </button>
          )}

          {inCall && (
            <>
              <div style={{ display: 'grid', placeItems: 'center', margin: '10px 0' }}>
                {state !== 'recording' ? (
                  <button
                    className="talk-btn"
                    onClick={startRecording}
                    disabled={state !== 'ready'}
                    title="Cliquez puis parlez"
                    aria-label="Parler"
                  >
                    <IconMic />
                  </button>
                ) : (
                  <button
                    className="talk-btn recording"
                    onClick={stopRecording}
                    title="Cliquez pour envoyer"
                    aria-label="Envoyer"
                  >
                    <IconStop />
                  </button>
                )}
              </div>
              <p className="td-muted" style={{ margin: '0 0 14px' }}>
                {state === 'recording'
                  ? 'Parlez, puis cliquez pour envoyer.'
                  : 'Cliquez sur le micro, parlez, puis cliquez à nouveau.'}
              </p>
              <button className="btn btn-secondary btn-block" onClick={endCall}>
                Raccrocher
              </button>
            </>
          )}

          {state === 'ended' && callId && (
            <p style={{ marginTop: 14, fontSize: 13 }}>
              <a href={`/calls/${callId}`}>Voir l'appel dans le journal →</a>
            </p>
          )}

          <audio ref={playerRef} hidden />
        </div>

        <div className="card card-pad call-transcript" ref={transcriptRef}>
          {turns.length === 0 && (
            <p className="td-muted" style={{ textAlign: 'center', marginTop: 120 }}>
              La conversation s'affichera ici.
            </p>
          )}
          <div className="transcript">
            {turns.map((t, i) => (
              <div
                key={i}
                className={`bubble-row ${t.speaker === 'patient' ? 'patient' : 'agent'}`}
              >
                <div className="bubble">
                  <div className="bubble-speaker">
                    {t.speaker === 'patient' ? 'Vous' : 'Agent IA'}
                  </div>
                  {t.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
