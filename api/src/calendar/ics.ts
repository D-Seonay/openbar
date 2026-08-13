/**
 * Minimal RFC 5545 writer.
 *
 * Hand-rolled rather than pulling a dependency: the app emits one kind of
 * event, and the fiddly parts are escaping and line folding, which are a few
 * lines each. Both matter — an unescaped comma or an over-long line makes a
 * feed silently fail to import.
 */

export interface IcsEvent {
  uid: string;
  /** Date-only, `YYYY-MM-DD`. Soirées have no stored time. */
  date: string;
  summary: string;
  description?: string;
  url?: string;
}

/** Commas, semicolons and backslashes are separators in the format itself. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Content lines are capped at 75 octets; longer ones are continued on a line
 * starting with a space. Counted in bytes, not characters — an accented French
 * title is two bytes per accent and would otherwise fold in the wrong place.
 */
function fold(line: string): string {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;

  const parts: string[] = [];
  let start = 0;
  let limit = 75;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // Never split a multi-byte character: back off to a boundary.
    while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) {
      end -= 1;
    }
    parts.push(bytes.subarray(start, end).toString('utf8'));
    start = end;
    limit = 74; // continuation lines lose one octet to the leading space
  }
  return parts.join('\r\n ');
}

function stamp(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
}

/** `YYYY-MM-DD` -> `YYYYMMDD`, the DATE form used for all-day events. */
function icsDate(date: string): string {
  return date.replace(/-/g, '');
}

/** The day after, since DTEND is exclusive for an all-day event. */
function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return icsDate(d.toISOString().slice(0, 10));
}

export function buildCalendar(name: string, events: IcsEvent[]): string {
  const now = stamp(new Date());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//OpenBar//Soirees//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(name)}`,
    // Ask pollers to refresh daily rather than hammering the feed.
    'REFRESH-INTERVAL;VALUE=DURATION:PT24H',
    'X-PUBLISHED-TTL:PT24H',
  ];

  for (const event of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.uid}`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${icsDate(event.date)}`,
      `DTEND;VALUE=DATE:${nextDay(event.date)}`,
      `SUMMARY:${escapeText(event.summary)}`,
      ...(event.description
        ? [`DESCRIPTION:${escapeText(event.description)}`]
        : []),
      ...(event.url ? [`URL:${escapeText(event.url)}`] : []),
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  // CRLF is required by the spec, and some clients genuinely reject LF-only.
  return `${lines.map(fold).join('\r\n')}\r\n`;
}
