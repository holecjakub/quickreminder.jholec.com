import type { Transition } from 'motion/react';
import { Motion, scaled, type Easing, type PhysicalSpring } from '../machine/springs';

/** The animation a flag change of the notch plays (Swift `NotchContainerView` animation choice). */
export type FlagAnimation = 'open' | 'close' | 'saving' | 'schedule' | 'hoverIn' | 'hoverOut' | 'none';

export const INSTANT: Transition = { duration: 0 };

/** A physical spring or an easing as a motion transition, slowed by `timeScale`. */
export function toTransition(m: PhysicalSpring | Easing, timeScale: number): Transition {
  if (m.type === 'spring') {
    const { stiffness, damping, mass } = scaled(m, timeScale);
    return { type: 'spring', stiffness, damping, mass };
  }
  const tween: Transition = { type: 'tween', ease: [...m.ease], duration: m.duration * timeScale };
  return m.delay === undefined ? tween : { ...tween, delay: m.delay * timeScale };
}

export type EffectiveMotion = 'open' | 'close' | 'schedule' | 'contentIn' | 'contentOut';

/** Swift `NotchLayout.effective*` / `effectiveSection`: reduce motion swaps in easeOut 0.15. */
export function effective(name: EffectiveMotion, reduceMotion: boolean, timeScale: number): Transition {
  return toTransition(reduceMotion ? Motion.reduced : Motion[name], timeScale);
}

/** Swift `View.staggered(_:)`: easeOut 0.24 after 0.06 + i·0.035; reduce motion → easeOut 0.15. */
export function staggerTransition(index: 0 | 1 | 2 | 3, reduceMotion: boolean, timeScale: number): Transition {
  return toTransition(reduceMotion ? Motion.reduced : Motion.stagger(index), timeScale);
}
