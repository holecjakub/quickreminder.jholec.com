// The snapshot reconciler (contracts §4.4, landing spec §11.2): moves the recreation from
// handle.getState() to a section snapshot through the imperative API. Every field is written
// instantly except the snapshot's `action`, which plays through the handle (and the fake cursor
// when one is given). Visitor edits win: a dirty draft keeps its fields and only the action runs.
import { isSameMinute, type Calendar } from '../../recreation/core/calendar';
import type { RecreationHandle, RecreationState } from '../../recreation';
import { isSchedule } from '../../recreation/machine/notchMachine';
import type { FakeCursorHandle } from '../../desktop/fakeCursor';
import { scaleMs } from '../motionDebug';
import { resolveDue, type SectionAction, type SectionSnapshot } from './snapshot';

export interface ReconcileOptions {
  readonly now: Date;
  readonly calendar: Calendar;
  readonly direction: 'down' | 'up';     // scrolling back up: hero closes the panel, other sections leave content alone
  readonly signal: AbortSignal;          // the driver aborts a running action when the next section wins after maxDurationMs
  readonly cursor?: FakeCursorHandle | null;
  readonly maxDurationMs?: number;       // default 2500 (read by the section driver, not here)
  readonly cps?: number;                 // default 18
}

export interface ReconcileResult {
  readonly performed: SectionAction;
  readonly keptVisitorEdits: boolean;    // dirty was true: title/notes/list/flag/location left alone
  readonly aborted: boolean;
}

/** Pauses between the steps of an animated action (contracts §7: section rows stagger easeOut 0.24 at 0.06 + i · 0.035). */
export const RECONCILE_TIMING = {
  /** 0.06 + 3 · 0.035 + 0.24 s: the last Set Date row has landed. */
  scheduleRowsMs: 420,
  presetHoverMs: 450,
  listOpenMs: 220,
  listStepMs: 380,
  flagToLocationMs: 300,
  /** 0.06 + 0 · 0.035 + 0.24 s: the Location field row's stagger (NotchButtonStyles.swift View.staggered(0)). */
  locationFieldMs: 300,
} as const;

const DEFAULT_CPS = 18;

function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError';
}

function abortError(): DOMException {
  return new DOMException('Aborted', 'AbortError');
}

/** `scaleMs(ms)` on a timer; rejects with an AbortError as soon as `signal` aborts. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError());
      return;
    }
    const onAbort = () => {
      clearTimeout(id);
      reject(abortError());
    };
    const id = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, scaleMs(ms));
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function isVisible(state: RecreationState): boolean {
  return state.phase.type === 'open' || state.phase.type === 'saving';
}

export async function reconcile(handle: RecreationHandle, snapshot: SectionSnapshot, opts: ReconcileOptions): Promise<ReconcileResult> {
  const { signal } = opts;
  const cps = opts.cps ?? DEFAULT_CPS;
  const instant = cps === Infinity;
  const cursor = instant ? null : (opts.cursor ?? null);
  let keep = handle.getState().dirty;
  let performed: SectionAction = 'none';

  const result = (aborted: boolean): ReconcileResult => ({ performed, keptVisitorEdits: keep, aborted });
  if (signal.aborted) return result(true);

  const onAbort = () => {
    handle.cancel();
    opts.cursor?.cancel();
  };
  signal.addEventListener('abort', onAbort, { once: true });

  const pause = (ms: number) => (instant ? Promise.resolve() : sleep(ms, signal));
  const point = async (...args: Parameters<RecreationHandle['pointerTo']>) => {
    if (cursor) await handle.pointerTo(...args);
  };

  try {
    // 1. Scrolling back up only closes the panel for the hero.
    if (opts.direction === 'up') {
      if (snapshot.action === 'close' && isVisible(handle.getState()) && !keep) {
        await handle.hide();
        performed = 'close';
      }
      return result(false);
    }
    // 2. Nothing to do.
    if (snapshot.action === 'none') return result(false);

    // 3. Panel.
    if ((snapshot.panel === 'open' || snapshot.action === 'save') && !isVisible(handle.getState())) {
      await handle.show({ source: 'scroll' });
      // A visitor edit while the panel opened aborted this run: their draft stands, nothing is written.
      if (signal.aborted) return result(true);
      handle.markClean();   // show resets the draft, so the visitor's edits are gone
      keep = false;
    }
    if (snapshot.action === 'close') {
      if (isVisible(handle.getState()) && !keep) {
        await handle.hide();
        performed = 'close';
      }
      return result(false);
    }
    if (snapshot.panel === 'closed' && snapshot.action !== 'save' && isVisible(handle.getState())) {
      void handle.hide().catch(() => undefined);   // not awaited; an abort while it runs is not this call's concern
    }

    // 4. Close what the snapshot does not show, without writing anything.
    const before = handle.getState();
    if (before.listPickerOpen && snapshot.action !== 'lists') handle.closeListPicker();
    if (before.section === 'location') handle.cancelLocation();
    if (isSchedule(before.section) && snapshot.action !== 'schedule') handle.cancelSchedule();

    // 5. Instant writes of every field that differs (unless the visitor's draft is kept).
    if (!keep) {
      const current = handle.getState();
      const listId = snapshot.action === 'lists' ? (snapshot.listCycle?.[0] ?? snapshot.listId) : snapshot.listId;
      if (current.listId !== listId) handle.setList(listId);
      const flagged = snapshot.action === 'flagLocation' ? false : snapshot.flagged;
      if (current.flagged !== flagged) handle.setFlag(flagged);
      const location = snapshot.action === 'flagLocation' ? null : snapshot.location;
      if (current.location !== location) handle.setLocation(location);
      if (current.notes !== snapshot.notes) handle.setNotes(snapshot.notes);
      if (snapshot.action === 'typeTitle') {
        if (current.dueDate !== null) handle.setDueDate(null);
        if (current.title !== '') handle.setTitle('');
      } else {
        if (current.title !== snapshot.title) handle.setTitle(snapshot.title);
        const due = resolveDue(snapshot.due, opts.now, opts.calendar);
        const same = due === null
          ? current.dueDate === null
          : current.dueDate !== null && isSameMinute(opts.calendar, current.dueDate, due.date);
        if (!same) handle.setDueDate(due?.date ?? null, due?.presetPick ?? null);
      }
      handle.markClean();
    }

    // 6. The section's own action.
    switch (snapshot.action) {
      case 'open':
        break;
      case 'typeTitle': {
        if (keep) break;
        performed = 'typeTitle';
        const typed = snapshot.typedTitle ?? snapshot.title;
        if (instant) handle.setTitle(typed);
        else await handle.typeTitle(typed, cps);
        await pause(snapshot.applyDelayMs ?? 0);
        handle.applySuggestion();
        handle.markClean();
        break;
      }
      case 'schedule': {
        performed = 'schedule';
        handle.openSchedule();
        await pause(RECONCILE_TIMING.scheduleRowsMs);
        if (snapshot.highlightPreset) await point(`preset:${snapshot.highlightPreset}`);
        await pause(RECONCILE_TIMING.presetHoverMs);
        handle.openCalendar();
        break;
      }
      case 'lists': {
        if (keep) break;
        performed = 'lists';
        for (const id of snapshot.listCycle?.slice(1) ?? []) {
          await point('header', { click: true });
          handle.openListPicker();
          await pause(RECONCILE_TIMING.listOpenMs);
          await point(`list:${id}`, { click: true });
          handle.setList(id);
          await pause(RECONCILE_TIMING.listStepMs);
        }
        handle.markClean();
        break;
      }
      case 'flagLocation': {
        if (keep) break;
        performed = 'flagLocation';
        await point('flagIcon', { click: true });
        handle.setFlag(true);
        await pause(RECONCILE_TIMING.flagToLocationMs);
        await point('locationIcon', { click: true });   // its click is toggleLocation: the panel grows into the Location section
        await pause(RECONCILE_TIMING.locationFieldMs);
        if (instant) handle.setLocation(snapshot.location);
        else await handle.typeLocation(snapshot.location ?? '', cps);   // opens the section when the cursor did not, types, then Done
        handle.markClean();
        break;
      }
      case 'save': {
        if (!handle.getState().canSave) break;
        performed = 'save';
        // Point, press, then save through the handle: a pointerTo click would run ✓'s own action
        // (`void h.save()`), and the explicit save() would then resolve null at once, settling
        // `performed: 'save'` ~1.3 s before the saved pill ends.
        await point('save');
        if (cursor) await cursor.click();
        await handle.save();
        break;
      }
    }
    return result(false);
  } catch (error) {
    if (isAbortError(error)) return result(true);
    throw error;
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}
