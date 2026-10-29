// The recreation's keyboard (landing spec §11.3): every key the app's views and `PanelController`
// handle, mapped from the event and the focused field to one controller call. The map is pure
// (`recreationKeyFor`); `useRecreationKeys` runs it on the recreation root's keydown while focus is
// inside the desktop, performs the action and stops the event so the desktop never sees it.

import { useMemo, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { DATE_PRESETS, type DatePreset } from '../core/datePresets';
import { isSchedule } from '../machine/notchMachine';
import type { RecreationController } from '../controller';
import type { RecreationState } from '../store';
import type { FocusField } from './focus';
import { useCore } from './RecreationContext';

export type RecreationKeyAction =
  | { type: 'escape' } | { type: 'swallow' } | { type: 'toggle' } | { type: 'submit' } | { type: 'textRowSubmit' }
  | { type: 'commitSchedule' } | { type: 'commitSection' } | { type: 'applyTypedTime' } | { type: 'commitLocation' } | { type: 'applySuggestion' }
  | { type: 'openSchedule' } | { type: 'toggleCalendar' } | { type: 'preset'; preset: DatePreset }
  | { type: 'stepTime'; steps: 1 | -1 } | { type: 'moveDay'; days: -7 | -1 | 1 | 7 };

export interface KeyContext {
  readonly state: RecreationState;
  /** `data-qr-field` of the closest ancestor of the event target (the element the key was typed into). */
  readonly field: FocusField | null;
  readonly cmdKey: 'meta' | 'ctrl';
}

type KeyInput = Pick<KeyboardEvent, 'key' | 'code' | 'metaKey' | 'shiftKey' | 'altKey' | 'ctrlKey' | 'isComposing'>;

/** ⌘ on Apple platforms, Ctrl elsewhere; an unknown platform (empty, as in jsdom) counts as Apple's. */
export function platformCmdKey(platform?: string): 'meta' | 'ctrl' {
  if (!platform) return 'meta';
  return /Mac|iPhone|iPad|iPod/.test(platform) ? 'meta' : 'ctrl';
}

const PRESET_CODES = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'];

export function recreationKeyFor(e: KeyInput, ctx: KeyContext): RecreationKeyAction | null {
  if (e.isComposing) return null;
  const { state, field, cmdKey } = ctx;
  const phase = state.phase.type;

  if (e.key === 'Escape' && (phase === 'open' || phase === 'saving')) return { type: 'escape' };
  if (phase === 'saving') return { type: 'swallow' };

  const cmdHeld = cmdKey === 'meta' ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
  const cmd = cmdHeld && !e.shiftKey && !e.altKey;
  const plain = !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey;
  const open = phase === 'open';
  const sectionOpen = state.section !== 'none';
  const setDateOpen = isSchedule(state.section);

  if (cmdHeld && e.shiftKey && !e.altKey && (e.key.toLowerCase() === 'r' || e.code === 'KeyR')) return { type: 'toggle' };

  if (e.key === 'Enter') {
    if (cmd) return open ? { type: 'submit' } : null;
    if (!plain) return null;
    switch (field) {
      case 'title':
      case 'notes':
        return { type: 'textRowSubmit' };
      case 'scheduleField':
        return { type: 'commitSchedule' };
      case 'timeField':
        return { type: 'applyTypedTime' };
      case 'locationField':
        return { type: 'commitLocation' };
      default:
        return sectionOpen ? { type: 'commitSection' } : null;
    }
  }

  if (e.key === 'Tab') {
    return plain && field === 'title' && state.suggestion !== null ? { type: 'applySuggestion' } : null;
  }

  if (cmd) {
    const key = e.key.toLowerCase();
    if (key === 'd') return open && !state.badgeShown ? { type: 'openSchedule' } : null;
    if (key === 'k') return setDateOpen ? { type: 'toggleCalendar' } : null;
    const digit = PRESET_CODES.indexOf(e.code);
    if (digit >= 0) return setDateOpen ? { type: 'preset', preset: DATE_PRESETS[digit]! } : null;
    return null;
  }

  if (!plain) return null;
  if (field === 'timeField') {
    if (e.key === 'ArrowUp') return { type: 'stepTime', steps: 1 };
    if (e.key === 'ArrowDown') return { type: 'stepTime', steps: -1 };
  }
  if (field === 'calendar') {
    switch (e.key) {
      case 'ArrowLeft': return { type: 'moveDay', days: -1 };
      case 'ArrowRight': return { type: 'moveDay', days: 1 };
      case 'ArrowUp': return { type: 'moveDay', days: -7 };
      case 'ArrowDown': return { type: 'moveDay', days: 7 };
    }
  }
  return null;
}

function perform(action: RecreationKeyAction, controller: RecreationController): void {
  switch (action.type) {
    case 'escape': controller.escape(); break;
    case 'swallow': break;
    case 'toggle': controller.toggle(); break;
    case 'submit': void controller.save('user'); break;
    case 'textRowSubmit': void controller.textRowSubmit('user'); break;
    case 'commitSchedule': controller.commitSchedule('user'); break;
    case 'commitSection': controller.commitSection('user'); break;
    case 'applyTypedTime': controller.applyTypedTime(true); break;
    case 'commitLocation': controller.commitLocation('user'); break;
    case 'applySuggestion': controller.applySuggestion('user'); break;
    case 'openSchedule': controller.openSchedule('user'); break;
    case 'toggleCalendar': controller.toggleCalendar('user'); break;
    case 'preset': controller.applyPreset(action.preset, 'user'); break;
    case 'stepTime': controller.stepTime(action.steps, 'user'); break;
    case 'moveDay': controller.moveDay(action.days); break;
  }
}

/** The recreation root's `onKeyDown`: while `enabled` (focus inside the desktop) a mapped key is
 *  performed, `preventDefault()`ed and stopped; anything else keeps its native behaviour. */
export function useRecreationKeys(enabled: boolean): (e: ReactKeyboardEvent) => void {
  const { controller, store } = useCore();
  const cmdKey = useMemo(() => platformCmdKey(typeof navigator === 'undefined' ? undefined : navigator.platform), []);
  return (e) => {
    if (!enabled) return;
    const target = e.target instanceof Element ? e.target : null;
    const field = (target?.closest('[data-qr-field]')?.getAttribute('data-qr-field') ?? null) as FocusField | null;
    const action = recreationKeyFor(e.nativeEvent, { state: store.getState(), field, cmdKey });
    if (!action) return;
    e.preventDefault();
    e.stopPropagation();
    perform(action, controller);
  };
}
