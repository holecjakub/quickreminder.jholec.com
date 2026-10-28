// Port of Services/NaturalDateParser.swift (app commit 144d620): the Reminders-style natural
// language date parser for English and Czech. This file covers normalisation, the day
// candidates (relative days, weekdays, explicit dates), right-most selection and phrase removal.
//
// Design notes carried over from the Swift source:
// * Matching is case-insensitive and diacritics-insensitive ("zitra" == "zítra"). The text is
//   folded into a parallel string with an identical UTF-16 length, the regexes run over that,
//   and ranges map back onto the original by UTF-16 offset.
// * "next X" == "X": `friday` and `next friday` both resolve to the next occurrence strictly
//   after today, through `DatePresets.nextWeekday` so a typed phrase and the preset agree.
// * Slash dates (`3/12`) are month/day for English text and day/month when the text carries
//   Czech signals; dotted dates (`3.12.`) are always day/month.
// * Invalid calendar dates never roll over: "31. února" produces no match, "29.2." without a
//   year walks forward to the next leap year, a written-out year must be `20xx` within ±10
//   years of `now`, and a missing year means the first valid occurrence that is not in the past.
// * Only the RIGHT-MOST phrase is returned.

import {
  addDays,
  addMonths,
  components,
  dateFrom,
  settingTime,
  startOfDay,
  startOfMonth,
  type Calendar,
  type Weekday,
} from './calendar';
import { DatePresets } from './datePresets';
import { DayPart } from './scheduleDefaults';

/** A date/time phrase recognised inside free text, with the absolute date it resolves to and
 *  the exact range it occupied in the original string. */
export interface DateSuggestion {
  readonly date: Date;
  /** false when only a day was recognised; the caller applies ScheduleDefaults.resolveDayOnly. */
  readonly hasTime: boolean;
  /** UTF-16 code-unit offsets into the ORIGINAL text. */
  readonly matchedRange: { readonly start: number; readonly end: number };
  /** The phrase exactly as typed, e.g. "tomorrow at 2pm", "zítra ve 14:00". */
  readonly matchedText: string;
}

// MARK: - Internal model

interface TimeInfo {
  hour: number;
  minute: number;
  /** false only for a bare hour ("at 8") that nothing in the phrase pinned down. */
  explicit: boolean;
}

interface DayInfo {
  startOfDay: Date;
  impliedTime: TimeInfo | null;
}

interface TextRange {
  start: number;
  end: number;
}

type Payload = { kind: 'day'; day: DayInfo };

interface Candidate {
  range: TextRange;
  payload: Payload;
}

// MARK: - Normalisation

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** Lowercases and strips diacritics while guaranteeing the UTF-16 length is preserved, so ranges
 *  found in the normalised string are valid in the original one. A grapheme whose fold would
 *  change its length (ŉ → ʼn, e + U+0301 → e) is only lowercased, or kept as typed. */
function normalize(text: string): string {
  let out = '';
  for (const { segment } of graphemes.segment(text)) {
    const folded = segment.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
    if (folded.length === segment.length) {
      out += folded;
    } else {
      const lowered = segment.toLowerCase();
      out += lowered.length === segment.length ? lowered : segment;
    }
  }
  return out;
}

const danglingPunctuation: ReadonlySet<string> = new Set([
  ',', '.', ';', ':', '!', '?', '-', '–', '—', '(', ')', '[', ']', '{', '}', '"', "'",
]);

/** Words that are meaningless on their own once the date phrase after them is gone.
 *  Deliberately NO determiners or adverbs ("the", "this", "next", "in", "tento", "příští"). */
const danglingPrepositions: ReadonlySet<string> = new Set([
  'at', 'on', 'by', 'for', 'until', 'till',
  'v', 've', 'o', 'do', 'na', 'za', 'od',
]);

function isWhitespace(unit: string): boolean {
  return /\s/u.test(unit);
}

function bareWord(word: string): string {
  let start = 0;
  let end = word.length;
  while (start < end && danglingPunctuation.has(word[start]!)) start += 1;
  while (end > start && danglingPunctuation.has(word[end - 1]!)) end -= 1;
  return word.slice(start, end);
}

function trimmingTrailingPunctuation(word: string): string {
  let end = word.length;
  while (end > 0 && danglingPunctuation.has(word[end - 1]!)) end -= 1;
  return word.slice(0, end);
}

const czechHintWords: ReadonlySet<string> = new Set([
  'zitra', 'zejtra', 'dnes', 'dneska', 'pozitri', 'vcera',
  'tyden', 'tydne', 'tydnu', 'tydny', 'mesic', 'mesice',
  'hodina', 'hodinu', 'hodiny', 'hodin', 'minuta', 'minutu', 'minuty', 'minut',
  'rano', 'vecer', 'vecera', 'odpoledne', 'dopoledne', 'poledne', 'pulnoc', 'pulnoci', 'pul',
  'pondeli', 'pondelek', 'utery', 'streda', 'stredu', 'ctvrtek', 'patek',
  'sobota', 'sobotu', 'nedele', 'nedeli', 'vikend', 'vikendu',
  'pristi', 'tento', 'tuto', 've', 'za', 'schuzka', 'zubar', 'lekar', 'koupit', 'zavolat', 'napsat',
]);

const czechDiacritics: ReadonlySet<string> = new Set('áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ');

function looksCzech(original: string, normalized: string): boolean {
  for (const character of original) {
    if (czechDiacritics.has(character)) return true;
  }
  return normalized.split(/[^\p{L}]+/u).some((word) => czechHintWords.has(word));
}

// MARK: - Range helpers

function intersects(a: TextRange, b: TextRange): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Sorted by start, longest first at the same start; any candidate intersecting a kept one is dropped. */
function dedupe(items: readonly Candidate[]): Candidate[] {
  const sorted = [...items].sort((lhs, rhs) =>
    lhs.range.start !== rhs.range.start
      ? lhs.range.start - rhs.range.start
      : (rhs.range.end - rhs.range.start) - (lhs.range.end - lhs.range.start),
  );
  const result: Candidate[] = [];
  for (const candidate of sorted) {
    if (result.some((kept) => intersects(kept.range, candidate.range))) continue;
    result.push(candidate);
  }
  return result;
}

function rangeOf(match: RegExpMatchArray): TextRange {
  const start = match.index ?? 0;
  return { start, end: start + match[0].length };
}

// MARK: - Word lists

const boundaryBefore = '(?<![\\p{L}])';
const boundaryAfter = '(?![\\p{L}])';

const weekdayNumbers: Readonly<Record<string, Weekday>> = {
  sunday: 1, sun: 1, nedele: 1, nedeli: 1,
  monday: 2, mon: 2, pondeli: 2, pondelek: 2,
  tuesday: 3, tues: 3, tue: 3, utery: 3, uterek: 3,
  wednesday: 4, weds: 4, wed: 4, streda: 4, stredu: 4,
  thursday: 5, thurs: 5, thur: 5, thu: 5, ctvrtek: 5,
  friday: 6, fri: 6, patek: 6,
  saturday: 7, sat: 7, sobota: 7, sobotu: 7,
};

const monthNumbers: Readonly<Record<string, number>> = {
  january: 1, jan: 1, ledna: 1, leden: 1,
  february: 2, feb: 2, unora: 2, unor: 2,
  march: 3, mar: 3, brezna: 3, brezen: 3,
  april: 4, apr: 4, dubna: 4, duben: 4,
  may: 5, kvetna: 5, kveten: 5,
  june: 6, jun: 6, cervna: 6, cerven: 6,
  july: 7, jul: 7, cervence: 7, cervenec: 7,
  august: 8, aug: 8, srpna: 8, srpen: 8,
  september: 9, sept: 9, sep: 9, zari: 9,
  october: 10, oct: 10, rijna: 10, rijen: 10,
  november: 11, nov: 11, listopadu: 11, listopad: 11,
  december: 12, dec: 12, prosince: 12, prosinec: 12,
};

/** Longest first so the alternation prefers the full word; ties alphabetical for a stable pattern. */
function alternation(words: readonly string[]): string {
  return [...words]
    .sort((lhs, rhs) => rhs.length - lhs.length || (lhs < rhs ? -1 : lhs > rhs ? 1 : 0))
    .join('|');
}

/** Full names may stand alone; three/four-letter abbreviations ("sat", "sun", "mon", "wed" are
 *  ordinary words) only count after a prefix such as "on" / "next". */
const weekdayFullAlternation = alternation(Object.keys(weekdayNumbers).filter((key) => key.length > 4));
const weekdayAbbrevAlternation = alternation(Object.keys(weekdayNumbers).filter((key) => key.length <= 4));
const monthAlternation = alternation(Object.keys(monthNumbers));

// MARK: - Compiled patterns

const relativeDayRegex = new RegExp(
  boundaryBefore
    + '(?:(?:next|pristi)\\s+(?:weekend|week|tyden|month|mesic)'
    + '|day\\s+after\\s+tomorrow'
    + '|pozitri'
    + '|tomorrow|tmrw|tmr|zitra|zejtra'
    + '|tonight'
    + '|today|dneska|dnes'
    + '|(?:this\\s+|tento\\s+|toto\\s+|o\\s+)?(?:weekend|vikendu|vikend))'
    + boundaryAfter,
  'gu',
);

const weekdayRegex = new RegExp(
  boundaryBefore
    + '(?:'
    + '(?:(?:on|next|this|upcoming|v|ve|pristi|tento|tuto)\\s+)?(' + weekdayFullAlternation + ')'
    + '|(?:on|next|this|upcoming|v|ve|pristi|tento|tuto)\\s+(' + weekdayAbbrevAlternation + ')'
    + ')'
    + boundaryAfter,
  'gu',
);

/** A written-out year is only accepted in this century; `resolveDate` narrows it further to
 *  ±10 years of `now`, so stray numbers ("12 March 1000 items") never become years. */
const yearPattern = '20\\d{2}';

/** "12.3.", "12. 3.", "12.3.2026" */
const dottedDateRegex = new RegExp(
  '(?<![\\p{L}\\d.])(\\d{1,2})\\.\\s?(\\d{1,2})\\.(?:\\s?(' + yearPattern + '))?(?![\\d])',
  'gu',
);

/** "3/12", "3/12/2026" */
const slashDateRegex = new RegExp(
  '(?<![\\p{L}\\d/])(\\d{1,2})/(\\d{1,2})(?:/(' + yearPattern + '))?(?![\\d/])',
  'gu',
);

/** "12 March", "12. března", "12 March 2027" */
const dayMonthRegex = new RegExp(
  '(?<![\\p{L}\\d])(\\d{1,2})\\.?\\s+(' + monthAlternation + ')' + boundaryAfter
    + '(?:\\s+(' + yearPattern + ')(?!\\d))?',
  'gu',
);

/** "March 12", "Mar 12th", "March 12, 2027" */
const monthDayRegex = new RegExp(
  boundaryBefore + '(' + monthAlternation + ')\\s+(\\d{1,2})(?:st|nd|rd|th)?(?![\\p{L}\\d])'
    + '(?:,?\\s+(' + yearPattern + ')(?!\\d))?',
  'gu',
);

// MARK: - Day candidates

function parseInteger(text: string | undefined): number | null {
  return text === undefined ? null : Number.parseInt(text, 10);
}

function dayCandidate(range: TextRange, startOfDay: Date): Candidate {
  return { range, payload: { kind: 'day', day: { startOfDay, impliedTime: null } } };
}

function dayCandidates(text: string, now: Date, calendar: Calendar, czech: boolean): Candidate[] {
  const found: Candidate[] = [];

  for (const match of text.matchAll(relativeDayRegex)) {
    const info = relativeDay(match[0], now, calendar);
    if (info) found.push({ range: rangeOf(match), payload: { kind: 'day', day: info } });
  }

  for (const match of text.matchAll(weekdayRegex)) {
    const name = match[1] ?? match[2];
    const weekday = name === undefined ? undefined : weekdayNumbers[name];
    if (weekday === undefined) continue;
    found.push(dayCandidate(rangeOf(match), DatePresets.nextWeekday(weekday, now, calendar)));
  }

  for (const match of text.matchAll(dottedDateRegex)) {
    const day = parseInteger(match[1]);
    const month = parseInteger(match[2]);
    if (day === null || month === null) continue;
    const date = resolveDate(day, month, parseInteger(match[3]), now, calendar);
    if (date) found.push(dayCandidate(rangeOf(match), date));
  }

  for (const match of text.matchAll(slashDateRegex)) {
    const first = parseInteger(match[1]);
    const second = parseInteger(match[2]);
    if (first === null || second === null) continue;
    const day = czech ? first : second;
    const month = czech ? second : first;
    const date = resolveDate(day, month, parseInteger(match[3]), now, calendar);
    if (date) found.push(dayCandidate(rangeOf(match), date));
  }

  for (const match of text.matchAll(dayMonthRegex)) {
    const day = parseInteger(match[1]);
    const month = match[2] === undefined ? undefined : monthNumbers[match[2]];
    if (day === null || month === undefined) continue;
    const date = resolveDate(day, month, parseInteger(match[3]), now, calendar);
    if (date) found.push(dayCandidate(rangeOf(match), date));
  }

  for (const match of text.matchAll(monthDayRegex)) {
    const month = match[1] === undefined ? undefined : monthNumbers[match[1]];
    const day = parseInteger(match[2]);
    if (month === undefined || day === null) continue;
    const date = resolveDate(day, month, parseInteger(match[3]), now, calendar);
    if (date) found.push(dayCandidate(rangeOf(match), date));
  }

  return dedupe(found);
}

function relativeDay(phrase: string, now: Date, calendar: Calendar): DayInfo | null {
  const today = startOfDay(calendar, now);
  const shifted = (days: number) => addDays(calendar, today, days);
  const dayOnly = (startOfDay: Date): DayInfo => ({ startOfDay, impliedTime: null });

  if (phrase.includes('month') || phrase.includes('mesic')) {
    return dayOnly(addMonths(calendar, startOfMonth(calendar, today), 1));
  }
  if (phrase.includes('weekend') || phrase.includes('vikend')) {
    return dayOnly(DatePresets.nextWeekday(7, now, calendar));
  }
  if (phrase.includes('week') || phrase.includes('tyden')) {
    return dayOnly(DatePresets.nextWeekday(2, now, calendar));
  }
  if (phrase.includes('day after tomorrow') || phrase.includes('pozitri')) {
    return dayOnly(shifted(2));
  }
  if (phrase.includes('tomorrow') || phrase.includes('tmrw') || phrase.includes('tmr')
    || phrase.includes('zitra') || phrase.includes('zejtra')) {
    return dayOnly(shifted(1));
  }
  if (phrase.includes('tonight')) {
    return { startOfDay: today, impliedTime: { hour: DayPart.nightHour, minute: 0, explicit: true } };
  }
  if (phrase.includes('today') || phrase.includes('dnes')) {
    return dayOnly(today);
  }
  return null;
}

/** How far ahead a day/month with no year may look for a valid occurrence — enough to reach the
 *  next leap day from any starting year ("29.2." → 2028-02-29). */
const yearSearchSpan = 8;
/** How far a written-out year may sit from today before it is treated as a stray number. */
const yearWindow = 10;

/** Resolves a day/month(/year) triple, or null when the combination is not a real date. The
 *  components go through `dateFrom`, which rejects "31. února" instead of rolling it into March. */
function resolveDate(day: number, month: number, year: number | null, now: Date, calendar: Calendar): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const today = startOfDay(calendar, now);
  const thisYear = components(calendar, today).year;

  const exactDate = (inYear: number): Date | null => {
    const date = dateFrom(calendar, { year: inYear, month, day });
    return date === null ? null : startOfDay(calendar, date);
  };

  if (year !== null) {
    if (Math.abs(year - thisYear) > yearWindow) return null;
    const date = exactDate(year);
    return date !== null && date >= today ? date : null;
  }

  for (let offset = 0; offset <= yearSearchSpan; offset += 1) {
    const candidate = exactDate(thisYear + offset);
    if (candidate !== null && candidate >= today) return candidate;
  }
  return null;
}

// MARK: - Public API

/** Texts longer than this return null: only the right-most phrase matters and the parser runs on
 *  every keystroke, so pathological pastes are cut off instead of stalling the UI. */
const maxLengthUTF16 = 1_000;

/** Finds the LAST (right-most) date phrase in `text`, or null. */
function parse(text: string, now: Date, calendar: Calendar): DateSuggestion | null {
  if (text.length > maxLengthUTF16) return null;
  if (text.trim() === '') return null;
  const normalized = normalize(text);
  const czech = looksCzech(text, normalized);

  const days = dayCandidates(normalized, now, calendar, czech);

  const all = [...days].sort((lhs, rhs) => lhs.range.start - rhs.range.start);
  const last = all.at(-1);
  if (!last) return null;

  const { range } = last;
  const { day } = last.payload;
  let date: Date;
  let hasTime: boolean;
  if (day.impliedTime) {
    date = settingTime(calendar, day.startOfDay, day.impliedTime.hour, day.impliedTime.minute);
    hasTime = true;
  } else {
    date = day.startOfDay;
    hasTime = false;
  }

  return {
    date,
    hasTime,
    matchedRange: { start: range.start, end: range.end },
    matchedText: text.slice(range.start, range.end),
  };
}

/** `text` with the matched phrase removed and whitespace collapsed.
 *
 *  Only the single word directly BEFORE the removed range is dropped, and only when it is a
 *  preposition left dangling by the removal ("Review this by friday" → "Review this",
 *  "odevzdat do 5. prosince" → "odevzdat"). Words that carry meaning in a title — "this", "the",
 *  "next", "in" — are always kept. Punctuation orphaned by the removal is dropped as well. */
function removingMatch(text: string, suggestion: DateSuggestion): string {
  const head = text.slice(0, suggestion.matchedRange.start);
  let tail = text.slice(suggestion.matchedRange.end);

  // "ve 14.30." leaves a lone "." behind; so does "tomorrow, buy milk".
  let skip = 0;
  while (skip < tail.length && (isWhitespace(tail[skip]!) || danglingPunctuation.has(tail[skip]!))) skip += 1;
  tail = tail.slice(skip);

  const words = head.split(/\s+/u).filter((word) => word !== '');
  const lastHeadWord = words.at(-1);
  if (lastHeadWord !== undefined) {
    const bare = bareWord(lastHeadWord);
    if (bare === '' || danglingPrepositions.has(normalize(bare))) words.pop();
  }
  words.push(...tail.split(/\s+/u).filter((word) => word !== ''));

  const lastWord = words.at(-1);
  if (lastWord !== undefined) {
    const trimmed = trimmingTrailingPunctuation(lastWord);
    if (trimmed === '') words.pop();
    else words[words.length - 1] = trimmed;
  }

  return words.join(' ').trim();
}

/** Hours 1…6 without am/pm are read as the afternoon; 0 and 7…23 are taken literally.
 *  Shared with ScheduleInput so the popover's bare-number leniency reads hours the same way. */
function disambiguate(hour: number): number {
  return hour >= 1 && hour <= 6 ? hour + 12 : hour;
}

export const NaturalDateParser = {
  maxLengthUTF16,
  parse,
  removingMatch,
  disambiguate,
} as const;
