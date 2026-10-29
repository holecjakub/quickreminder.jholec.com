// The Stage camera (landing §7.2, §11.1): pure maths from scroll progress and viewport to the scene transform.
// Desktop: three keyframes, hero → overview → features; the notch top centre (scene 756, 0) is the visual origin.
// The hero shows the whole MacBook (lid + deck) on the page background, fitted into the viewport with air
// around it; the overview shrinks it under the title; features zoom to the notch in the pinned column.
// Phones: two keyframes over a 100 svh runway, hero (the MacBook in the 56 svh band, under the nav and above
// the title) → notch (the panel fills the width, notch top 28 px down).
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
}

export const CAMERA: {
  readonly phoneBreakpoint: 810;
  readonly pinnedColumnRatio: 0.58;
  readonly featuresVisibleWidthPt: 760;
  readonly minFeaturesPt: 0.75;
  readonly featuresNotchTopPx: 64;
  readonly featuresBottomAirPx: 24;
  readonly heroGutterPx: 24;
  readonly heroAirPx: 48;
  readonly overviewProgress: 0.625;
  readonly overviewScaleRatio: 0.72;
  readonly overviewCenterYRatio: 0.42;
  readonly runwayVh: 160;
  readonly phoneGutterPx: 16;
  readonly phoneTopPx: 64;
  readonly phoneStageSvh: 56;
  readonly phoneTitleReservePx: 96;
  readonly phoneNotchTopPx: 28;
  readonly phoneNotchBottomAirPx: 16;
  readonly phonePanelWidthPt: 600;
  readonly minPhoneNotchPt: 0.4;
  readonly phoneRunwayVh: 100;
  readonly phoneTitleFadeEnd: 0.5;
  readonly phoneSectionStart: 'top 78%';
} = {
  phoneBreakpoint: 810,
  pinnedColumnRatio: 0.58,
  featuresVisibleWidthPt: 760,
  minFeaturesPt: 0.75,
  featuresNotchTopPx: 64,
  featuresBottomAirPx: 24,
  heroGutterPx: 24,
  heroAirPx: 48,
  overviewProgress: 0.625,
  overviewScaleRatio: 0.72,
  overviewCenterYRatio: 0.42,
  runwayVh: 160,
  phoneGutterPx: 16,
  phoneTopPx: 64,
  phoneStageSvh: 56,
  phoneTitleReservePx: 96,
  phoneNotchTopPx: 28,
  phoneNotchBottomAirPx: 16,
  phonePanelWidthPt: 600,
  minPhoneNotchPt: 0.4,
  phoneRunwayVh: 100,
  phoneTitleFadeEnd: 0.5,
  phoneSectionStart: 'top 78%',
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

export function pinnedColumnWidth(viewport: Viewport): number {
  return isPhone(viewport) ? viewport.width : Math.round(viewport.width * CAMERA.pinnedColumnRatio);
}

const FRAME_HEIGHT = FRAME.lidHeight + FRAME.deckHeight;

/** Hero scale: the whole MacBook (deck width, lid + deck height) fits the viewport minus the gutters and the air. */
export function heroPt(viewport: Viewport): number {
  return Math.min(
    (viewport.width - 2 * CAMERA.heroGutterPx) / FRAME.deckWidth,
    (viewport.height - 2 * CAMERA.heroAirPx) / FRAME_HEIGHT,
  );
}

/** The fake screen's rectangle in the hero (viewport px): the MacBook is centred, the screen sits inside its bezel. */
export function heroScreenRect(viewport: Viewport): { readonly x: number; readonly y: number; readonly pt: number } {
  const pt = heroPt(viewport);
  const lidTop = (viewport.height - FRAME_HEIGHT * pt) / 2;
  return { x: viewport.width / 2 - (SCENE.width / 2) * pt, y: lidTop + FRAME.bezelTop * pt, pt };
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
  const { y, pt } = heroScreenRect(viewport);
  return { s: pt, nx: viewport.width / 2, ny: y };
}

function overviewKeyframe(viewport: Viewport): Keyframe {
  const s = CAMERA.overviewScaleRatio * heroPt(viewport);
  return { s, nx: viewport.width / 2, ny: CAMERA.overviewCenterYRatio * viewport.height - (SCENE.height / 2) * s };
}

function featuresKeyframe(viewport: Viewport, pinnedColumnWidth: number): Keyframe {
  return { s: featuresScale(viewport, pinnedColumnWidth), nx: pinnedColumnWidth / 2, ny: CAMERA.featuresNotchTopPx };
}

/** Height of the phone band (viewport px): 56 svh. */
export function phoneStageHeight(viewport: Viewport): number {
  return (CAMERA.phoneStageSvh / 100) * viewport.height;
}

/** The band's height between the nav and the title reserve, where the phone hero MacBook sits. */
function phoneHeroBandHeight(viewport: Viewport): number {
  return phoneStageHeight(viewport) - CAMERA.phoneTopPx - CAMERA.phoneTitleReservePx;
}

/** Floor of the phone hero scale: below ≈ 286 px of viewport height the band under the nav is empty or negative. */
const MIN_PHONE_HERO_PT = 0.05;

/**
 * Phone hero scale: the whole MacBook fits the width minus two gutters and the band under the nav, above the
 * title; floored at MIN_PHONE_HERO_PT so a very short viewport (landscape) never mirrors the scene.
 */
export function phoneHeroPt(viewport: Viewport): number {
  const fit = Math.min(
    (viewport.width - 2 * CAMERA.phoneGutterPx) / FRAME.deckWidth,
    phoneHeroBandHeight(viewport) / FRAME_HEIGHT,
  );
  return Math.max(fit, MIN_PHONE_HERO_PT);
}

/** Phone notch scale: the panel fills the width, the calendar fits the band under the notch; clamped to [0.4, 1]. */
export function phoneNotchPt(viewport: Viewport): number {
  const fitWidth = (viewport.width - 2 * CAMERA.phoneGutterPx) / CAMERA.phonePanelWidthPt;
  const fitHeight =
    (phoneStageHeight(viewport) - CAMERA.phoneNotchTopPx - CAMERA.phoneNotchBottomAirPx) /
    NotchLayout.scheduleCalendarSize.height;
  return clamp(Math.min(fitWidth, fitHeight), CAMERA.minPhoneNotchPt, 1);
}

/** The MacBook centred in the band under the nav, the screen inside its bezel. */
function phoneHeroKeyframe(viewport: Viewport): Keyframe {
  const s = phoneHeroPt(viewport);
  const air = (phoneHeroBandHeight(viewport) - FRAME_HEIGHT * s) / 2;
  return { s, nx: viewport.width / 2, ny: CAMERA.phoneTopPx + air + FRAME.bezelTop * s };
}

function phoneNotchKeyframe(viewport: Viewport): Keyframe {
  return { s: phoneNotchPt(viewport), nx: viewport.width / 2, ny: CAMERA.phoneNotchTopPx };
}

function cameraAt(k: Keyframe): Camera {
  return {
    scale: k.s,
    originX: k.nx,
    originY: k.ny,
    translateX: k.nx - SCENE.notchOrigin.x * k.s,
    translateY: k.ny,
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
    return cameraAt(lerpKeyframe(phoneHeroKeyframe(viewport), phoneNotchKeyframe(viewport), clamp(progress, 0, 1)));
  }
  const overview = overviewKeyframe(viewport);
  const t2 = secondSegmentT(progress);
  if (t2 === null) {
    const t = clamp(progress, 0, 1) / CAMERA.overviewProgress;
    return cameraAt(lerpKeyframe(heroKeyframe(viewport), overview, t));
  }
  return cameraAt(lerpKeyframe(overview, featuresKeyframe(viewport, pinnedColumnWidth), t2));
}

/** The `--pt` the scene renders at: the sharpest scale the camera reaches, so it never upscales a bitmap. */
export function renderPtFor(viewport: Viewport, pinnedColumnWidth: number): number {
  if (isPhone(viewport)) return Math.max(phoneHeroPt(viewport), phoneNotchPt(viewport));
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

/** The phone hero title: fully visible at 0, gone by half progress. */
export function phoneTitleOpacityFor(progress: number): number {
  return 1 - clamp(progress / CAMERA.phoneTitleFadeEnd, 0, 1);
}

/** Scroll runway of the stage camera: 100 svh on phones, 160 svh on desktop. */
export function runwayVhFor(viewport: Viewport): number {
  return isPhone(viewport) ? CAMERA.phoneRunwayVh : CAMERA.runwayVh;
}

/** CSS transform of the camera layer (transform-origin `0 0`), with the scene rendered at `renderPt`. */
export function cameraTransform(camera: Camera, renderPt: number): string {
  return `translate3d(${camera.translateX.toFixed(2)}px, ${camera.translateY.toFixed(2)}px, 0) scale(${(camera.scale / renderPt).toFixed(5)})`;
}
