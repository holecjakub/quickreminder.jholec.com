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

  it.each([
    dc('Buy milk tomorrow at 2pm', 2026, 9, 19, 14, 0, true, 'Buy milk'), dc('koupit mléko zítra ve 14:00', 2026, 9, 19, 14, 0, true, 'koupit mléko'),
    dc('zitra v 8 rano', 2026, 9, 19, 8, 0, true, ''), dc('zítra v 8 ráno', 2026, 9, 19, 8, 0, true),
    dc('Call mom tomorrow 2pm', 2026, 9, 19, 14, 0, true, 'Call mom'), dc('at 2pm tomorrow', 2026, 9, 19, 14, 0, true, ''),
    dc('schůzka v úterý ráno', 2026, 9, 22, 9, 0, true, 'schůzka'), dc('call mom tonight', 2026, 9, 18, 20, 0, true, 'call mom'),
  ])('dayAndTime "$text"', verify);

  it.each([
    dc('meeting at 14:00', 2026, 9, 18, 14, 0, true, 'meeting'), dc('at 9', 2026, 9, 19, 9, 0, true), dc('noon', 2026, 9, 18, 12, 0, true),
    dc('midnight', 2026, 9, 19, 0, 0, true), dc('o půlnoci', 2026, 9, 19, 0, 0, true), dc('v poledne', 2026, 9, 18, 12, 0, true),
    dc('in the morning', 2026, 9, 19, 9, 0, true), dc('večer', 2026, 9, 18, 19, 0, true), dc('odpoledne', 2026, 9, 18, 15, 0, true),
    dc('ve 2 odpoledne', 2026, 9, 18, 14, 0, true), dc('v půl třetí', 2026, 9, 18, 14, 30, true), dc('ve 14.30', 2026, 9, 18, 14, 30, true),
    dc('call at 2:30pm', 2026, 9, 18, 14, 30, true, 'call'),
  ])('times "$text"', verify);

  it.each([
    dc('in 2 hours', 2026, 9, 18, 12, 0, true), dc('in an hour', 2026, 9, 18, 11, 0, true), dc('in 30 minutes', 2026, 9, 18, 10, 30, true),
    dc('in 3 days', 2026, 9, 21, 0, 0, false), dc('in a week', 2026, 9, 25, 0, 0, false), dc('za hodinu', 2026, 9, 18, 11, 0, true),
    dc('za 2 hodiny', 2026, 9, 18, 12, 0, true), dc('za 5 hodin', 2026, 9, 18, 15, 0, true), dc('za 30 minut', 2026, 9, 18, 10, 30, true),
    dc('za 3 dny', 2026, 9, 21, 0, 0, false), dc('za týden', 2026, 9, 25, 0, 0, false), dc('za 2 týdny', 2026, 10, 2, 0, 0, false),
  ])('relativeOffsets "$text"', verify);

  it.each([
    dc('ve 14.30.', 2026, 9, 18, 14, 30, true, ''), dc('meeting at 14.30.', 2026, 9, 18, 14, 30, true, 'meeting'),
  ])('sentenceFinalPeriodAfterTime "$text"', verify);

  it.each([
    dc('tomorrow evening', 2026, 9, 19, 19, 0, true, ''), dc('tomorrow morning', 2026, 9, 19, 9, 0, true, ''),
    dc('tomorrow night', 2026, 9, 19, 20, 0, true, ''), dc('call mom tomorrow evening', 2026, 9, 19, 19, 0, true, 'call mom'),
    dc('friday afternoon', 2026, 9, 25, 15, 0, true, ''),
  ])('englishDayParts "$text"', verify);

  it.each([
    dc('tonight at 8', 2026, 9, 18, 20, 0, true, ''), dc('12am', 2026, 9, 19, 0, 0, true), dc('12pm', 2026, 9, 18, 12, 0, true),
    dc('v 12 večer', 2026, 9, 18, 12, 0, true, ''), dc('půl třetí odpoledne', 2026, 9, 18, 14, 30, true, ''),
  ])('hourDisambiguationWithEveningContext "$text"', verify);

  it.each([
    dc('in 2 days at 3pm', 2026, 9, 20, 15, 0, true, ''), dc('za 3 dny v 9 ráno', 2026, 9, 21, 9, 0, true, ''),
  ])('offsetMergedWithTime "$text"', verify);

  it.each([
    dc('Fix this tomorrow', 2026, 9, 19, 0, 0, false, 'Fix this'), dc('check in tomorrow', 2026, 9, 19, 0, 0, false, 'check in'),
    dc('Log in at 3pm', 2026, 9, 18, 15, 0, true, 'Log in'), dc('Buy milk, tomorrow', 2026, 9, 19, 0, 0, false, 'Buy milk'),
    dc('Review this by friday', 2026, 9, 25, 0, 0, false, 'Review this'), dc('The report tomorrow', 2026, 9, 19, 0, 0, false, 'The report'),
    dc('odevzdat do 5. prosince', 2026, 12, 5, 0, 0, false, 'odevzdat'),
  ])('removingMatchKeepsRealTitleWords "$text"', verify);

  it('dstSpringForwardEuropePrague', () => {
    const prague: Calendar = { timeZone: 'Europe/Prague', locale: 'en-US', firstWeekday: 1 };
    const now = dateFrom(prague, { year: 2026, month: 9, day: 18, hour: 10 })!;
    const text = 'schůzka 28.3.2027 v 2:30 ráno';
    const s = NaturalDateParser.parse(text, now, prague)!;
    expect(s.date).toEqual(dateFrom(prague, { year: 2027, month: 3, day: 28, hour: 3 }));
    expect(s.hasTime).toBe(true);
    expect(NaturalDateParser.removingMatch(text, s)).toBe('schůzka');
  });

  it.each(['', '   ', 'buy 2 apples', 'iPhone 17', 'call 5 people', 'zavolat 3 lidem', 'write the summary'])('negatives "%s"', verifyNil);

  it('dayAndTimeMergeIntoOneRange', () => {
    const text = 'Buy milk tomorrow at 2pm';
    const s = NaturalDateParser.parse(text, NOW, ndpCalendar)!;
    expect(s.matchedText).toBe('tomorrow at 2pm');
    expect(text.slice(s.matchedRange.start, s.matchedRange.end)).toBe(s.matchedText);
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
  it.each([[0, 0], [1, 13], [6, 18], [7, 7], [12, 12], [23, 23]])('disambiguate(%i) = %i', (h, e) => expect(NaturalDateParser.disambiguate(h)).toBe(e));
});
