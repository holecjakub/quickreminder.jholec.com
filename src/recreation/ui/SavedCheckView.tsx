// `SavedCheckView` (Views/SavedCheckView.swift): the accent badge whose checkmark draws itself in
// after the save button's flight into the notch, then pops. The fade-out and the shared
// `matchedGeometryEffect(id: "save")` come from `NotchContainerView`.
import { motion, useAnimate, type Transition } from 'motion/react';
import { useEffect, useState } from 'react';
import { Motion } from '../machine/springs';
import { useMotionPrefs } from './motionPrefs';
import { toTransition } from './transitions';
import { px } from './units';

/** `NotchLayout.savedBadgeSize`; the stroke is `size * 0.11`, the tick's padding `size * 0.27`. */
export const BADGE = { size: 24, strokeRatio: 0.11, insetRatio: 0.27 } as const;

const STROKE = BADGE.size * BADGE.strokeRatio; // 2.64
const INSET = BADGE.size * BADGE.insetRatio; // 6.48
const TICK = BADGE.size - 2 * INSET; // 11.04

const round3 = (n: number): number => Number(n.toFixed(3));

/** `CheckmarkShape` in a w × h rect: (0, 0.55h) → (0.38w, 0.92h) → (w, 0.12h), 3 decimals. */
export function checkmarkPath(w: number, h: number): string {
  return `M0 ${round3(h * 0.55)} L${round3(w * 0.38)} ${round3(h * 0.92)} L${round3(w)} ${round3(h * 0.12)}`;
}

export interface BadgeTimeline {
  tick: Transition;
  up: Transition & { to: 1.18 };
  settle: Transition & { to: 1 };
}

/** Swift `onAppear`: trim easeOut 0.28 after 0.32, spring to 1.18× after 0.55, spring back to 1×
 *  after 0.72. Null under reduce motion: the tick is simply drawn, no pop. */
export function badgeTimeline(reduceMotion: boolean, timeScale: number): BadgeTimeline | null {
  if (reduceMotion) return null;
  return {
    tick: toTransition(Motion.tickTrim, timeScale),
    up: { ...toTransition(Motion.badgeBounce, timeScale), delay: 0.55 * timeScale, to: 1.18 },
    settle: { ...toTransition(Motion.badgeSettle, timeScale), delay: 0.72 * timeScale, to: 1 },
  };
}

/** `visible` = `flags.isSaving`: the badge fades out in place with `Motion.badgeFade`. */
export function SavedCheckView(props: { visible: boolean }): JSX.Element {
  const { reduceMotion, timeScale } = useMotionPrefs();
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const [progress, setProgress] = useState(reduceMotion ? 1 : 0);

  useEffect(() => {
    const timeline = badgeTimeline(reduceMotion, timeScale);
    if (!timeline) return;
    let mounted = true;
    const path = scope.current.querySelector('path') as SVGPathElement;
    const { delay: upDelay = 0, to: upTo, ...up } = timeline.up;
    const { delay: settleDelay = 0, to: settleTo, ...settle } = timeline.settle;
    void animate(path, { pathLength: 1 }, timeline.tick).then(() => mounted && setProgress(1));
    void animate(scope.current, { scale: upTo }, { ...up, delay: upDelay });
    // SwiftUI retargets the running pop at 0.72 s; starting the settle earlier would cancel the pop.
    const settleTimer = setTimeout(() => void animate(scope.current, { scale: settleTo }, settle), settleDelay * 1000);
    return () => {
      mounted = false;
      clearTimeout(settleTimer);
    };
    // Plays once on appear, like Swift `onAppear`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      ref={scope}
      layoutId="save"
      role="img"
      aria-label="Saved"
      data-qr-badge=""
      data-progress={String(progress)}
      initial={false}
      animate={{ opacity: props.visible ? 1 : 0 }}
      transition={{
        layout: toTransition(Motion.saving, timeScale),
        opacity: toTransition(Motion.badgeFade, timeScale),
      }}
      style={{
        position: 'relative', flex: 'none', width: px(BADGE.size), height: px(BADGE.size),
        background: 'var(--qr-list-accent)', borderRadius: '50%', pointerEvents: 'none',
      }}
    >
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${TICK} ${TICK}`}
        style={{ position: 'absolute', left: px(INSET), top: px(INSET), width: px(TICK), height: px(TICK), overflow: 'visible' }}
      >
        <motion.path
          d={checkmarkPath(TICK, TICK)}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: progress }}
        />
      </svg>
    </motion.div>
  );
}
