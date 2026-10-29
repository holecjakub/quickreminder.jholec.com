// The fake 14" MacBook Pro screen in points (1512 × 982) and the desktop's fixed layout positions.
import type { ScenePoint, Size } from '../recreation';

export const SCENE: {
  readonly width: 1512;
  readonly height: 982;
  readonly menuBarHeight: 38;
  readonly notch: Size;
  readonly notchOrigin: ScenePoint;
} = {
  width: 1512,
  height: 982,
  menuBarHeight: 38,
  notch: { width: 221, height: 38 },
  notchOrigin: { x: 756, y: 0 },
};

/** Left edge of the hardware notch: 756 − 221 / 2. */
export const NOTCH_LEFT = 645.5;
/** Right edge of the hardware notch: 756 + 221 / 2. */
export const NOTCH_RIGHT = 866.5;
/** Top of the hint: closed silhouette 39 + hover growth 5 (contracts §5.1) + 14 air. */
export const HINT_TOP = 58;
/** The fake Reminders window, placed inside the features crop (cross-area note 3). */
export const REMINDERS_WINDOW: { readonly x: 790; readonly y: 330; readonly width: 320; readonly maxHeight: 340 } = {
  x: 790,
  y: 330,
  width: 320,
  maxHeight: 340,
};

/** CSS length for a scene length in points: `calc(${v} * var(--pt) * 1px)` (contracts §6.2 rule). */
export function ptCss(v: number): string {
  return `calc(${v} * var(--pt) * 1px)`;
}
