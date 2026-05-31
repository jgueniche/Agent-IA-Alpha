import { randomBytes } from 'node:crypto';
import { CallsService } from './calls.service';
import { CryptoService } from '../crypto/crypto.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuditService } from '../audit/audit.service';

describe('CallsService', () => {
  let service: CallsService;
  let created: any;
  let audits: any[];
  let prismaMock: PrismaService;

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = randomBytes(32).toString('base64');
    process.env.DATABASE_URL = 'postgresql://test';
    process.env.JWT_ACCESS_SECRET = 'a';
    process.env.JWT_REFRESH_SECRET = 'r';
    process.env.SERVICE_API_KEY = 'k';
  });

  beforeEach(() => {
    created = null;
    audits = [];
    prismaMock = {
      site: { findUnique: jest.fn(async () => ({ id: 'site-cergy' })) },
      call: {
        create: jest.fn(async ({ data }: any) => {
          created = data;
          return { id: 'call-1' };
        }),
        findUnique: jest.fn(async () => ({ id: 'call-1' })),
        update: jest.fn(async () => ({})),
      },
      transcript: { upsert: jest.fn(async () => ({})) },
    } as unknown as PrismaService;
    const auditMock = {
      record: jest.fn(async (e: any) => audits.push(e)),
    } as unknown as AuditService;
    service = new CallsService(prismaMock, new CryptoService(), auditMock);
  });

  it('cree un appel en chiffrant le numero appelant', async () => {
    const res = await service.createCall({
      site: undefined,
      callerNumber: '0612345678',
      direction: undefined,
    } as any);
    expect(res.id).toBe('call-1');
    // Le numero est chiffre (jamais stocke en clair).
    expect(created.callerNumber).not.toBe('0612345678');
    expect(created.callerNumber).toBeTruthy();
    // L'audit ne contient pas le numero.
    expect(JSON.stringify(audits)).not.toContain('0612345678');
  });

  it('upsert une transcription et n audite pas le contenu', async () => {
    await service.upsertTranscript('call-1', {
      segments: [
        { speaker: 'patient', ts: 0, text: 'Bonjour je voudrais un IRM' },
        { speaker: 'agent', ts: 2, text: 'Bien sur, sur quel site ?' },
      ],
      urgency: 'none',
    } as any);
    expect(prismaMock.transcript.upsert).toHaveBeenCalledTimes(1);
    // Aucun texte de transcription dans l'audit.
    expect(JSON.stringify(audits)).not.toContain('IRM');
    expect(audits.at(-1).metadata).toMatchObject({ segmentsCount: 2 });
  });
});
