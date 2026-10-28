// Port of Notch/NotchShape.swift (app 144d620): the notch silhouette, its width rule,
// the hit test and the notch geometry constants.

export interface Size {
  readonly width: number;
  readonly height: number;
}

export type PathSegment = { readonly cmd: 'M' | 'L' | 'Q'; readonly args: readonly number[] };

type Point = { readonly x: number; readonly y: number };

/** `NotchShape.Radius`. */
export const NotchRadius = { closedTop: 6, closedBottom: 14, openTop: 19, openBottom: 32 } as const;

/** Swift `path(in:)` clamping: a too-small rect degrades to a rounded rectangle. */
function clampedRadii(width: number, height: number, top: number, bottom: number): { t: number; b: number } {
  const t = Math.max(0, Math.min(top, width / 2));
  const b = Math.max(0, Math.min(bottom, Math.min(height, width / 2 - t)));
  return { t, b };
}

/** The silhouette filling (0, 0, width, height): M, then 4 × (Q, L) in Swift's drawing order. */
export function notchPathSegments(
  width: number,
  height: number,
  topCornerRadius: number,
  bottomCornerRadius: number,
): readonly PathSegment[] {
  const w = width;
  const h = height;
  const { t, b } = clampedRadii(w, h, topCornerRadius, bottomCornerRadius);
  return [
    { cmd: 'M', args: [0, 0] },
    { cmd: 'Q', args: [t, 0, t, t] },
    { cmd: 'L', args: [t, h - b] },
    { cmd: 'Q', args: [t, h, t + b, h] },
    { cmd: 'L', args: [w - t - b, h] },
    { cmd: 'Q', args: [w - t, h, w - t, h - b] },
    { cmd: 'L', args: [w - t, t] },
    { cmd: 'Q', args: [w - t, 0, w, 0] },
    { cmd: 'L', args: [0, 0] },
  ];
}

const formatNumber = (x: number): string => String(Number(x.toFixed(3)));

/** SVG `d` of the silhouette; drawing keeps the true quadratic curves. */
export function notchPath(width: number, height: number, topCornerRadius: number, bottomCornerRadius: number): string {
  const body = notchPathSegments(width, height, topCornerRadius, bottomCornerRadius)
    .map((s) => s.cmd + s.args.map(formatNumber).join(' '))
    .join(' ');
  return `${body} Z`;
}

/** `NotchShape.width(forNotchWidth:topCornerRadius:)`. */
export function widthForNotch(notchWidth: number, topCornerRadius: number = NotchRadius.closedTop): number {
  return notchWidth + topCornerRadius * 2;
}

/** Number of chords CoreGraphics flattens a quadratic corner of radius `r` into (D16). */
function chordCount(r: number): number {
  return Math.max(1, Math.ceil(Math.sqrt((r * Math.SQRT2) / 4)));
}

/** The silhouette as the polygon CoreGraphics hit-tests: each Q replaced by equal-parameter chords. */
function flattenedPolygon(size: Size, topCornerRadius: number, bottomCornerRadius: number): Point[] {
  const { t, b } = clampedRadii(size.width, size.height, topCornerRadius, bottomCornerRadius);
  // Corner radii of the four Q segments in drawing order: top-left, bottom-left, bottom-right, top-right.
  const cornerRadii = [t, b, b, t] as const;
  const polygon: Point[] = [];
  let current: Point = { x: 0, y: 0 };
  let corner = 0;
  for (const segment of notchPathSegments(size.width, size.height, topCornerRadius, bottomCornerRadius)) {
    if (segment.cmd === 'Q') {
      const [cx = 0, cy = 0, ex = 0, ey = 0] = segment.args;
      const n = chordCount(cornerRadii[corner++ % cornerRadii.length] ?? 0);
      const start = current;
      for (let k = 1; k <= n; k++) {
        const s = k / n;
        const u = 1 - s;
        polygon.push({ x: u * u * start.x + 2 * s * u * cx + s * s * ex, y: u * u * start.y + 2 * s * u * cy + s * s * ey });
      }
      current = { x: ex, y: ey };
    } else {
      const [x = 0, y = 0] = segment.args;
      current = { x, y };
      polygon.push(current);
    }
  }
  return polygon;
}

/** Non-zero winding point-in-polygon test. */
function windingContains(polygon: readonly Point[], p: Point): boolean {
  let a = polygon[polygon.length - 1];
  if (a === undefined) return false;
  let winding = 0;
  for (const b of polygon) {
    const cross = (b.x - a.x) * (p.y - a.y) - (p.x - a.x) * (b.y - a.y);
    if (a.y <= p.y) {
      if (b.y > p.y && cross > 0) winding++;
    } else if (b.y <= p.y && cross < 0) {
      winding--;
    }
    a = b;
  }
  return winding !== 0;
}

/** `NotchShape.contains`: top-down coordinates, shape centred in `canvasWidth` and hanging from y = 0. */
export function contains(
  point: { x: number; y: number },
  canvasWidth: number,
  shapeSize: Size,
  topCornerRadius: number,
  bottomCornerRadius: number,
): boolean {
  const originX = (canvasWidth - shapeSize.width) / 2;
  const local = { x: point.x - originX, y: point.y };
  return windingContains(flattenedPolygon(shapeSize, topCornerRadius, bottomCornerRadius), local);
}

/** `NotchGeometry` without the `NSScreen` measurements. */
export const NotchGeometry = {
  fallbackSize: { width: 200, height: 32 } as Size,
  /** A real notch: both top fillets plus a 2 × 1 pt bleed. */
  closedShapeSize(notch: Size, topCornerRadius: number): Size {
    return { width: widthForNotch(notch.width, topCornerRadius) + 2, height: notch.height + 1 };
  },
} as const;
