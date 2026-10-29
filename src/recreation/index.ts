// The recreation's public surface (contracts §1): `desktop/` and `app/` import only from here.
export {
  Recreation, DEFAULT_TYPING_CPS, TARGET_ACTIONS,
  type RecreationHandle, type RecreationProps, type ShowSource, type EscapeResult,
  type PointerTarget, type ScenePoint, type CursorLike, type VisibleGrid,
} from './Recreation';
export type { RecreationState } from './store';
export type { SavedReminder } from './core/reminder';
export { FAKE_LISTS, type ListId, type ReminderList } from './core/lists';
export { DATE_PRESETS, DatePresets, type DatePreset, type PresetPick } from './core/datePresets';
export { isSchedule, type NotchSection, type NotchPhase, type NotchMachineSnapshot } from './machine/notchMachine';
export { LocationDraft, type LocationSaveDecision } from './core/locationDraft';
export type { ScheduleDraft } from './core/scheduleDraft';
export { NaturalDateParser, type DateSuggestion } from './core/naturalDateParser';
export { ScheduleDefaults } from './core/scheduleDefaults';
export { SuggestionDateFormatter } from './core/suggestionDateFormatter';
export { AppClock, type Clock } from './clock';
export { currentCalendar, type Calendar } from './core/calendar';
export type { Size } from './machine/notchShape';
export { Motion } from './machine/springs';
