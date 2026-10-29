// Test double of the recreation's imperative API (contracts §3.2 with A-D5 / B-D2 / B-D3). It keeps a
// RecreationState, records every call and plays the async methods on setTimeout so Vitest fake timers
// drive them. Its timings are fake-only (ruling R-10): the real controller closes 1360 ms after a save.
import type {
  DatePreset,
  ListId,
  LocationDraft,
  NotchMachineSnapshot,
  PointerTarget,
  PresetPick,
  RecreationHandle,
  RecreationState,
  SavedReminder,
  ScenePoint,
  ScheduleDraft,
  ShowSource,
} from '../../src/recreation';
import { accentFor } from '../../src/recreation/core/lists';
import { isSchedule } from '../../src/recreation/machine/notchMachine';

/** Contract §3.1 at rest. */
export const INITIAL_STATE: RecreationState = Object.freeze({
  phase: Object.freeze({ type: 'closed', parked: false }),
  section: 'none',
  contentVisible: false,
  settled: false,
  hoverSwollen: false,
  badgeShown: false,
  title: '',
  notes: '',
  listId: 'reminders',
  flagged: false,
  location: null,
  dueDate: null,
  presetPick: null,
  suggestion: null,
  dismissedSuggestionText: null,
  listPickerOpen: false,
  locationField: null,
  saveError: null,
  savedItems: Object.freeze([]),
  dirty: false,
  openedOnce: false,
  canSave: false,
  accent: '#0A84FF',
  schedulingInNotch: false,
  locationInNotch: false,
  sectionOpen: false,
} satisfies RecreationState);

const SHOW_MS = 500;
const HIDE_MS = 360;
const SAVE_LAND_MS = 320;
/** 0.32 landing + 1.0 hold + 0.36 close = 1680 ms after the save started. */
const SAVE_CLOSE_MS = 1680;
const POINTER_MS = 300;
const DEFAULT_CPS = 18;
const DEMO_PHRASE = ' tomorrow at 2pm';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

function derived(state: RecreationState): RecreationState {
  return {
    ...state,
    canSave: state.title.trim() !== '',
    accent: accentFor(state.listId),
    schedulingInNotch: isSchedule(state.section),
    locationInNotch: state.section === 'location',
    sectionOpen: state.section !== 'none',
  };
}

function typingMs(text: string, cps: number): number {
  return (text.length / cps) * 1000;
}

export class FakeRecreationHandle implements RecreationHandle {
  readonly calls: Array<{ method: string; args: unknown[] }> = [];
  private state: RecreationState;
  private readonly listeners = new Set<(state: RecreationState) => void>();
  private readonly pending = new Set<{ id: ReturnType<typeof setTimeout>; reject: (error: DOMException) => void }>();
  private readonly phraseDate: Date;
  private readonly now: Date;
  private savedCount = 0;

  constructor(opts: { state?: Partial<RecreationState>; phraseDate?: Date; now?: Date } = {}) {
    this.now = opts.now ?? new Date();
    this.phraseDate = opts.phraseDate ?? this.now;
    this.state = derived({ ...INITIAL_STATE, ...opts.state });
  }

  methods(): string[] {
    return this.calls.map((c) => c.method);
  }

  /** Simulates the visitor: applies the patch, marks the draft dirty, notifies. */
  visitorEdit(patch: Partial<RecreationState>): void {
    this.update({ ...patch, dirty: true });
  }

  // Panel

  async show(opts?: { source?: ShowSource; focus?: boolean }): Promise<void> {
    this.record('show', opts);
    const type = this.state.phase.type;
    if (type === 'closed' || type === 'closing') {
      this.update({
        phase: { type: 'open' },
        title: '',
        notes: '',
        flagged: false,
        location: null,
        dueDate: null,
        presetPick: null,
        suggestion: null,
        section: 'none',
        listPickerOpen: false,
        locationField: null,
        openedOnce: true,
      });
    }
    await this.delay(SHOW_MS);
  }

  async hide(): Promise<void> {
    this.record('hide');
    this.close();
    await this.delay(HIDE_MS);
  }

  escape(): 'calendar' | 'section' | 'popover' | 'panel' | 'none' {
    this.record('escape');
    const s = this.state;
    if (s.listPickerOpen) {
      this.update({ listPickerOpen: false });
      return 'popover';
    }
    if (s.section === 'calendar') {
      this.update({ section: 'controls' });
      return 'calendar';
    }
    if (s.section !== 'none') {
      this.update({ section: 'none', locationField: null });
      return 'section';
    }
    if (s.phase.type === 'open') {
      this.close();
      return 'panel';
    }
    return 'none';
  }

  async save(): Promise<SavedReminder | null> {
    this.record('save');
    const s = this.state;
    if (!s.canSave) return null;
    if (s.section !== 'none') {
      const location = s.section === 'location' ? s.locationField || null : s.location;
      this.update({ section: 'none', locationField: null, location });
      return null;
    }
    this.update({ phase: { type: 'saving' } });
    const item = this.savedItemFrom(s);
    await this.delay(SAVE_LAND_MS);
    this.update({ savedItems: [...this.state.savedItems, item] });
    await this.delay(SAVE_CLOSE_MS - SAVE_LAND_MS);
    this.update({ phase: { type: 'closed', parked: false } });
    return item;
  }

  // Title / notes

  setTitle(text: string): void {
    this.record('setTitle', text);
    this.update({ title: text });
  }

  async typeTitle(text: string, cps = DEFAULT_CPS, opts?: { append?: boolean }): Promise<void> {
    this.record('typeTitle', text, cps, opts);
    await this.delay(typingMs(text, cps));
    this.update({ title: opts?.append ? this.state.title + text : text });
  }

  setNotes(text: string): void {
    this.record('setNotes', text);
    this.update({ notes: text });
  }

  focusTitle(): void {
    this.record('focusTitle');
  }

  focusNotes(): void {
    this.record('focusNotes');
  }

  // Suggestion chip

  applySuggestion(): boolean {
    this.record('applySuggestion');
    const { title } = this.state;
    if (!title.endsWith(DEMO_PHRASE)) return false;
    this.update({ title: title.slice(0, -DEMO_PHRASE.length), dueDate: this.phraseDate, suggestion: null });
    return true;
  }

  dismissSuggestion(): void {
    this.record('dismissSuggestion');
    this.update({ suggestion: null });
  }

  // Set Date (in notch)

  openSchedule(): void {
    this.record('openSchedule');
    if (this.state.phase.type === 'open') this.update({ section: 'controls', locationField: null });
  }

  openCalendar(): void {
    this.record('openCalendar');
    this.update({ section: 'calendar', locationField: null });
  }

  closeCalendar(): void {
    this.record('closeCalendar');
    this.update({ section: 'controls' });
  }

  toggleCalendar(): void {
    this.record('toggleCalendar');
    this.update({ section: this.state.section === 'calendar' ? 'controls' : 'calendar', locationField: null });
  }

  cancelSchedule(): void {
    this.record('cancelSchedule');
    this.update({ section: 'none' });
  }

  commitSchedule(): boolean {
    this.record('commitSchedule');
    this.update({ section: 'none' });
    return true;
  }

  applyPreset(preset: DatePreset): void {
    this.record('applyPreset', preset);
  }

  clearDueDate(): void {
    this.record('clearDueDate');
    this.update({ dueDate: null, presetPick: null });
  }

  setDueDate(date: Date | null, presetPick: PresetPick | null = null): void {
    this.record('setDueDate', date, presetPick);
    this.update({ dueDate: date, presetPick });
  }

  async typeScheduleText(text: string, cps = DEFAULT_CPS): Promise<void> {
    this.record('typeScheduleText', text, cps);
    await this.delay(typingMs(text, cps));
  }

  setScheduleText(text: string): void {
    this.record('setScheduleText', text);
  }

  pickDay(day: Date): void {
    this.record('pickDay', day);
  }

  setTime(hour: number, minute?: number): void {
    this.record('setTime', hour, minute);
  }

  pageMonth(delta: -1 | 1): void {
    this.record('pageMonth', delta);
  }

  moveDay(days: -7 | -1 | 1 | 7): void {
    this.record('moveDay', days);
  }

  scheduleDraft(): ScheduleDraft | null {
    return null;
  }

  // List picker

  openListPicker(): void {
    this.record('openListPicker');
    this.update({ listPickerOpen: true });
  }

  closeListPicker(): void {
    this.record('closeListPicker');
    this.update({ listPickerOpen: false });
  }

  setList(id: ListId): void {
    this.record('setList', id);
    this.update({ listId: id, listPickerOpen: false });
  }

  // Flag / location

  toggleFlag(): void {
    this.record('toggleFlag');
    this.update({ flagged: !this.state.flagged });
  }

  setFlag(flagged: boolean): void {
    this.record('setFlag', flagged);
    this.update({ flagged });
  }

  openLocation(): void {
    this.record('openLocation');
    this.showLocationSection();
  }

  toggleLocation(): void {
    this.record('toggleLocation');
    if (this.state.section === 'location') this.update({ section: 'none', locationField: null });
    else this.showLocationSection();
  }

  cancelLocation(): void {
    this.record('cancelLocation');
    this.update({ section: 'none', locationField: null });
  }

  commitLocation(): void {
    this.record('commitLocation');
    this.update({ location: this.state.locationField || null, section: 'none', locationField: null });
  }

  clearLocation(): void {
    this.record('clearLocation');
    this.update({ location: null, section: 'none', locationField: null });
  }

  setLocationText(text: string): void {
    this.record('setLocationText', text);
    this.update({ locationField: text });
  }

  setLocation(text: string | null): void {
    this.record('setLocation', text);
    this.update({ location: text || null });
  }

  async typeLocation(text: string, cps = DEFAULT_CPS): Promise<void> {
    this.record('typeLocation', text, cps);
    this.update({ section: 'location', locationField: '' });
    await this.delay(typingMs(text, cps));
    this.update({ location: text || null, section: 'none', locationField: null });
  }

  locationDraft(): LocationDraft | null {
    return null;
  }

  // Hover (closed notch)

  hoverNotch(entered: boolean): void {
    this.record('hoverNotch', entered);
    this.update({ hoverSwollen: entered });
  }

  // Fake cursor

  async setPointer(x: number, y: number, opts?: { duration?: number }): Promise<void> {
    this.record('setPointer', x, y, opts);
    await this.delay(POINTER_MS);
  }

  pointFor(): ScenePoint | null {
    return null;
  }

  async pointerTo(target: PointerTarget, opts?: { duration?: number; click?: boolean }): Promise<boolean> {
    this.record('pointerTo', target, opts);
    await this.delay(POINTER_MS);
    return true;
  }

  // Observation / control

  getState(): RecreationState {
    return this.state;
  }

  subscribe(listener: (state: RecreationState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  markClean(): void {
    this.record('markClean');
    this.update({ dirty: false });
  }

  /** Rejects every pending delay with an AbortError. */
  cancel(): void {
    this.record('cancel');
    const pending = [...this.pending];
    this.pending.clear();
    for (const p of pending) {
      clearTimeout(p.id);
      p.reject(new DOMException('Aborted', 'AbortError'));
    }
  }

  reset(opts?: { keepSaved?: boolean }): void {
    this.record('reset', opts);
    this.state = derived({ ...INITIAL_STATE, savedItems: opts?.keepSaved ? this.state.savedItems : [] });
    this.notify();
  }

  machine(): NotchMachineSnapshot {
    const { phase, section, badgeShown, hoverSwollen } = this.state;
    return { phase, section, badgeShown, hoverSwollen, hoverArmed: false, hoverDwellPending: false, generation: 0 };
  }

  // Internals

  private record(method: string, ...args: unknown[]): void {
    while (args.length > 0 && args[args.length - 1] === undefined) args.pop();
    this.calls.push({ method, args });
  }

  private update(patch: Partial<Mutable<RecreationState>>): void {
    this.state = derived({ ...this.state, ...patch });
    this.notify();
  }

  private notify(): void {
    for (const listener of [...this.listeners]) listener(this.state);
  }

  private close(): void {
    this.update({ phase: { type: 'closed', parked: false }, section: 'none', listPickerOpen: false, locationField: null });
  }

  private showLocationSection(): void {
    if (this.state.phase.type === 'open') this.update({ section: 'location', locationField: this.state.location ?? '' });
  }

  private savedItemFrom(s: RecreationState): SavedReminder {
    this.savedCount += 1;
    const notes = s.location ? (s.notes !== '' ? `${s.notes}\n📍 ${s.location}` : `📍 ${s.location}`) : s.notes || null;
    return {
      id: `saved-${this.savedCount}`,
      title: s.title.trim(),
      notes,
      listId: s.listId,
      listColor: s.accent,
      dueDate: s.dueDate,
      dueLabel: null,
      flagged: s.flagged,
      savedAt: this.now,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const entry = {
        id: setTimeout(() => {
          this.pending.delete(entry);
          resolve();
        }, ms),
        reject,
      };
      this.pending.add(entry);
    });
  }
}
