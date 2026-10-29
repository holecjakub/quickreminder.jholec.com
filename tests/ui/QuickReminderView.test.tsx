// @vitest-environment jsdom
import './setup';
import { screen, act, fireEvent } from '@testing-library/react';
import { QuickReminderView } from '../../src/recreation/ui/QuickReminderView';
import { renderWithCore, ptOf, useTestTime, openPanel, createTestCore } from './support';
beforeEach(() => useTestTime());
test('band 39 → 8 → header → 10 → input → slot 26 → 8 → bar → 20; 39 pt side inset', async () => {
  const core = createTestCore(); await openPanel(core);
  const { container } = renderWithCore(<QuickReminderView />, core);
  const root = container.querySelector('[data-qr-panel-content]') as HTMLElement;
  expect([ptOf(root.style.width), ptOf(root.style.height), ptOf(root.style.paddingLeft), ptOf(root.style.paddingRight)]).toEqual([600, 241, 39, 39]);
  expect(ptOf((root.querySelector('[data-qr-band]') as HTMLElement).style.height)).toBe(39);
  const wrap = (sel: string) => container.querySelector(sel)!.closest('[data-qr-stack-item]') as HTMLElement;
  expect(ptOf(wrap('[data-qr-header]').style.marginTop)).toBe(8);
  expect(ptOf(wrap('[data-qr-input-row]').style.marginTop)).toBe(10);
  expect(ptOf(wrap('[data-qr-chip-slot]').style.marginBottom)).toBe(8);
  expect(ptOf(wrap('[data-qr-pill]').style.marginBottom)).toBe(20);
  expect(container.querySelector('[data-qr-section]')).toBeNull();
});
test('Set Date is appended below the bar; the plain panel stays', async () => {
  const core = createTestCore(); await openPanel(core);
  const { container } = renderWithCore(<QuickReminderView />, core);
  act(() => core.controller.openSchedule('user'));
  const root = container.querySelector('[data-qr-panel-content]') as HTMLElement;
  expect(ptOf(root.style.height)).toBe(519);
  const pill = root.querySelector('[data-qr-pill]')!, section = root.querySelector('[data-qr-section]')!;
  expect(pill.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(root.querySelector('[data-qr-chip-slot]')).not.toBeNull();
  act(() => core.controller.openCalendar('user'));
  expect(ptOf(root.style.height)).toBe(751);
});
test('a press on the title row cancels the section, a press on the bar does not', async () => {
  const core = createTestCore(); await openPanel(core);
  const { container } = renderWithCore(<QuickReminderView />, core);
  act(() => core.controller.openSchedule('user'));
  const root = container.querySelector('[data-qr-panel-content]') as HTMLElement;
  root.getBoundingClientRect = () => ({ top: 0, left: 0, width: 600, height: 519, right: 600, bottom: 519, x: 0, y: 0, toJSON() {} });
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Toggle flag' }), { clientY: 197 });
  expect(core.store.getState().section).toBe('controls');
  fireEvent.pointerDown(screen.getByRole('textbox', { name: 'New Reminder' }), { clientY: 105 });
  expect(core.store.getState().section).toBe('none');
});
test('Location is appended below the bar (347 pt); a switch to Set Date swaps the section in one step', async () => {
  const core = createTestCore(); await openPanel(core);
  const { container } = renderWithCore(<QuickReminderView />, core);
  act(() => core.controller.openLocation('user'));
  const root = container.querySelector('[data-qr-panel-content]') as HTMLElement;
  expect(ptOf(root.style.height)).toBe(347);
  const pill = root.querySelector('[data-qr-pill]')!, loc = root.querySelector('[data-qr-section="location"]')!;
  expect(pill.compareDocumentPosition(loc) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.queryByRole('group', { name: 'Set Date' })).toBeNull();
  act(() => core.controller.openSchedule('user'));
  expect(ptOf(root.style.height)).toBe(519);
  expect(screen.getByRole('group', { name: 'Set Date' })).toBeTruthy();
  expect(core.store.getState()).toMatchObject({ section: 'controls', locationField: null });
});
test('no pointer input while closed', () => {
  const { container } = renderWithCore(<QuickReminderView />);
  expect((container.querySelector('[data-qr-panel-content]') as HTMLElement).dataset.interactive).toBe('false');
});
