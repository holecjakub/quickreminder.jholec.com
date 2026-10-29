import { motionTimeScale } from '../recreation/motionScale';

/** Read once at module load; the `?debug=` grammar is the recreation's own (R-07). */
export const MOTION_TIME_SCALE: 1 | 4 = motionTimeScale();

export function scaleMs(ms: number, timeScale: number = MOTION_TIME_SCALE): number {
  return ms * timeScale;
}

export function applyGsapTimeScale(
  target: { globalTimeline: { timeScale(v: number): unknown } },
): void {
  target.globalTimeline.timeScale(1 / MOTION_TIME_SCALE);
}
