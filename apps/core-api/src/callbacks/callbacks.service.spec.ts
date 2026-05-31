import { randomBytes } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { CallbacksService } from './callbacks.service';
import { CryptoService } from '../crypto/crypto.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuditService } from '../audit/audit.service';

describe('CallbacksService', () => {
  let crypto: CryptoService;
  let audits: any[];
  let updateArgs: any;
  let telephonyCalls: any[];

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = randomBytes(32).toString('base64');
    process.env.DATABASE_URL = 'postgresql://test';
    process.env.JWT_ACCESS_SECRET = 'a';
    process.env.JWT_REFRESH_SECRET = 'r';
    process.env.SERVICE_API_KEY = 'k';
    crypto = new CryptoService();
  });

  function build(taskRow: any) {
    audits = [];
    updateArgs = null;
    telephonyCalls = [];
    const prisma = {
      callbackTask: {
        findUnique: jest.fn(async () => taskRow),
        update: jest.fn(async (args: any) => {
          updateArgs = args;
          return { id: taskRow.id, ...args.data };
        }),
      },
    } as unknown as PrismaService;
    const audit = { record: jest.fn(async (e: any) => audits.push(e)) } as unknown as AuditService;
    const telephony = {
      transfer: jest.fn(),
      clickToCall: jest.fn(async (from: string, to: string) => {
        telephonyCalls.push({ from, to });
      }),
    };
    const svc = new CallbacksService(prisma, audit, crypto);
    (svc as unknown as { telephony: unknown }).telephony = telephony;
    return svc;
  }

  it('assigne la tâche au demandeur et passe en assigned', async () => {
    const svc = build({ id: 't1', status: 'pending' });
    await svc.assignToMe('t1', 'user-9');
    expect(updateArgs.data.assignedToId).toBe('user-9');
    expect(updateArgs.data.status).toBe('assigned');
    expect(audits.at(-1)).toMatchObject({ action: 'assign' });
  });

  it('click-to-call : déchiffre le numéro, appelle le connecteur, audite masqué', async () => {
    const enc = crypto.encrypt('0612345678');
    const svc = build({ id: 't2', status: 'assigned', call: { callerNumber: enc }, patient: null });
    const res = await svc.clickToCall('t2', 'user-9', 'user:user-9');
    // Le connecteur reçoit le vrai numéro...
    expect(telephonyCalls[0].to).toBe('0612345678');
    // ...mais l'audit et la réponse sont masqués.
    expect(res.to).toBe('••••••78');
    expect(JSON.stringify(audits)).not.toContain('0612345678');
    expect(audits.at(-1)).toMatchObject({ action: 'click_to_call' });
  });

  it('click-to-call sans numéro -> 400', async () => {
    const svc = build({ id: 't3', status: 'assigned', call: null, patient: null });
    await expect(svc.clickToCall('t3', 'u', 'user:u')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
