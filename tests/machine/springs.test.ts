import { describe, expect, it } from 'vitest';
import { EASE_IN_OUT, EASE_OUT, Motion, scaled, springFromDurationBounce, springFromResponse } from '../../src/recreation/machine/springs';

describe('springs', () => {
  it.each([
    ['open', 223.801, 23.338], ['close', 438.649, 38.537], ['hoverIn', 385.531, 21.598], ['hoverOut', 438.649, 35.605],
    ['saving', 194.955, 22.899], ['schedule', 273.396, 26.456], ['chip', 438.649, 33.51], ['flag', 631.655, 35.186],
    ['badgeBounce', 503.551, 20.196], ['badgeSettle', 438.649, 29.322], ['hoverScale', 815.67, 50.265], ['press', 2014.205, 89.76],
  ] as const)('%s → stiffness %f, damping %f', (key, stiffness, damping) => {
    const s = Motion[key];
    expect(s.type).toBe('spring');
    expect(s.mass).toBe(1);
    expect(s.stiffness).toBeCloseTo(stiffness, 3);
    expect(s.damping).toBeCloseTo(damping, 3);
  });
  it('durationBounceIsResponseAndOneMinusBounce', () => {
    const a = springFromDurationBounce(0.22, 0.12), b = springFromResponse(0.22, 0.88);
    expect(a.stiffness).toBeCloseTo(b.stiffness, 9);
    expect(a.damping).toBeCloseTo(b.damping, 9);
  });
  it('debugMotionSlowsBy4', () => {
    const s = scaled(Motion.open, 4);
    expect(s.stiffness).toBeCloseTo(223.801 / 16, 3);
    expect(s.damping).toBeCloseTo(23.338 / 4, 3);
  });
  it('easings', () => {
    expect(EASE_OUT).toEqual([0, 0, 0.58, 1]);
    expect(EASE_IN_OUT).toEqual([0.42, 0, 0.58, 1]);
    expect(Motion.contentIn).toEqual({ type: 'tween', ease: EASE_OUT, duration: 0.2, delay: 0.16 });
    expect(Motion.contentOut).toEqual({ type: 'tween', ease: EASE_OUT, duration: 0.12 });
    expect(Motion.reduced).toEqual({ type: 'tween', ease: EASE_OUT, duration: 0.15 });
    expect(Motion.canSave).toEqual({ type: 'tween', ease: EASE_IN_OUT, duration: 0.18 });
    expect(Motion.tickTrim).toEqual({ type: 'tween', ease: EASE_OUT, duration: 0.28, delay: 0.32 });
    expect(Motion.badgeFade).toEqual({ type: 'tween', ease: EASE_OUT, duration: 0.16 });
    expect(Motion.dismiss).toEqual({ type: 'tween', ease: EASE_OUT, duration: 0.15 });
    expect(Motion.stagger(2).delay).toBeCloseTo(0.13, 10);
    expect(Motion.stagger(0)).toEqual({ type: 'tween', ease: EASE_OUT, duration: 0.24, delay: 0.06 });
  });
});
