// @vitest-environment jsdom
import './setup';
import { renderHook } from '@testing-library/react';
import { px } from '../../src/recreation/ui/units';
import { motionTimeScale } from '../../src/recreation/motionScale';
import { toTransition, effective, staggerTransition, INSTANT } from '../../src/recreation/ui/transitions';
import { useReducedMotion } from '../../src/recreation/ui/useReducedMotion';
import { Motion } from '../../src/recreation/machine/springs';
import { ptOf } from './support';
import { setPrefersReducedMotion } from './setup';

type Fields = Record<string, unknown>;

test('px writes points against --pt and ptOf reads them back', () => {
  expect(px(22)).toBe('calc(22 * var(--pt) * 1px)');
  expect(ptOf(px(0.5))).toBe(0.5);
  expect(() => ptOf('22px')).toThrow();
});
test('motionTimeScale reads ?debug=motion', () => {
  expect(motionTimeScale('?debug=motion')).toBe(4);
  expect(motionTimeScale('?debug=layout,motion')).toBe(4);   // comma list (R-07)
  expect(motionTimeScale('?debug=layout')).toBe(1);
  expect(motionTimeScale('?x=1')).toBe(1);
  expect(motionTimeScale('')).toBe(1);
});
test('springs keep their physical constants, scaled by the time scale', () => {
  const open = toTransition(Motion.open, 1) as Fields;
  expect(open.type).toBe('spring');
  expect(open.stiffness).toBeCloseTo(223.80, 2);
  expect(open.damping).toBeCloseTo(23.338, 3);   // 4π·0.78/0.42 = 23.33755 (Task 21 (A21), A-D11)
  expect(open.mass).toBe(1);
  const slow = toTransition(Motion.open, 4) as Fields;
  expect(slow.stiffness).toBeCloseTo(223.80 / 16, 2);
  expect(slow.damping).toBeCloseTo(23.338 / 4, 3);
});
test('easings map to tweens, durations and delays scaled', () => {
  expect(toTransition(Motion.contentIn, 4)).toEqual({ type: 'tween', ease: [0, 0, 0.58, 1], duration: 0.8, delay: 0.64 });
  expect(toTransition(Motion.contentOut, 1)).toEqual({ type: 'tween', ease: [0, 0, 0.58, 1], duration: 0.12 });
});
test('reduce motion swaps the effective animations for easeOut 0.15 without delay', () => {
  for (const n of ['open', 'close', 'schedule', 'contentIn', 'contentOut'] as const)
    expect(effective(n, true, 1)).toEqual({ type: 'tween', ease: [0, 0, 0.58, 1], duration: 0.15 });
  expect((effective('schedule', false, 1) as Fields).stiffness).toBeCloseTo(273.40, 2);
});
test('stagger: easeOut 0.24, delay 0.06 + i·0.035; reduced 0.15', () => {
  const t = staggerTransition(2, false, 1) as Fields;
  expect(t.duration).toBe(0.24);
  expect(t.delay).toBeCloseTo(0.13, 10);
  expect(staggerTransition(3, true, 1)).toEqual({ type: 'tween', ease: [0, 0, 0.58, 1], duration: 0.15 });
  expect(INSTANT).toEqual({ duration: 0 });
});
test('useReducedMotion: override wins, otherwise the media query', () => {
  setPrefersReducedMotion(true);
  expect(renderHook(() => useReducedMotion()).result.current).toBe(true);
  expect(renderHook(() => useReducedMotion(false)).result.current).toBe(false);
  setPrefersReducedMotion(false);
});
