// Time-zone-safe calendar arithmetic: the subset of Foundation `Calendar` the Swift services use.
// Every function takes the zone explicitly; nothing reads the host time zone except
// `currentCalendar()`, which names it.

/** Foundation weekday numbering: 1 = Sunday … 7 = Saturday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Calendar {
  readonly timeZone: string;      // IANA id, e.g. "Europe/Prague"
  readonly locale: string;        // BCP 47, e.g. "en-US", "cs-CZ"
  readonly firstWeekday: Weekday; // Calendar.firstWeekday (en-US 1, cs-CZ 2)
}

export interface DateComponents {
  year: number; month: number; day: number;        // 1-based month/day
  hour: number; minute: number; second: number;
  weekday: Weekday;
}

type WallTime = { year: number; month: number; day: number; hour: number; minute: number; second: number };

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

/** Production calendar: the visitor's time zone, locale "en-US" (landing spec §5.3), firstWeekday 1. */
export function currentCalendar(): Calendar {
  return { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, locale: 'en-US', firstWeekday: 1 };
}

/** Fixed test calendar, identical to ScheduleTestSupport.swift `pragueCalendar`. */
export const pragueCalendar: Calendar = { timeZone: 'Europe/Prague', locale: 'cs-CZ', firstWeekday: 2 };

const wallFormatters = new Map<string, Intl.DateTimeFormat>();

function wallFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = wallFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23',
      year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
    });
    wallFormatters.set(timeZone, formatter);
  }
  return formatter;
}

function wallTime(timeZone: string, t: number): WallTime {
  const wall: WallTime = { year: 0, month: 0, day: 0, hour: 0, minute: 0, second: 0 };
  for (const part of wallFormatter(timeZone).formatToParts(t)) {
    if (part.type in wall) wall[part.type as keyof WallTime] = Number(part.value);
  }
  return wall;
}

function wallAsUTC(w: WallTime): number {
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
}

/** The zone's offset from UTC at instant `t`, in milliseconds (wall clock − instant). */
function offset(timeZone: string, t: number): number {
  const seconds = Math.floor(t / 1000) * 1000;
  return wallAsUTC(wallTime(timeZone, seconds)) - seconds;
}

function monthLength(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function sameWall(a: WallTime, b: WallTime): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day
    && a.hour === b.hour && a.minute === b.minute && a.second === b.second;
}

function isValidWall(w: WallTime): boolean {
  return [w.year, w.month, w.day, w.hour, w.minute, w.second].every(Number.isInteger)
    && w.month >= 1 && w.month <= 12
    && w.day >= 1 && w.day <= monthLength(w.year, w.month)
    && w.hour >= 0 && w.hour <= 23
    && w.minute >= 0 && w.minute <= 59
    && w.second >= 0 && w.second <= 59;
}

/** How a wall time that the zone skips (spring forward) resolves. */
type GapPolicy = 'shiftByGap' | 'nextValidMinute';

/** Wall clock → instant; a repeated time takes its first occurrence. */
function instantOf(timeZone: string, wall: WallTime, gap: GapPolicy): number {
  const w = wallAsUTC(wall);
  const before = offset(timeZone, w - 12 * HOUR);
  const after = offset(timeZone, w + 12 * HOUR);
  const valid = [w - before, w - after].filter((t) => sameWall(wallTime(timeZone, t), wall));
  if (valid.length > 0) return Math.min(...valid);
  if (gap === 'shiftByGap') return w - before;
  // The transition lies in [w − after, w − before]: the first whole minute already on `after`.
  let lo = Math.floor((w - after) / MINUTE);
  let hi = Math.ceil((w - before) / MINUTE);
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (offset(timeZone, mid * MINUTE) === after) hi = mid;
    else lo = mid + 1;
  }
  return lo * MINUTE;
}

function millisecondsOf(date: Date): number {
  return ((date.getTime() % 1000) + 1000) % 1000;
}

export function components(cal: Calendar, date: Date): DateComponents {
  const wall = wallTime(cal.timeZone, date.getTime());
  const weekday = (new Date(Date.UTC(wall.year, wall.month - 1, wall.day)).getUTCDay() + 1) as Weekday;
  return { ...wall, weekday };
}

/** Wall clock → instant, Foundation `calendar.date(from: components)` policy: a skipped
 *  spring-forward time shifts forward by the gap (02:30 → 03:30); a repeated autumn time takes
 *  its first occurrence. Returns null only when the components are not a real calendar date
 *  (31 Feb) — the caller round-trips like NaturalDateParser.resolveDate. */
export function dateFrom(
  cal: Calendar,
  c: { year: number; month: number; day: number; hour?: number; minute?: number; second?: number },
): Date | null {
  const wall: WallTime = { year: c.year, month: c.month, day: c.day, hour: c.hour ?? 0, minute: c.minute ?? 0, second: c.second ?? 0 };
  if (!isValidWall(wall)) return null;
  return new Date(instantOf(cal.timeZone, wall, 'shiftByGap'));
}

/** `calendar.date(bySettingHour:minute:second:of:matchingPolicy: .nextTime, repeatedTimePolicy: .first, direction: .forward)`:
 *  a skipped time snaps to the next valid instant (02:30 → 03:00). Used only by NaturalDateParser.apply. */
export function settingTime(cal: Calendar, day: Date, hour: number, minute: number): Date {
  const { year, month, day: dayOfMonth } = components(cal, day);
  const wall: WallTime = { year, month, day: dayOfMonth, hour, minute, second: 0 };
  if (!isValidWall(wall)) throw new RangeError(`settingTime: invalid time ${hour}:${minute}`);
  return new Date(instantOf(cal.timeZone, wall, 'nextValidMinute'));
}

export function startOfDay(cal: Calendar, date: Date): Date {
  const { year, month, day } = components(cal, date);
  return new Date(instantOf(cal.timeZone, { year, month, day, hour: 0, minute: 0, second: 0 }, 'shiftByGap'));
}

/** Stays on the instant's own offset, so a repeated hour keeps its occurrence. */
export function startOfHour(cal: Calendar, date: Date): Date {
  const { minute, second } = components(cal, date);
  return new Date(date.getTime() - (minute * 60 + second) * 1000 - millisecondsOf(date));
}

export function startOfMonth(cal: Calendar, date: Date): Date {
  const { year, month } = components(cal, date);
  return new Date(instantOf(cal.timeZone, { year, month, day: 1, hour: 0, minute: 0, second: 0 }, 'shiftByGap'));
}

export function daysInMonth(cal: Calendar, date: Date): number {
  const { year, month } = components(cal, date);
  return monthLength(year, month);
}

/** Wall-clock day arithmetic: keeps hour:minute:second across DST. */
export function addDays(cal: Calendar, date: Date, days: number): Date {
  const c = components(cal, date);
  const shifted = new Date(Date.UTC(c.year, c.month - 1, c.day + days));
  const wall: WallTime = {
    year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate(),
    hour: c.hour, minute: c.minute, second: c.second,
  };
  return new Date(instantOf(cal.timeZone, wall, 'shiftByGap') + millisecondsOf(date));
}

/** Foundation clamping: 31 Jan + 1 month → 28/29 Feb. */
export function addMonths(cal: Calendar, date: Date, months: number): Date {
  const c = components(cal, date);
  const monthIndex = c.month - 1 + months;
  const year = c.year + Math.floor(monthIndex / 12);
  const month = (((monthIndex % 12) + 12) % 12) + 1;
  const wall: WallTime = {
    year, month, day: Math.min(c.day, monthLength(year, month)),
    hour: c.hour, minute: c.minute, second: c.second,
  };
  return new Date(instantOf(cal.timeZone, wall, 'shiftByGap') + millisecondsOf(date));
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MINUTE);
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * HOUR);
}

export function isSameDay(cal: Calendar, a: Date, b: Date): boolean {
  const x = components(cal, a);
  const y = components(cal, b);
  return x.year === y.year && x.month === y.month && x.day === y.day;
}

/** `compare(_:to:toGranularity: .minute)`: both instants fall in the same wall-clock minute. */
export function isSameMinute(cal: Calendar, a: Date, b: Date): boolean {
  const startOfMinute = (date: Date) => date.getTime() - components(cal, date).second * 1000 - millisecondsOf(date);
  return startOfMinute(a) === startOfMinute(b);
}

/** startOfDay(from) → startOfDay(to), in whole calendar days. */
export function daysBetween(cal: Calendar, from: Date, to: Date): number {
  const midnight = (date: Date) => {
    const { year, month, day } = components(cal, date);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((midnight(to) - midnight(from)) / DAY);
}

export function weekdayOf(cal: Calendar, date: Date): Weekday {
  return components(cal, date).weekday;
}
