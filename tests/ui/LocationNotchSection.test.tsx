// @vitest-environment jsdom
import './setup';
import { screen, fireEvent, act } from '@testing-library/react';
import { LocationNotchSection, doneLabel } from '../../src/recreation/ui/LocationNotchSection';
import { renderWithCore, ptOf, useTestTime, openPanel, createTestCore } from './support';
beforeEach(() => useTestTime());
test('field + Clear · Cancel · Done in the LocationMetrics rhythm (36 + 14 + 36, inset 20)', async () => {
  const core = createTestCore(); await openPanel(core);
  act(() => core.controller.openLocation('user'));
  const { container } = renderWithCore(<LocationNotchSection />, core);
  const section = screen.getByRole('group', { name: 'Location' });
  expect([section.dataset.qrSection, ptOf(section.style.paddingBottom)]).toEqual(['location', 20]);
  const box = container.querySelector('[data-qr-location-field]') as HTMLElement;
  expect([ptOf(box.style.height), ptOf(box.style.paddingLeft), ptOf(box.style.gap), ptOf(box.style.borderRadius)]).toEqual([36, 12, 8, 12]);
  expect(box.querySelector('[data-sf="location@12"]')).not.toBeNull();
  expect((screen.getByRole('textbox', { name: 'Location' }) as HTMLInputElement).placeholder).toBe('Enter location');
  const footer = container.querySelector('[data-qr-footer]') as HTMLElement;
  expect([ptOf((footer.closest('[data-qr-row]') as HTMLElement).style.marginTop), ptOf(footer.style.height), ptOf(footer.style.gap)]).toEqual([14, 36, 8]);
  expect([...container.querySelectorAll('[data-qr-row]')].map(r => (r as HTMLElement).dataset.stagger)).toEqual(['0', '1']);
  expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();                 // no location yet
  const cancel = screen.getByRole('button', { name: 'Cancel' }), done = screen.getByRole('button', { name: 'Done, no location' });
  expect([ptOf(cancel.style.height), ptOf(cancel.style.paddingLeft), ptOf(done.style.height), ptOf(done.style.paddingLeft)]).toEqual([36, 16, 36, 18]);
  expect(done.style.color).toBe('rgb(255, 255, 255)');                                 // AccentContrast.label('#0A84FF') = '#FFFFFF'
});
test('typing stays in the field until Done; a visitor open focuses the field', async () => {
  const core = createTestCore(); await openPanel(core);
  renderWithCore(<LocationNotchSection />, core);                                     // renders nothing until the section opens
  act(() => core.controller.openLocation('user'));
  await act(async () => { vi.advanceTimersByTime(0); });
  const field = screen.getByRole('textbox', { name: 'Location' });
  expect(document.activeElement).toBe(field);
  fireEvent.change(field, { target: { value: 'Office' } });
  expect(core.store.getState()).toMatchObject({ location: null, locationField: 'Office', dirty: false });
  fireEvent.click(screen.getByRole('button', { name: 'Done, Office' }));
  expect(core.store.getState()).toMatchObject({ location: 'Office', section: 'none', locationField: null, dirty: true });
});
test('Cancel leaves the location; Clear (shown only with a location) removes it; Done turns black on a light list colour', async () => {
  const core = createTestCore(); await openPanel(core);
  act(() => { core.controller.setList('home', 'user'); core.controller.setLocation('Office', 'user'); core.controller.openLocation('api'); });
  renderWithCore(<LocationNotchSection />, core);
  expect(document.activeElement).not.toBe(screen.getByRole('textbox', { name: 'Location' }));   // an API open never takes focus
  expect(screen.getByRole('button', { name: 'Done, Office' }).style.color).toBe('rgb(0, 0, 0)');  // '#000000' on #FF9F0A
  fireEvent.change(screen.getByRole('textbox', { name: 'Location' }), { target: { value: 'Home' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(core.store.getState()).toMatchObject({ location: 'Office', section: 'none' });
  act(() => core.controller.openLocation('user'));
  fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
  expect(core.store.getState()).toMatchObject({ location: null, section: 'none' });
});
test('doneLabel (Done accessibilityLabel)', () => {
  expect(doneLabel('')).toBe('Done, no location');
  expect(doneLabel('Office')).toBe('Done, Office');
});
