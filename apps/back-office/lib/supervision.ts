/** Accès API aux métriques de supervision (back-office). */
import { getToken } from './api';

const API_URL = process.env.NEXT_PUBLIC_CORE_API_URL ?? 'http://localhost:4000';

export interface SupervisionMetrics {
  period: { from: string; to: string };
  calls: {
    total: number;
    resolvedByAgent: number;
    transferredToHuman: number;
    missed: number;
    inProgress: number;
    resolutionRate: number;
    transferRate: number;
  };
  latency: { avgPerceivedMs: number | null; targetMs: number; withinTarget: boolean | null };
  avgDurationSeconds: number | null;
  byIntent: Record<string, number>;
  byUrgency: Record<string, number>;
  callbacks: { pending: number };
  followups: { sent: number; failed: number };
}

export async function getMetrics(): Promise<SupervisionMetrics> {
  const res = await fetch(`${API_URL}/api/supervision/metrics`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error('Accès aux métriques refusé (rôle responsable/admin)');
  return res.json();
}
