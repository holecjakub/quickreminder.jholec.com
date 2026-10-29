// @vitest-environment jsdom
import './setup';
import { act, screen, fireEvent } from '@testing-library/react';
import { InputView, flattenLineBreaks } from '../../src/recreation/ui/InputView';
import { renderWithCore, ptOf } from './support';
test('dotted circle: 21 pt, 1.5 pt round dots of 0.1 every 3.2, #59595D', () => {
  const { container } = renderWithCore(<InputView />);
  const svg = container.querySelector('[data-qr-dashed-circle]') as SVGSVGElement;
  expect(ptOf(svg.style.width)).toBe(21);
  expect(ptOf(svg.style.marginTop)).toBe(2);
  const c = svg.querySelector('circle')!;
  expect([c.getAttribute('cx'), c.getAttribute('cy'), c.getAttribute('r')]).toEqual(['10.5', '10.5', '10.5']);
  expect(c.getAttribute('stroke-width')).toBe('1.5');
  expect(c.getAttribute('stroke-dasharray')).toBe('0.1 3.2');
  expect(c.getAttribute('stroke-linecap')).toBe('round');
  expect(c.getAttribute('stroke')).toBe('var(--qr-dashed-ring)');
});
test('title and notes rows', () => {
  renderWithCore(<InputView />);
  const title = screen.getByRole('textbox', { name: 'New Reminder' }) as HTMLInputElement;
  const notes = screen.getByRole('textbox', { name: 'Notes' }) as HTMLInputElement;
  expect([ptOf(title.style.fontSize), ptOf(title.style.height), title.maxLength]).toEqual([19, 25, 2000]);
  expect([ptOf(notes.style.fontSize), ptOf(notes.style.height), notes.maxLength]).toEqual([15, 20, 10000]);
  expect(title.placeholder).toBe('New Reminder');
  expect(title.style.fontWeight).toBe('400');
  expect(title.style.caretColor).toBe('var(--qr-list-accent)');
  expect(title.style.getPropertyValue('--qr-ph')).toBe('var(--qr-placeholder)');
  expect(title.dataset.qrField).toBe('title');
  expect(title.getAttribute('spellcheck')).toBe('false');
  const row = title.closest('[data-qr-input-row]') as HTMLElement;
  expect(ptOf(row.style.gap)).toBe(10);
  expect(ptOf((title.closest('[data-qr-input-column]') as HTMLElement).style.gap)).toBe(1);
});
test('typing writes the title as a user edit', () => {
  const { core } = renderWithCore(<InputView />);
  fireEvent.change(screen.getByRole('textbox', { name: 'New Reminder' }), { target: { value: 'Buy milk' } });
  expect(core.store.getState()).toMatchObject({ title: 'Buy milk', dirty: true });
});
test('pasted line breaks become spaces; the paste is clipped to the cap', () => {
  expect(flattenLineBreaks('a\nb\r\nc d')).toBe('a b c d');
  expect(flattenLineBreaks('a\vb\fc\u0085d\u2028e\u2029f')).toBe('a b c d e f');
  const { core } = renderWithCore(<InputView />);
  const title = screen.getByRole('textbox', { name: 'New Reminder' }) as HTMLInputElement;
  fireEvent.paste(title, { clipboardData: { getData: () => 'a\nb\r\nc' } });
  expect(core.store.getState().title).toBe('a b c');
  act(() => core.controller.setTitle('x'.repeat(1998), 'user'));
  title.setSelectionRange(1998, 1998);
  fireEvent.paste(title, { clipboardData: { getData: () => 'abcd' } });
  expect(core.store.getState().title).toBe('x'.repeat(1998) + 'ab');
});
test('focus by registry puts the caret at the end', () => {
  const { core } = renderWithCore(<InputView />);
  act(() => core.controller.setTitle('Call mum', 'api'));
  expect(core.focus.focus('title')).toBe(true);
  const title = screen.getByRole('textbox', { name: 'New Reminder' }) as HTMLInputElement;
  expect(document.activeElement).toBe(title);
  expect(title.selectionStart).toBe(8);
});
