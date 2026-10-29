// Swift `.contentTransition(.numericText())`: a text whose changed characters roll — the old glyph
// leaves upwards and fades, the new one comes up from below; the unchanged ones stay put. Each glyph
// is keyed by its position and character, so only the glyphs that changed re-mount.
import { AnimatePresence, motion } from 'motion/react';
import type { CSSProperties } from 'react';
import { Motion } from '../machine/springs';
import { useMotionPrefs } from './motionPrefs';
import { INSTANT, toTransition } from './transitions';

/** The full text for assistive technology; the glyph spans are hidden from it. */
const VISUALLY_HIDDEN: CSSProperties = {
  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
  overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0,
};

export function NumericText(props: { text: string }): JSX.Element {
  const { text } = props;
  const { reduceMotion, timeScale } = useMotionPrefs();
  const transition = reduceMotion ? INSTANT : toTransition(Motion.chip, timeScale);
  return (
    <span data-qr-numeric-text="" style={{ position: 'relative', display: 'inline-flex', whiteSpace: 'pre' }}>
      <span style={VISUALLY_HIDDEN}>{text}</span>
      <AnimatePresence initial={false} mode="popLayout">
        {[...text].map((char, index) => {
          const key = `${index}:${char}`;
          return (
            <motion.span
              key={key}
              aria-hidden="true"
              data-char-key={key}
              style={{ display: 'inline-block' }}
              initial={{ y: '0.6em', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '-0.6em', opacity: 0 }}
              transition={transition}
            >
              {char}
            </motion.span>
          );
        })}
      </AnimatePresence>
    </span>
  );
}
