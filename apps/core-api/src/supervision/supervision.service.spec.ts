import { SupervisionService } from './supervision.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuditService } from '../audit/audit.service';

describe('SupervisionService', () => {
  it('calcule taux de résolution/transfert et latence vs cible', async () => {
    const audits: any[] = [];
    const callCount = jest
      .fn()
      .mockResolvedValueOnce(10) // total
      .mockResolvedValueOnce(6) // resolved
      .mockResolvedValueOnce(3) // transferred
      .mockResolvedValueOnce(1) // missed
      .mockResolvedValueOnce(0); // in_progress
    const followupCount = jest
      .fn()
      .mockResolvedValueOnce(4) // sent
      .mockResolvedValueOnce(1); // failed
    const prisma = {
      call: {
        count: callCount,
        aggregate: jest.fn(async () => ({ _avg: { duration: 120, agentLatencyMs: 650 } })),
      },
      transcript: {
        groupBy: jest
          .fn()
          .mockResolvedValueOnce([{ intent: 'prise_rdv', _count: { _all: 5 } }])
          .mockResolvedValueOnce([
            { urgencyFlag: 'none', _count: { _all: 9 } },
            { urgencyFlag: 'critical', _count: { _all: 1 } },
          ]),
      },
      callbackTask: { count: jest.fn(async () => 2) },
      followup: { count: followupCount },
    } as unknown as PrismaService;
    const audit = { record: jest.fn(async (e: any) => audits.push(e)) } as unknown as AuditService;

    const svc = new SupervisionService(prisma, audit);
    const m = await svc.metrics('mgr-1');

    expect(m.calls.total).toBe(10);
    expect(m.calls.resolutionRate).toBe(0.6);
    expect(m.calls.transferRate).toBe(0.3);
    expect(m.latency.avgPerceivedMs).toBe(650);
    expect(m.latency.withinTarget).toBe(true); // 650 <= 800
    expect(m.byIntent).toEqual({ prise_rdv: 5 });
    expect(m.byUrgency).toEqual({ none: 9, critical: 1 });
    expect(m.callbacks.pending).toBe(2);
    expect(m.followups).toEqual({ sent: 4, failed: 1 });
    expect(audits.at(-1)).toMatchObject({ resourceType: 'supervision' });
  });
});
