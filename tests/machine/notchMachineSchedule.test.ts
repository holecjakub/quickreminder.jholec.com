import { describe, expect, it } from 'vitest';
import { afterEscape, isSchedule, NotchMachine, type NotchEffect, type NotchEvent, type NotchSection } from '../../src/recreation/machine/notchMachine';

// Port of Tests/QuickReminderCoreTests/NotchMachineScheduleTests.swift (app 144d620): the 16
// Swift cases under their Swift names. The in-notch sections (Set Date controls / calendar and
// Location): the open blob grows for the section and settles back. No effect ever touches the
// window during a section change: the open canvas is already sized for the tallest state at open
// (`NotchLayout.openCanvasSize`).

/** Swift `openMachine()`. */
const open = (): NotchMachine => {
  const m = new NotchMachine();
  m.handle({ type: 'show' });
  return m;
};

/** The one and only section transition: mask on, section spring, settle after. */
const step = (x: NotchSection, g: number): NotchEffect[] =>
  [{ type: 'setSettled', settled: false }, { type: 'animateSection', section: x }, { type: 'scheduleSettle', generation: g }];

describe('NotchMachineScheduleTests', () => {
  // Only SwiftUI state springs: no window / canvas effect, so nothing above the bar can shift.
  it('openingTheScheduleOnlyAnimatesUnderTheMask', () => {
    const m = open();
    const before = m.generation;
    const effects = m.handle({ type: 'sectionChanged', section: 'controls' });
    expect(m.section).toBe('controls');
    expect(m.generation).toBe(before + 1);
    expect(effects).toEqual(step('controls', before + 1));
  });

  // Every schedule step, there and back, is the same three effects — none of them geometry.
  it('noScheduleStepTouchesTheWindow', () => {
    const m = open();
    const windowEffects: NotchEffect['type'][] = ['configureGeometry', 'switchToOpenCanvas', 'relayoutOpenWindow', 'park', 'orderOut'];
    for (const x of ['controls', 'calendar', 'controls', 'none', 'calendar', 'none'] as NotchSection[]) {
      const effects = m.handle({ type: 'sectionChanged', section: x });
      expect(effects, x).toEqual(step(x, m.generation));
      expect(effects.some((e) => windowEffects.includes(e.type))).toBe(false);
      expect(m.handle({ type: 'settleTimerFired', generation: m.generation })).toEqual([{ type: 'setSettled', settled: true }]);
    }
  });

  it('calendarToggleOnlyAnimatesTheCanvasIsAlreadyTallEnough', () => {
    const m = open();
    m.handle({ type: 'sectionChanged', section: 'controls' });
    const effects = m.handle({ type: 'sectionChanged', section: 'calendar' });
    expect(m.section).toBe('calendar');
    expect(effects).toEqual(step('calendar', m.generation));
  });

  // A show while Set Date is open in the notch (URL scheme, menu item, Raycast / Spotlight
  // reopen) returns to the plain panel through the Cancel transition, so NotchState follows.
  it('showWhileScheduledResetsTheSchedule', () => {
    const m = open();
    m.handle({ type: 'sectionChanged', section: 'calendar' });
    const effects = m.handle({ type: 'show' });
    expect(m.phase).toEqual({ type: 'open' });
    expect(m.section).toBe('none');
    expect(effects).toEqual(step('none', m.generation));
    expect(m.handle({ type: 'settleTimerFired', generation: m.generation })).toEqual([{ type: 'setSettled', settled: true }]);
    // Plain and open: a further show is still a no-op.
    expect(m.handle({ type: 'show' })).toEqual([]);
    // And the section can be opened again afterwards (the machine is not stuck).
    expect(m.handle({ type: 'sectionChanged', section: 'controls' })).toContainEqual({ type: 'animateSection', section: 'controls' });
  });

  it('sameExpansionTwiceIsANoOp', () => {
    const m = open();
    m.handle({ type: 'sectionChanged', section: 'controls' });
    const generation = m.generation;
    expect(m.handle({ type: 'sectionChanged', section: 'controls' })).toEqual([]);
    expect(m.generation).toBe(generation);
    const plain = open();
    expect(plain.handle({ type: 'sectionChanged', section: 'none' }), 'closing a section that is not open').toEqual([]);
  });

  it.each<NotchEvent>([{ type: 'hide' }, { type: 'save', reduceMotion: false }])('ignoredUnlessOpen (%j)', (leaving) => {
    const m = open();
    m.handle(leaving);
    expect(m.handle({ type: 'sectionChanged', section: 'controls' })).toEqual([]);
    expect(m.section).toBe('none');
    const closed = new NotchMachine();
    expect(closed.handle({ type: 'sectionChanged', section: 'calendar' })).toEqual([]);
  });

  // Set / Cancel / Esc: the blob springs back under the mask, which drops once it settles.
  it('closingSettlesUnderTheMask', () => {
    const m = open();
    m.handle({ type: 'sectionChanged', section: 'calendar' });
    const effects = m.handle({ type: 'sectionChanged', section: 'none' });
    expect(effects).toEqual(step('none', m.generation));
    expect(m.handle({ type: 'settleTimerFired', generation: m.generation })).toEqual([{ type: 'setSettled', settled: true }]);
  });

  it('staleSettleFromBeforeTheScheduleChangeIsDropped', () => {
    const m = open();
    const openGeneration = m.generation;
    m.handle({ type: 'sectionChanged', section: 'controls' });
    expect(m.handle({ type: 'settleTimerFired', generation: openGeneration }), 'the open settle must not drop the mask mid-growth').toEqual([]);
  });

  it('hideAndSaveResetTheSchedule', () => {
    const m = open();
    m.handle({ type: 'sectionChanged', section: 'calendar' });
    m.handle({ type: 'hide' });
    expect(m.section).toBe('none');

    const s = open();
    s.handle({ type: 'sectionChanged', section: 'controls' });
    s.handle({ type: 'save', reduceMotion: false });
    expect(s.section).toBe('none');
  });

  // After parking, a reopen switches to a fresh open canvas exactly once and starts plain.
  it('reopenAfterParkingSwitchesCanvasOnceAndStartsPlain', () => {
    const m = new NotchMachine();
    m.handle({ type: 'screenChanged', hasNotch: true });
    const firstOpen = m.handle({ type: 'show' });
    expect(firstOpen.filter((e) => e.type === 'switchToOpenCanvas')).toHaveLength(1);
    m.handle({ type: 'sectionChanged', section: 'controls' });
    m.handle({ type: 'hide' });
    m.handle({ type: 'closeTimerFired', hasNotch: true });
    expect(m.phase).toEqual({ type: 'closed', parked: true });
    const reopen = m.handle({ type: 'show' });
    expect(reopen.filter((e) => e.type === 'switchToOpenCanvas')).toHaveLength(1);
    expect(reopen.some((e) => e.type === 'animateSection'), 'the plain start is set without animation inside switchToOpenCanvas').toBe(false);
    expect(m.section).toBe('none');
  });

  // Reopening mid-collapse keeps the open window as it is (same size, no switch).
  it('reopenMidCollapseKeepsTheWindow', () => {
    const m = open();
    m.handle({ type: 'sectionChanged', section: 'controls' });
    m.handle({ type: 'hide' });
    const effects = m.handle({ type: 'show' });
    expect(effects).not.toContainEqual({ type: 'switchToOpenCanvas' });
    expect(m.section).toBe('none');
    expect(m.handle({ type: 'settleTimerFired', generation: m.generation })).toEqual([{ type: 'setSettled', settled: true }]);
  });

  it('screenChangeWhileScheduledRelayoutsTheOpenWindow', () => {
    const m = open();
    m.handle({ type: 'sectionChanged', section: 'calendar' });
    const effects = m.handle({ type: 'screenChanged', hasNotch: true });
    expect(effects).toEqual([{ type: 'configureGeometry' }, { type: 'relayoutOpenWindow' }]);
    expect(m.section).toBe('calendar');
  });

  // Esc steps back one level; the panel itself is never closed by these steps.
  it('escapeStepsBackOneLevel', () => {
    expect(afterEscape('calendar')).toBe('controls');
    expect(afterEscape('controls')).toBe('none');
    expect(afterEscape('none')).toBe('none');
    const m = open();
    m.handle({ type: 'sectionChanged', section: 'calendar' });
    m.handle({ type: 'sectionChanged', section: afterEscape(m.section) });
    expect([m.section, m.phase.type]).toEqual(['controls', 'open']);
    m.handle({ type: 'sectionChanged', section: afterEscape(m.section) });
    expect([m.section, m.phase.type]).toEqual(['none', 'open']);
  });

  // MARK: - Location (one section at a time)

  it('locationIsASectionLikeSetDate', () => {
    const m = open();
    const effects = m.handle({ type: 'sectionChanged', section: 'location' });
    expect(m.section).toBe('location');
    expect(effects).toEqual(step('location', m.generation));
  });

  // Opening one section while the other is shown switches over in one spring (no close first).
  it.each<[NotchSection, NotchSection]>([['calendar', 'location'], ['location', 'controls'], ['controls', 'location']])('switchingSectionsIsOneStep (%s → %s)', (from, to) => {
    const m = open();
    m.handle({ type: 'sectionChanged', section: from });
    const effects = m.handle({ type: 'sectionChanged', section: to });
    expect(m.section).toBe(to);
    expect(effects).toEqual(step(to, m.generation));
  });

  it('escapeAndShowCloseLocation', () => {
    expect(afterEscape('location')).toBe('none');
    expect(isSchedule('location')).toBe(false);
    expect(isSchedule('controls') && isSchedule('calendar')).toBe(true);
    expect(isSchedule('none')).toBe(false);
    const m = open();
    m.handle({ type: 'sectionChanged', section: 'location' });
    m.handle({ type: 'show' });
    expect(m.section, 'a show while Location is open returns to the plain panel').toBe('none');
    m.handle({ type: 'sectionChanged', section: 'location' });
    m.handle({ type: 'hide' });
    expect(m.section).toBe('none');
  });
});
