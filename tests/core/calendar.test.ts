import { describe, expect, it } from 'vitest';
import { addDays, addHours, addMonths, components, currentCalendar, dateFrom, daysBetween, daysInMonth,
  isSameDay, isSameMinute, pragueCalendar as cal, settingTime, startOfDay, startOfHour, startOfMonth, weekdayOf } from '../../src/recreation/core/calendar';
import { prague, pragueString } from '../support';

describe('calendar', () => {
  it('componentsReadTheWallClockOfTheZone', () =>
    expect(components(cal, new Date('2026-10-23T08:00:00Z'))).toEqual({ year: 2026, month: 10, day: 23, hour: 10, minute: 0, second: 0, weekday: 6 }));
  it('dateFromBuildsTheInstant', () =>
    expect(dateFrom(cal, { year: 2026, month: 10, day: 23, hour: 10, minute: 0 })?.toISOString()).toBe('2026-10-23T08:00:00.000Z'));
  it('dateFromShiftsASkippedTimeByTheGap', () =>
    expect(dateFrom(cal, { year: 2026, month: 3, day: 29, hour: 2, minute: 30 })?.toISOString()).toBe('2026-03-29T01:30:00.000Z')); // 03:30 CEST
  it('dateFromTakesTheFirstOfARepeatedTime', () =>
    expect(dateFrom(cal, { year: 2026, month: 10, day: 25, hour: 2, minute: 30 })?.toISOString()).toBe('2026-10-25T00:30:00.000Z')); // CEST
  it('dateFromRejectsImpossibleDates', () => {
    expect(dateFrom(cal, { year: 2026, month: 2, day: 31 })).toBeNull();
    expect(dateFrom(cal, { year: 2026, month: 4, day: 31 })).toBeNull();
    expect(dateFrom(cal, { year: 2026, month: 13, day: 1 })).toBeNull();
    expect(dateFrom(cal, { year: 2026, month: 1, day: 1, hour: 24 })).toBeNull();
  });
  it('settingTimeSnapsASkippedTimeToTheNextValidInstant', () =>
    expect(settingTime(cal, prague(2027, 3, 28), 2, 30).toISOString()).toBe('2027-03-28T01:00:00.000Z')); // 03:00 CEST
  it('settingTimeOnAnOrdinaryDay', () => expect(settingTime(cal, prague(2026, 10, 23, 15), 9, 5)).toEqual(prague(2026, 10, 23, 9, 5)));
  it('startOfDayOnTheFallBackDay', () => expect(startOfDay(cal, new Date('2026-10-25T14:00:00Z')).toISOString()).toBe('2026-10-24T22:00:00.000Z'));
  it('startOfHourAndMonth', () => {
    expect(startOfHour(cal, new Date('2026-10-23T08:44:30.500Z')).toISOString()).toBe('2026-10-23T08:00:00.000Z');
    expect(startOfMonth(cal, prague(2026, 10, 23, 10))).toEqual(prague(2026, 10, 1));
  });
  it('daysInMonth', () => {
    expect(daysInMonth(cal, prague(2028, 2, 10))).toBe(29);
    expect(daysInMonth(cal, prague(2026, 2, 10))).toBe(28);
    expect(daysInMonth(cal, prague(2026, 10, 10))).toBe(31);
  });
  it('addDaysKeepsTheWallClockAcrossDST', () => {
    expect(pragueString(addDays(cal, prague(2026, 10, 24, 9), 2))).toBe('2026-10-26 09:00');
    expect(addDays(cal, prague(2026, 10, 24, 9), 2).toISOString()).toBe('2026-10-26T08:00:00.000Z');
  });
  it('addMonthsClampsLikeFoundation', () => {
    expect(addMonths(cal, prague(2026, 1, 31, 12), 1)).toEqual(prague(2026, 2, 28, 12));
    expect(addMonths(cal, prague(2028, 1, 31, 12), 1)).toEqual(prague(2028, 2, 29, 12));
    expect(addMonths(cal, prague(2026, 12, 15), 1)).toEqual(prague(2027, 1, 15));
  });
  it('addHoursIsAbsolute', () => {
    const later = addHours(prague(2026, 10, 25, 1, 30), 2);
    expect(later.toISOString()).toBe('2026-10-25T01:30:00.000Z');
    expect(pragueString(later)).toBe('2026-10-25 02:30'); // the second 02:30 (CET)
  });
  it('sameDayAndSameMinute', () => {
    expect(isSameDay(cal, prague(2026, 10, 23, 0), prague(2026, 10, 23, 23, 59))).toBe(true);
    expect(isSameDay(cal, prague(2026, 10, 23, 23, 59), prague(2026, 10, 24))).toBe(false);
    expect(isSameMinute(cal, prague(2026, 10, 23, 10), new Date(prague(2026, 10, 23, 10).getTime() + 59_000))).toBe(true);
    expect(isSameMinute(cal, prague(2026, 10, 23, 10), prague(2026, 10, 23, 10, 1))).toBe(false);
  });
  it('daysBetweenCountsCalendarDays', () => {
    expect(daysBetween(cal, prague(2026, 10, 24, 17, 39), prague(2026, 10, 31, 9))).toBe(7);
    expect(daysBetween(cal, prague(2026, 10, 24, 17, 39), prague(2026, 10, 23, 9))).toBe(-1);
    expect(daysBetween(cal, prague(2026, 10, 24, 0), prague(2026, 10, 24, 23))).toBe(0);
  });
  it('weekdayOfUsesFoundationNumbering', () => {
    expect(weekdayOf(cal, prague(2026, 10, 25))).toBe(1); // Sunday
    expect(weekdayOf(cal, prague(2026, 10, 24))).toBe(7); // Saturday
  });
  it('currentCalendarIsTheVisitorsZoneInEnUS', () =>
    expect(currentCalendar()).toEqual({ timeZone: 'Pacific/Auckland', locale: 'en-US', firstWeekday: 1 }));
});
