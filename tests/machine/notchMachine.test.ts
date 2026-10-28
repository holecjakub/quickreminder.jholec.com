import { describe, expect, it } from 'vitest';
import { NotchMachine, afterEscape, isSchedule, phaseEquals, type NotchEffect, type NotchEvent, type NotchPhase } from '../../src/recreation/machine/notchMachine';

// Port of Tests/QuickReminderCoreTests/NotchMachineTests.swift (app 144d620): the 28 Swift
// cases under their Swift names, plus the TS-only pins at the bottom.

const ALL_PHASES: NotchPhase[] = [{ type: 'closed', parked: false }, { type: 'closed', parked: true }, { type: 'open' }, { type: 'saving' }, { type: 'closing' }];
const PARKED: NotchPhase = { type: 'closed', parked: true };

/** Swift `machine(in:)`: drives a fresh machine into `phase` through the public events. */
function machineIn(phase: NotchPhase): NotchMachine {
  const m = new NotchMachine();
  if (phase.type === 'closed' && phase.parked) m.handle({ type: 'screenChanged', hasNotch: true });
  if (phase.type === 'open' || phase.type === 'saving' || phase.type === 'closing') m.handle({ type: 'show' });
  if (phase.type === 'saving') m.handle({ type: 'save', reduceMotion: false });
  if (phase.type === 'closing') m.handle({ type: 'hide' });
  expect(phaseEquals(m.phase, phase)).toBe(true);
  return m;
}

const key = (e: NotchEffect): string => JSON.stringify(e);
const effectIn = (effects: NotchEffect[], e: NotchEffect): boolean => effects.some((x) => key(x) === key(e));
const effectTypeIn = (effects: NotchEffect[], type: NotchEffect['type']): boolean => effects.some((x) => x.type === type);
const isVisiblePhase = (p: NotchPhase): boolean => p.type === 'open' || p.type === 'saving';
const isClosedOrClosing = (p: NotchPhase): boolean => p.type === 'closed' || p.type === 'closing';

describe('NotchMachineTests', () => {
  // MARK: - 1. Show from closed

  it('showFromClosedOpensTheFullChoreography', () => {
    const m = new NotchMachine();
    const e = m.handle({ type: 'show' });
    expect(m.phase).toEqual({ type: 'open' });
    expect(m.generation).toBe(1);
    for (const x of [{ type: 'switchToOpenCanvas' }, { type: 'setIgnoresMouse', ignores: false }, { type: 'installLocalMonitor' },
      { type: 'animateOpen', fromSaved: false }, { type: 'postWillShow' }, { type: 'scheduleSettle', generation: 1 }, { type: 'scheduleFocusRetries' }] as NotchEffect[])
      expect(e).toContainEqual(x);
    expect(e).not.toContainEqual({ type: 'cancelClose' });
    expect(e).not.toContainEqual({ type: 'cancelSaveHold' });
    // Input is enabled before the window takes key status, the monitor before the view is told.
    const i = (x: NotchEffect) => e.findIndex((y) => JSON.stringify(y) === JSON.stringify(x));
    expect(i({ type: 'setIgnoresMouse', ignores: false }) < i({ type: 'makeKeyAndOrderFront' })).toBe(true);
    expect(i({ type: 'makeKeyAndOrderFront' }) < i({ type: 'installLocalMonitor' })).toBe(true);
    expect(i({ type: 'installLocalMonitor' }) < i({ type: 'postWillShow' })).toBe(true);
  });

  it('showFromParkedLeavesParkingAndCancelsAPendingDwell', () => {
    const m = machineIn(PARKED);
    m.handle({ type: 'hoverEntered' });
    expect(m.hoverDwellPending).toBe(true);
    const effects = m.handle({ type: 'show' });
    expect(m.phase).toEqual({ type: 'open' });
    expect(m.hoverDwellPending).toBe(false);
    expect(effects[0]).toEqual({ type: 'cancelHoverDwell' });
    expect(effects).toContainEqual({ type: 'switchToOpenCanvas' });
  });

  it('showWhileOpenIsANoOp', () => {
    const m = machineIn({ type: 'open' });
    const before = m.clone();
    expect(m.handle({ type: 'show' })).toEqual([]);
    expect(m.equals(before)).toBe(true);
  });

  // MARK: - 2. Show from closing (reverse mid-collapse)

  it('showFromClosingReversesWithoutSnapping', () => {
    const m = machineIn({ type: 'closing' });
    const effects = m.handle({ type: 'show' });
    expect(m.phase).toEqual({ type: 'open' });
    expect(effects).toContainEqual({ type: 'cancelClose' });
    // The shape reverses from where it is; no canvas reset.
    expect(effects).not.toContainEqual({ type: 'switchToOpenCanvas' });
    expect(effects).toContainEqual({ type: 'animateOpen', fromSaved: false });
    // The monitor was removed by hide.
    expect(effects).toContainEqual({ type: 'installLocalMonitor' });
  });

  // MARK: - 3. Reopen during the saved hold

  it('reopenDuringSavedHoldCancelsTheHoldAndDropsTheBadge', () => {
    const m = machineIn({ type: 'saving' });
    expect(m.badgeShown).toBe(true);
    const effects = m.handle({ type: 'show' });
    expect(m.phase).toEqual({ type: 'open' });
    expect(m.badgeShown).toBe(false);
    expect(effects).toContainEqual({ type: 'cancelSaveHold' });
    expect(effects).toContainEqual({ type: 'clearBadgeNoAnimation' });
    expect(effects).toContainEqual({ type: 'animateOpen', fromSaved: true });
    expect(effects).not.toContainEqual({ type: 'switchToOpenCanvas' });
    // The local monitor stays installed during the hold.
    expect(effects).not.toContainEqual({ type: 'installLocalMonitor' });
    expect(effects).not.toContainEqual({ type: 'cancelClose' });
  });

  it('notchTapDuringSavedHoldDoesNothing', () => {
    const m = machineIn({ type: 'saving' });
    const before = m.clone();
    expect(m.handle({ type: 'notchTapped' })).toEqual([]);
    expect(m.equals(before)).toBe(true);
  });

  it('notchTapOnlyActsOnTheParkedNotch', () => {
    for (const phase of [{ type: 'closing' }, { type: 'open' }, { type: 'saving' }, { type: 'closed', parked: false }] as NotchPhase[]) {
      const m = machineIn(phase);
      const before = m.clone();
      expect(m.handle({ type: 'notchTapped' }), `tap in ${JSON.stringify(phase)} is ignored`).toEqual([]);
      expect(m.equals(before)).toBe(true);
    }
    const parked = machineIn(PARKED);
    expect(parked.handle({ type: 'notchTapped' })).toContainEqual({ type: 'animateOpen', fromSaved: false });
    expect(parked.phase).toEqual({ type: 'open' });
  });

  // MARK: - 4. Full save choreography

  it('saveThenHoldThenCloseParksOverANotch', () => {
    const m = machineIn({ type: 'open' });
    expect(m.handle({ type: 'save', reduceMotion: false })).toEqual([{ type: 'setSettled', settled: false }, { type: 'animateSaving' },
      { type: 'setIgnoresMouse', ignores: true }, { type: 'resignFirstResponder' }, { type: 'scheduleSaveHold' }]);
    expect(m.phase).toEqual({ type: 'saving' });
    expect(m.badgeShown).toBe(true);
    const hold = m.handle({ type: 'saveHoldElapsed' });
    expect(m.phase).toEqual({ type: 'closing' });
    // The badge fades in place; it is only dropped once the window is parked.
    expect(m.badgeShown).toBe(true);
    // The hold ran out on its own.
    expect(hold).not.toContainEqual({ type: 'cancelSaveHold' });
    for (const x of ['postDidHide', 'removeLocalMonitor', 'resignFirstResponder', 'animateClose', 'scheduleClose'] as const) expect(hold).toContainEqual({ type: x });
    expect(m.handle({ type: 'closeTimerFired', hasNotch: true })).toEqual([{ type: 'clearBadgeNoAnimation' }, { type: 'park' }]);
    expect(m.phase).toEqual({ type: 'closed', parked: true });
    expect(m.badgeShown).toBe(false);
  });

  it('closeTimerOrdersOutWithoutANotch', () => {
    const m = machineIn({ type: 'saving' });
    m.handle({ type: 'saveHoldElapsed' });
    const close = m.handle({ type: 'closeTimerFired', hasNotch: false });
    expect(m.phase).toEqual({ type: 'closed', parked: false });
    expect(m.badgeShown).toBe(false);
    expect(close).toEqual([{ type: 'clearBadgeNoAnimation' }, { type: 'orderOut' }]);
  });

  it('saveWithReduceMotionIsAPlainHide', () => {
    const m = machineIn({ type: 'open' });
    const effects = m.handle({ type: 'save', reduceMotion: true });
    expect(m.phase).toEqual({ type: 'closing' });
    expect(m.badgeShown).toBe(false);
    expect(effects).not.toContainEqual({ type: 'animateSaving' });
    expect(effects).toContainEqual({ type: 'animateClose' });
    expect(effects).toContainEqual({ type: 'scheduleClose' });
  });

  it('saveBumpsTheGenerationSoTheSettleTimerCannotDropTheMask', () => {
    const m = machineIn({ type: 'open' });
    const settleGeneration = m.generation;
    m.handle({ type: 'save', reduceMotion: false });
    expect(m.generation).toBe(settleGeneration + 1);
    expect(m.handle({ type: 'settleTimerFired', generation: settleGeneration })).toEqual([]);
  });

  it('settleTimerOnlyCountsForTheCurrentGeneration', () => {
    const m = new NotchMachine();
    m.handle({ type: 'show' });
    const first = m.generation;
    m.handle({ type: 'hide' });
    m.handle({ type: 'show' });
    expect(m.handle({ type: 'settleTimerFired', generation: first }), 'stale timer from the first show').toEqual([]);
    expect(m.handle({ type: 'settleTimerFired', generation: m.generation })).toEqual([{ type: 'setSettled', settled: true }]);
    m.handle({ type: 'hide' });
    expect(m.handle({ type: 'settleTimerFired', generation: m.generation }), 'not while closing').toEqual([]);
  });

  // MARK: - 5. Hover on the parked notch

  it('hoverDwellSwellsWithHapticAndUnswellsOnExit', () => {
    const m = machineIn(PARKED);
    expect(m.hoverArmed).toBe(true);
    expect(m.handle({ type: 'hoverEntered' })).toEqual([{ type: 'scheduleHoverDwell' }]);
    expect(m.hoverDwellPending).toBe(true);
    expect(m.handle({ type: 'hoverEntered' }), 'one dwell at a time').toEqual([]);
    expect(m.handle({ type: 'hoverDwellElapsed', reduceMotion: false })).toEqual([{ type: 'swellHover' }, { type: 'haptic' }]);
    expect(m.hoverSwollen).toBe(true);
    expect(m.hoverDwellPending).toBe(false);
    expect(m.handle({ type: 'hoverEntered' }), 'already swollen').toEqual([]);
    expect(m.handle({ type: 'hoverExited' })).toEqual([{ type: 'unswellHover' }]);
    expect(m.hoverSwollen).toBe(false);
    expect(m.hoverArmed).toBe(true);
  });

  it('hoverExitDuringDwellCancelsIt', () => {
    const m = machineIn(PARKED);
    m.handle({ type: 'hoverEntered' });
    expect(m.handle({ type: 'hoverExited' })).toEqual([{ type: 'cancelHoverDwell' }]);
    expect(m.hoverDwellPending).toBe(false);
    expect(m.handle({ type: 'hoverDwellElapsed', reduceMotion: false }), 'a late fire after cancel changes nothing').toEqual([]);
    expect(m.hoverSwollen).toBe(false);
  });

  it('hoverDwellWithReduceMotionOnlyTapsTheTrackpad', () => {
    const m = machineIn(PARKED);
    m.handle({ type: 'hoverEntered' });
    expect(m.handle({ type: 'hoverDwellElapsed', reduceMotion: true })).toEqual([{ type: 'haptic' }]);
    expect(m.hoverSwollen).toBe(false);
    expect(m.handle({ type: 'hoverExited' })).toEqual([]);
  });

  it('parkingUnderThePointerDisarmsHoverUntilItLeaves', () => {
    const m = machineIn({ type: 'closing' });
    m.handle({ type: 'closeTimerFired', hasNotch: true }, true);
    expect(m.phase).toEqual({ type: 'closed', parked: true });
    expect(m.hoverArmed).toBe(false);
    expect(m.handle({ type: 'hoverEntered' })).toEqual([]);
    expect(m.hoverDwellPending).toBe(false);
    expect(m.handle({ type: 'hoverExited' })).toEqual([]);
    expect(m.hoverArmed).toBe(true);
    expect(m.handle({ type: 'hoverEntered' })).toEqual([{ type: 'scheduleHoverDwell' }]);
  });

  it('parkingAwayFromThePointerArmsHoverImmediately', () => {
    const m = machineIn({ type: 'closing' });
    m.handle({ type: 'closeTimerFired', hasNotch: true }, false);
    expect(m.hoverArmed).toBe(true);
    expect(m.handle({ type: 'hoverEntered' })).toEqual([{ type: 'scheduleHoverDwell' }]);
  });

  it('hoverIsIgnoredUnlessParked', () => {
    for (const p of ALL_PHASES.filter((p) => !(p.type === 'closed' && p.parked))) {
      const m = machineIn(p), before = m.clone();
      expect(m.handle({ type: 'hoverEntered' })).toEqual([]);
      expect(m.handle({ type: 'hoverExited' })).toEqual([]);
      expect(m.equals(before)).toBe(true);
    }
  });

  it('screenChangeWhileParkedReparksAndRearmsFromThePointer', () => {
    const m = machineIn(PARKED);
    m.handle({ type: 'hoverEntered' });
    m.handle({ type: 'hoverDwellElapsed', reduceMotion: false });
    expect(m.hoverSwollen).toBe(true);
    expect(m.handle({ type: 'screenChanged', hasNotch: true }, true)).toEqual([{ type: 'configureGeometry' }, { type: 'park' }]);
    expect(m.phase).toEqual({ type: 'closed', parked: true });
    expect(m.hoverSwollen).toBe(false);
    expect(m.hoverArmed).toBe(false);
  });

  // MARK: - 6. Guards

  it('secondSaveIsSwallowed', () => {
    const m = machineIn({ type: 'open' });
    m.handle({ type: 'save', reduceMotion: false });
    const before = m.clone();
    expect(m.handle({ type: 'save', reduceMotion: false })).toEqual([]);
    expect(m.handle({ type: 'save', reduceMotion: true })).toEqual([]);
    expect(m.equals(before)).toBe(true);
  });

  it('saveIsOnlyPossibleWhileOpen', () => {
    for (const p of ALL_PHASES.filter((p) => p.type !== 'open')) {
      const m = machineIn(p), before = m.clone();
      expect(m.handle({ type: 'save', reduceMotion: false }), JSON.stringify(p)).toEqual([]);
      expect(m.equals(before), JSON.stringify(p)).toBe(true);
    }
  });

  it('hideDuringSavingCancelsTheHold', () => {
    const m = machineIn({ type: 'saving' });
    const effects = m.handle({ type: 'hide' });
    expect(m.phase).toEqual({ type: 'closing' });
    expect(effects[0]).toEqual({ type: 'cancelSaveHold' });
    expect(effects).toContainEqual({ type: 'animateClose' });
    expect(effects).toContainEqual({ type: 'scheduleClose' });
  });

  it('hideIsANoOpUnlessVisible', () => {
    for (const p of [{ type: 'closed', parked: false }, { type: 'closed', parked: true }, { type: 'closing' }] as NotchPhase[]) {
      const m = machineIn(p), before = m.clone();
      expect(m.handle({ type: 'hide' }), JSON.stringify(p)).toEqual([]);
      expect(m.equals(before), JSON.stringify(p)).toBe(true);
    }
  });

  it('staleTimersAreIgnored', () => {
    const m = machineIn({ type: 'open' });
    expect(m.handle({ type: 'saveHoldElapsed' })).toEqual([]);
    expect(m.handle({ type: 'closeTimerFired', hasNotch: true })).toEqual([]);
    expect(m.handle({ type: 'closeTimerFired', hasNotch: false })).toEqual([]);
    expect(m.phase).toEqual({ type: 'open' });
  });

  // MARK: - Screen changes

  it('screenChangeRelayoutsTheOpenWindowAndSkipsAClosingOne', () => {
    const open = machineIn({ type: 'open' });
    expect(open.handle({ type: 'screenChanged', hasNotch: true })).toEqual([{ type: 'configureGeometry' }, { type: 'relayoutOpenWindow' }]);
    expect(open.phase).toEqual({ type: 'open' });

    const saving = machineIn({ type: 'saving' });
    expect(saving.handle({ type: 'screenChanged', hasNotch: false })).toEqual([{ type: 'configureGeometry' }, { type: 'relayoutOpenWindow' }]);

    const closing = machineIn({ type: 'closing' });
    // The close timer parks on the then-current screen.
    expect(closing.handle({ type: 'screenChanged', hasNotch: true })).toEqual([{ type: 'configureGeometry' }]);
    expect(closing.phase).toEqual({ type: 'closing' });
  });

  it('screenChangeParksAndUnparksClosedWindows', () => {
    const m = new NotchMachine();
    expect(m.handle({ type: 'screenChanged', hasNotch: false }), 'nothing to order out').toEqual([{ type: 'configureGeometry' }]);
    expect(m.handle({ type: 'screenChanged', hasNotch: true })).toEqual([{ type: 'configureGeometry' }, { type: 'park' }]);
    expect(m.phase).toEqual({ type: 'closed', parked: true });
    expect(m.handle({ type: 'screenChanged', hasNotch: false }), 'the target screen lost its notch').toEqual([{ type: 'configureGeometry' }, { type: 'orderOut' }]);
    expect(m.phase).toEqual({ type: 'closed', parked: false });
  });

  // MARK: - 7. Exhaustive sequences

  /**
   * Swift `alphabet(for:)`: every event, every payload, and both pointer positions where they
   * matter. Settle timers are generated relative to the current generation (current and stale),
   * so the transition function is independent of its value.
   */
  function alphabet(m: NotchMachine): Array<{ event: NotchEvent; pointerOnNotch: boolean }> {
    const g = m.generation;
    const rows: Array<[NotchEvent, boolean]> = [
      [{ type: 'show' }, false], [{ type: 'hide' }, false], [{ type: 'notchTapped' }, false],
      [{ type: 'save', reduceMotion: false }, false], [{ type: 'save', reduceMotion: true }, false],
      [{ type: 'saveHoldElapsed' }, false],
      [{ type: 'closeTimerFired', hasNotch: true }, false], [{ type: 'closeTimerFired', hasNotch: true }, true], [{ type: 'closeTimerFired', hasNotch: false }, false],
      [{ type: 'settleTimerFired', generation: g }, false], [{ type: 'settleTimerFired', generation: (g - 1) >>> 0 }, false],
      [{ type: 'hoverEntered' }, false], [{ type: 'hoverDwellElapsed', reduceMotion: false }, false], [{ type: 'hoverDwellElapsed', reduceMotion: true }, false], [{ type: 'hoverExited' }, false],
      [{ type: 'screenChanged', hasNotch: true }, false], [{ type: 'screenChanged', hasNotch: true }, true], [{ type: 'screenChanged', hasNotch: false }, false],
    ];
    return rows.map(([event, pointerOnNotch]) => ({ event, pointerOnNotch }));
  }

  /** Swift `Shape`: everything about a machine except the generation counter. The phase JSON comes first so a phase can be looked up by prefix. */
  function shape(m: NotchMachine): string {
    return `${JSON.stringify(m.phase)}|${JSON.stringify({ badgeShown: m.badgeShown, hoverSwollen: m.hoverSwollen, hoverArmed: m.hoverArmed, hoverDwellPending: m.hoverDwellPending })}`;
  }

  /** Swift `checkTransition`: the invariants that must hold for every single transition. */
  function checkTransition(before: NotchMachine, event: NotchEvent, pointerOnNotch: boolean, effects: NotchEffect[], after: NotchMachine): void {
    const context = `${JSON.stringify(event)} (pointerOnNotch: ${pointerOnNotch}) from ${JSON.stringify(before.snapshot())} → ${JSON.stringify(after.snapshot())}: ${JSON.stringify(effects)}`;
    const has = (e: NotchEffect) => effectIn(effects, e);
    const hasAnimateOpen = effectTypeIn(effects, 'animateOpen');
    const hasScheduleSettle = effectTypeIn(effects, 'scheduleSettle');
    const afterParked = phaseEquals(after.phase, PARKED);
    const check = (cond: boolean, what: string) => expect(cond, `${what} — ${context}`).toBe(true);

    // Badge lifetime: from the save until the window is parked / ordered out (or reopened).
    check(!after.badgeShown || after.phase.type === 'saving' || after.phase.type === 'closing', 'badge only while saving/closing');
    // Mouse input is only re-enabled for the open panel (the parked window manages its own flag inside `park`).
    check(!has({ type: 'setIgnoresMouse', ignores: false }) || after.phase.type === 'open', 'setIgnoresMouse(false) for a non-open phase');
    // The local monitor is installed exactly while visible, so install/remove alternate.
    check(has({ type: 'installLocalMonitor' }) === (!isVisiblePhase(before.phase) && isVisiblePhase(after.phase)), 'monitor install');
    check(has({ type: 'removeLocalMonitor' }) === (isVisiblePhase(before.phase) && !isVisiblePhase(after.phase)), 'monitor remove');
    // Parking / ordering out never happens from an open or saving panel and lands in the matching closed state.
    check(!has({ type: 'park' }) || (isClosedOrClosing(before.phase) && afterParked), 'park');
    check(!has({ type: 'orderOut' }) || (isClosedOrClosing(before.phase) && phaseEquals(after.phase, { type: 'closed', parked: false })), 'orderOut');
    check(!(has({ type: 'park' }) && has({ type: 'orderOut' })), 'park and orderOut together');
    // The swell only exists on the parked closed silhouette.
    check(!after.hoverSwollen || afterParked, 'swollen outside parked');
    check(!has({ type: 'swellHover' }) || after.hoverSwollen, 'swellHover without hoverSwollen');
    check(!has({ type: 'unswellHover' }) || (before.hoverSwollen && !after.hoverSwollen), 'unswellHover');
    // Never open and close in the same breath.
    check(!(hasAnimateOpen && has({ type: 'animateClose' })), 'animateOpen + animateClose');
    check(!(hasAnimateOpen && has({ type: 'animateSaving' })), 'animateOpen + animateSaving');
    // Animations and timers match the phase they lead to.
    check(hasAnimateOpen === (after.phase.type === 'open' && before.phase.type !== 'open'), 'animateOpen ⇔ became open');
    check(hasScheduleSettle === hasAnimateOpen, 'settle timer accompanies every open');
    check(has({ type: 'scheduleClose' }) === (after.phase.type === 'closing' && before.phase.type !== 'closing'), 'scheduleClose ⇔ became closing');
    check(has({ type: 'animateClose' }) === has({ type: 'scheduleClose' }), 'animateClose ⇔ scheduleClose');
    check(has({ type: 'scheduleSaveHold' }) === (after.phase.type === 'saving' && before.phase.type !== 'saving'), 'scheduleSaveHold ⇔ became saving');
    check(has({ type: 'animateSaving' }) === has({ type: 'scheduleSaveHold' }), 'animateSaving ⇔ scheduleSaveHold');
    check(!has({ type: 'animateSaving' }) || after.badgeShown, 'saving shows the badge');
    check(!has({ type: 'cancelClose' }) || before.phase.type === 'closing', 'cancelClose only while closing');
    check(!has({ type: 'cancelSaveHold' }) || before.phase.type === 'saving', 'cancelSaveHold only while saving');
    // Hover dwell bookkeeping.
    check(has({ type: 'scheduleHoverDwell' }) === (!before.hoverDwellPending && after.hoverDwellPending), 'scheduleHoverDwell');
    check(!has({ type: 'scheduleHoverDwell' }) || afterParked, 'dwell only while parked');
    check(!has({ type: 'cancelHoverDwell' }) || (before.hoverDwellPending && !after.hoverDwellPending), 'cancelHoverDwell');
    check(!has({ type: 'haptic' }) || (before.hoverDwellPending && !after.hoverDwellPending && before.hoverArmed), 'haptic only when an armed dwell elapses');
    check(!has({ type: 'swellHover' }) || has({ type: 'haptic' }), 'swell always comes with the haptic');
    // The generation never goes backwards and only moves on show / save.
    check(after.generation >= before.generation, 'generation');
    check((after.generation !== before.generation) === (hasAnimateOpen || has({ type: 'animateSaving' })), 'generation bump ⇔ show/save');
    // Each effect at most once per transition.
    check(new Set(effects.map(key)).size === effects.length, 'duplicate effect');
    // Leaving the parked state or reopening must never leave a swell behind.
    check(!(before.hoverSwollen && !afterParked) || !after.hoverSwollen, 'swell survived leaving parked');
  }

  /**
   * Swift `explore(from:depth:memo:shapes:)`: every event sequence of length ≤ `depth` from
   * `start`, memoised on the machine's shape. Returns the number of distinct sequences covered.
   */
  function explore(start: NotchMachine, depth: number, memo: Map<string, number>, shapes: Set<string>): number {
    const startShape = shape(start);
    shapes.add(startShape);
    if (depth <= 0) return 0;
    const memoKey = `${startShape}@${depth}`;
    const cached = memo.get(memoKey);
    if (cached !== undefined) return cached;
    let count = 0;
    for (const { event, pointerOnNotch } of alphabet(start)) {
      const next = start.clone();
      const effects = next.handle(event, pointerOnNotch);
      checkTransition(start, event, pointerOnNotch, effects, next);
      count += 1 + explore(next, depth - 1, memo, shapes);
    }
    memo.set(memoKey, count);
    return count;
  }

  it('everySequenceUpToLengthFiveKeepsTheInvariants', () => {
    let sequences = 0; const memo = new Map<string, number>(); const shapes = new Set<string>();
    for (const p of ALL_PHASES) sequences += explore(machineIn(p), 5, memo, shapes);
    // 5 starting phases × Σ_{k=1..5} 18^k distinct sequences.
    expect(alphabet(new NotchMachine())).toHaveLength(18);
    expect(sequences).toBe(5 * (18 + 18 ** 2 + 18 ** 3 + 18 ** 4 + 18 ** 5)); // 10 003 590
    // The reachable state space is tiny (5 phases × 4 flags ≤ 80 shapes) and always includes every phase.
    expect(shapes.size, 'a new flag or phase changes the reachable state space — update this on purpose').toBe(17);
    for (const p of ALL_PHASES) expect([...shapes].some((s) => s.startsWith(JSON.stringify(p))), `${JSON.stringify(p)} reachable`).toBe(true);
  });

  it('handleIsDeterministicAndValueSemantic', () => {
    const m = machineIn({ type: 'saving' });
    const a = m.clone(), b = m.clone();
    expect(a.handle({ type: 'show' })).toEqual(b.handle({ type: 'show' }));
    expect(a.equals(b)).toBe(true);
    // The original is untouched.
    expect(m.phase).toEqual({ type: 'saving' });
  });
});

describe('notchMachine (TS)', () => {
  it('showFromClosedEffectOrder (contracts §2.14)', () => expect(new NotchMachine().handle({ type: 'show' })).toEqual([
    { type: 'clearBadgeNoAnimation' }, { type: 'configureGeometry' }, { type: 'switchToOpenCanvas' }, { type: 'setIgnoresMouse', ignores: false },
    { type: 'makeKeyAndOrderFront' }, { type: 'installLocalMonitor' }, { type: 'postWillShow' }, { type: 'animateOpen', fromSaved: false },
    { type: 'scheduleSettle', generation: 1 }, { type: 'scheduleFocusRetries' }]));
  it('closeEffectOrder (contracts §2.14)', () => expect(machineIn({ type: 'saving' }).handle({ type: 'hide' })).toEqual([
    { type: 'cancelSaveHold' }, { type: 'postDidHide' }, { type: 'removeLocalMonitor' }, { type: 'resignFirstResponder' },
    { type: 'setIgnoresMouse', ignores: true }, { type: 'setSettled', settled: false }, { type: 'animateClose' }, { type: 'scheduleClose' }]));
  it('generationWrapsLikeUInt32', () => {
    const m = new NotchMachine();
    (m as unknown as { _generation: number })._generation = 0xFFFF_FFFF;
    m.handle({ type: 'show' });
    expect(m.generation).toBe(0);
  });
  it('sectionHelpersFollowSwiftNotchSection', () => {
    expect(isSchedule('controls')).toBe(true);
    expect(isSchedule('calendar')).toBe(true);
    expect(isSchedule('location')).toBe(false);
    expect(isSchedule('none')).toBe(false);
    expect(afterEscape('calendar')).toBe('controls');
    expect(afterEscape('controls')).toBe('none');
    expect(afterEscape('location')).toBe('none');
    expect(afterEscape('none')).toBe('none');
  });
});
