// The fake 14" MacBook Pro desktop (contracts §4.1, landing spec §6): wallpaper, menu bar, hint, the
// recreation in the notch slot, the fake Reminders window and the demo cursor, plus the focus handling
// and keyboard routing that make the shortcuts work only while focus is inside the scene.
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type JSX,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import {
  AppClock,
  Recreation,
  currentCalendar,
  type Calendar,
  type Clock,
  type NotchPhase,
  type NotchSection,
  type RecreationHandle,
  type RecreationState,
  type SavedReminder,
} from '../recreation';
import { focusTargetOf, performShortcut, shortcutFor } from './desktopShortcuts';
import { FakeCursor } from './FakeCursor.tsx';
import type { FakeCursorHandle } from './fakeCursor';
import { MenuBar } from './MenuBar';
import { NotchHint } from './NotchHint';
import { RemindersWindow } from './RemindersWindow';
import { SCENE, ptCss } from './scene';
import { useColorScheme, useMediaQuery } from './useMediaQuery';
import { Wallpaper } from './Wallpaper';

export { SCENE } from './scene';

export interface DesktopSceneProps {
  recreationRef: RefObject<RecreationHandle | null>;
  cursorRef?: RefObject<FakeCursorHandle | null>;
  pt: number;
  colorScheme?: 'light' | 'dark' | 'auto';
  clock?: Clock;
  calendar?: Calendar;
  locale?: string;
  reduceMotion?: boolean;
  hintEnabled?: boolean;
  onSaved?(item: SavedReminder): void;
  className?: string;
  /** `?debug=motion` scale, passed in by the Stage (cross-area note 4). */
  timeScale?: number;
}

/** The slice of RecreationState the desktop renders from. */
interface SceneView {
  readonly phase: NotchPhase['type'];
  readonly section: NotchSection;
  readonly openedOnce: boolean;
  readonly savedItems: readonly SavedReminder[];
}

const INITIAL_VIEW: SceneView = { phase: 'closed', section: 'none', openedOnce: false, savedItems: [] };

/** The faint fake cursor until the first open (landing §6), then hidden while idle. */
const CURSOR_IDLE_OPACITY = 0.4;

const FOCUSABLE = 'input, textarea, select, button, a[href], [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

function swallowAbort(promise: Promise<unknown> | undefined): void {
  promise?.catch((error: unknown) => {
    if (!(error instanceof DOMException && error.name === 'AbortError')) throw error;
  });
}

export function DesktopScene({
  recreationRef,
  cursorRef,
  pt,
  colorScheme = 'auto',
  clock = AppClock.now,
  calendar,
  locale = 'en-US',
  reduceMotion,
  hintEnabled,
  onSaved,
  className,
  timeScale = 1,
}: DesktopSceneProps): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const ownCursorRef = useRef<FakeCursorHandle>(null);
  // React 18's `ref` prop wants RefObject<T>; the contract's RefObject<T | null> holds the same values.
  const cursor = (cursorRef ?? ownCursorRef) as RefObject<FakeCursorHandle>;
  const recreation = recreationRef as RefObject<RecreationHandle>;

  const scheme = useColorScheme(colorScheme);
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const reduced = reduceMotion ?? prefersReducedMotion;
  const sceneCalendar = useMemo(() => calendar ?? currentCalendar(), [calendar]);

  const [focusInside, setFocusInsideState] = useState(false);
  // Read by the phase effect without re-running it when focus moves.
  const focusInsideRef = useRef(false);
  const setFocusInside = (inside: boolean) => {
    focusInsideRef.current = inside;
    setFocusInsideState(inside);
  };
  const [view, setView] = useState<SceneView>(INITIAL_VIEW);

  const onStateChange = useCallback((state: RecreationState) => {
    setView((prev) =>
      prev.phase === state.phase.type &&
      prev.section === state.section &&
      prev.openedOnce === state.openedOnce &&
      prev.savedItems === state.savedItems
        ? prev
        : { phase: state.phase.type, section: state.section, openedOnce: state.openedOnce, savedItems: state.savedItems },
    );
  }, []);

  const focusDesktop = useCallback(() => rootRef.current?.focus({ preventScroll: true }), []);
  const showPanel = useCallback(() => swallowAbort(recreationRef.current?.show({ source: 'click' })), [recreationRef]);

  // The panel closed while the visitor's focus was in it: hand focus back to the desktop.
  useEffect(() => {
    if (view.phase !== 'closed' || !focusInsideRef.current) return;
    const active = document.activeElement;
    if (active === document.body || (active !== null && slotRef.current?.contains(active))) focusDesktop();
  }, [view.phase, focusDesktop]);

  const onPointerDownCapture = (e: PointerEvent<HTMLDivElement>) => {
    const focusable = (e.target as Element).closest(FOCUSABLE);
    if (!focusable || !rootRef.current?.contains(focusable)) focusDesktop();
  };

  const onBlurCapture = (e: FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as Node | null;
    if (!next || !rootRef.current?.contains(next)) setFocusInside(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const handle = recreationRef.current;
    if (e.defaultPrevented || !handle) return;
    const active = document.activeElement;
    const action = shortcutFor(e, { state: handle.getState(), focus: focusTargetOf(active) });
    if (!action) return;
    e.preventDefault();
    performShortcut(action, handle, { typed: (active as HTMLInputElement | null)?.value });
  };

  return (
    <div
      ref={rootRef}
      role="application"
      aria-label="QuickReminder demo desktop"
      tabIndex={-1}
      data-qr-screen=""
      data-phase={view.phase}
      data-section={view.section}
      data-scheme={scheme}
      className={className}
      onPointerDownCapture={onPointerDownCapture}
      onFocusCapture={() => setFocusInside(true)}
      onBlurCapture={onBlurCapture}
      onKeyDown={onKeyDown}
      onPointerEnter={() => cursor.current?.hide()}
      onPointerLeave={() => cursor.current?.show()}
      style={{
        '--pt': String(pt),
        width: ptCss(SCENE.width),
        height: ptCss(SCENE.height),
        position: 'relative',
        overflow: 'hidden',
        borderRadius: `${ptCss(10)} ${ptCss(10)} ${ptCss(6)} ${ptCss(6)}`,
        userSelect: 'none',
        outline: 'none',
      } as CSSProperties}
    >
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <Wallpaper scheme={scheme} />
      </div>
      <RemindersWindow items={view.savedItems} scheme={scheme} pt={pt} reduceMotion={reduced} timeScale={timeScale} />
      <div style={{ position: 'relative', zIndex: 20 }}>
        <MenuBar
          scheme={scheme}
          clock={clock}
          locale={navigator.language}
          timeZone={sceneCalendar.timeZone}
          onShowPanel={showPanel}
        />
      </div>
      <NotchHint
        visible={hintEnabled !== false && !view.openedOnce}
        scheme={scheme}
        reduceMotion={reduced}
        timeScale={timeScale}
        onOpen={showPanel}
      />
      <div
        ref={slotRef}
        data-desktop-slot="notch"
        // The Recreation places its own canvas at `notchOrigin` (Recreation.tsx), so the slot sits at
        // the screen origin; offsetting it too would move the notch to 2 × notchOrigin.x (merge fix R-15).
        style={{ position: 'absolute', left: 0, top: 0, zIndex: 30 }}
      >
        <Recreation
          ref={recreation}
          notch={SCENE.notch}
          screenHeight={SCENE.height}
          dockHeight={0}
          clock={clock}
          calendar={sceneCalendar}
          locale={locale}
          reduceMotion={reduced}
          cursor={cursor}
          shortcutsEnabled={focusInside}
          sceneScale={pt}
          notchOrigin={SCENE.notchOrigin}
          onSaved={onSaved}
          onStateChange={onStateChange}
        />
      </div>
      <FakeCursor ref={cursor} idleOpacity={view.openedOnce ? 0 : CURSOR_IDLE_OPACITY} timeScale={timeScale} reduceMotion={reduced} />
    </div>
  );
}
