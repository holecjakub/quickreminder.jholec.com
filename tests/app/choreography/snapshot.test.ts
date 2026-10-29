import { DEMO_REMINDER, SECTION_SNAPSHOTS } from '../../../src/app/choreography/demo';
import { SECTION_ORDER, previousSection, resolveDue } from '../../../src/app/choreography/snapshot';
import { prague, pragueCalendar } from '../../support';

const NOW = prague(2026, 10, 23, 10, 0);   // Friday

it('DEMO_REMINDER', () => expect(DEMO_REMINDER).toEqual({ typed: 'Call mum tomorrow at 2pm', title: 'Call mum', phrase: 'tomorrow at 2pm', czechExample: 'zavolat mámě zítra ve 14:00', listId: 'work', location: 'Office', flagged: true }));
it('typed = title + " " + phrase', () => expect(`${DEMO_REMINDER.title} ${DEMO_REMINDER.phrase}`).toBe(DEMO_REMINDER.typed));
it('every snapshot is keyed by its id, in SECTION_ORDER', () => { expect(Object.keys(SECTION_SNAPSHOTS)).toEqual([...SECTION_ORDER]); SECTION_ORDER.forEach(id => expect(SECTION_SNAPSHOTS[id].id).toBe(id)); });
it('pins the table', () => {
  expect(SECTION_SNAPSHOTS.hero).toEqual({ id: 'hero', panel: 'closed', section: 'none', title: '', notes: '', listId: 'reminders', flagged: false, location: null, due: null, saved: false, action: 'close' });
  expect(SECTION_SNAPSHOTS['02']).toEqual({ id: '02', panel: 'open', section: 'none', title: 'Call mum', typedTitle: 'Call mum tomorrow at 2pm', notes: '', listId: 'reminders', flagged: false, location: null, due: { type: 'phrase', text: 'tomorrow at 2pm' }, saved: false, action: 'typeTitle', applyDelayMs: 900 });
  expect(SECTION_SNAPSHOTS['03']).toMatchObject({ section: 'calendar', action: 'schedule', highlightPreset: 'tomorrow' });
  expect(SECTION_SNAPSHOTS['04']).toMatchObject({ listId: 'work', action: 'lists', listCycle: ['reminders', 'work', 'home', 'work'] });
  expect(SECTION_SNAPSHOTS['05']).toMatchObject({ section: 'none', listId: 'work', flagged: true, location: 'Office', action: 'flagLocation' });   // the Location section is opened, typed into and closed by Done inside the action
  expect(SECTION_SNAPSHOTS['06']).toMatchObject({ panel: 'closed', saved: true, action: 'save', title: 'Call mum', listId: 'work', flagged: true, location: 'Office' });
  expect(SECTION_SNAPSHOTS['07']).toMatchObject({ panel: 'closed', action: 'none' });
});
it('04 ends its cycle on the demo list, and 05–07 keep it', () => {
  const cycle = SECTION_SNAPSHOTS['04'].listCycle!; expect(cycle.at(-1)).toBe(SECTION_SNAPSHOTS['04'].listId);
  for (const id of ['05', '06', '07'] as const) expect(SECTION_SNAPSHOTS[id].listId).toBe(DEMO_REMINDER.listId);
});
it('previousSection', () => { expect(previousSection('01')).toBe('hero'); expect(previousSection('06')).toBe('05'); expect(previousSection('hero')).toBe('hero'); });
describe('resolveDue', () => {
  it('null → null', () => expect(resolveDue(null, NOW, pragueCalendar)).toBeNull());
  it('phrase with a time', () => expect(resolveDue({ type: 'phrase', text: 'tomorrow at 2pm' }, NOW, pragueCalendar)).toEqual({ date: prague(2026, 10, 24, 14, 0), presetPick: null }));
  it('day-only phrase goes through resolveDayOnly (9:00)', () => expect(resolveDue({ type: 'phrase', text: 'tomorrow' }, NOW, pragueCalendar)).toEqual({ date: prague(2026, 10, 24, 9, 0), presetPick: null }));
  it('preset carries its pick', () => { const d = prague(2026, 10, 24, 9, 0); expect(resolveDue({ type: 'preset', preset: 'tomorrow' }, NOW, pragueCalendar)).toEqual({ date: d, presetPick: { preset: 'tomorrow', date: d } }); });
  it('unparseable phrase → null', () => expect(resolveDue({ type: 'phrase', text: 'whenever' }, NOW, pragueCalendar)).toBeNull());
});
