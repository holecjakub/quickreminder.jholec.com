import { describe, expect, it } from 'vitest';
import { DatePresets, type DatePreset } from '../../src/recreation/core/datePresets';
import { RelativeDistance, SuggestionDateFormatter, type DateTemplate } from '../../src/recreation/core/suggestionDateFormatter';
import { plainSpaces, prague, pragueCalendar as cal } from '../support';

const en = new SuggestionDateFormatter({ locale: 'en-US', calendar: cal });
const cs = new SuggestionDateFormatter({ locale: 'cs-CZ', calendar: cal });
const NOW = prague(2026, 10, 23, 10, 0);

describe('SuggestionDateFormatterTests', () => {
  it('relativeTomorrowLabelWithTime', () => {
    expect(plainSpaces(en.string(prague(2026, 10, 24, 14, 0), true, NOW))).toBe('Tomorrow, 2:00 PM');
    expect(cs.string(prague(2026, 10, 24, 14, 0), true, NOW)).toBe('Zítra 14:00');
  });
  it('dateOnlyOmitsTime', () => {
    expect(en.string(prague(2026, 10, 24, 14, 0), false, NOW)).toBe('Tomorrow');
    expect(cs.string(prague(2026, 10, 24, 14, 0), false, NOW)).toBe('Zítra');
  });
});

describe('PresetDetailTests', () => {
  const detail = (f: SuggestionDateFormatter, p: DatePreset, now: Date, spoken = false) =>
    plainSpaces(f.presetDetail(DatePresets.date(p, now, cal), now, spoken));
  it('followsLocale', () => {
    const now = prague(2026, 10, 19, 10, 0);
    expect(detail(cs, 'weekend', now)).toBe('so 9:00');
    expect(detail(en, 'weekend', now)).toBe('Sat 9:00 AM');
    expect(detail(cs, 'evening', now)).toBe('19:00');
    expect(detail(en, 'evening', now)).toBe('7:00 PM');
  });
  it('aWeekOrMoreAheadShowsTheDate', () => {
    const now = prague(2026, 10, 24, 17, 39);
    expect(detail(en, 'tomorrow', now)).toBe('Sun 9:00 AM');
    expect(detail(en, 'nextMonth', now)).toBe('Nov 1 9:00 AM');
    expect(detail(en, 'weekend', now)).toBe('Oct 31 9:00 AM');
    expect(detail(cs, 'tomorrow', now)).toBe('ne 9:00');
    expect(detail(cs, 'nextMonth', now)).not.toBe(detail(cs, 'tomorrow', now));
    expect(detail(cs, 'nextMonth', now)).toBe('1. 11. 9:00');
    expect(detail(cs, 'weekend', now).startsWith('so')).toBe(false);
    expect(detail(en, 'nextMonth', now, true)).toBe('Sunday, November 1 9:00 AM');
    expect(detail(en, 'tomorrow', now, true)).toBe('Sunday 9:00 AM');
  });
  it('mixedLocaleReadsAsOneFormat', () => {
    const mixed = new SuggestionDateFormatter({ locale: 'en-US-u-rg-czzzzz', calendar: cal });
    const saturday = prague(2026, 10, 24, 9, 0);
    expect(plainSpaces(mixed.presetDetail(saturday, NOW))).toBe('Sat ' + plainSpaces(mixed.time(saturday)));
    expect(mixed.presetDetail(prague(2026, 11, 1, 9, 0), NOW)).not.toContain(' at ');
    expect(mixed.dayAndTime(saturday)).not.toContain(' at ');
    expect(plainSpaces(mixed.dayAndTime(saturday)).endsWith(' ' + plainSpaces(mixed.time(saturday)))).toBe(true);
    expect(plainSpaces(cs.dayAndTime(saturday))).toBe('sobota 24. října 9:00');
    expect(plainSpaces(en.dayAndTime(saturday))).toBe('Saturday, October 24 9:00 AM');
  });
  it('cacheIsPerLocaleAndCanBeDropped', () => {
    const now = prague(2026, 10, 19, 10, 0);
    expect(detail(cs, 'evening', now)).not.toBe(detail(en, 'evening', now));
    SuggestionDateFormatter.invalidateCache();
    expect(SuggestionDateFormatter.cachedFormatterCount).toBe(0);
    expect(detail(en, 'evening', now)).toBe('7:00 PM');
  });
});

describe('suggestionDateFormatter (TS)', () => {
  const sat = prague(2026, 10, 24, 14, 0);
  it.each<[DateTemplate, string, string]>([
    ['j:mm', '2:00 PM', '14:00'], ['EEE', 'Sat', 'so'], ['EEEE', 'Saturday', 'sobota'], ['d MMM', 'Oct 24', '24. 10.'],
    ['EEEE d MMMM', 'Saturday, October 24', 'sobota 24. října'], ['EEE d MMM', 'Sat, Oct 24', 'so 24. 10.'],
    ['LLLL y', 'October 2026', 'říjen 2026'], ['MMMM y', 'October 2026', 'říjen 2026'],
  ])('template %s', (tpl, enText, csText) => {
    expect(plainSpaces(en.format(sat, tpl))).toBe(enText);
    expect(plainSpaces(cs.format(sat, tpl))).toBe(csText);
  });
  it('timeUsesTheNarrowNoBreakSpaceBeforeTheDayPeriod', () => expect(en.time(sat)).toBe('2:00 PM'));
  it('hour12FalseInEnglish', () => expect(new SuggestionDateFormatter({ locale: 'en-US', calendar: cal, hour12: false }).time(sat)).toBe('14:00'));
  it('relativeWordsAndMediumDates', () => {
    expect(plainSpaces(en.string(prague(2026, 10, 23, 14, 0), true, NOW))).toBe('Today, 2:00 PM');
    expect(plainSpaces(en.string(prague(2026, 10, 22, 14, 0), true, NOW))).toBe('Yesterday, 2:00 PM');
    expect(plainSpaces(en.string(prague(2026, 10, 25, 14, 0), true, NOW))).toBe('Oct 25, 2026, 2:00 PM');
    expect(plainSpaces(en.string(prague(2026, 10, 31, 14, 0), true, NOW))).toBe('Oct 31, 2026, 2:00 PM');
    expect(cs.string(prague(2026, 10, 23, 14, 0), true, NOW)).toBe('Dnes 14:00');
    expect(cs.string(prague(2026, 10, 21, 14, 0), true, NOW)).toBe('Předevčírem 14:00');
    expect(cs.string(prague(2026, 10, 25, 14, 0), true, NOW)).toBe('Pozítří 14:00');
    expect(plainSpaces(cs.string(prague(2026, 10, 31, 14, 0), true, NOW))).toBe('31. 10. 2026 14:00');
  });
  it.each<[Date, string, string]>([
    [NOW, 'in 0s', 'za 0 s'], [new Date(NOW.getTime() + 30_000), 'in 30s', 'za 30 s'],
    [prague(2026, 10, 23, 10, 45), 'in 45m', 'za 45 min'], [prague(2026, 10, 23, 11, 0), 'in 1h', 'za 1 h'],
    [prague(2026, 10, 24, 9, 0), 'in 23h', 'za 23 h'], [prague(2026, 10, 24, 14, 0), 'in 1d', 'za 1 den'],
    [prague(2026, 10, 25, 10, 0), 'in 2d', 'za 2 dny'], [prague(2026, 10, 26, 9, 0), 'in 2d', 'za 2 dny'],
    [prague(2026, 10, 30, 9, 0), 'in 6d', 'za 6 dní'], [prague(2026, 10, 31, 9, 0), 'in 1w', 'za 1 týd.'],
    [prague(2026, 11, 1, 9, 0), 'in 1w', 'za 1 týd.'], [prague(2026, 11, 23, 10, 0), 'in 1mo', 'za 1 měs.'],
    [prague(2026, 12, 24, 9, 0), 'in 2mo', 'za 2 měs.'], [prague(2027, 10, 23, 10, 0), 'in 1y', 'za 1 r.'],
    [prague(2026, 10, 23, 7, 0), '3h ago', 'před 3 h'], [prague(2026, 10, 20, 9, 0), '3d ago', 'před 3 dny'],
  ])('RelativeDistance to %s', (to, enText, csText) => {
    expect(plainSpaces(RelativeDistance.string(NOW, to, 'en-US', cal))).toBe(enText);
    expect(plainSpaces(RelativeDistance.string(NOW, to, 'cs-CZ', cal))).toBe(csText);
  });
});
