import { buildCalendar } from './ics';

describe('buildCalendar', () => {
  const base = { uid: 'a@openbar', date: '2026-09-12', summary: 'Apéro' };

  it('wraps events in a valid calendar envelope', () => {
    const ics = buildCalendar('Mes soirées', [base]);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('BEGIN:VEVENT');
  });

  it('uses CRLF, which some clients reject the absence of', () => {
    const ics = buildCalendar('x', [base]);
    expect(ics.split('\n').every((l) => l === '' || l.endsWith('\r'))).toBe(
      true,
    );
  });

  it('writes an all-day event whose end is the following day', () => {
    // DTEND is exclusive, so a one-day soirée on the 12th ends on the 13th.
    const ics = buildCalendar('x', [base]);
    expect(ics).toContain('DTSTART;VALUE=DATE:20260912');
    expect(ics).toContain('DTEND;VALUE=DATE:20260913');
  });

  it('rolls over month boundaries', () => {
    const ics = buildCalendar('x', [{ ...base, date: '2026-09-30' }]);
    expect(ics).toContain('DTEND;VALUE=DATE:20261001');
  });

  it('escapes the characters that are separators in the format', () => {
    const ics = buildCalendar('x', [
      { ...base, summary: 'Apéro, chez Léa; ambiance\\rétro' },
    ]);
    // Written with explicit escapes: a literal '\;' in TypeScript collapses to
    // ';' and would assert the bug rather than the fix.
    expect(ics).toContain(
      [
        'SUMMARY:Apéro',
        String.raw`\,`,
        ' chez Léa',
        String.raw`\;`,
        ' ambiance',
        String.raw`\\`,
        'rétro',
      ].join(''),
    );
  });

  it('folds long lines without splitting a multi-byte character', () => {
    const ics = buildCalendar('x', [{ ...base, summary: 'é'.repeat(120) }]);
    for (const line of ics.split('\r\n')) {
      expect(Buffer.from(line, 'utf8').length).toBeLessThanOrEqual(75);
    }
    // Folding must be reversible: unfolding restores the original text.
    const unfolded = ics.replace(/\r\n /g, '');
    expect(unfolded).toContain(`SUMMARY:${'é'.repeat(120)}`);
  });

  it('omits optional fields rather than writing empty ones', () => {
    const ics = buildCalendar('x', [base]);
    expect(ics).not.toContain('DESCRIPTION:');
    expect(ics).not.toContain('URL:');
  });
});
