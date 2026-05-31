import { KnowledgeService } from './knowledge.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuditService } from '../audit/audit.service';

describe('KnowledgeService', () => {
  let service: KnowledgeService;
  let audits: any[];
  let updateArgs: any;
  let prismaMock: PrismaService;

  beforeEach(() => {
    audits = [];
    prismaMock = {
      knowledgeItem: {
        findUnique: jest.fn(async () => ({
          id: 'k1',
          key: 'irm_prep',
          content: 'ancien contenu',
          version: 1,
          validatedById: 'validator-1',
        })),
        update: jest.fn(async (args: any) => {
          updateArgs = args;
          return { id: 'k1', key: 'irm_prep', version: 2 };
        }),
      },
    } as unknown as PrismaService;
    const auditMock = {
      record: jest.fn(async (e: any) => audits.push(e)),
    } as unknown as AuditService;
    service = new KnowledgeService(prismaMock, auditMock);
  });

  it('une modif de contenu incrémente la version et invalide la validation', async () => {
    await service.update('k1', { content: 'nouveau contenu' } as any, 'user-1');
    expect(updateArgs.data.version).toEqual({ increment: 1 });
    expect(updateArgs.data.validatedById).toBeNull();
    expect(updateArgs.data.validatedAt).toBeNull();
    expect(audits.at(-1)).toMatchObject({ action: 'update' });
  });

  it('une modif sans changement de contenu ne touche pas la validation', async () => {
    await service.update('k1', { title: 'Nouveau titre' } as any, 'user-1');
    expect(updateArgs.data.version).toBeUndefined();
    expect(updateArgs.data.validatedById).toBeUndefined();
  });

  it('valider trace le validateur et la date', async () => {
    await service.validate('k1', 'manager-9');
    expect(updateArgs.data.validatedById).toBe('manager-9');
    expect(updateArgs.data.validatedAt).toBeInstanceOf(Date);
    expect(audits.at(-1)).toMatchObject({ action: 'validate' });
  });
});
