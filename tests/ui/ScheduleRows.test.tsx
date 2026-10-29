// @vitest-environment jsdom
import './setup';
import { screen, fireEvent, within, act } from '@testing-library/react';
import { ScheduleTypeField, SchedulePreview, PresetGrid, fitScale } from '../../src/recreation/ui/ScheduleNotchSection';
import { renderWithCore, ptOf, useTestTime, openPanel, createTestCore } from './support';
import { plainSpaces } from '../support';
beforeEach(() => useTestTime());
async function opened() { const core = createTestCore(); await openPanel(core); act(() => core.controller.openSchedule('api')); return core; }
test('type field', async () => {
  const core = await opened();
  const { container } = renderWithCore(<ScheduleTypeField draft={core.store.scheduleDraft!} />, core);
  const box = container.querySelector('[data-qr-type-field]') as HTMLElement;
  expect([ptOf(box.style.height), ptOf(box.style.paddingLeft), ptOf(box.style.gap), box.style.background, ptOf(box.style.borderRadius)])
    .toEqual([36, 12, 8, 'rgba(255, 255, 255, 0.07)', 12]);
  expect(box.style.boxShadow).toBe('inset 0 0 0 calc(1 * var(--pt) * 1px) rgba(255, 255, 255, 0.08)');
  const field = screen.getByRole('textbox', { name: 'Type a date' }) as HTMLInputElement;
  expect([ptOf(field.style.fontSize), field.placeholder, field.style.getPropertyValue('--qr-ph')]).toEqual([14, 'fri 2pm, zítra 14:00, +2h', 'rgba(255, 255, 255, 0.5)']);
  fireEvent.focus(field);
  expect(box.style.boxShadow).toBe('inset 0 0 0 calc(1 * var(--pt) * 1px) var(--qr-accent-70)');
  fireEvent.change(field, { target: { value: 'tomorrow 2pm' } });
  expect(core.store.scheduleDraft!.draft).toEqual(new Date('2026-09-19T12:00:00Z'));
  expect(screen.getByText('⏎')).toBeTruthy();
  fireEvent.change(field, { target: { value: 'tomorrow please' } });
  expect(screen.queryByText('⏎')).toBeNull();
});
test('preview: date, relative distance, past warning, not a date', async () => {
  const core = await opened();
  const { container } = renderWithCore(<SchedulePreview draft={core.store.scheduleDraft!} />, core);
  const line = container.querySelector('[data-qr-preview]') as HTMLElement;
  expect([ptOf(line.style.height), ptOf(line.style.paddingLeft), ptOf(line.style.fontSize), line.style.fontWeight, ptOf(line.style.gap)]).toEqual([18, 12, 12, '500', 4]);
  expect(line.classList.contains('qr-tabular')).toBe(true);
  // R-03: RelativeDistance prints Foundation's `.abbreviated` form (Task 12, A-D10).
  expect([...line.children].map(c => plainSpaces(c.textContent!))).toEqual(['Saturday, September 19 9:00 AM', '· in 23h']);
  expect((line.children[1] as HTMLElement).style.color).toBe('rgba(255, 255, 255, 0.6)');
  act(() => core.controller.pickDay(new Date('2026-09-17T22:00:00Z'), 'user'));       // today 9:00, an hour ago
  expect(line.querySelector('[data-sf="exclamationmark.triangle.fill@12"]')).not.toBeNull();
  expect(within(line).getByText('In the past').style.color).toBe('var(--qr-flag-orange)');
  expect(plainSpaces(line.lastElementChild!.textContent!)).toBe('· Friday, September 18 9:00 AM');
  act(() => core.controller.setScheduleText('tomorrow please', 'user'));
  expect(line.textContent).toBe('Not a date — try “tomorrow 2pm”');
});
test('six preset cards, one highlighted, one click commits', async () => {
  const core = await opened();
  const { container } = renderWithCore(<PresetGrid draft={core.store.scheduleDraft!} />, core);
  const grid = container.querySelector('[data-qr-presets]') as HTMLElement;
  expect([grid.style.display, grid.style.gridTemplateColumns, ptOf(grid.style.gap)]).toEqual(['grid', 'repeat(3, minmax(0, 1fr))', 8]);
  const cards = within(grid).getAllByRole('button');
  expect(cards.map(c => c.querySelector('[data-qr-preset-title]')!.textContent))
    .toEqual(['In 1 Hour', 'This Evening', 'Tomorrow', 'This Weekend', 'Next Week', 'Next Month']);
  expect(cards.map(c => plainSpaces(c.querySelector('[data-qr-preset-detail]')!.textContent!)))
    .toEqual(['11:00 AM', '7:00 PM', 'Sat 9:00 AM', 'Sat 9:00 AM', 'Mon 9:00 AM', 'Oct 1 9:00 AM']);
  expect(cards.map(c => c.querySelector('[data-qr-preset-key]')!.textContent)).toEqual(['⌘1', '⌘2', '⌘3', '⌘4', '⌘5', '⌘6']);
  expect(cards.map(c => c.querySelector('[data-sf]')!.getAttribute('data-sf')))
    .toEqual(['clock@13', 'moon@13', 'sunrise@13', 'sofa@13', 'calendar.badge.plus@13', 'calendar@13']);
  expect(cards.map(c => c.dataset.kind)).toEqual(['neutral', 'neutral', 'selected', 'neutral', 'neutral', 'neutral']);   // Tomorrow before This Weekend on the same minute
  expect([ptOf(cards[0]!.style.height), ptOf(cards[0]!.style.paddingLeft), ptOf(cards[0]!.style.borderRadius)]).toEqual([44, 10, 12]);
  expect(plainSpaces(cards[2]!.getAttribute('aria-label')!)).toBe('Tomorrow, Saturday 9:00 AM, Command 3');
  fireEvent.click(cards[4]!);
  expect(core.store.getState()).toMatchObject({ dueDate: new Date('2026-09-21T07:00:00Z'), presetPick: { preset: 'nextWeek' }, section: 'none' });
});
test('minimumScaleFactor 0.75', () => {
  expect(fitScale(121.667, 100)).toBe(1);
  expect(fitScale(121.667, 140)).toBeCloseTo(0.869, 3);
  expect(fitScale(50, 140)).toBe(0.75);
  expect(fitScale(100, 0)).toBe(1);
});
