// @vitest-environment jsdom
import './setup';
import { screen, act, fireEvent } from '@testing-library/react';
import { NotchContainer } from '../../src/recreation/ui/NotchContainer';
import { useRecreationKeys } from '../../src/recreation/ui/keyboard';
import { renderWithCore, useTestTime, openPanel, createTestCore } from './support';
beforeEach(() => useTestTime());
function Root({ enabled, onOuter }: { enabled: boolean; onOuter: () => void }) {
  const onKeyDown = useRecreationKeys(enabled);
  return <div onKeyDown={onOuter}><div onKeyDown={onKeyDown}><NotchContainer /></div></div>;
}
test('handled keys are prevented and never reach the desktop', async () => {
  const outer = vi.fn(); const core = createTestCore();
  renderWithCore(<Root enabled onOuter={outer} />, core);
  await openPanel(core);
  const title = screen.getByRole('textbox', { name: 'New Reminder' });
  fireEvent.change(title, { target: { value: 'Call mum tomorrow at 2pm' } });
  const tab = fireEvent.keyDown(title, { key: 'Tab' });
  expect(tab).toBe(false);                                   // defaultPrevented
  expect(core.store.getState().title).toBe('Call mum');
  expect(outer).not.toHaveBeenCalled();
  fireEvent.keyDown(title, { key: 'd', metaKey: true });
  expect(core.store.getState().section).toBe('controls');
  fireEvent.keyDown(title, { key: 'k', metaKey: true });
  expect(core.store.getState().section).toBe('calendar');
  fireEvent.keyDown(title, { key: '5', code: 'Digit5', metaKey: true });
  expect(core.store.getState()).toMatchObject({ section: 'none', presetPick: { preset: 'nextWeek' } });
  fireEvent.keyDown(title, { key: 'Enter', metaKey: true });
  await act(async () => { vi.advanceTimersByTime(320); });
  expect(core.store.getState().savedItems[0]!.title).toBe('Call mum');
});
test('arrows in the time field and the grid', async () => {
  const core = createTestCore();
  renderWithCore(<Root enabled onOuter={() => {}} />, core);
  await openPanel(core);
  act(() => core.controller.openSchedule('user'));
  const time = screen.getByRole('textbox', { name: 'Time' });
  time.focus();
  fireEvent.keyDown(time, { key: 'ArrowUp' });
  expect(core.store.scheduleDraft!.draft).toEqual(new Date('2026-09-19T07:15:00Z'));
  act(() => core.controller.openCalendar('user'));
  await act(async () => { vi.advanceTimersByTime(0); });
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
  expect(core.store.scheduleDraft!.draft).toEqual(new Date('2026-09-20T07:15:00Z'));
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  expect(core.store.getState().section).toBe('controls');
});
test('Location: ↩ in the field is Done, Esc closes it without writing, ⌘↩ is Done and never saves', async () => {
  const core = createTestCore();
  renderWithCore(<Root enabled onOuter={() => {}} />, core);
  await openPanel(core);
  const field = () => screen.getAllByRole('textbox', { name: 'Location' }).at(-1)!;
  const open = async () => { act(() => core.controller.openLocation('user')); await act(async () => { vi.advanceTimersByTime(0); }); };
  const settle = () => act(async () => { vi.advanceTimersByTime(600); });
  core.controller.setTitle('Call mum', 'user');
  await open();
  fireEvent.change(field(), { target: { value: 'Office' } });
  expect(fireEvent.keyDown(field(), { key: 'Enter' })).toBe(false);                    // defaultPrevented
  expect(core.store.getState()).toMatchObject({ section: 'none', location: 'Office' });
  await settle(); await open();
  fireEvent.change(field(), { target: { value: 'Home' } });
  fireEvent.keyDown(field(), { key: 'Escape' });
  expect(core.store.getState()).toMatchObject({ section: 'none', location: 'Office', phase: { type: 'open' } });
  await settle(); await open();
  fireEvent.change(field(), { target: { value: 'Home' } });
  fireEvent.keyDown(field(), { key: 'Enter', metaKey: true });
  expect(core.store.getState()).toMatchObject({ section: 'none', location: 'Home', savedItems: [], phase: { type: 'open' } });
});
test('disabled while focus is outside the desktop', async () => {
  const outer = vi.fn(); const core = createTestCore();
  renderWithCore(<Root enabled={false} onOuter={outer} />, core);
  await openPanel(core);
  const title = screen.getByRole('textbox', { name: 'New Reminder' });
  expect(fireEvent.keyDown(title, { key: 'Escape' })).toBe(true);
  expect(outer).toHaveBeenCalled();
  expect(core.store.getState().phase).toEqual({ type: 'open' });
});
test('the closed notch opens from the keyboard', () => {
  const core = createTestCore();
  renderWithCore(<Root enabled onOuter={() => {}} />, core);
  fireEvent.click(screen.getByRole('button', { name: 'New reminder' }));
  expect(core.store.getState().phase).toEqual({ type: 'open' });
});
