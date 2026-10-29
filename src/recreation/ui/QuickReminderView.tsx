// Port of Views/QuickReminderView.swift: the open panel's content, laid out top-down below the
// notch band (band → header → input → chip slot → bottom bar), with Set Date or Location (one at a
// time) appended below the bottom bar. The plain panel never changes for a section; the content is
// laid out at the panel's target height at once (`NotchMachine.changeSection`) while the blob
// springs to it.
import { AnimatePresence, motion } from 'motion/react';
import type { CSSProperties, PointerEvent } from 'react';
import { isSchedule } from '../machine/notchMachine';
import { notchBandHeight, panelSize } from '../machine/notchState';
import { Motion, type Easing } from '../machine/springs';
import { BottomBar } from './BottomBar';
import { ChipSlot } from './ChipSlot';
import { HeaderView } from './HeaderView';
import { InputView } from './InputView';
import { LocationNotchSection } from './LocationNotchSection';
import { useMotionPrefs } from './motionPrefs';
import { useCore, usePanel } from './RecreationContext';
import { ScheduleNotchSection } from './ScheduleNotchSection';
import { toTransition } from './transitions';
import { px } from './units';

/** SPEC §4 vertical rhythm; `inset` = `Theme.horizontalPadding + NotchLayout.openTopRadius`. */
export const RHYTHM = { headerTop: 8, inputTop: 10, chipSlot: 26, chipToBar: 8, barBottom: 20, inset: 39 } as const;

/** The section column: takes the rest of the grown panel (Swift `.frame(maxHeight: .infinity, alignment: .top)`). */
const SECTION_COLUMN: CSSProperties = { display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0 };

export function QuickReminderView(): JSX.Element {
  const { controller } = useCore();
  const { flags, sizes, ignoresMouse } = usePanel();
  const { reduceMotion, timeScale } = useMotionPrefs();
  const panel = panelSize(sizes, flags.section);
  // Swift `allowsHitTesting(state.isOpen)`, and nothing while the window ignores the mouse.
  const interactive = flags.isOpen && !ignoresMouse;
  const item = (style: CSSProperties): CSSProperties => ({ flex: 'none', pointerEvents: interactive ? 'auto' : 'none', ...style });
  const fade = (m: Easing) => toTransition(reduceMotion ? Motion.reduced : m, timeScale);

  // The press in points from the panel's top, whatever the scene's CSS scale; the click still lands.
  const onPointerDownCapture = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.height <= 0) return;
    controller.pointerDownInPanel(((e.clientY - rect.top) * panel.height) / rect.height);
  };

  return (
    <div
      data-qr-panel-content="" data-interactive={String(interactive)}
      onPointerDownCapture={onPointerDownCapture}
      style={{
        width: px(panel.width), height: px(panel.height),
        display: 'flex', flexDirection: 'column', alignItems: 'stretch',
        paddingLeft: px(RHYTHM.inset), paddingRight: px(RHYTHM.inset), boxSizing: 'border-box', pointerEvents: 'none',
      }}
    >
      {/* The physical notch / menu-bar band: a dead zone the content starts below. */}
      <div data-qr-band="" aria-hidden="true" style={{ flex: 'none', height: px(notchBandHeight(sizes)) }} />
      <div data-qr-stack-item="" style={item({ marginTop: px(RHYTHM.headerTop) })}>
        <HeaderView />
      </div>
      <div data-qr-stack-item="" style={item({ marginTop: px(RHYTHM.inputTop) })}>
        <InputView />
      </div>
      <div data-qr-stack-item="" style={item({ height: px(RHYTHM.chipSlot), marginBottom: px(RHYTHM.chipToBar) })}>
        <ChipSlot />
      </div>
      <div data-qr-stack-item="" style={item({ marginBottom: px(RHYTHM.barBottom) })}>
        <BottomBar />
      </div>
      {/* Swift `if schedulingInNotch { … } else if locationInNotch { … }`: 'controls' ↔ 'calendar' keeps the key. */}
      <AnimatePresence>
        {isSchedule(flags.section) ? (
          <div key="schedule" data-qr-stack-item="" style={item(SECTION_COLUMN)}>
            <ScheduleNotchSection />
          </div>
        ) : flags.section === 'location' ? (
          // Set Date fades itself; Location's enter / exit opacity is this view's (`notchSectionTransition`).
          <motion.div
            key="location" data-qr-stack-item="" style={item(SECTION_COLUMN)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: fade(Motion.sectionIn) }}
            exit={{ opacity: 0, transition: fade(Motion.sectionOut) }}
          >
            <LocationNotchSection />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
