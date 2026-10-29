// Where `QuickReminderView`'s actions and `PanelController`'s public API meet (app 144d620): every
// UI handler and every `RecreationHandle` method goes through the controller with an `origin`.
// The machine (through the runtime) decides the panel's phase and section; the store holds the
// draft; the controller sequences them the way the Swift views do: what a section writes when it
// closes (`ScheduleNotchSection`, `LocationNotchSection`, `SectionHandoff`), what ✓ / ⌘↩ / ↩ mean
// while one is open, Esc's order (`panelDismissPopovers`), and the click bands of the local and
// global mouse monitors.

import type { Clock } from './clock';
import type { Calendar } from './core/calendar';
import { DatePresets, type DatePreset, type PresetPick } from './core/datePresets';
import type { ListId } from './core/lists';
import { toSavedReminder, type SavedReminder } from './core/reminder';
import { ScheduleCommit } from './core/scheduleCommit';
import { SuggestionDateFormatter } from './core/suggestionDateFormatter';
import { NotchLayout } from './machine/notchLayout';
import { isSchedule, type NotchSection } from './machine/notchMachine';
import { sizesFor, type NotchSizes } from './machine/notchState';
import type { Size } from './machine/notchShape';
import { NotchRuntime, RUNTIME_TIMERS, type NotchRuntimeHost } from './runtime';
import { RecreationStore, type Origin } from './store';
import { createFocusRegistry, type FocusField, type FocusRegistry } from './ui/focus';

/** What triggered a show: a click on the notch, the hotkey, the page's scroll choreography, or the API. */
export type ShowSource = 'click' | 'hotkey' | 'scroll' | 'api';

/** What Esc closed, one level per press (B-D2): the list picker → the calendar → a section → the panel. */
export type EscapeResult = 'calendar' | 'section' | 'popover' | 'panel' | 'none';

export interface RecreationCoreOptions {
  notch: Size;
  screenHeight: number;
  dockHeight: number;
  clock: Clock;
  calendar: Calendar;
  locale: string;
  hour12?: boolean;
  reduceMotion: () => boolean;
  timeScale: () => number;
  onSaved?: (item: SavedReminder) => void;
}

export interface RecreationCore {
  readonly store: RecreationStore;
  readonly runtime: NotchRuntime;
  readonly controller: RecreationController;
  readonly focus: FocusRegistry;
  readonly formatter: SuggestionDateFormatter;
  readonly sizes: NotchSizes;
  readonly calendar: Calendar;
  readonly clock: Clock;
}

/** What the runtime's host reads back from the controller: where the pointer is when the notch
 *  parks, and whether the current show asked for the title's focus. */
interface ShowIntent {
  pointerOnNotch: boolean;
  focusRequested: boolean;
}

interface ControllerDeps {
  readonly store: RecreationStore;
  readonly runtime: NotchRuntime;
  readonly focus: FocusRegistry;
  readonly formatter: SuggestionDateFormatter;
  readonly sizes: NotchSizes;
  readonly calendar: Calendar;
  readonly clock: Clock;
  readonly reduceMotion: () => boolean;
  readonly timeScale: () => number;
  readonly onSaved?: (item: SavedReminder) => void;
  readonly intent: ShowIntent;
}

/** `SavedCheckView`: the tick starts drawing this long after the save, once the badge has landed. */
const SAVED_ITEM_LANDING = 0.32;

const sectionField = (section: Exclude<NotchSection, 'none'>): FocusField =>
  section === 'location' ? 'locationField' : section === 'calendar' ? 'calendar' : 'scheduleField';

export class RecreationController {
  private readonly store: RecreationStore;
  private readonly runtime: NotchRuntime;
  private readonly focus: FocusRegistry;
  private readonly formatter: SuggestionDateFormatter;
  private readonly sizes: NotchSizes;
  private readonly calendar: Calendar;
  private readonly clock: Clock;
  private readonly reduceMotion: () => boolean;
  private readonly timeScale: () => number;
  private readonly onSaved: ((item: SavedReminder) => void) | undefined;
  private readonly intent: ShowIntent;
  private readonly timers = new Set<number>();

  constructor(deps: ControllerDeps) {
    this.store = deps.store;
    this.runtime = deps.runtime;
    this.focus = deps.focus;
    this.formatter = deps.formatter;
    this.sizes = deps.sizes;
    this.calendar = deps.calendar;
    this.clock = deps.clock;
    this.reduceMotion = deps.reduceMotion;
    this.timeScale = deps.timeScale;
    this.onSaved = deps.onSaved;
    this.intent = deps.intent;
  }

  // MARK: Panel (PanelController's public API)

  /** `notchTapped` for a click, `show` otherwise. Resolves after the settle timer (0.5 s), at once when the machine did nothing. */
  show(source: ShowSource, focus: boolean): Promise<void> {
    this.intent.focusRequested = focus;
    const before = this.runtime.machine.generation;
    this.runtime.dispatch({ type: source === 'click' ? 'notchTapped' : 'show' });
    if (this.runtime.machine.generation === before) return Promise.resolve();
    return this.delay(RUNTIME_TIMERS.settle);
  }

  /** Resolves after the close duration (0.36 s), at once when the panel was not visible. */
  hide(): Promise<void> {
    if (!this.isVisible) return Promise.resolve();
    this.runtime.dispatch({ type: 'hide' });
    return this.delay(RUNTIME_TIMERS.close);
  }

  /** ⇧⌘R (`PanelController.toggle`). */
  toggle(): void {
    if (this.state.phase.type === 'open') void this.hide();
    else void this.show('hotkey', true);
  }

  /** The pointer entered / left the closed notch; the runtime arms the hover from where the pointer rests when it parks. */
  hover(entered: boolean): void {
    this.intent.pointerOnNotch = entered;
    this.runtime.dispatch({ type: entered ? 'hoverEntered' : 'hoverExited' });
  }

  /** Esc, one level per press (`panelDismissPopovers` + `NotchSection.afterEscape`; the Esc monitor hides when nothing is open, during the saved hold too). */
  escape(): EscapeResult {
    const s = this.state;
    if (!this.isVisible) return 'none';
    if (s.phase.type === 'saving') {
      void this.hide();
      return 'panel';
    }
    if (s.listPickerOpen) {
      this.store.setListPickerOpen(false);
      return 'popover';
    }
    switch (s.section) {
      case 'calendar':
        this.closeCalendar('user');
        return 'calendar';
      case 'controls':
        this.cancelSchedule('user');
        return 'section';
      case 'location':
        this.cancelLocation('user');
        return 'section';
      case 'none':
        void this.hide();
        return 'panel';
    }
  }

  // MARK: Save (`QuickReminderView.saveReminder`, `RemindersService.save`, `collapseAfterSave`)

  /** ⌘↩ / the API: while a section is open it means Set / Done and resolves null. Otherwise the
   *  reminder is built, the save choreography runs, the item lands when the badge has (0.32 s)
   *  and the promise resolves once the machine is closed (or open again). */
  async save(origin: Origin): Promise<SavedReminder | null> {
    const s = this.state;
    if (s.badgeShown) return null;
    if (s.section !== 'none') {
      this.commitSection(origin);
      return null;
    }
    if (s.phase.type !== 'open') return null;
    const draft = this.store.prepareReminder();
    if (!draft) return null;
    const item = toSavedReminder(draft, this.clock(), this.formatter);
    const reduced = this.reduceMotion();
    this.runtime.dispatch({ type: 'save', reduceMotion: reduced });
    const land = () => {
      this.store.appendSaved(item);
      this.onSaved?.(item);
    };
    if (reduced) land();
    else this.after(SAVED_ITEM_LANDING, land);
    await this.untilClosedOrOpen();
    return item;
  }

  /** ✓: with a section open it asks the section first (`ScheduleNotchSection.saveFromBar`,
   *  `LocationNotchSection.saveFromBar`), then saves. */
  async saveFromBar(origin: Origin): Promise<SavedReminder | null> {
    const { section } = this.state;
    if (section === 'location') {
      const decision = this.store.locationDraft?.saveDecision ?? { type: 'saveAsIs' };
      if (decision.type === 'applyThenSave') this.store.setLocation(decision.text, origin);
      this.closeLocationSection(origin);
      return this.save(origin);
    }
    if (isSchedule(section)) {
      if (this.focus.active() === 'timeField' && !this.applyTypedTime(true)) return null;
      const decision = this.store.saveDecision();
      switch (decision.type) {
        case 'saveAsIs':
          this.cancelSchedule(origin);
          break;
        case 'commitThenSave':
          this.store.finishSchedule(decision.outcome, origin);
          this.closeScheduleSection(origin);
          break;
        case 'invalid':
          this.store.beep();
          return null;
      }
      return this.save(origin);
    }
    return this.save(origin);
  }

  /** ↩ in the title or notes (`submitFromTextRow`): the open section's commit, otherwise save. */
  async textRowSubmit(origin: Origin): Promise<SavedReminder | null> {
    const s = this.state;
    switch (ScheduleCommit.textRowSubmit(s.sectionOpen, s.canSave)) {
      case 'setSchedule':
        this.commitSection(origin);
        return null;
      case 'saveReminder':
        return this.save(origin);
      case 'none':
        return null;
    }
  }

  // MARK: Title, notes, suggestion

  setTitle(text: string, origin: Origin): void {
    this.store.setTitle(text, origin);
  }

  setNotes(text: string, origin: Origin): void {
    this.store.setNotes(text, origin);
  }

  applySuggestion(origin: Origin): boolean {
    return this.store.applySuggestion(origin);
  }

  dismissSuggestion(origin: Origin): void {
    this.store.dismissSuggestion(origin);
  }

  // MARK: Set Date (`openSetDate`, `toggleSetDate`, `ScheduleNotchSection`)

  /** ⌘D, the date chip: opens Set Date; never collapses one that is already open (even on the calendar). */
  openSchedule(origin: Origin): void {
    const s = this.state;
    if (s.phase.type !== 'open' || s.badgeShown || isSchedule(s.section)) return;
    this.switchSection('controls', origin);
  }

  /** The calendar button: Set Date open → Cancel; otherwise open it. */
  toggleSchedule(origin: Origin): void {
    if (isSchedule(this.state.section)) this.cancelSchedule(origin);
    else this.openSchedule(origin);
  }

  /** Opens Set Date when needed, then the month grid; a user's grid gets the keys once it has mounted. */
  openCalendar(origin: Origin): void {
    if (!isSchedule(this.state.section)) {
      this.openSchedule(origin);
      if (!isSchedule(this.state.section)) return;
    }
    if (this.state.section !== 'calendar') this.runtime.dispatch({ type: 'sectionChanged', section: 'calendar' });
    if (origin === 'user') this.nextTurn(() => this.focus.focus('calendar'));
  }

  /** The grid folds back to the controls; the keys go back to the type field when the grid (or nothing) had them. */
  closeCalendar(origin: Origin): void {
    if (this.state.section !== 'calendar') return;
    const active = this.focus.active();
    this.runtime.dispatch({ type: 'sectionChanged', section: 'controls' });
    if (origin === 'user' && (active === 'calendar' || active === null)) this.nextTurn(() => this.focus.focus('scheduleField'));
  }

  toggleCalendar(origin: Origin): void {
    if (this.state.section === 'calendar') this.closeCalendar(origin);
    else this.openCalendar(origin);
  }

  /** Cancel, Esc, the calendar button, a click above: the section closes, nothing is written. */
  cancelSchedule(origin: Origin): void {
    if (!isSchedule(this.state.section)) return;
    this.closeScheduleSection(origin);
  }

  /** Set / ↩ / ⌘↩ (`ScheduleNotchSection.commit`): false = the typed text is not a date (beep, stays open). */
  commitSchedule(origin: Origin): boolean {
    if (!isSchedule(this.state.section)) return false;
    if (this.focus.active() === 'timeField') this.applyTypedTime(false);
    const draft = this.store.scheduleDraft;
    if (!draft) return false;
    const outcome = draft.set();
    if (!outcome) {
      if (!draft.committed) this.store.beep();
      return false;
    }
    this.store.finishSchedule(outcome, origin);
    this.closeScheduleSection(origin);
    return true;
  }

  /** A preset card / ⌘1…⌘6 while Set Date is open commits and closes it; with the section closed
   *  (the bottom bar's menu) the date is written at once and a live phrase is consumed. */
  applyPreset(preset: DatePreset, origin: Origin): void {
    const s = this.state;
    if (isSchedule(s.section)) {
      const outcome = this.store.scheduleDraft?.apply(preset) ?? null;
      if (this.store.finishSchedule(outcome, origin)) this.closeScheduleSection(origin);
      return;
    }
    const date = DatePresets.date(preset, this.clock(), this.calendar);
    const consumesSuggestion = ScheduleCommit.consumesSuggestion(s.suggestion?.matchedText ?? null, 'preset');
    this.store.finishSchedule({ date, presetPick: { preset, date }, consumesSuggestion }, origin);
  }

  /** Clear while Set Date is open; the date chip's ⓧ otherwise (`dueDate = nil` only). */
  clearDueDate(origin: Origin): void {
    if (isSchedule(this.state.section)) {
      const outcome = this.store.scheduleDraft?.clear() ?? null;
      if (this.store.finishSchedule(outcome, origin)) this.closeScheduleSection(origin);
      return;
    }
    this.store.setDueDate(null, null, origin);
  }

  setDueDate(date: Date | null, pick: PresetPick | null, origin: Origin): void {
    this.store.setDueDate(date, pick, origin);
  }

  setScheduleText(text: string, origin: Origin): void {
    this.store.setScheduleText(text, origin);
  }

  pickDay(day: Date, origin: Origin): void {
    this.store.editSchedule((d) => d.pick(day), origin);
  }

  setTime(hour: number, minute: number, origin: Origin): void {
    this.store.editSchedule((d) => d.setTime(hour, minute), origin);
  }

  stepTime(steps: 1 | -1, origin: Origin): void {
    this.store.editSchedule((d) => d.stepTime(steps), origin);
  }

  /** The typed time field, on ↩ or when focus leaves it: false = not a time (reverted; beeps when asked). */
  applyTypedTime(beepOnInvalid: boolean): boolean {
    if (!isSchedule(this.state.section)) return false;
    const valid = this.store.applyTimeText();
    if (!valid && beepOnInvalid) this.store.beep();
    return valid;
  }

  pageMonth(delta: -1 | 1): void {
    this.store.pageMonth(delta);
  }

  moveDay(days: -7 | -1 | 1 | 7): void {
    this.store.moveDayInGrid(days);
  }

  // MARK: List picker, flag

  toggleListPicker(): void {
    this.store.setListPickerOpen(!this.state.listPickerOpen);
  }

  openListPicker(): void {
    this.store.setListPickerOpen(true);
  }

  closeListPicker(): void {
    this.store.setListPickerOpen(false);
  }

  /** Picking a list closes the picker. */
  setList(id: ListId, origin: Origin): void {
    this.store.setList(id, origin);
  }

  toggleFlag(origin: Origin): void {
    this.store.setFlag(!this.state.flagged, origin);
  }

  setFlag(flagged: boolean, origin: Origin): void {
    this.store.setFlag(flagged, origin);
  }

  // MARK: Location (`toggleLocation`, `LocationNotchSection`)

  openLocation(origin: Origin): void {
    const s = this.state;
    if (s.phase.type !== 'open' || s.badgeShown || s.section === 'location') return;
    this.switchSection('location', origin);
  }

  /** The location button: Location open → Cancel; otherwise open it (switching over from Set Date). */
  toggleLocation(origin: Origin): void {
    if (this.state.section === 'location') this.cancelLocation(origin);
    else this.openLocation(origin);
  }

  /** Cancel, Esc, the location button, a click above: nothing is written. */
  cancelLocation(origin: Origin): void {
    if (this.state.section !== 'location') return;
    this.closeLocationSection(origin);
  }

  /** Done, ↩ in the field, ↩ / ⌘↩ anywhere while it is open: the field as typed ('' removes the location). */
  commitLocation(origin: Origin): void {
    const draft = this.store.locationDraft;
    if (this.state.section !== 'location' || !draft) return;
    this.store.setLocation(draft.committed, origin);
    this.closeLocationSection(origin);
  }

  /** Clear (rendered only while the reminder has a location). */
  clearLocation(origin: Origin): void {
    if (this.state.section !== 'location') return;
    this.store.setLocation(null, origin);
    this.closeLocationSection(origin);
  }

  /** Typing in the Location field: the draft, not the reminder (`origin` is unused: only a commit writes it). */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the handle passes every edit's origin
  setLocationText(text: string, _origin: Origin): void {
    if (this.state.section !== 'location') return;
    this.store.setLocationText(text);
  }

  setLocation(text: string | null, origin: Origin): void {
    this.store.setLocation(text, origin);
  }

  // MARK: Sections (`QuickReminderView.switchSection`, `SectionHandoff`, the panel notifications)

  /** Opens `target`. When the other section is shown, its edit is kept first, like ✓ would
   *  (Location: what was typed; Set Date: an edited date is Set, an invalid one beeps and blocks
   *  the switch). false = the panel is not open or the switch was blocked. */
  switchSection(target: Exclude<NotchSection, 'none'>, origin: Origin): boolean {
    const s = this.state;
    if (s.phase.type !== 'open' || s.badgeShown) return false;
    const from = s.section;
    if (from === target) return true;
    const leavingOther = from !== 'none' && isSchedule(from) !== isSchedule(target);
    if (leavingOther) {
      if (from === 'location') {
        const keep = this.store.locationDraft?.textToKeepOnSwitch ?? null;
        if (keep !== null) this.store.setLocation(keep, origin);
        this.store.closeLocationDraft();
      } else {
        if (!this.commitScheduleForSwitch(origin)) return false;
        this.store.closeScheduleDraft();
      }
    }
    if (target === 'location') this.store.openLocationDraft();
    else if (!isSchedule(from)) this.store.openScheduleDraft();
    this.runtime.dispatch({ type: 'sectionChanged', section: target });
    if (origin === 'user') this.nextTurn(() => this.focus.focus(sectionField(target)));
    return true;
  }

  /** `.sectionCommitRequested` / `CommandReturnTwin`: the open section's Set or Done. false = no section. */
  commitSection(origin: Origin): boolean {
    const { section } = this.state;
    if (isSchedule(section)) return this.commitSchedule(origin);
    if (section === 'location') {
      this.commitLocation(origin);
      return true;
    }
    return false;
  }

  /** `.panelCancelSection`: the open section closes, nothing written. */
  cancelSection(origin: Origin): void {
    const { section } = this.state;
    if (isSchedule(section)) this.cancelSchedule(origin);
    else if (section === 'location') this.cancelLocation(origin);
  }

  // MARK: Mouse monitors (`installLocalEventMonitor`, `installGlobalClickMonitor`)

  /** A click inside the black shape at `yPt` from the panel's top: on the header / title / notes
   *  band it cancels the open section; the click still lands where it was aimed. */
  pointerDownInPanel(yPt: number): void {
    const bandBottom = NotchLayout.sectionCancelBandBottom(this.sizes.closedSize.height, NotchLayout.textScale);
    if (NotchLayout.clickCancelsSection(yPt, bandBottom, this.state.section)) this.cancelSection('user');
  }

  /** A click outside the black shape: closes any popover and hides the panel. */
  pointerDownOutside(): void {
    if (this.isVisible) void this.hide();
  }

  destroy(): void {
    for (const id of this.timers) window.clearTimeout(id);
    this.timers.clear();
    this.runtime.destroy();
  }

  // MARK: Private

  private get state() {
    return this.store.getState();
  }

  /** `NotchMachine.isVisible`: open or saving. */
  private get isVisible(): boolean {
    const { type } = this.state.phase;
    return type === 'open' || type === 'saving';
  }

  /** `ScheduleNotchSection.commitForSwitch`: keep an edit (Set it), never lose it silently. */
  private commitScheduleForSwitch(origin: Origin): boolean {
    if (this.focus.active() === 'timeField' && !this.applyTypedTime(true)) return false;
    const decision = this.store.switchDecision();
    switch (decision.type) {
      case 'saveAsIs':
        return true;
      case 'commitThenSave':
        this.store.finishSchedule(decision.outcome, origin);
        return true;
      case 'invalid':
        this.store.beep();
        return false;
    }
  }

  /** Every Set Date close (Cancel and each commit): one spring back to the plain panel. */
  private closeScheduleSection(origin: Origin): void {
    this.runtime.dispatch({ type: 'sectionChanged', section: 'none' });
    this.store.closeScheduleDraft();
    this.restoreKeyFocus(origin);
  }

  /** Every Location close (Cancel, Done, Clear, ✓). */
  private closeLocationSection(origin: Origin): void {
    this.runtime.dispatch({ type: 'sectionChanged', section: 'none' });
    this.store.closeLocationDraft();
    this.restoreKeyFocus(origin);
  }

  /** `PanelController.restoreKeyFocus` on the next turn, once the section's field has unmounted:
   *  the title takes the keyboard back when focus was inside the panel (or fell to `body`). */
  private restoreKeyFocus(origin: Origin): void {
    if (origin !== 'user') return;
    this.nextTurn(() => {
      const s = this.state;
      if (s.phase.type !== 'open' || s.section !== 'none') return;
      const active = this.focus.active();
      if (active === 'title' || active === 'notes') return;
      if (this.focus.isInside() || document.activeElement === document.body) this.focus.focus('title');
    });
  }

  /** Resolves when the machine next reaches `closed` (the saved choreography ran out) or `open` (it was reopened). */
  private untilClosedOrOpen(): Promise<void> {
    return new Promise((resolve) => {
      const unsubscribe = this.store.subscribe(() => {
        const { type } = this.state.phase;
        if (type !== 'closed' && type !== 'open') return;
        unsubscribe();
        resolve();
      });
    });
  }

  private delay(seconds: number): Promise<void> {
    return new Promise((resolve) => this.after(seconds, resolve));
  }

  /** `DispatchQueue.main.async`: after the pending render has mounted / unmounted a section's field. */
  private nextTurn(fire: () => void): void {
    this.after(0, fire);
  }

  /** A timer scaled like the runtime's (`?debug=motion`), cleared by `destroy`. */
  private after(seconds: number, fire: () => void): void {
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      fire();
    }, seconds * this.timeScale() * 1000);
    this.timers.add(id);
  }
}

/** Builds the formatter, the sizes, the store, the runtime (the fake screen always has a notch)
 *  and the controller, wired like `PanelController` + `QuickReminderView`. */
export function createRecreationCore(opts: RecreationCoreOptions): RecreationCore {
  const { clock, calendar } = opts;
  const formatter = new SuggestionDateFormatter({ locale: opts.locale, calendar, hour12: opts.hour12 });
  const sizes = sizesFor(opts.notch, opts.screenHeight, opts.dockHeight);
  const store = new RecreationStore({ clock, calendar, formatter, sizes });
  const focus = createFocusRegistry();
  const intent: ShowIntent = { pointerOnNotch: false, focusRequested: false };

  const host: NotchRuntimeHost = {
    setFlags: (patch, animation) => store.setFlags(patch, animation),
    setIgnoresMouse: (ignores) => store.setIgnoresMouse(ignores),
    /** `focusTitleFieldIfNeeded`: only for a show that asked for it, with no section open and no text row editing. */
    focusTitle: () => {
      if (!intent.focusRequested) return;
      if (store.getState().phase.type !== 'open' || store.getPanel().flags.section !== 'none') return;
      const active = focus.active();
      if (active === 'title' || active === 'notes') return;
      focus.focus('title');
    },
    blurAll: () => focus.blur(),
    haptic: () => {},
    willShow: () => store.resetDraft(),
    didHide: () => store.closePopovers(),
  };
  const runtime = new NotchRuntime(host, {
    reduceMotion: opts.reduceMotion,
    timeScale: opts.timeScale,
    hasNotch: () => true,
    pointerOnNotch: () => intent.pointerOnNotch,
    onDispatched: (_event, snapshot) => store.setMachine(snapshot),
  });
  const controller = new RecreationController({
    store, runtime, focus, formatter, sizes, calendar, clock,
    reduceMotion: opts.reduceMotion, timeScale: opts.timeScale, onSaved: opts.onSaved, intent,
  });
  return { store, runtime, controller, focus, formatter, sizes, calendar, clock };
}
