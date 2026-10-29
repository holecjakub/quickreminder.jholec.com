// @vitest-environment jsdom
import './setup';
import { screen, fireEvent, within } from '@testing-library/react';
import { HeaderView } from '../../src/recreation/ui/HeaderView';
import { ListPickerMenu } from '../../src/recreation/ui/ListPickerMenu';
import { renderWithCore, ptOf, useTestTime, openPanel } from './support';
test('“Reminders ▾” in the accent, 22 bold, chevron 7 pt to the right', () => {
  const { container } = renderWithCore(<HeaderView />);
  const button = screen.getByRole('button', { name: 'Choose list' });
  const label = within(button).getByText('Reminders');
  expect([ptOf(label.style.fontSize), label.style.fontWeight, label.style.color]).toEqual([22, '700', 'var(--qr-list-accent)']);
  expect(ptOf((label.parentElement as HTMLElement).style.gap)).toBe(7);
  const chevron = button.querySelector('[data-sf="chevron.down@13"]') as HTMLElement;
  expect(chevron.style.transform).toBe('translateY(calc(0.5 * var(--pt) * 1px))');
  expect(ptOf((container.querySelector('[data-qr-header-spacer]') as HTMLElement).style.minWidth)).toBe(12);
});
test('ⓧ: 24 pt #59595D circle, 11 pt bold x, 36 pt hit area', async () => {
  useTestTime();
  const { core } = renderWithCore(<HeaderView />);
  await openPanel(core);
  const close = screen.getByRole('button', { name: 'Close' });
  expect([ptOf(close.style.width), ptOf(close.style.height)]).toEqual([36, 36]);
  const circle = close.querySelector('[data-qr-close-circle]') as HTMLElement;
  expect([ptOf(circle.style.width), circle.style.background]).toEqual([24, 'var(--qr-gray-circle)']);
  expect(circle.querySelector('[data-sf="xmark@11"]')).not.toBeNull();
  fireEvent.click(close);
  expect(core.store.getState().phase).toEqual({ type: 'closing' });
});
test('the picker lists the five lists and recolours on pick', () => {
  const { core } = renderWithCore(<><HeaderView /><ListPickerMenu /></>);
  fireEvent.click(screen.getByRole('button', { name: 'Choose list' }));
  const menu = screen.getByRole('menu', { name: 'Lists' });
  expect([ptOf(menu.style.left), ptOf(menu.style.top), ptOf(menu.style.minWidth), ptOf(menu.style.borderRadius)]).toEqual([63, 91, 200, 12]);
  expect(menu.style.border).toBe('calc(1 * var(--pt) * 1px) solid var(--qr-pill-stroke)');
  const rows = within(menu).getAllByRole('menuitemradio');
  expect(rows.map(r => r.textContent)).toEqual(['Reminders', 'Work', 'Home', 'Groceries', 'Ideas']);
  expect(rows.map(r => (r.querySelector('[data-qr-dot]') as HTMLElement).style.background))
    .toEqual(['rgb(10, 132, 255)', 'rgb(191, 90, 242)', 'rgb(255, 159, 10)', 'rgb(48, 209, 88)', 'rgb(255, 55, 95)']);   // FAKE_LISTS, as jsdom normalises hex
  expect(rows[0]!.getAttribute('aria-checked')).toBe('true');
  expect(rows[0]!.querySelector('[data-sf="checkmark@13"]')).not.toBeNull();
  expect(rows[1]!.querySelector('[data-sf="checkmark@13"]')).toBeNull();
  const heading = within(menu).getByText('Lists');
  expect([ptOf(heading.style.fontSize), heading.style.fontWeight, heading.style.color]).toEqual([13, '600', 'rgba(255, 255, 255, 0.5)']);
  fireEvent.click(rows[1]!);
  expect(core.store.getState()).toMatchObject({ listId: 'work', listPickerOpen: false, accent: '#BF5AF2' });
  expect(screen.queryByRole('menu')).toBeNull();
  expect(within(screen.getByRole('button', { name: 'Choose list' })).getByText('Work')).toBeTruthy();
});
