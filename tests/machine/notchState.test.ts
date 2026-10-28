import { describe, expect, it } from 'vitest';
import { NotchLayout } from '../../src/recreation/machine/notchLayout';
import { contains } from '../../src/recreation/machine/notchShape';
import { closedCanvasSize, currentSize, hoverSize, INITIAL_FLAGS, notchBandHeight, panelSize, radii, savedSize, sizesFor, tallestSectionSize, type NotchFlags } from '../../src/recreation/machine/notchState';

const S = sizesFor({ width: 221, height: 38 }, 982);
const f = (patch: Partial<NotchFlags>): NotchFlags => ({ ...INITIAL_FLAGS, ...patch });

describe('NotchStateTests (precedence)', () => {
  it('hoverSizeIsClosedPlusGrowth', () => {
    expect(hoverSize(S).width - S.closedSize.width).toBe(NotchLayout.hoverGrowth.width);
    expect(hoverSize(S).height - S.closedSize.height).toBe(NotchLayout.hoverGrowth.height);
  });
  it('closedCanvasContainsSwollenShapeAndIsSmallerThanOpenCanvas', () => {
    const c = closedCanvasSize(S), h = hoverSize(S), open = NotchLayout.canvasSize(S.openSize);
    expect(c.width >= h.width && c.height >= h.height).toBe(true);
    expect(c.width < open.width && c.height < open.height).toBe(true);
  });
  it('currentSizePrecedence', () => {
    expect(currentSize(f({ isSaving: true, isOpen: true, isHovering: true }), S)).toEqual(savedSize(S));
    expect(currentSize(f({ isOpen: true, isHovering: true }), S)).toEqual(S.openSize);
    expect(currentSize(f({ isHovering: true }), S)).toEqual(hoverSize(S));
    expect(currentSize(f({}), S)).toEqual(S.closedSize);
  });
  it('closedHitTest', () => {
    const c = closedCanvasSize(S);
    expect(contains({ x: c.width / 2, y: S.closedSize.height / 2 }, c.width, S.closedSize, 6, 14)).toBe(true);
    expect(contains({ x: 2, y: 10 }, c.width, S.closedSize, 6, 14)).toBe(false);
  });
  it('currentSizeFollowsTheScheduleWhileOpen', () => {
    expect(currentSize(f({ isOpen: true }), S)).toEqual(S.openSize);
    expect(currentSize(f({ isOpen: true, section: 'controls' }), S)).toEqual(S.scheduleSize);
    expect(currentSize(f({ isOpen: true, section: 'calendar' }), S)).toEqual(S.scheduleCalendarSize);
    expect(currentSize(f({ isOpen: true, section: 'calendar', isSaving: true }), S)).toEqual(savedSize(S));
    expect(currentSize(f({ section: 'calendar' }), S)).toEqual(S.closedSize);
  });
  it('locationSizeAndPrecedence (state)', () => {
    expect(currentSize(f({ isOpen: true, section: 'location' }), S)).toEqual(S.locationSize);
    expect(panelSize(S, 'location')).toEqual({ width: 600, height: 347 });
    expect(tallestSectionSize(S)).toEqual(S.scheduleCalendarSize);   // the calendar stays the tallest: the canvas does not change
  });
});

describe('notchState (TS)', () => {
  it('sizesOnTheFake14InchScreen', () => expect(S).toEqual({
    closedSize: { width: 235, height: 39 }, openSize: { width: 600, height: 241 },
    scheduleSize: { width: 600, height: 519 }, scheduleCalendarSize: { width: 600, height: 751 }, locationSize: { width: 600, height: 347 },
  }));
  it('aShortScreenClampsTheCalendar', () => {
    const short = sizesFor({ width: 221, height: 38 }, 700);
    expect(short.scheduleCalendarSize).toEqual({ width: 600, height: 660 });
    expect(short.locationSize).toEqual({ width: 600, height: 347 });            // 347 < 660: unclamped
  });
  it('bandAndSaved', () => {
    expect(notchBandHeight(S)).toBe(39);
    expect(savedSize(S)).toEqual({ width: 379, height: 39 });
  });
  it('radii', () => {
    expect(radii(f({ isOpen: true }))).toEqual({ top: 19, bottom: 32 });
    expect(radii(f({ isSaving: true }))).toEqual({ top: 6, bottom: 14 });
  });
  it('initialFlags', () => expect(INITIAL_FLAGS).toEqual({ isOpen: false, contentVisible: false, isSettled: false, isSaving: false, savedBadgeShown: false, isHovering: false, section: 'none' }));
});
