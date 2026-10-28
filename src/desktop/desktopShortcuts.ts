// Pure keyboard router of the fake desktop (contracts §4.3, landing spec §11.3): a key press plus
// the recreation's state → the shortcut to perform, or null to let the browser have the key.
// Where the recreation's own key handler also maps a key, it runs first and wins (ruling R-08).
import { DATE_PRESETS, type DatePreset, type RecreationHandle, type RecreationState } from '../recreation';

export type FocusTarget = 'none' | 'title' | 'notes' | 'scheduleField' | 'timeField' | 'calendar' | 'locationField';

export type ShortcutAction =
  | { type: 'show'; source: 'hotkey' }          // ⇧⌘R (best effort)
  | { type: 'escape' }                          // Esc, layered
  | { type: 'submit' }                          // ↩ in a text row (Set while scheduling, else save), ⌘↩ anywhere
  | { type: 'tab' }                             // Tab in the title: apply suggestion, else default focus move
  | { type: 'openSchedule' }                    // ⌘D
  | { type: 'toggleCalendar' }                  // ⌘K (section open)
  | { type: 'preset'; preset: DatePreset }      // ⌘1…⌘6 (section open)
  | { type: 'stepTime'; steps: 1 | -1 }         // ↑/↓ in the time field
  | { type: 'moveDay'; days: -7 | -1 | 1 | 7 }  // arrows in the focused grid
  | { type: 'applyTypedTime' };                 // ↩ in the time field (keeps the section open)

type KeyPick = Pick<KeyboardEvent, 'key' | 'code' | 'metaKey' | 'shiftKey' | 'altKey' | 'ctrlKey'>;

const CALENDAR_ARROWS: Readonly<Record<string, -7 | -1 | 1 | 7>> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

/** Set Date is shown (controls or calendar): Swift `NotchSection.isSchedule`. */
function setDateShown(state: RecreationState): boolean {
  return state.section === 'controls' || state.section === 'calendar';
}

export function shortcutFor(e: KeyPick, ctx: { state: RecreationState; focus: FocusTarget }): ShortcutAction | null {
  if (e.altKey) return null;
  const command = e.metaKey || e.ctrlKey;
  const { state, focus } = ctx;

  // ⇧⌘R, the app's global hotkey, works in every phase.
  if (command && e.shiftKey && e.code === 'KeyR') return { type: 'show', source: 'hotkey' };
  if (state.phase.type !== 'open') return null;

  if (command) {
    if (e.shiftKey) return null;
    if (e.key === 'Enter') return { type: 'submit' };
    if (e.code === 'KeyD') return setDateShown(state) ? null : { type: 'openSchedule' };
    if (e.code === 'KeyK') return setDateShown(state) ? { type: 'toggleCalendar' } : null;
    const digit = /^Digit([1-6])$/.exec(e.code);
    if (digit && setDateShown(state)) {
      const preset = DATE_PRESETS[Number(digit[1]) - 1];
      return preset ? { type: 'preset', preset } : null;
    }
    return null;
  }

  switch (e.key) {
    case 'Escape':
      return { type: 'escape' };
    case 'Enter':
      if (e.shiftKey) return null;
      if (focus === 'title' || focus === 'notes' || focus === 'scheduleField') return { type: 'submit' };
      if (focus === 'timeField') return { type: 'applyTypedTime' };
      return null;
    case 'Tab':
      return !e.shiftKey && focus === 'title' && state.suggestion ? { type: 'tab' } : null;
    default: {
      if (focus === 'timeField' && (e.key === 'ArrowUp' || e.key === 'ArrowDown'))
        return { type: 'stepTime', steps: e.key === 'ArrowUp' ? 1 : -1 };
      const days = CALENDAR_ARROWS[e.key];
      return focus === 'calendar' && days !== undefined ? { type: 'moveDay', days } : null;
    }
  }
}

const FOCUS_TARGETS: readonly FocusTarget[] = ['none', 'title', 'notes', 'scheduleField', 'timeField', 'calendar', 'locationField'];

const FIELD_NAMES: Readonly<Record<string, FocusTarget>> = {
  'New Reminder': 'title',
  Notes: 'notes',
  'Type a date': 'scheduleField',
  Time: 'timeField',
  Location: 'locationField',
};

function isFocusTarget(value: string | undefined): value is FocusTarget {
  return FOCUS_TARGETS.includes(value as FocusTarget);
}

/** Closest `[data-qr-field]` value (the recreation's focus-registry attribute, Task 29 (B9)), else by name:
 *  placeholder/aria-label "New Reminder" → title, "Notes" → notes, "Type a date" → scheduleField, "Time" → timeField,
 *  "Location" → locationField; `role="grid"` → calendar; else 'none'. */
export function focusTargetOf(el: Element | null): FocusTarget {
  if (!el) return 'none';
  const field = el.closest<HTMLElement>('[data-qr-field]')?.dataset.qrField;
  if (isFocusTarget(field)) return field;
  for (const name of [el.getAttribute('placeholder'), el.getAttribute('aria-label')]) {
    const target = name === null ? undefined : FIELD_NAMES[name];
    if (target) return target;
  }
  return el.closest('[role="grid"]') ? 'calendar' : 'none';
}

function ignoreAbort(promise: Promise<unknown>): void {
  promise.catch((error: unknown) => {
    if (!(error instanceof DOMException && error.name === 'AbortError')) throw error;
  });
}

/** Executes an action on the handle; swallows AbortError rejections. `show` toggles like PanelController.toggle()
 *  (app Panel/PanelController.swift line 62): open → hide(), else show({ source: 'hotkey' }). */
export function performShortcut(action: ShortcutAction, handle: RecreationHandle, ctx?: { typed?: string }): void {
  switch (action.type) {
    case 'show':
      ignoreAbort(handle.getState().phase.type === 'open' ? handle.hide() : handle.show({ source: 'hotkey' }));
      return;
    case 'escape':
      handle.escape();
      return;
    case 'submit':
      ignoreAbort(handle.save());
      return;
    case 'tab':
      handle.applySuggestion();
      return;
    case 'openSchedule':
      handle.openSchedule();
      return;
    case 'toggleCalendar':
      handle.toggleCalendar();
      return;
    case 'preset':
      handle.applyPreset(action.preset);
      return;
    case 'stepTime':
      handle.scheduleDraft()?.stepTime(action.steps);
      return;
    case 'moveDay':
      handle.moveDay(action.days);
      return;
    case 'applyTypedTime':
      handle.scheduleDraft()?.applyTypedTime(ctx?.typed ?? '');
      return;
  }
}
