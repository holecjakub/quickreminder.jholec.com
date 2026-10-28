// Port of Panel/NotchMachine.swift (app 144d620): the pure state machine behind the panel.
// The machine owns every decision about *what* happens (guards, phase changes, which timers to
// start or cancel); the runtime owns *how*. `handle` mutates the machine and returns the effects
// to perform, in order. No clocks: everything time-based arrives as an event, so the whole
// choreography runs in tests without a window. The `sectionChanged` event and the show-while-open
// section case are stubs here (contract A-D4 / A-D5); Task 20 fills them in.

import type { NotchSection } from './notchLayout';

export type { NotchSection };

/** Swift `NotchPhase`: where the panel is in its lifecycle. */
export type NotchPhase =
  | { readonly type: 'closed'; readonly parked: boolean }
  | { readonly type: 'open' }
  | { readonly type: 'saving' }
  | { readonly type: 'closing' };

/** Swift `NotchSection.isSchedule`: Set Date is shown (either depth). */
export function isSchedule(s: NotchSection): boolean {
  return s === 'controls' || s === 'calendar';
}

/**
 * Swift `NotchSection.afterEscape`: Esc steps back one level — the month grid closes first, the
 * next Esc closes the section (Set Date or Location); the panel stays open either way.
 */
export function afterEscape(s: NotchSection): NotchSection {
  return s === 'calendar' ? 'controls' : 'none';
}

/** Swift `NotchEvent`: public API calls, pointer events and expired timers. */
export type NotchEvent =
  | { type: 'show' }
  | { type: 'hide' }
  | { type: 'save'; reduceMotion: boolean }
  | { type: 'saveHoldElapsed' }
  | { type: 'closeTimerFired'; hasNotch: boolean }
  | { type: 'settleTimerFired'; generation: number }
  | { type: 'hoverEntered' }
  | { type: 'hoverExited' }
  | { type: 'hoverDwellElapsed'; reduceMotion: boolean }
  | { type: 'screenChanged'; hasNotch: boolean }
  | { type: 'notchTapped' }
  | { type: 'sectionChanged'; section: NotchSection };

/** Swift `NotchEffect`: outputs, performed by the runtime in the order given. */
export type NotchEffect =
  // Window & geometry
  | { type: 'configureGeometry' }
  | { type: 'switchToOpenCanvas' }
  | { type: 'relayoutOpenWindow' }
  | { type: 'makeKeyAndOrderFront' }
  | { type: 'park' }
  | { type: 'orderOut' }
  | { type: 'setIgnoresMouse'; ignores: boolean }
  | { type: 'resignFirstResponder' }
  // Monitors & notifications
  | { type: 'installLocalMonitor' }
  | { type: 'removeLocalMonitor' }
  | { type: 'postWillShow' }
  | { type: 'postDidHide' }
  // NotchState mutations
  | { type: 'animateOpen'; fromSaved: boolean }
  | { type: 'animateClose' }
  | { type: 'animateSaving' }
  | { type: 'clearBadgeNoAnimation' }
  | { type: 'setSettled'; settled: boolean }
  | { type: 'swellHover' }
  | { type: 'unswellHover' }
  | { type: 'haptic' }
  | { type: 'animateSection'; section: NotchSection }
  // Timers
  | { type: 'scheduleClose' }
  | { type: 'cancelClose' }
  | { type: 'scheduleSaveHold' }
  | { type: 'cancelSaveHold' }
  | { type: 'scheduleSettle'; generation: number }
  | { type: 'scheduleFocusRetries' }
  | { type: 'scheduleHoverDwell' }
  | { type: 'cancelHoverDwell' };

export interface NotchMachineSnapshot {
  readonly phase: NotchPhase;
  readonly badgeShown: boolean;
  readonly hoverSwollen: boolean;
  readonly hoverArmed: boolean;
  readonly hoverDwellPending: boolean;
  /** Wraps at 2^32 like Swift `UInt` under `&+= 1` (the app never reaches it; the port pins the shape). */
  readonly generation: number;
  readonly section: NotchSection;
}

const CLOSED_UNPARKED: NotchPhase = Object.freeze({ type: 'closed', parked: false });
const CLOSED_PARKED: NotchPhase = Object.freeze({ type: 'closed', parked: true });
const OPEN: NotchPhase = Object.freeze({ type: 'open' });
const SAVING: NotchPhase = Object.freeze({ type: 'saving' });
const CLOSING: NotchPhase = Object.freeze({ type: 'closing' });

/** Swift `NotchPhase ==`. */
export function phaseEquals(a: NotchPhase, b: NotchPhase): boolean {
  if (a.type === 'closed') return b.type === 'closed' && a.parked === b.parked;
  return a.type === b.type;
}

/** Swift `UInt &+ 1` on a 32-bit counter. */
function bumped(generation: number): number {
  return (generation + 1) >>> 0;
}

/** Mutable reducer, 1:1 with the Swift struct so `NotchMachineTests` port line by line. */
export class NotchMachine implements NotchMachineSnapshot {
  private _phase: NotchPhase = CLOSED_UNPARKED;
  /** The ✓ badge exists from the save until the window is parked / ordered out or the panel is reopened. */
  private _badgeShown = false;
  /** The closed silhouette is swollen under the pointer. */
  private _hoverSwollen = false;
  /** Re-armed once the pointer has left the notch; prevents an immediate re-hover after closing. */
  private _hoverArmed = true;
  /** A hover dwell timer is running. */
  private _hoverDwellPending = false;
  /** Bumped by every show, save and section change; a settle timer only counts if it carries the current value. */
  private _generation = 0;
  /** In-notch section of the open panel. */
  private _section: NotchSection = 'none';

  get phase(): NotchPhase { return this._phase; }
  get badgeShown(): boolean { return this._badgeShown; }
  get hoverSwollen(): boolean { return this._hoverSwollen; }
  get hoverArmed(): boolean { return this._hoverArmed; }
  get hoverDwellPending(): boolean { return this._hoverDwellPending; }
  get generation(): number { return this._generation; }
  get section(): NotchSection { return this._section; }

  /** Open or saving: the window is key and the local monitor is installed. */
  get isVisible(): boolean {
    return this._phase.type === 'open' || this._phase.type === 'saving';
  }

  private get isParked(): boolean {
    return this._phase.type === 'closed' && this._phase.parked;
  }

  /**
   * Mutates the machine and returns the effects to perform, in order.
   * @param pointerOnNotch whether the pointer currently rests on the physical notch (with hover
   *   slack). Only consulted when the machine parks: hover then arms from where the pointer
   *   actually is (still on the notch → wait for it to leave first).
   */
  handle(event: NotchEvent, pointerOnNotch = false): NotchEffect[] {
    switch (event.type) {
      case 'show':
        return this.show();

      case 'notchTapped':
        // Only the parked notch takes taps: while open/saving/closing the window either ignores
        // the mouse or the click belongs to the panel's own controls.
        if (!this.isParked) return [];
        return this.show();

      case 'hide':
        return this.isVisible ? this.close(true) : [];

      case 'save': {
        if (this._phase.type !== 'open') return []; // double-save guard; nothing to save while closing
        if (event.reduceMotion) return this.close(true);
        // Invalidate the settle timer from `show` so it cannot drop the mask mid-choreography.
        this._generation = bumped(this._generation);
        this._phase = SAVING;
        this._badgeShown = true;
        this._section = 'none'; // the saved pill starts from whatever height the blob had
        return [{ type: 'setSettled', settled: false }, { type: 'animateSaving' }, { type: 'setIgnoresMouse', ignores: true }, { type: 'resignFirstResponder' }, { type: 'scheduleSaveHold' }];
      }

      case 'saveHoldElapsed':
        if (this._phase.type !== 'saving') return [];
        return this.close(false);

      case 'closeTimerFired': {
        if (this._phase.type !== 'closing') return [];
        this._badgeShown = false;
        return [{ type: 'clearBadgeNoAnimation' }, event.hasNotch ? this.park(pointerOnNotch) : this.orderOut()];
      }

      case 'settleTimerFired':
        if (this._phase.type !== 'open' || event.generation !== this._generation) return [];
        return [{ type: 'setSettled', settled: true }];

      case 'sectionChanged':
        return []; // Task 20 ports `changeSection`

      case 'hoverEntered':
        if (!this.isParked || !this._hoverArmed || this._hoverSwollen || this._hoverDwellPending) return [];
        this._hoverDwellPending = true;
        return [{ type: 'scheduleHoverDwell' }];

      case 'hoverDwellElapsed': {
        if (!this._hoverDwellPending) return []; // stale timer (cancelled dwell)
        this._hoverDwellPending = false;
        if (!this.isParked || !this._hoverArmed) return [];
        const effects: NotchEffect[] = [];
        if (!event.reduceMotion) {
          this._hoverSwollen = true;
          effects.push({ type: 'swellHover' });
        }
        effects.push({ type: 'haptic' });
        return effects;
      }

      case 'hoverExited': {
        if (!this.isParked) return [];
        const effects: NotchEffect[] = [];
        if (this._hoverDwellPending) {
          this._hoverDwellPending = false;
          effects.push({ type: 'cancelHoverDwell' });
        }
        this._hoverArmed = true;
        if (this._hoverSwollen) {
          this._hoverSwollen = false;
          effects.push({ type: 'unswellHover' });
        }
        return effects;
      }

      case 'screenChanged': {
        const effects: NotchEffect[] = [{ type: 'configureGeometry' }];
        switch (this._phase.type) {
          case 'open':
          case 'saving':
            effects.push({ type: 'relayoutOpenWindow' });
            break;
          case 'closing':
            break; // the close timer parks / orders out on the then-current screen
          case 'closed':
            if (event.hasNotch) {
              effects.push(this.park(pointerOnNotch));
            } else if (this._phase.parked) {
              effects.push(this.orderOut()); // the target screen lost its notch
            }
            break;
        }
        return effects;
      }
    }
  }

  snapshot(): NotchMachineSnapshot {
    return {
      phase: this._phase,
      badgeShown: this._badgeShown,
      hoverSwollen: this._hoverSwollen,
      hoverArmed: this._hoverArmed,
      hoverDwellPending: this._hoverDwellPending,
      generation: this._generation,
      section: this._section,
    };
  }

  /** Swift `Hashable ==`: every field, the generation included. */
  equals(other: NotchMachineSnapshot): boolean {
    return phaseEquals(this._phase, other.phase)
      && this._badgeShown === other.badgeShown
      && this._hoverSwollen === other.hoverSwollen
      && this._hoverArmed === other.hoverArmed
      && this._hoverDwellPending === other.hoverDwellPending
      && this._generation === other.generation
      && this._section === other.section;
  }

  /** Swift value semantics (`var next = start`). */
  clone(): NotchMachine {
    const copy = new NotchMachine();
    copy._phase = this._phase;
    copy._badgeShown = this._badgeShown;
    copy._hoverSwollen = this._hoverSwollen;
    copy._hoverArmed = this._hoverArmed;
    copy._hoverDwellPending = this._hoverDwellPending;
    copy._generation = this._generation;
    copy._section = this._section;
    return copy;
  }

  // MARK: - Transitions shared by several events

  private show(): NotchEffect[] {
    // Already open: nothing to do (Task 20 adds the return to the plain panel while a section is open).
    if (this._phase.type === 'open') return [];
    const effects: NotchEffect[] = [];
    if (this._hoverDwellPending) {
      this._hoverDwellPending = false;
      effects.push({ type: 'cancelHoverDwell' });
    }
    // Re-opening while the collapse animation is still running (or during the saved hold):
    // don't snap back to the notch, just reverse from wherever the shape currently is.
    const wasVisible = this.isVisible;
    const fromSaved = this._phase.type === 'saving';
    let midCollapse = false;
    if (this._phase.type === 'closing') {
      effects.push({ type: 'cancelClose' });
      midCollapse = true;
    } else if (this._phase.type === 'saving') {
      effects.push({ type: 'cancelSaveHold' });
      midCollapse = true;
    }
    // The badge (if any) is invisible or about to be; drop it without animating.
    this._badgeShown = false;
    effects.push({ type: 'clearBadgeNoAnimation' });
    effects.push({ type: 'configureGeometry' });
    if (!midCollapse) effects.push({ type: 'switchToOpenCanvas' });
    this._section = 'none';
    effects.push({ type: 'setIgnoresMouse', ignores: false });
    effects.push({ type: 'makeKeyAndOrderFront' });
    if (!wasVisible) effects.push({ type: 'installLocalMonitor' }); // still installed during the saved hold
    effects.push({ type: 'postWillShow' });
    effects.push({ type: 'animateOpen', fromSaved });
    this._hoverSwollen = false; // the open spring also starts from the hover swell, if any
    this._phase = OPEN;
    this._generation = bumped(this._generation);
    effects.push({ type: 'scheduleSettle', generation: this._generation });
    effects.push({ type: 'scheduleFocusRetries' });
    return effects;
  }

  /** Open / saving → closing. `cancellingHold` is false when the hold itself ran out. */
  private close(cancellingHold: boolean): NotchEffect[] {
    const effects: NotchEffect[] = [];
    if (this._phase.type === 'saving' && cancellingHold) effects.push({ type: 'cancelSaveHold' });
    this._phase = CLOSING;
    this._section = 'none'; // the blob collapses from its current height; the section is gone
    // resignFirstResponder: the panel stays key for the collapse; without it a Return typed right
    // after Esc would still reach the text view and save the dismissed draft.
    effects.push({ type: 'postDidHide' }, { type: 'removeLocalMonitor' }, { type: 'resignFirstResponder' }, { type: 'setIgnoresMouse', ignores: true }, { type: 'setSettled', settled: false }, { type: 'animateClose' }, { type: 'scheduleClose' });
    return effects;
  }

  private park(pointerOnNotch: boolean): NotchEffect {
    this._phase = CLOSED_PARKED;
    this._hoverSwollen = false; // parking resets the swell without animation
    // Hover arms from where the pointer actually is: still on the notch → wait for it to leave
    // first; anywhere else → the next entry swells immediately.
    this._hoverArmed = !pointerOnNotch;
    return { type: 'park' };
  }

  private orderOut(): NotchEffect {
    this._phase = CLOSED_UNPARKED;
    this._hoverSwollen = false; // nothing is on screen; the next park / open resets the swell anyway
    return { type: 'orderOut' };
  }
}
