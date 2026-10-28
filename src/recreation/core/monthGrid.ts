// Port of Services/MonthGrid.swift: the in-notch Set Date month grid as data. Always six weeks
// (so the section's height never depends on the month), starting on the locale's first weekday,
// with null for days outside the month. Pure, so the layout and keyboard movement are
// unit-tested without a view.
import {
  addDays, addMonths, type Calendar, daysInMonth, startOfDay, startOfMonth, weekdayOf,
} from './calendar';

const WEEKS = 6;
const CELL_COUNT = WEEKS * 7;

/** Sunday 1 Nov 2026 … Saturday 7 Nov 2026 (UTC): one date per weekday, Sunday first. */
const SUNDAY_FIRST_WEEK = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2026, 10, 1 + i)));

/** Weekday names Sunday first, rotated into grid order (starting on `firstWeekday`). */
function symbolsInGridOrder(calendar: Calendar, weekday: 'narrow' | 'long'): string[] {
  const format = new Intl.DateTimeFormat(calendar.locale, { weekday, timeZone: 'UTC' });
  const symbols = SUNDAY_FIRST_WEEK.map((date) => format.format(date));
  const start = calendar.firstWeekday - 1;
  return [...symbols.slice(start), ...symbols.slice(0, start)];
}

function cells(month: Date, calendar: Calendar): ReadonlyArray<Date | null> {
  const first = startOfMonth(calendar, month);
  const lead = (weekdayOf(calendar, first) - calendar.firstWeekday + 7) % 7;
  const grid: Array<Date | null> = Array.from({ length: CELL_COUNT }, () => null);
  const dayCount = daysInMonth(calendar, first);
  for (let offset = 0; offset < dayCount; offset++) grid[lead + offset] = addDays(calendar, first, offset);
  return grid;
}

export const MonthGrid = {
  weeks: WEEKS as 6,
  cellCount: CELL_COUNT as 42,

  /** Midnight on the first day of `date`'s month. */
  startOfMonth(date: Date, calendar: Calendar): Date {
    return startOfMonth(calendar, date);
  },

  /** `cellCount` cells, row by row; a cell is the day's midnight or null (leading / trailing blank). */
  cells,

  /** The grid row (0…5) of `day` in its own month's grid. */
  week(day: Date, calendar: Calendar): number | null {
    const start = startOfDay(calendar, day).getTime();
    const index = cells(day, calendar).findIndex((cell) => cell?.getTime() === start);
    return index < 0 ? null : Math.floor(index / 7);
  },

  /** Very short weekday names ("S", "M" / "P", "Ú") in grid order. */
  weekdaySymbols(calendar: Calendar): readonly string[] {
    return symbolsInGridOrder(calendar, 'narrow');
  },

  /** Full weekday names in grid order (screen readers / tooltips). */
  fullWeekdaySymbols(calendar: Calendar): readonly string[] {
    return symbolsInGridOrder(calendar, 'long');
  },

  /** The first of the month `months` months away from `month`'s. */
  shiftMonth(month: Date, months: number, calendar: Calendar): Date {
    return addMonths(calendar, startOfMonth(calendar, month), months);
  },

  /** Arrow-key movement: `days` away from `day` (±1 left/right, ±7 up/down), never before
   *  `earliest` (today; the past is not selectable). Keeps `day`'s time of day. */
  moving(day: Date, days: number, earliest: Date, calendar: Calendar): Date {
    const moved = addDays(calendar, day, days);
    return startOfDay(calendar, moved) < startOfDay(calendar, earliest) ? day : moved;
  },

  /** Whether `day` can be picked (today or later). */
  isSelectable(day: Date, now: Date, calendar: Calendar): boolean {
    return startOfDay(calendar, day) >= startOfDay(calendar, now);
  },

  /** Whether the month before `month` still has selectable days (the ‹ button). */
  canGoBack(month: Date, now: Date, calendar: Calendar): boolean {
    return startOfMonth(calendar, month) > startOfMonth(calendar, now);
  },
} as const;
