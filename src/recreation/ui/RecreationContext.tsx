// The core (store, runtime, controller, focus registry) for the recreation's components, with the
// motion preferences; the hooks read the store through `useSyncExternalStore`, so every snapshot
// the store hands out is stable between mutations.
import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import type { RecreationCore } from '../controller';
import type { ScheduleDraft } from '../core/scheduleDraft';
import type { PanelView, RecreationState } from '../store';
import { MotionPrefsProvider } from './motionPrefs';

const CoreContext = createContext<RecreationCore | null>(null);

export function RecreationProvider(props: {
  core: RecreationCore;
  reduceMotion: boolean;
  timeScale: number;
  children: ReactNode;
}): JSX.Element {
  const { core, reduceMotion, timeScale, children } = props;
  const prefs = useMemo(() => ({ reduceMotion, timeScale }), [reduceMotion, timeScale]);
  return (
    <CoreContext.Provider value={core}>
      <MotionPrefsProvider value={prefs}>{children}</MotionPrefsProvider>
    </CoreContext.Provider>
  );
}

export function useCore(): RecreationCore {
  const core = useContext(CoreContext);
  if (!core) throw new Error('useCore: no RecreationProvider above this component');
  return core;
}

function useSubscribe(): (listener: () => void) => () => void {
  const { store } = useCore();
  return useMemo(() => (listener: () => void) => store.subscribe(listener), [store]);
}

export function useRecreationState(): RecreationState {
  const { store } = useCore();
  return useSyncExternalStore(useSubscribe(), () => store.getState(), () => store.getState());
}

export function usePanel(): PanelView {
  const { store } = useCore();
  return useSyncExternalStore(useSubscribe(), () => store.getPanel(), () => store.getPanel());
}

/** The open Set Date draft (null while the section is not shown); re-renders on every `scheduleVersion` bump. */
export function useScheduleDraft(): ScheduleDraft | null {
  const { store } = useCore();
  useSyncExternalStore(useSubscribe(), () => store.scheduleVersion, () => store.scheduleVersion);
  return store.scheduleDraft;
}
