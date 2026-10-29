// The recreation's React entry (contracts §3.2 / §3.3): one `<div data-qr-root>` placed with its
// canvas' top centre on the notch's origin, the core created once from the props, and the
// imperative `RecreationHandle` the page's choreography drives it with. Every handle method goes
// through the controller with origin 'api' (never `dirty`); typing runs are browser timers that
// `cancel()` aborts; pointer targets are reported in scene points whatever the Stage's scale.
import {
  forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState,
  type CSSProperties, type RefObject,
} from 'react';
import { AppClock, type Clock } from './clock';
import { createRecreationCore, type EscapeResult, type RecreationCore, type ShowSource } from './controller';
import { components, currentCalendar, dateFrom, type Calendar } from './core/calendar';
import type { DatePreset, PresetPick } from './core/datePresets';
import type { ListId } from './core/lists';
import type { LocationDraft } from './core/locationDraft';
import type { SavedReminder } from './core/reminder';
import type { ScheduleDraft } from './core/scheduleDraft';
import { isSchedule, type NotchMachineSnapshot } from './machine/notchMachine';
import type { Size } from './machine/notchShape';
import { motionTimeScale } from './motionScale';
import type { RecreationState } from './store';
import type { FocusRegistry } from './ui/focus';
import { useRecreationKeys } from './ui/keyboard';
import { NotchContainer, canvasFor } from './ui/NotchContainer';
import { RecreationProvider } from './ui/RecreationContext';
import { px } from './ui/units';
import { useReducedMotion } from './ui/useReducedMotion';

export type { ShowSource, EscapeResult };

/** Scene points: origin at the top-left of the 1512 × 982 pt screen. */
export interface ScenePoint {
  readonly x: number;
  readonly y: number;
}

/** A named control of the recreation (`data-qr-target`), for `pointFor` / `pointerTo`. */
export type PointerTarget =
  | 'notch' | 'close' | 'header' | 'title' | 'notes' | 'suggestionChip' | 'suggestionDismiss' | 'dateChip'
  | 'calendarIcon' | 'locationIcon' | 'flagIcon' | 'save'
  | `list:${ListId}` | 'locationField' | 'locationDone' | 'locationClear' | 'locationCancel'
  | `preset:${DatePreset}` | 'scheduleField' | 'dayButton' | 'timeField' | `timeChip:${9 | 12 | 15 | 19}`
  | 'calendarPrev' | 'calendarNext' | `day:${number}` /* day of month in the visible grid */
  | 'clear' | 'cancel' | 'set';

/** What the recreation needs of the desktop's fake cursor (a structural subset of `FakeCursorHandle`). */
export interface CursorLike {
  moveTo(point: ScenePoint, opts?: { durationMs?: number }): Promise<void>;
  click(): Promise<void>;
  cancel(): void;
}

/** Landing spec §7 (02): the demo types at 18 characters per second. */
export const DEFAULT_TYPING_CPS = 18;

/**
 * Every method is synchronous in effect and returns a Promise only where the caller waits for the
 * choreography. Promises reject with `DOMException('AbortError')` when `cancel()` runs; delays
 * honour the `?debug=motion` time scale. Methods never throw for an out-of-phase call: they are
 * no-ops exactly where the Swift machine returns `[]`.
 */
export interface RecreationHandle {
  // Panel
  /** NotchEvent show (notchTapped for 'click'). The title is focused for 'click' | 'hotkey' or
   *  `focus: true`; 'scroll' never focuses (landing spec §5.3). Resolves after the settle timer (0.5 s). */
  show(opts?: { source?: ShowSource; focus?: boolean }): Promise<void>;
  /** NotchEvent hide. Resolves after closeDuration (0.36 s). */
  hide(): Promise<void>;
  /** Esc, one level per press: list picker → calendar → section (closed without writing) → panel (B-D2). */
  escape(): EscapeResult;
  /** ⌘↩ / the API. While a section is open it means Set / Done and resolves null. Otherwise an
   *  undismissed suggestion is applied, the reminder is built, the item lands when the badge has
   *  (0.32 s) and the promise resolves after hold + close (1.0 + 0.36 s). null when !canSave. */
  save(): Promise<SavedReminder | null>;

  // Title / notes
  setTitle(text: string): void;
  /** Types character by character at `cps` through the same path as keyboard input (the suggestion
   *  updates per character). `append` false (default) clears the title first. */
  typeTitle(text: string, cps?: number, opts?: { append?: boolean }): Promise<void>;
  setNotes(text: string): void;
  focusTitle(): void;
  focusNotes(): void;

  // Suggestion chip
  applySuggestion(): boolean;
  dismissSuggestion(): void;

  // Set Date (in the notch)
  /** ⌘D / calendar icon / date chip: `sectionChanged(controls)` through `switchSection`; no-op when already open. */
  openSchedule(): void;
  /** ⌘K: opens the section when needed, then 'calendar'. */
  openCalendar(): void;
  closeCalendar(): void;
  toggleCalendar(): void;
  /** Cancel / click above the section: 'none', nothing written. */
  cancelSchedule(): void;
  /** Set / ↩ / ⌘↩: `ScheduleDraft.set()`; false = the typed text is not a date (beep, stays open). */
  commitSchedule(): boolean;
  /** ⌘1…⌘6 / a card: commits and closes the section. */
  applyPreset(preset: DatePreset): void;
  clearDueDate(): void;
  /** Instant, no section (the reconciler). */
  setDueDate(date: Date | null, presetPick?: PresetPick | null): void;
  /** Opens the section when it is closed, then types into the type field. */
  typeScheduleText(text: string, cps?: number): Promise<void>;
  setScheduleText(text: string): void;
  pickDay(day: Date): void;
  setTime(hour: number, minute?: number): void;
  pageMonth(delta: -1 | 1): void;
  moveDay(days: -7 | -1 | 1 | 7): void;
  /** The live draft while the section is open (null otherwise). */
  scheduleDraft(): ScheduleDraft | null;

  // List picker
  openListPicker(): void;
  closeListPicker(): void;
  setList(id: ListId): void;

  // Flag / location (the in-notch Location section, B-D3)
  toggleFlag(): void;
  setFlag(flagged: boolean): void;
  /** The location button when Location is not shown: `switchSection('location')`, keeps Set Date's edit. */
  openLocation(): void;
  /** The location button: open, or close without writing. */
  toggleLocation(): void;
  /** Cancel / Esc / click above: closes, nothing written. */
  cancelLocation(): void;
  /** Done / ↩ / ⌘↩: writes the field as typed ('' → null), closes. */
  commitLocation(): void;
  /** Clear: location null, closes. */
  clearLocation(): void;
  /** The open section's field (the location is untouched until Done / ✓ / a switch). */
  setLocationText(text: string): void;
  /** Instant, no section (the reconciler); "" → null; the icon switches to the filled pin when non-null. */
  setLocation(text: string | null): void;
  /** Opens the Location section, types into the field, then Done. */
  typeLocation(text: string, cps?: number): Promise<void>;
  /** The open section's draft (null otherwise). */
  locationDraft(): LocationDraft | null;

  // Hover (closed notch)
  hoverNotch(entered: boolean): void;

  // Fake cursor (delegates to the cursor passed in props; no-ops when none)
  setPointer(x: number, y: number, opts?: { duration?: number }): Promise<void>;
  /** Centre of a named control in scene points, or null when it is not rendered. */
  pointFor(target: PointerTarget): ScenePoint | null;
  /** Moves the cursor to the target and, with `click`, clicks and performs the target's action. false = no point. */
  pointerTo(target: PointerTarget, opts?: { duration?: number; click?: boolean }): Promise<boolean>;

  // Observation / control
  getState(): RecreationState;
  subscribe(listener: (state: RecreationState) => void): () => void;
  /** Clears `dirty` (the reconciler calls it after its own changes). */
  markClean(): void;
  /** Aborts typing runs (their Promises reject with AbortError) and the cursor's move. */
  cancel(): void;
  /** Back to the initial state: closed, empty draft, default list; saved items kept unless `keepSaved: false`. */
  reset(opts?: { keepSaved?: boolean }): void;
  /** The machine snapshot (tests). */
  machine(): NotchMachineSnapshot;
}

export interface RecreationProps {
  /** Notch geometry of the hosting screen (the desktop passes { width: 221, height: 38 }). */
  notch: Size;
  /** Fake screen height in points (982) and Dock height (0): `NotchLayout.maxPanelHeight`. */
  screenHeight: number;
  dockHeight?: number;
  /** Default `AppClock.now`. */
  clock?: Clock;
  /** Default `currentCalendar()`. */
  calendar?: Calendar;
  /** Formatter locale, default "en-US". */
  locale?: string;
  /** Default: the locale's. */
  hour12?: boolean;
  /** Default: `prefers-reduced-motion`. */
  reduceMotion?: boolean;
  cursor?: RefObject<CursorLike | null>;
  /** Called with the SavedReminder when the ✓ lands (0.32 s into the saved choreography). */
  onSaved?(item: SavedReminder): void;
  onStateChange?(state: RecreationState): void;
  /** Keyboard shortcuts are handled only when true (focus inside the desktop, landing spec §11.3). */
  shortcutsEnabled: boolean;
  /** Scene → CSS scale, the fallback when the canvas has no layout yet. */
  sceneScale: number;
  /** Where the notch's top centre sits in scene points (the desktop passes { x: 756, y: 0 }). */
  notchOrigin: ScenePoint;
}

/** The month grid a `day:<n>` target is read in: the store's visible month and the calendar. */
export interface VisibleGrid {
  readonly month: Date;
  readonly calendar: Calendar;
}

/** The part of `target` after `prefix`, or null when it does not start with it. */
const prefixed = (target: string, prefix: string): string | null =>
  target.startsWith(prefix) ? target.slice(prefix.length) : null;

/** What a cursor click on a target does, as the handle call the control's own handler makes
 *  (origin 'api'); null for the fields (pointing at a field never focuses it). `day:<n>` needs
 *  `grid`, the visible month the handle alone does not expose. */
export const TARGET_ACTIONS = (h: RecreationHandle, target: PointerTarget, grid?: VisibleGrid): (() => void) | null => {
  switch (target) {
    case 'notch': return () => void h.show({ source: 'api' });
    case 'close': return () => void h.hide();
    case 'header': return () => (h.getState().listPickerOpen ? h.closeListPicker() : h.openListPicker());
    case 'suggestionChip': return () => void h.applySuggestion();
    case 'suggestionDismiss': return () => h.dismissSuggestion();
    case 'dateChip': return () => h.openSchedule();
    case 'calendarIcon': return () => (isSchedule(h.getState().section) ? h.cancelSchedule() : h.openSchedule());
    case 'locationIcon': return () => h.toggleLocation();
    case 'flagIcon': return () => h.toggleFlag();
    case 'save': return () => void h.save();
    case 'locationDone': return () => h.commitLocation();
    case 'locationCancel': return () => h.cancelLocation();
    case 'locationClear': return () => h.clearLocation();
    case 'dayButton': return () => h.toggleCalendar();
    case 'calendarPrev': return () => h.pageMonth(-1);
    case 'calendarNext': return () => h.pageMonth(1);
    case 'clear': return () => h.clearDueDate();
    case 'cancel': return () => h.cancelSchedule();
    case 'set': return () => void h.commitSchedule();
    case 'title': case 'notes': case 'scheduleField': case 'timeField': case 'locationField': return null;
  }
  const list = prefixed(target, 'list:');
  if (list !== null) return () => h.setList(list as ListId);
  const preset = prefixed(target, 'preset:');
  if (preset !== null) return () => h.applyPreset(preset as DatePreset);
  const hour = prefixed(target, 'timeChip:');
  if (hour !== null) return () => h.setTime(Number(hour));
  const dayOfMonth = prefixed(target, 'day:');
  if (dayOfMonth !== null && grid) {
    const { year, month } = components(grid.calendar, grid.month);
    const day = dateFrom(grid.calendar, { year, month, day: Number(dayOfMonth) });
    return day && (() => h.pickDay(day));
  }
  return null;
};

const abortError = (): DOMException => new DOMException('Aborted', 'AbortError');

/** The typing runs: one character per timer (chained in the callback, so fake timers see every
 *  step), each run with its own `AbortController`; `cancel()` aborts them all. */
class TypingRuns {
  private readonly runs = new Set<AbortController>();

  /** Calls `step` with the text typed so far, by code point, one every `intervalMs` (the first after one interval). */
  type(text: string, intervalMs: number, step: (typed: string) => void): Promise<void> {
    const run = new AbortController();
    this.runs.add(run);
    return new Promise<void>((resolve, reject) => {
      const chars = Array.from(text);
      let typed = '';
      let index = 0;
      let timer = 0;
      const finish = (outcome: () => void) => {
        run.signal.removeEventListener('abort', onAbort);
        this.runs.delete(run);
        outcome();
      };
      const onAbort = () => {
        window.clearTimeout(timer);
        finish(() => reject(abortError()));
      };
      const tick = () => {
        typed += chars[index++]!;
        step(typed);
        if (index < chars.length) timer = window.setTimeout(tick, intervalMs);
        else finish(resolve);
      };
      run.signal.addEventListener('abort', onAbort, { once: true });
      if (chars.length === 0) return finish(resolve);
      timer = window.setTimeout(tick, intervalMs);
    });
  }

  cancel(): void {
    for (const run of this.runs) run.abort();
  }
}

/** `[data-qr-target="…"]` inside `root`; targets never hold a quote or a backslash. */
function targetElement(root: HTMLElement, target: PointerTarget): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[data-qr-target="${target}"]`);
}

interface HandleDeps {
  readonly core: RecreationCore;
  readonly canvas: Size;
  /** The latest props and the mounted root, read when a method runs. */
  readonly props: () => RecreationProps;
  readonly root: () => HTMLDivElement | null;
  readonly timeScale: number;
  readonly typing: TypingRuns;
}

function createHandle(deps: HandleDeps): RecreationHandle {
  const { core, canvas, props, root: rootNow, timeScale, typing } = deps;
  const { controller, store, focus, runtime } = core;
  const cursor = () => props().cursor?.current ?? null;
  const interval = (cps: number) => (1000 / cps) * timeScale;

  const h: RecreationHandle = {
    show: ({ source = 'api', focus: focusTitle } = {}) =>
      controller.show(source, focusTitle ?? (source === 'click' || source === 'hotkey')),
    hide: () => controller.hide(),
    escape: () => controller.escape(),
    save: () => controller.save('api'),

    setTitle: (text) => controller.setTitle(text, 'api'),
    typeTitle: (text, cps = DEFAULT_TYPING_CPS, { append = false } = {}) => {
      if (!append) controller.setTitle('', 'api');
      const base = store.getState().title;
      return typing.type(text, interval(cps), (typed) => controller.setTitle(base + typed, 'api'));
    },
    setNotes: (text) => controller.setNotes(text, 'api'),
    focusTitle: () => void focus.focus('title'),
    focusNotes: () => void focus.focus('notes'),

    applySuggestion: () => controller.applySuggestion('api'),
    dismissSuggestion: () => controller.dismissSuggestion('api'),

    openSchedule: () => controller.openSchedule('api'),
    openCalendar: () => controller.openCalendar('api'),
    closeCalendar: () => controller.closeCalendar('api'),
    toggleCalendar: () => controller.toggleCalendar('api'),
    cancelSchedule: () => controller.cancelSchedule('api'),
    commitSchedule: () => controller.commitSchedule('api'),
    applyPreset: (preset) => controller.applyPreset(preset, 'api'),
    clearDueDate: () => controller.clearDueDate('api'),
    setDueDate: (date, presetPick = null) => controller.setDueDate(date, presetPick, 'api'),
    typeScheduleText: (text, cps = DEFAULT_TYPING_CPS) => {
      if (!isSchedule(store.getState().section)) controller.openSchedule('api');
      return typing.type(text, interval(cps), (typed) => controller.setScheduleText(typed, 'api'));
    },
    setScheduleText: (text) => controller.setScheduleText(text, 'api'),
    pickDay: (day) => controller.pickDay(day, 'api'),
    setTime: (hour, minute = 0) => controller.setTime(hour, minute, 'api'),
    pageMonth: (delta) => controller.pageMonth(delta),
    moveDay: (days) => controller.moveDay(days),
    scheduleDraft: () => store.scheduleDraft,

    openListPicker: () => controller.openListPicker(),
    closeListPicker: () => controller.closeListPicker(),
    setList: (id) => controller.setList(id, 'api'),

    toggleFlag: () => controller.toggleFlag('api'),
    setFlag: (flagged) => controller.setFlag(flagged, 'api'),
    openLocation: () => controller.openLocation('api'),
    toggleLocation: () => controller.toggleLocation('api'),
    cancelLocation: () => controller.cancelLocation('api'),
    commitLocation: () => controller.commitLocation('api'),
    clearLocation: () => controller.clearLocation('api'),
    setLocationText: (text) => controller.setLocationText(text, 'api'),
    setLocation: (text) => controller.setLocation(text, 'api'),
    typeLocation: async (text, cps = DEFAULT_TYPING_CPS) => {
      if (store.getState().section !== 'location') controller.openLocation('api');
      await typing.type(text, interval(cps), (typed) => controller.setLocationText(typed, 'api'));
      controller.commitLocation('api');
    },
    locationDraft: () => store.locationDraft,

    hoverNotch: (entered) => controller.hover(entered),

    setPointer: (x, y, opts) => cursor()?.moveTo({ x, y }, { durationMs: opts?.duration }) ?? Promise.resolve(),
    pointFor: (target) => {
      const { notchOrigin, sceneScale } = props();
      if (target === 'notch') return { x: notchOrigin.x, y: notchOrigin.y + core.sizes.closedSize.height / 2 };
      const root = rootNow();
      const canvasEl = root?.querySelector<HTMLElement>('[data-qr-canvas]') ?? null;
      const el = root && targetElement(root, target);
      if (!canvasEl || !el) return null;
      const c = canvasEl.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const scale = c.width > 0 ? c.width / canvas.width : sceneScale;
      return {
        x: notchOrigin.x + (r.left + r.width / 2 - (c.left + c.width / 2)) / scale,
        y: notchOrigin.y + (r.top + r.height / 2 - c.top) / scale,
      };
    },
    pointerTo: async (target, { duration, click = false } = {}) => {
      const point = h.pointFor(target);
      if (!point) return false;
      await cursor()?.moveTo(point, { durationMs: duration });
      if (click) {
        await cursor()?.click();
        TARGET_ACTIONS(h, target, { month: store.calendarMonth, calendar: core.calendar })?.();
      }
      return true;
    },

    getState: () => store.getState(),
    subscribe: (listener) => store.subscribe(() => listener(store.getState())),
    markClean: () => store.markClean(),
    cancel: () => {
      typing.cancel();
      cursor()?.cancel();
    },
    reset: ({ keepSaved = true } = {}) => {
      h.cancel();
      runtime.reset();
      store.reset({ keepSaved });
    },
    machine: () => runtime.machine,
  };
  return h;
}

/** A stable getter for the latest `value`, for timers and handle methods (never read during render). */
function useLatest<T>(value: T): () => T {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return useCallback(() => ref.current, []);
}

/** The mounted root: a callback ref that also makes it the focus registry's root, and a getter for `pointFor`. */
function useRootElement(focus: FocusRegistry): [attach: (el: HTMLDivElement | null) => void, root: () => HTMLDivElement | null] {
  const ref = useRef<HTMLDivElement | null>(null);
  const attach = useCallback((el: HTMLDivElement | null): void => {
    ref.current = el;
    focus.setRoot(el);
  }, [focus]);
  const root = useCallback(() => ref.current, []);
  return [attach, root];
}

interface PanelProps {
  core: RecreationCore;
  timeScale: number;
  latest: () => RecreationProps;
  shortcutsEnabled: boolean;
  notchOrigin: ScenePoint;
}

/** Under the provider (the keyboard map reads the core from context): the root `<div data-qr-root>`
 *  with its canvas' top centre on the notch's origin, and the handle. */
const RecreationPanel = forwardRef<RecreationHandle, PanelProps>(function RecreationPanel(props, ref) {
  const { core, timeScale, latest, shortcutsEnabled, notchOrigin } = props;
  const [typing] = useState(() => new TypingRuns());
  const canvas = useMemo(() => canvasFor(core.sizes), [core]);
  const [attachRoot, root] = useRootElement(core.focus);

  const handle = useMemo(
    () => createHandle({ core, canvas, props: latest, root, timeScale, typing }),
    [core, canvas, latest, root, timeScale, typing],
  );
  useImperativeHandle(ref, () => handle, [handle]);

  useEffect(
    () => core.store.subscribe(() => latest().onStateChange?.(core.store.getState())),
    [core, latest],
  );
  useEffect(() => () => typing.cancel(), [typing]);

  const onKeyDown = useRecreationKeys(shortcutsEnabled);
  const style: CSSProperties = {
    position: 'absolute', left: px(notchOrigin.x - canvas.width / 2), top: px(notchOrigin.y), pointerEvents: 'none',
  };
  return (
    <div ref={attachRoot} data-qr-root="" style={style} onKeyDown={onKeyDown}>
      <NotchContainer />
    </div>
  );
});

export const Recreation = forwardRef<RecreationHandle, RecreationProps>(function Recreation(props, ref) {
  const { notch, screenHeight, dockHeight = 0, locale = 'en-US', hour12, shortcutsEnabled, notchOrigin } = props;
  const reduceMotion = useReducedMotion(props.reduceMotion);

  // The core is created once; what may change afterwards is read through getters when a method runs.
  const latest = useLatest(props);
  const reduceMotionNow = useLatest(reduceMotion);
  const [timeScale] = useState(() => motionTimeScale());
  const [core] = useState(() =>
    createRecreationCore({
      notch,
      screenHeight,
      dockHeight,
      clock: () => (latest().clock ?? AppClock.now)(),
      calendar: props.calendar ?? currentCalendar(),
      locale,
      hour12,
      reduceMotion: reduceMotionNow,
      timeScale: () => timeScale,
      onSaved: (item) => latest().onSaved?.(item),
    }));
  useEffect(() => () => core.controller.destroy(), [core]);

  return (
    <RecreationProvider core={core} reduceMotion={reduceMotion} timeScale={timeScale}>
      <RecreationPanel
        ref={ref}
        core={core}
        timeScale={timeScale}
        latest={latest}
        shortcutsEnabled={shortcutsEnabled}
        notchOrigin={notchOrigin}
      />
    </RecreationProvider>
  );
});
