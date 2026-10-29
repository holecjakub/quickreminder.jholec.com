// @vitest-environment jsdom
import './setup';
import { screen, act, fireEvent } from '@testing-library/react';
import { ScheduleNotchSection, ANNOUNCE_PAUSE_MS } from '../../src/recreation/ui/ScheduleNotchSection';
import { renderWithCore, ptOf, useTestTime, openPanel, createTestCore } from './support';
import { plainSpaces } from '../support';
beforeEach(() => useTestTime());
/** One animation frame: jsdom's rAF runs on the faked timers (~16 ms), where motion lands its values. */
const frame = () => act(async () => { vi.advanceTimersByTime(20); });
test('rows in the Swift rhythm, footer pinned below the rows', async () => {
  const core = createTestCore(); await openPanel(core);
  act(() => core.controller.openSchedule('user'));
  const { container } = renderWithCore(<ScheduleNotchSection />, core);
  const section = screen.getByRole('group', { name: 'Set Date' });
  expect(ptOf(section.style.paddingBottom)).toBe(20);
  const m = (sel: string) => ptOf((container.querySelector(sel)!.closest('[data-qr-row]') as HTMLElement).style.marginTop || 'calc(0 * var(--pt) * 1px)');
  expect([m('[data-qr-type-field]'), m('[data-qr-preview]'), m('[data-qr-presets]'), m('[data-qr-day-time]'), m('[data-qr-footer]')]).toEqual([0, 6, 10, 12, 14]);
  const rows = container.querySelector('[data-qr-section-rows]') as HTMLElement;
  expect(rows.style.overflowY).toBe('auto');
  expect(rows.contains(container.querySelector('[data-qr-footer]'))).toBe(false);
  expect([...container.querySelectorAll('[data-qr-row]')].map(r => (r as HTMLElement).dataset.stagger)).toEqual(['0', '0', '1', '2', '3']);
  // Swift `.staggered`: every row starts hidden, 6 pt up and 3 pt blurred, and lands at 0, composed in points.
  const first = container.querySelector('[data-stagger]') as HTMLElement;
  expect([first.style.opacity, first.style.transform, first.style.filter])
    .toEqual(['0', 'translateY(calc(-6 * var(--pt) * 1px))', 'blur(calc(3 * var(--pt) * 1px))']);
  await frame();
  for (const row of container.querySelectorAll<HTMLElement>('[data-stagger]')) {
    expect([row.style.opacity, row.style.transform, row.style.filter])
      .toEqual(['1', 'translateY(calc(0 * var(--pt) * 1px))', 'blur(calc(0 * var(--pt) * 1px))']);
  }
  expect(container.querySelector('[data-qr-calendar]')).toBeNull();
  act(() => core.controller.openCalendar('user'));
  expect(m('[data-qr-calendar]')).toBe(10);
  expect(screen.getByRole('group', { name: /^Calendar, / })).toBeTruthy();
});
test('focus: the field on open, the grid with the calendar, back to the field without it', async () => {
  const core = createTestCore(); await openPanel(core);
  renderWithCore(<ScheduleNotchSection />, core);   // renders nothing until the section opens
  act(() => core.controller.openSchedule('user'));
  await act(async () => { vi.advanceTimersByTime(0); });
  expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Type a date' }));
  act(() => core.controller.openCalendar('user'));
  await act(async () => { vi.advanceTimersByTime(0); });
  expect((document.activeElement as HTMLElement).dataset.qrField).toBe('calendar');
  act(() => core.controller.closeCalendar('user'));
  await act(async () => { vi.advanceTimersByTime(0); });
  expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Type a date' }));
});
test('an API open never takes focus', async () => {
  const core = createTestCore(); await openPanel(core);
  renderWithCore(<ScheduleNotchSection />, core);
  act(() => core.controller.openSchedule('api'));
  await act(async () => { vi.advanceTimersByTime(0); });
  expect(document.activeElement).toBe(document.body);
});
test('the preview is announced 400 ms after typing pauses', async () => {
  expect(ANNOUNCE_PAUSE_MS).toBe(400);
  const core = createTestCore(); await openPanel(core);
  act(() => core.controller.openSchedule('user'));
  const { container } = renderWithCore(<ScheduleNotchSection />, core);
  const live = container.querySelector('[aria-live="polite"]') as HTMLElement;
  act(() => core.controller.setScheduleText('tomorrow', 'user'));
  await act(async () => { vi.advanceTimersByTime(300); });
  act(() => core.controller.setScheduleText('tomorrow 2pm', 'user'));
  await act(async () => { vi.advanceTimersByTime(399); });
  expect(live.textContent).toBe('');
  await act(async () => { vi.advanceTimersByTime(1); });
  expect(plainSpaces(live.textContent!)).toBe('Saturday, September 19 2:00 PM');   // R-12: U+202F before PM
  act(() => core.controller.setScheduleText('tomorrow please', 'user'));
  await act(async () => { vi.advanceTimersByTime(400); });
  expect(live.textContent).toBe('Not a date');
});
test('a blank field, a commit or the unmount cancels the pending announcement', async () => {
  const core = createTestCore(); await openPanel(core);
  act(() => core.controller.openSchedule('user'));
  const { container, unmount } = renderWithCore(<ScheduleNotchSection />, core);
  const live = container.querySelector('[aria-live="polite"]') as HTMLElement;
  act(() => core.controller.setScheduleText('tomorrow', 'user'));
  act(() => core.controller.setScheduleText('   ', 'user'));
  await act(async () => { vi.advanceTimersByTime(400); });
  expect(live.textContent).toBe('');
  act(() => core.controller.setScheduleText('tomorrow', 'user'));
  await act(async () => { vi.advanceTimersByTime(100); });
  act(() => core.controller.commitSchedule('user'));   // the section closes; the draft is committed
  await act(async () => { vi.advanceTimersByTime(300); });
  expect(live.textContent).toBe('');
  act(() => core.controller.openSchedule('user'));
  act(() => core.controller.setScheduleText('tomorrow', 'user'));
  const pending = vi.getTimerCount();
  unmount();
  expect(vi.getTimerCount()).toBe(pending - 1);
});
test('clamped to a short screen: only the rows scroll', async () => {
  const core = createTestCore({ screenHeight: 600 }); await openPanel(core);
  act(() => core.controller.openCalendar('user'));
  renderWithCore(<ScheduleNotchSection />, core);
  expect(screen.getByRole('group', { name: 'Set Date' }).dataset.clamped).toBe('true');   // 751 natural > 600 − 40
  const tall = createTestCore(); await openPanel(tall);
  act(() => tall.controller.openCalendar('user'));
  const { container } = renderWithCore(<ScheduleNotchSection />, tall);
  expect((container.querySelector('[data-qr-section]') as HTMLElement).dataset.clamped).toBe('false');
});
test('clamped: opening the calendar scrolls the grid into view, smoothly unless motion is reduced', async () => {
  const scroll = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>;
  scroll.mockClear();
  const core = createTestCore({ screenHeight: 600 }); await openPanel(core);
  act(() => core.controller.openSchedule('user'));
  renderWithCore(<ScheduleNotchSection />, core);
  expect(scroll).not.toHaveBeenCalled();
  act(() => core.controller.openCalendar('user'));
  expect(scroll).toHaveBeenCalledTimes(1);
  expect(scroll.mock.instances[0]).toHaveAttribute('data-qr-calendar');
  expect(scroll).toHaveBeenLastCalledWith({ block: 'end', behavior: 'smooth' });
  const reduced = createTestCore({ screenHeight: 600 }); await openPanel(reduced);
  act(() => reduced.controller.openSchedule('user'));
  renderWithCore(<ScheduleNotchSection />, reduced, { reduceMotion: true });
  act(() => reduced.controller.openCalendar('user'));
  expect(scroll).toHaveBeenLastCalledWith({ block: 'end', behavior: 'auto' });
  const tall = createTestCore(); await openPanel(tall);
  act(() => tall.controller.openSchedule('user'));
  renderWithCore(<ScheduleNotchSection />, tall);
  act(() => tall.controller.openCalendar('user'));
  expect(scroll).toHaveBeenCalledTimes(2);   // a panel that fits never scrolls
});
test('the grid is wired to the store month and the controller pick; it keeps rendering while the section exits', async () => {
  const core = createTestCore(); await openPanel(core);
  act(() => core.controller.openCalendar('user'));
  const { container } = renderWithCore(<ScheduleNotchSection />, core);
  fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
  expect(core.store.calendarMonth).toEqual(new Date('2026-09-30T22:00:00Z'));
  await frame();   // the month crossfade lets go of September
  expect(screen.getByRole('heading', { level: 3 }).textContent).toBe('October 2026');
  fireEvent.click(screen.getByRole('button', { name: /^Thursday, October 1\b/ }));
  expect(core.store.scheduleDraft!.draft).toEqual(new Date('2026-10-01T07:00:00Z'));   // the pick keeps the draft's 9:00
  act(() => core.controller.openLocation('user'));   // one section at a time: the store drops the draft
  expect(core.store.scheduleDraft).toBeNull();
  expect(container.querySelector('[data-qr-calendar]')).not.toBeNull();   // the captured draft and depth render the exit
});
