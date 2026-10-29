// Port of Services/ScheduleInput.swift: reads the Set Date type field, where the whole input must
// be one date/time phrase. On top of NaturalDateParser it accepts picker-only shorthands that would
// be wrong in a reminder title ("buy 2 apples" stays a title): a bare hour `14` / `3` (1…6 read as
// PM, like the parser), `930` / `1430`, `14:30` / `14.30`, offsets `+90m` / `+2h` / `+3d`, and a
// leading weekday abbreviation ("fri 2pm").
//
// `D.MM` is ambiguous in Czech: a dotted pair whose second part is 10…12 (and first part a day,
// 1…31) is day.month ("15.11", "24.12", "1.12"); anything else, including a zero-padded "8.05",
// stays a time. `14:30` with a colon is always a time.
//
// Known rejection: anything that is not entirely a date, including "tomorrow please".
import { addDays, addHours, addMinutes, startOfDay, type Calendar } from './calendar';
import { NaturalDateParser } from './naturalDateParser';
import { ScheduleDefaults } from './scheduleDefaults';

export type ScheduleInputResult =
  | { readonly type: 'empty' }
  | { readonly type: 'date'; readonly date: Date }
  | { readonly type: 'invalid' };

/** Leading words read as "on <weekday>" (the title parser only takes them after "on" / "next"). */
export const WEEKDAY_ABBREVIATIONS: ReadonlySet<string> = new Set([
  'mon', 'tue', 'tues', 'wed', 'weds', 'thu', 'thur', 'thurs', 'fri', 'sat', 'sun',
]);

const EMPTY: ScheduleInputResult = { type: 'empty' };
const INVALID: ScheduleInputResult = { type: 'invalid' };
const dated = (date: Date): ScheduleInputResult => ({ type: 'date', date });

const DOTTED_PAIR = /^(\d{1,2})\.(\d{2})$/;
const CLOCK_TIME = /^(\d{1,2})[:.](\d{2})$/;
const OFFSET = /^\+(\d{1,3})\s*(m|min|h|d)$/i;
const ASCII_DIGITS = /^[0-9]+$/;
const EDGE_WHITESPACE_AND_PUNCTUATION = /^[\s\p{P}]+|[\s\p{P}]+$/gu;

/** "15.11" / "1.12": a dot, a day 1…31 and a month 10…12. */
function isDottedDayMonth(text: string): boolean {
  const match = DOTTED_PAIR.exec(text);
  if (!match) return false;
  const day = Number(match[1]), month = Number(match[2]);
  return day >= 1 && day <= 31 && month >= 10 && month <= 12;
}

/** Hour/minute today, or tomorrow when already past (the parser's time-only rule). */
function time(hour: number, minute: number, now: Date, calendar: Calendar): ScheduleInputResult {
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return INVALID;
  const resolvedHour = NaturalDateParser.disambiguate(hour);
  const today = startOfDay(calendar, now);
  const candidate = ScheduleDefaults.at(resolvedHour, minute, today, calendar);
  if (candidate > now) return dated(candidate);
  return dated(ScheduleDefaults.at(resolvedHour, minute, addDays(calendar, today, 1), calendar));
}

/** null = not a shorthand (let the parser try); invalid = shaped like one but out of range
 *  ("2500", "25:00"), which the parser must not reinterpret either. */
function shorthand(text: string, now: Date, calendar: Calendar): ScheduleInputResult | null {
  if (ASCII_DIGITS.test(text)) {
    if (text.length <= 2) return time(Number(text), 0, now, calendar);
    if (text.length <= 4) return time(Number(text.slice(0, -2)), Number(text.slice(-2)), now, calendar);
    return null;
  }

  const clock = CLOCK_TIME.exec(text);
  if (clock) return time(Number(clock[1]), Number(clock[2]), now, calendar);

  const offset = OFFSET.exec(text);
  if (offset) {
    const [, amount, unit = ''] = offset;
    switch (unit.toLowerCase()) {
      case 'd':
        return dated(ScheduleDefaults.resolveDayOnly(startOfDay(calendar, addDays(calendar, now, Number(amount))), now, calendar));
      case 'h':
        return dated(addHours(now, Number(amount)));
      default:
        return dated(addMinutes(now, Number(amount)));
    }
  }
  return null;
}

/** A leading weekday abbreviation is read as "on fri": the whole input is a date here. */
function withWeekdayPrefix(text: string): string {
  const [first = ''] = text.split(' ', 1);
  return WEEKDAY_ABBREVIATIONS.has(first.toLowerCase()) ? 'on ' + text : text;
}

function resolve(text: string, now: Date, calendar: Calendar): ScheduleInputResult {
  const trimmed = text.trim();
  if (trimmed === '') return EMPTY;

  let phrase: string;
  if (isDottedDayMonth(trimmed)) {
    phrase = trimmed + '.'; // the parser's Czech date form is "15.11."
  } else {
    const short = shorthand(trimmed, now, calendar);
    if (short) return short;
    phrase = withWeekdayPrefix(trimmed);
  }
  const suggestion = NaturalDateParser.parse(phrase, now, calendar);
  if (!suggestion) return INVALID;
  const leftover = NaturalDateParser.removingMatch(phrase, suggestion).replace(EDGE_WHITESPACE_AND_PUNCTUATION, '');
  if (leftover !== '') return INVALID;

  // A time-only phrase already past today was rolled to tomorrow by the parser.
  if (suggestion.hasTime) return dated(suggestion.date);
  return dated(ScheduleDefaults.resolveDayOnly(suggestion.date, now, calendar));
}

export const ScheduleInput = { resolve } as const;
