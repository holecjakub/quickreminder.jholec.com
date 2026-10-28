// Port of Services/ScheduleDraft.swift: Set Date's working state, shared by every Set Date control
// so their behaviour cannot drift: what it opens on, the typed field (parsed once per change), the
// date the controls build, and the commit decisions.
//
// One source of truth, `draft`. Typing resolves on every change and moves `draft` one-way; the
// calendar, time field and chips write `draft` and clear the text, so the two inputs never
// ping-pong. Nothing leaves the draft until `set()`, `apply()` or `clear()` returns a
// `ScheduleOutcome` for the view to write; each of them works once (`committed`).
//
// Swift's `@Observable` becomes `subscribe`: listeners run once after every public mutation.
// VoiceOver's `announceAfterPause` lives on the UI side (contracts §2.7).
import type { Clock } from '../clock';
import { addDays, type Calendar, components, daysInMonth, startOfDay } from './calendar';
import { type DatePreset, DatePresets, type PresetPick } from './datePresets';
import { MonthGrid } from './monthGrid';
import { ScheduleCommit } from './scheduleCommit';
import { ScheduleDefaults } from './scheduleDefaults';
import { ScheduleInput, type ScheduleInputResult } from './scheduleInput';

/** What a commit writes back to the reminder. */
export interface ScheduleOutcome {
  /** The reminder's new date (null = Clear). */
  readonly date: Date | null;
  /** The preset that wrote it, for the single highlight (`DatePresets.highlighted`). */
  readonly presetPick: PresetPick | null;
  /** Strip the title's date phrase (`ScheduleCommit.consumesSuggestion`). */
  readonly consumesSuggestion: boolean;
}

/** What ✓ (save the reminder) does while the in-notch section is open.
 *  - saveAsIs: nothing was touched: close the section, save with the reminder's current date (an
 *    untouched default such as tomorrow 9:00 never sneaks into a reminder).
 *  - commitThenSave: the user changed the draft: what they see is what gets saved — Set, then save.
 *  - invalid: the typed text is not a date: beep, keep the section open, save nothing. */
export type SaveDecision =
  | { readonly type: 'saveAsIs' }
  | { readonly type: 'commitThenSave'; readonly outcome: ScheduleOutcome }
  | { readonly type: 'invalid' };

const MINUTES_PER_DAY = 1440;
const TIME_STEP_MINUTES = 15;

export class ScheduleDraft {
  /** The title's live suggestion phrase this session was opened with (prefilled into `text`). */
  readonly initialText: string | null;

  private readonly calendar: Calendar;
  private readonly clock: Clock;
  private readonly listeners = new Set<() => void>();
  private draftValue: Date;
  private textValue: string;
  private parsedValue: ScheduleInputResult;
  private dirty = false;
  private committedValue = false;

  constructor(args: { selected: Date | null; initialText: string | null; calendar: Calendar; clock: Clock }) {
    this.calendar = args.calendar;
    this.clock = args.clock;
    this.initialText = args.initialText;
    const opening = ScheduleCommit.opening(args.selected, args.initialText, this.clock(), this.calendar);
    this.draftValue = opening.draft;
    this.textValue = opening.text;
    this.parsedValue = ScheduleInput.resolve(opening.text, this.clock(), this.calendar);
  }

  /** The date being built; what Set writes when the field is empty. */
  get draft(): Date { return this.draftValue; }

  /** The type field. A change is parsed once (`parsed`); a date moves `draft` with it. */
  get text(): string { return this.textValue; }
  set text(value: string) {
    if (value === this.textValue) return;
    this.replaceText(value);
    this.notify();
  }

  /** `ScheduleInput.resolve(text)` as of the last change. */
  get parsed(): ScheduleInputResult { return this.parsedValue; }
  /** The user typed or used a control since Set Date opened (prefilled text does not count). */
  get isDirty(): boolean { return this.dirty; }
  /** Set, a preset or Clear already ran: further commits are ignored. */
  get committed(): boolean { return this.committedValue; }
  get now(): Date { return this.clock(); }
  get isInvalid(): boolean { return this.parsedValue.type === 'invalid'; }
  /** The typed text resolves to a date (the field shows its ⏎ hint). */
  get textIsDate(): boolean { return this.parsedValue.type === 'date'; }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  // Controls (each clears the typed text)

  setFromControls(date: Date): void {
    this.writeFromControls(date);
    this.notify();
  }

  /** The calendar: the picked day, keeping the draft's time. */
  pick(day: Date): void {
    this.setFromControls(ScheduleDefaults.compose(day, this.draftValue, this.calendar));
  }

  /** A time chip: `hour`:`minute` on the draft's day. */
  setTime(hour: number, minute = 0): void {
    this.setFromControls(ScheduleDefaults.at(hour, minute, this.draftValue, this.calendar));
  }

  /** The typed time field ("14", "1430", "14:30", "2pm", read by `ScheduleInput`): its time part
   *  on the draft's day. false (draft unchanged) when it does not read as a time. */
  applyTypedTime(typed: string): boolean {
    const result = ScheduleInput.resolve(typed, this.clock(), this.calendar);
    if (result.type !== 'date') return false;
    this.setFromControls(ScheduleDefaults.compose(this.draftValue, result.date, this.calendar));
    return true;
  }

  /** ↑ / ↓ in the time field: snap to the 15-minute grid, then step; wraps within the day. */
  stepTime(steps: number): void {
    const { hour, minute } = components(this.calendar, this.draftValue);
    const minutes = hour * 60 + minute;
    // Swift `Int` division truncates toward zero.
    const snapped = steps > 0
      ? (Math.trunc(minutes / TIME_STEP_MINUTES) + steps) * TIME_STEP_MINUTES
      : (Math.trunc((minutes + TIME_STEP_MINUTES - 1) / TIME_STEP_MINUTES) + steps) * TIME_STEP_MINUTES;
    const wrapped = ((snapped % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    this.setTime(Math.floor(wrapped / 60), wrapped % 60);
  }

  /** Arrow keys in the month grid: ±1 / ±7 days, never into the past. false = blocked (beep). */
  moveDay(days: number): boolean {
    const moved = MonthGrid.moving(this.draftValue, days, this.clock(), this.calendar);
    if (moved.getTime() === this.draftValue.getTime()) return false;
    this.setFromControls(moved);
    return true;
  }

  /** The month grid was paged away from the draft's month and an arrow key was pressed: land on
   *  the same day number in the visible month (clamped to its length and to today). */
  moveInto(month: Date): void {
    const first = MonthGrid.startOfMonth(month, this.calendar);
    const dayNumber = Math.min(components(this.calendar, this.draftValue).day, daysInMonth(this.calendar, first));
    let day = addDays(this.calendar, first, dayNumber - 1);
    if (!MonthGrid.isSelectable(day, this.clock(), this.calendar)) day = startOfDay(this.calendar, this.clock());
    this.pick(day);
  }

  // Commit

  /** Set / ↩ / ⌘↩: the typed date when it parses, otherwise the draft. null when the text is not
   *  a date (the view beeps and stays open) or a commit already ran. */
  set(): ScheduleOutcome | null {
    // Relative phrases ("+2h", "today") count from the moment of Set, not the last keystroke.
    const reresolved = this.textValue !== '';
    if (reresolved) this.parsedValue = ScheduleInput.resolve(this.textValue, this.clock(), this.calendar);
    const date = this.committedValue ? null : ScheduleCommit.dateToSet(this.parsedValue, this.draftValue);
    if (!date) {
      if (reresolved) this.notify();
      return null;
    }
    this.draftValue = date;
    return this.finish({
      date,
      presetPick: null,
      consumesSuggestion: ScheduleCommit.consumesSuggestion(this.initialText, 'set'),
    });
  }

  /** A preset card / ⌘1…⌘6: one click commits. */
  apply(preset: DatePreset): ScheduleOutcome | null {
    if (this.committedValue) return null;
    const date = DatePresets.date(preset, this.clock(), this.calendar);
    return this.finish({
      date,
      presetPick: { preset, date },
      consumesSuggestion: ScheduleCommit.consumesSuggestion(this.initialText, 'preset'),
    });
  }

  /** Clear: the reminder loses its date; the title keeps its phrase. */
  clear(): ScheduleOutcome | null {
    if (this.committedValue) return null;
    return this.finish({
      date: null,
      presetPick: null,
      consumesSuggestion: ScheduleCommit.consumesSuggestion(this.initialText, 'clear'),
    });
  }

  /** ✓ while the in-notch section is open. */
  prepareSave(): SaveDecision {
    if (!this.dirty || this.committedValue) return { type: 'saveAsIs' };
    const outcome = this.set();
    return outcome ? { type: 'commitThenSave', outcome } : { type: 'invalid' };
  }

  /** Switching to Location while Set Date is open keeps what was done here: the same decision as
   *  ✓ (an edit is Set, an untouched draft writes nothing, an invalid typed date blocks the
   *  switch with a beep), without the save. */
  prepareSwitch(): SaveDecision {
    return this.prepareSave();
  }

  /** The one preset card to highlight for the current draft. */
  highlightedPreset(picked: PresetPick | null): DatePreset | null {
    return DatePresets.highlighted(this.draftValue, picked, this.clock(), this.calendar);
  }

  private replaceText(value: string): void {
    this.dirty = true;
    this.textValue = value;
    this.parsedValue = ScheduleInput.resolve(value, this.clock(), this.calendar);
    if (this.parsedValue.type === 'date') this.draftValue = this.parsedValue.date;
  }

  private writeFromControls(date: Date): void {
    this.dirty = true;
    this.draftValue = date;
    if (this.textValue !== '') this.replaceText('');
  }

  private finish(outcome: ScheduleOutcome): ScheduleOutcome {
    this.committedValue = true;
    this.notify();
    return outcome;
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
