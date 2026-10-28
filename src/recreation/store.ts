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
import { NaturalDateParser, type DateSuggestion } from './core/naturalDateParser';
import type { ReminderDraft, SavedReminder } from './core/reminder';
import { ScheduleDefaults } from './core/scheduleDefaults';
import type { SuggestionDateFormatter } from './core/suggestionDateFormatter';
import { isSchedule, phaseEquals, type NotchMachineSnapshot, type NotchPhase, type NotchSection } from './machine/notchMachine';
import { INITIAL_FLAGS, type NotchFlags, type NotchSizes } from './machine/notchState';
import type { FlagAnimation } from './ui/transitions';

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

  private panel: PanelView;
  private state: RecreationState;

  constructor(opts: RecreationStoreOptions) {
    this.clock = opts.clock;
    this.calendar = opts.calendar;
    this.formatter = opts.formatter;
    this.panel = { flags: INITIAL_FLAGS, animation: 'none', sizes: opts.sizes, ignoresMouse: false };
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
