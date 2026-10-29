// Port of Services/ScheduleDefaults.swift: the rules every scheduling path shares (Tab on a title
// suggestion, the typed Set Date field, the presets): which time a day-only date gets, and where
// "now-ish" lands.
import {
  addDays, addMinutes, components, dateFrom, isSameDay, settingTime, startOfDay, startOfHour,
  type Calendar,
} from './calendar';

/** Day-part hours shared by the parser ("morning", "večer", "tonight") and the presets.
 *  `nightHour` ("tonight") is later than the evening preset on purpose. */
export const DayPart = { morningHour: 9, afternoonHour: 15, eveningHour: 19, nightHour: 20 } as const;

/** `hour:minute` on the day of `day`, built from components: a skipped spring-forward 02:30
 *  shifts by the gap to 03:30, a repeated autumn time takes its first occurrence. */
function at(hour: number, minute: number, day: Date, calendar: Calendar): Date {
  const { year, month, day: dayOfMonth } = components(calendar, day);
  return dateFrom(calendar, { year, month, day: dayOfMonth, hour, minute, second: 0 })
    ?? settingTime(calendar, day, hour, minute);
}

/** The next :00 / :30 (default granularity) at least `minLeadSeconds` ahead, counted from the
 *  start of the hour: 14:12 → 14:30, 14:20 → 15:00, 23:50 → 00:30 the next day. */
function nextSlot(now: Date, calendar: Calendar, granularity = 30, minLeadSeconds = 15 * 60): Date {
  const earliest = new Date(now.getTime() + minLeadSeconds * 1000);
  let slot = startOfHour(calendar, earliest);
  while (slot < earliest) slot = addMinutes(slot, granularity);
  return slot;
}

/** A day-only date at 9:00. Today after 9:00 becomes the next slot, and when that slot would
 *  cross midnight, tomorrow at 9:00. */
function resolveDayOnly(day: Date, now: Date, calendar: Calendar): Date {
  const morning = at(DayPart.morningHour, 0, day, calendar);
  if (morning > now) return morning;
  const slot = nextSlot(now, calendar);
  if (isSameDay(calendar, slot, now)) return slot;
  const tomorrow = addDays(calendar, startOfDay(calendar, now), 1);
  return at(DayPart.morningHour, 0, tomorrow, calendar);
}

/** The calendar day of `day` with the hour and minute of `time`. */
function compose(day: Date, time: Date, calendar: Calendar): Date {
  const { hour, minute } = components(calendar, time);
  return at(hour, minute, day, calendar);
}

export const ScheduleDefaults = {
  /** Hour a day-only date resolves to; the parser's "morning". */
  dayOnlyHour: DayPart.morningHour,
  nextSlot,
  resolveDayOnly,
  compose,
  at,
} as const;
