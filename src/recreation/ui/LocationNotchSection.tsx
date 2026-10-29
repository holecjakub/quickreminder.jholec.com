// Port of Views/LocationNotchSection.swift: Location inside the notch, appended below the bottom bar
// like Set Date — a field, then Clear · Cancel · Done. Nothing reaches the reminder until Done, Clear
// or ✓; Cancel, Esc, the location button and a click above close it without writing. Heights are
// `LocationMetrics`; ↩ / ⌘↩ are mapped by the keyboard layer.
import { motion } from 'motion/react';
import { useCallback, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { AccentContrast } from '../core/accentContrast';
import type { LocationDraft } from '../core/locationDraft';
import { LocationMetrics, ScheduleMetrics, Theme } from '../machine/notchLayout';
import { Motion } from '../machine/springs';
import { NotchFillButton, NotchTextButton } from './buttons';
import { SFIcon } from './icons';
import { useMotionPrefs } from './motionPrefs';
import { useCore, useRecreationState } from './RecreationContext';
import { staggerTransition } from './transitions';
import { px } from './units';

/** Swift Done `accessibilityLabel`. */
export function doneLabel(committed: string): string {
  return committed === '' ? 'Done, no location' : `Done, ${committed}`;
}

const FIELD = Theme.locationField;
const FOOTER = Theme.footer;
const RADIUS = ScheduleMetrics.controlRadius;

/**
 * The draft the section opened with. A new draft from the store replaces it; a dropped one (the
 * section closed) is kept, so the section still renders during its exit. Held in state and
 * replaced during render (React's "adjust state on prop change" pattern), so render stays pure.
 * `store.locationDraft` changes only with a store change, which `useRecreationState` re-renders on.
 */
function useCapturedDraft(): LocationDraft | null {
  const { store } = useCore();
  const [captured, setCaptured] = useState<LocationDraft | null>(null);
  const current = store.locationDraft;
  if (current !== null && current !== captured) {
    setCaptured(current);
    return current;
  }
  return captured;
}

export function LocationNotchSection(): JSX.Element | null {
  const state = useRecreationState();
  const draft = useCapturedDraft();
  // Nothing until the section first opens (the store hands out a draft with `section` 'location').
  if (draft === null) return null;
  return (
    <div
      role="group" aria-label="Location" data-qr-section="location"
      style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, paddingBottom: px(Theme.horizontalPadding) }}
    >
      <StaggeredRow index={0}>
        <LocationField value={state.locationField ?? draft.text} />
      </StaggeredRow>
      <StaggeredRow index={1} style={{ marginTop: px(LocationMetrics.footerGap) }}>
        <Footer hasLocation={state.location !== null} committed={draft.committed} accent={state.accent} />
      </StaggeredRow>
    </div>
  );
}

/** Swift `View.staggered(_:)`: opacity, −6 pt and a 3 pt blur in; under Reduce Motion only the opacity. */
function StaggeredRow(props: { index: 0 | 1; style?: CSSProperties; children: ReactNode }): JSX.Element {
  const { reduceMotion, timeScale } = useMotionPrefs();
  const hidden = reduceMotion ? { opacity: 0 } : { opacity: 0, y: px(-6), filter: `blur(${px(3)})` };
  const shown = reduceMotion ? { opacity: 1 } : { opacity: 1, y: px(0), filter: `blur(${px(0)})` };
  return (
    <motion.div
      data-qr-row="" data-stagger={String(props.index)} style={props.style}
      initial={hidden} animate={shown} transition={staggerTransition(props.index, reduceMotion, timeScale)}
    >
      {props.children}
    </motion.div>
  );
}

/** The field box: a click anywhere on it focuses the input (`.onTapGesture { fieldFocused = true }`). */
function LocationField({ value }: { value: string }): JSX.Element {
  const { controller, focus } = useCore();
  const { timeScale } = useMotionPrefs();
  const [focused, setFocused] = useState(false);
  const input = useRef<HTMLInputElement | null>(null);
  const register = useCallback(
    (el: HTMLInputElement | null) => {
      input.current = el;
      focus.register('locationField', el);
    },
    [focus],
  );
  const stroke = focused
    ? `color-mix(in srgb, var(--qr-list-accent) ${FIELD.focusStrokeAlpha * 100}%, transparent)`
    : `rgba(255, 255, 255, ${FIELD.strokeAlpha})`;
  const { ease, duration } = Motion.focusRing;
  return (
    <div
      data-qr-location-field=""
      onClick={() => input.current?.focus({ preventScroll: true })}
      style={{
        display: 'flex', alignItems: 'center', gap: px(FIELD.gap),
        height: px(LocationMetrics.field), paddingLeft: px(FIELD.padX), paddingRight: px(FIELD.padX),
        borderRadius: px(RADIUS), background: `rgba(255, 255, 255, ${FIELD.fillAlpha})`,
        boxShadow: `inset 0 0 0 ${px(1)} ${stroke}`,
        transition: `box-shadow ${duration * timeScale}s cubic-bezier(${ease.join(', ')})`,
      }}
    >
      <span aria-hidden="true" style={{ display: 'inline-flex', color: 'var(--qr-list-accent)' }}>
        <SFIcon name="location" pointSize={FIELD.iconSize} />
      </span>
      <input
        ref={register}
        type="text"
        value={value}
        onChange={(e) => controller.setLocationText(e.target.value, 'user')}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Enter location"
        aria-label="Location"
        aria-description="Added to the notes with a pin. Return applies it."
        data-qr-field="locationField"
        data-qr-target="locationField"
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        style={
          {
            flex: '1 1 auto', minWidth: 0,
            fontSize: px(FIELD.textSize), fontWeight: 400, color: 'var(--qr-white)', caretColor: 'var(--qr-list-accent)',
            '--qr-ph': `rgba(255, 255, 255, ${FIELD.placeholderAlpha})`,
          } as CSSProperties
        }
      />
    </div>
  );
}

/** Clear (only while the reminder has a location) · spacer · Cancel · Done. */
function Footer(props: { hasLocation: boolean; committed: string; accent: string }): JSX.Element {
  const { controller } = useCore();
  return (
    <div data-qr-footer="" style={{ display: 'flex', alignItems: 'center', gap: px(FOOTER.gap), height: px(LocationMetrics.footer) }}>
      {props.hasLocation && (
        <NotchTextButton
          target="locationClear" aria-description="Removes the location from the reminder"
          onClick={() => controller.clearLocation('user')}
        >
          Clear
        </NotchTextButton>
      )}
      <div style={{ flex: '1 0 0', minWidth: 0 }} />
      <NotchFillButton
        kind="neutral" radius={RADIUS} target="locationCancel"
        onClick={() => controller.cancelLocation('user')}
        style={{
          fontSize: px(FOOTER.cancelSize), fontWeight: FOOTER.cancelWeight, color: `rgba(255, 255, 255, ${FOOTER.cancelAlpha})`,
          paddingLeft: px(FOOTER.cancelPadX), paddingRight: px(FOOTER.cancelPadX), height: px(LocationMetrics.footer),
        }}
      >
        Cancel
      </NotchFillButton>
      <NotchFillButton
        kind="prominent" radius={RADIUS} target="locationDone" aria-label={doneLabel(props.committed)}
        onClick={() => controller.commitLocation('user')}
        style={{
          fontSize: px(FOOTER.setSize), fontWeight: FOOTER.setWeight, color: AccentContrast.label(props.accent),
          paddingLeft: px(FOOTER.setPadX), paddingRight: px(FOOTER.setPadX), height: px(LocationMetrics.footer),
        }}
      >
        Done
      </NotchFillButton>
    </div>
  );
}
