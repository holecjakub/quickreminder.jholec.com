// @vitest-environment jsdom
import './setup';
import { screen, fireEvent } from '@testing-library/react';
import { ScheduleMonthGrid } from '../../src/recreation/ui/ScheduleMonthGrid';
import { renderWithCore, ptOf, TEST_NOW, createTestCore } from './support';
const sep1 = new Date('2026-08-31T22:00:00Z'), sat19 = new Date('2026-09-19T07:00:00Z');
const grid = (p: Partial<Parameters<typeof ScheduleMonthGrid>[0]> = {}, core = createTestCore()) => renderWithCore(
  <ScheduleMonthGrid draft={sat19} month={sep1} now={TEST_NOW} keyboardFocused={false} onPick={vi.fn()} onPage={vi.fn()} {...p} />, core);
test('header, weekdays, six weeks', () => {
  const { container } = grid();
  const title = screen.getByText('September 2026');
  expect([ptOf(title.style.fontSize), title.style.fontWeight, ptOf(title.style.paddingLeft)]).toEqual([13, '600', 4]);
  expect(ptOf((container.querySelector('[data-qr-month-header]') as HTMLElement).style.height)).toBe(26);
  const wd = container.querySelector('[data-qr-weekdays]') as HTMLElement;
  expect(ptOf(wd.style.height)).toBe(18);
  expect([...wd.children].map(c => c.textContent)).toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'S']);
  expect((wd.children[0] as HTMLElement).style.color).toBe('rgba(255, 255, 255, 0.55)');
  const rows = container.querySelectorAll('[data-qr-week]');
  expect(rows).toHaveLength(6);
  expect(ptOf((rows[0] as HTMLElement).style.height)).toBe(28);
  expect(ptOf((container.querySelector('[data-qr-weeks]') as HTMLElement).style.gap)).toBe(2);
  const cells = container.querySelectorAll('[data-qr-cell]');
  expect(cells).toHaveLength(42);
  expect(cells[0]?.textContent).toBe(''); expect(cells[1]?.textContent).toBe(''); expect(cells[2]?.textContent).toBe('1');
  expect(cells[31]?.textContent).toBe('30'); expect(cells[32]?.textContent).toBe('');
});
test('past dimmed and disabled, today in the accent, picked day in the accent disc', () => {
  grid();
  const d17 = screen.getByRole('button', { name: 'Thursday, September 17' }) as HTMLButtonElement;
  expect(d17.disabled).toBe(true);
  expect((d17.querySelector('[data-qr-day-label]') as HTMLElement).style.color).toBe('rgba(255, 255, 255, 0.25)');
  const d18 = screen.getByRole('button', { name: 'Friday, September 18' });
  expect(d18.getAttribute('aria-current')).toBe('date');
  const l18 = d18.querySelector('[data-qr-day-label]') as HTMLElement;
  expect([l18.style.color, l18.style.fontWeight]).toEqual(['var(--qr-list-accent)', '600']);
  const d19 = screen.getByRole('button', { name: 'Saturday, September 19' });
  const l19 = d19.querySelector('[data-qr-day-label]') as HTMLElement;
  expect([l19.style.color, l19.style.fontWeight]).toEqual(['rgb(255, 255, 255)', '600']);
  expect(ptOf((d19.querySelector('[data-qr-day-disc]') as HTMLElement).style.width)).toBe(28);
  const l20 = screen.getByRole('button', { name: 'Sunday, September 20' }).querySelector('[data-qr-day-label]') as HTMLElement;
  expect([l20.style.color, l20.style.fontWeight]).toEqual(['rgba(255, 255, 255, 0.85)', '400']);
});
test('picked-day label follows AccentContrast (orange → black)', () => {
  const core = createTestCore(); core.store.setList('home', 'api');
  grid({}, core);
  const l19 = screen.getByRole('button', { name: 'Saturday, September 19' }).querySelector('[data-qr-day-label]') as HTMLElement;
  expect(l19.style.color).toBe('rgb(0, 0, 0)');
});
test('paging and picking', () => {
  const onPick = vi.fn(), onPage = vi.fn();
  grid({ onPick, onPage });
  const prev = screen.getByRole('button', { name: 'Previous month' }) as HTMLButtonElement;
  expect(prev.disabled).toBe(true);
  expect((prev.querySelector('[data-qr-glyph]') as HTMLElement).style.color).toBe('rgba(255, 255, 255, 0.2)');
  fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
  expect(onPage).toHaveBeenCalledWith(1);
  fireEvent.click(screen.getByRole('button', { name: 'Friday, September 25' }));
  expect(onPick).toHaveBeenCalledWith(new Date('2026-09-24T22:00:00Z'));
});
test('one Tab stop; rings', () => {
  const { container, rerender } = grid({ keyboardFocused: true });
  const root = screen.getByRole('group', { name: 'Calendar, September 2026' });
  expect(root.tabIndex).toBe(0);
  expect([...root.querySelectorAll('button[data-qr-cell]')].every(b => (b as HTMLButtonElement).tabIndex === -1)).toBe(true);
  const ring = screen.getByRole('button', { name: 'Saturday, September 19' }).querySelector('[data-qr-day-ring]') as HTMLElement;
  expect([ptOf(ring.style.inset), ring.style.opacity]).toEqual([-3, '1']);
  expect((container.querySelector('[data-qr-grid-ring]') as HTMLElement).style.opacity).toBe('0');
  rerender(<ScheduleMonthGrid draft={sat19} month={new Date('2026-09-30T22:00:00Z')} now={TEST_NOW} keyboardFocused onPick={vi.fn()} onPage={vi.fn()} />);
  const gridRing = container.querySelector('[data-qr-grid-ring]') as HTMLElement;
  expect([ptOf(gridRing.style.inset), ptOf(gridRing.style.borderRadius), gridRing.style.opacity]).toEqual([-4, 12, '1']);
});
