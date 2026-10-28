import { describe, expect, it } from 'vitest';
import { NaturalDateParser } from '../../src/recreation/core/naturalDateParser';
import { ScheduleInput } from '../../src/recreation/core/scheduleInput';
import { prague, pragueCalendar as cal, pragueString } from '../support';

const NOW = prague(2026, 10, 23, 10, 0);
const resolve = (text: string, now = NOW) => {
  const r = ScheduleInput.resolve(text, now, cal);
  return r.type === 'date' ? pragueString(r.date) : r.type;
};

describe('ScheduleInputTests', () => {
  it.each([
    ['zítra 14:00', '2026-10-24 14:00'], ['zitra 14:00', '2026-10-24 14:00'], ['next fri 9am', '2026-10-30 09:00'],
    ['fri 2pm', '2026-10-30 14:00'], ['sat', '2026-10-24 09:00'], ['v pátek', '2026-10-30 09:00'],
    ['next week', '2026-10-26 09:00'], ['tonight', '2026-10-23 20:00'], ['14', '2026-10-23 14:00'], ['3', '2026-10-23 15:00'],
    ['930', '2026-10-24 09:30'], ['1430', '2026-10-23 14:30'], ['14:30', '2026-10-23 14:30'], ['14.30', '2026-10-23 14:30'],
    ['+90m', '2026-10-23 11:30'], ['+2h', '2026-10-23 12:00'], ['+2 H', '2026-10-23 12:00'], ['+3d', '2026-10-26 09:00'],
    ['15.11.', '2026-11-15 09:00'], ['15.11', '2026-11-15 09:00'], ['24.12', '2026-12-24 09:00'], ['31.12', '2026-12-31 09:00'],
    ['1.12', '2026-12-01 09:00'], ['5.11', '2026-11-05 09:00'], ['8.05', '2026-10-24 08:05'], ['12:10', '2026-10-23 12:10'],
    ['tomorrow 2pm', '2026-10-24 14:00'], ['  zítra 14:00  ', '2026-10-24 14:00'],
  ])('valid "%s" → %s', (text, expected) => expect(resolve(text)).toBe(expected));
  it('offsetKeepsMinutes', () => expect(resolve('za 2 hodiny', prague(2026, 10, 23, 10, 17))).toBe('2026-10-23 12:17'));
  it('bareHourAlreadyPastRollsToTomorrow', () => expect(resolve('14', prague(2026, 10, 23, 15, 0))).toBe('2026-10-24 14:00'));
  it('todayAfterNineIsNextSlot', () => {
    expect(resolve('today', prague(2026, 10, 23, 10, 5))).toBe('2026-10-23 10:30');
    expect(resolve('dnes', prague(2026, 10, 23, 8, 0))).toBe('2026-10-23 09:00');
  });
  it.each(['buy milk tomorrow', '2500', '25:00', '14:75', 'abc', 'tomorrow please', '+5y'])('invalid "%s"', (t) => expect(resolve(t)).toBe('invalid'));
  it.each(['', '   ', '\n\t'])('empty %j', (t) => expect(resolve(t)).toBe('empty'));
  it('leniencyStaysOutOfTheTitleParser', () => {
    expect(NaturalDateParser.parse('buy 2 apples', NOW, cal)).toBeNull();
    expect(NaturalDateParser.parse('1430', NOW, cal)).toBeNull();
    expect(NaturalDateParser.parse('+2h', NOW, cal)).toBeNull();
  });
});
