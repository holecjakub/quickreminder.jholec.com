import { describe, expect, it } from 'vitest';
import { ScheduleInput } from '../../src/recreation/core/scheduleInput';
import { ScheduleText } from '../../src/recreation/core/scheduleText';
import { prague, pragueCalendar as cal } from '../support';

describe('scheduleText', () => {
  it('constants', () => {
    expect(ScheduleText.chipHours).toEqual([9, 12, 15, 19]);
    expect(ScheduleText.placeholder).toBe('fri 2pm, zítra 14:00, +2h');
    expect(ScheduleText.inThePast).toBe('In the past');
  });
  it('invalidExampleFollowsTheLanguage', () => {
    expect(ScheduleText.invalidExample('cs-CZ')).toBe('zítra 14:00');
    expect(ScheduleText.invalidExample('cs')).toBe('zítra 14:00');
    expect(ScheduleText.invalidExample('en-US')).toBe('tomorrow 2pm');
  });
  it('notADate', () => expect(ScheduleText.notADate('tomorrow 2pm')).toBe('Not a date — try “tomorrow 2pm”'));
  it.each(['cs-CZ', 'en-US'])('theExampleItselfParses (%s)', (locale) =>
    expect(ScheduleInput.resolve(ScheduleText.invalidExample(locale), prague(2026, 10, 23, 10), cal).type).toBe('date'));
});
