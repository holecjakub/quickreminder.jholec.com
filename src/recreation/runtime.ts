// Port of Panel/PanelController.swift (app 144d620): performs the effects `NotchMachine` returns.
// The machine decides *what* happens; the runtime does it with browser timers and a host (the
// store and the DOM). Window effects have no web counterpart: the canvas is CSS and never resizes,
// and the container listens for keys while the panel is visible. Every delay is scaled by
// `timeScale()` so `?debug=motion` slows the timers with the springs.

import {
  NotchMachine,
  type NotchEffect,
  type NotchEvent,
  type NotchMachineSnapshot,
} from './machine/notchMachine';
import { NotchLayout } from './machine/notchLayout';
import type { NotchFlags } from './machine/notchState';
import type { FlagAnimation } from './ui/transitions';

export interface NotchRuntimeHost {
  setFlags(patch: Partial<NotchFlags>, animation: FlagAnimation): void;
  /** scheduleFocusRetries at 0.12 s and 0.30 s; the host skips it while a section or a text row owns the keyboard. */
  focusTitle(): void;
  /** resignFirstResponder. */
  blurAll(): void;
  /** pointer-events on the content. */
  setIgnoresMouse(ignores: boolean): void;
  /** No-op on the web. */
  haptic(): void;
  /** `.panelWillShow`: resetState() in the store. */
  willShow(): void;
  /** `.panelDidHide`: close popovers. */
  didHide(): void;
}

export interface NotchRuntimeOptions {
  reduceMotion: () => boolean;
  timeScale: () => number;
  hasNotch: () => boolean;
  pointerOnNotch: () => boolean;
  /** Runs after each event's effects have been performed. */
  onDispatched?: (event: NotchEvent, snapshot: NotchMachineSnapshot) => void;
}

/** Timer durations in seconds, from NotchLayout (PanelController's timers). */
export const RUNTIME_TIMERS = {
  close: NotchLayout.closeDuration,
  savedHold: NotchLayout.savedHold,
  settle: NotchLayout.settleDelay,
  hoverDwell: NotchLayout.hoverDwell,
  focusRetries: NotchLayout.focusRetryDelays,
} as {
  readonly close: 0.36;
  readonly savedHold: 1.0;
  readonly settle: 0.5;
  readonly hoverDwell: 0.09;
  readonly focusRetries: readonly [0.12, 0.30];
};

/** The cancellable timers (Swift `closeTask`, `saveTask`, `hoverDwell`). */
type NamedTimer = 'close' | 'saveHold' | 'hoverDwell';

export class NotchRuntime {
  private notch = new NotchMachine();
  private readonly pending: NotchEvent[] = [];
  private isDispatching = false;
  private readonly namedTimers = new Map<NamedTimer, number>();
  /** Settle, focus-retry and next-turn timers: never cancelled by the machine, only by destroy / reset. */
  private readonly looseTimers = new Set<number>();

  constructor(
    private readonly host: NotchRuntimeHost,
    private readonly opts: NotchRuntimeOptions,
  ) {
    // PanelController.init parks the window on a notched screen.
    this.dispatch({ type: 'screenChanged', hasNotch: opts.hasNotch() });
  }

  get machine(): NotchMachineSnapshot {
    return this.notch.snapshot();
  }

  /** Queued like PanelController.dispatch: an event raised while effects run is handled after the batch. */
  dispatch(event: NotchEvent): void {
    this.pending.push(event);
    if (this.isDispatching) return;
    this.isDispatching = true;
    try {
      while (this.pending.length > 0) {
        const next = this.pending.shift()!;
        const parksWithNotch = (next.type === 'closeTimerFired' || next.type === 'screenChanged') && next.hasNotch;
        // Hover arms from where the pointer is when the notch parks.
        const pointerOnNotch = parksWithNotch ? this.opts.pointerOnNotch() : false;
        for (const effect of this.notch.handle(next, pointerOnNotch)) this.perform(effect);
        this.opts.onDispatched?.(next, this.notch.snapshot());
      }
    } finally {
      this.isDispatching = false;
    }
  }

  /** Clears every timer, starts a fresh machine and parks it again. */
  reset(): void {
    this.clearTimers();
    this.pending.length = 0;
    this.notch = new NotchMachine();
    this.dispatch({ type: 'screenChanged', hasNotch: this.opts.hasNotch() });
  }

  /** Clears every timer. */
  destroy(): void {
    this.clearTimers();
    this.pending.length = 0;
  }

  private perform(effect: NotchEffect): void {
    const { host } = this;
    switch (effect.type) {
      // Window & geometry: the canvas is CSS and never resizes; the container listens while visible.
      case 'configureGeometry':
      case 'relayoutOpenWindow':
      case 'makeKeyAndOrderFront':
      case 'installLocalMonitor':
      case 'removeLocalMonitor':
        return;
      case 'switchToOpenCanvas':
        return host.setFlags({ section: 'none', isOpen: false, contentVisible: false }, 'none');
      case 'park':
        return host.setFlags({ isOpen: false, contentVisible: false, isHovering: false }, 'none');
      case 'orderOut':
        return host.setFlags({ isOpen: false, contentVisible: false }, 'none');
      case 'setIgnoresMouse':
        return host.setIgnoresMouse(effect.ignores);
      case 'resignFirstResponder':
        return host.blurAll();

      // Notifications
      case 'postWillShow':
        return host.willShow();
      case 'postDidHide':
        return host.didHide();

      // NotchState mutations
      case 'animateOpen':
        // Next run-loop turn (Swift `DispatchQueue.main.async`): expand.
        return this.after(0, () =>
          host.setFlags({ isSaving: false, isHovering: false, isOpen: true, contentVisible: true }, 'open'));
      case 'animateClose':
        return host.setFlags({ contentVisible: false, isOpen: false, isSaving: false, section: 'none' }, 'close');
      case 'animateSaving':
        return host.setFlags(
          { contentVisible: false, isOpen: false, isSaving: true, section: 'none', savedBadgeShown: true }, 'saving');
      case 'clearBadgeNoAnimation':
        return host.setFlags({ savedBadgeShown: false }, 'none');
      case 'setSettled':
        return host.setFlags({ isSettled: effect.settled }, 'none');
      case 'swellHover':
        return host.setFlags({ isHovering: true }, 'hoverIn');
      case 'unswellHover':
        return host.setFlags({ isHovering: false }, 'hoverOut');
      case 'haptic':
        return host.haptic();
      case 'animateSection':
        return host.setFlags({ section: effect.section }, 'schedule');

      // Timers
      case 'scheduleClose':
        // `hasNotch` is read when the timer fires: the notch parks on the then-current screen.
        return this.start('close', RUNTIME_TIMERS.close, () =>
          this.dispatch({ type: 'closeTimerFired', hasNotch: this.opts.hasNotch() }));
      case 'cancelClose':
        return this.cancel('close');
      case 'scheduleSaveHold':
        return this.start('saveHold', RUNTIME_TIMERS.savedHold, () => this.dispatch({ type: 'saveHoldElapsed' }));
      case 'cancelSaveHold':
        return this.cancel('saveHold');
      case 'scheduleSettle': {
        const { generation } = effect;
        return this.after(RUNTIME_TIMERS.settle, () => this.dispatch({ type: 'settleTimerFired', generation }));
      }
      case 'scheduleFocusRetries':
        for (const delay of RUNTIME_TIMERS.focusRetries) this.after(delay, () => host.focusTitle());
        return;
      case 'scheduleHoverDwell':
        return this.start('hoverDwell', RUNTIME_TIMERS.hoverDwell, () =>
          this.dispatch({ type: 'hoverDwellElapsed', reduceMotion: this.opts.reduceMotion() }));
      case 'cancelHoverDwell':
        return this.cancel('hoverDwell');
    }
  }

  private delayMs(seconds: number): number {
    return seconds * this.opts.timeScale() * 1000;
  }

  /** A cancellable timer; starting one replaces the running one of the same name. */
  private start(name: NamedTimer, seconds: number, fire: () => void): void {
    this.cancel(name);
    const id = window.setTimeout(() => {
      this.namedTimers.delete(name);
      fire();
    }, this.delayMs(seconds));
    this.namedTimers.set(name, id);
  }

  private cancel(name: NamedTimer): void {
    const id = this.namedTimers.get(name);
    if (id === undefined) return;
    window.clearTimeout(id);
    this.namedTimers.delete(name);
  }

  /** A fire-and-forget timer (Swift `asyncAfter`). */
  private after(seconds: number, fire: () => void): void {
    const id = window.setTimeout(() => {
      this.looseTimers.delete(id);
      fire();
    }, this.delayMs(seconds));
    this.looseTimers.add(id);
  }

  private clearTimers(): void {
    for (const id of this.namedTimers.values()) window.clearTimeout(id);
    this.namedTimers.clear();
    for (const id of this.looseTimers) window.clearTimeout(id);
    this.looseTimers.clear();
  }
}
