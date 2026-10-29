// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MENU_BAR, MenuBar } from '../../src/desktop/MenuBar';
import { formatMenuBarClock, msUntilNextMinute } from '../../src/desktop/MenuBarClock';
import { plainSpaces, prague } from '../support';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderBar(overrides: { clock?: () => Date; onShowPanel?: () => void; scheme?: 'light' | 'dark' } = {}) {
  const t = prague(2026, 10, 23, 10, 0);
  return render(
    <MenuBar
      scheme={overrides.scheme ?? 'light'}
      clock={overrides.clock ?? (() => t)}
      locale="en-US"
      timeZone="Europe/Prague"
      onShowPanel={overrides.onShowPanel ?? (() => {})}
    />,
  );
}
const el = (selector: string) => document.querySelector(selector) as HTMLElement;
const iconButton = () => screen.getByRole('button', { name: 'QuickReminder menu' });

describe('formatMenuBarClock', () => {
  it('en-US', () => expect(formatMenuBarClock(prague(2026, 10, 23, 10, 0), 'en-US', 'Europe/Prague')).toBe('Fri Oct 23 10:00 AM'));
  it('cs-CZ', () =>
    expect(plainSpaces(formatMenuBarClock(prague(2026, 10, 23, 14, 5), 'cs-CZ', 'Europe/Prague'))).toBe('pá 23. 10. 14:05'));
});

describe('msUntilNextMinute', () => {
  it('half a second before the minute', () => expect(msUntilNextMinute(new Date(2026, 9, 23, 10, 0, 59, 500))).toBe(500));
  it('on the minute waits a full minute', () => expect(msUntilNextMinute(new Date(2026, 9, 23, 10, 0, 0, 0))).toBe(60000));
});

describe('<MenuBar>', () => {
  it('pins the layout constants', () => {
    expect(MENU_BAR).toEqual({
      appName: 'Notes',
      menus: ['File', 'Edit', 'Format', 'View', 'Window', 'Help'],
      fontSize: 13,
      leftInset: 20,
      itemGap: 20,
      rightInset: 16,
      statusGap: 18,
      iconSize: 16,
    });
  });

  it('is 38 pt tall and draws its background in two segments around the notch', () => {
    renderBar();
    expect(el('[data-menubar]').style.height).toBe('calc(38 * var(--pt) * 1px)');
    const left = el('[data-menubar-bg="left"]');
    const right = el('[data-menubar-bg="right"]');
    expect(left.style.left).toBe('0px');
    expect(left.style.width).toBe('calc(645.5 * var(--pt) * 1px)');
    expect(right.style.left).toBe('calc(866.5 * var(--pt) * 1px)');
    expect(right.style.right).toBe('0px');
    expect(left.style.background).toBe('rgba(255, 255, 255, 0.28)');
  });

  it('uses the dark background and text colours in dark mode', () => {
    renderBar({ scheme: 'dark' });
    expect(el('[data-menubar-bg="left"]').style.background).toBe('rgba(0, 0, 0, 0.22)');
    expect(el('[data-menubar]').style.color).toBe('rgba(255, 255, 255, 0.92)');
  });

  it('draws the hardware notch: 221 × 38 pt black, centred at x 756', () => {
    renderBar();
    const notch = el('[data-hardware-notch]');
    expect(notch.style.width).toBe('calc(221 * var(--pt) * 1px)');
    expect(notch.style.height).toBe('calc(38 * var(--pt) * 1px)');
    expect(notch.style.left).toBe('calc(645.5 * var(--pt) * 1px)');
    expect(notch.style.backgroundColor).toBe('rgb(0, 0, 0)');
    expect(notch.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows an Apple-free app name and menus', () => {
    renderBar();
    expect(screen.getByText('Notes').style.fontWeight).toBe('700');
    for (const name of ['File', 'Edit', 'Format', 'View', 'Window', 'Help']) {
      expect(screen.getByText(name).style.fontWeight).toBe('400');
    }
    expect(el('[data-menubar-left]').getAttribute('aria-hidden')).toBe('true');
    expect(screen.queryByText('Finder')).toBeNull();
  });

  it('shows the clock and ticks on the minute', () => {
    let t = prague(2026, 10, 23, 10, 0);
    renderBar({ clock: () => t });
    expect(el('[data-menubar-clock]').textContent).toBe('Fri Oct 23 10:00 AM');
    t = prague(2026, 10, 23, 10, 1);
    act(() => vi.advanceTimersByTime(60000));
    expect(el('[data-menubar-clock]').textContent).toBe('Fri Oct 23 10:01 AM');
    t = prague(2026, 10, 23, 10, 2);
    act(() => vi.advanceTimersByTime(60000));
    expect(el('[data-menubar-clock]').textContent).toBe('Fri Oct 23 10:02 AM');
  });

  it('the QuickReminder icon opens its menu; "Show Quick Reminder" calls onShowPanel', () => {
    const onShowPanel = vi.fn();
    renderBar({ onShowPanel });
    const button = iconButton();
    expect(button.getAttribute('aria-haspopup')).toBe('menu');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const menu = screen.getByRole('menu');
    expect(menu.style.top).toBe('calc(34 * var(--pt) * 1px)');
    expect(menu.style.minWidth).toBe('calc(220 * var(--pt) * 1px)');
    expect(menu.style.right).toBe('0px');

    fireEvent.click(screen.getByRole('menuitem', { name: 'Show Quick Reminder' }));
    expect(onShowPanel).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('lists the app menu in code order with disabled Settings… and Quit', () => {
    const onShowPanel = vi.fn();
    renderBar({ onShowPanel });
    fireEvent.click(iconButton());
    const menu = screen.getByRole('menu');
    const rows = Array.from(menu.children).map((c) => c.getAttribute('role'));
    expect(rows).toEqual(['menuitem', 'menuitem', 'separator', 'menuitem']);
    for (const name of ['Settings…', 'Quit']) {
      const item = screen.getByRole('menuitem', { name });
      expect(item.getAttribute('aria-disabled')).toBe('true');
      expect(item.textContent).toContain('In the app');
      fireEvent.click(item);
    }
    expect(onShowPanel).not.toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('focuses the first item on open', () => {
    renderBar();
    fireEvent.click(iconButton());
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Show Quick Reminder' }));
  });

  it('Esc closes the menu and returns focus to the icon, with preventDefault', () => {
    renderBar();
    fireEvent.click(iconButton());
    const outer = vi.fn();
    document.addEventListener('keydown', outer);
    const notCancelled = fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    document.removeEventListener('keydown', outer);
    expect(notCancelled).toBe(false);
    expect(outer).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(iconButton());
  });

  it('a press outside closes the menu; clicking the icon again toggles it', () => {
    renderBar();
    fireEvent.click(iconButton());
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(iconButton());
    fireEvent.click(iconButton());
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
