// The recreation's observable state: a port of `QuickReminderView`'s `@State` (the draft, the live
// date suggestion, the list picker, the save error slot), of the in-notch Location section's
// `@State draft: LocationDraft`, of `resetState` / `updateSuggestion` / `applySuggestionIfAny` /
// `stripSuggestionPhrase`, and of the `NotchState` flags the views read. Snapshots are rebuilt only
// inside mutations, so `getState()` / `getPanel()` are stable for `useSyncExternalStore`.
import type { Clock } from './clock';
import type { Calendar } from './core/calendar';
import type { PresetPick } from './core/datePresets';
import { DEFAULT_LIST_ID, accentFor, type ListId } from './core/lists';
import { LocationDraft } from './core/locationDraft';
import { MonthGrid } from './core/monthGrid';
import { NaturalDateParser, type DateSuggestion } from './core/naturalDateParser';
import type { ReminderDraft, SavedReminder } from './core/reminder';
import { ScheduleDefaults } from './core/scheduleDefaults';
import { ScheduleDraft, type SaveDecision, type ScheduleOutcome } from './core/scheduleDraft';
import type { SuggestionDateFormatter } from './core/suggestionDateFormatter';
import { isSchedule, phaseEquals, type NotchMachineSnapshot, type NotchPhase, type NotchSection } from './machine/notchMachine';
import { INITIAL_FLAGS, type NotchFlags, type NotchSizes } from './machine/notchState';
import type { FlagAnimation } from './ui/transitions';

export type { SaveDecision } from './core/scheduleDraft';

export interface RecreationState {
  // Panel (NotchMachine + NotchFlags)
  readonly phase: NotchPhase;
  readonly section: NotchSection;
  readonly contentVisible: boolean;
  readonly settled: boolean;
  readonly hoverSwollen: boolean;
  readonly badgeShown: boolean;

  // Draft (QuickReminderView @State)
  readonly title: string;
  readonly notes: string;
  readonly listId: ListId;
  readonly flagged: boolean;
  /** "" is never stored; null = none. */
  readonly location: string | null;
  readonly dueDate: Date | null;
  readonly presetPick: PresetPick | null;
  /** Live and undismissed, only while `dueDate` is null. */
  readonly suggestion: DateSuggestion | null;
  readonly dismissedSuggestionText: string | null;
  readonly listPickerOpen: boolean;
  /** The open Location section's field (`LocationDraft.text`); null while the section is not shown. */
  readonly locationField: string | null;
  /** Never set on the site (no EventKit); kept for 1:1 slot rendering. */
  readonly saveError: string | null;

  // Demo bookkeeping
  readonly savedItems: readonly SavedReminder[];
  /** The visitor changed the draft since the last `markClean()`; never set by 'api' writes. */
  readonly dirty: boolean;
  /** The hint fades after the first open. */
  readonly openedOnce: boolean;

  // Derived (Swift `QuickReminderView` computed properties)
  readonly canSave: boolean;
  readonly accent: string;
  readonly schedulingInNotch: boolean;
  readonly locationInNotch: boolean;
  readonly sectionOpen: boolean;
}

/** Who made a change: the visitor ('user', sets `dirty`) or the page's choreography ('api'). */
export type Origin = 'user' | 'api';

export interface PanelView {
  readonly flags: NotchFlags;
  readonly animation: FlagAnimation;
  readonly sizes: NotchSizes;
  readonly ignoresMouse: boolean;
}

export interface RecreationStoreOptions {
  readonly clock: Clock;
  readonly calendar: Calendar;
  readonly formatter: SuggestionDateFormatter;
  readonly sizes: NotchSizes;
}

/** Swift `trimmingCharacters(in: .whitespaces)`: spaces (Zs) and tab, never newlines. */
const EDGE_WHITESPACES = /^[\p{Zs}\t]+|[\p{Zs}\t]+$/gu;

function trimmingWhitespaces(text: string): string {
  return text.replace(EDGE_WHITESPACES, '');
}

/** The `@State` the view resets in `resetState()`. */
interface Draft {
  title: string;
  notes: string;
  dueDate: Date | null;
  flagged: boolean;
  location: string | null;
  saveError: string | null;
  suggestion: DateSuggestion | null;
  dismissedSuggestionText: string | null;
  presetPick: PresetPick | null;
}

function emptyDraft(): Draft {
  return {
    title: '',
    notes: '',
    dueDate: null,
    flagged: false,
    location: null,
    saveError: null,
    suggestion: null,
    dismissedSuggestionText: null,
    presetPick: null,
  };
}

/** The `NotchMachineSnapshot` fields the views read. */
interface MachineMirror {
  phase: NotchPhase;
  section: NotchSection;
  hoverSwollen: boolean;
  badgeShown: boolean;
}

export class RecreationStore {
  /** The formatter the save path labels due dates with. */
  readonly formatter: SuggestionDateFormatter;
  private readonly clock: Clock;
  private readonly calendar: Calendar;
  private readonly listeners = new Set<() => void>();

  private draft: Draft = emptyDraft();
  private listId: ListId = DEFAULT_LIST_ID;
  private listPickerOpen = false;
  private locationDraftValue: LocationDraft | null = null;
  private savedItems: readonly SavedReminder[] = [];
  private dirty = false;
  private openedOnce = false;
  private machine: MachineMirror = { phase: { type: 'closed', parked: false }, section: 'none', hoverSwollen: false, badgeShown: false };
  private beeps = 0;

  // Set Date (`ScheduleNotchSection` @State: `model`, `timeText`, `calendarMonth`)
  private scheduleDraftValue: ScheduleDraft | null = null;
  private unsubscribeScheduleDraft: (() => void) | null = null;
  private calendarMonthValue: Date;
  private timeTextValue = '';
  private timeFieldEditing = false;
  /** `draft.draft` as last seen: `.onChange(of: model.draft)` fires only when the date changes. */
  private lastSeenScheduleDraft: number | null = null;
  private scheduleVersionValue = 0;

  private panel: PanelView;
  private state: RecreationState;

  constructor(opts: RecreationStoreOptions) {
    this.clock = opts.clock;
    this.calendar = opts.calendar;
    this.formatter = opts.formatter;
    this.panel = { flags: INITIAL_FLAGS, animation: 'none', sizes: opts.sizes, ignoresMouse: false };
    this.calendarMonthValue = MonthGrid.startOfMonth(this.clock(), this.calendar);
    this.state = this.buildState();
  }

  getState(): RecreationState {
    return this.state;
  }

  getPanel(): PanelView {
    return this.panel;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get beepCount(): number {
    return this.beeps;
  }

  /** `NSSound.beep()`: the site has no sound; the count lets tests and the UI observe it. */
  beep(): void {
    this.beeps += 1;
  }

  // MARK: Panel mirror

  setFlags(patch: Partial<NotchFlags>, animation: FlagAnimation): void {
    this.panel = { ...this.panel, flags: { ...this.panel.flags, ...patch }, animation };
    this.changed();
  }

  setIgnoresMouse(ignores: boolean): void {
    if (this.panel.ignoresMouse === ignores) return;
    this.panel = { ...this.panel, ignoresMouse: ignores };
    this.changed();
  }

  setMachine(m: NotchMachineSnapshot): void {
    const cur = this.machine;
    if (
      phaseEquals(cur.phase, m.phase) &&
      cur.section === m.section &&
      cur.hoverSwollen === m.hoverSwollen &&
      cur.badgeShown === m.badgeShown
    ) {
      return;
    }
    this.machine = { phase: m.phase, section: m.section, hoverSwollen: m.hoverSwollen, badgeShown: m.badgeShown };
    this.changed();
  }

  // MARK: Lifecycle

  /** `.panelWillShow` → `resetState()`; the list (`@AppStorage`) and the saved items stay. */
  resetDraft(): void {
    this.resetDraftFields();
    this.changed();
  }

  /** `.panelDidHide`: the list picker closes and the Location section's draft goes with its view. */
  closePopovers(): void {
    this.listPickerOpen = false;
    this.locationDraftValue = null;
    this.changed();
  }

  /** Back to a fresh page load (the saved items optionally kept). */
  reset(opts: { keepSaved: boolean }): void {
    this.resetDraftFields();
    this.panel = { ...this.panel, flags: INITIAL_FLAGS, animation: 'none' };
    this.listId = DEFAULT_LIST_ID;
    this.listPickerOpen = false;
    this.locationDraftValue = null;
    this.dirty = false;
    this.openedOnce = false;
    if (!opts.keepSaved) this.savedItems = [];
    this.changed();
  }

  // MARK: Title, notes and the suggestion

  setTitle(text: string, origin: Origin): void {
    this.writeTitle(text);
    this.touch(origin);
    this.changed();
  }

  setNotes(text: string, origin: Origin): void {
    this.draft.notes = text;
    this.touch(origin);
    this.changed();
  }

  /** Tab / the chip: `applySuggestionIfAny()`. False when there is no suggestion. */
  applySuggestion(origin: Origin): boolean {
    if (!this.applySuggestionIfAny()) return false;
    this.touch(origin);
    this.changed();
    return true;
  }

  /** Removes the suggestion's phrase from the title (unless that would empty it) and drops the suggestion. */
  stripSuggestionPhrase(): void {
    const s = this.draft.suggestion;
    if (!s) return;
    this.stripPhrase(s);
    this.changed();
  }

  /** ⓧ on the chip: the phrase stays dismissed until the title no longer parses. */
  dismissSuggestion(origin: Origin): void {
    const s = this.draft.suggestion;
    if (!s) return;
    this.draft.dismissedSuggestionText = s.matchedText;
    this.draft.suggestion = null;
    this.touch(origin);
    this.changed();
  }

  setDueDate(date: Date | null, pick: PresetPick | null, origin: Origin): void {
    this.writeDueDate(date);
    this.draft.presetPick = pick;
    this.touch(origin);
    this.changed();
  }

  // MARK: List, flag, location

  setListPickerOpen(open: boolean): void {
    this.listPickerOpen = open;
    this.changed();
  }

  /** `ListPickerMenu`: picking a list closes the picker. */
  setList(id: ListId, origin: Origin): void {
    this.listId = id;
    this.listPickerOpen = false;
    this.touch(origin);
    this.changed();
  }

  setFlag(flagged: boolean, origin: Origin): void {
    this.draft.flagged = flagged;
    this.touch(origin);
    this.changed();
  }

  /** "" → null; otherwise as typed (Swift writes the text untrimmed; the save path trims). */
  setLocation(text: string | null, origin: Origin): void {
    this.draft.location = text === '' ? null : text;
    this.touch(origin);
    this.changed();
  }

  /** `LocationNotchSection.init`: the field starts from the reminder's location. */
  openLocationDraft(): LocationDraft {
    const draft = new LocationDraft(this.draft.location ?? '');
    this.locationDraftValue = draft;
    this.changed();
    return draft;
  }

  get locationDraft(): LocationDraft | null {
    return this.locationDraftValue;
  }

  /** Typing in the Location field: not a draft change until Done / ✓ / a switch writes it. */
  setLocationText(text: string): void {
    const draft = this.locationDraftValue;
    if (!draft) return;
    draft.text = text;
    this.changed();
  }

  closeLocationDraft(): void {
    this.locationDraftValue = null;
    this.changed();
  }

  // MARK: Set Date

  /** `ScheduleNotchSection.init` + `.onAppear`: the draft opens on the reminder's date, or on the
   *  live phrase when there is none; the grid shows the draft's month; the time field syncs. */
  openScheduleDraft(): ScheduleDraft {
    this.unsubscribeScheduleDraft?.();
    const d = this.draft;
    const draft = new ScheduleDraft({
      selected: d.dueDate,
      initialText: d.dueDate === null ? d.suggestion?.matchedText ?? null : null,
      calendar: this.calendar,
      clock: this.clock,
    });
    this.scheduleDraftValue = draft;
    this.unsubscribeScheduleDraft = draft.subscribe(() => this.scheduleDraftChanged());
    this.lastSeenScheduleDraft = draft.draft.getTime();
    this.calendarMonthValue = MonthGrid.startOfMonth(draft.draft, this.calendar);
    this.timeFieldEditing = false;
    this.timeTextValue = this.formatter.time(draft.draft);
    this.scheduleVersionValue += 1;
    this.changed();
    return draft;
  }

  get scheduleDraft(): ScheduleDraft | null {
    return this.scheduleDraftValue;
  }

  /** The store lets go of the draft; the section keeps rendering its own reference while it fades out. */
  closeScheduleDraft(): void {
    this.unsubscribeScheduleDraft?.();
    this.unsubscribeScheduleDraft = null;
    this.scheduleDraftValue = null;
    this.lastSeenScheduleDraft = null;
    this.timeFieldEditing = false;
    this.scheduleVersionValue += 1;
    this.changed();
  }

  /** +1 on every draft, `timeText` or `calendarMonth` change. */
  get scheduleVersion(): number {
    return this.scheduleVersionValue;
  }

  /** The month the grid shows: the draft's at open, then it follows the draft or the ‹ › paging. */
  get calendarMonth(): Date {
    return this.calendarMonthValue;
  }

  /** The time field's text: `formatter.time(draft)` unless the field is being edited. */
  get timeText(): string {
    return this.timeTextValue;
  }

  /** The type field. Draft edits never set `dirty` (`origin` is unused): only `finishSchedule`
   *  writes the reminder. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the handle passes every edit's origin
  setScheduleText(text: string, _origin: Origin): void {
    const draft = this.scheduleDraftValue;
    if (draft) draft.text = text;
  }

  /** pick / setTime / stepTime / moveDay / moveInto on the open draft (never sets `dirty`).
   *  Swift calls `syncTimeText()` right after `stepTime` (↑ ↓ in the time field) and `setTime`
   *  (the hour chips), even while the time field has focus: an edit that changes the draft's time
   *  of day therefore re-syncs the field here too. pick / moveDay / moveInto keep the time of day
   *  and reach the field only through `.onChange(of: model.draft)`. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the handle passes every edit's origin
  editSchedule(edit: (d: ScheduleDraft) => void, _origin: Origin): void {
    const draft = this.scheduleDraftValue;
    if (!draft) return;
    const timeBefore = this.formatter.time(draft.draft);
    edit(draft);
    if (this.scheduleDraftValue === draft && this.formatter.time(draft.draft) !== timeBefore) this.syncTimeText(draft);
  }

  setTimeText(text: string): void {
    if (this.timeTextValue === text) return;
    this.timeTextValue = text;
    this.scheduleVersionValue += 1;
    this.changed();
  }

  /** Focus entering / leaving the time field: while editing, draft changes do not overwrite the text. */
  setTimeFieldEditing(editing: boolean): void {
    this.timeFieldEditing = editing;
  }

  /** Swift `applyTypedTime`: the trimmed text, unless it already shows the draft's time, goes
   *  through `ScheduleDraft.applyTypedTime`; the field then re-syncs (an invalid text reverts).
   *  false = not a time (draft unchanged; the caller beeps when it should). */
  applyTimeText(): boolean {
    const draft = this.scheduleDraftValue;
    if (!draft) return false;
    const typed = trimmingWhitespaces(this.timeTextValue);
    const valid = typed === this.formatter.time(draft.draft) || draft.applyTypedTime(typed);
    this.syncTimeText(draft);
    return valid;
  }

  /** ‹ › in the month grid (`ScheduleMonthGrid.page`): back stops at the current month. */
  pageMonth(delta: -1 | 1): boolean {
    if (delta < 0 && !MonthGrid.canGoBack(this.calendarMonthValue, this.clock(), this.calendar)) return false;
    this.calendarMonthValue = MonthGrid.shiftMonth(this.calendarMonthValue, delta, this.calendar);
    this.scheduleVersionValue += 1;
    this.changed();
    return true;
  }

  /** Arrow keys in the grid (`ScheduleNotchSection.moveDay`): after paging away, the first arrow
   *  lands in the visible month; otherwise ±1 / ±7 days, never into the past (false + beep). */
  moveDayInGrid(days: -7 | -1 | 1 | 7): boolean {
    const draft = this.scheduleDraftValue;
    if (!draft) return false;
    if (MonthGrid.startOfMonth(draft.draft, this.calendar).getTime() !== this.calendarMonthValue.getTime()) {
      draft.moveInto(this.calendarMonthValue);
      return true;
    }
    if (draft.moveDay(days)) return true;
    this.beep();
    return false;
  }

  /** Swift `finish(_:)`: writes the outcome's date and preset, then strips the title's phrase when
   *  the outcome consumes it. false for no outcome (nothing written). */
  finishSchedule(outcome: ScheduleOutcome | null, origin: Origin): boolean {
    if (!outcome) return false;
    // `writeDueDate` drops the suggestion once a date is set; Swift still holds it when it strips.
    const suggestion = this.draft.suggestion;
    this.writeDueDate(outcome.date);
    this.draft.presetPick = outcome.presetPick;
    if (outcome.consumesSuggestion && suggestion) this.stripPhrase(suggestion);
    this.touch(origin);
    this.changed();
    return true;
  }

  /** ✓ while Set Date is open: `ScheduleDraft.prepareSave`. No draft open = save as is. */
  saveDecision(): SaveDecision {
    return this.scheduleDraftValue?.prepareSave() ?? { type: 'saveAsIs' };
  }

  /** The panel is switching to Location: `ScheduleDraft.prepareSwitch`. */
  switchDecision(): SaveDecision {
    return this.scheduleDraftValue?.prepareSwitch() ?? { type: 'saveAsIs' };
  }

  // MARK: Save

  setSaveError(text: string | null): void {
    this.draft.saveError = text;
    this.changed();
  }

  markClean(): void {
    this.dirty = false;
    this.changed();
  }

  /** `saveReminder()` up to `remindersService.save`: an undismissed phrase is applied first (like
   *  iOS Reminders); null when the title trims to "". */
  prepareReminder(): ReminderDraft | null {
    const d = this.draft;
    if (d.dueDate === null && d.suggestion !== null) {
      this.applySuggestionIfAny();
      this.changed();
    }
    const title = trimmingWhitespaces(d.title);
    if (title === '') return null;
    return { title, notes: d.notes, listId: this.listId, dueDate: d.dueDate, flagged: d.flagged, location: d.location };
  }

  appendSaved(item: SavedReminder): void {
    this.savedItems = [...this.savedItems, item];
    this.changed();
  }

  // MARK: Swift view logic

  /** `title = …` plus `.onChange(of: title)`: SwiftUI re-parses only on a real change. */
  private writeTitle(text: string): void {
    if (this.draft.title === text) return;
    this.draft.title = text;
    this.updateSuggestion(text);
  }

  /** `dueDate = …` plus `.onChange(of: dueDate)`: a cleared date re-parses the title. */
  private writeDueDate(date: Date | null): void {
    const previous = this.draft.dueDate;
    this.draft.dueDate = date;
    if (date !== null) this.draft.suggestion = null;
    else if (previous !== null) this.updateSuggestion(this.draft.title);
  }

  /** `updateSuggestion(for:)`. */
  private updateSuggestion(text: string): void {
    const d = this.draft;
    if (d.dueDate !== null) {
      d.suggestion = null;
      return;
    }
    const now = new Date(Math.floor(this.clock().getTime() / 1000) * 1000); // second precision is enough
    const parsed = NaturalDateParser.parse(text, now, this.calendar);
    if (parsed && parsed.matchedText === d.dismissedSuggestionText) {
      d.suggestion = null;
    } else {
      d.suggestion = parsed;
      if (parsed === null) d.dismissedSuggestionText = null;
    }
  }

  /** `applySuggestionIfAny()`: day-only phrases resolve like the presets (9:00 or the next slot). */
  private applySuggestionIfAny(): boolean {
    const s = this.draft.suggestion;
    if (!s) return false;
    const date = s.hasTime ? s.date : ScheduleDefaults.resolveDayOnly(s.date, this.clock(), this.calendar);
    this.writeDueDate(date);
    // `dueDate` is now set, so the suggestion is already null; strip with the phrase it had.
    this.stripPhrase(s);
    return true;
  }

  /** The body of `stripSuggestionPhrase()`: the title keeps its text when stripping would blank it. */
  private stripPhrase(s: DateSuggestion): void {
    const stripped = NaturalDateParser.removingMatch(this.draft.title, s);
    this.draft.suggestion = null;
    if (trimmingWhitespaces(stripped) !== '') this.writeTitle(stripped);
  }

  /** `resetState()`; `.panelWillShow` also marks the first open. */
  private resetDraftFields(): void {
    this.draft = emptyDraft();
    this.openedOnce = true;
  }

  /** Every `ScheduleDraft` notification (text edits included) bumps the version; only a change of
   *  `draft.draft` runs `.onChange(of: model.draft)`: the time field re-syncs unless it is being
   *  edited, and the grid follows the draft into another month. A text edit that leaves the date
   *  alone (invalid or partial text, an invalid `set()`) keeps a paged-away month where it is. */
  private scheduleDraftChanged(): void {
    const draft = this.scheduleDraftValue;
    if (!draft) return;
    const now = draft.draft.getTime();
    if (now !== this.lastSeenScheduleDraft) {
      this.lastSeenScheduleDraft = now;
      if (!this.timeFieldEditing) this.timeTextValue = this.formatter.time(draft.draft);
      const first = MonthGrid.startOfMonth(draft.draft, this.calendar);
      if (first.getTime() !== this.calendarMonthValue.getTime()) this.calendarMonthValue = first;
    }
    this.scheduleVersionValue += 1;
    this.changed();
  }

  /** Swift `syncTimeText()`. */
  private syncTimeText(draft: ScheduleDraft): void {
    this.setTimeText(this.formatter.time(draft.draft));
  }

  private touch(origin: Origin): void {
    if (origin === 'user') this.dirty = true;
  }

  private changed(): void {
    this.state = this.buildState();
    for (const listener of this.listeners) listener();
  }

  private buildState(): RecreationState {
    const d = this.draft;
    const { flags } = this.panel;
    const { section } = this.machine;
    return {
      phase: this.machine.phase,
      section,
      contentVisible: flags.contentVisible,
      settled: flags.isSettled,
      hoverSwollen: this.machine.hoverSwollen,
      badgeShown: this.machine.badgeShown,
      title: d.title,
      notes: d.notes,
      listId: this.listId,
      flagged: d.flagged,
      location: d.location,
      dueDate: d.dueDate,
      presetPick: d.presetPick,
      suggestion: d.suggestion,
      dismissedSuggestionText: d.dismissedSuggestionText,
      listPickerOpen: this.listPickerOpen,
      locationField: this.locationDraftValue?.text ?? null,
      saveError: d.saveError,
      savedItems: this.savedItems,
      dirty: this.dirty,
      openedOnce: this.openedOnce,
      canSave: trimmingWhitespaces(d.title) !== '',
      accent: accentFor(this.listId),
      schedulingInNotch: isSchedule(section),
      locationInNotch: section === 'location',
      sectionOpen: section !== 'none',
    };
  }
}
