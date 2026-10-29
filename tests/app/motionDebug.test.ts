import { describe, it, expect, vi } from 'vitest';
import { MOTION_TIME_SCALE, scaleMs, applyGsapTimeScale } from '../../src/app/motionDebug';
import { motionTimeScale } from '../../src/recreation/motionScale';

describe('MOTION_TIME_SCALE', () => {
  it('comes from the recreation parser (one ?debug= grammar, R-07)', () => expect(MOTION_TIME_SCALE).toBe(motionTimeScale()));
  it('the shared parser reads motion inside a comma list', () => expect(motionTimeScale('?now=2026-10-23T10:00&debug=layout,motion')).toBe(4));
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
