// The nudge under the notch (landing §1, §11.3): a glass capsule that bobs until the visitor opens the panel.
import { useEffect, useState } from 'react';
import { HINT_TOP, SCENE, ptCss } from './scene';
import { useMediaQuery } from './useMediaQuery';

export const HINT_COPY: {
  readonly line1: 'Click the notch to add a reminder';
  readonly line1Touch: 'Tap the notch to add a reminder';
  readonly line2: 'In the app: ⇧⌘R from anywhere.';
} = {
  line1: 'Click the notch to add a reminder',
  line1Touch: 'Tap the notch to add a reminder',
  line2: 'In the app: ⇧⌘R from anywhere.',
};

export const HINT_FADE_MS = 400 as const;
/** Reduced motion fades over 150 ms (contracts §7 `reduced`). */
const REDUCED_FADE_MS = 150;
const BOB_MS = 1600;

export interface NotchHintProps {
  visible: boolean;
  scheme: 'light' | 'dark';
  reduceMotion: boolean;
  timeScale?: number;
  onOpen(): void;
}

const COLORS = {
  light: { background: 'rgba(255, 255, 255, 0.78)', line1: '#1D1D1F', line2: '#3A3A3C' },
  dark: { background: 'rgba(0, 0, 0, 0.45)', line1: '#F5F5F7', line2: '#C7C7CC' },
} as const;

const BOB_KEYFRAMES = `@keyframes qr-hint-bob {
  0%, 100% { transform: translate(-50%, 0) }
  50% { transform: translate(-50%, ${ptCss(3)}) }
}`;

export function NotchHint({ visible, scheme, reduceMotion, timeScale = 1, onOpen }: NotchHintProps) {
  const coarse = useMediaQuery('(pointer: coarse)');
  const [faded, setFaded] = useState(!visible);
  const fadeMs = (reduceMotion ? REDUCED_FADE_MS : HINT_FADE_MS) * timeScale;

  useEffect(() => {
    if (visible) return;
    const id = setTimeout(() => setFaded(true), fadeMs);
    return () => {
      clearTimeout(id);
      setFaded(false);
    };
  }, [visible, fadeMs]);

  if (!visible && faded) return null;

  const colors = COLORS[scheme];
  const line1 = coarse ? HINT_COPY.line1Touch : HINT_COPY.line1;
  return (
    <button
      type="button"
      aria-label={line1}
      onClick={onOpen}
      style={{
        position: 'absolute',
        top: ptCss(HINT_TOP),
        left: ptCss(SCENE.notchOrigin.x),
        transform: 'translateX(-50%)',
        zIndex: 25,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: ptCss(2),
        padding: `${ptCss(8)} ${ptCss(14)}`,
        border: 0,
        borderRadius: ptCss(999),
        background: colors.background,
        backdropFilter: `blur(${ptCss(20)})`,
        WebkitBackdropFilter: `blur(${ptCss(20)})`,
        fontFamily: 'var(--qr-font)',
        textAlign: 'center',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: `opacity ${fadeMs}ms ease-out`,
        animation: reduceMotion ? 'none' : `qr-hint-bob ${BOB_MS * timeScale}ms ease-in-out infinite`,
      }}
    >
      <style>{BOB_KEYFRAMES}</style>
      <span style={{ color: colors.line1, fontSize: ptCss(15), fontWeight: 600 }}>{line1}</span>
      <span style={{ color: colors.line2, fontSize: ptCss(12), fontWeight: 500 }}>{HINT_COPY.line2}</span>
    </button>
  );
}
