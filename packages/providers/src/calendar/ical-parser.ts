/**
 * Parseur iCalendar minimal mais robuste (RFC 5545, sous-ensemble courant) :
 * dépliage des lignes, extraction des VEVENT, dates UTC / flottantes / TZID.
 *
 * Limite assumée : les dates avec TZID ou flottantes sont interprétées en UTC
 * (déterministe). En production, on pourra brancher une lib de fuseaux si les
 * flux Doctolib exportent des TZID non-UTC.
 */

export interface ICalEvent {
  uid: string | null;
  start: Date | null;
  end: Date | null;
  summary: string | null;
  categories: string[];
  status: string | null;
}

/** Déplie les lignes repliées (continuation = ligne débutant par espace/tab). */
function unfold(text: string): string[] {
  const rawLines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const lines: string[] = [];
  for (const line of rawLines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

/** Parse une valeur date-time iCal en Date (UTC). Retourne null si invalide. */
export function parseICalDate(value: string): Date | null {
  // Format date seule : YYYYMMDD
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, y, mo, d] = dateOnly;
    return new Date(Date.UTC(+y!, +mo! - 1, +d!));
  }
  // Format date-heure : YYYYMMDDTHHMMSS(Z)?
  const dt = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(value);
  if (dt) {
    const [, y, mo, d, h, mi, s] = dt;
    return new Date(Date.UTC(+y!, +mo! - 1, +d!, +h!, +mi!, +s!));
  }
  return null;
}

/** Sépare "NAME;PARAM=x:VALUE" en { name, params, value }. */
function parseLine(line: string): {
  name: string;
  params: Record<string, string>;
  value: string;
} | null {
  const colon = line.indexOf(':');
  if (colon === -1) return null;
  const left = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const [name, ...paramParts] = left.split(';');
  const params: Record<string, string> = {};
  for (const p of paramParts) {
    const eq = p.indexOf('=');
    if (eq !== -1) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1);
  }
  return { name: (name ?? '').toUpperCase(), params, value };
}

/** Extrait les VEVENT d'un flux iCal. */
export function parseICalEvents(text: string): ICalEvent[] {
  const lines = unfold(text);
  const events: ICalEvent[] = [];
  let current: ICalEvent | null = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {
        uid: null,
        start: null,
        end: null,
        summary: null,
        categories: [],
        status: null,
      };
      continue;
    }
    if (line === 'END:VEVENT') {
      if (current) events.push(current);
      current = null;
      continue;
    }
    if (!current) continue;

    const parsed = parseLine(line);
    if (!parsed) continue;
    switch (parsed.name) {
      case 'UID':
        current.uid = parsed.value;
        break;
      case 'DTSTART':
        current.start = parseICalDate(parsed.value);
        break;
      case 'DTEND':
        current.end = parseICalDate(parsed.value);
        break;
      case 'SUMMARY':
        current.summary = parsed.value;
        break;
      case 'STATUS':
        current.status = parsed.value;
        break;
      case 'CATEGORIES':
        current.categories = parsed.value
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean);
        break;
      default:
        break;
    }
  }
  return events;
}
