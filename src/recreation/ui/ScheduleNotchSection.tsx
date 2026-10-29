// Port of Views/ScheduleNotchSection.swift: the in-notch Set Date, appended below the bottom bar.
// Rows: the type field, the live preview line, the 3 × 2 preset cards, the day / time row, the
// month grid while the calendar is open, and the pinned footer. Each row reads the open
// `ScheduleDraft` it is handed and re-renders on every `scheduleVersion` bump; heights are
// `ScheduleMetrics`. `ScheduleNotchSection` at the end composes them.
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'motion/react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MutableRefObject, type ReactNode } from 'react';
import { AccentContrast } from '../core/accentContrast';
import { components } from '../core/calendar';
import { DATE_PRESETS, DatePresets, type DatePreset } from '../core/datePresets';
import { ScheduleDefaults } from '../core/scheduleDefaults';
import type { ScheduleDraft } from '../core/scheduleDraft';
import { ScheduleText } from '../core/scheduleText';
import { RelativeDistance, type SuggestionDateFormatter } from '../core/suggestionDateFormatter';
import { NotchLayout, ScheduleMetrics, Theme, type NotchSection } from '../machine/notchLayout';
import { isSchedule } from '../machine/notchMachine';
import { panelSize } from '../machine/notchState';
import { Motion, type Easing } from '../machine/springs';
import { KeyHint, NotchFillButton, NotchTextButton } from './buttons';
import { SFIcon } from './icons';
import { useMotionPrefs } from './motionPrefs';
import { NumericText } from './NumericText';
import { useCore, usePanel, useRecreationState, useScheduleDraft } from './RecreationContext';
import { ScheduleMonthGrid } from './ScheduleMonthGrid';
import { effective, staggerTransition, toTransition } from './transitions';
import { px } from './units';

const M = ScheduleMetrics;
const FIELD = Theme.typeField;
const PREVIEW = Theme.preview;
const CARD = Theme.presetCard;

/** Swift `.minimumScaleFactor(minimum)`: the factor that fits `natural` into `available`, never above 1. */
export function fitScale(available: number, natural: number, minimum: number = CARD.minScale): number {
  if (natural === 0) return 1;
  return Math.min(1, Math.max(minimum, available / natural));
}

/** Swift `previewSpoken()`: the preview line as VoiceOver reads it. */
export function previewSpoken(draft: ScheduleDraft, formatter: SuggestionDateFormatter): string {
  if (draft.isInvalid) return 'Not a date';
  const date = formatter.dayAndTime(draft.draft);
  return draft.draft < draft.now ? `${ScheduleText.inThePast}, ${date}` : date;
}

/** The field box; a click anywhere on it focuses the input (`.onTapGesture { focus = .text }`). */
export function ScheduleTypeField(props: { draft: ScheduleDraft }): JSX.Element {
  const { draft } = props;
  useScheduleDraft();
  const { controller, focus, formatter } = useCore();
  const { timeScale } = useMotionPrefs();
  const [focused, setFocused] = useState(false);
  const input = useRef<HTMLInputElement | null>(null);
  const register = useCallback(
    (el: HTMLInputElement | null) => {
      input.current = el;
      focus.register('scheduleField', el);
    },
    [focus],
  );
  const text = draft.text;
  const stroke = focused ? 'var(--qr-accent-70)' : `rgba(255, 255, 255, ${FIELD.strokeAlpha})`;
  const fade = toTransition(Motion.focusRing, timeScale);
  const hint = text === '' ? `For example ${ScheduleText.invalidExample(formatter.locale)}` : previewSpoken(draft, formatter);
  return (
    <div
      data-qr-type-field=""
      onClick={() => input.current?.focus({ preventScroll: true })}
      style={{
        display: 'flex', alignItems: 'center', gap: px(8),
        height: px(M.typeField), paddingLeft: px(FIELD.padX), paddingRight: px(FIELD.padX),
        background: `rgba(255, 255, 255, ${FIELD.fillAlpha})`, borderRadius: px(M.controlRadius),
        boxShadow: `inset 0 0 0 ${px(1)} ${stroke}`,
        transition: `box-shadow ${fade.duration}s cubic-bezier(${Motion.focusRing.ease.join(', ')})`,
      }}
    >
      <span aria-hidden="true" style={{ display: 'inline-flex', color: `rgba(255, 255, 255, ${FIELD.iconAlpha})` }}>
        <SFIcon name="keyboard" pointSize={FIELD.iconSize} />
      </span>
      <input
        ref={register}
        type="text"
        value={text}
        onChange={(e) => controller.setScheduleText(e.target.value, 'user')}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={ScheduleText.placeholder}
        aria-label="Type a date"
        aria-description={hint}
        data-qr-field="scheduleField"
        data-qr-target="scheduleField"
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
      {/* Swift `.transition(.opacity)` with no animation around a text edit: the hint comes and goes at once. */}
      {text !== '' && draft.textIsDate && <KeyHint>⏎</KeyHint>}
    </div>
  );
}

const SECONDARY = `rgba(255, 255, 255, ${PREVIEW.secondaryAlpha})`;

/** The date the section will set, the distance to it, a warning when it is past, or the invalid hint. */
export function SchedulePreview(props: { draft: ScheduleDraft }): JSX.Element {
  const { draft } = props;
  useScheduleDraft();
  const { formatter, calendar } = useCore();
  const now = draft.now;
  const date = draft.draft;
  let content: JSX.Element;
  if (draft.isInvalid) {
    content = <span style={{ color: SECONDARY }}>{ScheduleText.notADate(ScheduleText.invalidExample(formatter.locale))}</span>;
  } else if (date < now) {
    content = (
      <>
        <SFIcon name="exclamationmark.triangle.fill" pointSize={12} style={{ color: 'var(--qr-flag-orange)' }} />
        <span style={{ color: 'var(--qr-flag-orange)' }}>{ScheduleText.inThePast}</span>
        <span style={{ color: SECONDARY }}>{`· ${formatter.dayAndTime(date)}`}</span>
      </>
    );
  } else {
    content = (
      <>
        <span style={{ color: 'var(--qr-white)' }}>{formatter.dayAndTime(date)}</span>
        <span style={{ color: SECONDARY }}>{`· ${RelativeDistance.string(now, date, formatter.locale, calendar)}`}</span>
      </>
    );
  }
  return (
    <div
      role="group" aria-label="Reminder date" aria-description={previewSpoken(draft, formatter)}
      data-qr-preview="" className="qr-tabular"
      style={{
        display: 'flex', alignItems: 'center', gap: px(4), height: px(M.preview), paddingLeft: px(PREVIEW.padL),
        fontSize: px(PREVIEW.size), fontWeight: PREVIEW.weight, whiteSpace: 'nowrap', overflow: 'hidden',
      }}
    >
      {content}
    </div>
  );
}

/** Six cards, ⌘1…⌘6; only one lights up even when several presets land on the same minute. */
export function PresetGrid(props: { draft: ScheduleDraft }): JSX.Element {
  const { draft } = props;
  useScheduleDraft();
  const { presetPick } = useRecreationState();
  const highlighted = draft.highlightedPreset(presetPick);
  const now = draft.now;
  return (
    <div
      data-qr-presets=""
      style={{ display: 'grid', gridTemplateColumns: `repeat(${CARD.columns}, minmax(0, 1fr))`, gap: px(M.presetSpacing) }}
    >
      {DATE_PRESETS.map((preset, index) => (
        <PresetCard key={preset} preset={preset} number={index + 1} now={now} selected={preset === highlighted} />
      ))}
    </div>
  );
}

const ONE_LINE: CSSProperties = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 };

function PresetCard(props: { preset: DatePreset; number: number; now: Date; selected: boolean }): JSX.Element {
  const { preset, number, now, selected } = props;
  const { controller, formatter, calendar } = useCore();
  const date = DatePresets.date(preset, now, calendar);
  const title = DatePresets.title(preset, now, calendar);
  return (
    <NotchFillButton
      kind={selected ? 'selected' : 'neutral'} radius={M.controlRadius} target={`preset:${preset}`}
      aria-label={`${title}, ${formatter.presetDetail(date, now, true)}, Command ${number}`}
      aria-pressed={selected ? true : undefined}
      onClick={() => controller.applyPreset(preset, 'user')}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: px(CARD.innerGap), textAlign: 'left',
        width: '100%', height: px(M.presetRow), paddingLeft: px(CARD.padX), paddingRight: px(CARD.padX),
      }}
    >
      <span
        aria-hidden="true"
        style={{ display: 'inline-flex', justifyContent: 'center', flex: 'none', width: px(CARD.iconWidth), color: 'var(--qr-list-accent)' }}
      >
        <SFIcon name={DatePresets.systemImage(preset)} pointSize={CARD.iconSize} />
      </span>
      <PresetCardText title={title} hint={`⌘${number}`} detail={formatter.presetDetail(date, now)} />
    </NotchFillButton>
  );
}

/** A font size the column's fit factor (`--qr-fit`) multiplies. */
function fitted(pt: number): string {
  return `calc(${px(pt)} * var(--qr-fit, 1))`;
}

/**
 * Title · ⌘n over the detail, one line each, with Swift's `.minimumScaleFactor(0.75)`: after a text
 * change the column measures its lines (text widths divided by the factor they were drawn at = the
 * natural widths) against its own width and writes the factor that fits to `--qr-fit`; the spacing
 * between the title and ⌘n stays unscaled.
 */
function PresetCardText(props: { title: string; hint: string; detail: string }): JSX.Element {
  const { title, hint, detail } = props;
  const column = useRef<HTMLSpanElement | null>(null);
  useLayoutEffect(() => {
    const el = column.current;
    if (!el) return;
    const part = (name: string) => el.querySelector<HTMLElement>(`[data-qr-preset-${name}]`)!;
    const cssPx = (value: string) => Number.parseFloat(value) || 0;
    const current = cssPx(el.style.getPropertyValue('--qr-fit')) || 1;
    const available = el.clientWidth;
    const fixed = 2 * cssPx(getComputedStyle(part('row')).columnGap) + cssPx(getComputedStyle(part('spacer')).minWidth);
    const rowScale = fitScale(available - fixed, (part('title').scrollWidth + part('key').offsetWidth) / current);
    const detailScale = fitScale(available, part('detail').scrollWidth / current);
    el.style.setProperty('--qr-fit', String(Math.min(rowScale, detailScale)));
  }, [title, hint, detail]);
  return (
    <span ref={column} style={{ display: 'flex', flexDirection: 'column', gap: px(1), flex: '1 1 auto', minWidth: 0 }}>
      <span data-qr-preset-row="" style={{ display: 'flex', alignItems: 'center', gap: px(4) }}>
        <span
          data-qr-preset-title=""
          style={{ ...ONE_LINE, fontSize: fitted(CARD.titleSize), fontWeight: CARD.titleWeight, color: 'var(--qr-white)' }}
        >
          {title}
        </span>
        <span data-qr-preset-spacer="" style={{ flex: '1 1 0', minWidth: px(2) }} />
        <span
          data-qr-preset-key=""
          style={{
            flex: 'none', whiteSpace: 'nowrap', fontSize: fitted(CARD.hintSize), fontWeight: CARD.hintWeight,
            color: `rgba(255, 255, 255, ${CARD.hintAlpha})`,
          }}
        >
          {hint}
        </span>
      </span>
      <span
        data-qr-preset-detail="" className="qr-tabular"
        style={{ ...ONE_LINE, fontSize: fitted(CARD.detailSize), fontWeight: 400, color: `rgba(255, 255, 255, ${CARD.detailAlpha})` }}
      >
        {detail}
      </span>
    </span>
  );
}

const DAY = Theme.dayButton;
const TIME = Theme.timeField;
const CHIP = Theme.timeChip;
const ROW = Theme.dayTimeRow;
const FOOTER = Theme.footer;

/** The day button (toggles the month grid), the typed time field and the four hour chips. */
export function DayTimeRow(props: { draft: ScheduleDraft; showsCalendar: boolean }): JSX.Element {
  const { draft, showsCalendar } = props;
  useScheduleDraft();
  const { controller, formatter } = useCore();
  const { timeScale } = useMotionPrefs();
  return (
    <div data-qr-day-time-row="" style={{ display: 'flex', alignItems: 'center', gap: px(ROW.gap), height: px(M.dayTimeRow) }}>
      <NotchFillButton
        kind={showsCalendar ? 'selected' : 'neutral'} radius={null} target="dayButton"
        aria-label="Calendar" aria-description={formatter.format(draft.draft, 'EEEE d MMMM')}
        aria-expanded={showsCalendar} title="Calendar ⌘K"
        onClick={() => controller.toggleCalendar('user')}
        style={{ display: 'flex', alignItems: 'center', gap: px(6), flex: 'none', height: px(M.dayTimeRow), paddingLeft: px(DAY.padX), paddingRight: px(DAY.padX) }}
      >
        <span aria-hidden="true" style={{ display: 'inline-flex', color: 'var(--qr-list-accent)' }}>
          <SFIcon name="calendar" pointSize={DAY.iconSize} />
        </span>
        <span className="qr-tabular" style={{ whiteSpace: 'nowrap', fontSize: px(DAY.textSize), fontWeight: DAY.textWeight, color: 'var(--qr-white)' }}>
          {formatter.format(draft.draft, 'EEE d MMM')}
        </span>
        <motion.span
          aria-hidden="true" data-qr-glyph="" data-rotation={showsCalendar ? '180' : '0'}
          style={{ display: 'inline-flex', color: `rgba(255, 255, 255, ${DAY.chevronAlpha})` }}
          initial={false}
          animate={{ rotate: showsCalendar ? 180 : 0 }}
          transition={toTransition(Motion.focusRing, timeScale)}
        >
          <SFIcon name="chevron.down" pointSize={DAY.chevronSize} />
        </motion.span>
      </NotchFillButton>
      <TimeField />
      <div style={{ flex: '1 0 auto', minWidth: px(ROW.spacerMin) }} />
      <div style={{ display: 'flex', gap: px(CHIP.gap) }}>
        {ScheduleText.chipHours.map((hour) => (
          <TimeChip key={hour} hour={hour} draft={draft} />
        ))}
      </div>
    </div>
  );
}

/**
 * Typed digital time ("14", "1430", "14:30", "2pm"). The text is the store's `timeText`; leaving
 * the field applies it without a beep (Swift `.onChange(of: focus)`), an invalid one reverts.
 */
function TimeField(): JSX.Element {
  const { controller, store, focus } = useCore();
  const { timeScale } = useMotionPrefs();
  const [focused, setFocused] = useState(false);
  const input = useRef<HTMLInputElement | null>(null);
  const register = useCallback(
    (el: HTMLInputElement | null) => {
      input.current = el;
      focus.register('timeField', el);
    },
    [focus],
  );
  const fade = toTransition(Motion.focusRing, timeScale);
  const stroke = focused ? `inset 0 0 0 ${px(1)} var(--qr-accent-70)` : 'none';
  return (
    <div
      data-qr-time-field=""
      onClick={() => input.current?.focus({ preventScroll: true })}
      style={{
        display: 'flex', alignItems: 'center', gap: px(5), flex: 'none',
        width: px(TIME.width), height: px(M.dayTimeRow), paddingLeft: px(TIME.padX), paddingRight: px(TIME.padX),
        borderRadius: px(999), background: `rgba(255, 255, 255, ${TIME.fillAlpha})`, boxShadow: stroke,
        transition: `box-shadow ${fade.duration}s cubic-bezier(${Motion.focusRing.ease.join(', ')})`,
      }}
    >
      <span aria-hidden="true" style={{ display: 'inline-flex', color: `rgba(255, 255, 255, ${TIME.iconAlpha})` }}>
        <SFIcon name="clock" pointSize={TIME.iconSize} />
      </span>
      <input
        ref={register}
        type="text"
        value={store.timeText}
        onFocus={() => {
          setFocused(true);
          store.setTimeFieldEditing(true);
        }}
        onChange={(e) => store.setTimeText(e.target.value)}
        onBlur={() => {
          setFocused(false);
          controller.applyTypedTime(false);
          store.setTimeFieldEditing(false);
        }}
        aria-label="Time"
        aria-description="Type a time, or use the up and down arrows to change it by 15 minutes"
        data-qr-field="timeField"
        data-qr-target="timeField"
        className="qr-tabular"
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        style={{
          flex: '1 1 auto', minWidth: 0,
          fontSize: px(TIME.textSize), fontWeight: TIME.textWeight, color: 'var(--qr-white)', caretColor: 'var(--qr-list-accent)',
        }}
      />
    </div>
  );
}

/** One hour chip: prominent while the draft is exactly `hour`:00. */
function TimeChip(props: { hour: number; draft: ScheduleDraft }): JSX.Element {
  const { hour, draft } = props;
  const { controller, formatter, calendar } = useCore();
  const { accent } = useRecreationState();
  const label = formatter.time(ScheduleDefaults.at(hour, 0, draft.draft, calendar));
  const parts = components(calendar, draft.draft);
  const selected = parts.hour === hour && parts.minute === 0;
  return (
    <NotchFillButton
      kind={selected ? 'prominent' : 'neutral'} radius={null} target={`timeChip:${hour}`}
      aria-label={`Set time to ${label}`} aria-pressed={selected}
      onClick={() => controller.setTime(hour, 0, 'user')}
      className="qr-tabular"
      style={{
        whiteSpace: 'nowrap', height: px(M.dayTimeRow), paddingLeft: px(CHIP.padX), paddingRight: px(CHIP.padX),
        fontSize: px(CHIP.size), fontWeight: CHIP.weight,
        color: selected ? AccentContrast.label(accent) : `rgba(255, 255, 255, ${CHIP.alpha})`,
      }}
    >
      {label}
    </NotchFillButton>
  );
}

/** Clear (only while the reminder has a date) · spacer · Cancel · Set · <detail>. */
export function ScheduleFooter(props: { draft: ScheduleDraft }): JSX.Element {
  const { draft } = props;
  useScheduleDraft();
  const { controller, formatter } = useCore();
  const { dueDate, accent } = useRecreationState();
  const invalid = draft.isInvalid;
  return (
    <div data-qr-footer="" style={{ display: 'flex', alignItems: 'center', gap: px(FOOTER.gap), height: px(M.footer) }}>
      {dueDate !== null && (
        <NotchTextButton target="clear" aria-description="Removes the date from the reminder" onClick={() => controller.clearDueDate('user')}>
          Clear
        </NotchTextButton>
      )}
      <div style={{ flex: '1 0 0', minWidth: 0 }} />
      <NotchFillButton
        kind="neutral" radius={M.controlRadius} target="cancel"
        onClick={() => controller.cancelSchedule('user')}
        style={{
          fontSize: px(FOOTER.cancelSize), fontWeight: FOOTER.cancelWeight, color: `rgba(255, 255, 255, ${FOOTER.cancelAlpha})`,
          paddingLeft: px(FOOTER.cancelPadX), paddingRight: px(FOOTER.cancelPadX), height: px(M.footer),
        }}
      >
        Cancel
      </NotchFillButton>
      <NotchFillButton
        kind="prominent" radius={M.controlRadius} target="set" disabled={invalid}
        aria-label={`Set, ${formatter.presetDetail(draft.draft, draft.now, true)}`}
        onClick={() => controller.commitSchedule('user')}
        className="qr-tabular"
        style={{
          fontSize: px(FOOTER.setSize), fontWeight: FOOTER.setWeight, color: invalid ? '#FFFFFF' : AccentContrast.label(accent),
          paddingLeft: px(FOOTER.setPadX), paddingRight: px(FOOTER.setPadX), height: px(M.footer),
        }}
      >
        <NumericText text={`Set · ${formatter.presetDetail(draft.draft, draft.now)}`} />
      </NotchFillButton>
    </div>
  );
}

// MARK: The section (Swift `ScheduleNotchSection.body` / `rows`)

/** `ScheduleDraft.announceAfterPause`: the preview is spoken this long after typing pauses. */
export const ANNOUNCE_PAUSE_MS = 400;

type ScheduleSection = Extract<NotchSection, 'controls' | 'calendar'>;

interface CapturedSection {
  readonly draft: ScheduleDraft;
  /** The depth shown: the grid is mounted while `'calendar'`. */
  readonly section: ScheduleSection;
}

/**
 * The draft the section opened with and the depth it last had. A new draft or depth from the
 * store replaces them; dropped ones (the section closed, or Location took its place) are kept, so
 * the section still renders, grid included, during its exit instead of the calendar slot playing
 * an exit of its own. Held in state and replaced during render (React's "adjust state on prop
 * change" pattern), so render stays pure; both inputs change only with a store change.
 */
function useCapturedSection(): CapturedSection | null {
  const { store } = useCore();
  const { section } = usePanel().flags;
  const [captured, setCaptured] = useState<CapturedSection | null>(null);
  const draft = store.scheduleDraft;
  if (draft !== null && isSchedule(section)) {
    const live = section as ScheduleSection;
    if (captured === null || captured.draft !== draft || captured.section !== live) {
      const next = { draft, section: live };
      setCaptured(next);
      return next;
    }
  }
  return captured;
}

/** Mounted by `QuickReminderView` while `isSchedule(section)`; nothing until the section first opens. */
export function ScheduleNotchSection(): JSX.Element | null {
  const captured = useCapturedSection();
  if (captured === null) return null;
  return <OpenScheduleSection draft={captured.draft} section={captured.section} />;
}

function OpenScheduleSection(props: CapturedSection): JSX.Element {
  const { draft, section } = props;
  useScheduleDraft();
  const { formatter } = useCore();
  const { sizes } = usePanel();
  const { reduceMotion, timeScale } = useMotionPrefs();
  const showsCalendar = section === 'calendar';
  // The screen (`NotchLayout.maxPanelHeight`) cut the panel below its natural height: only the rows scroll.
  const clamped = panelSize(sizes, section).height < NotchLayout.openSize(sizes.closedSize.height, section).height;
  const spoken = useAnnouncement(draft, formatter, timeScale);
  const grid = useRef<HTMLDivElement | null>(null);

  // Swift `.onChange(of: showsCalendar)`: clamped, the grid scrolls into view as it opens (a
  // no-op when the panel fits); a section that mounts with the calendar already open stays put.
  const calendarWasShown = useRef(showsCalendar);
  useEffect(() => {
    const opened = showsCalendar && !calendarWasShown.current;
    calendarWasShown.current = showsCalendar;
    if (opened && clamped) grid.current?.scrollIntoView({ block: 'end', behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [showsCalendar, clamped, reduceMotion]);

  const fade = (m: Easing) => toTransition(reduceMotion ? Motion.reduced : m, timeScale);
  return (
    <motion.div
      role="group" aria-label="Set Date" data-qr-section="schedule" data-clamped={String(clamped)}
      style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, paddingBottom: px(Theme.horizontalPadding) }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: fade(Motion.sectionIn) }}
      exit={{ opacity: 0, transition: fade(Motion.sectionOut) }}
    >
      <div
        data-qr-section-rows=""
        style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain' }}
      >
        <StaggeredRow index={0}>
          <ScheduleTypeField draft={draft} />
        </StaggeredRow>
        <StaggeredRow index={0} style={{ marginTop: px(M.previewGap) }}>
          <SchedulePreview draft={draft} />
        </StaggeredRow>
        <StaggeredRow index={1} style={{ marginTop: px(M.presetsGap) }}>
          <PresetGrid draft={draft} />
        </StaggeredRow>
        <StaggeredRow index={2} style={{ marginTop: px(M.dayTimeGap) }} attrs={{ 'data-qr-day-time': '' }}>
          <DayTimeRow draft={draft} showsCalendar={showsCalendar} />
        </StaggeredRow>
        {/* Swift `if showsCalendar { … .transition(.opacity + .offset(y: -8)) }`: no transition for a grid already there at mount. */}
        <AnimatePresence initial={false}>{showsCalendar && <CalendarSlot key="calendar" draft={draft} slotRef={grid} />}</AnimatePresence>
      </div>
      <StaggeredRow index={3} style={{ marginTop: px(M.footerGap) }}>
        <ScheduleFooter draft={draft} />
      </StaggeredRow>
      <div aria-live="polite" aria-atomic="true" style={VISUALLY_HIDDEN}>{spoken}</div>
    </motion.div>
  );
}

/**
 * The month grid under the day / time row, wired to the store's month and the controller's pick.
 * Whether the grid has the keyboard (Swift `focus == .calendar`) is this slot's own state, so a
 * grid that unmounts while focused (browsers fire no blur then) comes back fresh.
 */
function CalendarSlot(props: { draft: ScheduleDraft; slotRef: MutableRefObject<HTMLDivElement | null> }): JSX.Element {
  const { draft, slotRef } = props;
  const { store, controller } = useCore();
  const { reduceMotion, timeScale } = useMotionPrefs();
  const [gridFocused, setGridFocused] = useState(false);
  const hidden = reduceMotion ? { opacity: 0 } : { opacity: 0, y: px(-8) };
  const shown = reduceMotion ? { opacity: 1 } : { opacity: 1, y: px(0) };
  return (
    <motion.div
      ref={slotRef} data-qr-row="" data-qr-calendar=""
      style={{ marginTop: px(M.calendarGap) }}
      initial={hidden} animate={shown} exit={hidden}
      transition={effective('schedule', reduceMotion, timeScale)}
      onFocus={() => setGridFocused(true)}
      onBlur={() => setGridFocused(false)}
    >
      <ScheduleMonthGrid
        draft={draft.draft} month={store.calendarMonth} now={draft.now} keyboardFocused={gridFocused}
        onPick={(day) => controller.pickDay(day, 'user')}
        onPage={(delta) => store.pageMonth(delta)}
      />
    </motion.div>
  );
}

/**
 * Swift `ScheduleDraft.announceAfterPause` (contracts §2.7, UI side): VoiceOver does not read
 * value changes of an element it is not focused on, so the preview is spoken once per typing
 * pause. A further change restarts the pause, a blank field, a committed draft or the unmount
 * drops it. Returns the text for the live region.
 */
function useAnnouncement(draft: ScheduleDraft, formatter: SuggestionDateFormatter, timeScale: number): string {
  const [spoken, setSpoken] = useState('');
  const text = draft.text;
  const last = useRef({ draft, text });
  useEffect(() => {
    const before = last.current;
    last.current = { draft, text };
    // Only a change of the text (Swift `.onChange(of: model.text)`), never a new draft's opening text.
    if (before.draft !== draft || before.text === text) return undefined;
    if (text.trim() === '') return undefined;
    const id = window.setTimeout(() => {
      if (!draft.committed) setSpoken(previewSpoken(draft, formatter));
    }, ANNOUNCE_PAUSE_MS * timeScale);
    return () => window.clearTimeout(id);
  }, [draft, text, formatter, timeScale]);
  return spoken;
}

/** Off the screen for sighted visitors, read by screen readers (a 1 CSS px clipped box, not a scene length). */
const VISUALLY_HIDDEN: CSSProperties = {
  position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, border: 0,
  overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap',
};

const ROW_HIDDEN_Y = -6;
const ROW_HIDDEN_BLUR = 3;

/**
 * Swift `View.staggered(_:)`: the row starts at opacity 0, 6 pt up and 3 pt blurred and lands at
 * 0 with easeOut 0.24 after 0.06 + i·0.035; under Reduce Motion only the opacity, easeOut 0.15.
 * The offset and blur are motion values in points, composed into `--pt` lengths.
 */
function StaggeredRow(props: {
  index: 0 | 1 | 2 | 3;
  style?: CSSProperties;
  attrs?: Record<`data-${string}`, string>;
  children: ReactNode;
}): JSX.Element {
  const { index, style, attrs, children } = props;
  const { reduceMotion, timeScale } = useMotionPrefs();
  const y = useMotionValue(reduceMotion ? 0 : ROW_HIDDEN_Y);
  const blur = useMotionValue(reduceMotion ? 0 : ROW_HIDDEN_BLUR);
  const transform = useTransform(y, (v) => `translateY(calc(${v} * var(--pt) * 1px))`);
  const filter = useTransform(blur, (b) => `blur(calc(${b} * var(--pt) * 1px))`);
  const transition = staggerTransition(index, reduceMotion, timeScale);
  useEffect(() => {
    // As the section appears (Swift `appeared = true` in `.onAppear`); a flipped preference re-lands from where the row is.
    const landing = staggerTransition(index, reduceMotion, timeScale);
    const controls = [animate(y, 0, landing), animate(blur, 0, landing)];
    return () => controls.forEach((c) => c.stop());
  }, [index, reduceMotion, timeScale, y, blur]);
  return (
    <motion.div
      data-qr-row="" data-stagger={String(index)} {...attrs}
      style={{ ...style, transform, filter }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={transition}
    >
      {children}
    </motion.div>
  );
}
