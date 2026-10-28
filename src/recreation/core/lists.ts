// Stand-in for `RemindersService.calendars`: the five fake lists the recreation offers, in picker
// order, with the iOS dark system colours the app reads from EventKit.

export type ListId = 'reminders' | 'work' | 'home' | 'groceries' | 'ideas';

export interface ReminderList {
  readonly id: ListId;
  readonly title: string;
  readonly color: string /* #RRGGBB */;
}

/** iOS dark system colours, in picker order. */
export const FAKE_LISTS: readonly ReminderList[] = [
  { id: 'reminders', title: 'Reminders', color: '#0A84FF' },
  { id: 'work', title: 'Work', color: '#BF5AF2' },
  { id: 'home', title: 'Home', color: '#FF9F0A' },
  { id: 'groceries', title: 'Groceries', color: '#30D158' },
  { id: 'ideas', title: 'Ideas', color: '#FF375F' },
];

export const DEFAULT_LIST_ID: ListId = 'reminders';

/** `Theme.accent` (iOS systemBlue, dark): the accent when the list has no colour. */
const THEME_ACCENT = '#0A84FF';

export function listById(id: ListId): ReminderList {
  const list = FAKE_LISTS.find((l) => l.id === id);
  if (!list) throw new RangeError(`listById: unknown list ${id}`);
  return list;
}

/** The list colour; `Theme.accent` for an unknown id. */
export function accentFor(id: ListId): string {
  return FAKE_LISTS.find((l) => l.id === id)?.color ?? THEME_ACCENT;
}
