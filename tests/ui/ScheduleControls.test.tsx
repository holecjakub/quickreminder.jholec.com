// @vitest-environment jsdom
import './setup';
import { screen, fireEvent, within, act } from '@testing-library/react';
import { DayTimeRow, ScheduleFooter } from '../../src/recreation/ui/ScheduleNotchSection';
import { NumericText } from '../../src/recreation/ui/NumericText';
import { renderWithCore, ptOf, useTestTime, openPanel, createTestCore } from './support';
import { plainSpaces } from '../support';
beforeEach(() => useTestTime());
async function opened() { const core = createTestCore(); await openPanel(core); act(() => core.controller.openSchedule('api')); return core; }
test('day button and calendar toggle', async () => {
  const core = await opened();
  const { rerender } = renderWithCore(<DayTimeRow draft={core.store.scheduleDraft!} showsCalendar={false} />, core);
  const day = screen.getByRole('button', { name: 'Calendar' });
  expect(within(day).getByText('Sat, Sep 19')).toBeTruthy();
  expect([ptOf(day.style.height), ptOf(day.style.paddingLeft), ptOf(day.style.borderRadius), day.dataset.kind]).toEqual([30, 11, 999, 'neutral']);
  expect(day.querySelector('[data-sf="calendar@12"]')).not.toBeNull();
  const chevron = day.querySelector('[data-sf="chevron.down@9"]')!.closest('[data-qr-glyph]') as HTMLElement;
  expect(chevron.dataset.rotation).toBe('0');
  fireEvent.click(day);
  expect(core.store.getState().section).toBe('calendar');
  rerender(<DayTimeRow draft={core.store.scheduleDraft!} showsCalendar />);
  expect(screen.getByRole('button', { name: 'Calendar' }).dataset.kind).toBe('selected');
  expect((screen.getByRole('button', { name: 'Calendar' }).querySelector('[data-qr-glyph][data-rotation]') as HTMLElement).dataset.rotation).toBe('180');
});
test('time field 96 pt, typed time applies on blur, invalid reverts', async () => {
  const core = await opened();
  renderWithCore(<DayTimeRow draft={core.store.scheduleDraft!} showsCalendar={false} />, core);
  const time = screen.getByRole('textbox', { name: 'Time' }) as HTMLInputElement;
  const cap = time.closest('[data-qr-time-field]') as HTMLElement;
  expect([ptOf(cap.style.width), ptOf(cap.style.height), ptOf(cap.style.paddingLeft), ptOf(cap.style.gap)]).toEqual([96, 30, 10, 5]);
  expect(plainSpaces(time.value)).toBe('9:00 AM');
  fireEvent.focus(time); fireEvent.change(time, { target: { value: '1430' } }); fireEvent.blur(time);
  expect(core.store.scheduleDraft!.draft).toEqual(new Date('2026-09-19T12:30:00Z'));
  expect(plainSpaces(time.value)).toBe('2:30 PM');
  fireEvent.focus(time); fireEvent.change(time, { target: { value: 'soon' } }); fireEvent.blur(time);
  expect(plainSpaces(time.value)).toBe('2:30 PM');
  expect(core.store.beepCount).toBe(0);
});
test('time chips 9 / 12 / 15 / 19, the current one prominent', async () => {
  const core = await opened();
  renderWithCore(<DayTimeRow draft={core.store.scheduleDraft!} showsCalendar={false} />, core);
  const chips = ['9:00 AM', '12:00 PM', '3:00 PM', '7:00 PM'].map(t => screen.getByRole('button', { name: `Set time to ${t.replace(' ', ' ')}` }));
  expect(chips.map(c => c.dataset.kind)).toEqual(['prominent', 'neutral', 'neutral', 'neutral']);
  expect(chips[0]!.style.color).toBe('rgb(255, 255, 255)');
  expect(chips[1]!.style.color).toBe('rgba(255, 255, 255, 0.75)');
  expect([ptOf(chips[1]!.style.height), ptOf(chips[1]!.style.paddingLeft), ptOf(chips[1]!.style.fontSize)]).toEqual([30, 10, 12]);
  fireEvent.click(chips[2]!);
  expect(core.store.scheduleDraft!.draft).toEqual(new Date('2026-09-19T13:00:00Z'));
});
test('footer: Clear only with a date, Cancel, “Set · Sat 9:00 AM”', async () => {
  const core = await opened();
  renderWithCore(<ScheduleFooter draft={core.store.scheduleDraft!} />, core);
  expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
  const cancel = screen.getByRole('button', { name: 'Cancel' });
  expect([ptOf(cancel.style.height), ptOf(cancel.style.paddingLeft), ptOf(cancel.style.borderRadius), cancel.style.color]).toEqual([36, 16, 12, 'rgba(255, 255, 255, 0.85)']);
  const set = screen.getByRole('button', { name: /^Set, / }) as HTMLButtonElement;
  expect(plainSpaces(set.textContent!)).toContain('Set · Sat 9:00 AM');
  expect([ptOf(set.style.paddingLeft), set.style.fontWeight, set.style.color, set.dataset.kind]).toEqual([18, '600', 'rgb(255, 255, 255)', 'prominent']);
  act(() => core.controller.setScheduleText('tomorrow please', 'user'));
  expect(set.disabled).toBe(true);
  act(() => core.controller.setScheduleText('', 'user'));
  fireEvent.click(set);
  expect(core.store.getState()).toMatchObject({ section: 'none', dueDate: new Date('2026-09-19T07:00:00Z') });
});
test('Clear shows once a date is set and removes it', async () => {
  const core = await opened();
  act(() => core.controller.cancelSchedule('api'));
  act(() => { core.controller.setDueDate(new Date('2026-09-20T07:00:00Z'), null, 'api'); core.controller.openSchedule('api'); });
  renderWithCore(<ScheduleFooter draft={core.store.scheduleDraft!} />, core);
  fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
  expect(core.store.getState()).toMatchObject({ dueDate: null, section: 'none' });
});
test('NumericText re-keys only the glyphs that changed', () => {
  const { container, rerender } = renderWithCore(<NumericText text="Sat 9:00" />);
  const keys = () => [...container.querySelectorAll('[data-char-key]')].map(e => (e as HTMLElement).dataset.charKey);
  expect(keys()).toEqual(['0:S', '1:a', '2:t', '3: ', '4:9', '5::', '6:0', '7:0']);
  rerender(<NumericText text="Sat 3:00" />);
  expect(keys()).toContain('4:3');
  expect(keys().filter(k => k !== '4:9' && k !== '4:3')).toEqual(['0:S', '1:a', '2:t', '3: ', '5::', '6:0', '7:0']);
});
