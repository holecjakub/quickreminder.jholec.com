// Port of Tests/QuickReminderCoreTests/ScheduleTestSupport.swift: a fixed Europe/Prague calendar
// (so the DST cases are real) and a compact date builder. Week of 19 Oct 2026: Mon 19 … Sun 25
// (DST ends Sun 25).
import { components, dateFrom, pragueCalendar } from '../src/recreation/core/calendar';

export { pragueCalendar };

export function prague(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  const date = dateFrom(pragueCalendar, { year, month, day, hour, minute });
  if (!date) throw new RangeError(`prague: not a date ${year}-${month}-${day} ${hour}:${minute}`);
  return date;
}

/** `"yyyy-MM-dd HH:mm"` in Europe/Prague. */
export function pragueString(date: Date): string {
  const c = components(pragueCalendar, date);
  const pad = (n: number, width = 2) => String(n).padStart(width, '0');
  return `${pad(c.year, 4)}-${pad(c.month)}-${pad(c.day)} ${pad(c.hour)}:${pad(c.minute)}`;
}

/** en-US puts a narrow no-break space before AM/PM; compare on plain spaces. */
export function plainSpaces(text: string): string {
  return text.replaceAll(' ', ' ').replaceAll(' ', ' ');
}
