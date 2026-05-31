import { ICalSyncAdapter, parseICalEvents } from '@alpha/providers';
import { Modality, SiteSlug } from '@alpha/domain';

const SAMPLE_ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'UID:slot-1',
  'DTSTART:20260605T090000Z',
  'DTEND:20260605T093000Z',
  'SUMMARY:Creneau IRM disponible',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:slot-2',
  'DTSTART:20260605T100000Z',
  'DTEND:20260605T103000Z',
  'SUMMARY:Scanner reserve',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:slot-3',
  'DTSTART:20260606T140000Z',
  'DTEND:20260606T143000Z',
  'SUMMARY:Rendez-vous',
  'CATEGORIES:IRM',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

describe('iCal parser + ICalSyncAdapter', () => {
  it('parse les VEVENT et les dates UTC', () => {
    const events = parseICalEvents(SAMPLE_ICS);
    expect(events).toHaveLength(3);
    expect(events[0]!.uid).toBe('slot-1');
    expect(events[0]!.start?.toISOString()).toBe('2026-06-05T09:00:00.000Z');
  });

  const adapter = new ICalSyncAdapter(
    { [SiteSlug.CERGY]: 'memory://feed' },
    { fetchText: async () => SAMPLE_ICS },
  );

  it('ne renvoie que les créneaux libres de la bonne modalité', async () => {
    const slots = await adapter.getAvailabilities({
      site: SiteSlug.CERGY,
      modality: Modality.IRM,
      from: new Date('2026-06-01T00:00:00Z'),
      to: new Date('2026-06-30T00:00:00Z'),
    });
    // slot-1 (IRM libre) et slot-3 (IRM via CATEGORIES) ; slot-2 = scanner réservé exclu.
    expect(slots.map((s) => s.startAt)).toEqual([
      '2026-06-05T09:00:00.000Z',
      '2026-06-06T14:00:00.000Z',
    ]);
  });

  it('exclut une modalité non demandée', async () => {
    const slots = await adapter.getAvailabilities({
      site: SiteSlug.CERGY,
      modality: Modality.SCANNER,
      from: new Date('2026-06-01T00:00:00Z'),
      to: new Date('2026-06-30T00:00:00Z'),
    });
    // Le seul scanner est "reserve" -> aucune dispo.
    expect(slots).toHaveLength(0);
  });

  it('pull normalise statut et modalité', async () => {
    const all = await adapter.pull(SiteSlug.CERGY);
    expect(all).toHaveLength(3);
    const booked = all.find((s) => s.externalId === 'slot-2');
    expect(booked?.modality).toBe(Modality.SCANNER);
    expect(booked?.status).toBe('booked');
  });
});
