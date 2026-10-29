// @vitest-environment jsdom
import '../ui/setup';
import { act } from '@testing-library/react';
import { createTestCore, useTestTime, openPanel } from '../ui/support';
import { plainSpaces } from '../support';
beforeEach(() => useTestTime());
const adv = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

test('click opens with focus, scroll never focuses', async () => {
  const a = createTestCore(); const spyA = vi.spyOn(a.focus, 'focus');
  a.controller.show('click', true); await adv(300);
  expect(spyA).toHaveBeenCalledWith('title');
  const b = createTestCore(); const spyB = vi.spyOn(b.focus, 'focus');
  b.controller.show('scroll', false); await adv(600);
  expect(spyB).not.toHaveBeenCalled();
  expect(b.store.getState().phase).toEqual({ type: 'open' });
});
test('save: item lands at 0.32 s, promise resolves after hold + close', async () => {
  const onSaved = vi.fn();
  const core = createTestCore({ onSaved });
  await openPanel(core);
  core.controller.setTitle('Call mum tomorrow at 2pm', 'user');
  const p = core.controller.save('user');
  await adv(319); expect(core.store.getState().savedItems).toHaveLength(0);
  await adv(1);
  const item = core.store.getState().savedItems[0]!;
  expect(item).toMatchObject({ title: 'Call mum', listId: 'reminders', listColor: '#0A84FF', flagged: false });
  expect(plainSpaces(item.dueLabel!)).toBe('Tomorrow, 2:00 PM');
  expect(onSaved).toHaveBeenCalledWith(item);
  await adv(1040);
  await expect(p).resolves.toBe(item);
  expect(core.store.getState().phase).toEqual({ type: 'closed', parked: true });
});
test('empty title: nothing happens', async () => {
  const core = createTestCore(); await openPanel(core);
  await expect(core.controller.save('user')).resolves.toBeNull();
  expect(core.store.getState().phase).toEqual({ type: 'open' });
});
test('⌘↩ while Set Date is open means Set, never save', async () => {
  const core = createTestCore(); await openPanel(core);
  core.controller.setTitle('Pay rent', 'user');
  core.controller.openSchedule('user');
  await expect(core.controller.save('user')).resolves.toBeNull();
  expect(core.store.getState()).toMatchObject({ section: 'none', dueDate: new Date('2026-09-19T07:00:00Z'), savedItems: [] });
});
test('✓ while open: untouched → saved with no date; edited → Set then saved; invalid → beep', async () => {
  const a = createTestCore(); await openPanel(a);
  a.controller.setTitle('A', 'user'); a.controller.openSchedule('user');
  a.controller.saveFromBar('user'); await adv(320);
  expect(a.store.getState().savedItems[0]!.dueDate).toBeNull();
  const b = createTestCore(); await openPanel(b);
  b.controller.setTitle('B', 'user'); b.controller.openSchedule('user'); b.controller.setScheduleText('+2h', 'user');
  b.controller.saveFromBar('user'); await adv(320);
  expect(b.store.getState().savedItems[0]!.dueDate).toEqual(new Date('2026-09-18T10:00:00Z'));
  const c = createTestCore(); await openPanel(c);
  c.controller.setTitle('C', 'user'); c.controller.openSchedule('user'); c.controller.setScheduleText('tomorrow please', 'user');
  await expect(c.controller.saveFromBar('user')).resolves.toBeNull();
  expect(c.store.beepCount).toBe(1);
  expect(c.store.getState().section).toBe('controls');
});
test('Esc steps back one level: list picker → calendar → section → panel', async () => {
  const core = createTestCore(); await openPanel(core);
  core.controller.openCalendar('user'); core.controller.openListPicker();
  expect(core.controller.escape()).toBe('popover');
  expect(core.controller.escape()).toBe('calendar');
  expect(core.store.getState().section).toBe('controls');
  expect(core.controller.escape()).toBe('section');
  expect(core.controller.escape()).toBe('panel');
  expect(core.controller.escape()).toBe('none');
});
test('presets, invalid Set, Clear, Cancel', async () => {
  const core = createTestCore(); await openPanel(core);
  core.controller.openSchedule('user');
  core.controller.applyPreset('tomorrow', 'user');
  expect(core.store.getState()).toMatchObject({ section: 'none', dueDate: new Date('2026-09-19T07:00:00Z'),
    presetPick: { preset: 'tomorrow', date: new Date('2026-09-19T07:00:00Z') } });
  core.controller.openSchedule('user'); core.controller.setScheduleText('nope nope', 'user');
  expect(core.controller.commitSchedule('user')).toBe(false);
  expect(core.store.getState().section).toBe('controls');
  core.controller.clearDueDate('user');
  expect(core.store.getState()).toMatchObject({ section: 'none', dueDate: null });
  core.controller.setDueDate(new Date('2026-09-20T07:00:00Z'), null, 'user');
  core.controller.openSchedule('user'); core.controller.setScheduleText('+3d', 'user'); core.controller.cancelSchedule('user');
  expect(core.store.getState().dueDate).toEqual(new Date('2026-09-20T07:00:00Z'));
});
test('a click on header / title / notes cancels the section; chip slot and bar do not', async () => {
  const core = createTestCore(); await openPanel(core);
  core.controller.openSchedule('user');
  core.controller.pointerDownInPanel(197); expect(core.store.getState().section).toBe('controls');
  core.controller.pointerDownInPanel(152); expect(core.store.getState().section).toBe('controls');
  core.controller.pointerDownInPanel(105); expect(core.store.getState().section).toBe('none');
});
test('calendar icon toggles; ⌘D never collapses an open section; nothing opens while closed', async () => {
  const core = createTestCore();
  core.controller.openSchedule('user'); expect(core.store.getState().section).toBe('none');
  await openPanel(core);
  core.controller.toggleSchedule('user'); expect(core.store.getState().section).toBe('controls');
  core.controller.openCalendar('user'); core.controller.openSchedule('user');
  expect(core.store.getState().section).toBe('calendar');
  core.controller.toggleSchedule('user'); expect(core.store.getState().section).toBe('none');
});
test('a click outside the shape closes the list picker or a section with the panel (global monitor), nothing written', async () => {
  const core = createTestCore(); await openPanel(core);
  core.controller.openListPicker();
  core.controller.pointerDownOutside();
  expect(core.store.getState()).toMatchObject({ listPickerOpen: false, phase: { type: 'closing' } });
  const loc = createTestCore(); await openPanel(loc);
  loc.controller.openLocation('user'); loc.controller.setLocationText('Home', 'user');
  loc.controller.pointerDownOutside();
  expect(loc.store.getState()).toMatchObject({ section: 'none', locationField: null, location: null, phase: { type: 'closing' } });
});
test('Location: Done writes the field; Cancel, Esc, a click above and the location button leave it (LocationNotchSection)', async () => {
  const core = createTestCore(); await openPanel(core);
  core.controller.toggleLocation('user');
  expect(core.store.getState()).toMatchObject({ section: 'location', locationField: '', locationInNotch: true });
  core.controller.setLocationText('Office', 'user');
  expect(core.store.getState()).toMatchObject({ location: null, dirty: false });
  core.controller.commitLocation('user');
  expect(core.store.getState()).toMatchObject({ section: 'none', location: 'Office', locationField: null, dirty: true });
  core.controller.openLocation('user'); core.controller.setLocationText('Home', 'user'); core.controller.cancelLocation('user');
  expect(core.store.getState().location).toBe('Office');
  core.controller.openLocation('user'); core.controller.setLocationText('Home', 'user');
  expect(core.controller.escape()).toBe('section');
  expect(core.store.getState()).toMatchObject({ section: 'none', location: 'Office', phase: { type: 'open' } });
  core.controller.openLocation('user'); core.controller.setLocationText('Home', 'user');
  core.controller.pointerDownInPanel(197); expect(core.store.getState().section).toBe('location');   // the bar keeps its meaning
  core.controller.pointerDownInPanel(105); expect(core.store.getState()).toMatchObject({ section: 'none', location: 'Office' });
  core.controller.openLocation('user'); core.controller.setLocationText('Home', 'user'); core.controller.toggleLocation('user');
  expect(core.store.getState()).toMatchObject({ section: 'none', location: 'Office' });
  core.controller.openLocation('user'); core.controller.clearLocation('user');
  expect(core.store.getState()).toMatchObject({ section: 'none', location: null });
});
test('Location: ↩ and ⌘↩ mean Done, never save; ✓ applies an edited location, then saves', async () => {
  const a = createTestCore(); await openPanel(a);
  a.controller.setTitle('Call mum', 'user');
  a.controller.openLocation('user'); a.controller.setLocationText('Office', 'user');
  await expect(a.controller.textRowSubmit('user')).resolves.toBeNull();
  expect(a.store.getState()).toMatchObject({ section: 'none', location: 'Office', savedItems: [] });
  a.controller.openLocation('user'); a.controller.setLocationText('Home', 'user');
  await expect(a.controller.save('user')).resolves.toBeNull();
  expect(a.store.getState()).toMatchObject({ section: 'none', location: 'Home', savedItems: [] });
  a.controller.openLocation('user'); a.controller.setLocationText('Café Slavia', 'user');
  a.controller.saveFromBar('user'); await adv(320);
  expect(a.store.getState().savedItems[0]).toMatchObject({ title: 'Call mum', notes: '📍 Café Slavia' });
  const b = createTestCore(); await openPanel(b);
  b.controller.setTitle('B', 'user'); b.controller.setLocation('Office', 'user'); b.controller.openLocation('user');
  b.controller.saveFromBar('user'); await adv(320);
  expect(b.store.getState().savedItems[0]!.notes).toBe('📍 Office');                              // untouched: saved as it was
});
test('switching between Location and Set Date keeps what was typed; an invalid typed date beeps and blocks it (SectionHandoff)', async () => {
  const core = createTestCore(); await openPanel(core);
  core.controller.openLocation('user'); core.controller.setLocationText('Office', 'user');
  core.controller.toggleSchedule('user');                                                         // calendar button while Location is open
  expect(core.store.getState()).toMatchObject({ section: 'controls', location: 'Office', locationField: null });
  core.controller.setScheduleText('+2h', 'user');
  core.controller.toggleLocation('user');                                                         // the edited draft is Set first
  expect(core.store.getState()).toMatchObject({ section: 'location', dueDate: new Date('2026-09-18T10:00:00Z'), locationField: 'Office' });
  core.controller.openSchedule('user');                                                           // ⌘D from an untouched Location: nothing written
  expect(core.store.getState()).toMatchObject({ section: 'controls', location: 'Office' });
  core.controller.setScheduleText('tomorrow please', 'user');
  expect(core.controller.switchSection('location', 'user')).toBe(false);
  expect(core.store.getState().section).toBe('controls');
  expect(core.store.beepCount).toBe(1);
});
