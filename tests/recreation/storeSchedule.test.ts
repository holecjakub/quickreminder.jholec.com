// @vitest-environment jsdom
import '../ui/setup';
import { RecreationStore } from '../../src/recreation/store';
import { SuggestionDateFormatter } from '../../src/recreation/core/suggestionDateFormatter';
import { sizesFor } from '../../src/recreation/machine/notchState';
import { TEST_NOW, testCalendar } from '../ui/support';
import { plainSpaces } from '../support';
const formatter = new SuggestionDateFormatter({ locale: 'en-US', calendar: testCalendar });
const make = () => new RecreationStore({ clock: () => TEST_NOW, calendar: testCalendar, formatter, sizes: sizesFor({ width: 221, height: 38 }, 982, 0) });

const sat9 = new Date('2026-09-19T07:00:00Z');
test('opens on tomorrow 9:00 with no date and no phrase', () => {
  const st = make();
  const d = st.openScheduleDraft();
  expect(d.draft).toEqual(sat9);
  expect(d.text).toBe('');
  expect(st.calendarMonth).toEqual(new Date('2026-08-31T22:00:00Z'));   // 1 Sep 2026 00:00 Prague
  expect(plainSpaces(st.timeText)).toBe('9:00 AM');
});
test('opens on the live phrase, prefilled', () => {
  const st = make();
  st.setTitle('Call mum tomorrow at 2pm', 'user');
  const d = st.openScheduleDraft();
  expect(d.text).toBe('tomorrow at 2pm');
  expect(d.draft).toEqual(new Date('2026-09-19T12:00:00Z'));
});
test('an existing date wins and the field is empty', () => {
  const st = make();
  st.setDueDate(new Date('2026-09-25T16:00:00Z'), null, 'user');
  expect(st.openScheduleDraft()).toMatchObject({ text: '', draft: new Date('2026-09-25T16:00:00Z') });
});
test('Set from the phrase consumes it; Clear keeps it', () => {
  const st = make();
  st.setTitle('Call mum tomorrow at 2pm', 'user');
  const d = st.openScheduleDraft();
  expect(st.finishSchedule(d.set(), 'user')).toBe(true);
  expect(st.getState()).toMatchObject({ dueDate: new Date('2026-09-19T12:00:00Z'), title: 'Call mum', presetPick: null });
  const st2 = make();
  st2.setTitle('Call mum tomorrow at 2pm', 'user');
  st2.finishSchedule(st2.openScheduleDraft().clear(), 'user');
  expect(st2.getState()).toMatchObject({ dueDate: null, title: 'Call mum tomorrow at 2pm' });
  expect(st2.finishSchedule(null, 'user')).toBe(false);
});
test('✓ while open: untouched saves as is, an edit is Set first, a non-date is invalid', () => {
  const st = make();
  st.openScheduleDraft();
  expect(st.saveDecision()).toEqual({ type: 'saveAsIs' });
  st.setScheduleText('+2h', 'user');
  const dec = st.saveDecision();
  expect(dec.type).toBe('commitThenSave');
  expect(dec).toMatchObject({ outcome: { date: new Date('2026-09-18T10:00:00Z') } });
  const st2 = make();
  st2.openScheduleDraft();
  st2.setScheduleText('tomorrow please', 'user');
  expect(st2.saveDecision()).toEqual({ type: 'invalid' });
  expect(st2.switchDecision()).toEqual({ type: 'invalid' });            // the same decision blocks a switch to Location
});
test('typed time: valid applies, invalid reverts', () => {
  const st = make();
  st.openScheduleDraft();
  st.setTimeFieldEditing(true);
  st.setTimeText('1430');
  expect(st.applyTimeText()).toBe(true);
  st.setTimeFieldEditing(false);
  expect(st.scheduleDraft!.draft).toEqual(new Date('2026-09-19T12:30:00Z'));
  expect(plainSpaces(st.timeText)).toBe('2:30 PM');
  st.setTimeText('abc');
  expect(st.applyTimeText()).toBe(false);
  expect(plainSpaces(st.timeText)).toBe('2:30 PM');
});
test('month paging and arrow movement', () => {
  const st = make();
  st.openScheduleDraft();
  expect(st.pageMonth(-1)).toBe(false);                          // current month: canGoBack false
  expect(st.pageMonth(1)).toBe(true);
  expect(st.calendarMonth).toEqual(new Date('2026-09-30T22:00:00Z'));   // 1 Oct 2026 00:00 Prague
  expect(st.moveDayInGrid(1)).toBe(true);                       // paged away → lands on the same day number
  expect(st.scheduleDraft!.draft).toEqual(new Date('2026-10-19T07:00:00Z'));
  const st2 = make();
  st2.openScheduleDraft();
  expect(st2.moveDayInGrid(-1)).toBe(true);                     // Sat 19 → Fri 18 (today is allowed)
  expect(st2.moveDayInGrid(-1)).toBe(false);                    // never before today
  expect(st2.beepCount).toBe(1);
});
test('the month follows the draft; stepTime snaps to 15 min', () => {
  const st = make();
  st.openScheduleDraft();
  st.editSchedule(d => d.stepTime(1), 'user');
  expect(plainSpaces(st.timeText)).toBe('9:15 AM');
  st.editSchedule(d => d.pick(new Date('2026-10-02T22:00:00Z')), 'user');   // 3 Oct 00:00 Prague
  expect(st.calendarMonth).toEqual(new Date('2026-09-30T22:00:00Z'));
  expect(st.saveDecision().type).toBe('commitThenSave');
});
test('↑ ↓ while the time field has focus re-sync it, and blur keeps the step', () => {
  const st = make();
  st.openScheduleDraft();
  st.setTimeFieldEditing(true);
  st.editSchedule(d => d.stepTime(1), 'user');                   // Swift: model.stepTime(by:); syncTimeText()
  expect(plainSpaces(st.timeText)).toBe('9:15 AM');
  expect(st.applyTimeText()).toBe(true);
  expect(st.scheduleDraft!.draft).toEqual(new Date('2026-09-19T07:15:00Z'));
  st.editSchedule(d => d.setTime(14), 'user');                   // the hour chip: model.setTime(hour:); syncTimeText()
  expect(plainSpaces(st.timeText)).toBe('2:00 PM');
});
test('a day pick while the time field is being edited keeps the typed text', () => {
  const st = make();
  st.openScheduleDraft();
  st.setTimeFieldEditing(true);
  st.setTimeText('14');
  st.editSchedule(d => d.pick(new Date('2026-09-24T22:00:00Z')), 'user');   // 25 Sep 00:00 Prague
  expect(st.timeText).toBe('14');
});
test('a paged-away month stays when a text edit leaves the date alone', () => {
  const st = make();
  st.openScheduleDraft();
  expect(st.pageMonth(1)).toBe(true);
  const v = st.scheduleVersion;
  st.setScheduleText('t', 'user');                               // not a date: draft unchanged
  expect(st.scheduleDraft!.draft).toEqual(sat9);
  expect(st.calendarMonth).toEqual(new Date('2026-09-30T22:00:00Z'));   // still 1 Oct
  expect(st.scheduleVersion).toBeGreaterThan(v);                 // the field's text still re-renders
  expect(st.saveDecision()).toEqual({ type: 'invalid' });        // ✓ → prepareSave → set() re-resolve
  expect(st.calendarMonth).toEqual(new Date('2026-09-30T22:00:00Z'));
});
