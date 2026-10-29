import { useCallback, useSyncExternalStore } from 'react';

/** Live `matchMedia(query).matches`; false when matchMedia is missing (SSR, old test envs). */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  const getSnapshot = useCallback(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
    [query],
  );
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/** Resolves a colour-scheme preference; 'auto' follows `prefers-color-scheme: dark`. */
export function useColorScheme(pref: 'light' | 'dark' | 'auto'): 'light' | 'dark' {
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  if (pref === 'auto') return prefersDark ? 'dark' : 'light';
  return pref;
}
