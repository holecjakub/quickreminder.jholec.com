import { describe, expect, it } from 'vitest';
import { dateFrom, type Calendar } from '../../src/recreation/core/calendar';
import { NaturalDateParser } from '../../src/recreation/core/naturalDateParser';

// Swift's ndpCalendar uses TimeZone.current; a fixed zone keeps the run deterministic
// (Vitest runs in Pacific/Auckland) and no case below falls on a DST change.
const ndpCalendar: Calendar = { timeZone: 'Europe/Prague', locale: 'en-US', firstWeekday: 1 };
const ndp = (y: number, m: number, d: number, h = 0, min = 0) =>
  dateFrom(ndpCalendar, { year: y, month: m, day: d, hour: h, minute: min })!;
/** Friday 2026-09-18 10:00, like NaturalDateParserTests.swift `ndpNow`. */
const NOW = ndp(2026, 9, 18, 10, 0);

type DateCase = { text: string; y: number; m: number; d: number; h: number; min: number; hasTime: boolean; stripped?: string };
const dc = (text: string, y: number, m: number, d: number, h: number, min: number, hasTime: boolean, stripped?: string): DateCase =>
  ({ text, y, m, d, h, min, hasTime, stripped });

function verify(c: DateCase) {
  const s = NaturalDateParser.parse(c.text, NOW, ndpCalendar);
  expect(s, `"${c.text}" should parse`).not.toBeNull();
  expect(s!.date).toEqual(ndp(c.y, c.m, c.d, c.h, c.min));
  expect(s!.hasTime).toBe(c.hasTime);
  if (c.stripped !== undefined) expect(NaturalDateParser.removingMatch(c.text, s!)).toBe(c.stripped);
}
const verifyNil = (text: string) => expect(NaturalDateParser.parse(text, NOW, ndpCalendar)).toBeNull();

describe('NaturalDateParserTests', () => {
  it.each([
    dc('zavolat mámě zítra', 2026, 9, 19, 0, 0, false, 'zavolat mámě'),
    dc('tmrw', 2026, 9, 19, 0, 0, false), dc('day after tomorrow', 2026, 9, 20, 0, 0, false),
    dc('pozítří', 2026, 9, 20, 0, 0, false), dc('dnes', 2026, 9, 18, 0, 0, false), dc('dneska', 2026, 9, 18, 0, 0, false),
    dc('next week', 2026, 9, 21, 0, 0, false), dc('příští týden', 2026, 9, 21, 0, 0, false),
    dc('next month', 2026, 10, 1, 0, 0, false), dc('this weekend', 2026, 9, 19, 0, 0, false),
    dc('o víkendu', 2026, 9, 19, 0, 0, false),
  ])('relativeDays "$text"', verify);

  it.each([
    dc('meeting on friday', 2026, 9, 25, 0, 0, false, 'meeting'), dc('next friday', 2026, 9, 25, 0, 0, false),
    dc('MONDAY', 2026, 9, 21, 0, 0, false), dc('v pondělí', 2026, 9, 21, 0, 0, false, ''),
    dc('ve středu', 2026, 9, 23, 0, 0, false), dc('příští pátek', 2026, 9, 25, 0, 0, false),
    dc('lunch on sat', 2026, 9, 19, 0, 0, false, 'lunch'),
  ])('weekdays "$text"', verify);

  it.each([
    dc('12. března', 2027, 3, 12, 0, 0, false), dc('March 12', 2027, 3, 12, 0, 0, false), dc('Mar 12', 2027, 3, 12, 0, 0, false),
    dc('12 March', 2027, 3, 12, 0, 0, false), dc('12. 3.', 2027, 3, 12, 0, 0, false), dc('12.3.2027', 2027, 3, 12, 0, 0, false),
    // The Swift case has a no-break space (U+00A0) between "Buy" and "milk".
    dc('Buy milk tomorrow', 2026, 9, 19, 0, 0, false, 'Buy milk'), dc('dentist 3/12', 2027, 3, 12, 0, 0, false, 'dentist'),
    dc('zubař 3.12.', 2026, 12, 3, 0, 0, false, 'zubař'), dc('odevzdat do 5. prosince', 2026, 12, 5, 0, 0, false),
  ])('explicitDates "$text"', verify);

  it.each(['12.3.2026', 'I sat on the bench', 'mon amour'])('explicitDateNegatives "%s"', verifyNil);

  it('foldAlignmentAcrossMixedWidthCharacters', () =>
    // Mixed shrinking/growing folds must not misalign ranges (ŉ → 2 units, e + U+0301 → 1).
    expect(NaturalDateParser.parse('ŉ zítra é', NOW, ndpCalendar)?.matchedText).toBe('zítra'));

  it.each(['30.2.', '31. února', '31. dubna', '31 April', '12.3.2040'])('invalidDatesNeverRollOverNegatives "%s"', verifyNil);

  it.each([
    dc('29.2.', 2028, 2, 29, 0, 0, false),
    dc('12 March 1000 items', 2027, 3, 12, 0, 0, false, '1000 items'),
  ])('invalidDatesNeverRollOverPositives "$text"', verify);

  it('rightMostPhraseWins', () => {
    const s = NaturalDateParser.parse('tomorrow report for friday', NOW, ndpCalendar)!;
    expect(['for friday', 'friday']).toContain(s.matchedText);
    expect(s.date).toEqual(ndp(2026, 9, 25));
  });
});

describe('naturalDateParser (TS)', () => {
  it('cutsOffPathologicalPastes', () => {
    expect(NaturalDateParser.parse('a'.repeat(991) + ' tomorrow', NOW, ndpCalendar)?.matchedText).toBe('tomorrow'); // 1000 units
    expect(NaturalDateParser.parse('a'.repeat(992) + ' tomorrow', NOW, ndpCalendar)).toBeNull();                    // 1001 units
  });
  it('matchedRangeIsUTF16OffsetsIntoTheOriginal', () => {
    const text = 'zavolat mámě zítra';
    const s = NaturalDateParser.parse(text, NOW, ndpCalendar)!;
    expect(s.matchedRange).toEqual({ start: 13, end: 18 });
    expect(text.slice(s.matchedRange.start, s.matchedRange.end)).toBe(s.matchedText);
  });
});
