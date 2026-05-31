import { Modality, SiteSlug } from '@alpha/domain';
import { CalendarService } from './calendar.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuditService } from '../audit/audit.service';

describe('CalendarService', () => {
  let audits: any[];
  let created: any;
  let prismaMock: PrismaService;
  let service: CalendarService;

  beforeEach(() => {
    audits = [];
    created = null;
    prismaMock = {
      site: { findUnique: jest.fn(async () => ({ id: 'site-cergy' })) },
      appointmentCache: {
        findMany: jest.fn(async () => [
          {
            startAt: new Date('2026-06-05T09:00:00Z'),
            endAt: new Date('2026-06-05T09:30:00Z'),
          },
        ]),
      },
      callbackTask: {
        create: jest.fn(async ({ data }: any) => {
          created = data;
          return { id: 'task-1' };
        }),
      },
    } as unknown as PrismaService;
    const auditMock = {
      record: jest.fn(async (e: any) => audits.push(e)),
    } as unknown as AuditService;
    service = new CalendarService(prismaMock, auditMock);
  });

  it('lit les disponibilités depuis le cache (sync)', async () => {
    const slots = await service.getAvailabilities({
      site: SiteSlug.CERGY,
      modality: Modality.IRM,
    });
    expect(slots).toHaveLength(1);
    expect(slots[0]!.startAt).toBe('2026-06-05T09:00:00.000Z');
    expect(audits.at(-1)).toMatchObject({ resourceType: 'appointments_cache' });
  });

  it('déporte une prise de RDV vers une tâche de rappel', async () => {
    const res = await service.deferBooking({
      site: SiteSlug.CERGY,
      modality: Modality.IRM,
      desiredStartAt: '2026-06-05T09:00:00Z',
    });
    expect(res.taskId).toBe('task-1');
    expect(created.motif).toContain('irm');
    expect(created.status).toBe('pending');
    expect(audits.at(-1)).toMatchObject({
      resourceType: 'callback_task',
      metadata: { reason: 'booking_deferred' },
    });
  });
});
