// Port of Services/ScheduleCommit.swift: Set Date's open and commit decisions, kept out of the
// views so they can be unit-tested.
//
// Contract names are kept over Swift's (A-D6): `textRowSubmit(schedulingInNotch, canSave)` returns
// 'setSchedule' where Swift returns `.commitSection` for `sectionOpen`: the open section's commit
// (Set Date: Set, Location: Done), never a save.
import { type Calendar } from './calendar';
import { DatePresets } from './datePresets';
import { ScheduleInput, type ScheduleInputResult } from './scheduleInput';

/** How the section closed: Set (button, ↩, ⌘↩), a preset card or ⌘1…⌘6, Cancel (Esc, click
 *  outside: nothing is written), Clear (the date is removed). */
export type ScheduleAction = 'set' | 'preset' | 'cancel' | 'clear';

/** What ↩ / ⌘↩ in the title or notes does; 'none' = empty title, nothing to do. */
export type TextRowSubmit = 'setSchedule' | 'saveReminder' | 'none';

/** Swift `trimmingCharacters(in: .whitespaces)`: spaces (Zs) and tab, never newlines. */
const EDGE_WHITESPACES = /^[\p{Zs}\t]+|[\p{Zs}\t]+$/gu;

function trimmedPhrase(initialText: string | null): string {
  return initialText?.replace(EDGE_WHITESPACES, '') ?? '';
}

/** What Set Date opens on. An existing date wins; then the title's live suggestion (prefilled
 *  into the field, the draft following it when it parses); otherwise tomorrow 9:00. */
function opening(
  selected: Date | null, initialText: string | null, now: Date, calendar: Calendar,
): { readonly draft: Date; readonly text: string } {
  if (selected) return { draft: selected, text: '' };
  const tomorrow = DatePresets.date('tomorrow', now, calendar);
  const phrase = trimmedPhrase(initialText);
  if (phrase === '') return { draft: tomorrow, text: '' };
  const result = ScheduleInput.resolve(phrase, now, calendar);
  if (result.type === 'date') return { draft: result.date, text: phrase };
  return { draft: tomorrow, text: phrase };
}

function textRowSubmit(schedulingInNotch: boolean, canSave: boolean): TextRowSubmit {
  if (schedulingInNotch) return 'setSchedule';
  return canSave ? 'saveReminder' : 'none';
}

/** The date Set writes: the typed phrase when it parses, otherwise the draft the controls built.
 *  null = invalid text (beep, stay open). */
function dateToSet(result: ScheduleInputResult, draft: Date): Date | null {
  switch (result.type) {
    case 'invalid': return null;
    case 'date': return result.date;
    case 'empty': return draft;
  }
}

/** Whether the title's date phrase is stripped (Tab semantics): once opened from a live
 *  suggestion, any choice that writes a date replaces what the phrase said. */
function consumesSuggestion(initialText: string | null, action: ScheduleAction): boolean {
  if (trimmedPhrase(initialText) === '') return false;
  switch (action) {
    case 'set':
    case 'preset': return true;
    case 'cancel':
    case 'clear': return false;
  }
}

export const ScheduleCommit = { opening, textRowSubmit, dateToSet, consumesSuggestion } as const;
