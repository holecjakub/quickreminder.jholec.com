// "Now" for the recreation (port of AppClock in Services/ScheduleDefaults.swift). The app reads
// `QR_NOW` from the environment; the page reads `?now=2026-10-23T10:00` (local time, or any
// ISO 8601 date with a zone) once, and time still advances from there.
import { dateFrom, type Calendar } from './core/calendar';

export type Clock = () => Date;

const utc: Calendar = { timeZone: 'UTC', locale: 'en-US', firstWeekday: 1 };

/** `ISO8601DateFormatter` default: `yyyy-MM-dd'T'HH:mm:ss` plus `Z` or `±HH:mm` / `±HHmm`. */
const isoPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(Z|([+-])(\d{2}):?(\d{2}))$/;

/** The local forms, in the order Swift tries them: `yyyy-MM-dd'T'HH:mm:ss`, `yyyy-MM-dd'T'HH:mm`, `yyyy-MM-dd HH:mm`. */
const localPatterns = [
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/,
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})()$/,
  /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})()$/,
];

function wallDate(calendar: Calendar, match: RegExpExecArray): Date | null {
  const [year = 0, month = 0, day = 0, hour = 0, minute = 0, second = 0] = match.slice(1, 7).map(Number);
  return dateFrom(calendar, { year, month, day, hour, minute, second });
}

function parse(raw: string, timeZone: string): Date | null {
  const iso = isoPattern.exec(raw);
  if (iso) {
    const wall = wallDate(utc, iso);
    if (!wall) return null;
    if (iso[7] === 'Z') return wall;
    const offsetMinutes = (iso[8] === '-' ? -1 : 1) * (Number(iso[9]) * 60 + Number(iso[10]));
    return new Date(wall.getTime() - offsetMinutes * 60_000);
  }
  const calendar: Calendar = { timeZone, locale: 'en-US', firstWeekday: 1 };
  for (const pattern of localPatterns) {
    const local = pattern.exec(raw);
    if (local) return wallDate(calendar, local);
  }
  return null;
}

/** A clock shifted to the `now=` query parameter (read once, here); time keeps advancing.
 *  No or an unparseable `now=` → real time. */
export function createClock(opts: { search: string; timeZone: string; realNow?: () => number }): Clock {
  const realNow = opts.realNow ?? Date.now;
  const raw = new URLSearchParams(opts.search).get('now');
  const forced = raw === null ? null : parse(raw, opts.timeZone);
  const offset = forced === null ? 0 : forced.getTime() - realNow();
  return () => new Date(realNow() + offset);
}

let appClock: Clock | null = null;

export const AppClock = {
  /** `yyyy-MM-dd'T'HH:mm[:ss]` or `yyyy-MM-dd HH:mm` in `timeZone`, or a full ISO 8601 timestamp. */
  parse,
  /** The page's clock: `?now=` from the URL, the visitor's time zone. */
  now(): Date {
    appClock ??= createClock({
      search: typeof window === 'undefined' ? '' : window.location.search,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    return appClock();
  },
};
