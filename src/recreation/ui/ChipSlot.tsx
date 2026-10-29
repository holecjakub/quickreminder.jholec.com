// `QuickReminderView.regularBottom`'s fixed 26 pt slot above the bottom bar: the save error, else the
// date chip, else the date suggestion chip, each sliding in from the slot's bottom edge.
import { AnimatePresence, motion, useIsPresent, type Transition, type Variants } from 'motion/react';
import { useState } from 'react';
import type { DateSuggestion } from '../core/naturalDateParser';
import { EASE_OUT, Motion } from '../machine/springs';
import { HoverButton } from './buttons';
import { CalendarClockIcon, SFIcon } from './icons';
import { useMotionPrefs } from './motionPrefs';
import { useCore, useRecreationState } from './RecreationContext';
import { toTransition } from './transitions';
import { px } from './units';

/** What changed last in the slot, which picks the animation (the view's `.animation(_:value:)` /
 *  `withAnimation` calls): the due date appearing or going, the live phrase, a dismissed suggestion. */
export type ChipChange = 'dueDate' | 'suggestion' | 'dismiss';

/** The ⓧ on the suggestion: `withAnimation(.easeOut(duration: 0.15)) { suggestion = nil }`. */
const DISMISS = { type: 'tween', ease: EASE_OUT, duration: 0.15 } as const;

export function chipTransition(change: ChipChange, timeScale: number): Transition {
  const m = change === 'dueDate' ? Motion.chip : change === 'suggestion' ? Motion.suggestion : DISMISS;
  return toTransition(m, timeScale);
}

/** `.transition(.opacity.combined(with: .move(edge: .bottom)))`. */
export const CHIP_ENTER = { opacity: 0, y: '100%' } as const;
export const CHIP_SHOWN = { opacity: 1, y: 0 } as const;

const LEADING_INSET = 21 + 10; // Theme.s(21) + 10

/** The variants read the transition from `custom`, so a chip leaving uses the change that removed it. */
const CHIP_VARIANTS: Variants = {
  hidden: (t: Transition) => ({ ...CHIP_ENTER, transition: t }),
  shown: (t: Transition) => ({ ...CHIP_SHOWN, transition: t }),
};
const FADE_VARIANTS: Variants = {
  hidden: (t: Transition) => ({ opacity: 0, transition: t }),
  shown: (t: Transition) => ({ opacity: 1, transition: t }),
};

interface SlotInputs {
  readonly hasDate: boolean;
  readonly suggestionText: string | null;
}

/** The change between two renders; React's "adjust state on prop change" pattern keeps render pure. */
function useLastChange(inputs: SlotInputs, dismissedText: string | null): ChipChange {
  const [last, setLast] = useState<SlotInputs & { change: ChipChange }>({ ...inputs, change: 'dueDate' });
  if (last.hasDate === inputs.hasDate && last.suggestionText === inputs.suggestionText) return last.change;
  let change: ChipChange;
  if (last.hasDate !== inputs.hasDate) change = 'dueDate';
  else if (inputs.suggestionText === null && dismissedText !== null && dismissedText === last.suggestionText) change = 'dismiss';
  else change = 'suggestion';
  setLast({ ...inputs, change });
  return change;
}

export function ChipSlot(): JSX.Element {
  const { reduceMotion, timeScale } = useMotionPrefs();
  const { saveError, dueDate, suggestion, dismissedSuggestionText } = useRecreationState();
  const change = useLastChange(
    { hasDate: dueDate !== null, suggestionText: suggestion?.matchedText ?? null },
    dismissedSuggestionText,
  );
  const chipTransitionNow = reduceMotion ? toTransition(Motion.reduced, timeScale) : chipTransition(change, timeScale);

  let layer: JSX.Element | null = null;
  if (saveError !== null) {
    layer = (
      <motion.div
        key="error" style={{ ...LAYER, maxWidth: `calc(100% - ${px(LEADING_INSET)})` }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={toTransition(reduceMotion ? Motion.reduced : Motion.error, timeScale)}
      >
        <span
          style={{
            fontSize: px(12), fontWeight: 500, color: 'var(--qr-error-red)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0,
          }}
        >
          {saveError}
        </span>
      </motion.div>
    );
  } else if (dueDate !== null) {
    layer = <ChipLayer key="date" reduceMotion={reduceMotion} transition={chipTransitionNow}><DateChip date={dueDate} /></ChipLayer>;
  } else if (suggestion !== null) {
    layer = (
      <ChipLayer key={`suggestion:${suggestion.matchedText}`} reduceMotion={reduceMotion} transition={chipTransitionNow}>
        <SuggestionChip suggestion={suggestion} />
      </ChipLayer>
    );
  }

  return (
    <div
      data-qr-chip-slot=""
      style={{
        position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start',
        height: px(26), paddingLeft: px(LEADING_INSET),
      }}
    >
      {/* Every layer is absolutely positioned at its static (bottom-left, inset) place, so a leaving
          chip and the arriving one overlap like the SwiftUI ZStack instead of sitting side by side. */}
      <AnimatePresence initial={false} custom={chipTransitionNow}>{layer}</AnimatePresence>
    </div>
  );
}

const LAYER = { position: 'absolute', bottom: 0, display: 'flex', alignItems: 'center' } as const;

/** A chip that is leaving stays visible until its exit ends but is no longer a control: hidden from
 *  assistive tech and the pointer, so the arriving chip is the only one to press. */
function ChipLayer(props: { reduceMotion: boolean; transition: Transition; children: JSX.Element }): JSX.Element {
  const isPresent = useIsPresent();
  return (
    <motion.div
      aria-hidden={isPresent ? undefined : true}
      style={{ ...LAYER, pointerEvents: isPresent ? undefined : 'none' }}
      variants={props.reduceMotion ? FADE_VARIANTS : CHIP_VARIANTS} custom={props.transition}
      initial="hidden" animate="shown" exit="hidden"
    >
      {props.children}
    </motion.div>
  );
}

function SuggestionChip({ suggestion }: { suggestion: DateSuggestion }): JSX.Element {
  const { controller, formatter, clock } = useCore();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: px(8) }}>
      <HoverButton
        aria-label="Use suggested date" target="suggestionChip" onClick={() => controller.applySuggestion('user')}
        labelStyle={{
          alignItems: 'center', gap: px(6), color: 'var(--qr-list-accent)',
          paddingTop: px(5), paddingBottom: px(5), paddingLeft: px(10), paddingRight: px(10),
          borderRadius: px(999), background: 'var(--qr-accent-14)',
        }}
      >
        <CalendarClockIcon pointSize={12} />
        <span style={{ fontSize: px(13), fontWeight: 500, whiteSpace: 'nowrap' }}>
          {formatter.string(suggestion.date, suggestion.hasTime, clock())}
        </span>
        <span
          style={{
            fontSize: px(11), fontWeight: 600, color: 'rgba(255, 255, 255, 0.45)',
            background: 'rgba(255, 255, 255, 0.1)', borderRadius: px(4), padding: `${px(1)} ${px(5)}`,
          }}
        >
          ⇥
        </span>
      </HoverButton>
      <HoverButton aria-label="Dismiss suggestion" target="suggestionDismiss" onClick={() => controller.dismissSuggestion('user')}>
        <SFIcon name="xmark.circle.fill" pointSize={13} style={{ color: 'rgba(255, 255, 255, 0.4)' }} />
      </HoverButton>
    </div>
  );
}

function DateChip({ date }: { date: Date }): JSX.Element {
  const { controller, formatter, clock } = useCore();
  const text = formatter.string(date, true, clock());
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: px(6), color: 'var(--qr-list-accent)' }}>
      <HoverButton
        aria-label="Change date" aria-description={text} target="dateChip"
        onClick={() => controller.openSchedule('user')}
        labelStyle={{ alignItems: 'center', gap: px(6) }}
      >
        <SFIcon name="calendar" pointSize={12} />
        <span style={{ fontSize: px(13), fontWeight: 500, whiteSpace: 'nowrap' }}>{text}</span>
      </HoverButton>
      <button type="button" aria-label="Clear date" onClick={() => controller.clearDueDate('user')} style={{ display: 'flex' }}>
        <SFIcon name="xmark.circle.fill" pointSize={13} style={{ color: 'rgba(255, 255, 255, 0.5)' }} />
      </button>
    </div>
  );
}
