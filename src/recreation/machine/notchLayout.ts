// Port of Notch/NotchState.swift `enum NotchLayout` (app 144d620) with `ScheduleMetrics`,
// `LocationMetrics`, `Theme.horizontalPadding` and `PlainTextView.lineHeight(for:)`.
// The recreation runs at a fixed text scale of 1; every rhythm function still takes `s`
// so the Swift test tables at 85 % … 160 % can be mirrored.

import { NotchGeometry, NotchRadius, contains, widthForNotch, type Size } from './notchShape';

export type { Size };

/** Swift `NotchSection` (`.none`, `.schedule(.controls)`, `.schedule(.calendar)`, `.location`), flattened. */
export type NotchSection = 'none' | 'controls' | 'calendar' | 'location';

/** Swift `.rounded(.toNearestOrEven)`: ties go to the even neighbour, only on exact halves. */
function roundHalfEven(x: number): number {
  return Math.abs(x % 1) === 0.5 ? 2 * Math.round(x / 2) : Math.round(x);
}

/** `sc(v)` of every Swift rhythm function: a control height scaled by the text size. */
function sc(v: number, s: number): number {
  return roundHalfEven(v * s);
}

/**
 * `PlainTextView.lineHeight(for:)` = ⌈ascender − descender + leading⌉ of `NSFont.systemFont`,
 * measured on macOS 26: ascender 1980/2048 em, descender −432/2048 em, leading 0.
 */
function lineHeight(pointSize: number): number {
  return Math.ceil((pointSize * 2412) / 2048);
}

const TEXT_SCALE = 1;
const BASE_OPEN_WIDTH = 600;
const DEFAULT_NOTCH_BAND_HEIGHT = 39;
const HORIZONTAL_PADDING = 20; // Theme.horizontalPadding
const OVERSHOOT_PADDING = 24;

/** `NotchLayout.ScheduleMetrics`: gaps are fixed points, control heights scale. */
export const ScheduleMetrics = {
  typeField: 36,
  previewGap: 6,
  preview: 18,
  presetsGap: 10,
  presetRow: 44,
  presetSpacing: 8,
  dayTimeGap: 12,
  dayTimeRow: 30,
  calendarGap: 10,
  monthHeader: 26,
  weekdayRow: 18,
  dayCell: 28,
  dayRowSpacing: 2,
  footerGap: 14,
  footer: 36,
  /** Concentric with the panel's 32 pt bottom corners at the 20 pt inset (32 − 20). */
  controlRadius: 12,

  calendarHeight(s = 1): number {
    const m = ScheduleMetrics;
    return sc(m.monthHeader, s) + sc(m.weekdayRow, s) + 6 * sc(m.dayCell, s) + 5 * m.dayRowSpacing;
  },

  sectionHeight(s = 1, calendar: boolean): number {
    const m = ScheduleMetrics;
    let height =
      sc(m.typeField, s) + m.previewGap + sc(m.preview, s) +
      m.presetsGap + 2 * sc(m.presetRow, s) + m.presetSpacing +
      m.dayTimeGap + sc(m.dayTimeRow, s);
    if (calendar) height += m.calendarGap + m.calendarHeight(s);
    return height + m.footerGap + sc(m.footer, s);
  },
} as const;

/** `NotchLayout.LocationMetrics`: field + footer with Set Date's control metrics. */
export const LocationMetrics = {
  field: ScheduleMetrics.typeField,
  footerGap: ScheduleMetrics.footerGap,
  footer: ScheduleMetrics.footer,

  sectionHeight(s = 1): number {
    return sc(LocationMetrics.field, s) + LocationMetrics.footerGap + sc(LocationMetrics.footer, s);
  },
} as const;

/** Header + title/notes: the part of the content above the chip slot. */
function topContentHeight(s = 1): number {
  const header = sc(36, s); // ⓧ hit frame
  const input = lineHeight(sc(19, s)) + 2 + 1 + (lineHeight(sc(15, s)) + 2);
  return 8 + header + 10 + input;
}

/** Vertical rhythm of the open content below the notch band (SPEC §4). */
function contentHeight(s = 1): number {
  return topContentHeight(s) + sc(26, s) + 8 + sc(48, s) + HORIZONTAL_PADDING;
}

/** The plain panel with the Set Date section appended below it. */
function scheduleContentHeight(s: number, calendar: boolean): number {
  return contentHeight(s) + ScheduleMetrics.sectionHeight(s, calendar) + HORIZONTAL_PADDING;
}

/** The plain panel with the Location section appended below it. */
function locationContentHeight(s = 1): number {
  return contentHeight(s) + LocationMetrics.sectionHeight(s) + HORIZONTAL_PADDING;
}

/** Open panel size with `section` (`'none'` = the plain panel), clamped to `maxHeight`, never below the plain panel. */
function openSize(band = DEFAULT_NOTCH_BAND_HEIGHT, section: NotchSection = 'none', maxHeight = Infinity): Size {
  const s = TEXT_SCALE;
  const plain: Size = {
    width: Math.round(BASE_OPEN_WIDTH * Math.min(1 + (s - 1) * 0.5, 1.3)),
    height: band + contentHeight(s),
  };
  if (section === 'none') return plain;
  const natural =
    section === 'location'
      ? band + locationContentHeight(s)
      : band + scheduleContentHeight(s, section === 'calendar');
  return { width: plain.width, height: Math.max(plain.height, Math.min(natural, Math.floor(maxHeight))) };
}

const SCHEDULE_SCREEN_MARGIN = OVERSHOOT_PADDING + 16;

/** Screen top (the panel covers the menu bar) down to the top of the Dock, minus the margin. */
function maxPanelHeight(screenHeight: number, dockHeight: number): number {
  return screenHeight - dockHeight - SCHEDULE_SCREEN_MARGIN;
}

/** The section's real top: below the plain panel's bottom bar and its 20 pt inset. */
function scheduleSectionTop(band = DEFAULT_NOTCH_BAND_HEIGHT, s = 1): number {
  return band + contentHeight(s);
}

/** Bottom of the band (header, title, notes) whose clicks cancel the open section. */
function sectionCancelBandBottom(band = DEFAULT_NOTCH_BAND_HEIGHT, s = 1): number {
  return band + topContentHeight(s);
}

function clickCancelsSection(y: number, bandBottom: number, section: NotchSection): boolean {
  return section !== 'none' && y < bandBottom;
}

/** Window / canvas: the open panel plus overshoot room on the sides and bottom. */
function canvasSize(open: Size): Size {
  return { width: open.width + 2 * OVERSHOOT_PADDING, height: open.height + OVERSHOOT_PADDING };
}

/** The open canvas in notch style: fits the tallest section state, never resized by a section. */
function openCanvasSize(open: Size, tallest: Size): Size {
  return canvasSize({ width: open.width, height: Math.max(open.height, tallest.height) });
}

/** True when the pointer is outside the open black shape (top-down canvas point). */
function passesMouseThrough(point: { x: number; y: number }, canvasWidth: number, panelSize: Size): boolean {
  const minX = (canvasWidth - panelSize.width) / 2;
  // CGRect.contains: min edges inclusive, max edges exclusive.
  const inBounds = point.x >= minX && point.x < minX + panelSize.width && point.y >= 0 && point.y < panelSize.height;
  if (!inBounds) return true;
  return !contains(point, canvasWidth, panelSize, NotchRadius.openTop, NotchRadius.openBottom);
}

function closedShapeSize(notch: Size, top: number = NotchRadius.closedTop): Size {
  return NotchGeometry.closedShapeSize(notch, top);
}

const NOTCH: Size = { width: 221, height: 38 }; // 14" MacBook Pro
const HOVER_GROWTH: Size = { width: 22, height: 5 };
const CLOSED_CANVAS_MARGIN: Size = { width: 16, height: 8 };
const SAVED_EXTENSION = 72;
const SAVED_BADGE_SIZE = 24;

const closedSize = closedShapeSize(NOTCH);
const hoverSize: Size = { width: closedSize.width + HOVER_GROWTH.width, height: closedSize.height + HOVER_GROWTH.height };

export const NotchLayout = {
  baseOpenWidth: BASE_OPEN_WIDTH,
  defaultNotchBandHeight: DEFAULT_NOTCH_BAND_HEIGHT,
  textScale: TEXT_SCALE,
  horizontalPadding: HORIZONTAL_PADDING,
  /** QuickReminderView horizontal padding: `Theme.horizontalPadding + openTopRadius`. */
  contentInsetX: HORIZONTAL_PADDING + NotchRadius.openTop,
  closedTopRadius: NotchRadius.closedTop,
  closedBottomRadius: NotchRadius.closedBottom,
  openTopRadius: NotchRadius.openTop,
  openBottomRadius: NotchRadius.openBottom,
  overshootPadding: OVERSHOOT_PADDING,
  scheduleScreenMargin: SCHEDULE_SCREEN_MARGIN,
  savedExtension: SAVED_EXTENSION,
  savedBadgeSize: SAVED_BADGE_SIZE,
  /** NotchContainerView: `closedTopRadius + (savedExtension − savedBadgeSize) / 2`. */
  savedBadgeTrailingPadding: NotchRadius.closedTop + (SAVED_EXTENSION - SAVED_BADGE_SIZE) / 2,
  savedHold: 1.0,
  hoverGrowth: HOVER_GROWTH,
  hoverDwell: 0.09,
  closedCanvasMargin: CLOSED_CANVAS_MARGIN,
  closeDuration: 0.36,
  /** PanelController `.scheduleSettle`. */
  settleDelay: 0.5,
  /** PanelController `.scheduleFocusRetries`. */
  focusRetryDelays: [0.12, 0.3] as readonly number[],
  titleLineHeight: lineHeight(19),
  notesLineHeight: lineHeight(15),
  titleRowHeight: lineHeight(19) + 2,
  notesRowHeight: lineHeight(15) + 2,
  inputRowSpacing: 1,
  headerHeight: 36,
  chipSlotHeight: 26,
  bottomBarHeight: 48,
  NOTCH,
  closedSize,
  scheduleControlsSize: openSize(DEFAULT_NOTCH_BAND_HEIGHT, 'controls'),
  scheduleCalendarSize: openSize(DEFAULT_NOTCH_BAND_HEIGHT, 'calendar'),
  locationSize: openSize(DEFAULT_NOTCH_BAND_HEIGHT, 'location'),
  savedSize: { width: closedSize.width + 2 * SAVED_EXTENSION, height: closedSize.height } as Size,
  hoverSize,
  closedCanvasSize: { width: hoverSize.width + CLOSED_CANVAS_MARGIN.width, height: hoverSize.height + CLOSED_CANVAS_MARGIN.height } as Size,

  lineHeight,
  widthForNotch,
  closedShapeSize,
  topContentHeight,
  contentHeight,
  scheduleContentHeight,
  locationContentHeight,
  openSize,
  maxPanelHeight,
  scheduleSectionTop,
  sectionCancelBandBottom,
  clickCancelsSection,
  canvasSize,
  openCanvasSize,
  passesMouseThrough,
} as const;
