import { FollowupsService } from './followups.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuditService } from '../audit/audit.service';
import type { PatientsService } from '../patients/patients.service';

/** Mercredi 10 juin 2026, 10:00 (dans la fenêtre) et 22:00 (hors fenêtre). */
const IN_WINDOW = new Date('2026-06-10T10:00:00');
const OUT_WINDOW = new Date('2026-06-10T22:00:00');

function buildService(opts: {
  due: any[];
  consent?: boolean;
  phone?: string | null;
  sendImpl?: () => Promise<{ providerRef: string }>;
}) {
  const updates: any[] = [];
  const audits: any[] = [];
  const prisma = {
    followup: {
      findMany: jest.fn(async () => opts.due),
      update: jest.fn(async (args: any) => {
        updates.push(args);
        return { id: args.where.id, ...args.data };
      }),
    },
  } as unknown as PrismaService;
  const audit = { record: jest.fn(async (e: any) => audits.push(e)) } as unknown as AuditService;
  const patients = {
    hasConsent: jest.fn(async () => opts.consent ?? true),
    getPhone: jest.fn(async () => (opts.phone === undefined ? '0612345678' : opts.phone)),
  } as unknown as PatientsService;
  const svc = new FollowupsService(prisma, audit, patients);
  if (opts.sendImpl) {
    (svc as unknown as { messaging: { send: unknown } }).messaging = { send: opts.sendImpl };
  } else {
    (svc as unknown as { messaging: { send: unknown } }).messaging = {
      send: jest.fn(async () => ({ providerRef: 'sim-1' })),
    };
  }
  return { svc, updates, audits };
}

describe('FollowupsService.dispatchDue', () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = Buffer.alloc(32).toString('base64');
    process.env.DATABASE_URL = 'postgresql://test';
    process.env.JWT_ACCESS_SECRET = 'a';
    process.env.JWT_REFRESH_SECRET = 'r';
    process.env.SERVICE_API_KEY = 'k';
  });

  it('envoie une relance et la trace (numéro masqué)', async () => {
    const { svc, updates, audits } = buildService({
      due: [{ id: 'f1', patientId: 'p1', channel: 'sms', template: 'rappel_rdv', marketing: false, optOut: false }],
      consent: true,
    });
    const res = await svc.dispatchDue(IN_WINDOW);
    expect(res.sent).toBe(1);
    const sentUpdate = updates.find((u) => u.data.status === 'sent');
    expect(sentUpdate.data.providerRef).toBe('sim-1');
    const sendAudit = audits.find((a) => a.action === 'send');
    expect(sendAudit.metadata.to).toBe('••••••78');
    expect(JSON.stringify(audits)).not.toContain('0612345678');
  });

  it('bloque l envoi sans consentement', async () => {
    const { svc, updates, audits } = buildService({
      due: [{ id: 'f2', patientId: 'p1', channel: 'sms', template: 't', marketing: true, optOut: false }],
      consent: false,
    });
    const res = await svc.dispatchDue(IN_WINDOW);
    expect(res.sent).toBe(0);
    expect(res.skipped).toBe(1);
    expect(updates.find((u) => u.data.status === 'cancelled')).toBeTruthy();
    expect(audits.some((a) => a.action === 'followup_blocked')).toBe(true);
  });

  it('respecte l opt-out', async () => {
    const { svc, updates } = buildService({
      due: [{ id: 'f3', patientId: 'p1', channel: 'sms', template: 't', marketing: false, optOut: true }],
    });
    const res = await svc.dispatchDue(IN_WINDOW);
    expect(res.sent).toBe(0);
    expect(updates.find((u) => u.data.status === 'opted_out')).toBeTruthy();
  });

  it('reprogramme hors fenêtre horaire au lieu d envoyer', async () => {
    const { svc, updates } = buildService({
      due: [{ id: 'f4', patientId: 'p1', channel: 'sms', template: 't', marketing: false, optOut: false }],
      consent: true,
    });
    const res = await svc.dispatchDue(OUT_WINDOW);
    expect(res.sent).toBe(0);
    expect(res.rescheduled).toBe(1);
    const resched = updates.find((u) => u.data.scheduledAt);
    expect(resched.data.scheduledAt.getHours()).toBe(8); // prochain créneau à 08:00
  });

  it('échoue proprement sans destinataire', async () => {
    const { svc, updates } = buildService({
      due: [{ id: 'f5', patientId: 'p1', channel: 'sms', template: 't', marketing: false, optOut: false }],
      consent: true,
      phone: null,
    });
    const res = await svc.dispatchDue(IN_WINDOW);
    expect(res.failed).toBe(1);
    expect(updates.find((u) => u.data.failureReason === 'no_destination')).toBeTruthy();
  });
});
