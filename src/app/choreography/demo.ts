// The demo reminder and the per-section snapshots (landing spec §7, §11.2).
import type { DueSpec, SectionId, SectionSnapshot } from './snapshot';

export const DEMO_REMINDER: {
  readonly typed: 'Call mum tomorrow at 2pm';
  readonly title: 'Call mum';
  readonly phrase: 'tomorrow at 2pm';
  readonly czechExample: 'zavolat mámě zítra ve 14:00';
  readonly listId: 'work';
  readonly location: 'Office';
  readonly flagged: true;
} = {
  typed: 'Call mum tomorrow at 2pm',
  title: 'Call mum',
  phrase: 'tomorrow at 2pm',
  czechExample: 'zavolat mámě zítra ve 14:00',
  listId: 'work',
  location: 'Office',
  flagged: true,
};

const PHRASE: DueSpec = { type: 'phrase', text: DEMO_REMINDER.phrase };

/** Fields a snapshot leaves at their empty-draft values unless it lists them. */
const BLANK = {
  section: 'none',
  notes: '',
  listId: 'reminders',
  flagged: false,
  location: null,
  due: null,
  saved: false,
} as const satisfies Partial<SectionSnapshot>;

/** The demo draft once the title is typed and the chip applied (02 onwards). */
const TITLED = { ...BLANK, title: DEMO_REMINDER.title, due: PHRASE } as const;

/** The demo draft once list, flag and location are set (05 onwards). */
const COMPLETED = {
  ...TITLED,
  listId: DEMO_REMINDER.listId,
  flagged: DEMO_REMINDER.flagged,
  location: DEMO_REMINDER.location,
} as const;

export const SECTION_SNAPSHOTS: Readonly<Record<SectionId, SectionSnapshot>> = {
  hero: { id: 'hero', panel: 'closed', ...BLANK, title: '', action: 'close' },
  '01': { id: '01', panel: 'open', ...BLANK, title: '', action: 'open' },
  '02': { id: '02', panel: 'open', ...TITLED, typedTitle: DEMO_REMINDER.typed, action: 'typeTitle', applyDelayMs: 900 },
  '03': { id: '03', panel: 'open', ...TITLED, section: 'calendar', action: 'schedule', highlightPreset: 'tomorrow' },
  '04': { id: '04', panel: 'open', ...TITLED, listId: DEMO_REMINDER.listId, action: 'lists', listCycle: ['reminders', 'work', 'home', DEMO_REMINDER.listId] },
  '05': { id: '05', panel: 'open', ...COMPLETED, action: 'flagLocation' },
  '06': { id: '06', panel: 'closed', ...COMPLETED, saved: true, action: 'save' },
  '07': { id: '07', panel: 'closed', ...COMPLETED, saved: true, action: 'none' },
};
