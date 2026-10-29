// Port of BottomBar.swift (notch style): the outlined pill with date / location / flag on the left,
// the round ✓ save button on the right.
import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';
import { Motion } from '../machine/springs';
import type { RecreationState } from '../store';
import { HoverButton, HoverHighlightButton } from './buttons';
import { SFIcon, type SFSymbol } from './icons';
import { useMotionPrefs } from './motionPrefs';
import { useCore, useRecreationState } from './RecreationContext';
import { toTransition } from './transitions';
import { px } from './units';

export const PILL = { height: 44, padX: 11, gap: 17, iconSize: 18, hit: 38 } as const;
export const SAVE_BUTTON = { size: 48, glyph: 22 } as const;

/** `Theme.pill` active state (`BottomBar.swift:140`): the open section's disc, inset 3 pt, accent 22 %. */
const OPEN_DISC_INSET = 3;
const OPEN_DISC_FILL = 'color-mix(in srgb, var(--qr-list-accent) 22%, transparent)';

/** `BottomBar.saveHelp`: while a section is open the ✓ applies it first. */
export function saveHelp(state: RecreationState): string {
  if (state.schedulingInNotch) return 'Applies the date in Set Date, then saves';
  if (state.locationInNotch) return 'Applies the location, then saves';
  return 'Save reminder';
}

export function BottomBar(): JSX.Element {
  const { controller } = useCore();
  const state = useRecreationState();
  const { dueDate, location, flagged, schedulingInNotch, locationInNotch } = state;
  return (
    <div data-qr-bottom-bar="" style={{ display: 'flex', alignItems: 'center' }}>
      <div
        data-qr-pill=""
        style={{
          display: 'flex', alignItems: 'center',
          height: px(PILL.height), paddingLeft: px(PILL.padX), paddingRight: px(PILL.padX), gap: px(PILL.gap),
          borderRadius: px(999), background: 'var(--qr-pill-fill)',
          boxShadow: `inset 0 0 0 ${px(1)} var(--qr-pill-stroke)`,
        }}
      >
        <HoverHighlightButton
          size={PILL.hit} aria-label="Set date and time" aria-pressed={schedulingInNotch}
          aria-description={schedulingInNotch ? 'Hides Set Date' : 'Shows Set Date below'}
          target="calendarIcon" onClick={() => controller.toggleSchedule('user')}
        >
          <OpenDisc open={schedulingInNotch} />
          <Glyph name="calendar.badge.clock" color={dueDate !== null || schedulingInNotch ? 'var(--qr-list-accent)' : 'white'} />
        </HoverHighlightButton>
        <HoverHighlightButton
          size={PILL.hit} aria-label={location !== null ? `Location, ${location}` : 'Add location'}
          aria-pressed={locationInNotch}
          aria-description={locationInNotch ? 'Hides Location' : 'Shows Location below'}
          target="locationIcon" onClick={() => controller.toggleLocation('user')}
        >
          <OpenDisc open={locationInNotch} />
          <Glyph
            name={location !== null ? 'location.fill' : 'location'}
            color={location !== null || locationInNotch ? 'var(--qr-list-accent)' : 'white'}
          />
        </HoverHighlightButton>
        <HoverHighlightButton
          size={PILL.hit} aria-label="Toggle flag" aria-pressed={flagged}
          target="flagIcon" onClick={() => controller.toggleFlag('user')}
        >
          <Glyph name={flagged ? 'flag.fill' : 'flag'} color={flagged ? 'var(--qr-flag-orange)' : 'white'} />
        </HoverHighlightButton>
      </div>
      <div data-qr-bar-spacer="" style={{ flex: '1 0 auto', minWidth: px(16) }} />
      <SaveButton state={state} />
    </div>
  );
}

/** The open section's disc behind a pill glyph, faded with `HoverMotion.highlightAnimation`. */
function OpenDisc({ open }: { open: boolean }): JSX.Element {
  const { timeScale } = useMotionPrefs();
  return (
    <motion.span
      aria-hidden="true" data-qr-open-disc=""
      style={{ position: 'absolute', inset: px(OPEN_DISC_INSET), borderRadius: '50%', background: OPEN_DISC_FILL }}
      initial={false}
      animate={{ opacity: open ? 1 : 0 }}
      transition={toTransition(Motion.highlight, timeScale)}
    />
  );
}

/** A pill glyph in its 38 pt hit, coloured by the wrapper; a name change plays
 *  `.contentTransition(.symbolEffect(.replace))`: the old glyph shrinks out, the new one grows in. */
function Glyph({ name, color }: { name: SFSymbol; color: string }): JSX.Element {
  const { reduceMotion, timeScale } = useMotionPrefs();
  const hidden = reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.5 };
  const shown = reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 };
  return (
    <span
      data-qr-glyph=""
      style={{
        position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: px(PILL.hit), height: px(PILL.hit), color,
      }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={name} style={{ display: 'inline-flex' }}
          initial={hidden} animate={shown} exit={hidden}
          transition={toTransition(reduceMotion ? Motion.reduced : Motion.flag, timeScale)}
        >
          <SFIcon name={name} pointSize={PILL.iconSize} />
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** The ✓ (`BottomBar.saveButton`): shares `matchedGeometryEffect(id: "save")` with the saved badge
 *  and yields its slot to it while the badge is shown. ⌘↩ is routed by the keyboard layer (B22). */
function SaveButton({ state }: { state: RecreationState }): JSX.Element {
  const { controller } = useCore();
  const { timeScale } = useMotionPrefs();
  const size = px(SAVE_BUTTON.size);
  if (state.badgeShown) return <div data-qr-save-slot="" style={{ width: size, height: size, flex: 'none' }} />;
  const fill = state.canSave ? 'var(--qr-list-accent)' : 'var(--qr-gray-circle-disabled)';
  return (
    <motion.div layoutId="save" style={{ display: 'flex', flex: 'none' }}>
      <HoverButton
        aria-label="Save reminder" title={saveHelp(state)} target="save" disabled={!state.canSave}
        onClick={() => void controller.saveFromBar('user')}
      >
        <SaveDisc fill={fill} timeScale={timeScale}>
          <SFIcon name="checkmark" pointSize={SAVE_BUTTON.glyph} style={{ color: 'white' }} />
        </SaveDisc>
      </HoverButton>
    </motion.div>
  );
}

/** The 48 pt circle; its target fill is `data-fill`, and the background follows it with
 *  `Motion.canSave` (easeInOut 0.18) as a CSS transition, which interpolates the `var()` colours. */
function SaveDisc(props: { fill: string; timeScale: number; children: ReactNode }): JSX.Element {
  const size = px(SAVE_BUTTON.size);
  const { ease, duration } = Motion.canSave;
  return (
    <span
      data-qr-save-disc="" data-fill={props.fill}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: size, height: size, borderRadius: '50%', backgroundColor: props.fill,
        transition: `background-color ${duration * props.timeScale}s cubic-bezier(${ease.join(', ')})`,
      }}
    >
      {props.children}
    </span>
  );
}
