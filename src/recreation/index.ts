// Public surface of the recreation (the only module desktop/ may import).
//
// Lane stand-in (ruling R-06): Task 43 (B23) owns this file and replaces it at the merge with the
// full surface (`Recreation`, `AppClock`, …). Until then it carries type re-exports, the runtime
// values the desktop needs (`DATE_PRESETS`, `AppClock`, `currentCalendar`), a type-only declaration
// of `Recreation`, and the contract §3 types of the imperative
// API (with deviations A-D5 / B-D2 / B-D3 applied) that `store.ts` / `Recreation.tsx` will declare.
import type { ForwardRefExoticComponent, RefAttributes, RefObject } from 'react';
import type { Clock } from './clock';
import type { Calendar } from './core/calendar';
import type { DatePreset, PresetPick } from './core/datePresets';
import type { ListId } from './core/lists';
import type { LocationDraft } from './core/locationDraft';
import type { DateSuggestion } from './core/naturalDateParser';
import type { SavedReminder } from './core/reminder';
import type { ScheduleDraft } from './core/scheduleDraft';
import type { NotchMachineSnapshot, NotchPhase, NotchSection } from './machine/notchMachine';
import type { Size } from './machine/notchShape';

export { DATE_PRESETS } from './core/datePresets';
export { AppClock } from './clock';
export { currentCalendar } from './core/calendar';
export type {
  Calendar,
  Clock,
  DatePreset,
  DateSuggestion,
  ListId,
  LocationDraft,
  NotchMachineSnapshot,
  NotchPhase,
  NotchSection,
  PresetPick,
  SavedReminder,
  ScheduleDraft,
  Size,
};

/** Scene points, origin top-left of the 1512 × 982 screen (contract §3.2). */
export interface ScenePoint {
  readonly x: number;
  readonly y: number;
}

/** Contract §3.1 with A-D5 (`section`) and B-D3 (`locationField`, `locationInNotch`, `sectionOpen`). */
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
  readonly location: string | null;
  readonly dueDate: Date | null;
  readonly presetPick: PresetPick | null;
  readonly suggestion: DateSuggestion | null;
  readonly dismissedSuggestionText: string | null;
  readonly listPickerOpen: boolean;
  /** The open Location section's field text; null while the section is not shown. */
  readonly locationField: string | null;
  readonly saveError: string | null;

  // Demo bookkeeping
  readonly savedItems: readonly SavedReminder[];
  readonly dirty: boolean;
  readonly openedOnce: boolean;

  // Derived
  readonly canSave: boolean;
  readonly accent: string;
  readonly schedulingInNotch: boolean;
  readonly locationInNotch: boolean;
  readonly sectionOpen: boolean;
}

export type ShowSource = 'click' | 'hotkey' | 'scroll' | 'api';

export type PointerTarget =
  | 'notch' | 'close' | 'header' | 'title' | 'notes' | 'suggestionChip' | 'suggestionDismiss' | 'dateChip'
  | 'calendarIcon' | 'locationIcon' | 'flagIcon' | 'save'
  | `list:${ListId}` | 'locationField' | 'locationDone' | 'locationClear' | 'locationCancel'
  | `preset:${DatePreset}` | 'scheduleField' | 'dayButton' | 'timeField' | `timeChip:${9 | 12 | 15 | 19}`
  | 'calendarPrev' | 'calendarNext' | `day:${number}`
  | 'clear' | 'cancel' | 'set';

/** Structural subset of desktop's FakeCursorHandle (Task 43 (B23)). */
export interface CursorLike {
  moveTo(point: ScenePoint, opts?: { durationMs?: number }): Promise<void>;
  click(): Promise<void>;
  cancel(): void;
}

/** Contract §3.2 with B-D2 (escape order) and B-D3 (the in-notch Location section). */
export interface RecreationHandle {
  // Panel
  show(opts?: { source?: ShowSource; focus?: boolean }): Promise<void>;
  hide(): Promise<void>;
  escape(): 'calendar' | 'section' | 'popover' | 'panel' | 'none';
  save(): Promise<SavedReminder | null>;

  // Title / notes
  setTitle(text: string): void;
  typeTitle(text: string, cps?: number, opts?: { append?: boolean }): Promise<void>;
  setNotes(text: string): void;
  focusTitle(): void;
  focusNotes(): void;

  // Suggestion chip
  applySuggestion(): boolean;
  dismissSuggestion(): void;

  // Set Date (in notch)
  openSchedule(): void;
  openCalendar(): void;
  closeCalendar(): void;
  toggleCalendar(): void;
  cancelSchedule(): void;
  commitSchedule(): boolean;
  applyPreset(preset: DatePreset): void;
  clearDueDate(): void;
  setDueDate(date: Date | null, presetPick?: PresetPick | null): void;
  typeScheduleText(text: string, cps?: number): Promise<void>;
  setScheduleText(text: string): void;
  pickDay(day: Date): void;
  setTime(hour: number, minute?: number): void;
  pageMonth(delta: -1 | 1): void;
  moveDay(days: -7 | -1 | 1 | 7): void;
  scheduleDraft(): ScheduleDraft | null;

  // List picker
  openListPicker(): void;
  closeListPicker(): void;
  setList(id: ListId): void;

  // Flag / location
  toggleFlag(): void;
  setFlag(flagged: boolean): void;
  openLocation(): void;
  toggleLocation(): void;
  cancelLocation(): void;
  commitLocation(): void;
  clearLocation(): void;
  setLocationText(text: string): void;
  setLocation(text: string | null): void;
  typeLocation(text: string, cps?: number): Promise<void>;
  locationDraft(): LocationDraft | null;

  // Hover (closed notch)
  hoverNotch(entered: boolean): void;

  // Fake cursor
  setPointer(x: number, y: number, opts?: { duration?: number }): Promise<void>;
  pointFor(target: PointerTarget): ScenePoint | null;
  pointerTo(target: PointerTarget, opts?: { duration?: number; click?: boolean }): Promise<boolean>;

  // Observation / control
  getState(): RecreationState;
  subscribe(listener: (state: RecreationState) => void): () => void;
  markClean(): void;
  cancel(): void;
  reset(opts?: { keepSaved?: boolean }): void;
  machine(): NotchMachineSnapshot;
}

/** Contract §3.3; `cursor` is the structural `CursorLike` (Task 43 (B23)). */
export interface RecreationProps {
  notch: Size;
  screenHeight: number;
  dockHeight?: number;
  clock?: Clock;
  calendar?: Calendar;
  locale?: string;
  hour12?: boolean;
  reduceMotion?: boolean;
  cursor?: RefObject<CursorLike | null>;
  onSaved?(item: SavedReminder): void;
  onStateChange?(state: RecreationState): void;
  shortcutsEnabled: boolean;
  sceneScale: number;
  notchOrigin: ScenePoint;
}

/** Declared, not defined, on this lane: `Recreation.tsx` (Task 43 (B23)) lands at the merge and the full
 *  index replaces this file. Tests reach it only through `vi.mock` (tests/fakes/recreationMock.tsx). */
export declare const Recreation: ForwardRefExoticComponent<RecreationProps & RefAttributes<RecreationHandle>>;
