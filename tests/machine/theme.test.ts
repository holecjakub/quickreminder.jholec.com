import { describe, expect, it } from 'vitest';
import { NotchLayout, Theme } from '../../src/recreation/machine/notchLayout';

describe('Theme', () => {
  it('pillIconsSit55ptApart (SPEC §4)', () => expect(Theme.pill.hitSize + Theme.pill.iconGap).toBe(55));
  it('chipSlotLeadingClearsTheDottedCircle', () => expect(Theme.chipSlot.leading).toBe(Theme.dashedCircle.size + Theme.input.circleGap));
  it('closeHitIsTheHeaderRow', () => expect(Theme.close.hit).toBe(NotchLayout.headerHeight));
  it('saveButtonIsTheBottomBar', () => expect(Theme.save.size).toBe(NotchLayout.bottomBarHeight));
  it('controlRadiusIsConcentricWithThePanel', () => expect(32 - Theme.horizontalPadding).toBe(Theme.typeField.radius));
  it('savedBadgeTick', () => {
    expect(Theme.savedBadge.size * Theme.savedBadge.strokeRatio).toBeCloseTo(2.64, 10);
    expect(Theme.savedBadge.size * Theme.savedBadge.paddingRatio).toBeCloseTo(6.48, 10);
  });
  it('hoverAndPress', () => expect(Theme.hover).toEqual({ scale: 1.06, pressScale: 0.94, highlight: 0.10, pressHighlight: 0.18 }));
  it('activeCalendarIconDisc (BottomBar.swift:140)', () => expect([Theme.pill.activeFillAlpha, Theme.pill.activeInset]).toEqual([0.22, 3]));
  it('locationFieldIsStyledLikeTheTypeField (LocationNotchSection.swift)', () => {
    const { padX, textSize, placeholderAlpha, fillAlpha, strokeAlpha, focusStrokeAlpha, radius } = Theme.typeField;
    expect(Theme.locationField).toMatchObject({ padX, textSize, placeholderAlpha, fillAlpha, strokeAlpha, focusStrokeAlpha, radius });
    expect([Theme.locationField.gap, Theme.locationField.iconSize, Theme.locationField.iconWeight]).toEqual([8, 12, 500]);
    expect('locationPopover' in Theme).toBe(false);
  });
});
