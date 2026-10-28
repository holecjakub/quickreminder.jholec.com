// Port of `RemindersService.save` + `buildNotes`, without EventKit: what the ✓ turns a draft into
// (the row the fake Reminders window shows).
import { accentFor, type ListId } from './lists';
import type { SuggestionDateFormatter } from './suggestionDateFormatter';

export interface ReminderDraft {
  readonly title: string; // trimmed, non-empty
  readonly notes: string;
  readonly listId: ListId;
  readonly dueDate: Date | null;
  readonly flagged: boolean; // stored as "High priority" in the app; shown as a flag here
  readonly location: string | null;
}

export interface SavedReminder {
  readonly id: string; // crypto.randomUUID()
  readonly title: string;
  readonly notes: string | null; // buildNotes()
  readonly listId: ListId;
  readonly listColor: string;
  readonly dueDate: Date | null;
  readonly dueLabel: string | null; // SuggestionDateFormatter.string(date, true, now)
  readonly flagged: boolean;
  readonly savedAt: Date;
}

/** Swift `trimmingCharacters(in: .whitespacesAndNewlines)`: separators (Z*), U+0009–U+000D, U+0085. */
const EDGE_WHITESPACES_AND_NEWLINES = /^[\p{Z}\t-\r\u0085]+|[\p{Z}\t-\r\u0085]+$/gu;

/** "notes\n📍 location" / "📍 location" / notes / null — RemindersService.buildNotes. The one
 *  place the location is trimmed. */
export function buildNotes(notes: string, location: string | null): string | null {
  const parts: string[] = [];
  if (notes !== '') parts.push(notes);
  const place = location?.replace(EDGE_WHITESPACES_AND_NEWLINES, '') ?? '';
  if (place !== '') parts.push(`📍 ${place}`);
  return parts.length === 0 ? null : parts.join('\n');
}

export function toSavedReminder(draft: ReminderDraft, now: Date, formatter: SuggestionDateFormatter): SavedReminder {
  return {
    id: crypto.randomUUID(),
    title: draft.title,
    notes: buildNotes(draft.notes, draft.location),
    listId: draft.listId,
    listColor: accentFor(draft.listId),
    dueDate: draft.dueDate,
    dueLabel: draft.dueDate ? formatter.string(draft.dueDate, true, now) : null,
    flagged: draft.flagged,
    savedAt: now,
  };
}
