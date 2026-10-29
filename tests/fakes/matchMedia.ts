type Listener = (event: MediaQueryListEvent) => void;

/** Replaces window.matchMedia with a map-driven fake; unknown queries do not match. */
export function installMatchMedia(matches: Record<string, boolean>): { set(query: string, value: boolean): void } {
  const listeners = new Map<string, Set<Listener>>();

  const listenersFor = (query: string): Set<Listener> => {
    let set = listeners.get(query);
    if (!set) {
      set = new Set();
      listeners.set(query, set);
    }
    return set;
  };

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      get matches() {
        return matches[query] ?? false;
      },
      media: query,
      onchange: null,
      addEventListener: (type: string, listener: Listener) => {
        if (type === 'change') listenersFor(query).add(listener);
      },
      removeEventListener: (type: string, listener: Listener) => {
        if (type === 'change') listenersFor(query).delete(listener);
      },
      addListener: (listener: Listener) => listenersFor(query).add(listener),
      removeListener: (listener: Listener) => listenersFor(query).delete(listener),
      dispatchEvent: () => true,
    }),
  });

  return {
    set(query, value) {
      matches[query] = value;
      for (const listener of listenersFor(query)) {
        listener({ matches: value, media: query } as MediaQueryListEvent);
      }
    },
  };
}
