import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void): () => void {
  const list = window.matchMedia(QUERY);
  list.addEventListener('change', onChange);
  return () => list.removeEventListener('change', onChange);
}

const prefersReducedMotion = (): boolean => window.matchMedia(QUERY).matches;
const serverSnapshot = (): boolean => false;

/** `override` wins; otherwise the live `prefers-reduced-motion: reduce` media query. */
export function useReducedMotion(override?: boolean): boolean {
  const prefers = useSyncExternalStore(subscribe, prefersReducedMotion, serverSnapshot);
  return override ?? prefers;
}
