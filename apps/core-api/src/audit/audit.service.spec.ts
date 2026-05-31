import { AuditService } from './audit.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('AuditService', () => {
  let service: AuditService;
  let created: any[];
  let prismaMock: PrismaService;

  beforeEach(() => {
    created = [];
    prismaMock = {
      auditLog: {
        create: jest.fn(async ({ data }: { data: any }) => {
          created.push(data);
          return data;
        }),
      },
    } as unknown as PrismaService;
    service = new AuditService(prismaMock);
  });

  it('persiste une entree d audit', async () => {
    await service.record({
      actorId: 'user-1',
      action: 'read',
      resourceType: 'call',
      resourceId: 'call-1',
      ip: '10.0.0.1',
    });
    expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(1);
    expect(created[0]).toMatchObject({
      actorId: 'user-1',
      action: 'read',
      resourceType: 'call',
    });
  });

  it('caviarde les cles sensibles des metadonnees (aucune donnee de sante)', () => {
    const safe = service.sanitize({
      page: 2,
      phone: '0612345678',
      transcript: 'texte patient confidentiel',
      siteSlug: 'cergy',
    });
    expect(safe).toEqual({
      page: 2,
      phone: '[redacted]',
      transcript: '[redacted]',
      siteSlug: 'cergy',
    });
  });

  it('retourne null quand il n y a pas de metadonnees', () => {
    expect(service.sanitize(null)).toBeNull();
    expect(service.sanitize(undefined)).toBeNull();
  });
});
