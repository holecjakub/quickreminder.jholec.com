import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import {
  CURSOR_AUTO_HIDE_MS,
  CURSOR_EASE,
  CURSOR_HOME,
  CURSOR_HOTSPOT,
  CURSOR_PRESS,
  cursorDuration,
  type FakeCursorHandle,
  type ScenePoint,
} from './fakeCursor';
import { ptCss } from './scene';

export interface FakeCursorProps {
  idleOpacity?: number;
  timeScale?: number;
  reduceMotion?: boolean;
}

const OPACITY_TRANSITION = 'opacity 250ms ease-out';

function abortError(): DOMException {
  return new DOMException('Aborted', 'AbortError');
}

function transformFor(p: ScenePoint): string {
  return `translate(${ptCss(p.x - CURSOR_HOTSPOT.x)}, ${ptCss(p.y - CURSOR_HOTSPOT.y)})`;
}

/** The demo cursor: an absolutely positioned arrow moved by a CSS transform transition (no rAF). */
export const FakeCursor = forwardRef<FakeCursorHandle, FakeCursorProps>(function FakeCursor(
  { idleOpacity = 0, timeScale = 1, reduceMotion = false },
  ref,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<SVGSVGElement>(null);
  const pos = useRef<ScenePoint>(CURSOR_HOME);
  const pinned = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const moveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<{ resolve: () => void; reject: (e: DOMException) => void } | null>(null);
  const idle = useRef(idleOpacity);
  const scale = useRef(timeScale);
  const reduced = useRef(reduceMotion);
  idle.current = idleOpacity;
  scale.current = timeScale;
  reduced.current = reduceMotion;

  const setOpacity = (value: number): void => {
    if (rootRef.current) rootRef.current.style.opacity = String(value);
  };
  const clearHide = (): void => clearTimeout(hideTimer.current);
  const armAutoHide = (): void => {
    clearHide();
    if (pinned.current) return;
    hideTimer.current = setTimeout(() => setOpacity(idle.current), CURSOR_AUTO_HIDE_MS * scale.current);
  };
  const cancelMove = (): void => {
    clearTimeout(moveTimer.current);
    const move = pending.current;
    pending.current = null;
    move?.reject(abortError());
  };

  useImperativeHandle(ref, () => ({
    moveTo(point, opts) {
      cancelMove();
      const el = rootRef.current;
      const instant = reduced.current;
      const ms = instant ? 0 : (opts?.durationMs ?? cursorDuration(pos.current, point)) * scale.current;
      pos.current = point;
      clearHide();
      if (el) {
        el.style.transition = instant
          ? OPACITY_TRANSITION
          : `transform ${ms}ms cubic-bezier(${CURSOR_EASE.join(', ')}), ${OPACITY_TRANSITION}`;
        el.style.transform = transformFor(point);
        el.style.opacity = '1';
      }
      return new Promise<void>((resolve, reject) => {
        pending.current = { resolve, reject };
        moveTimer.current = setTimeout(() => {
          pending.current = null;
          armAutoHide();
          resolve();
        }, ms);
      });
    },
    click() {
      const arrow = arrowRef.current;
      if (arrow) arrow.style.transform = `scale(${CURSOR_PRESS.scale})`;
      clearHide();
      setOpacity(1);
      clearTimeout(pressTimer.current);
      return new Promise<void>((resolve) => {
        pressTimer.current = setTimeout(() => {
          if (arrow) arrow.style.transform = 'scale(1)';
          armAutoHide();
          resolve();
        }, CURSOR_PRESS.ms * scale.current);
      });
    },
    show() {
      setOpacity(1);
      armAutoHide();
    },
    hide() {
      clearHide();
      setOpacity(0);
    },
    pin(value) {
      pinned.current = value;
      if (value) {
        clearHide();
        setOpacity(1);
      } else {
        armAutoHide();
      }
    },
    position: () => pos.current,
    cancel: cancelMove,
  }));

  useEffect(
    () => () => {
      clearHide();
      clearTimeout(pressTimer.current);
      clearTimeout(moveTimer.current);
      // Unmounting settles a running move instead of leaving it pending or rejecting unobserved.
      pending.current?.resolve();
      pending.current = null;
    },
    [],
  );

  return (
    <div
      ref={rootRef}
      data-fake-cursor=""
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        zIndex: 40,
        pointerEvents: 'none',
        transform: transformFor(CURSOR_HOME),
        transition: OPACITY_TRANSITION,
        opacity: idleOpacity,
      }}
    >
      <svg
        ref={arrowRef}
        aria-hidden="true"
        width={ptCss(18)}
        height={ptCss(24)}
        viewBox="0 0 18 24"
        style={{
          display: 'block',
          pointerEvents: 'none',
          transform: 'scale(1)',
          transformOrigin: `${ptCss(CURSOR_HOTSPOT.x)} ${ptCss(CURSOR_HOTSPOT.y)}`,
          transition: `transform ${CURSOR_PRESS.ms}ms ease-out`,
          filter: `drop-shadow(0 ${ptCss(1)} ${ptCss(2)} rgba(0,0,0,0.35))`,
        }}
      >
        <path
          d="M2 1.5 L2 19.2 L6.4 15.1 L9.4 21.9 L12.3 20.7 L9.4 14 L15.2 14 Z"
          fill="#000000"
          stroke="#FFFFFF"
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
});
