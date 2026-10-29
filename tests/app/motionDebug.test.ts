import { describe, it, expect, vi } from 'vitest';
import { motionTimeScale, scaleMs, applyGsapTimeScale } from '../../src/app/motionDebug';

describe('motionTimeScale', () => {
  it('is 4 for ?debug=motion', () => expect(motionTimeScale('?debug=motion')).toBe(4));
  it('is 4 when motion is one of several debug flags', () => expect(motionTimeScale('?now=2026-10-23T10:00&debug=layout,motion')).toBe(4));
  it('is 1 without the flag', () => expect(motionTimeScale('')).toBe(1));
  it('is 1 for another debug value', () => expect(motionTimeScale('?debug=layout')).toBe(1));
});
describe('scaleMs', () => {
  it('multiplies by the given scale', () => expect(scaleMs(900, 4)).toBe(3600));
  it('is identity at scale 1', () => expect(scaleMs(2500, 1)).toBe(2500));
});
describe('applyGsapTimeScale', () => {
  it('sets the global timeline to 1 / scale', () => {
    const timeScale = vi.fn();
    applyGsapTimeScale({ globalTimeline: { timeScale } });
    expect(timeScale).toHaveBeenCalledWith(1); // jsdom URL has no ?debug=motion
  });
});
