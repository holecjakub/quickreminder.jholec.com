import { createContext, useContext, type ReactNode } from 'react';

export interface MotionPrefs {
  readonly reduceMotion: boolean;
  readonly timeScale: number;
}

const MotionPrefsContext = createContext<MotionPrefs>({ reduceMotion: false, timeScale: 1 });

export function MotionPrefsProvider(props: { value: MotionPrefs; children: ReactNode }): JSX.Element {
  return <MotionPrefsContext.Provider value={props.value}>{props.children}</MotionPrefsContext.Provider>;
}

/** Reduce motion and the `?debug=motion` time scale; `{ reduceMotion: false, timeScale: 1 }` outside a provider. */
export function useMotionPrefs(): MotionPrefs {
  return useContext(MotionPrefsContext);
}
