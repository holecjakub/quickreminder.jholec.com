/**
 * The `?debug=` time scale: 4 when the comma-separated `debug` list names `motion`
 * (`?debug=motion`, `?debug=layout,motion`), otherwise 1. Slows every animation and timer.
 */
export function motionTimeScale(search: string = typeof window === 'undefined' ? '' : window.location.search): 1 | 4 {
  const flags = new URLSearchParams(search).getAll('debug').flatMap((value) => value.split(','));
  return flags.some((flag) => flag.trim() === 'motion') ? 4 : 1;
}
