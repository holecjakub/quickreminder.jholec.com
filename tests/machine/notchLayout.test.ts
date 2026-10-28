import { describe, expect, it } from 'vitest';
import { NotchLayout as L, ScheduleMetrics as M, LocationMetrics as LM, type NotchSection } from '../../src/recreation/machine/notchLayout';

describe('NotchStateTests (layout)', () => {
  it('notchLayoutInvariants', () => {
    expect(L.openSize().height).toBeGreaterThan(38 + 150);
    expect(L.openSize(50).height).toBe(L.openSize(39).height + 11);
    expect(L.canvasSize(L.openSize()).width).toBe(L.openSize().width + 48);
    expect(L.closeDuration).toBeGreaterThanOrEqual(0.3);
  });
  it.each([[0.85, 89, 180], [1, 100, 202], [1.3, 124, 248], [1.6, 146, 293]])('openHeightFollowsTheRhythm at %f', (s, top, plain) => {
    expect(L.topContentHeight(s)).toBe(top);
    expect(L.contentHeight(s)).toBe(plain);
  });
  it.each([[0.85, 427, 628], [1, 480, 712], [1.3, 588, 881], [1.6, 696, 1057]])('scheduleHeightFollowsTheRhythm at %f', (s, controls, calendar) => {
    expect(L.scheduleContentHeight(s, false)).toBe(controls);
    expect(L.scheduleContentHeight(s, true)).toBe(calendar);
  });
  it('scheduleHeightFollowsTheRhythm (sums at 100 %)', () => {
    expect(M.sectionHeight(1, false)).toBe(258);
    expect(M.calendarHeight(1)).toBe(222);
    expect(L.scheduleContentHeight(1, false)).toBe(202 + 258 + 20);
    expect(L.scheduleContentHeight(1, true)).toBe(480 + 10 + 26 + 18 + 168 + 10);
  });
  it.each([[0.85, 76, 276], [1, 86, 308], [1.3, 108, 376], [1.6, 130, 443]])('locationHeightFollowsTheRhythm at %f', (s, section, content) => {
    expect(LM.sectionHeight(s)).toBe(section);                                  // sc(36) + 14 + sc(36)
    expect(L.locationContentHeight(s)).toBe(content);
    expect(content).toBe(L.contentHeight(s) + section + L.horizontalPadding);
  });
  it('locationHeightFollowsTheRhythm (sums at 100 %)', () => {
    expect(LM.sectionHeight(1)).toBe(86);
    expect(L.locationContentHeight(1)).toBe(202 + 86 + 20);
    expect([LM.field, LM.footerGap, LM.footer]).toEqual([M.typeField, M.footerGap, M.footer]);
  });
  it('locationSizeAndPrecedence (layout)', () => {
    const plain = L.openSize(39), location = L.openSize(39, 'location'), controls = L.openSize(39, 'controls');
    expect(location).toEqual({ width: 600, height: 347 });
    expect(location.width).toBe(plain.width);
    expect(plain.height < location.height && location.height < controls.height).toBe(true);   // Location is the shortest section
    expect(L.openSize(39, 'location', plain.height + 10).height).toBe(plain.height + 10);     // clamped like Set Date
    expect(L.clickCancelsSection(105, L.sectionCancelBandBottom(39, 1), 'location')).toBe(true);   // title cancels Location too
    expect(L.clickCancelsSection(197, L.sectionCancelBandBottom(39, 1), 'location')).toBe(false);  // the bar does not
  });
  it('scheduleSizesGrowOnlyInHeight', () => {
    const plain = L.openSize(39), controls = L.openSize(39, 'controls'), calendar = L.openSize(39, 'calendar');
    expect(L.openSize(39, 'none')).toEqual(plain);
    expect([plain, controls, calendar].map((x) => x.width)).toEqual([600, 600, 600]);
    expect([plain.height, controls.height, calendar.height]).toEqual([241, 519, 751]);
    expect(L.openSize(50, 'calendar').height).toBe(calendar.height + 11);
    expect(L.canvasSize(calendar).height).toBeLessThan(900);
  });
  it('scheduleHeightIsClampedToTheScreen', () => {
    const natural = L.openSize(39, 'calendar');
    expect(L.openSize(39, 'calendar', natural.height + 100)).toEqual(natural);
    expect(L.openSize(39, 'calendar', 500.7)).toEqual({ width: 600, height: 500 });
    expect(L.openSize(39, 'controls', 100).height).toBe(241);
    expect(L.openSize(39, 'none', 100)).toEqual(L.openSize(39));
  });
  it('maxPanelHeightStopsAboveTheDockWithRoomForTheOvershoot', () => {
    expect(L.maxPanelHeight(982, 70)).toBe(982 - 70 - 40);
    expect(L.scheduleScreenMargin).toBe(40);
    expect(L.maxPanelHeight(982, 0)).toBe(942);
    expect(L.maxPanelHeight(1080, 0)).toBe(1040);
  });
  it('clickOnTheTextRowsCancelsScheduling', () => {
    const band = L.sectionCancelBandBottom(39, 1);
    expect(band).toBe(139);
    const cancels = (y: number, s: NotchSection = 'controls') => L.clickCancelsSection(y, band, s);
    expect(cancels(60, 'calendar')).toBe(true);
    expect(cancels(105)).toBe(true);
    expect(cancels(128)).toBe(true);
    expect(cancels(152)).toBe(false);
    expect(cancels(197)).toBe(false);
    expect(cancels(39 + 202 + 10)).toBe(false);
    expect(cancels(105, 'none')).toBe(false);
  });
  it('onlyTheBlackShapeTakesTheMouse', () => {
    const cw = 648, plain = { width: 600, height: 241 }, grown = { width: 600, height: 519 }, cx = cw / 2, inset = 24 + 19;
    const pass = (x: number, y: number, p = plain) => L.passesMouseThrough({ x, y }, cw, p);
    expect(pass(cx, 100)).toBe(false);
    expect(pass(24 + 560, 197)).toBe(false);
    expect(pass(cx, 400)).toBe(true);
    expect(pass(10, 100)).toBe(true);
    expect(pass(24 + 2, 239)).toBe(true);
    expect(pass(cx, 400, grown)).toBe(false);
    expect(pass(cx, 700, grown)).toBe(true);
    expect(pass(cw - inset - 2, 120)).toBe(false);
    expect(pass(cw - inset + 2, 120)).toBe(true);
    expect(pass(inset + 2, 120)).toBe(false);
    expect(pass(inset - 2, 120)).toBe(true);
    expect(pass(cx, 242)).toBe(true);
  });
  it('openCanvasFitsTheTallestScheduleStateInNotchStyle', () => {
    const plain = L.openSize(39), calendar = L.openSize(39, 'calendar');
    const canvas = L.openCanvasSize(plain, calendar);
    expect(canvas).toEqual(L.canvasSize(calendar));
    expect(canvas.height).toBeGreaterThanOrEqual(L.openSize(39, 'controls').height + L.overshootPadding);
    expect(L.openCanvasSize(plain, { width: 600, height: plain.height - 50 })).toEqual(L.canvasSize(plain));
  });
  it('openCanvasAtDefaultTextSize', () =>
    expect(L.openCanvasSize({ width: 600, height: 241 }, { width: 600, height: 751 })).toEqual({ width: 648, height: 775 }));
});

describe('notchLayout (TS)', () => {
  it.each([[13, 16], [15, 18], [16, 19], [19, 23], [20, 24], [24, 29], [25, 30], [30, 36]])('lineHeight(%i) = %i (NSFont.systemFont, macOS 26)', (p, h) =>
    expect(L.lineHeight(p)).toBe(h));
  it('derivedSizesOnTheFake14InchScreen', () => {
    expect(L.closedSize).toEqual({ width: 235, height: 39 });
    expect(L.hoverSize).toEqual({ width: 257, height: 44 });
    expect(L.closedCanvasSize).toEqual({ width: 273, height: 52 });
    expect(L.savedSize).toEqual({ width: 379, height: 39 });
    expect(L.scheduleControlsSize).toEqual({ width: 600, height: 519 });
    expect(L.scheduleCalendarSize).toEqual({ width: 600, height: 751 });
    expect(L.locationSize).toEqual({ width: 600, height: 347 });
    expect(L.canvasSize(L.openSize())).toEqual({ width: 648, height: 265 });
  });
  it('sectionTopIsBelowTheBottomBar', () => expect(L.scheduleSectionTop(39, 1)).toBe(241));
  it('insets', () => {
    expect(L.contentInsetX).toBe(L.horizontalPadding + L.openTopRadius);
    expect(L.savedBadgeTrailingPadding).toBe(L.closedTopRadius + (L.savedExtension - L.savedBadgeSize) / 2);
  });
  it('sectionRows', () => {
    const top = L.scheduleSectionTop();
    const presets = top + M.typeField + M.previewGap + M.preview + M.presetsGap;
    expect(presets).toBe(311);
    const dayTime = presets + 2 * M.presetRow + M.presetSpacing + M.dayTimeGap;
    expect(dayTime).toBe(419);
    expect(dayTime + M.dayTimeRow + M.footerGap).toBe(463);
    expect(dayTime + M.dayTimeRow + M.calendarGap + M.calendarHeight() + M.footerGap).toBe(695);
    expect(top + LM.field + LM.footerGap).toBe(291);                       // Location footer 291–327
    expect(top + LM.sectionHeight() + L.horizontalPadding).toBe(347);
  });
});
