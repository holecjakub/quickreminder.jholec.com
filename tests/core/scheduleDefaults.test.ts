import { describe, expect, it } from 'vitest';
import { DayPart, ScheduleDefaults } from '../../src/recreation/core/scheduleDefaults';
import { AppClock, createClock } from '../../src/recreation/clock';
import { prague, pragueCalendar as cal, pragueString } from '../support';

describe('ScheduleDefaultsTests', () => {
  it.each([
    [[14, 0], '2026-10-20 14:30'], [[14, 12], '2026-10-20 14:30'], [[14, 15], '2026-10-20 14:30'],
    [[14, 20], '2026-10-20 15:00'], [[23, 50], '2026-10-21 00:30'],
  ] as const)('nextSlot %j → %s', ([h, m], expected) =>
    expect(pragueString(ScheduleDefaults.nextSlot(prague(2026, 10, 20, h, m), cal))).toBe(expected));
  it('nextSlotIgnoresSeconds', () =>
    expect(pragueString(ScheduleDefaults.nextSlot(new Date(prague(2026, 10, 20, 14, 15).getTime() + 1000), cal))).toBe('2026-10-20 15:00'));
  it('resolveDayOnlyFutureDayIsNine', () =>
    expect(pragueString(ScheduleDefaults.resolveDayOnly(prague(2026, 10, 23), prague(2026, 10, 20, 15, 0), cal))).toBe('2026-10-23 09:00'));
  it.each([[[8, 0], '2026-10-20 09:00'], [[10, 5], '2026-10-20 10:30'], [[23, 40], '2026-10-21 09:00']] as const)(
    'resolveDayOnlyToday %j → %s', ([h, m], expected) =>
      expect(pragueString(ScheduleDefaults.resolveDayOnly(prague(2026, 10, 20), prague(2026, 10, 20, h, m), cal))).toBe(expected));
  it('composeKeepsDayAndTime', () =>
    expect(pragueString(ScheduleDefaults.compose(prague(2026, 11, 3, 18, 45), prague(2026, 10, 20, 7, 15), cal))).toBe('2026-11-03 07:15'));
  it('composeSkippedTimeMovesForward', () =>
    expect(pragueString(ScheduleDefaults.compose(prague(2026, 3, 29), prague(2026, 3, 28, 2, 30), cal))).toBe('2026-03-29 03:30'));
  it('composeRepeatedTimeTakesFirst', () => {
    const date = ScheduleDefaults.compose(prague(2026, 10, 25), prague(2026, 10, 24, 2, 30), cal);
    expect(pragueString(date)).toBe('2026-10-25 02:30');
    expect(date.toISOString()).toBe('2026-10-25T00:30:00.000Z'); // UTC+2, the first occurrence
  });
  it('appClockParsesLocalAndISO', () => {
    expect(AppClock.parse('2026-10-23T10:00', 'Europe/Prague')).toEqual(prague(2026, 10, 23, 10, 0));
    expect(AppClock.parse('2026-10-23T08:00:00Z', 'Europe/Prague')).toEqual(prague(2026, 10, 23, 10, 0));
    expect(AppClock.parse('tomorrow', 'Europe/Prague')).toBeNull();
  });
});

describe('scheduleDefaults (TS)', () => {
  it('dayPartHours', () => expect(DayPart).toEqual({ morningHour: 9, afternoonHour: 15, eveningHour: 19, nightHour: 20 }));
  it('dayOnlyHourIsTheMorning', () => expect(ScheduleDefaults.dayOnlyHour).toBe(9));
  it('appClockAcceptsTheSpaceForm', () => expect(AppClock.parse('2026-10-23 10:00', 'Europe/Prague')).toEqual(prague(2026, 10, 23, 10, 0)));
  it('createClockShiftsToTheQueryAndKeepsTicking', () => {
    let real = Date.UTC(2030, 0, 1);
    const clock = createClock({ search: '?debug=motion&now=2026-10-23T10:00', timeZone: 'Europe/Prague', realNow: () => real });
    expect(clock()).toEqual(prague(2026, 10, 23, 10, 0));
    real += 90_000;
    expect(pragueString(clock())).toBe('2026-10-23 10:01');
  });
  it('createClockWithoutAnOverrideIsRealTime', () =>
    expect(createClock({ search: '', timeZone: 'Europe/Prague', realNow: () => 42 })().getTime()).toBe(42));
});
