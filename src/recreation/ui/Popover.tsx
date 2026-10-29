// The recreation's only popup surface (landing spec §11.4): not a macOS menu imitation but the
// panel's own language — pure black, 12 pt corners, 1 pt pill stroke, anchored 8 pt below its trigger.
import type { ReactNode } from 'react';
import { motion, useIsPresent } from 'motion/react';
import { Motion } from '../machine/springs';
import { useMotionPrefs } from './motionPrefs';
import { toTransition } from './transitions';
import { px } from './units';

/** A point in the open canvas; `center` centres the surface on `x`, `start` puts its left edge there. */
export interface PopoverAnchor {
  readonly x: number;
  readonly y: number;
  readonly align: 'start' | 'center';
}

/** Below "Reminders ▾": left = content inset 24 + 39 = 63, top = header row bottom 83 + 8 = 91. */
export const LIST_PICKER_ANCHOR: PopoverAnchor = { x: 63, y: 91, align: 'start' };

/**
 * Mount inside `AnimatePresence`: fades and scales 0.96 → 1 from the top with `Motion.highlight`; reduced → opacity only.
 * While it animates out it is already gone for assistive tech and the pointer (`aria-hidden`, no pointer events).
 */
export function PopoverSurface(props: {
  anchor: PopoverAnchor;
  name: 'lists';
  label: string;
  role: 'menu';
  minWidth?: number;
  padding?: string;
  children: ReactNode;
}): JSX.Element {
  const { anchor, name, label, role, minWidth, padding, children } = props;
  const { reduceMotion, timeScale } = useMotionPrefs();
  const present = useIsPresent();
  const hidden = reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 };
  return (
    <motion.div
      role={role}
      aria-label={label}
      data-qr-popover={name}
      aria-hidden={present ? undefined : true}
      initial={hidden}
      animate={{ opacity: 1, scale: 1 }}
      exit={hidden}
      transition={toTransition(Motion.highlight, timeScale)}
      style={{
        position: 'absolute',
        left: px(anchor.x),
        top: px(anchor.y),
        x: anchor.align === 'center' ? '-50%' : 0,
        transformOrigin: anchor.align === 'center' ? 'top center' : 'top left',
        minWidth: minWidth === undefined ? undefined : px(minWidth),
        padding,
        background: 'var(--qr-black)',
        border: `${px(1)} solid var(--qr-pill-stroke)`,
        borderRadius: px(12),
        pointerEvents: present ? 'auto' : 'none',
      }}
    >
      {children}
    </motion.div>
  );
}
