import type { ScenePoint } from '../recreation';

export type { ScenePoint } from '../recreation';

/** Imperative handle of the fake demo cursor (contracts §4.5). */
export interface FakeCursorHandle {
  moveTo(point: ScenePoint, opts?: { durationMs?: number }): Promise<void>;
  click(): Promise<void>;
  show(): void;
  hide(): void;
  pin(pinned: boolean): void;
  position(): ScenePoint;
  cancel(): void;
}

/** Where the cursor rests before the first move (scene points). */
export const CURSOR_HOME: ScenePoint = { x: 1180, y: 640 };
export const CURSOR_SPEED_PT_PER_MS = 1.6 as const;
/** Tip of the arrow inside its 18 × 24 pt box. */
export const CURSOR_HOTSPOT = { x: 2, y: 1.5 } as const;
/** SwiftUI `.easeInOut` (contracts §7 EASE_IN_OUT). */
export const CURSOR_EASE = [0.42, 0, 0.58, 1] as const;
export const CURSOR_AUTO_HIDE_MS = 1200 as const;
export const CURSOR_PRESS = { scale: 0.94, ms: 80 } as const;

const MIN_MOVE_MS = 220;
const MAX_MOVE_MS = 700;

/** clamp(distance / 1.6, 220, 700) ms. */
export function cursorDuration(from: ScenePoint, to: ScenePoint): number {
  const ms = Math.hypot(to.x - from.x, to.y - from.y) / CURSOR_SPEED_PT_PER_MS;
  return Math.min(MAX_MOVE_MS, Math.max(MIN_MOVE_MS, ms));
}
