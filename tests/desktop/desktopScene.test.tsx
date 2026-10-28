// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { DesktopScene, type DesktopSceneProps } from '../../src/desktop/DesktopScene';
import type { RecreationHandle } from '../../src/recreation';
import { lastRecreation } from '../fakes/recreationMock';
import { installMatchMedia } from '../fakes/matchMedia';
import { prague, pragueCalendar } from '../support';

vi.mock('../../src/recreation', () => import('../fakes/recreationMock'));

const NOW = prague(2026, 10, 23, 10, 0);

beforeEach(() => {
  vi.useFakeTimers();
  installMatchMedia({});
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function setup(props?: Partial<DesktopSceneProps>) {
  const recreationRef = createRef<RecreationHandle>();
  render(<DesktopScene recreationRef={recreationRef} pt={0.5} clock={() => NOW} calendar={pragueCalendar} {...props} />);
  return {
    recreationRef,
    root: screen.getByRole('application', { name: 'QuickReminder demo desktop' }),
    fake: lastRecreation.handle!,
  };
}

async function openPanel(fake: RecreationHandle) {
  await act(async () => {
    void fake.show({ source: 'click' });
  });
}

it('is a 1512 × 982 pt scene scaled by --pt', () => {
  const { root } = setup();
  expect(root.style.getPropertyValue('--pt')).toBe('0.5');
  expect(root.style.width).toBe('calc(1512 * var(--pt) * 1px)');
  expect(root.style.height).toBe('calc(982 * var(--pt) * 1px)');
  expect(root.tabIndex).toBe(-1);
  expect(root.hasAttribute('data-qr-screen')).toBe(true);
});

it('hosts the recreation with the 14" notch geometry', () => {
  const { recreationRef, fake } = setup();
  expect(lastRecreation.props).toMatchObject({
    notch: { width: 221, height: 38 },
    screenHeight: 982,
    dockHeight: 0,
    notchOrigin: { x: 756, y: 0 },
    sceneScale: 0.5,
    locale: 'en-US',
    shortcutsEnabled: false,
  });
  expect(recreationRef.current).toBe(fake);
});

it('pointerdown on the wallpaper focuses the desktop and enables shortcuts', () => {
  const { root } = setup();
  fireEvent.pointerDown(root.querySelector('[data-wallpaper]')!);
  expect(document.activeElement).toBe(root);
  expect(lastRecreation.props!.shortcutsEnabled).toBe(true);
});

it('routes ⌘D to openSchedule while focus is inside', async () => {
  const { root, fake } = setup();
  await openPanel(fake);
  root.focus();
  const ev = fireEvent.keyDown(root, { key: 'd', code: 'KeyD', metaKey: true });
  expect(ev).toBe(false);
  expect(fake.methods()).toContain('openSchedule');
});

it('ignores keys another handler already prevented', async () => {
  const { root, fake } = setup();
  await openPanel(fake);
  const input = root.querySelector<HTMLInputElement>('[data-qr-root] input')!;
  input.addEventListener('keydown', (e) => e.preventDefault());
  input.focus();
  fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });
  expect(fake.methods()).not.toContain('escape');
});

it('does nothing for keys without a shortcut (browser keeps them)', async () => {
  const { root, fake } = setup();
  await openPanel(fake);
  root.focus();
  expect(fireEvent.keyDown(root, { key: 'c', code: 'KeyC', metaKey: true })).toBe(true);
});

it('mirrors phase and section on the root', async () => {
  const { root, fake } = setup();
  expect(root.dataset.phase).toBe('closed');
  expect(root.dataset.section).toBe('none');
  await openPanel(fake);
  expect(root.dataset.phase).toBe('open');
  act(() => fake.openSchedule());
  expect(root.dataset.section).toBe('controls');
});

it('the hint shows until the first open, then fades', async () => {
  const { fake } = setup();
  expect(screen.getByRole('button', { name: 'Click the notch to add a reminder' })).toBeTruthy();
  await openPanel(fake);
  act(() => vi.advanceTimersByTime(400));
  expect(screen.queryByRole('button', { name: 'Click the notch to add a reminder' })).toBeNull();
});

it('the menu-bar menu opens the panel with the click source', () => {
  const { fake } = setup();
  fireEvent.click(screen.getByRole('button', { name: 'QuickReminder menu' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Show Quick Reminder' }));
  expect(fake.calls).toContainEqual({ method: 'show', args: [{ source: 'click' }] });
});

it('mounts the Reminders window on the first saved item', async () => {
  const onSaved = vi.fn();
  const { fake } = setup({ onSaved });
  await openPanel(fake);
  expect(screen.queryByRole('region', { name: 'Your reminders' })).toBeNull();
  act(() => fake.setTitle('Call mum'));
  act(() => {
    void fake.save();
  });
  await act(() => vi.advanceTimersByTimeAsync(320));
  const window = screen.getByRole('region', { name: 'Your reminders' });
  expect(window.textContent).toContain('Call mum');
  expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ title: 'Call mum' }));
});

it('returns focus to the desktop when the panel closes with focus inside it', async () => {
  const { root, fake } = setup();
  await openPanel(fake);
  const input = root.querySelector<HTMLInputElement>('[data-qr-root] input')!;
  input.focus();
  expect(document.activeElement).toBe(input);
  act(() => {
    void fake.hide();
  });
  act(() => vi.advanceTimersByTime(360));
  expect(document.activeElement).toBe(root);
});

it('colorScheme "dark" sets data-scheme', () => {
  const { root } = setup({ colorScheme: 'dark' });
  expect(root.dataset.scheme).toBe('dark');
});
