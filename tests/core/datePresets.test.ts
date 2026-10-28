import { describe, expect, it } from 'vitest';
import { DATE_PRESETS, DatePresets, type DatePreset, type PresetPick } from '../../src/recreation/core/datePresets';
import { ScheduleDefaults } from '../../src/recreation/core/scheduleDefaults';
import { prague, pragueCalendar as cal, pragueString } from '../support';

const date = (p: DatePreset, now: Date) => pragueString(DatePresets.date(p, now, cal));
const title = (p: DatePreset, now: Date) => DatePresets.title(p, now, cal);

describe('DatePresetsTests', () => {
  it('mondayMorningResolvesAllSix', () => {
    const now = prague(2026, 10, 19, 10, 0);
    expect(date('inOneHour', now)).toBe('2026-10-19 11:00');
    expect(date('evening', now)).toBe('2026-10-19 19:00');
    expect(date('tomorrow', now)).toBe('2026-10-20 09:00');
    expect(date('weekend', now)).toBe('2026-10-24 09:00');
    expect(date('nextWeek', now)).toBe('2026-10-26 09:00');
    expect(date('nextMonth', now)).toBe('2026-11-01 09:00');
    expect(title('evening', now)).toBe('This Evening');
    expect(title('weekend', now)).toBe('This Weekend');
  });
  it('inOneHourKeepsMinutes', () => expect(date('inOneHour', prague(2026, 10, 19, 14, 37))).toBe('2026-10-19 15:37'));
  it('eveningSwitchesAtHalfPastSix', () => {
    const before = prague(2026, 10, 19, 18, 29), after = prague(2026, 10, 19, 18, 30);
    expect(date('evening', before)).toBe('2026-10-19 19:00');
    expect(title('evening', before)).toBe('This Evening');
    expect(date('evening', after)).toBe('2026-10-20 19:00');
    expect(title('evening', after)).toBe('Tomorrow Evening');
  });
  it('fridayEveningWeekendEqualsTomorrowBothListed', () => {
    const now = prague(2026, 10, 23, 17, 0);
    expect(date('weekend', now)).toBe('2026-10-24 09:00');
    expect(date('weekend', now)).toBe(date('tomorrow', now));
    expect(DATE_PRESETS).toHaveLength(6);
  });
  it.each([24, 25])('onTheWeekendItIsNextWeekend (%i Oct)', (day) => {
    const now = prague(2026, 10, day, 11, 0);
    expect(title('weekend', now)).toBe('Next Weekend');
    const expected = DatePresets.nextWeekday(7, now, cal);
    expect(date('weekend', now)).toBe(pragueString(ScheduleDefaults.at(9, 0, expected, cal)));
    expect(date('weekend', now)).toBe('2026-10-31 09:00');
  });
  it('sundayNextWeekIsTomorrow', () => expect(date('nextWeek', prague(2026, 10, 25, 11, 0))).toBe('2026-10-26 09:00'));
  it('nextMonthRollsOver', () => {
    expect(date('nextMonth', prague(2026, 1, 31, 12, 0))).toBe('2026-02-01 09:00');
    expect(date('nextMonth', prague(2026, 12, 15, 12, 0))).toBe('2027-01-01 09:00');
  });
  it('menuTitlesKeepTheRemindMeRows', () => {
    const now = prague(2026, 10, 19, 10, 0);
    expect(DatePresets.menuTitle('inOneHour', now, cal)).toBe('Remind Me In 1 Hour');
    expect(DatePresets.menuTitle('tomorrow', now, cal)).toBe('Remind Me Tomorrow');
    expect(DatePresets.menuTitle('nextWeek', now, cal)).toBe('Next Week');
  });
  it('dayTemplateByDistance', () => {
    const now = prague(2026, 10, 24, 17, 39); // Saturday
    const t = (d: Date, spoken = false) => DatePresets.dayTemplate(d, now, cal, spoken);
    expect(t(prague(2026, 10, 24, 19, 0))).toBeNull();
    expect(t(prague(2026, 10, 25, 9, 0))).toBe('EEE');
    expect(t(prague(2026, 10, 30, 9, 0))).toBe('EEE');
    expect(t(prague(2026, 10, 31, 9, 0))).toBe('d MMM');
    expect(t(prague(2026, 10, 31, 9, 0), true)).toBe('EEEE d MMMM');
    expect(t(prague(2026, 10, 23, 9, 0))).toBe('d MMM');
  });
  it('onlyOnePresetIsHighlighted', () => {
    const now = prague(2026, 10, 23, 10, 0), saturday = prague(2026, 10, 24, 9, 0);
    const pick = (preset: DatePreset): PresetPick => ({ preset, date: DatePresets.date(preset, now, cal) });
    expect(DatePresets.highlighted(saturday, null, now, cal)).toBe('tomorrow');
    expect(DatePresets.highlighted(saturday, pick('weekend'), now, cal)).toBe('weekend');
    expect(DatePresets.highlighted(saturday, pick('tomorrow'), now, cal)).toBe('tomorrow');
    expect(DatePresets.highlighted(prague(2026, 10, 24, 14, 0), pick('weekend'), now, cal)).toBeNull();
    expect(DatePresets.highlighted(prague(2026, 10, 26, 9, 0), pick('weekend'), now, cal)).toBe('nextWeek');
  });
  it('aPickWhosePresetMovedOnIsDropped', () => {
    const picked: PresetPick = { preset: 'inOneHour', date: prague(2026, 10, 23, 11, 0) };
    expect(DatePresets.highlighted(picked.date, picked, prague(2026, 10, 23, 10, 0), cal)).toBe('inOneHour');
    expect(DatePresets.highlighted(picked.date, picked, prague(2026, 10, 23, 10, 30), cal)).toBeNull();
  });
});

describe('datePresets (TS)', () => {
  it('displayOrderIsCmd1ToCmd6', () =>
    expect(DATE_PRESETS).toEqual(['inOneHour', 'evening', 'tomorrow', 'weekend', 'nextWeek', 'nextMonth']));
  it('systemImages', () =>
    expect(DATE_PRESETS.map(DatePresets.systemImage)).toEqual(['clock', 'moon', 'sunrise', 'sofa', 'calendar.badge.plus', 'calendar']));
  it('eveningCutoff', () => expect(DatePresets.eveningCutoffMinutes).toBe(30));
});
