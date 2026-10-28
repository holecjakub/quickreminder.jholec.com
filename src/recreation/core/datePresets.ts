// Port of Services/DatePresets.swift: the one preset set shared by the calendar menu and the
// Set Date section (⌘1…⌘6), in display order. Rows never hide: labels adapt to the time of day,
// positions stay put.
import {
  addDays, addMinutes, addMonths, daysBetween, isSameDay, isSameMinute, startOfDay, startOfMonth,
  weekdayOf, type Calendar, type Weekday,
} from './calendar';
import { DayPart, ScheduleDefaults } from './scheduleDefaults';

export type DatePreset = 'inOneHour' | 'evening' | 'tomorrow' | 'weekend' | 'nextWeek' | 'nextMonth';

/** Display order = ⌘1…⌘6 (Swift CaseIterable order). */
export const DATE_PRESETS: readonly DatePreset[] = ['inOneHour', 'evening', 'tomorrow', 'weekend', 'nextWeek', 'nextMonth'];

/** A preset the user chose and the date it wrote; `highlighted` trusts it only while the
 *  reminder still carries that date. */
export interface PresetPick { readonly preset: DatePreset; readonly date: Date; }

type SystemImage = 'clock' | 'moon' | 'sunrise' | 'sofa' | 'calendar.badge.plus' | 'calendar';
type DayTemplate = 'EEE' | 'EEEE' | 'd MMM' | 'EEEE d MMMM';

/** The evening preset rolls to tomorrow this close to its hour (18:30 → tomorrow 19:00). */
const eveningCutoffMinutes = 30;

/** The next `weekday` (1 = Sunday … 7 = Saturday) strictly after today, at the start of the day.
 *  The parser resolves "friday" / "next week" / "weekend" through this too, so a typed phrase
 *  and the matching preset always agree. */
function nextWeekday(weekday: Weekday, now: Date, calendar: Calendar): Date {
  const today = startOfDay(calendar, now);
  let delta = (weekday - weekdayOf(calendar, today) + 7) % 7;
  if (delta === 0) delta = 7;
  return addDays(calendar, today, delta);
}

function date(preset: DatePreset, now: Date, calendar: Calendar): Date {
  const today = startOfDay(calendar, now);
  const day = (offset: number) => addDays(calendar, today, offset);
  const morning = (of: Date) => ScheduleDefaults.at(ScheduleDefaults.dayOnlyHour, 0, of, calendar);

  switch (preset) {
    case 'inOneHour':
      // Exact minutes kept, like the menu's "Remind Me In 1 Hour" always did.
      return addMinutes(now, 60);
    case 'evening': {
      const tonight = ScheduleDefaults.at(DayPart.eveningHour, 0, today, calendar);
      const rolls = now >= addMinutes(tonight, -eveningCutoffMinutes);
      return rolls ? ScheduleDefaults.at(DayPart.eveningHour, 0, day(1), calendar) : tonight;
    }
    case 'tomorrow':
      return morning(day(1));
    case 'weekend':
      return morning(nextWeekday(7, now, calendar));
    case 'nextWeek':
      return morning(nextWeekday(2, now, calendar));
    case 'nextMonth':
      return morning(addMonths(calendar, startOfMonth(calendar, today), 1));
  }
}

/** Short label (Set Date cards; the menu prefixes two of them, see `menuTitle`). */
function title(preset: DatePreset, now: Date, calendar: Calendar): string {
  switch (preset) {
    case 'inOneHour': return 'In 1 Hour';
    case 'evening':
      return isSameDay(calendar, date('evening', now, calendar), now) ? 'This Evening' : 'Tomorrow Evening';
    case 'tomorrow': return 'Tomorrow';
    case 'weekend': {
      const weekday = weekdayOf(calendar, now);
      return weekday === 7 || weekday === 1 ? 'Next Weekend' : 'This Weekend';
    }
    case 'nextWeek': return 'Next Week';
    case 'nextMonth': return 'Next Month';
  }
}

/** Menu wording: the two rows the menu already had keep their "Remind Me …" labels. */
function menuTitle(preset: DatePreset, now: Date, calendar: Calendar): string {
  switch (preset) {
    case 'inOneHour': return 'Remind Me In 1 Hour';
    case 'tomorrow': return 'Remind Me Tomorrow';
    default: return title(preset, now, calendar);
  }
}

const systemImages: Record<DatePreset, SystemImage> = {
  inOneHour: 'clock', evening: 'moon', tomorrow: 'sunrise',
  weekend: 'sofa', nextWeek: 'calendar.badge.plus', nextMonth: 'calendar',
};

function systemImage(preset: DatePreset): SystemImage {
  return systemImages[preset];
}

/** Locale template for the day part of a date shown next to "now": null today (time only), the
 *  weekday for the next six days, day + month from a week out (and for the past). `spoken`
 *  spells weekday and month out for VoiceOver. */
function dayTemplate(date: Date, now: Date, calendar: Calendar, spoken = false): DayTemplate | null {
  const days = daysBetween(calendar, now, date);
  if (days === 0) return null;
  if (days >= 1 && days <= 6) return spoken ? 'EEEE' : 'EEE';
  return spoken ? 'EEEE d MMMM' : 'd MMM';
}

/** The preset card to highlight for `draft`. Several presets can land on the same minute (on a
 *  Friday, Tomorrow and This Weekend are both Sat 9:00): the one the user picked wins while the
 *  date is still the one it set; any other date highlights the first preset in display order
 *  that matches, or none. */
function highlighted(draft: Date, picked: PresetPick | null, now: Date, calendar: Calendar): DatePreset | null {
  const same = (a: Date, b: Date) => isSameMinute(calendar, a, b);
  if (picked && same(picked.date, draft) && same(date(picked.preset, now, calendar), draft)) {
    return picked.preset;
  }
  return DATE_PRESETS.find((preset) => same(date(preset, now, calendar), draft)) ?? null;
}

export const DatePresets = {
  eveningCutoffMinutes,
  date,
  title,
  menuTitle,
  systemImage,
  dayTemplate,
  highlighted,
  nextWeekday,
} as const;
