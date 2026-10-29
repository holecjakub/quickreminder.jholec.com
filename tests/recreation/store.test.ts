// @vitest-environment jsdom
import '../ui/setup';
import { RecreationStore } from '../../src/recreation/store';
import { SuggestionDateFormatter } from '../../src/recreation/core/suggestionDateFormatter';
import { sizesFor } from '../../src/recreation/machine/notchState';
import { TEST_NOW, testCalendar } from '../ui/support';
import { plainSpaces } from '../support';
const formatter = new SuggestionDateFormatter({ locale: 'en-US', calendar: testCalendar });
const make = () => new RecreationStore({ clock: () => TEST_NOW, calendar: testCalendar, formatter, sizes: sizesFor({ width: 221, height: 38 }, 982, 0) });

test('initial state', () => {
  const s = make().getState();
  expect(s).toMatchObject({ phase: { type: 'closed', parked: false }, section: 'none', title: '', notes: '', listId: 'reminders',
    flagged: false, location: null, dueDate: null, suggestion: null, canSave: false, accent: '#0A84FF', dirty: false,
    savedItems: [], openedOnce: false, listPickerOpen: false, locationField: null, saveError: null,
    schedulingInNotch: false, locationInNotch: false, sectionOpen: false });
});
test('typing a phrase shows the suggestion and turns ✓ on', () => {
  const st = make();
  st.setTitle('Call mum tomorrow at 2pm', 'user');
  const s = st.getState();
  expect(s.suggestion!.matchedText).toBe('tomorrow at 2pm');
  expect(plainSpaces(formatter.string(s.suggestion!.date, s.suggestion!.hasTime, TEST_NOW))).toBe('Tomorrow, 2:00 PM');
  expect(s.canSave).toBe(true);
  expect(s.dirty).toBe(true);
});
test('Tab applies: due date set, phrase stripped', () => {
  const st = make();
  st.setTitle('Call mum tomorrow at 2pm', 'user');
  expect(st.applySuggestion('user')).toBe(true);
  expect(st.getState()).toMatchObject({ title: 'Call mum', suggestion: null, dueDate: new Date('2026-09-19T12:00:00Z') });
  expect(st.applySuggestion('user')).toBe(false);
});
test('day-only phrases go through resolveDayOnly (9:00)', () => {
  const st = make();
  st.setTitle('Call mum tomorrow', 'user');
  st.applySuggestion('user');
  expect(st.getState().dueDate).toEqual(new Date('2026-09-19T07:00:00Z'));
});
test('a title that is only the phrase keeps its text', () => {
  const st = make();
  st.setTitle('tomorrow', 'user');
  st.applySuggestion('user');
  expect(st.getState().title).toBe('tomorrow');
});
test('ⓧ dismisses for that phrase only', () => {
  const st = make();
  st.setTitle('Call tomorrow at 2pm', 'user');
  st.dismissSuggestion('user');
  expect(st.getState()).toMatchObject({ suggestion: null, dismissedSuggestionText: 'tomorrow at 2pm' });
  st.setTitle('Call tomorrow at 2pm!', 'user');
  expect(st.getState().suggestion).toBeNull();
  st.setTitle('Call', 'user');
  expect(st.getState().dismissedSuggestionText).toBeNull();
  st.setTitle('Call tomorrow at 2pm', 'user');
  expect(st.getState().suggestion!.matchedText).toBe('tomorrow at 2pm');
});
test('no suggestion while a date is set; it comes back when the date is cleared', () => {
  const st = make();
  st.setDueDate(new Date('2026-09-20T07:00:00Z'), null, 'user');
  st.setTitle('Pay rent tomorrow', 'user');
  expect(st.getState().suggestion).toBeNull();
  st.setDueDate(null, null, 'user');
  expect(st.getState().suggestion!.matchedText).toBe('tomorrow');
});
test('list, flag, location', () => {
  const st = make();
  st.setListPickerOpen(true);
  st.setList('work', 'user');
  expect(st.getState()).toMatchObject({ listId: 'work', accent: '#BF5AF2', listPickerOpen: false });
  st.setFlag(true, 'user');
  st.setLocation('', 'user');
  expect(st.getState().location).toBeNull();
  st.setLocation('Office', 'user');
  expect(st.getState()).toMatchObject({ flagged: true, location: 'Office' });
});
test('the Location field is not the location until Done (LocationDraft)', () => {
  const st = make();
  st.setLocation('Office', 'api');
  const d = st.openLocationDraft();
  expect([d.original, d.text]).toEqual(['Office', 'Office']);
  expect(st.getState().locationField).toBe('Office');
  st.setLocationText('Home');
  expect(st.getState()).toMatchObject({ location: 'Office', locationField: 'Home', dirty: false });
  expect(st.locationDraft!.saveDecision).toEqual({ type: 'applyThenSave', text: 'Home' });
  st.closeLocationDraft();
  expect(st.getState()).toMatchObject({ location: 'Office', locationField: null });
  expect(st.locationDraft).toBeNull();
  expect(st.openLocationDraft().original).toBe('Office');
  expect(make().openLocationDraft().original).toBe('');            // no location → an empty field
  st.closePopovers();
  expect(st.getState().locationField).toBeNull();
});
test("'api' writes never set dirty; markClean clears it", () => {
  const st = make();
  st.setTitle('x', 'api'); st.setList('home', 'api'); st.setFlag(true, 'api');
  expect(st.getState().dirty).toBe(false);
  st.setNotes('n', 'user');
  expect(st.getState().dirty).toBe(true);
  st.markClean();
  expect(st.getState().dirty).toBe(false);
  st.setListPickerOpen(true);
  expect(st.getState().dirty).toBe(false);
});
test('resetDraft = resetState(): list kept, openedOnce set', () => {
  const st = make();
  st.setList('ideas', 'user'); st.setTitle('a tomorrow', 'user'); st.setNotes('n', 'user'); st.setFlag(true, 'user');
  st.setLocation('Office', 'user'); st.setSaveError('x'); st.dismissSuggestion('user');
  st.resetDraft();
  expect(st.getState()).toMatchObject({ title: '', notes: '', dueDate: null, flagged: false, location: null, saveError: null,
    suggestion: null, dismissedSuggestionText: null, presetPick: null, listId: 'ideas', openedOnce: true });
});
test('prepareReminder auto-applies an undismissed suggestion (like iOS Reminders)', () => {
  const st = make();
  expect(st.prepareReminder()).toBeNull();
  st.setTitle('  Call mum tomorrow at 2pm ', 'user');
  expect(st.prepareReminder()).toEqual({ title: 'Call mum', notes: '', listId: 'reminders',
    dueDate: new Date('2026-09-19T12:00:00Z'), flagged: false, location: null });
});
test('panel mirror: stable snapshots, one notification per change', () => {
  const st = make();
  const fn = vi.fn();
  st.subscribe(fn);
  const p0 = st.getPanel(), s0 = st.getState();
  expect(st.getPanel()).toBe(p0);
  st.setFlags({ isOpen: true, contentVisible: true }, 'open');
  expect(st.getPanel()).not.toBe(p0);
  expect(st.getPanel()).toMatchObject({ animation: 'open', flags: { isOpen: true, contentVisible: true, isSettled: false } });
  expect(st.getState().contentVisible).toBe(true);
  expect(st.getState()).not.toBe(s0);
  expect(fn).toHaveBeenCalledTimes(1);
  st.beep();
  expect(st.beepCount).toBe(1);
});
