// @vitest-environment jsdom
import './setup';
import { act, screen, fireEvent } from '@testing-library/react';
import { BottomBar } from '../../src/recreation/ui/BottomBar';
import { renderWithCore, ptOf, useTestTime, openPanel } from './support';
beforeEach(() => useTestTime());
test('pill: 44 pt capsule, 3 % fill, 1 pt #3D3D3F stroke, 18 pt icons in 38 pt hits, 55 pt centre spacing', () => {
  const { container } = renderWithCore(<BottomBar />);
  const pill = container.querySelector('[data-qr-pill]') as HTMLElement;
  expect([ptOf(pill.style.height), ptOf(pill.style.paddingLeft), ptOf(pill.style.gap), pill.style.background])
    .toEqual([44, 11, 17, 'var(--qr-pill-fill)']);
  expect(pill.style.boxShadow).toBe('inset 0 0 0 calc(1 * var(--pt) * 1px) var(--qr-pill-stroke)');
  const names = ['Set date and time', 'Add location', 'Toggle flag'];
  for (const n of names) expect(ptOf(screen.getByRole('button', { name: n }).style.width)).toBe(38);
  expect(screen.getByRole('button', { name: 'Set date and time' }).querySelector('[data-sf="calendar.badge.clock@18"]')).not.toBeNull();
  expect(screen.getByRole('button', { name: 'Add location' }).querySelector('[data-sf="location@18"]')).not.toBeNull();
  expect(screen.getByRole('button', { name: 'Toggle flag' }).querySelector('[data-sf="flag@18"]')).not.toBeNull();
  expect(ptOf((container.querySelector('[data-qr-bar-spacer]') as HTMLElement).style.minWidth)).toBe(16);
});
test('✓: 48 pt, #474749 until there is a title, then the accent', () => {
  const { core } = renderWithCore(<BottomBar />);
  const save = screen.getByRole('button', { name: 'Save reminder' }) as HTMLButtonElement;
  const disc = save.querySelector('[data-qr-save-disc]') as HTMLElement;
  expect(ptOf(disc.style.width)).toBe(48);
  expect(save.disabled).toBe(true);
  expect(disc.dataset.fill).toBe('var(--qr-gray-circle-disabled)');
  expect(save.querySelector('[data-sf="checkmark@22"]')).not.toBeNull();
  act(() => core.controller.setTitle('Buy milk', 'user'));
  expect(save.disabled).toBe(false);
  expect(disc.dataset.fill).toBe('var(--qr-list-accent)');
  expect(save.title).toBe('Save reminder');
});
test('flag toggles to the orange filled flag', () => {
  const { core } = renderWithCore(<BottomBar />);
  const flag = screen.getByRole('button', { name: 'Toggle flag' });
  fireEvent.click(flag);
  expect(core.store.getState().flagged).toBe(true);
  expect(flag.getAttribute('aria-pressed')).toBe('true');
  const glyph = flag.querySelector('[data-sf="flag.fill@18"]') as HTMLElement;
  expect(glyph.closest('[data-qr-glyph]')!.getAttribute('style')).toContain('color: var(--qr-flag-orange)');
});
test('a location fills the pin in the accent and names it', () => {
  const { core } = renderWithCore(<BottomBar />);
  act(() => core.controller.setLocation('Office', 'user'));
  const loc = screen.getByRole('button', { name: 'Location, Office' });
  expect(loc.querySelector('[data-sf="location.fill@18"]')).not.toBeNull();
  expect(loc.querySelector('[data-qr-glyph]')!.getAttribute('style')).toContain('color: var(--qr-list-accent)');
});
test('calendar icon toggles Set Date and shows it is open', async () => {
  const { core } = renderWithCore(<BottomBar />);
  await openPanel(core);
  const cal = screen.getByRole('button', { name: 'Set date and time' });
  fireEvent.click(cal);
  expect(core.store.getState().section).toBe('controls');
  expect(cal.getAttribute('aria-pressed')).toBe('true');
  const disc = cal.querySelector('[data-qr-open-disc]') as HTMLElement;
  expect([ptOf(disc.style.inset)]).toEqual([3]);
  expect(screen.getByRole('button', { name: 'Save reminder' }).title).toBe('Applies the date in Set Date, then saves');
  fireEvent.click(cal);
  expect(core.store.getState().section).toBe('none');
});
test('location icon toggles the in-notch Location section and shows it is open', async () => {
  const { core } = renderWithCore(<BottomBar />);
  await openPanel(core);
  const loc = screen.getByRole('button', { name: 'Add location' });
  fireEvent.click(loc);
  expect(core.store.getState().section).toBe('location');
  expect([loc.getAttribute('aria-pressed'), loc.getAttribute('aria-description')]).toEqual(['true', 'Hides Location']);
  expect(loc.querySelector('[data-qr-glyph]')!.getAttribute('style')).toContain('color: var(--qr-list-accent)');   // active while shown
  expect(loc.querySelector('[data-sf="location@18"]')).not.toBeNull();                                            // still no location
  expect(ptOf((loc.querySelector('[data-qr-open-disc]') as HTMLElement).style.inset)).toBe(3);
  expect(screen.getByRole('button', { name: 'Save reminder' }).title).toBe('Applies the location, then saves');
  fireEvent.click(loc);
  expect(core.store.getState().section).toBe('none');
  expect([loc.getAttribute('aria-pressed'), loc.getAttribute('aria-description')]).toEqual(['false', 'Shows Location below']);
});
test('the ✓ yields its slot to the flying badge', async () => {
  const { core, container } = renderWithCore(<BottomBar />);
  await openPanel(core);
  act(() => core.controller.setTitle('Buy milk', 'user'));
  fireEvent.click(screen.getByRole('button', { name: 'Save reminder' }));
  expect(screen.queryByRole('button', { name: 'Save reminder' })).toBeNull();
  expect(ptOf((container.querySelector('[data-qr-save-slot]') as HTMLElement).style.width)).toBe(48);
});
