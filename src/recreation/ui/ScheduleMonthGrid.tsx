// Port of Views/ScheduleMonthGrid.swift: the compact month grid of the in-notch Set Date — always
// six weeks (`MonthGrid`), today in the accent, the picked day in an accent disc, the past dimmed
// and disabled. The grid is a single Tab stop (the section handles the arrows); the day buttons
// stay out of the Tab loop. The keyboard ring sits on the picked day, or around the whole grid
// while ‹ › paged away from it. The parent owns the month (`onPage`) and the pick (`onPick`).
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, type ReactNode } from 'react';
import { AccentContrast } from '../core/accentContrast';
import { components, isSameDay, type Calendar } from '../core/calendar';
import { MonthGrid } from '../core/monthGrid';
import { ScheduleMetrics } from '../machine/notchLayout';
import { Motion } from '../machine/springs';
import { DayCellButton, HoverHighlightButton } from './buttons';
import { SFIcon } from './icons';
import { useMotionPrefs } from './motionPrefs';
import { useCore, useRecreationState } from './RecreationContext';
import { toTransition } from './transitions';
import { px } from './units';

const M = ScheduleMetrics;
const DAY_DISC = M.dayCell;
const RING_WIDTH = 1.5;

export interface ScheduleMonthGridProps {
  draft: Date;
  month: Date;
  now: Date;
  /** The grid has the keyboard. */
  keyboardFocused: boolean;
  onPick(day: Date): void;
  onPage(delta: -1 | 1): void;
}

export function ScheduleMonthGrid(props: ScheduleMonthGridProps): JSX.Element {
  const { draft, month, now, keyboardFocused, onPick, onPage } = props;
  const { calendar, formatter, focus } = useCore();
  const { accent } = useRecreationState();
  const register = useCallback((el: HTMLDivElement | null) => focus.register('calendar', el), [focus]);
  const pageStart = MonthGrid.startOfMonth(month, calendar);
  const draftOnPage = MonthGrid.startOfMonth(draft, calendar).getTime() === pageStart.getTime();
  const canGoBack = MonthGrid.canGoBack(month, now, calendar);
  const cells = MonthGrid.cells(month, calendar);
  const selectedLabel = AccentContrast.label(accent);
  const page = (delta: -1 | 1) => {
    if (delta < 0 && !canGoBack) return;
    onPage(delta);
  };

  return (
    <div
      ref={register}
      role="group"
      aria-label={`Calendar, ${formatter.format(month, 'MMMM y')}`}
      tabIndex={0}
      data-qr-field="calendar"
      data-qr-own-ring=""
      style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}
    >
      <div data-qr-month-header="" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: px(2), height: px(M.monthHeader) }}>
        <MonthCrossfade monthKey={pageStart.getTime()}>
          <span
            role="heading" aria-level={3}
            style={{ fontSize: px(13), fontWeight: 600, color: 'white', paddingLeft: px(4), whiteSpace: 'nowrap' }}
          >
            {formatter.format(month, 'LLLL y')}
          </span>
        </MonthCrossfade>
        <span style={{ flex: '1 1 0', minWidth: 0 }} />
        <PageButton symbol="chevron.left" label="Previous month" target="calendarPrev" enabled={canGoBack} onClick={() => page(-1)} />
        <PageButton symbol="chevron.right" label="Next month" target="calendarNext" enabled onClick={() => page(1)} />
      </div>
      <div data-qr-weekdays="" aria-hidden="true" style={{ display: 'flex', height: px(M.weekdayRow) }}>
        {MonthGrid.weekdaySymbols(calendar).map((symbol, i) => (
          <span
            key={i}
            style={{
              flex: '1 1 0', minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: px(10), fontWeight: 600, color: 'rgba(255, 255, 255, 0.55)',
            }}
          >
            {symbol}
          </span>
        ))}
      </div>
      <MonthCrossfade monthKey={pageStart.getTime()}>
        <div data-qr-weeks="" style={{ display: 'flex', flexDirection: 'column', gap: px(M.dayRowSpacing) }}>
          {Array.from({ length: MonthGrid.weeks }, (_, week) => (
            <div key={week} data-qr-week={String(week)} style={{ display: 'flex', height: px(M.dayCell) }}>
              {cells.slice(week * 7, week * 7 + 7).map((day, column) =>
                day === null ? (
                  <span key={column} data-qr-cell="" aria-hidden="true" style={{ flex: '1 1 0', minWidth: 0 }} />
                ) : (
                  <DayCell
                    key={column} day={day} draft={draft} now={now} calendar={calendar}
                    label={formatter.format(day, 'EEEE d MMMM')} selectedLabel={selectedLabel}
                    keyboardFocused={keyboardFocused} onPick={onPick}
                  />
                ),
              )}
            </div>
          ))}
        </div>
      </MonthCrossfade>
      {/* Focus indicator while the picked day is on another page (strokeBorder, padding −4). */}
      <span
        data-qr-grid-ring=""
        aria-hidden="true"
        style={{
          position: 'absolute', inset: px(-4), borderRadius: px(M.controlRadius), pointerEvents: 'none',
          boxSizing: 'border-box', border: `${px(RING_WIDTH)} solid rgba(255, 255, 255, 0.6)`,
          opacity: keyboardFocused && !draftOnPage ? 1 : 0,
        }}
      />
    </div>
  );
}

/** A month change crossfades the old page out and the new one in (Swift `withAnimation(.easeOut(duration: 0.15))`). */
function MonthCrossfade(props: { monthKey: number; children: ReactNode }): JSX.Element {
  const { timeScale } = useMotionPrefs();
  const transition = toTransition(Motion.monthPage, timeScale);
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={props.monthKey}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transition}
      >
        {props.children}
      </motion.div>
    </AnimatePresence>
  );
}

function PageButton(props: {
  symbol: 'chevron.left' | 'chevron.right';
  label: string;
  target: string;
  enabled: boolean;
  onClick(): void;
}): JSX.Element {
  return (
    <HoverHighlightButton size={26} aria-label={props.label} target={props.target} disabled={!props.enabled} onClick={props.onClick}>
      <span data-qr-glyph="" style={{ display: 'inline-flex', color: `rgba(255, 255, 255, ${props.enabled ? 0.75 : 0.2})` }}>
        <SFIcon name={props.symbol} pointSize={11} />
      </span>
    </HoverHighlightButton>
  );
}

function DayCell(props: {
  day: Date;
  draft: Date;
  now: Date;
  calendar: Calendar;
  label: string;
  selectedLabel: string;
  keyboardFocused: boolean;
  onPick(day: Date): void;
}): JSX.Element {
  const { day, draft, now, calendar, label, selectedLabel, keyboardFocused, onPick } = props;
  const selectable = MonthGrid.isSelectable(day, now, calendar);
  const selected = isSameDay(calendar, day, draft);
  const today = isSameDay(calendar, day, now);
  return (
    <DayCellButton
      selected={selected}
      disabled={!selectable}
      tabIndex={-1}
      target={`day:${components(calendar, day).day}`}
      data-qr-cell=""
      aria-label={label}
      aria-current={today ? 'date' : undefined}
      aria-pressed={selected ? true : undefined}
      onClick={() => onPick(day)}
      style={{ flex: '1 1 0', minWidth: 0, height: '100%' }}
    >
      <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: px(DAY_DISC), height: px(DAY_DISC) }}>
        <span
          data-qr-day-disc=""
          style={{
            position: 'absolute', left: 0, top: 0, width: px(DAY_DISC), height: px(DAY_DISC), borderRadius: '50%',
            background: selected ? 'var(--qr-list-accent)' : 'transparent',
          }}
        />
        <span
          data-qr-day-label=""
          className="qr-tabular"
          style={{
            position: 'relative', fontSize: px(13), fontWeight: selected || today ? 600 : 400,
            color: dayColor(selected, today, selectable, selectedLabel),
          }}
        >
          {components(calendar, day).day}
        </span>
        <span
          data-qr-day-ring=""
          style={{
            position: 'absolute', inset: px(-3), borderRadius: '50%', pointerEvents: 'none', boxSizing: 'border-box',
            border: `${px(RING_WIDTH)} solid rgba(255, 255, 255, 0.85)`,
            opacity: selected && keyboardFocused ? 1 : 0,
          }}
        />
      </span>
    </DayCellButton>
  );
}

/** Swift `foreground(selected:today:selectable:selectedLabel:)`. */
function dayColor(selected: boolean, today: boolean, selectable: boolean, selectedLabel: string): string {
  if (selected) return selectedLabel;
  if (!selectable) return 'rgba(255, 255, 255, 0.25)';   // disabled (exempt from text contrast)
  if (today) return 'var(--qr-list-accent)';
  return 'rgba(255, 255, 255, 0.85)';
}
