/** `?debug=motion` (alone or in a comma list such as `debug=layout,motion`) slows every animation and timer 4x. */
export function motionTimeScale(search: string): 1 | 4 {
  const flags = new URLSearchParams(search).get('debug')?.split(',') ?? [];
  return flags.includes('motion') ? 4 : 1;
}

/** Read once at module load. */
export const MOTION_TIME_SCALE: 1 | 4 = motionTimeScale(
  typeof window === 'undefined' ? '' : window.location.search,
);

export function scaleMs(ms: number, timeScale: number = MOTION_TIME_SCALE): number {
  return ms * timeScale;
}

export function applyGsapTimeScale(
  target: { globalTimeline: { timeScale(v: number): unknown } },
): void {
  target.globalTimeline.timeScale(1 / MOTION_TIME_SCALE);
}
