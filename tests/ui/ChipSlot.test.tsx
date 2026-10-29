// @vitest-environment jsdom
import './setup';
import { act, screen, fireEvent, within } from '@testing-library/react';
import { ChipSlot, chipTransition } from '../../src/recreation/ui/ChipSlot';
import { renderWithCore, ptOf, useTestTime, openPanel } from './support';
import { plainSpaces } from '../support';
beforeEach(() => useTestTime());
test('slot: 26 pt, bottom-left, 31 pt leading inset', () => {
  const { container } = renderWithCore(<ChipSlot />);
  const slot = container.querySelector('[data-qr-chip-slot]') as HTMLElement;
  expect([ptOf(slot.style.height), ptOf(slot.style.paddingLeft), slot.style.alignItems]).toEqual([26, 31, 'flex-end']);
});
test('suggestion chip “Tomorrow, 2:00 PM ⇥”, Tab-free apply and dismiss', () => {
  const { core } = renderWithCore(<ChipSlot />);
  act(() => core.controller.setTitle('Call mum tomorrow at 2pm', 'user'));
  const chip = screen.getByRole('button', { name: 'Use suggested date' });
  expect(plainSpaces(chip.textContent!)).toBe('Tomorrow, 2:00 PM⇥');
  const pill = chip.firstElementChild as HTMLElement;
  expect([ptOf(pill.style.paddingTop), ptOf(pill.style.paddingLeft), pill.style.background, ptOf(pill.style.gap)]).toEqual([5, 10, 'var(--qr-accent-14)', 6]);
  expect(pill.querySelector('[data-sf="calendar.badge.clock@12"]')).not.toBeNull();
  const key = within(chip).getByText('⇥');
  expect([ptOf(key.style.fontSize), key.style.color, ptOf(key.style.borderRadius)]).toEqual([11, 'rgba(255, 255, 255, 0.45)', 4]);
  const dismiss = screen.getByRole('button', { name: 'Dismiss suggestion' });
  expect((dismiss.querySelector('[data-sf="xmark.circle.fill@13"]') as HTMLElement).style.color).toBe('rgba(255, 255, 255, 0.4)');
  fireEvent.click(dismiss);
  expect(core.store.getState().suggestion).toBeNull();
  act(() => core.controller.setTitle('Call dad tomorrow', 'user'));
  fireEvent.click(screen.getByRole('button', { name: 'Use suggested date' }));
  expect(core.store.getState()).toMatchObject({ title: 'Call dad', dueDate: new Date('2026-09-19T07:00:00Z') });
});
test('date chip reopens Set Date; its ⓧ clears the date', async () => {
  const { core } = renderWithCore(<ChipSlot />);
  await openPanel(core);
  act(() => core.controller.setDueDate(new Date('2026-09-19T12:00:00Z'), null, 'user'));
  const chip = screen.getByRole('button', { name: 'Change date' });
  expect(plainSpaces(chip.textContent!)).toBe('Tomorrow, 2:00 PM');
  expect(chip.querySelector('[data-sf="calendar@12"]')).not.toBeNull();
  fireEvent.click(chip);
  expect(core.store.getState().section).toBe('controls');
  act(() => core.controller.cancelSchedule('user'));
  fireEvent.click(screen.getByRole('button', { name: 'Clear date' }));
  expect(core.store.getState().dueDate).toBeNull();
});
test('error line wins the slot', () => {
  const { core } = renderWithCore(<ChipSlot />);
  act(() => core.store.setSaveError('Reminders access denied'));
  const err = screen.getByText('Reminders access denied');
  expect([ptOf(err.style.fontSize), err.style.fontWeight, err.style.color, err.style.whiteSpace]).toEqual([12, '500', 'var(--qr-error-red)', 'nowrap']);
});
test('transitions', () => {
  expect((chipTransition('dueDate', 1) as { stiffness: number }).stiffness).toBeCloseTo(438.65, 2);
  expect(chipTransition('suggestion', 1)).toEqual({ type: 'tween', ease: [0, 0, 0.58, 1], duration: 0.18 });
  expect(chipTransition('dismiss', 1)).toEqual({ type: 'tween', ease: [0, 0, 0.58, 1], duration: 0.15 });
});
