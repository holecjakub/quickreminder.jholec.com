// The fake Reminders window (contracts §4.1, §4.2): an original panel, not Apple chrome, that lists the
// reminders saved in the demo and slides in from the right 0.2 s after the first ✓ lands.
import { Flag } from '@phosphor-icons/react';
import { AnimatePresence, motion, type Transition } from 'motion/react';
import { useId } from 'react';
import type { SavedReminder } from '../recreation';
import { REMINDERS_WINDOW, ptCss } from './scene';

/** = Motion.chip (contracts §7: response 0.30, damping 0.80), copied because desktop/ may only import the recreation's public surface. */
export const WINDOW_SPRING: { readonly type: 'spring'; readonly stiffness: 438.65; readonly damping: 33.51; readonly mass: 1 } = {
  type: 'spring',
  stiffness: 438.65,
  damping: 33.51,
  mass: 1,
};

/** After the ✓ lands (contracts §4.1). */
export const WINDOW_DELAY_S = 0.2 as const;

export const WINDOW_COPY: {
  readonly title: 'Your reminders';
  readonly footnote: 'Saved in this demo only. Nothing leaves your browser.';
} = {
  title: 'Your reminders',
  footnote: 'Saved in this demo only. Nothing leaves your browser.',
};

export interface RemindersWindowProps {
  items: readonly SavedReminder[];
  scheme: 'light' | 'dark';
  pt: number;
  reduceMotion: boolean;
  timeScale?: number;
}

const HEADER_HEIGHT = 48;
const FOOTNOTE_HEIGHT = 34;
/** Reduced motion: opacity only, easeOut 0.15 s (contracts §7 `reduced`). */
const REDUCED_DURATION_S = 0.15;

const COLORS = {
  light: {
    surface: 'rgba(255, 255, 255, 0.86)',
    border: 'rgba(0, 0, 0, 0.08)',
    shadowAlpha: 0.18,
    text: '#1D1D1F',
    muted: '#5E5E63',
  },
  dark: {
    surface: 'rgba(28, 28, 30, 0.86)',
    border: 'rgba(255, 255, 255, 0.10)',
    shadowAlpha: 0.5,
    text: '#F5F5F7',
    muted: '#AEAEB2',
  },
} as const;

function transitionFor(reduceMotion: boolean, timeScale: number): Transition {
  const delay = WINDOW_DELAY_S * timeScale;
  if (reduceMotion) return { type: 'tween', ease: 'easeOut', duration: REDUCED_DURATION_S * timeScale, delay };
  return {
    ...WINDOW_SPRING,
    stiffness: WINDOW_SPRING.stiffness / (timeScale * timeScale),
    damping: WINDOW_SPRING.damping / timeScale,
    delay,
  };
}

export function RemindersWindow({ items, scheme, pt, reduceMotion, timeScale = 1 }: RemindersWindowProps) {
  const titleId = useId();
  if (items.length === 0) return null;

  const colors = COLORS[scheme];
  const transition = transitionFor(reduceMotion, timeScale);
  const newestFirst = [...items].sort((a, b) => b.savedAt.getTime() - a.savedAt.getTime());

  return (
    <motion.section
      aria-labelledby={titleId}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 40 * pt }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
      transition={transition}
      style={{
        position: 'absolute',
        left: ptCss(REMINDERS_WINDOW.x),
        top: ptCss(REMINDERS_WINDOW.y),
        width: ptCss(REMINDERS_WINDOW.width),
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxSizing: 'border-box',
        borderRadius: ptCss(16),
        border: `${ptCss(1)} solid ${colors.border}`,
        background: colors.surface,
        boxShadow: `0 ${ptCss(18)} ${ptCss(50)} rgba(0, 0, 0, ${colors.shadowAlpha})`,
        backdropFilter: `blur(${ptCss(30)})`,
        WebkitBackdropFilter: `blur(${ptCss(30)})`,
        color: colors.text,
        fontFamily: 'var(--qr-font)',
      }}
    >
      <header
        style={{
          height: ptCss(HEADER_HEIGHT),
          padding: `0 ${ptCss(16)}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <h2 id={titleId} style={{ margin: 0, fontSize: ptCss(15), fontWeight: 700 }}>
          {WINDOW_COPY.title}
        </h2>
        <span style={{ fontSize: ptCss(15), fontWeight: 600, color: colors.muted, fontVariantNumeric: 'tabular-nums' }}>
          {items.length}
        </span>
      </header>
      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: 'none',
          maxHeight: ptCss(REMINDERS_WINDOW.maxHeight - HEADER_HEIGHT - FOOTNOTE_HEIGHT),
          overflowY: 'auto',
        }}
      >
        <AnimatePresence initial={false}>
          {newestFirst.map((item) => (
            <motion.li
              key={item.id}
              layout={!reduceMotion}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={transition}
              style={{ display: 'flex', alignItems: 'flex-start', gap: ptCss(10), padding: `${ptCss(10)} ${ptCss(16)}` }}
            >
              <span
                data-list-dot=""
                aria-hidden="true"
                style={{
                  width: ptCss(10),
                  height: ptCss(10),
                  marginTop: ptCss(5),
                  flexShrink: 0,
                  borderRadius: '50%',
                  backgroundColor: item.listColor,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: ptCss(14), fontWeight: 500, overflowWrap: 'anywhere' }}>{item.title}</div>
                {item.dueLabel !== null && (
                  <div style={{ fontSize: ptCss(12), fontWeight: 400, color: colors.muted, fontVariantNumeric: 'tabular-nums' }}>
                    {item.dueLabel}
                  </div>
                )}
                {item.notes !== null && (
                  <div
                    data-notes=""
                    style={{
                      fontSize: ptCss(12),
                      color: colors.muted,
                      whiteSpace: 'pre-line',
                      display: '-webkit-box',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: 2,
                      overflow: 'hidden',
                    }}
                  >
                    {item.notes}
                  </div>
                )}
              </div>
              {item.flagged && (
                <Flag
                  weight="fill"
                  role="img"
                  aria-label="Flagged"
                  style={{ width: ptCss(13), height: ptCss(13), flexShrink: 0, color: 'var(--qr-flag-orange, #FF9E0A)' }}
                />
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <p style={{ margin: 0, padding: `${ptCss(10)} ${ptCss(16)} ${ptCss(12)}`, fontSize: ptCss(11), color: colors.muted }}>
        {WINDOW_COPY.footnote}
      </p>
    </motion.section>
  );
}
