// The Stage camera (landing §7.2, §11.1): pure maths from scroll progress and viewport to the scene transform.
// Three keyframes, hero → overview → features; the notch top centre (scene 756, 0) is the visual origin.
import { useMediaQuery } from '../desktop/useMediaQuery';
import { NotchLayout } from '../recreation/machine/notchLayout';
import { SCENE } from '../desktop/scene';
import { FRAME } from './MacBookFrame';

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

export interface Camera {
  readonly scale: number;
  readonly originX: number;
  readonly originY: number;
  readonly translateX: number;
  readonly translateY: number;
  readonly frameOpacity: number;
  readonly pageReveal: number;
}

export const CAMERA: {
  readonly phoneBreakpoint: 810;
  readonly pinnedColumnRatio: 0.58;
  readonly featuresVisibleWidthPt: 760;
  readonly minFeaturesPt: 0.75;
  readonly featuresNotchTopPx: 64;
  readonly featuresBottomAirPx: 24;
  readonly overviewProgress: 0.625;
  readonly overviewScaleRatio: 0.62;
  readonly overviewCenterYRatio: 0.42;
  readonly runwayVh: 160;
  readonly phoneGutterPx: 16;
  readonly phoneTopPx: 64;
  readonly phoneBottomPx: 16;
} = {
  phoneBreakpoint: 810,
  pinnedColumnRatio: 0.58,
  featuresVisibleWidthPt: 760,
  minFeaturesPt: 0.75,
  featuresNotchTopPx: 64,
  featuresBottomAirPx: 24,
  overviewProgress: 0.625,
  overviewScaleRatio: 0.62,
  overviewCenterYRatio: 0.42,
  runwayVh: 160,
  phoneGutterPx: 16,
  phoneTopPx: 64,
  phoneBottomPx: 16,
};

/** At or above the phone breakpoint: the pinned two-column layout (landing §7.2). */
export const DESKTOP_QUERY = `(min-width: ${CAMERA.phoneBreakpoint}px)`;

/** Whether the viewport matches DESKTOP_QUERY (live). */
export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY);
}

/** Where the notch top centre lands in the viewport (nx, ny) at scene scale s. */
interface Keyframe {
  readonly s: number;
  readonly nx: number;
  readonly ny: number;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

function isPhone(viewport: Viewport): boolean {
  return viewport.width < CAMERA.phoneBreakpoint;
}

/** Phone scale: the whole lid fits the width minus two gutters. */
function phoneScale(viewportWidth: number): number {
  return (viewportWidth - 2 * CAMERA.phoneGutterPx) / FRAME.lidWidth;
}

export function pinnedColumnWidth(viewport: Viewport): number {
  return isPhone(viewport) ? viewport.width : Math.round(viewport.width * CAMERA.pinnedColumnRatio);
}

export function heroPt(viewport: Viewport): number {
  return Math.min(viewport.width / SCENE.width, viewport.height / SCENE.height);
}

export function featuresPt(pinnedColumnWidth: number): number {
  return clamp(pinnedColumnWidth / CAMERA.featuresVisibleWidthPt, CAMERA.minFeaturesPt, 1);
}

/** featuresPt clamped again so the tallest panel (calendar) fits under the notch: max(0.75, min(featuresPt(col), (h − 64 − 24) / NotchLayout.scheduleCalendarSize.height)). */
export function featuresScale(viewport: Viewport, pinnedColumnWidth: number): number {
  const fitHeight =
    (viewport.height - CAMERA.featuresNotchTopPx - CAMERA.featuresBottomAirPx) / NotchLayout.scheduleCalendarSize.height;
  return Math.max(CAMERA.minFeaturesPt, Math.min(featuresPt(pinnedColumnWidth), fitHeight));
}

function heroKeyframe(viewport: Viewport): Keyframe {
  const s = heroPt(viewport);
  return { s, nx: viewport.width / 2, ny: (viewport.height - SCENE.height * s) / 2 };
}

function overviewKeyframe(viewport: Viewport): Keyframe {
  const s = CAMERA.overviewScaleRatio * heroPt(viewport);
  return { s, nx: viewport.width / 2, ny: CAMERA.overviewCenterYRatio * viewport.height - (SCENE.height / 2) * s };
}

function featuresKeyframe(viewport: Viewport, pinnedColumnWidth: number): Keyframe {
  return { s: featuresScale(viewport, pinnedColumnWidth), nx: pinnedColumnWidth / 2, ny: CAMERA.featuresNotchTopPx };
}

function cameraAt(k: Keyframe, reveal: number): Camera {
  return {
    scale: k.s,
    originX: k.nx,
    originY: k.ny,
    translateX: k.nx - SCENE.notchOrigin.x * k.s,
    translateY: k.ny,
    frameOpacity: reveal,
    pageReveal: reveal,
  };
}

function lerpKeyframe(a: Keyframe, b: Keyframe, t: number): Keyframe {
  return { s: lerp(a.s, b.s, t), nx: lerp(a.nx, b.nx, t), ny: lerp(a.ny, b.ny, t) };
}

/** Progress within the overview → features segment, or null while still in hero → overview. */
function secondSegmentT(progress: number): number | null {
  const p = clamp(progress, 0, 1);
  return p <= CAMERA.overviewProgress ? null : (p - CAMERA.overviewProgress) / (1 - CAMERA.overviewProgress);
}

export function cameraFor(progress: number, viewport: Viewport, pinnedColumnWidth: number): Camera {
  if (isPhone(viewport)) {
    const s = phoneScale(viewport.width);
    return cameraAt({ s, nx: viewport.width / 2, ny: CAMERA.phoneTopPx + FRAME.bezelTop * s }, 1);
  }
  const overview = overviewKeyframe(viewport);
  const t2 = secondSegmentT(progress);
  if (t2 === null) {
    const t = clamp(progress, 0, 1) / CAMERA.overviewProgress;
    return cameraAt(lerpKeyframe(heroKeyframe(viewport), overview, t), t);
  }
  return cameraAt(lerpKeyframe(overview, featuresKeyframe(viewport, pinnedColumnWidth), t2), 1);
}

/** The `--pt` the scene renders at: the sharpest scale the camera reaches, so it never upscales a bitmap. */
export function renderPtFor(viewport: Viewport, pinnedColumnWidth: number): number {
  if (isPhone(viewport)) return phoneScale(viewport.width);
  return Math.max(heroPt(viewport), featuresScale(viewport, pinnedColumnWidth));
}

/** Crop from the right towards the pinned column during the overview → features segment. */
export function clipFor(progress: number, viewport: Viewport, pinnedColumnWidth: number): { readonly right: number } {
  if (isPhone(viewport)) return { right: 0 };
  const t = secondSegmentT(progress);
  return { right: t === null ? 0 : (viewport.width - pinnedColumnWidth) * t };
}

/** The overview title: in over 0.35…0.55, held to 0.7, out over 0.7…0.85. */
export function titleOpacityFor(progress: number): number {
  if (progress <= 0.35 || progress >= 0.85) return 0;
  if (progress < 0.55) return (progress - 0.35) / 0.2;
  if (progress <= 0.7) return 1;
  return (0.85 - progress) / 0.15;
}

/** Height of the unpinned phone block: top air + lid and deck at the phone scale + bottom air. */
export function phoneStageHeight(viewportWidth: number): number {
  return (
    CAMERA.phoneTopPx + (FRAME.lidHeight + FRAME.deckHeight) * phoneScale(viewportWidth) + CAMERA.phoneBottomPx
  );
}

/** CSS transform of the camera layer (transform-origin `0 0`), with the scene rendered at `renderPt`. */
export function cameraTransform(camera: Camera, renderPt: number): string {
  return `translate3d(${camera.translateX.toFixed(2)}px, ${camera.translateY.toFixed(2)}px, 0) scale(${(camera.scale / renderPt).toFixed(5)})`;
}
