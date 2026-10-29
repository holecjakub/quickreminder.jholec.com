// Port of Notch/NotchShape.swift drawing + PanelController.perform's animation choice: the black notch
// silhouette, whose size and both corner radii spring together in one transaction.
import { useEffect, useMemo } from 'react';
import { animate, motion, useMotionValue, useTransform, type MotionValue, type Transition } from 'motion/react';
import { notchPathSegments } from '../machine/notchShape';
import type { Size } from '../machine/notchLayout';
import { Motion } from '../machine/springs';
import { INSTANT, effective, toTransition, type FlagAnimation } from './transitions';
import { useMotionPrefs } from './motionPrefs';
import { px } from './units';

export interface ShapeTarget {
  readonly width: number;
  readonly height: number;
  readonly top: number;
  readonly bottom: number;
}

/** The transaction the shape springs in, per NotchRuntimeHost.setFlags animation (PanelController.perform). */
export function geometryTransition(animation: FlagAnimation, reduceMotion: boolean, timeScale: number): Transition {
  switch (animation) {
    case 'open':
    case 'close':
    case 'schedule':
      return effective(animation, reduceMotion, timeScale);
    case 'saving':
    case 'hoverIn':
    case 'hoverOut':
      return toTransition(Motion[animation], timeScale);
    case 'none':
      return INSTANT;
  }
}

const round3 = (x: number): string => String(Number(x.toFixed(3)));

/** notchPathSegments(w, h, top, bottom) shifted right by (containerWidth − w) / 2, numbers rounded to 3 decimals, closed with "Z". */
export function translatedNotchPath(shape: ShapeTarget, containerWidth: number): string {
  const dx = (containerWidth - shape.width) / 2;
  const body = notchPathSegments(shape.width, shape.height, shape.top, shape.bottom)
    .map((s) => s.cmd + s.args.map((v, i) => round3(i % 2 === 0 ? v + dx : v)).join(' '))
    .join(' ');
  return `${body} Z`;
}

export interface NotchGeometry {
  readonly width: MotionValue<number>;
  readonly height: MotionValue<number>;
  readonly top: MotionValue<number>;
  readonly bottom: MotionValue<number>;
}

/**
 * Four motion values starting at the first target; every target change animates all four with the same
 * transition. Running animations are stopped first, so a reopen mid-collapse reverses from the current shape.
 */
export function useNotchGeometry(target: ShapeTarget, animation: FlagAnimation): NotchGeometry {
  const { reduceMotion, timeScale } = useMotionPrefs();
  const width = useMotionValue(target.width);
  const height = useMotionValue(target.height);
  const top = useMotionValue(target.top);
  const bottom = useMotionValue(target.bottom);
  const geometry = useMemo<NotchGeometry>(() => ({ width, height, top, bottom }), [width, height, top, bottom]);
  const { width: w, height: h, top: t, bottom: b } = target;
  useEffect(() => {
    const transition = geometryTransition(animation, reduceMotion, timeScale);
    const pairs = [[geometry.width, w], [geometry.height, h], [geometry.top, t], [geometry.bottom, b]] as const;
    for (const [mv] of pairs) mv.stop();
    const controls = pairs.map(([mv, value]) => animate(mv, value, transition));
    return () => controls.forEach((c) => c.stop());
    // The animation and prefs only choose how the next target change moves, never trigger one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometry, w, h, t, b]);
  return geometry;
}

export function useNotchPath(geometry: NotchGeometry, containerWidth: number): MotionValue<string> {
  return useTransform(
    [geometry.width, geometry.height, geometry.top, geometry.bottom],
    ([width = 0, height = 0, top = 0, bottom = 0]: number[]) =>
      translatedNotchPath({ width, height, top, bottom }, containerWidth),
  );
}

/** Review focus R1: a touch has no hover, and a tap fires `pointerenter` before `pointerdown`, so a
 *  touch pointer must never arm the 90 ms dwell (the open spring would start from 257 × 44). Mouse
 *  and pen hover; an unreported type ('') is treated like the mouse the app was built for. */
export function pointerCanHover(pointerType: string): boolean {
  return pointerType !== 'touch';
}

/** The black silhouette over the whole canvas; only the painted shape takes the pointer. */
export function NotchSilhouette(props: {
  geometry: NotchGeometry;
  canvas: Size;
  /** Called for hover-capable pointers only (`pointerCanHover`). `relatedTarget` is where the pointer
   *  came from / went to, so the owner can tell a crossing between the path and a sibling of its own
   *  (the closed notch's hit layer) from a real change. */
  onHoverChange(entered: boolean, relatedTarget: EventTarget | null): void;
  onPress(): void;
}): JSX.Element {
  const { geometry, canvas, onHoverChange, onPress } = props;
  const d = useNotchPath(geometry, canvas.width);
  return (
    <svg
      viewBox={`0 0 ${canvas.width} ${canvas.height}`}
      style={{ width: px(canvas.width), height: px(canvas.height), pointerEvents: 'none' }}
      aria-hidden="true"
    >
      <motion.path
        d={d}
        fill="#000000"
        data-qr-target="notch"
        style={{ pointerEvents: 'visiblePainted' }}
        onPointerEnter={(e) => { if (pointerCanHover(e.pointerType)) onHoverChange(true, e.relatedTarget); }}
        onPointerLeave={(e) => { if (pointerCanHover(e.pointerType)) onHoverChange(false, e.relatedTarget); }}
        onPointerDown={() => onPress()}
      />
    </svg>
  );
}
