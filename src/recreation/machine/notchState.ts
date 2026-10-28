// Port of Notch/NotchState.swift `final class NotchState` (app 144d620) as pure derivation:
// the published flags become `NotchFlags`, the sizes `PanelController.configureGeometry`
// writes become `NotchSizes`, and every computed property becomes a function of them.

import { NotchLayout, type NotchSection } from './notchLayout';
import { NotchGeometry, NotchRadius, type Size } from './notchShape';

export interface NotchFlags {
  readonly isOpen: boolean;
  readonly contentVisible: boolean;
  readonly isSettled: boolean;
  readonly isSaving: boolean;
  readonly savedBadgeShown: boolean;
  readonly isHovering: boolean;
  readonly section: NotchSection;
}

export interface NotchSizes {
  readonly closedSize: Size;
  readonly openSize: Size;
  readonly scheduleSize: Size;
  readonly scheduleCalendarSize: Size;
  readonly locationSize: Size;
}

export const INITIAL_FLAGS: NotchFlags = {
  isOpen: false,
  contentVisible: false,
  isSettled: false,
  isSaving: false,
  savedBadgeShown: false,
  isHovering: false,
  section: 'none',
};

/** `PanelController.configureGeometry(for:)`: the sizes for a display's notch and height (Dock below). */
export function sizesFor(notch: Size, screenHeight: number, dockHeight = 0): NotchSizes {
  const closedSize = NotchGeometry.closedShapeSize(notch, NotchRadius.closedTop);
  const band = closedSize.height;
  const maxHeight = NotchLayout.maxPanelHeight(screenHeight, dockHeight);
  return {
    closedSize,
    openSize: NotchLayout.openSize(band),
    scheduleSize: NotchLayout.openSize(band, 'controls', maxHeight),
    scheduleCalendarSize: NotchLayout.openSize(band, 'calendar', maxHeight),
    locationSize: NotchLayout.openSize(band, 'location', maxHeight),
  };
}

/** Height of the band occupied by the physical notch / menu bar at the top of the panel. */
export function notchBandHeight(s: NotchSizes): number {
  return s.closedSize.height;
}

/** Swift `NotchState.size(for:)`: the open panel with `section` shown. */
export function panelSize(s: NotchSizes, section: NotchSection): Size {
  switch (section) {
    case 'none':
      return s.openSize;
    case 'controls':
      return s.scheduleSize;
    case 'calendar':
      return s.scheduleCalendarSize;
    case 'location':
      return s.locationSize;
  }
}

/** The tallest grown state, which the open canvas is sized for (first of equal heights wins, like Swift `max(by:)`). */
export function tallestSectionSize(s: NotchSizes): Size {
  return [s.scheduleCalendarSize, s.locationSize].reduce(
    (tallest, size) => (size.height > tallest.height ? size : tallest),
    s.scheduleSize,
  );
}

/** Saving → saved; open → the panel at its section; hovering → swollen; else closed. */
export function currentSize(f: NotchFlags, s: NotchSizes): Size {
  if (f.isSaving) return savedSize(s);
  if (f.isOpen) return panelSize(s, f.section);
  if (f.isHovering) return hoverSize(s);
  return s.closedSize;
}

/** Closed silhouette, swollen by `NotchLayout.hoverGrowth` while the pointer is over it. */
export function hoverSize(s: NotchSizes): Size {
  return {
    width: s.closedSize.width + NotchLayout.hoverGrowth.width,
    height: s.closedSize.height + NotchLayout.hoverGrowth.height,
  };
}

/** Canvas while closed: the hover-swollen silhouette plus a small margin. */
export function closedCanvasSize(s: NotchSizes): Size {
  const hover = hoverSize(s);
  return {
    width: hover.width + NotchLayout.closedCanvasMargin.width,
    height: hover.height + NotchLayout.closedCanvasMargin.height,
  };
}

/** Notch height, widened by `NotchLayout.savedExtension` on each side. */
export function savedSize(s: NotchSizes): Size {
  return { width: s.closedSize.width + 2 * NotchLayout.savedExtension, height: s.closedSize.height };
}

/** Corner radii of the silhouette: open (19, 32), otherwise closed (6, 14), saving included. */
export function radii(f: NotchFlags): { top: number; bottom: number } {
  return f.isOpen
    ? { top: NotchRadius.openTop, bottom: NotchRadius.openBottom }
    : { top: NotchRadius.closedTop, bottom: NotchRadius.closedBottom };
}
