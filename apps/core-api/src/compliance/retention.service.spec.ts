import { RetentionService } from './retention.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuditService } from '../audit/audit.service';

describe('RetentionService', () => {
  let audits: any[];
  let txExec: string[];
  let prisma: PrismaService;

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = Buffer.alloc(32).toString('base64');
    process.env.DATABASE_URL = 'postgresql://test';
    process.env.JWT_ACCESS_SECRET = 'a';
    process.env.JWT_REFRESH_SECRET = 'r';
    process.env.SERVICE_API_KEY = 'k';
    process.env.DATA_RETENTION_DAYS = '365';
    process.env.AUDIT_LOG_RETENTION_DAYS = '1825';
  });

  beforeEach(() => {
    audits = [];
    txExec = [];
    prisma = {
      callbackTask: { deleteMany: jest.fn(async () => ({ count: 1 })) },
      call: { deleteMany: jest.fn(async () => ({ count: 2 })) },
      followup: { deleteMany: jest.fn(async () => ({ count: 3 })) },
      appointmentCache: { deleteMany: jest.fn(async () => ({ count: 4 })) },
      $transaction: jest.fn(async (cb: any) => {
        const tx = {
          $executeRawUnsafe: jest.fn(async (sql: string) => {
            txExec.push(sql);
            return 0;
          }),
          $executeRaw: jest.fn(async () => 5),
        };
        return cb(tx);
      }),
    } as unknown as PrismaService;
  });

  it('purge les données et journaux expirés, avec drapeau de purge audit', async () => {
    const audit = { record: jest.fn(async (e: any) => audits.push(e)) } as unknown as AuditService;
    const svc = new RetentionService(prisma, audit);
    const res = await svc.purge(new Date('2027-01-01T00:00:00Z'), 'admin-1');
    expect(res).toEqual({ calls: 2, followups: 3, callbackTasks: 1, appointments: 4, auditLogs: 5 });
    // La purge des journaux d'audit pose le drapeau de session contrôlé.
    expect(txExec.some((s) => s.includes('app.allow_audit_purge'))).toBe(true);
    expect(audits.at(-1)).toMatchObject({ action: 'retention_purge', resourceType: 'system' });
  });
});
