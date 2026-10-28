// @vitest-environment jsdom
import './setup';
import { render, renderHook, screen, fireEvent, waitFor } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { Motion } from '../../src/recreation/machine/springs';
import { INSTANT, toTransition } from '../../src/recreation/ui/transitions';
import { hoverScaleFor, highlightAlpha, notchFill, notchTextAlpha, dayCellAlpha, HoverButton, NotchFillButton, HoverHighlightButton, KeyHint, usePressTransition, type PressState } from '../../src/recreation/ui/buttons';
import { MotionPrefsProvider } from '../../src/recreation/ui/motionPrefs';
import { ptOf } from './support';
test('HoverMotion values', () => {
  expect([hoverScaleFor('rest', false), hoverScaleFor('hover', false), hoverScaleFor('pressed', false)]).toEqual([1, 1.06, 0.94]);
  expect(hoverScaleFor('hover', true)).toBe(1);
  expect([highlightAlpha('rest'), highlightAlpha('hover'), highlightAlpha('pressed')]).toEqual([0, 0.1, 0.18]);
  expect([notchTextAlpha('rest'), notchTextAlpha('hover'), notchTextAlpha('pressed')]).toEqual([0.6, 0.85, 0.95]);
  expect([dayCellAlpha('hover', false, true), dayCellAlpha('pressed', false, true), dayCellAlpha('hover', true, true), dayCellAlpha('hover', false, false)]).toEqual([0.09, 0.16, 0, 0]);
});
test('NotchFillButtonStyle fills', () => {
  expect(notchFill('neutral', 'rest', true)).toBe('rgba(255, 255, 255, 0.06)');
  expect(notchFill('neutral', 'hover', true)).toBe('rgba(255, 255, 255, 0.11)');
  expect(notchFill('neutral', 'pressed', true)).toBe('rgba(255, 255, 255, 0.15)');
  expect(notchFill('selected', 'rest', true)).toBe('var(--qr-accent-20)');
  expect(notchFill('selected', 'hover', true)).toBe('var(--qr-accent-27)');
  expect(notchFill('selected', 'pressed', true)).toBe('var(--qr-accent-32)');
  expect(notchFill('prominent', 'pressed', true)).toBe('var(--qr-list-accent)');
  expect(notchFill('prominent', 'rest', false)).toBe('var(--qr-gray-circle-disabled)');
});
test('HoverButton scales its label, not its hit frame', async () => {
  render(<HoverButton aria-label="Close" target="close">x</HoverButton>);
  const b = screen.getByRole('button', { name: 'Close' });
  expect(b.dataset.qrTarget).toBe('close');
  fireEvent.pointerEnter(b);
  expect(b.dataset.state).toBe('hover');
  await waitFor(() => expect((b.firstElementChild as HTMLElement).style.transform).toBe('scale(1.06)'));
  expect(b.style.transform).toBe('');
  fireEvent.pointerDown(b);
  await waitFor(() => expect((b.firstElementChild as HTMLElement).style.transform).toBe('scale(0.94)'));
  expect(b.style.cursor).toBe('pointer');
});
test('reduce motion: no scale', async () => {
  render(<MotionPrefsProvider value={{ reduceMotion: true, timeScale: 1 }}><HoverButton aria-label="Save">✓</HoverButton></MotionPrefsProvider>);
  const b = screen.getByRole('button', { name: 'Save' });
  fireEvent.pointerEnter(b);
  await waitFor(() => expect(b.dataset.state).toBe('hover'));
  expect(['', 'none'].includes((b.firstElementChild as HTMLElement).style.transform)).toBe(true);
});
test('NotchFillButton selected draws the accent stroke; disabled dims to 0.55', () => {
  const { rerender } = render(<NotchFillButton kind="selected" radius={12}>Tomorrow</NotchFillButton>);
  const b = screen.getByRole('button', { name: 'Tomorrow' });
  expect(b.style.boxShadow).toBe('inset 0 0 0 calc(1 * var(--pt) * 1px) var(--qr-accent-80)');
  expect(ptOf(b.style.borderRadius)).toBe(12);
  rerender(<NotchFillButton kind="prominent" radius={null} disabled>Set</NotchFillButton>);
  expect(b.style.opacity).toBe('0.55');
  expect(ptOf(b.style.borderRadius)).toBe(999);
  expect(b.style.cursor).toBe('default');
});
test('HoverHighlightButton: circular highlight of its own size', async () => {
  render(<HoverHighlightButton aria-label="Toggle flag" size={38}>f</HoverHighlightButton>);
  const b = screen.getByRole('button', { name: 'Toggle flag' });
  expect(ptOf(b.style.width)).toBe(38);
  const disc = b.querySelector('[data-qr-highlight]') as HTMLElement;
  expect(disc.style.borderRadius).toBe('50%');
  fireEvent.pointerEnter(b);
  await waitFor(() => expect(disc.style.backgroundColor).toBe('rgba(255, 255, 255, 0.1)'));
});
test('KeyHint', () => {
  render(<KeyHint>⏎</KeyHint>);
  const k = screen.getByText('⏎');
  expect(ptOf(k.style.fontSize)).toBe(11);
  expect(k.style.fontWeight).toBe('600');
  expect(k.style.color).toBe('rgba(255, 255, 255, 0.5)');
  expect(k.style.backgroundColor).toBe('rgba(255, 255, 255, 0.1)');
  expect(ptOf(k.style.borderRadius)).toBe(4);
  expect(k.getAttribute('aria-hidden')).toBe('true');
});

test('usePressTransition: press spring when pressed is entered or left, hover motion otherwise (StrictMode)', () => {
  const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;
  const press = toTransition(Motion.press, 1);
  const hover = toTransition(Motion.highlight, 1);
  const { result, rerender } = renderHook(({ s }: { s: PressState }) => usePressTransition(s, Motion.highlight),
    { wrapper, initialProps: { s: 'rest' as PressState } });
  expect(result.current).toEqual(hover);
  rerender({ s: 'hover' });
  expect(result.current).toEqual(hover);
  rerender({ s: 'pressed' });
  expect(result.current).toEqual(press);
  rerender({ s: 'pressed' }); // unrelated re-render keeps the last change's transition
  expect(result.current).toEqual(press);
  rerender({ s: 'hover' });
  expect(result.current).toEqual(press);
  rerender({ s: 'rest' });
  expect(result.current).toEqual(hover);
});
test('usePressTransition: instant under reduce motion', () => {
  const wrapper = ({ children }: { children: ReactNode }) =>
    <MotionPrefsProvider value={{ reduceMotion: true, timeScale: 1 }}>{children}</MotionPrefsProvider>;
  const { result } = renderHook(() => usePressTransition('pressed', Motion.hoverScale), { wrapper });
  expect(result.current).toEqual(INSTANT);
});
