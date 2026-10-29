# 00 · Contracts — quickreminder.jholec.com

Date: 2026-10-27 · Role: architect · Status: binding for every other part (01…)

Source of truth: `~/Developer/Xcode Apps/QuickReminder` (`SPEC.md` §1 §3 §4 and the Swift
sources). Where this file names a Swift file, the TypeScript module ports it 1:1: same names,
same rules, same numbers. Where the Swift code and `SPEC.md` disagree, the code wins (spec §3).
Nothing below is approximated; every constant is copied from the Swift source named next to it.

Conventions used in every contract:

- Points, not pixels. All recreation and desktop geometry is in the 14" MacBook Pro logical
  screen space (1512 × 982 pt); one CSS variable `--pt` scales the whole scene (landing spec §11.1).
- `now: Date` and `calendar: Calendar` are **always explicit parameters** in `core/` and
  `machine/` (no `Date()` or `Calendar.current` defaults). Production passes `clock()` and
  `currentCalendar()`; tests pass fixed values.
- Text scale is fixed at 1.0 (landing spec §5.2); `NotchLayout` keeps the `textScale` parameter
  only where a Swift test pins the sum at several scales (`openHeightFollowsTheRhythm`), and
  every web caller passes 1.
- Swift enums with payloads become discriminated unions on a `type` field; payload-less enums
  become string-literal unions. Swift `enum` namespaces of static functions become TS modules
  with named exports of the same name (`NaturalDateParser.parse` → `import { parse } from
  './naturalDateParser'` is **not** allowed; keep the namespace: `export const NaturalDateParser
  = { parse, removingMatch, … } as const` so call sites read exactly like the Swift ones).
- `Date | null` replaces `Date?`; `readonly` replaces `let`.

---

## 1. File tree (`src/`), one responsibility per file

```
src/
  main.tsx                         Vite entry: mounts <App/>; imports tokens.css, index.css; reads ?debug=motion and ?now=
  App.tsx                          Page shell: <ScrollProgress/> <Nav/> <Stage/> <Features/> <Integrations/> <Download/> <Footer/>
  index.css                        Tailwind layers; base resets; page font (Inter) and recreation font stack classes
  tokens.css                       CSS variables: --jh-* (page, §6.1) and --qr-* (recreation, §6.2); light/dark
  vite-env.d.ts                    Vite client types

  app/                             page shell, sections, scroll choreography (imports desktop/ and recreation/)
    Nav.tsx                        Floating pill nav on the desktop (GitHub · Download); hides when the page is scrolled past the hero
    ScrollProgress.tsx             2 px top progress bar driven by a GSAP ScrollTrigger scrub
    Stage.tsx                      Pinned stage: hero → shrink → features camera; hosts <MacBookFrame/><DesktopScene/>; owns the RecreationHandle + FakeCursorHandle refs
    MacBookFrame.tsx               14" MacBook Pro lid bezel + keyboard deck, CSS/SVG only; opacity/draw-in driven by Stage
    stageCamera.ts                 Pure: camera(scale, originX, originY, frameOpacity) for scroll progress and viewport (landing spec §11.1)
    motionDebug.ts                 `?debug=motion` → global time scale 4 (motion + GSAP + runtime timers read it)
    choreography/
      demo.ts                      DEMO_REMINDER constant (title, phrase, list, flag, location) and SECTION_SNAPSHOTS (landing spec §11.2)
      snapshot.ts                  SectionSnapshot / SectionAction / DueSpec types; resolveDue(spec, now, calendar)
      reconcile.ts                 reconcile(handle, snapshot, opts): moves the recreation to the snapshot, animating only the section's action
      useSectionDriver.ts          Hook: ScrollTrigger onEnter/onLeaveBack per section → throttled reconcile; visitor-edits (dirty) rules
      copy.ts                      All section copy: headlines (fixed), paragraphs (builder's draft), bullets, hints
    sections/
      Features.tsx                 Right-hand copy column for (01)…(06); registers section refs with useSectionDriver
      FeatureSection.tsx           One `(0n) Label /` section: numbered label, 24-semibold headline, 18-medium paragraph, Phosphor bullets
      Integrations.tsx             (07) static dark card row + faux terminal line `open quickreminder://show`
      Download.tsx                 Dark #0A0A0A section: buttons, three facts, requirements line
      Footer.tsx                   jholec.com link, "Made by Jakub Holec", trademark disclaimer (README wording), repo link

  desktop/                         fake macOS desktop (imports recreation/; never imported by it)
    DesktopScene.tsx               1512 × 982 pt scene: Wallpaper, MenuBar, notch slot (the Recreation), NotchHint, FakeCursor, RemindersWindow; focusable container that routes shortcuts
    Wallpaper.tsx                  Original CSS mesh gradient (two/three blobs), light and dark variants
    MenuBar.tsx                    38 pt menu bar with the notch cut-out, app-name "Notes" on the left, app menu-bar icon + clock on the right
    MenuBarClock.tsx               Visitor's real time (hh:mm, locale), ticks on the minute
    NotchHint.tsx                  "Click the notch to add a reminder" / "In the app: ⇧⌘R from anywhere."; fades after the first open
    FakeCursor.tsx                 SVG arrow cursor positioned in scene points; forwardRef<FakeCursorHandle>
    fakeCursor.ts                  FakeCursorHandle type + ScenePoint; motion-driven move/click
    RemindersWindow.tsx            Original (non-Apple) fake Reminders window bottom-right; lists SavedReminder rows; slides in after the first save
    desktopShortcuts.ts            Pure key router: KeyboardEvent + state → ShortcutAction | null (landing spec §11.3)

  recreation/                      the 1:1 app recreation (self-contained: no imports from app/ or desktop/)
    index.ts                       Public surface: Recreation, RecreationHandle, RecreationState, SavedReminder, types from core/machine
    Recreation.tsx                 forwardRef<RecreationHandle, RecreationProps>: creates the store + runtime, renders ui/NotchContainer
    store.ts                       RecreationStore: observable RecreationState + actions (port of QuickReminderView's @State + RemindersService.save)
    runtime.ts                     NotchRuntime: feeds NotchMachine, performs NotchEffects with browser timers (port of PanelController)
    clock.ts                       AppClock: `?now=` override (port of QR_NOW), createClock()
    core/                          ported logic, pure TS, Vitest (mirrors Services/* and two Views/* helpers)
      calendar.ts                  Calendar type + time-zone-safe date arithmetic (Intl based); currentCalendar(), pragueCalendar for tests
      naturalDateParser.ts         Services/NaturalDateParser.swift
      scheduleDefaults.ts          Services/ScheduleDefaults.swift (ScheduleDefaults, DayPart)
      datePresets.ts               Services/DatePresets.swift (DatePreset, PresetPick)
      scheduleInput.ts             Services/ScheduleInput.swift
      scheduleCommit.ts            Services/ScheduleCommit.swift
      scheduleDraft.ts             Services/ScheduleDraft.swift
      monthGrid.ts                 Services/MonthGrid.swift
      accentContrast.ts            Services/AccentContrast.swift
      suggestionDateFormatter.ts   Views/SuggestionDateFormatter.swift (+ RelativeDistance for the preview line)
      scheduleText.ts              Views/ScheduleText.swift
      lists.ts                     The five fake lists (stand-in for RemindersService.calendars) + ListId
      reminder.ts                  ReminderDraft, SavedReminder, buildNotes (RemindersService.buildNotes), toSavedReminder
    machine/                       NotchMachine port + layout metrics
      notchMachine.ts              Panel/NotchMachine.swift: NotchPhase, ScheduleExpansion, NotchEvent, NotchEffect, NotchMachine
      notchLayout.ts               Notch/NotchState.swift `NotchLayout` + `ScheduleMetrics`, Views/Theme.swift metrics
      notchState.ts                Notch/NotchState.swift `NotchState` as a pure derived-size function (currentSize, hoverSize, savedSize, …)
      notchShape.ts                Notch/NotchShape.swift: SVG path string for the silhouette, width(forNotchWidth), contains()
      springs.ts                   SwiftUI → physical spring conversion (§7) and every named animation of the app as a motion transition
    ui/                            components mirroring Views/* (motion for springs; CSS for easings)
      NotchContainer.tsx           Notch/NotchContainerView.swift: black silhouette (animated path), masked content, SavedCheckView slot
      QuickReminderView.tsx        Views/QuickReminderView.swift: band → Header → Input → (chip slot + BottomBar | ScheduleNotchSection)
      HeaderView.tsx               Views/HeaderView.swift
      InputView.tsx                Views/InputView.swift: DashedCircle + two PlaceholderTextField rows
      PlaceholderTextField.tsx     Views/PlainTextView.swift + PlaceholderTextField: single-line field, Return/Tab/Esc semantics, maxLength, caret in accent
      DashedCircle.tsx             Views/DashedCircle.swift
      BottomBar.tsx                Views/BottomBar.swift: pill (date, location, flag) + ✓
      ChipSlot.tsx                 The fixed 26 pt slot: SuggestionChip | DateChip | error (QuickReminderView.regularBottom)
      SavedCheckView.tsx           Views/SavedCheckView.swift: badge with trimmed tick + bounce (layoutId "save")
      ListPickerMenu.tsx           Views/ListPickerMenu.swift restyled per landing spec §11.4 (original black popover)
      LocationPopover.tsx          BottomBar.locationPopover restyled per landing spec §11.4
      ScheduleNotchSection.tsx     Views/ScheduleNotchSection.swift
      ScheduleMonthGrid.tsx        Views/ScheduleMonthGrid.swift
      buttons.tsx                  Views/HoverButtonStyle.swift + NotchButtonStyles.swift: HoverButton, HoverHighlightButton, NotchFillButton, NotchTextButton, KeyHint, DayCellButton
      icons.tsx                    SF Symbol name → Phosphor component at the app's optical sizes (table in part 03)
      useReducedMotion.ts          prefers-reduced-motion hook (NotchLayout.reduceMotion)

tests/                             (outside src/, Vitest root)
  core/*.test.ts                   One file per Swift test file: naturalDateParser, scheduleDefaults, datePresets, scheduleInput, scheduleCommit, scheduleDraft, monthGrid, accentContrast, suggestionDateFormatter
  machine/*.test.ts                notchMachine, notchMachineSchedule, notchLayout (NotchStateTests sums), notchShape
  support.ts                       pragueCalendar, prague(y,m,d,h,min), pragueString, plainSpaces (ScheduleTestSupport.swift)
e2e/
  smoke.spec.ts                    Playwright: load, notch click opens, "tomorrow at 2pm" chip, Tab applies, ⌘↩ saves, item lands in the window
```

Import rule (enforced by an ESLint `no-restricted-imports` rule in part 01): `recreation/**` imports
only from `recreation/**`; `desktop/**` imports `recreation/` public surface only (`recreation/index.ts`);
`app/**` imports both.

---

## 2. `recreation/core/` and `recreation/machine/` — exact exports

### 2.1 `core/calendar.ts` (no Swift counterpart; replaces Foundation `Calendar`)

```ts
/** Foundation weekday numbering: 1 = Sunday … 7 = Saturday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Calendar {
  readonly timeZone: string;      // IANA id, e.g. "Europe/Prague"
  readonly locale: string;        // BCP 47, e.g. "en-US", "cs-CZ"
  readonly firstWeekday: Weekday; // Calendar.firstWeekday (en-US 1, cs-CZ 2)
}

export interface DateComponents {
  year: number; month: number; day: number;        // 1-based month/day
  hour: number; minute: number; second: number;
  weekday: Weekday;
}

/** Production calendar: the visitor's time zone, locale "en-US" (landing spec §5.3), firstWeekday 1. */
export function currentCalendar(): Calendar;
/** Fixed test calendar, identical to ScheduleTestSupport.swift `pragueCalendar`. */
export const pragueCalendar: Calendar; // { timeZone: "Europe/Prague", locale: "cs-CZ", firstWeekday: 2 }

export function components(cal: Calendar, date: Date): DateComponents;
/** Wall clock → instant, Foundation `calendar.date(from: components)` policy: a skipped
 *  spring-forward time shifts forward by the gap (02:30 → 03:30); a repeated autumn time takes
 *  its first occurrence. Returns null only when the components are not a real calendar date
 *  (31 Feb) — the caller round-trips like NaturalDateParser.resolveDate. */
export function dateFrom(cal: Calendar, c: { year: number; month: number; day: number; hour?: number; minute?: number; second?: number }): Date | null;
/** `calendar.date(bySettingHour:minute:second:of:matchingPolicy: .nextTime, repeatedTimePolicy: .first, direction: .forward)`:
 *  a skipped time snaps to the next valid instant (02:30 → 03:00). Used only by NaturalDateParser.apply. */
export function settingTime(cal: Calendar, day: Date, hour: number, minute: number): Date;
export function startOfDay(cal: Calendar, date: Date): Date;
export function startOfHour(cal: Calendar, date: Date): Date;
export function startOfMonth(cal: Calendar, date: Date): Date;
export function daysInMonth(cal: Calendar, date: Date): number;
export function addDays(cal: Calendar, date: Date, days: number): Date;      // wall-clock day arithmetic (keeps hour:minute across DST)
export function addMonths(cal: Calendar, date: Date, months: number): Date;  // Foundation clamping (31 Jan + 1 → 28/29 Feb)
export function addMinutes(date: Date, minutes: number): Date;              // absolute
export function addHours(date: Date, hours: number): Date;                  // absolute
export function isSameDay(cal: Calendar, a: Date, b: Date): boolean;
export function isSameMinute(cal: Calendar, a: Date, b: Date): boolean;     // `compare(_:to:toGranularity: .minute)`
export function daysBetween(cal: Calendar, from: Date, to: Date): number;   // startOfDay(from) → startOfDay(to), whole days
export function weekdayOf(cal: Calendar, date: Date): Weekday;
```

### 2.2 `core/naturalDateParser.ts` ← `Services/NaturalDateParser.swift`

```ts
export interface DateSuggestion {
  readonly date: Date;
  /** false when only a day was recognised; the caller applies ScheduleDefaults.resolveDayOnly. */
  readonly hasTime: boolean;
  /** UTF-16 code-unit offsets into the ORIGINAL text (JS strings are UTF-16, like Swift's Range mapped by utf16 offset). */
  readonly matchedRange: { readonly start: number; readonly end: number };
  /** The phrase exactly as typed, e.g. "tomorrow at 2pm", "zítra ve 14:00". */
  readonly matchedText: string;
}

export const NaturalDateParser: {
  /** Texts longer than this return null (parser runs per keystroke). */
  readonly maxLengthUTF16: 1000;
  /** Right-most date/time phrase in `text`, or null. Same candidate classes and precedence as
   *  Swift: offsets > days > times; a time merges only with an ADJACENT day (gap ≤ 3 chars of
   *  whitespace/commas); day-only → hasTime false; time-only in the past → tomorrow. */
  parse(text: string, now: Date, calendar: Calendar): DateSuggestion | null;
  /** `text` minus the phrase; drops ONE dangling preposition before it
   *  ("at","on","by","for","until","till","v","ve","o","do","na","za","od"), orphaned punctuation, collapses whitespace. */
  removingMatch(text: string, suggestion: DateSuggestion): string;
  /** Hours 1…6 without am/pm read as PM; 0 and 7…23 literal. Shared with ScheduleInput. */
  disambiguate(hour: number): number;
};
```

Port notes that are part of the contract (tests mirror `NaturalDateParserTests.swift`, `now` =
Friday 2026-09-18 10:00 local, ~240 cases): normalisation = `toLowerCase()` + NFD + strip
`\p{M}` **only when the per-character UTF-16 length is preserved**, otherwise that character is
lowercased only (Swift `normalize`); regexes use the `u` flag with `(?<!\p{L})` / `(?!\p{L})`
boundaries; the word lists (`weekdayNumbers`, `monthNumbers`, `czechHintWords`, `czechHalfOrdinals`,
`dayPartTimes`, `danglingPunctuation`) are copied verbatim; `yearPattern = 20\d{2}`, `yearSearchSpan = 8`,
`yearWindow = 10`; slash dates are month/day unless `looksCzech`.

### 2.3 `core/scheduleDefaults.ts` ← `Services/ScheduleDefaults.swift`

```ts
export const DayPart: { readonly morningHour: 9; readonly afternoonHour: 15; readonly eveningHour: 19; readonly nightHour: 20 };

export const ScheduleDefaults: {
  readonly dayOnlyHour: 9;                                  // = DayPart.morningHour
  /** Next :00/:30 (granularity 30) at least minLead (15 min) ahead: 14:12 → 14:30, 14:20 → 15:00, 23:50 → 00:30. */
  nextSlot(now: Date, calendar: Calendar, granularity?: number, minLeadSeconds?: number): Date;
  /** Day-only date at 9:00; today after 9:00 → nextSlot if still today, else tomorrow 9:00. */
  resolveDayOnly(day: Date, now: Date, calendar: Calendar): Date;
  /** Calendar day of `day` with hour:minute of `time`. */
  compose(day: Date, time: Date, calendar: Calendar): Date;
  /** hour:minute on `day` through dateFrom (components policy; 02:30 on spring-forward → 03:30). */
  at(hour: number, minute: number, day: Date, calendar: Calendar): Date;
};
```

`AppClock` moves to `recreation/clock.ts`:

```ts
export const AppClock: {
  /** `?now=2026-10-23T10:00` (local) or any ISO 8601 with zone; read once at load. */
  parse(raw: string, timeZone: string): Date | null;
  /** Date.now() shifted by the parsed offset; time still advances. */
  now(): Date;
};
export type Clock = () => Date;
```

### 2.4 `core/datePresets.ts` ← `Services/DatePresets.swift`

```ts
export type DatePreset = 'inOneHour' | 'evening' | 'tomorrow' | 'weekend' | 'nextWeek' | 'nextMonth';
/** Display order = ⌘1…⌘6 (CaseIterable order). */
export const DATE_PRESETS: readonly DatePreset[];
export interface PresetPick { readonly preset: DatePreset; readonly date: Date; }

export const DatePresets: {
  readonly eveningCutoffMinutes: 30;
  date(preset: DatePreset, now: Date, calendar: Calendar): Date;
  /** "In 1 Hour" · "This Evening"/"Tomorrow Evening" · "Tomorrow" · "This Weekend"/"Next Weekend" (Sat/Sun) · "Next Week" · "Next Month". */
  title(preset: DatePreset, now: Date, calendar: Calendar): string;
  /** "Remind Me In 1 Hour", "Remind Me Tomorrow", else title(). Popover-menu wording; unused by the UI (In notch only) but ported for the tests. */
  menuTitle(preset: DatePreset, now: Date, calendar: Calendar): string;
  /** SF names: clock · moon · sunrise · sofa · calendar.badge.plus · calendar (icons.tsx maps them to Phosphor). */
  systemImage(preset: DatePreset): 'clock' | 'moon' | 'sunrise' | 'sofa' | 'calendar.badge.plus' | 'calendar';
  /** null today; "EEE" (spoken "EEEE") days 1…6; "d MMM" (spoken "EEEE d MMMM") from 7 days out. */
  dayTemplate(date: Date, now: Date, calendar: Calendar, spoken?: boolean): 'EEE' | 'EEEE' | 'd MMM' | 'EEEE d MMMM' | null;
  /** The one card to highlight: picked preset while its date still stands, else the first preset (display order) on the same minute, else null. */
  highlighted(draft: Date, picked: PresetPick | null, now: Date, calendar: Calendar): DatePreset | null;
  /** Next `weekday` strictly after today, at start of day (delta 0 → 7). Shared with the parser. */
  nextWeekday(weekday: Weekday, now: Date, calendar: Calendar): Date;
};
```

### 2.5 `core/scheduleInput.ts` ← `Services/ScheduleInput.swift`

```ts
export type ScheduleInputResult =
  | { readonly type: 'empty' }
  | { readonly type: 'date'; readonly date: Date }
  | { readonly type: 'invalid' };

export const ScheduleInput: {
  /** Whole input must be one date. Shorthands before the parser: 1–2 digits = hour (disambiguate),
   *  3–4 digits = HHmm, `H[:.]mm`, `+N(m|min|h|d)`; dotted pair with day 1…31 and month 10…12 =
   *  Czech day.month ("15.11" → "15.11."); leading weekday abbreviation gets "on " prefixed.
   *  Leftover text after removingMatch (trimmed of whitespace + punctuation) → invalid. Day-only → resolveDayOnly. */
  resolve(text: string, now: Date, calendar: Calendar): ScheduleInputResult;
};
export const WEEKDAY_ABBREVIATIONS: ReadonlySet<string>; // mon tue tues wed weds thu thur thurs fri sat sun
```

### 2.6 `core/scheduleCommit.ts` ← `Services/ScheduleCommit.swift`

```ts
export type ScheduleAction = 'set' | 'preset' | 'cancel' | 'clear';
export type TextRowSubmit = 'setSchedule' | 'saveReminder' | 'none';

export const ScheduleCommit: {
  /** selected wins → (selected, ""); else phrase parses → (date, phrase); else (tomorrow 9:00, phrase or ""). */
  opening(selected: Date | null, initialText: string | null, now: Date, calendar: Calendar): { readonly draft: Date; readonly text: string };
  textRowSubmit(schedulingInNotch: boolean, canSave: boolean): TextRowSubmit;
  /** invalid → null (beep, stay open); date → date; empty → draft. */
  dateToSet(result: ScheduleInputResult, draft: Date): Date | null;
  /** true for set/preset when the section was opened from a non-empty phrase. */
  consumesSuggestion(initialText: string | null, action: ScheduleAction): boolean;
};
```

### 2.7 `core/scheduleDraft.ts` ← `Services/ScheduleDraft.swift`

```ts
export interface ScheduleOutcome {
  readonly date: Date | null;             // null = Clear
  readonly presetPick: PresetPick | null;
  readonly consumesSuggestion: boolean;
}

export class ScheduleDraft {
  constructor(args: { selected: Date | null; initialText: string | null; calendar: Calendar; clock: Clock });
  readonly initialText: string | null;
  get draft(): Date;
  get text(): string;
  set text(value: string);                 // reparses on change; a date moves `draft`
  get parsed(): ScheduleInputResult;
  get committed(): boolean;
  get now(): Date;                         // clock()
  get isInvalid(): boolean;
  get textIsDate(): boolean;
  /** Observable: the UI re-renders on any change (store subscription or useSyncExternalStore). */
  subscribe(listener: () => void): () => void;

  setFromControls(date: Date): void;       // draft = date; text = ""
  pick(day: Date): void;                   // compose(day, draft)
  setTime(hour: number, minute?: number): void;
  applyTypedTime(typed: string): boolean;  // false = not a time, draft unchanged
  stepTime(steps: number): void;           // snap to 15-min grid then step; wraps in the day
  moveDay(days: number): boolean;          // MonthGrid.moving; false = blocked (beep)
  moveInto(month: Date): void;

  set(): ScheduleOutcome | null;           // re-resolves text at the moment of Set; null = invalid or already committed
  apply(preset: DatePreset): ScheduleOutcome | null;
  clear(): ScheduleOutcome | null;
  highlightedPreset(picked: PresetPick | null): DatePreset | null;
}
```

(VoiceOver `announceAfterPause` is ported as `announce(message: () => string): void` on the UI
side with an `aria-live="polite"` region and the same 400 ms pause; not part of the model.)

### 2.8 `core/monthGrid.ts` ← `Services/MonthGrid.swift`

```ts
export const MonthGrid: {
  readonly weeks: 6;
  readonly cellCount: 42;
  startOfMonth(date: Date, calendar: Calendar): Date;
  /** 42 cells row by row: the day's midnight or null; lead = (weekday(first) − firstWeekday + 7) % 7. */
  cells(month: Date, calendar: Calendar): ReadonlyArray<Date | null>;
  /** Very short standalone weekday symbols in grid order (en-US "S M T W T F S" from Sunday; cs-CZ "P Ú S Č P S N" from Monday). */
  weekdaySymbols(calendar: Calendar): readonly string[];
  fullWeekdaySymbols(calendar: Calendar): readonly string[];
  shiftMonth(month: Date, months: number, calendar: Calendar): Date;
  /** ±days from `day`, never before startOfDay(earliest); keeps the time of day. */
  moving(day: Date, days: number, earliest: Date, calendar: Calendar): Date;
  isSelectable(day: Date, now: Date, calendar: Calendar): boolean;
  canGoBack(month: Date, now: Date, calendar: Calendar): boolean;
};
```

### 2.9 `core/accentContrast.ts` ← `Services/AccentContrast.swift`

```ts
export const AccentContrast: {
  readonly minimumTextContrast: 3.0;
  relativeLuminance(red: number, green: number, blue: number): number;   // sRGB 0…1, WCAG formula
  contrastRatio(a: number, b: number): number;                            // (max+0.05)/(min+0.05)
  prefersDarkLabel(red: number, green: number, blue: number): boolean;    // white < 3:1 and black contrasts more
  /** "#RRGGBB" fill → "#FFFFFF" | "#000000". Unparseable → white. */
  label(fillHex: string): '#FFFFFF' | '#000000';
};
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null; // 0…1 components
```

Pinned outcomes (AccentContrastTests): blue `#0A84FF`, purple `#BF5AF2`, pink `#FF375F` → white;
orange `#FF9F0A`, green `#30D158`, yellow → black.

### 2.10 `core/suggestionDateFormatter.ts` ← `Views/SuggestionDateFormatter.swift`

```ts
/** Apple localized templates the app uses; each maps to fixed Intl.DateTimeFormat options. */
export type DateTemplate = 'j:mm' | 'EEE' | 'EEEE' | 'd MMM' | 'EEEE d MMMM' | 'EEE d MMM' | 'LLLL y' | 'MMMM y';

export class SuggestionDateFormatter {
  constructor(args: { locale: string; calendar: Calendar; hour12?: boolean }); // hour12 default: locale's (en-US true, cs-CZ false)
  /** Suggestion / date chip: relative day + ", " + time. en-US: "Today, 2:00 PM", "Tomorrow, 2:00 PM", "Oct 31, 2026, 2:00 PM"; hasTime false drops ", time". */
  string(date: Date, hasTime: boolean, now: Date): string;
  /** `j:mm`: "2:00 PM" (en-US, U+202F before AM/PM like Foundation) / "14:00" (cs-CZ). Time chips, time field. */
  time(date: Date): string;
  /** time(date) today; `EEE` + " " + time next six days ("Sat 9:00 AM"); `d MMM` + " " + time from a week out ("Nov 1 9:00 AM"). */
  presetDetail(date: Date, now: Date, spoken?: boolean): string;
  /** `EEEE d MMMM` + " " + time: "Saturday, October 24 2:00 PM" / "sobota 24. října 14:00". */
  dayAndTime(date: Date): string;
  format(date: Date, template: DateTemplate): string;
}

/** Port of RelativeDateTimeFormatter(unitsStyle .abbreviated, dateTimeStyle .numeric) for the preview line.
 *  Largest unit with |value| ≥ 1 of year/month/week/day/hour/minute; en-US "in 28 hr.", "in 2 days", "3 hr. ago"; cs-CZ "za 28 h", "před 3 h". */
export const RelativeDistance: { string(from: Date, to: Date, locale: string): string };
```

Decision recorded: `string(_:hasTime:)` in Swift delegates to `doesRelativeDateFormatting`, whose
exact en_US glue differs between macOS versions; the site pins the SPEC §1 wording
("Tomorrow, 2:00 PM"), and the formatter test pins it. Relative day words: "Today", "Tomorrow"
(en-US); "dnes", "zítra" (cs-CZ); other days use the medium date (`Oct 31, 2026` / `31. 10. 2026`).

### 2.11 `core/scheduleText.ts` ← `Views/ScheduleText.swift`

```ts
export const ScheduleText: {
  readonly chipHours: readonly [9, 12, 15, 19];
  readonly placeholder: 'fri 2pm, zítra 14:00, +2h';
  invalidExample(locale: string): 'zítra 14:00' | 'tomorrow 2pm';   // "cs" → Czech
  readonly notADate: (example: string) => string;                    // `Not a date — try “${example}”`
  readonly inThePast: 'In the past';
};
```

### 2.12 `core/lists.ts` (stand-in for `RemindersService.calendars`)

```ts
export type ListId = 'reminders' | 'work' | 'home' | 'groceries' | 'ideas';
export interface ReminderList { readonly id: ListId; readonly title: string; readonly color: string /* #RRGGBB */ }
/** iOS dark system colours, in picker order. */
export const FAKE_LISTS: readonly ReminderList[] = [
  { id: 'reminders', title: 'Reminders', color: '#0A84FF' },
  { id: 'work',      title: 'Work',      color: '#BF5AF2' },
  { id: 'home',      title: 'Home',      color: '#FF9F0A' },
  { id: 'groceries', title: 'Groceries', color: '#30D158' },
  { id: 'ideas',     title: 'Ideas',     color: '#FF375F' },
];
export const DEFAULT_LIST_ID: ListId = 'reminders';
export function listById(id: ListId): ReminderList;
export function accentFor(id: ListId): string;   // list colour; Theme.accent (#0A84FF) if unknown
```

### 2.13 `core/reminder.ts` (port of `RemindersService.save` + `buildNotes`, without EventKit)

```ts
export interface ReminderDraft {
  readonly title: string;          // trimmed, non-empty
  readonly notes: string;
  readonly listId: ListId;
  readonly dueDate: Date | null;
  readonly flagged: boolean;       // stored as "High priority" in the app; shown as a flag here
  readonly location: string | null;
}
/** "notes\n📍 location" / "📍 location" / notes / null — RemindersService.buildNotes. */
export function buildNotes(notes: string, location: string | null): string | null;

export interface SavedReminder {
  readonly id: string;             // crypto.randomUUID()
  readonly title: string;
  readonly notes: string | null;   // buildNotes()
  readonly listId: ListId;
  readonly listColor: string;
  readonly dueDate: Date | null;
  readonly dueLabel: string | null; // SuggestionDateFormatter.string(date, true, now)
  readonly flagged: boolean;
  readonly savedAt: Date;
}
export function toSavedReminder(draft: ReminderDraft, now: Date, formatter: SuggestionDateFormatter): SavedReminder;
```

### 2.14 `machine/notchMachine.ts` ← `Panel/NotchMachine.swift`

```ts
export type NotchPhase =
  | { readonly type: 'closed'; readonly parked: boolean }
  | { readonly type: 'open' }
  | { readonly type: 'saving' }
  | { readonly type: 'closing' };

export type ScheduleExpansion = 'none' | 'controls' | 'calendar';
/** Esc steps back one level: calendar → controls → none. */
export function afterEscape(s: ScheduleExpansion): ScheduleExpansion;

export type NotchEvent =
  | { type: 'show' }
  | { type: 'hide' }
  | { type: 'save'; reduceMotion: boolean }
  | { type: 'saveHoldElapsed' }
  | { type: 'closeTimerFired'; hasNotch: boolean }
  | { type: 'settleTimerFired'; generation: number }
  | { type: 'hoverEntered' }
  | { type: 'hoverExited' }
  | { type: 'hoverDwellElapsed'; reduceMotion: boolean }
  | { type: 'screenChanged'; hasNotch: boolean }
  | { type: 'notchTapped' }
  | { type: 'scheduleChanged'; expansion: ScheduleExpansion };

export type NotchEffect =
  | { type: 'configureGeometry' }
  | { type: 'switchToOpenCanvas' }
  | { type: 'relayoutOpenWindow' }
  | { type: 'makeKeyAndOrderFront' }
  | { type: 'park' }
  | { type: 'orderOut' }
  | { type: 'setIgnoresMouse'; ignores: boolean }
  | { type: 'resignFirstResponder' }
  | { type: 'installLocalMonitor' }
  | { type: 'removeLocalMonitor' }
  | { type: 'postWillShow' }
  | { type: 'postDidHide' }
  | { type: 'animateOpen'; fromSaved: boolean }
  | { type: 'animateClose' }
  | { type: 'animateSaving' }
  | { type: 'clearBadgeNoAnimation' }
  | { type: 'setSettled'; settled: boolean }
  | { type: 'swellHover' }
  | { type: 'unswellHover' }
  | { type: 'haptic' }
  | { type: 'animateSchedule'; expansion: ScheduleExpansion }
  | { type: 'growCanvasForSchedule' }
  | { type: 'fitCanvasToPanel' }
  | { type: 'scheduleClose' }
  | { type: 'cancelClose' }
  | { type: 'scheduleSaveHold' }
  | { type: 'cancelSaveHold' }
  | { type: 'scheduleSettle'; generation: number }
  | { type: 'scheduleFocusRetries' }
  | { type: 'scheduleHoverDwell' }
  | { type: 'cancelHoverDwell' };

export interface NotchMachineSnapshot {
  readonly phase: NotchPhase;
  readonly badgeShown: boolean;
  readonly hoverSwollen: boolean;
  readonly hoverArmed: boolean;
  readonly hoverDwellPending: boolean;
  readonly generation: number;     // wraps at 2^32 like UInt (&+= 1)
  readonly schedule: ScheduleExpansion;
  readonly canvasGrown: boolean;
}

/** Mutable reducer, 1:1 with the Swift struct so NotchMachineTests port line by line. */
export class NotchMachine implements NotchMachineSnapshot {
  readonly phase: NotchPhase;            // initial { type: 'closed', parked: false }
  readonly badgeShown: boolean;          // false
  readonly hoverSwollen: boolean;        // false
  readonly hoverArmed: boolean;          // true
  readonly hoverDwellPending: boolean;   // false
  readonly generation: number;           // 0
  readonly schedule: ScheduleExpansion;  // 'none'
  readonly canvasGrown: boolean;         // false
  get isVisible(): boolean;              // open || saving
  /** Mutates and returns the effects in order. `pointerOnNotch` is consulted only when parking. */
  handle(event: NotchEvent, pointerOnNotch?: boolean): NotchEffect[];
  snapshot(): NotchMachineSnapshot;
  equals(other: NotchMachineSnapshot): boolean;   // Hashable `==` for the "no-op leaves the machine unchanged" tests
  clone(): NotchMachine;
}
export function phaseEquals(a: NotchPhase, b: NotchPhase): boolean;
```

Effect orders pinned by the Swift tests and therefore by the port (copy them, do not re-derive):

- `show` from closed: `[cancelHoverDwell?] clearBadgeNoAnimation, configureGeometry, switchToOpenCanvas, setIgnoresMouse(false), makeKeyAndOrderFront, installLocalMonitor, postWillShow, animateOpen(fromSaved:false), scheduleSettle(g), scheduleFocusRetries`.
- `save` (no reduce motion, open): `[setSettled(false), animateSaving, setIgnoresMouse(true), resignFirstResponder, scheduleSaveHold]`.
- `close`: `[cancelSaveHold?] postDidHide, removeLocalMonitor, resignFirstResponder, setIgnoresMouse(true), setSettled(false), animateClose, scheduleClose`.
- `closeTimerFired(true)` from closing: `[clearBadgeNoAnimation, park]`.
- `scheduleChanged(controls)` first time: `[setSettled(false), growCanvasForSchedule, animateSchedule(controls), scheduleSettle(g+1)]`; a later `calendar`: `[setSettled(false), animateSchedule(calendar), scheduleSettle(g)]`.
- `settleTimerFired(g)` with schedule none and canvasGrown: `[setSettled(true), fitCanvasToPanel]`, else `[setSettled(true)]`.
- `show` while open with schedule ≠ none: `changeSchedule(none)`; while open and plain: `[]`.

### 2.15 `machine/notchLayout.ts` ← `Notch/NotchState.swift` (`NotchLayout`) + `Views/Theme.swift`

See §5 for the full constant table. Exports:

```ts
export interface Size { readonly width: number; readonly height: number }
export const NotchLayout: { /* every constant and function of §5 */ };
export const ScheduleMetrics: { /* §5.3 */ };
export const Theme: { /* §5.4 metrics; colours live in tokens.css and §6.2 */ };
```

### 2.16 `machine/notchState.ts` ← `Notch/NotchState.swift` (`NotchState`, as pure derivation)

```ts
export interface NotchFlags {
  readonly isOpen: boolean;
  readonly contentVisible: boolean;
  readonly isSettled: boolean;
  readonly isSaving: boolean;
  readonly savedBadgeShown: boolean;
  readonly isHovering: boolean;
  readonly schedule: ScheduleExpansion;
}
export interface NotchSizes {
  readonly closedSize: Size;            // { 235, 39 } on the fake 14" screen (NotchGeometry.closedShapeSize)
  readonly openSize: Size;              // { 600, 241 }
  readonly scheduleSize: Size;          // { 600, 431 }
  readonly scheduleCalendarSize: Size;  // { 600, 663 }
}
export const INITIAL_FLAGS: NotchFlags;
export function sizesFor(notch: Size, screenHeight: number, dockHeight?: number): NotchSizes; // configureGeometry
export function notchBandHeight(s: NotchSizes): number;                 // closedSize.height = 39
export function panelSize(s: NotchSizes, schedule: ScheduleExpansion): Size;
/** saving → savedSize; open → panelSize; hovering → hoverSize; else closedSize (NotchStateTests.currentSizePrecedence). */
export function currentSize(f: NotchFlags, s: NotchSizes): Size;
export function hoverSize(s: NotchSizes): Size;        // closed + hoverGrowth
export function closedCanvasSize(s: NotchSizes): Size; // hover + closedCanvasMargin
export function savedSize(s: NotchSizes): Size;        // closed.width + 2·72, closed.height
export function radii(f: NotchFlags): { top: number; bottom: number }; // open ? (19, 32) : (6, 14)
```

### 2.17 `machine/notchShape.ts` ← `Notch/NotchShape.swift`

```ts
export const NotchRadius: { readonly closedTop: 6; readonly closedBottom: 14; readonly openTop: 19; readonly openBottom: 32 };
/** SVG path (`d`) of the silhouette filling (0,0,width,height): flat top, two outward (concave)
 *  quadratic top fillets, straight sides, convex quadratic bottom corners; same clamping as Swift. */
export function notchPath(width: number, height: number, topCornerRadius: number, bottomCornerRadius: number): string;
/** Same path as an array of 4 Q + 4 L commands with numeric coordinates, for motion's path interpolation (equal command count across states). */
export function notchPathSegments(width: number, height: number, topCornerRadius: number, bottomCornerRadius: number): readonly PathSegment[];
export type PathSegment = { readonly cmd: 'M' | 'L' | 'Q'; readonly args: readonly number[] };
export function widthForNotch(notchWidth: number, topCornerRadius?: number): number;  // notchWidth + 2·top (221 → 233)
/** Point-in-silhouette, top-down coordinates, shape centred in `canvasWidth` and hanging from y = 0. */
export function contains(point: { x: number; y: number }, canvasWidth: number, shapeSize: Size, topCornerRadius: number, bottomCornerRadius: number): boolean;
export const NotchGeometry: {
  readonly fallbackSize: Size;                 // { 200, 32 }
  /** Real notch + 2·top fillets + 2 bleed wide, notch.height + 1 tall. */
  closedShapeSize(notch: Size, topCornerRadius: number): Size;
};
```

### 2.18 `machine/springs.ts`

See §7.

---

## 3. Imperative recreation API

### 3.1 `RecreationState` (observable, `recreation/store.ts`)

```ts
export interface RecreationState {
  // Panel (NotchMachine + NotchFlags)
  readonly phase: NotchPhase;
  readonly schedule: ScheduleExpansion;
  readonly contentVisible: boolean;
  readonly settled: boolean;
  readonly hoverSwollen: boolean;
  readonly badgeShown: boolean;

  // Draft (QuickReminderView @State)
  readonly title: string;
  readonly notes: string;
  readonly listId: ListId;
  readonly flagged: boolean;
  readonly location: string | null;            // "" never stored; null = none
  readonly dueDate: Date | null;
  readonly presetPick: PresetPick | null;
  readonly suggestion: DateSuggestion | null;  // live, undismissed, only while dueDate == null
  readonly dismissedSuggestionText: string | null;
  readonly listPickerOpen: boolean;
  readonly locationPopoverOpen: boolean;
  readonly saveError: string | null;           // never set on the site (no EventKit); kept for 1:1 slot rendering

  // Demo bookkeeping
  readonly savedItems: readonly SavedReminder[];
  /** The visitor changed the draft since the last `markClean()` (landing spec §11.2). Set by every
   *  user-originated mutation; never by handle calls. */
  readonly dirty: boolean;
  readonly openedOnce: boolean;                // hint fades after the first open

  // Derived (computed in selectors, included for convenience)
  readonly canSave: boolean;                   // title.trim() !== ''
  readonly accent: string;                     // accentFor(listId)
  readonly schedulingInNotch: boolean;         // schedule !== 'none'
}
```

### 3.2 `RecreationHandle` (`recreation/Recreation.tsx`, exposed via `useImperativeHandle`)

Every method is synchronous in effect (state changes at once) and returns a Promise only where
the caller needs to wait for the choreography. All Promises reject with `DOMException('AbortError')`
when `cancel()` runs; they honour the global motion time scale (`?debug=motion`). Methods never
throw for an out-of-phase call; they are no-ops exactly where the Swift machine returns `[]`.

```ts
export type ShowSource = 'click' | 'hotkey' | 'scroll' | 'api';

export interface RecreationHandle {
  // Panel
  /** NotchEvent show (notchTapped for 'click'). Focus moves to the title only for 'click' | 'hotkey' or
   *  `focus: true`; 'scroll' never focuses (landing spec §5.3). Resolves after the settle timer (0.5 s). */
  show(opts?: { source?: ShowSource; focus?: boolean }): Promise<void>;
  /** NotchEvent hide. Resolves after closeDuration (0.36 s). */
  hide(): Promise<void>;
  /** Esc semantics, layered: calendar → controls → popovers → panel. Returns what it closed. */
  escape(): 'calendar' | 'section' | 'popover' | 'panel' | 'none';
  /** ⌘↩ / ↩ / ✓. While the section is open it means Set (commitSchedule) and resolves null.
   *  Otherwise: auto-applies an undismissed suggestion, builds the SavedReminder, dispatches save,
   *  appends to savedItems when the badge has landed (0.32 s), resolves after hold + close
   *  (1.0 + 0.36 s). null when !canSave. */
  save(): Promise<SavedReminder | null>;

  // Title / notes
  setTitle(text: string): void;                                   // instant; re-parses the suggestion
  /** Types character by character at `cps` (default 18, landing spec §7 (02)) through the same path as
   *  keyboard input (suggestion updates per char). `append` false (default) replaces the title first. */
  typeTitle(text: string, cps?: number, opts?: { append?: boolean }): Promise<void>;
  setNotes(text: string): void;
  focusTitle(): void;
  focusNotes(): void;

  // Suggestion chip
  applySuggestion(): boolean;      // Tab / chip click: dueDate = resolved, phrase stripped; false when none
  dismissSuggestion(): void;       // ⓧ on the chip

  // Set Date (in notch)
  openSchedule(): void;            // ⌘D / calendar icon / date chip → scheduleChanged(controls); no-op when already open
  openCalendar(): void;            // ⌘K: opens the section if needed, then 'calendar'
  closeCalendar(): void;           // 'calendar' → 'controls'
  toggleCalendar(): void;
  cancelSchedule(): void;          // Cancel / click above the section → 'none', nothing written
  /** Set / ↩ / ⌘↩: ScheduleDraft.set(); false = invalid text (beep, stays open). */
  commitSchedule(): boolean;
  applyPreset(preset: DatePreset): void;   // ⌘1…⌘6 / card: commits and closes the section
  clearDueDate(): void;                    // Clear button / date-chip ⓧ
  setDueDate(date: Date | null, presetPick?: PresetPick | null): void;  // instant, no section (reconciler)
  typeScheduleText(text: string, cps?: number): Promise<void>;         // into the Set Date type field
  setScheduleText(text: string): void;
  pickDay(day: Date): void;
  setTime(hour: number, minute?: number): void;
  pageMonth(delta: -1 | 1): void;
  moveDay(days: -7 | -1 | 1 | 7): void;
  /** Read-only access to the live draft while the section is open (null otherwise). */
  scheduleDraft(): ScheduleDraft | null;

  // List picker
  openListPicker(): void;
  closeListPicker(): void;
  setList(id: ListId): void;       // closes the picker; accent follows

  // Flag / location
  toggleFlag(): void;
  setFlag(flagged: boolean): void;
  openLocationPopover(): void;
  closeLocationPopover(): void;
  setLocation(text: string | null): void;   // "" → null; icon switches to the filled pin when non-null
  typeLocation(text: string, cps?: number): Promise<void>;   // opens the popover, types, closes it (Done)

  // Hover (closed notch)
  hoverNotch(entered: boolean): void;       // hoverEntered / hoverExited; the runtime handles the 90 ms dwell

  // Fake cursor (delegates to the FakeCursorHandle passed in props; no-ops when none)
  setPointer(x: number, y: number, opts?: { duration?: number }): Promise<void>;   // scene points (1512 × 982 space)
  /** Centre of a named control in scene points, or null when not rendered in the current state. */
  pointFor(target: PointerTarget): ScenePoint | null;
  pointerTo(target: PointerTarget, opts?: { duration?: number; click?: boolean }): Promise<boolean>;

  // Observation / control
  getState(): RecreationState;
  subscribe(listener: (state: RecreationState) => void): () => void;
  /** Clears `dirty` (the reconciler calls it after its own changes). */
  markClean(): void;
  /** Aborts typeTitle / typeScheduleText / typeLocation / pointer moves; resolves their Promises with AbortError. */
  cancel(): void;
  /** Back to the initial state (closed, empty draft, default list, savedItems kept unless `keepSaved: false`). */
  reset(opts?: { keepSaved?: boolean }): void;
  /** Convenience for tests: the machine snapshot. */
  machine(): NotchMachineSnapshot;
}

export type PointerTarget =
  | 'notch' | 'close' | 'header' | 'title' | 'notes' | 'suggestionChip' | 'suggestionDismiss' | 'dateChip'
  | 'calendarIcon' | 'locationIcon' | 'flagIcon' | 'save'
  | `list:${ListId}` | 'locationField' | 'locationDone'
  | `preset:${DatePreset}` | 'scheduleField' | 'dayButton' | 'timeField' | `timeChip:${9 | 12 | 15 | 19}`
  | 'calendarPrev' | 'calendarNext' | `day:${number}` /* day of month in the visible grid */
  | 'clear' | 'cancel' | 'set';

export interface ScenePoint { readonly x: number; readonly y: number }   // scene points, origin top-left of the 1512 × 982 screen
```

### 3.3 `RecreationProps` (`recreation/Recreation.tsx`)

```ts
export interface RecreationProps {
  /** Notch geometry of the hosting screen (desktop passes { width: 221, height: 38 }). */
  notch: Size;
  /** Fake screen height in points (982) and Dock height (0): NotchLayout.maxPanelHeight. */
  screenHeight: number;
  dockHeight?: number;
  clock?: Clock;                     // default AppClock.now
  calendar?: Calendar;               // default currentCalendar()
  locale?: string;                   // formatter locale, default "en-US"
  hour12?: boolean;                  // default: locale's
  reduceMotion?: boolean;            // default: prefers-reduced-motion
  cursor?: RefObject<FakeCursorHandle | null>;
  /** Called with the SavedReminder when the ✓ lands (0.32 s into the saved choreography). */
  onSaved?(item: SavedReminder): void;
  onStateChange?(state: RecreationState): void;
  /** Keyboard shortcuts are handled by the recreation only when true (focus inside the desktop, landing spec §11.3). */
  shortcutsEnabled: boolean;
  /** Scene → CSS scale, so pointer targets can be reported in scene points regardless of `--pt`. */
  sceneScale: number;
  /** Where the notch's top-centre sits in scene points (desktop passes { x: 756, y: 0 }). */
  notchOrigin: ScenePoint;
}
```

### 3.4 `NotchRuntime` (`recreation/runtime.ts`, port of `PanelController`)

```ts
export interface NotchRuntimeHost {
  setFlags(patch: Partial<NotchFlags>, animation: 'open' | 'close' | 'saving' | 'schedule' | 'hoverIn' | 'hoverOut' | 'none'): void;
  focusTitle(): void;               // scheduleFocusRetries at 0.12 s and 0.30 s, skipped while schedule !== 'none' or a text row is active
  blurAll(): void;                  // resignFirstResponder
  setIgnoresMouse(ignores: boolean): void;   // pointer-events on the content
  haptic(): void;                   // no-op on the web (documented)
  willShow(): void;                 // resetState() in the store
  didHide(): void;                  // close popovers
}
export class NotchRuntime {
  constructor(host: NotchRuntimeHost, opts: { reduceMotion: () => boolean; timeScale: () => number; hasNotch: () => boolean; pointerOnNotch: () => boolean });
  dispatch(event: NotchEvent): void;                       // queued like PanelController.dispatch (no re-entrancy)
  get machine(): NotchMachineSnapshot;
  destroy(): void;                                         // clears every timer
}
/** Timer durations (seconds) the runtime uses, from NotchLayout: closeDuration 0.36, savedHold 1.0, settle 0.5, hoverDwell 0.09, focusRetries [0.12, 0.30]. */
export const RUNTIME_TIMERS: { readonly close: 0.36; readonly savedHold: 1.0; readonly settle: 0.5; readonly hoverDwell: 0.09; readonly focusRetries: readonly [0.12, 0.30] };
```

---

## 4. Desktop / page contracts

### 4.1 `DesktopScene` (`desktop/DesktopScene.tsx`)

```ts
export const SCENE: { readonly width: 1512; readonly height: 982; readonly menuBarHeight: 38; readonly notch: Size /* 221 × 38 */; readonly notchOrigin: ScenePoint /* { 756, 0 } */ };

export interface DesktopSceneProps {
  recreationRef: RefObject<RecreationHandle | null>;
  cursorRef?: RefObject<FakeCursorHandle | null>;
  /** CSS px per scene point (the Stage computes it; sets `--pt` on the scene root). */
  pt: number;
  colorScheme?: 'light' | 'dark' | 'auto';   // wallpaper + menu bar; default 'auto'
  clock?: Clock;
  calendar?: Calendar;
  locale?: string;
  reduceMotion?: boolean;
  /** Hint under the notch: shown until the panel has opened once (state.openedOnce). */
  hintEnabled?: boolean;                     // default true
  onSaved?(item: SavedReminder): void;
  className?: string;
}
```

Behaviour contract: the root is `tabIndex={-1}`, `role="application"`, `aria-label="QuickReminder demo desktop"`;
a `pointerdown` anywhere inside focuses it; while it has focus (or focus is inside it) `keydown` goes
through `desktopShortcuts.shortcutFor()` and the matched action calls the handle and `preventDefault()`s.
The hint fades (0.4 s) when `openedOnce` becomes true. The Reminders window mounts on the first
`savedItems` entry and slides in from the right (motion spring `chip`, 0.3/0.8) 0.2 s after the ✓ lands.

### 4.2 `SavedReminder`

Defined in §2.13 (`core/reminder.ts`); the window renders `title`, a 10 pt dot in `listColor`,
`dueLabel`, a flag glyph when `flagged`, and `notes` (including the `📍 …` line) as a second line.

### 4.3 `desktopShortcuts.ts`

```ts
export type FocusTarget = 'none' | 'title' | 'notes' | 'scheduleField' | 'timeField' | 'calendar' | 'locationField';
export type ShortcutAction =
  | { type: 'show'; source: 'hotkey' }          // ⇧⌘R (best effort)
  | { type: 'escape' }                          // Esc, layered
  | { type: 'submit' }                          // ↩ in a text row (Set while scheduling, else save), ⌘↩ anywhere
  | { type: 'tab' }                             // Tab in the title: apply suggestion, else default focus move
  | { type: 'openSchedule' }                    // ⌘D
  | { type: 'toggleCalendar' }                  // ⌘K (section open)
  | { type: 'preset'; preset: DatePreset }      // ⌘1…⌘6 (section open)
  | { type: 'stepTime'; steps: 1 | -1 }         // ↑/↓ in the time field
  | { type: 'moveDay'; days: -7 | -1 | 1 | 7 }  // arrows in the focused grid
  | { type: 'applyTypedTime' };                 // ↩ in the time field (keeps the section open)
export function shortcutFor(e: Pick<KeyboardEvent, 'key' | 'code' | 'metaKey' | 'shiftKey' | 'altKey' | 'ctrlKey'>, ctx: { state: RecreationState; focus: FocusTarget }): ShortcutAction | null;
```

### 4.4 Scroll choreography (`app/choreography/*`, landing spec §11.2)

```ts
export type SectionId = 'hero' | '01' | '02' | '03' | '04' | '05' | '06' | '07';
export type SectionAction = 'none' | 'close' | 'open' | 'typeTitle' | 'schedule' | 'lists' | 'flagLocation' | 'save';

/** Due date relative to `now`, resolved by resolveDue(). */
export type DueSpec =
  | null
  | { readonly type: 'phrase'; readonly text: string }        // NaturalDateParser on the phrase, day-only → resolveDayOnly
  | { readonly type: 'preset'; readonly preset: DatePreset };

export interface SectionSnapshot {
  readonly id: SectionId;
  readonly panel: 'closed' | 'open';
  readonly schedule: ScheduleExpansion;
  readonly title: string;            // final title (phrase already stripped when `due` is a phrase and applied)
  readonly typedTitle?: string;      // what typeTitle types in 02 ("Call mum tomorrow at 2pm")
  readonly notes: string;
  readonly listId: ListId;
  readonly flagged: boolean;
  readonly location: string | null;
  readonly due: DueSpec;
  readonly saved: boolean;           // 06: the item is in the window and the panel closed again
  /** The one delta this section animates; everything else is set instantly. */
  readonly action: SectionAction;
  readonly highlightPreset?: DatePreset;     // 03: 'tomorrow'
  readonly listCycle?: readonly ListId[];    // 04: ['reminders', 'work', 'home'] — ends on the last
  readonly applyDelayMs?: number;            // 02: 900 (chip shows, then Tab animation)
}

export const DEMO_REMINDER: {
  readonly typed: 'Call mum tomorrow at 2pm';
  readonly title: 'Call mum';
  readonly phrase: 'tomorrow at 2pm';
  readonly czechExample: 'zavolat mámě zítra ve 14:00';
  readonly listId: 'work';
  readonly location: 'Office';
  readonly flagged: true;
};
export const SECTION_SNAPSHOTS: Readonly<Record<SectionId, SectionSnapshot>>;
export function resolveDue(spec: DueSpec, now: Date, calendar: Calendar): { date: Date; presetPick: PresetPick | null } | null;

export interface ReconcileOptions {
  readonly now: Date;
  readonly calendar: Calendar;
  readonly direction: 'down' | 'up';     // scrolling back up: hero closes the panel, other sections leave content alone
  readonly signal: AbortSignal;          // the driver aborts a running action when the next section wins after maxDurationMs
  readonly cursor?: FakeCursorHandle | null;
  readonly maxDurationMs?: number;       // default 2500
  readonly cps?: number;                 // default 18
}
export interface ReconcileResult {
  readonly performed: SectionAction;
  readonly keptVisitorEdits: boolean;    // dirty was true: title/notes/list/flag/location left alone
  readonly aborted: boolean;
}
/** Moves the recreation from handle.getState() to `snapshot`: instant for every field except the
 *  snapshot's `action`, which plays through the handle (and the cursor when given). Rules
 *  (landing spec §11.2): dirty → keep the visitor's draft fields and perform only the action;
 *  direction 'up' → only 'close' is performed (hero), everything else is a no-op; calls
 *  handle.markClean() after its own writes; never focuses (show source 'scroll'). */
export function reconcile(handle: RecreationHandle, snapshot: SectionSnapshot, opts: ReconcileOptions): Promise<ReconcileResult>;

/** Hook for Features.tsx: registers one ScrollTrigger per section (start "top center", onEnter →
 *  reconcile(down), onLeaveBack → reconcile(up) for the previous snapshot), one action at a time,
 *  the running one allowed to finish up to maxDurationMs before the next starts. Pauses scroll-driven
 *  changes for the current section once the visitor interacts (dirty) until the next section enters. */
export function useSectionDriver(args: { handle: RefObject<RecreationHandle | null>; cursor: RefObject<FakeCursorHandle | null>; clock: Clock; calendar: Calendar; enabled: boolean }): {
  register(id: SectionId, el: HTMLElement | null): void;
  current: SectionId;
};
```

### 4.5 Fake cursor (`desktop/fakeCursor.ts`)

```ts
export interface FakeCursorHandle {
  moveTo(point: ScenePoint, opts?: { durationMs?: number }): Promise<void>;   // default duration = clamp(distance / 1.6 px·ms⁻¹, 220, 700) ms, easeInOut
  click(): Promise<void>;                 // 0.94× press for 80 ms then release; purely visual, never dispatches DOM events
  show(): void;
  hide(): void;                           // fades 0.25 s; auto-hides 1.2 s after the last move unless `pin`
  pin(pinned: boolean): void;
  position(): ScenePoint;
  cancel(): void;
}
export const CURSOR_HOME: ScenePoint;     // where it rests: { x: 1180, y: 640 } (lower right of the screen, clear of the panel)
```

### 4.6 Stage camera (`app/stageCamera.ts`, landing spec §11.1)

```ts
export interface Viewport { readonly width: number; readonly height: number }
export interface Camera { readonly scale: number; readonly originX: number; readonly originY: number; readonly translateX: number; readonly translateY: number; readonly frameOpacity: number; readonly pageReveal: number }
/** progress 0 = hero (scene letterboxed to the viewport, frame hidden), 1 = features (1 CSS px per pt,
 *  clamped to the pinned column and never below 0.75, origin = notch top-centre, frame drawn). */
export function cameraFor(progress: number, viewport: Viewport, pinnedColumnWidth: number): Camera;
export function heroPt(viewport: Viewport): number;                               // min(w / 1512, h / 982)
export function featuresPt(pinnedColumnWidth: number): number;                    // clamp(pinnedColumnWidth / 600 · …, 0.75, 1) — see part 05
```

---

## 5. Layout metrics (`machine/notchLayout.ts`), exact values

### 5.1 `NotchLayout` (from `NotchState.swift` `enum NotchLayout`, `NotchShape.Radius`, `NotchGeometry`)

| Export | Value | Swift |
|---|---|---|
| `baseOpenWidth` | 600 | `NotchLayout.baseOpenWidth` |
| `defaultNotchBandHeight` | 39 | `defaultNotchBandHeight` (38 + 1 bleed) |
| `textScale` | 1 (fixed) | landing spec §5.2 |
| `horizontalPadding` | 20 | `Theme.horizontalPadding` |
| `contentInsetX` | 39 | `Theme.horizontalPadding + NotchLayout.openTopRadius` (QuickReminderView `.padding(.horizontal, …)`) |
| `closedTopRadius` / `closedBottomRadius` | 6 / 14 | `NotchShape.Radius` |
| `openTopRadius` / `openBottomRadius` | 19 / 32 | `NotchShape.Radius` |
| `overshootPadding` | 24 | |
| `scheduleScreenMargin` | 40 | `overshootPadding + 16` |
| `savedExtension` | 72 | |
| `savedBadgeSize` | 24 | |
| `savedBadgeTrailingPadding` | 30 | `closedTopRadius + (savedExtension − savedBadgeSize) / 2` (NotchContainerView) |
| `savedHold` | 1.0 s | |
| `hoverGrowth` | `{ width: 22, height: 5 }` | |
| `hoverDwell` | 0.09 s | |
| `closedCanvasMargin` | `{ width: 16, height: 8 }` | |
| `closeDuration` | 0.36 s | |
| `settleDelay` | 0.5 s | PanelController `.scheduleSettle` |
| `focusRetryDelays` | `[0.12, 0.30]` s | PanelController `.scheduleFocusRetries` |
| `titleLineHeight` / `notesLineHeight` | 23 / 18 | `PlainTextView.lineHeight(for: 19)` / `(for: 15)` (NotchStateTests: "(25 + 1 + 20)") |
| `titleRowHeight` / `notesRowHeight` | 25 / 20 | line height + 2 |
| `inputRowSpacing` | 1 | InputView VStack spacing |
| `headerHeight` | 36 | ⓧ hit frame |
| `chipSlotHeight` | 26 | |
| `bottomBarHeight` | 48 | ✓ button |
| `NOTCH` | `{ width: 221, height: 38 }` | 14" MBP (`NotchGeometry.notchRect`) |
| `closedSize` | `{ width: 235, height: 39 }` | `NotchGeometry.closedShapeSize`: 221 + 2·6 + 2, 38 + 1 |
| `openSize` | `{ width: 600, height: 241 }` | 39 + 202 |
| `scheduleControlsSize` | `{ width: 600, height: 431 }` | 39 + 392 |
| `scheduleCalendarSize` | `{ width: 600, height: 663 }` | 39 + 624 |
| `savedSize` | `{ width: 379, height: 39 }` | 235 + 2·72 |
| `hoverSize` | `{ width: 257, height: 44 }` | 235 + 22, 39 + 5 |
| `closedCanvasSize` | `{ width: 273, height: 52 }` | hover + margin |
| `canvasSize(open)` | `{ width: 648, height: 265 }` | open + 2·24 wide, + 24 tall |

Functions (all pure; `s` = textScale, default 1; `sc(v) = Math.round(v · s)` with ties-to-even):

```ts
widthForNotch(notchWidth: number, top = 6): number                              // notchWidth + 2·top
closedShapeSize(notch: Size, top = 6): Size                                     // { widthForNotch + 2, notch.height + 1 }
topContentHeight(s = 1): number                                                 // 8 + sc(36) + 10 + (23+2) + 1 + (18+2) → 100
contentHeight(s = 1): number                                                    // topContentHeight + sc(26) + 8 + sc(48) + 20 → 202
scheduleContentHeight(s = 1, calendar: boolean): number                         // topContentHeight + ScheduleMetrics.sectionHeight + 20 → 392 | 624
openSize(notchBandHeight = 39, schedule: ScheduleExpansion = 'none', maxHeight = Infinity): Size
   // width round(600 · min(1 + (s−1)·0.5, 1.3)) = 600; height band + content; schedule: max(plain, min(natural, floor(maxHeight)))
maxPanelHeight(screenHeight: number, dockHeight: number): number                // screenHeight − dockHeight − 40 (fake screen: 942)
scheduleSectionTop(notchBandHeight = 39, s = 1): number                         // band + topContentHeight → 139
clickCancelsSchedule(y: number, sectionTop: number, schedule: ScheduleExpansion): boolean   // schedule !== 'none' && y < sectionTop
canvasSize(open: Size): Size                                                    // { w + 48, h + 24 }
```

### 5.2 Vertical rhythm of the open panel (SPEC §4), from the top of the shape

| y (pt) | Element |
|---|---|
| 0–39 | notch band (dead zone) |
| 39 + 8 = 47 | header row top (36 tall; "Reminders" 22 bold + chevron; ⓧ 24 in a 36 hit frame) |
| 83 + 10 = 93 | input top: dotted circle 21 (padding-top 2); title row 25; +1; notes row 20 → 139 |
| 139 … | flexible (0 at the plain height) |
| 241 − 20 − 48 − 8 − 26 = 139 | chip slot top (26 tall, content bottom-aligned, leading inset 21 + 10 = 31) |
| 173 | bottom bar top (48 tall: pill 44 centred, ✓ 48) |
| 221–241 | bottom inset 20 |

### 5.3 `ScheduleMetrics` (from `NotchLayout.ScheduleMetrics`)

```ts
export const ScheduleMetrics: {
  topGap: 14; typeField: 36; previewGap: 6; preview: 18; presetsGap: 10; presetRow: 44; presetSpacing: 8;
  dayTimeGap: 12; dayTimeRow: 30; calendarGap: 10; monthHeader: 26; weekdayRow: 18; dayCell: 28; dayRowSpacing: 2;
  footerGap: 14; footer: 36; controlRadius: 12;
  calendarHeight(s = 1): number;                    // 26 + 18 + 6·28 + 5·2 → 222
  sectionHeight(s = 1, calendar: boolean): number;  // 14+36+6+18+10+88+8+12+30 + [10+222] + 14+36 → 272 | 504
};
```

Section rows, from `scheduleSectionTop` = 139: type field 153–189 · preview 195–213 · presets
223–267 / 275–319 · day/time row 331–361 · [calendar 371–593] · footer 375–411 (controls) /
607–643 (calendar) · bottom inset 20 → 431 / 663.

### 5.4 `Theme` metrics (`Views/*.swift`, text scale 1)

| Key | Value | Source |
|---|---|---|
| `header.titleSize/weight` | 22 / 700 | HeaderView |
| `header.chevronSize/weight/gap/offsetY` | 13 / 700 / 7 / 0.5 | HeaderView |
| `close.circle/hit/glyphSize/glyphWeight` | 24 / 36 / 11 / 700 | HeaderView |
| `header.spacerMin` | 12 | |
| `dashedCircle.size/stroke/dash` | 21 / 1.5 / `[0.1, 3.2]` round caps, padding-top 2 | DashedCircle, InputView |
| `input.circleGap` | 10 | InputView HStack spacing |
| `title.size/weight` / `notes.size/weight` | 19 / 400, 15 / 400 | InputView |
| `title.maxLength` / `notes.maxLength` | 2000 / 10000 | PlainTextView |
| `chipSlot.leading` | 31 | `Theme.s(21) + 10` |
| `suggestionChip` | icon 12/500, text 13/500, padding 10×5, capsule fill accent 14 %, gap 6; ⇥ keycap 11/600 white 45 % on white 10 % radius 4 padding 5×1; dismiss ✕ 13 white 40 %, gap 8 | QuickReminderView |
| `dateChip` | icon 12/500, text 13/500, gap 6, ✕ 13 white 50 % | |
| `error` | 12/500, `#FF453A` (1.0, 0.27, 0.23), one line | |
| `pill.height/padX/iconGap` | 44 / 11 / 17 | BottomBar (hit 38 + 17 = 55 centre spacing) |
| `pill.iconSize/hitSize` | 18 / 38 | |
| `pill.fill/stroke` | white 3 % / `#3D3D3F` 1 pt | Theme |
| `bottomBar.spacerMin` | 16 | |
| `save.size/glyphSize/glyphWeight` | 48 / 22 / 600 | |
| `hover.scale/pressScale` | 1.06 / 0.94 | HoverMotion |
| `hover.highlight/pressHighlight` | 0.10 / 0.18 | HoverMotion |
| `notchFill.neutral` | white 6 % / 11 % hover / 15 % pressed; press scale 0.97 | NotchFillButtonStyle |
| `notchFill.selected` | accent 20 % / 27 % / 32 %, stroke accent 80 % 1 pt | |
| `notchFill.prominent` | accent (disabled `#474749`, opacity 0.55) | |
| `notchText` | 13/500, white 60 % / 85 % hover / 95 % pressed, padX 8 | NotchTextButtonStyle |
| `keyHint` | 11/600 white 50 %, white 10 % radius 4, padding 5×1 | KeyHint |
| `typeField` | padX 12, icon 12/500 white 45 %, text 14, placeholder white 50 %, fill white 7 %, stroke white 8 % / accent 70 % focused, radius 12 | ScheduleNotchSection |
| `preview` | 12/500 tabular, padL 12; normal: date white + "· rel" white 60 %; past: ⚠ + "In the past" orange `#FF9E0A` + "· date" white 60 %; invalid white 60 % | |
| `presetCard` | 3 cols, gap 8, padX 10, icon 13/500 accent in 18 wide, title 13/500 white, ⌘n 10/500 white 50 %, detail 11 tabular white 60 %, inner gap 9, min scale 0.75 | |
| `dayButton` | padX 11, icon 12/500 accent, text 13/500 tabular white, chevron 9/700 white 50 % (rotates 180° open), capsule | |
| `timeField` | width 96, padX 10, clock icon 11/500 white 45 %, text 13/500 tabular, capsule white 7 %, focus stroke accent 70 % | |
| `timeChip` | 12/500 tabular, padX 10, selected prominent (label AccentContrast) else white 75 %, gap 4 | |
| `dayTimeRow.gap/spacerMin` | 6 / 6 | |
| `footer` | gap 8; Cancel 13/500 white 85 % padX 16; Set 13/600 tabular padX 18, label AccentContrast (white when invalid), disabled when invalid; Clear only when a date is set | |
| `monthGrid.header` | 13/600 white, padL 4; ‹ › 11/600 white 75 % (20 % disabled) in 26 circles, gap 2 | ScheduleMonthGrid |
| `monthGrid.weekday` | 10/600 white 55 % | |
| `monthGrid.day` | 13 (600 when selected/today, else 400) tabular; selected: accent disc 28, label AccentContrast; today: accent text; past: white 25 % disabled; else white 85 %; hover disc white 9 % / 16 % pressed; focus ring white 85 % 1.5 pt padding −3; grid ring radius 12 white 60 % 1.5 pt padding −4 | |
| `listPicker` (§11.4) | surface black, radius 12, stroke `#3D3D3F` 1 pt, minWidth 200, "Lists" 13/600 white 50 % pad 16/12/6, rows padX 16 padY 8, dot 10, title 15, ✓ 13/600 accent; row fill white 6 % / 11 % / 15 %, selected accent 20 % | ListPickerMenu |
| `locationPopover` (§11.4) | same surface, padding 14, "Location" 13/600, field 220 wide 28 tall (typeField styling), Done = prominent fill | BottomBar.locationPopover |
| `savedBadge` | 24 circle accent; tick stroke 24·0.11 = 2.64 round, padding 24·0.27 = 6.48; path M(0, .55h) L(.38w, .92h) L(w, .12h) | SavedCheckView, CheckmarkShape |
| `font.recreation` | `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Inter, sans-serif`; `font-variant-numeric: tabular-nums` where Swift uses `monospacedDigit()` | landing spec §3 |

---

## 6. Design tokens (`src/tokens.css`)

### 6.1 Page — `--jh-*` (jholec.com, landing spec §8; values verified against `~/Developer/jholec.com/app/globals.css` and `tailwind.config.ts`)

```css
:root {
  /* colour */
  --jh-white: #FFFFFF;
  --jh-black: #0A0A0A;
  --jh-black-light: #121212;
  --jh-gray-light: #EBEBEB;
  --jh-gray-light-90: rgba(235, 235, 235, 0.9);   /* #EBEBEBE6, card variant */
  --jh-gray-medium: #757575;
  --jh-gray: #A8A8A8;
  --jh-gray-dark: #4D4D4D;
  --jh-accent: #0099FF;
  /* semantic (light sections) */
  --jh-bg: var(--jh-white);
  --jh-fg: var(--jh-black);
  --jh-muted: var(--jh-gray-medium);
  --jh-border: var(--jh-gray-light);
  --jh-link: var(--jh-accent);
  /* type (Inter 400/500/600; jholec.com/Framer style names in comments) */
  --jh-font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --jh-font-mono: "Fragment Mono", ui-monospace, "SF Mono", Menlo, monospace;   /* faux terminal only */
  --jh-text-label: 14px;     /* Label */
  --jh-text-body: 16px;      /* Body M */
  --jh-text-body-l: 18px;    /* Body L */
  --jh-text-h3: 24px;        /* Heading 3 / section headline */
  --jh-text-h2: 32px;        /* Heading 2 M */
  --jh-text-h1: 54px;        /* Heading 1 */
  --jh-leading-body: 1.6;
  --jh-leading-heading: 1.15;
  --jh-weight-regular: 400; --jh-weight-medium: 500; --jh-weight-semibold: 600;
  /* spacing */
  --jh-space-8: 8px; --jh-space-16: 16px; --jh-space-24: 24px; --jh-space-40: 40px;
  --jh-space-48: 48px; --jh-space-80: 80px; --jh-space-140: 140px; --jh-space-160: 160px;
  --jh-section-gap: 160px;
  --jh-page-margin-y: 140px;
  --jh-page-margin-x: clamp(20px, 3vw, 40px);
  --jh-radius: 16px;
  --jh-progress-height: 2px;
  /* breakpoints (for JS; CSS uses the literal values) */
  --jh-bp-tablet: 810px;
  --jh-bp-desktop: 1200px;
}
[data-section="dark"] { --jh-bg: var(--jh-black); --jh-fg: var(--jh-white); --jh-muted: var(--jh-gray); --jh-border: var(--jh-gray-dark); }
```

Section title pattern: `(01) Label /` in `--jh-text-label` 500 `--jh-muted`, number in `--jh-font-mono`.

### 6.2 Recreation — `--qr-*` (`Views/Theme.swift`, `Views/*.swift`; never follow the page scheme)

```css
:root {
  --pt: 1;                                   /* CSS px per point; set by the Stage on the scene root */
  --qr-black: #000000;                       /* panel body (pure black, merges with the notch) */
  --qr-white: #FFFFFF;
  --qr-accent: #0A84FF;                      /* Theme.accent; overridden per list by --qr-list-accent */
  --qr-list-accent: var(--qr-accent);        /* set on the panel root from accentFor(listId) */
  --qr-placeholder: #59595D;                 /* Theme.placeholder / placeholderSecondary */
  --qr-dashed-ring: #59595D;                 /* Theme.dashedRing */
  --qr-gray-circle: #59595D;                 /* Theme.grayCircle (ⓧ) */
  --qr-gray-circle-disabled: #474749;        /* Theme.grayCircleDisabled (✓ disabled, prominent disabled) */
  --qr-pill-fill: rgba(255, 255, 255, 0.03); /* Theme.pillFill */
  --qr-pill-stroke: #3D3D3F;                 /* Theme.pillStroke; also the §11.4 popover stroke */
  --qr-flag-orange: #FF9E0A;                 /* Theme.flagOrange (1.0, 0.62, 0.04) */
  --qr-error-red: #FF453A;                   /* (1.0, 0.27, 0.23) */
  /* white-alpha text hierarchy */
  --qr-text-25: rgba(255,255,255,0.25); --qr-text-40: rgba(255,255,255,0.40); --qr-text-45: rgba(255,255,255,0.45);
  --qr-text-50: rgba(255,255,255,0.50); --qr-text-55: rgba(255,255,255,0.55); --qr-text-60: rgba(255,255,255,0.60);
  --qr-text-75: rgba(255,255,255,0.75); --qr-text-85: rgba(255,255,255,0.85); --qr-text-95: rgba(255,255,255,0.95);
  /* white-alpha fills */
  --qr-fill-3: rgba(255,255,255,0.03);  --qr-fill-6: rgba(255,255,255,0.06);  --qr-fill-7: rgba(255,255,255,0.07);
  --qr-fill-8: rgba(255,255,255,0.08);  --qr-fill-9: rgba(255,255,255,0.09);  --qr-fill-10: rgba(255,255,255,0.10);
  --qr-fill-11: rgba(255,255,255,0.11); --qr-fill-15: rgba(255,255,255,0.15); --qr-fill-16: rgba(255,255,255,0.16);
  --qr-fill-18: rgba(255,255,255,0.18);
  /* accent alphas (computed with color-mix from --qr-list-accent) */
  --qr-accent-14: color-mix(in srgb, var(--qr-list-accent) 14%, transparent);   /* suggestion chip */
  --qr-accent-20: color-mix(in srgb, var(--qr-list-accent) 20%, transparent);   /* selected fill */
  --qr-accent-27: color-mix(in srgb, var(--qr-list-accent) 27%, transparent);
  --qr-accent-32: color-mix(in srgb, var(--qr-list-accent) 32%, transparent);
  --qr-accent-70: color-mix(in srgb, var(--qr-list-accent) 70%, transparent);   /* focus stroke */
  --qr-accent-80: color-mix(in srgb, var(--qr-list-accent) 80%, transparent);   /* selected stroke */
  /* list colours (core/lists.ts) */
  --qr-list-reminders: #0A84FF; --qr-list-work: #BF5AF2; --qr-list-home: #FF9F0A; --qr-list-groceries: #30D158; --qr-list-ideas: #FF375F;
  /* geometry */
  --qr-padding: 20;            /* pt, Theme.horizontalPadding */
  --qr-control-radius: 12;     /* pt, ScheduleMetrics.controlRadius */
  --qr-font: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Inter, sans-serif;
}
```

Rule: every recreation length is written as `calc(<pt> * var(--pt) * 1px)` through a `pt()`
helper (`ui/` uses a `px(pt: number)` util that reads the scene scale, never raw `px`).

---

## 7. Spring conversion (`machine/springs.ts`, landing spec §5.1)

```ts
export interface PhysicalSpring { readonly type: 'spring'; readonly stiffness: number; readonly damping: number; readonly mass: number }

/** SwiftUI `.spring(response:dampingFraction:)` → physical spring (mass 1):
 *    stiffness = mass · (2π / response)²
 *    damping   = 4π · dampingFraction · mass / response
 *  Derivation: ω₀ = 2π / response (undamped natural frequency), ζ = dampingFraction,
 *  k = m·ω₀², c = 2·ζ·√(k·m) = 2·ζ·m·ω₀ = 4π·ζ·m / response. */
export function springFromResponse(response: number, dampingFraction: number, mass?: number): PhysicalSpring;

/** SwiftUI `.spring(duration:bounce:)`: response = duration, dampingFraction = 1 − bounce (bounce ≥ 0). */
export function springFromDurationBounce(duration: number, bounce: number, mass?: number): PhysicalSpring;

/** Scaled by the `?debug=motion` time scale (stiffness / t², damping / t). */
export function scaled(spring: PhysicalSpring, timeScale: number): PhysicalSpring;

export interface Easing { readonly type: 'tween'; readonly ease: readonly [number, number, number, number]; readonly duration: number; readonly delay?: number }
export const EASE_OUT: readonly [0, 0, 0.58, 1];        // SwiftUI .easeOut
export const EASE_IN_OUT: readonly [0.42, 0, 0.58, 1];  // SwiftUI .easeInOut

/** Every named animation of the app (NotchLayout, HoverMotion, views). Values are the SwiftUI constants; the physical form is derived. */
export const Motion: {
  open:        PhysicalSpring;  // response 0.42, damping 0.78 → stiffness 223.80, damping 23.337
  close:       PhysicalSpring;  // 0.30, 0.92 → 438.65, 38.537
  hoverIn:     PhysicalSpring;  // 0.32, 0.55 → 385.53, 21.598
  hoverOut:    PhysicalSpring;  // 0.30, 0.85 → 438.65, 35.605
  saving:      PhysicalSpring;  // 0.45, 0.82 → 194.96, 22.899
  schedule:    PhysicalSpring;  // 0.38, 0.80 → 273.40, 26.456
  chip:        PhysicalSpring;  // 0.30, 0.80 → 438.65, 33.510   (dueDate / suggestion apply, Reminders window slide-in)
  flag:        PhysicalSpring;  // 0.25, 0.70 → 631.65, 35.186
  badgeBounce: PhysicalSpring;  // 0.28, 0.45 → 503.55, 20.196   (delay 0.55 s, to 1.18×)
  badgeSettle: PhysicalSpring;  // 0.30, 0.70 → 438.65, 29.322   (delay 0.72 s, to 1×)
  hoverScale:  PhysicalSpring;  // duration 0.22, bounce 0.12 → response 0.22, damping 0.88 → 815.67, 50.266
  press:       PhysicalSpring;  // duration 0.14, bounce 0 → 2014.2, 89.760
  contentIn:   Easing;          // easeOut 0.20, delay 0.16 (blur 8 → 0, scale 0.94 → 1 from the top)
  contentOut:  Easing;          // easeOut 0.12
  reduced:     Easing;          // easeOut 0.15 (every spring under prefers-reduced-motion)
  highlight:   Easing;          // easeOut 0.12 (hover highlight / fills)
  focusRing:   Easing;          // easeOut 0.15
  canSave:     Easing;          // easeInOut 0.18 (✓ colour)
  suggestion:  Easing;          // easeOut 0.18 (chip text change)
  dismiss:     Easing;          // easeOut 0.15 (the ⓧ on the suggestion; ChipSlot)
  regularBottomIn:  Easing;     // easeOut 0.18, delay 0.12 (chip slot + bar return after the section)
  regularBottomOut: Easing;     // easeOut 0.08
  sectionIn:   Easing;          // easeOut 0.12 (section opacity); rows stagger separately
  sectionOut:  Easing;          // easeOut 0.10
  stagger: (index: 0 | 1 | 2 | 3) => Easing;  // easeOut 0.24, delay 0.06 + index·0.035; from y −6, blur 3
  monthPage:   Easing;          // easeOut 0.15
  badgeFade:   Easing;          // easeOut 0.16 (badge out, ahead of the notch shrinking)
  tickTrim:    Easing;          // easeOut 0.28, delay 0.32 (CheckmarkShape trim 0 → 1)
  error:       Easing;          // easeOut 0.20
};
```

Test (`tests/machine/springs.test.ts`) pins the twelve numeric pairs above to 3 decimals and
`springFromDurationBounce(0.22, 0.12) ≡ springFromResponse(0.22, 0.88)`.

---

## 8. Cross-cutting decisions recorded here

1. `now` and `calendar` are explicit everywhere in `core/` and `machine/`; `recreation/clock.ts`
   and `calendar.currentCalendar()` are the only production sources.
2. The recreation formats in `en-US`, 12-hour (`hour12: true`), `firstWeekday 1`, visitor's time
   zone; Czech phrases parse regardless (`looksCzech`). A 24-hour toggle is not built.
3. Menu-bar icon: `Resources/Assets.xcassets/MenuBarIcon.imageset` in the app repo contains only
   `Contents.json` (no PNGs are committed); `Resources/AppIcon.icns` exists. Part 04 extracts the
   app icon from the `.icns` for the menu bar at 18 pt (template-tinted) and the Download section;
   nothing else from Apple.
4. The ⓧ, ✓, header and chips use `HoverButton` (scale 1.06/0.94 springs, hand cursor); pill icons
   and ‹ › use `HoverHighlightButton` (circular white 10 %/18 %, no geometry change).
5. The silhouette is one `<path>` whose `d` is `notchPath(...)`; motion animates `width`, `height`,
   `topRadius`, `bottomRadius` as motion values and re-derives the path per frame (equal segment
   count in every state, so no path morph library is needed).
6. The content mask (`NotchContainerView.mask`) is a CSS `clip-path: path(...)` with the live
   silhouette while `!settled`, dropped (`none`) once settled.
7. Haptics do not exist on the web: `haptic` is a no-op host method, kept so the effect list and
   its tests stay 1:1.
