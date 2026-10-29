import { describe, expect, it } from 'vitest';
import type { Calendar } from '../../src/recreation/core/calendar';
import { MonthGrid } from '../../src/recreation/core/monthGrid';
import { prague, pragueCalendar as cal, pragueString } from '../support';

const us: Calendar = { ...cal, locale: 'en-US', firstWeekday: 1 };

describe('MonthGridTests', () => {
  it('octoberStartsOnThursdayInAMondayFirstLocale', () => {
    const cells = MonthGrid.cells(prague(2026, 10, 23, 10), cal);
    expect(cells).toHaveLength(42);
    expect(cells.slice(0, 3).every((c) => c === null)).toBe(true);
    expect(cells[3]).toEqual(prague(2026, 10, 1));
    expect(cells[3 + 30]).toEqual(prague(2026, 10, 31));
    expect(cells.slice(34).every((c) => c === null)).toBe(true);
    expect(cells.filter(Boolean)).toHaveLength(31);
  });
  it('sundayFirstLocaleShiftsTheColumns', () => {
    expect(MonthGrid.cells(prague(2026, 10, 5), us)[4]).toEqual(prague(2026, 10, 1));
    expect(MonthGrid.weekdaySymbols(us)[0]).toBe('S');
    expect(MonthGrid.weekdaySymbols(cal)).toHaveLength(7);
  });
  it('sixRowsAlwaysFit', () => {
    const cells = MonthGrid.cells(prague(2026, 3, 10), cal);
    expect(cells[6]).toEqual(prague(2026, 3, 1));
    expect(cells[36]).toEqual(prague(2026, 3, 31));
  });
  it('arrowMovementKeepsTheTimeAndNeverEntersThePast', () => {
    const now = prague(2026, 10, 23, 10), draft = prague(2026, 10, 24, 14, 30);
    expect(MonthGrid.moving(draft, 7, now, cal)).toEqual(prague(2026, 10, 31, 14, 30));
    expect(MonthGrid.moving(draft, -1, now, cal)).toEqual(prague(2026, 10, 23, 14, 30));
    expect(MonthGrid.moving(draft, -7, now, cal)).toEqual(draft);
  });
  it('movementCrossesDSTOnWallClockTime', () => {
    const draft = prague(2026, 10, 24, 9);
    expect(pragueString(MonthGrid.moving(draft, 2, draft, cal))).toBe('2026-10-26 09:00');
  });
  it('paging', () => {
    const now = prague(2026, 10, 23, 10);
    expect(MonthGrid.shiftMonth(prague(2026, 10, 31), 1, cal)).toEqual(prague(2026, 11, 1));
    expect(MonthGrid.shiftMonth(prague(2026, 12, 15), 1, cal)).toEqual(prague(2027, 1, 1));
    expect(MonthGrid.canGoBack(prague(2026, 10, 1), now, cal)).toBe(false);
    expect(MonthGrid.canGoBack(prague(2026, 11, 1), now, cal)).toBe(true);
    expect(MonthGrid.isSelectable(prague(2026, 10, 23, 0), now, cal)).toBe(true);
    expect(MonthGrid.isSelectable(prague(2026, 10, 22, 23, 59), now, cal)).toBe(false);
  });
  it('weekRowOfADay', () => {
    expect(MonthGrid.week(prague(2026, 10, 1, 9), cal)).toBe(0);
    expect(MonthGrid.week(prague(2026, 10, 24, 9), cal)).toBe(3);
    expect(MonthGrid.week(prague(2026, 10, 31, 9), cal)).toBe(4);
    expect(MonthGrid.week(prague(2026, 3, 31, 9), cal)).toBe(5);
  });
});

describe('monthGrid (TS)', () => {
  it('veryShortSymbolsInGridOrder', () => {
    expect(MonthGrid.weekdaySymbols(cal)).toEqual(['P', 'Ú', 'S', 'Č', 'P', 'S', 'N']);
    expect(MonthGrid.weekdaySymbols(us)).toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'S']);
  });
  it('fullSymbolsInGridOrder', () => {
    expect(MonthGrid.fullWeekdaySymbols(cal)[0]).toBe('pondělí');
    expect(MonthGrid.fullWeekdaySymbols(us)).toEqual(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
  });
});
