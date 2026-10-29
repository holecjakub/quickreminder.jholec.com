// Port of Views/SuggestionDateFormatter.swift ("Tomorrow, 2:00 PM" / "Zítra 14:00" labels) and of
// the `RelativeDateTimeFormatter` (`.abbreviated`, `.numeric`) the Set Date preview uses
// ("in 23h" / "za 23 h"). Foundation templates map onto `Intl.DateTimeFormat` options; every
// expected string was measured with Foundation on macOS 26.
import { addDays, addHours, addMinutes, addMonths, daysBetween, type Calendar } from './calendar';
import { DatePresets } from './datePresets';

/** The Foundation templates (`setLocalizedDateFormatFromTemplate`) the app formats with. */
export type DateTemplate = 'j:mm' | 'EEE' | 'EEEE' | 'd MMM' | 'EEEE d MMMM' | 'EEE d MMM' | 'LLLL y' | 'MMMM y';

type FormatterKey = DateTemplate | 'medium';

const NARROW_NO_BREAK_SPACE = ' ';

const templateOptions: Record<FormatterKey, Intl.DateTimeFormatOptions> = {
  'j:mm': { hour: 'numeric', minute: '2-digit' },
  EEE: { weekday: 'short' },
  EEEE: { weekday: 'long' },
  'd MMM': { day: 'numeric', month: 'short' },
  'EEEE d MMMM': { weekday: 'long', day: 'numeric', month: 'long' },
  'EEE d MMM': { weekday: 'short', day: 'numeric', month: 'short' },
  'LLLL y': { month: 'long', year: 'numeric' },
  'MMMM y': { month: 'long', year: 'numeric' },
  medium: { dateStyle: 'medium' },
};

export interface SuggestionDateFormatterOptions {
  readonly locale: string;
  readonly calendar: Calendar;
  /** The 12/24-hour setting; undefined = the locale's default. */
  readonly hour12?: boolean;
}

export class SuggestionDateFormatter {
  private static readonly cache = new Map<string, Intl.DateTimeFormat>();

  readonly locale: string;
  readonly calendar: Calendar;
  readonly hour12: boolean | undefined;

  constructor({ locale, calendar, hour12 }: SuggestionDateFormatterOptions) {
    this.locale = locale;
    this.calendar = calendar;
    this.hour12 = hour12;
  }

  /** Drops every cached formatter; the next label rebuilds from the current settings. */
  static invalidateCache(): void {
    SuggestionDateFormatter.cache.clear();
  }

  static get cachedFormatterCount(): number {
    return SuggestionDateFormatter.cache.size;
  }

  /** `doesRelativeDateFormatting` + `.medium` date (+ `.short` time): the relative day word
   *  where the language has one (en ±1 day, cs ±2 days), else the medium date. */
  string(date: Date, hasTime: boolean, now: Date): string {
    const day = this.relativeDay(date, now) ?? this.formatter('medium').format(date);
    if (!hasTime) return day;
    const glue = this.locale.startsWith('en') ? ', ' : ' ';
    return day + glue + this.time(date);
  }

  /** "19:00" / "7:00 PM" (time chips), with Foundation's U+202F before the day period. */
  time(date: Date): string {
    const parts = this.formatter('j:mm').formatToParts(date);
    return parts.map((part, i) => {
      const nextToDayPeriod = parts[i - 1]?.type === 'dayPeriod' || parts[i + 1]?.type === 'dayPeriod';
      return part.type === 'literal' && nextToDayPeriod && /^\s+$/.test(part.value) ? NARROW_NO_BREAK_SPACE : part.value;
    }).join('');
  }

  /** Time today, weekday + time this week, day + month + time beyond; `spoken` is the VoiceOver
   *  wording. Day and time are formatted separately and joined with a space. */
  presetDetail(date: Date, now: Date, spoken = false): string {
    const day = DatePresets.dayTemplate(date, now, this.calendar, spoken);
    if (day === null) return this.time(date);
    return this.format(date, day) + ' ' + this.time(date);
  }

  /** Set Date's preview line: the full day spelled out and the time as `time(date)`. */
  dayAndTime(date: Date): string {
    return this.format(date, 'EEEE d MMMM') + ' ' + this.time(date);
  }

  format(date: Date, template: DateTemplate): string {
    if (template === 'j:mm') return this.time(date);
    return this.formatter(template).format(date);
  }

  private relativeDay(date: Date, now: Date): string | null {
    const days = daysBetween(this.calendar, now, date);
    const word = new Intl.RelativeTimeFormat(this.locale, { numeric: 'auto' }).format(days, 'day');
    if (/\d/.test(word)) return null;
    const [first = '', ...rest] = word;
    return first.toLocaleUpperCase(this.locale) + rest.join('');
  }

  private formatter(key: FormatterKey): Intl.DateTimeFormat {
    const cacheKey = `${key}|${this.locale}|${this.calendar.timeZone}|${this.hour12}`;
    let formatter = SuggestionDateFormatter.cache.get(cacheKey);
    if (!formatter) {
      const options: Intl.DateTimeFormatOptions = { timeZone: this.calendar.timeZone, ...templateOptions[key] };
      if (key === 'j:mm' && this.hour12 !== undefined) options.hour12 = this.hour12;
      formatter = new Intl.DateTimeFormat(this.locale, options);
      SuggestionDateFormatter.cache.set(cacheKey, formatter);
    }
    return formatter;
  }
}

type DistanceUnit = 'year' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second';

/** Calendar units first (largest component wins, Foundation `RelativeDateTimeFormatter`), then
 *  absolute ones. `add(earlier, n)` must be monotonic in n. */
const distanceUnits: ReadonlyArray<readonly [DistanceUnit, (cal: Calendar, date: Date, n: number) => Date]> = [
  ['year', (cal, date, n) => addMonths(cal, date, 12 * n)],
  ['month', (cal, date, n) => addMonths(cal, date, n)],
  ['week', (cal, date, n) => addDays(cal, date, 7 * n)],
  ['day', (cal, date, n) => addDays(cal, date, n)],
  ['hour', (_cal, date, n) => addHours(date, n)],
  ['minute', (_cal, date, n) => addMinutes(date, n)],
  ['second', (_cal, date, n) => new Date(date.getTime() + n * 1000)],
];

/** The greatest whole n with `add(earlier, n) ≤ later`. */
function wholeCount(add: (n: number) => Date, later: Date): number {
  let n = 0;
  while (add(n + 1).getTime() <= later.getTime()) n += 1;
  return n;
}

export const RelativeDistance = {
  /** "in 23h", "3d ago" / "za 23 h", "před 3 dny": Foundation `.abbreviated` + `.numeric`. */
  string(from: Date, to: Date, locale: string, calendar: Calendar): string {
    const sign = to.getTime() >= from.getTime() ? 1 : -1;
    const [earlier, later] = sign === 1 ? [from, to] : [to, from];
    let unit: DistanceUnit = 'second';
    let count = 0;
    for (const [candidate, add] of distanceUnits) {
      const n = wholeCount((k) => add(calendar, earlier, k), later);
      if (n > 0) {
        unit = candidate;
        count = n;
        break;
      }
    }
    return new Intl.RelativeTimeFormat(locale, { style: 'narrow', numeric: 'always' }).format(sign * count, unit);
  },
} as const;
