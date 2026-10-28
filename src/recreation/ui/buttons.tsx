// Port of HoverButtonStyle.swift + NotchButtonStyles.swift: the hover / press button styles of the notch.
import {
  forwardRef, useState,
  type ButtonHTMLAttributes, type CSSProperties, type DOMAttributes, type ReactNode,
} from 'react';
import { motion, type HTMLMotionProps, type Transition } from 'motion/react';
import { Motion, type Easing, type PhysicalSpring } from '../machine/springs';
import { INSTANT, toTransition } from './transitions';
import { useMotionPrefs } from './motionPrefs';
import { px } from './units';

// Replaced by the type declared in Recreation.tsx (Task 23 Step 5).
type PointerTarget = string;

export type PressState = 'rest' | 'hover' | 'pressed';

type PressHandlers = Pick<DOMAttributes<HTMLElement>,
  'onPointerEnter' | 'onPointerLeave' | 'onPointerDown' | 'onPointerUp' | 'onPointerCancel'>;

/** pointerenter → hover, pointerdown → pressed, pointerup → hover, pointerleave / cancel → rest; disabled → rest. */
export function usePressState(disabled = false): { state: PressState; handlers: PressHandlers } {
  const [raw, setRaw] = useState<PressState>('rest');
  const handlers: PressHandlers = {
    onPointerEnter: () => setRaw('hover'),
    onPointerLeave: () => setRaw('rest'),
    onPointerDown: () => setRaw('pressed'),
    onPointerUp: () => setRaw('hover'),
    onPointerCancel: () => setRaw('rest'),
  };
  return { state: disabled ? 'rest' : raw, handlers };
}

/**
 * The transition for the latest press-state change: `Motion.press` when pressed was entered or left,
 * `hoverMotion` when only hover changed, `INSTANT` under Reduce Motion. The previous state is kept in
 * state and updated during render (React's "adjust state on prop change" pattern), so render stays pure.
 */
export function usePressTransition(state: PressState, hoverMotion: PhysicalSpring | Easing): Transition {
  const { reduceMotion, timeScale } = useMotionPrefs();
  const [last, setLast] = useState({ state, pressChanged: false });
  let pressChanged = last.pressChanged;
  if (last.state !== state) {
    pressChanged = (last.state === 'pressed') !== (state === 'pressed');
    setLast({ state, pressChanged });
  }
  return reduceMotion ? INSTANT : toTransition(pressChanged ? Motion.press : hoverMotion, timeScale);
}

/** Swift `HoverMotion`: hoverScale 1.06, pressedScale 0.94, none under Reduce Motion. */
export function hoverScaleFor(state: PressState, reduceMotion: boolean): number {
  if (reduceMotion || state === 'rest') return 1;
  return state === 'hover' ? 1.06 : 0.94;
}

export function highlightAlpha(state: PressState): number {
  return state === 'rest' ? 0 : state === 'hover' ? 0.1 : 0.18;
}

export type FillKind = 'neutral' | 'selected' | 'prominent';

const NEUTRAL_FILL: Readonly<Record<PressState, string>> = {
  rest: 'rgba(255, 255, 255, 0.06)',
  hover: 'rgba(255, 255, 255, 0.11)',
  pressed: 'rgba(255, 255, 255, 0.15)',
};
const SELECTED_FILL: Readonly<Record<PressState, string>> = {
  rest: 'var(--qr-accent-20)',
  hover: 'var(--qr-accent-27)',
  pressed: 'var(--qr-accent-32)',
};

/** Swift `NotchFillButtonStyle` background. */
export function notchFill(kind: FillKind, state: PressState, enabled: boolean): string {
  if (kind === 'prominent') return enabled ? 'var(--qr-list-accent)' : 'var(--qr-gray-circle-disabled)';
  return kind === 'selected' ? SELECTED_FILL[state] : NEUTRAL_FILL[state];
}

/** Swift `NotchTextButtonStyle` label alpha. */
export function notchTextAlpha(state: PressState): number {
  return state === 'rest' ? 0.6 : state === 'hover' ? 0.85 : 0.95;
}

/** Swift `DayCellStyle` disc alpha: only when not selected and enabled. */
export function dayCellAlpha(state: PressState, selected: boolean, enabled: boolean): number {
  if (selected || !enabled || state === 'rest') return 0;
  return state === 'hover' ? 0.09 : 0.16;
}

type BaseProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style'> & { target?: PointerTarget; style?: CSSProperties };

/** Splits the props every button shares from the DOM props that go to the `<button>`. */
function split(props: BaseProps & { children?: ReactNode }) {
  const { target, style, disabled, children, ...rest } = props;
  return { target, style, disabled: disabled ?? false, children, rest };
}

function cursorFor(disabled: boolean): 'pointer' | 'default' {
  return disabled ? 'default' : 'pointer';
}

/** Scales its label on hover / press while the button frame (the hit area) stays put. */
export const HoverButton = forwardRef<HTMLButtonElement, BaseProps>(function HoverButton(props, ref) {
  const { target, style, disabled, children, rest } = split(props);
  const { reduceMotion } = useMotionPrefs();
  const { state, handlers } = usePressState(disabled);
  const transition = usePressTransition(state, Motion.hoverScale);
  return (
    <button
      type="button" ref={ref} {...rest} {...handlers} disabled={disabled}
      data-state={state} data-qr-target={target}
      style={{ cursor: cursorFor(disabled), ...style }}
    >
      <motion.span
        style={{ display: 'inline-flex' }}
        initial={false}
        animate={{ scale: hoverScaleFor(state, reduceMotion) }}
        transition={transition}
      >
        {children}
      </motion.span>
    </button>
  );
});

/** A round highlight of its own size behind the label (Swift `HoverHighlightButtonStyle`). */
export const HoverHighlightButton = forwardRef<HTMLButtonElement, BaseProps & { size: number }>(
  function HoverHighlightButton({ size, ...props }, ref) {
    const { target, style, disabled, children, rest } = split(props);
    const { state, handlers } = usePressState(disabled);
    const transition = usePressTransition(state, Motion.highlight);
    return (
      <button
        type="button" ref={ref} {...rest} {...handlers} disabled={disabled}
        data-state={state} data-qr-target={target}
        style={{ position: 'relative', width: px(size), height: px(size), cursor: cursorFor(disabled), ...style }}
      >
        <motion.span
          data-qr-highlight=""
          style={{ position: 'absolute', inset: 0, borderRadius: '50%' }}
          initial={false}
          animate={{ backgroundColor: `rgba(255, 255, 255, ${highlightAlpha(state)})` }}
          transition={transition}
        />
        <span style={{ position: 'relative', display: 'inline-flex' }}>{children}</span>
      </button>
    );
  },
);

/** A filled pill / rounded rect: neutral, selected (accent fill + inside stroke) or prominent. */
export const NotchFillButton = forwardRef<HTMLButtonElement, BaseProps & { kind: FillKind; radius: number | null }>(
  function NotchFillButton({ kind, radius, ...props }, ref) {
    const { target, style, disabled, children, rest } = split(props);
    const { reduceMotion } = useMotionPrefs();
    const { state, handlers } = usePressState(disabled);
    const transition = usePressTransition(state, Motion.highlight);
    // React's drag / animation handler types clash with motion's; the shared DOM props are plain button props.
    return (
      <motion.button
        type="button" ref={ref} {...(rest as HTMLMotionProps<'button'>)} {...handlers} disabled={disabled}
        data-state={state} data-kind={kind} data-qr-target={target}
        initial={false}
        animate={{
          backgroundColor: notchFill(kind, state, !disabled),
          scale: state === 'pressed' && !reduceMotion ? 0.97 : 1,
        }}
        transition={transition}
        style={{
          borderRadius: px(radius ?? 999),
          boxShadow: kind === 'selected' ? `inset 0 0 0 ${px(1)} var(--qr-accent-80)` : undefined,
          opacity: disabled ? 0.55 : 1,
          cursor: cursorFor(disabled),
          ...style,
        }}
      >
        {children}
      </motion.button>
    );
  },
);

/** Plain 13/500 text button whose label brightens on hover and press. */
export const NotchTextButton = forwardRef<HTMLButtonElement, BaseProps>(function NotchTextButton(props, ref) {
  const { target, style, disabled, children, rest } = split(props);
  const { state, handlers } = usePressState(disabled);
  return (
    <button
      type="button" ref={ref} {...rest} {...handlers} disabled={disabled}
      data-state={state} data-qr-target={target}
      style={{
        fontSize: px(13), fontWeight: 500, color: `rgba(255, 255, 255, ${notchTextAlpha(state)})`,
        padding: `0 ${px(8)}`, height: px(36), cursor: cursorFor(disabled), ...style,
      }}
    >
      {children}
    </button>
  );
});

/** A calendar day cell: full-cell hit area with a centred 28 pt hover / press disc. */
export const DayCellButton = forwardRef<HTMLButtonElement, BaseProps & { selected: boolean }>(
  function DayCellButton({ selected, ...props }, ref) {
    const { target, style, disabled, children, rest } = split(props);
    const { state, handlers } = usePressState(disabled);
    return (
      <button
        type="button" ref={ref} {...rest} {...handlers} disabled={disabled}
        data-state={state} data-qr-target={target}
        style={{ position: 'relative', cursor: cursorFor(disabled), ...style }}
      >
        <span
          aria-hidden="true"
          style={{
            position: 'absolute', left: '50%', top: '50%', width: px(28), height: px(28),
            transform: 'translate(-50%, -50%)', borderRadius: '50%',
            backgroundColor: `rgba(255, 255, 255, ${dayCellAlpha(state, selected, !disabled)})`,
          }}
        />
        <span style={{ position: 'relative', display: 'inline-flex' }}>{children}</span>
      </button>
    );
  },
);

/** A keyboard-shortcut cap: 11/600 white 50 % on white 10 %. */
export function KeyHint(props: { children: string }): JSX.Element {
  return (
    <span
      aria-hidden="true"
      style={{
        fontSize: px(11), fontWeight: 600, color: 'rgba(255, 255, 255, 0.5)',
        backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: px(4), padding: `${px(1)} ${px(5)}`,
      }}
    >
      {props.children}
    </span>
  );
}
