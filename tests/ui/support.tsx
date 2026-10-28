// Test-only helpers for the recreation UI: the fixed test time and calendar, fake timers, and the
// inverse of `px()`.
import type { Calendar } from '../../src/recreation/core/calendar';

/** Friday 2026-09-18 10:00 Europe/Prague, the parser suite's `now`. */
export const TEST_NOW = new Date('2026-09-18T08:00:00Z');

export const testCalendar: Calendar = { timeZone: 'Europe/Prague', locale: 'en-US', firstWeekday: 1 };

/** Fakes setTimeout / setInterval / Date and sets the system time to TEST_NOW. */
export function useTestTime(): void {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  vi.setSystemTime(TEST_NOW);
}

const PT_LENGTH = /^calc\((-?\d+(?:\.\d+)?) \* var\(--pt\) \* 1px\)$/;

/** Reads the point value back out of a `px(pt)` length; throws on anything else. */
export function ptOf(value: string): number {
  const match = PT_LENGTH.exec(value);
  if (!match) throw new Error(`not a px(pt) length: ${value}`);
  return Number(match[1]);
}
