// @vitest-environment jsdom
import './setup';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { screen, act, fireEvent, waitFor } from '@testing-library/react';
import { NotchContainer, canvasFor, contentTransition, badgeOrigin } from '../../src/recreation/ui/NotchContainer';
import { translatedNotchPath } from '../../src/recreation/ui/NotchSilhouette';
import { renderWithCore, ptOf, useTestTime, openPanel, createTestCore } from './support';
beforeEach(() => useTestTime());
const adv = (ms: number) => act(async () => { vi.advanceTimersByTime(ms); });
test('pure parts', () => {
  const core = createTestCore();
  expect(canvasFor(core.sizes)).toEqual({ width: 648, height: 775 });
  expect(badgeOrigin(core.sizes, 648)).toEqual({ left: 459.5, top: 7.5 });
  expect(contentTransition('open', false, 1)).toEqual({ type: 'tween', ease: [0, 0, 0.58, 1], duration: 0.2, delay: 0.16 });
  expect(contentTransition('close', false, 1)).toEqual({ type: 'tween', ease: [0, 0, 0.58, 1], duration: 0.12 });
  expect(contentTransition('saving', false, 1)).toEqual({ type: 'tween', ease: [0, 0, 0.58, 1], duration: 0.12 });
  expect(contentTransition('open', true, 1)).toEqual({ type: 'tween', ease: [0, 0, 0.58, 1], duration: 0.15 });
});
test('closed: the notch silhouette only; content hidden and inert', () => {
  const { container } = renderWithCore(<NotchContainer />);
  const canvas = container.querySelector('[data-qr-canvas]') as HTMLElement;
  expect([ptOf(canvas.style.width), ptOf(canvas.style.height)]).toEqual([648, 775]);
  expect(container.querySelector('path[data-qr-target="notch"]')!.getAttribute('d')).toBe(translatedNotchPath({ width: 235, height: 39, top: 6, bottom: 14 }, 648));
  const content = container.querySelector('[data-qr-content]') as HTMLElement;
  expect(content.getAttribute('aria-hidden')).toBe('true');
  expect(content.hasAttribute('inert')).toBe(true);
  expect([ptOf(content.style.left), ptOf(content.style.width), ptOf(content.style.height)]).toEqual([24, 600, 241]);
});
test('open: 600 × 241 with open radii, content in, mask until settled', async () => {
  const core = createTestCore();
  const { container } = renderWithCore(<NotchContainer />, core);
  act(() => { core.controller.show('api', false); });
  await adv(100);
  const content = container.querySelector('[data-qr-content]') as HTMLElement;
  await waitFor(() => expect(container.querySelector('path')!.getAttribute('d')).toBe(translatedNotchPath({ width: 600, height: 241, top: 19, bottom: 32 }, 648)));
  expect(content.style.clipPath.startsWith('path("M0 0 Q19 0 19 19 ')).toBe(true);
  await waitFor(() => expect(content.style.opacity).toBe('1'));
  expect(content.getAttribute('aria-hidden')).toBeNull();
  await adv(400);
  expect(content.style.clipPath).toBe('none');
});
test('saving: the badge sits in the right extension of the 379 pt pill', async () => {
  const core = createTestCore();
  const { container } = renderWithCore(<NotchContainer />, core);
  await openPanel(core);
  act(() => core.controller.setTitle('Buy milk', 'user'));
  act(() => { core.controller.save('user'); });
  await waitFor(() => expect(container.querySelector('path')!.getAttribute('d')).toBe(translatedNotchPath({ width: 379, height: 39, top: 6, bottom: 14 }, 648)));
  const slot = container.querySelector('[data-qr-badge-slot]') as HTMLElement;
  expect([ptOf(slot.style.left), ptOf(slot.style.top)]).toEqual([459.5, 7.5]);
  expect(screen.getByRole('img', { name: 'Saved' })).toBeTruthy();
  await adv(1360);
  expect(container.querySelector('[data-qr-badge-slot]')).toBeNull();
});
test('click outside closes; a press on the black does not; outside a popover closes just the popover', async () => {
  const core = createTestCore();
  renderWithCore(<div data-qr-screen><NotchContainer /><button>Desktop</button></div>, core);
  await openPanel(core);
  fireEvent.pointerDown(document.querySelector('path[data-qr-target="notch"]')!);
  expect(core.store.getState().phase).toEqual({ type: 'open' });
  act(() => core.controller.openListPicker());
  fireEvent.pointerDown(screen.getByRole('textbox', { name: 'New Reminder' }));
  expect(core.store.getState()).toMatchObject({ listPickerOpen: false, phase: { type: 'open' } });
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Desktop' }));
  expect(core.store.getState().phase).toEqual({ type: 'closing' });
});
test('reduce motion: no blur and no scale on the content', () => {
  const { container } = renderWithCore(<NotchContainer />, undefined, { reduceMotion: true });
  const content = container.querySelector('[data-qr-content]') as HTMLElement;
  expect(content.style.filter).toBe('blur(calc(0 * var(--pt) * 1px))');
  expect(['', 'none'].includes(content.style.transform)).toBe(true);
});
test('review focus: closed notch hit layer is at least 44 × 44 CSS px and opens on press', async () => {
  const { container, core } = renderWithCore(<NotchContainer />);
  const hit = container.querySelector('[data-qr-target="notchHit"]') as HTMLElement;
  expect(ptOf(hit.style.getPropertyValue('--qr-hit-w'))).toBe(235);
  expect(ptOf(hit.style.getPropertyValue('--qr-hit-h'))).toBe(39);
  // Not `new URL('…', import.meta.url)`: Vite rewrites that literal form into a served asset URL.
  expect(readFileSync(join(import.meta.dirname, '../../src/recreation/ui/recreation.css'), 'utf8'))
    .toMatch(/\.qr-notch-hit\s*\{[^}]*width:\s*max\(var\(--qr-hit-w\),\s*44px\)[^}]*height:\s*max\(var\(--qr-hit-h\),\s*44px\)/);
  expect(hit.style.pointerEvents).toBe('auto');
  fireEvent.pointerDown(hit);
  await adv(500);
  expect(core.runtime.machine.phase).toEqual({ type: 'open' });
  expect(hit.style.pointerEvents).toBe('none');
});
test('fix round 1: the hit layer and the path are one hover region; crossing between them keeps the swell', async () => {
  const { container, core } = renderWithCore(<NotchContainer />);
  const hit = container.querySelector('[data-qr-target="notchHit"]') as HTMLElement;
  const path = container.querySelector('path[data-qr-target="notch"]') as SVGPathElement;
  const swollen = translatedNotchPath({ width: 257, height: 44, top: 6, bottom: 14 }, 648);
  fireEvent.pointerEnter(hit);
  await adv(100);
  expect(core.runtime.machine).toMatchObject({ hoverSwollen: true, hoverDwellPending: false });
  await waitFor(() => expect(path.getAttribute('d')).toBe(swollen));
  const dispatch = vi.spyOn(core.runtime, 'dispatch');
  // Out of the 235 × 39 rectangle onto the swollen silhouette: React delivers the leave on the hit
  // layer and the matching enter on the path from this one event; neither is a hover change.
  fireEvent.pointerLeave(hit, { relatedTarget: path });
  expect(dispatch).not.toHaveBeenCalled();
  // And back from the silhouette into the rectangle.
  fireEvent.pointerLeave(path, { relatedTarget: hit });
  expect(dispatch).not.toHaveBeenCalled();
  expect(core.runtime.machine).toMatchObject({ hoverSwollen: true, hoverDwellPending: false });
  await adv(300);
  expect(path.getAttribute('d')).toBe(swollen);
  // Leaving the region altogether still un-swells.
  fireEvent.pointerLeave(hit);
  expect(dispatch).toHaveBeenCalledTimes(1);
  expect(dispatch).toHaveBeenCalledWith({ type: 'hoverExited' });
  expect(core.runtime.machine.hoverSwollen).toBe(false);
});
