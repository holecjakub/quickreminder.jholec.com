# 02 · Recreation UI and RecreationHandle — Area B

Date: 2026-10-28 · Scope: `src/recreation/ui/**`, `src/recreation/{store,runtime,controller,Recreation,index,motionScale}.ts(x)`
and their tests. Consumes Area A (`core/`, `machine/`, `clock.ts`) only through `00-contracts.md`.

Sources read for this part (app repo `~/Developer/Xcode Apps/QuickReminder` at `144d620`, 2026-10-27 21:49):
`SPEC.md` §1 §3 §4; `Notch/NotchContainerView.swift`, `Notch/NotchShape.swift`, `Notch/NotchState.swift`;
`Panel/PanelController.swift`, `Panel/NotchMachine.swift`; `Views/QuickReminderView.swift`, `HeaderView.swift`,
`InputView.swift`, `PlainTextView.swift`, `DashedCircle.swift`, `BottomBar.swift`, `HoverButtonStyle.swift`,
`NotchButtonStyles.swift`, `SavedCheckView.swift`, `ListPickerMenu.swift`, `ScheduleNotchSection.swift`,
`ScheduleMonthGrid.swift`, `ScheduleText.swift`, `Theme.swift`; `Services/ScheduleDraft.swift`,
`ScheduleCommit.swift`, `DatePresets.swift`; `Tests/QuickReminderCoreTests/NotchStateTests.swift`.

## 0. Read first: contract deltas, additions, cross-part requirements

The app changed on 2026-10-27 evening (PR #15 `feature/schedule-below-bar`, merged 21:45) after the landing
spec and parts of `00-contracts.md` were written. The landing spec §3 rule applies: **the code wins**.

**D1 — Set Date grows below the bottom bar (blocking for B2, B17–B21).** In the current code the whole plain
panel (header, title, notes, chip slot, bottom bar) stays exactly where it is and the section is appended below
the bottom bar's 20 pt inset (`NotchLayout.scheduleContentHeight = contentHeight + ScheduleMetrics.sectionHeight + 20`).
Values (pinned by `NotchStateTests.scheduleHeightFollowsTheRhythm`, `clickOnTheTextRowsCancelsScheduling`):

| Value | Contract text | Code (wins) |
|---|---|---|
| `ScheduleMetrics.topGap` | 14 | does not exist (the plain panel's 20 pt inset is the gap) |
| `ScheduleMetrics.sectionHeight(1, false / true)` | 272 / 504 | **258 / 490** |
| `scheduleContentHeight(1, false / true)` | 392 / 624 | **480 / 712** (202 + 258 + 20, 480 + 232) |
| `scheduleControlsSize` / `scheduleCalendarSize` | 600 × 431 / 600 × 663 | **600 × 519 / 600 × 751** |
| open canvas in notch style | 648 × 687 | **648 × 775** (`canvasSize(600 × 751)`) |
| section top (y of the type field) | 153 | **241** (= band 39 + `contentHeight` 202) |
| click-cancel band bottom | 139 | 139 (unchanged; `NotchLayout.scheduleSectionTop()` keeps returning 139 and this part uses it **only** for `clickCancelsSchedule`) |

Section rows from the panel top (code): type field 241–277 · preview 283–301 · presets 311–355 / 363–407 ·
day/time 419–449 · [calendar 459–681] · footer 463–499 (controls) / 695–731 (calendar) · inset 20 → 519 / 751.
While the section is open the chip slot and the bottom bar stay visible and live (`Motion.regularBottomIn/Out`
are unused by this part). Task B2 is a guard test that fails until `machine/notchLayout.ts` follows this table;
its Step 3 gives the exact edit.

The landing spec §5.1 heights "431" and "663" are superseded by 519 and 751 for the same reason.

**D2 — Esc order.** Code (`QuickReminderView` `.panelDismissPopovers` + `PanelController` Esc monitor):
open popover (list picker / location) → calendar → section → panel. The contract comment on
`RecreationHandle.escape()` lists calendar → controls → popovers → panel; the signature is unchanged, the order
follows the code.

**D3 — Location stays a popover.** The current app (in-notch style, its default) shows Location as a section
below the bar (`0c87117`, 86 pt section, 347 pt panel). The landing spec §5.3 and §11.4 and the contract
(`locationPopoverOpen`, `openLocationPopover`, `ui/LocationPopover.tsx`) chose an original black popover. This part
follows the spec and the contract. Making Location 1:1 with the section is a separate follow-up, not in this plan.

**D4 — ✓ while Set Date is open.** The app asks `ScheduleDraft.prepareSave()` (an edited draft is Set, then saved;
an untouched one is closed and the reminder saved as it is; an invalid typed date beeps). The contract's
`ScheduleDraft` has no `isDirty` / `prepareSave`, so the store tracks "touched" itself (B7). No contract change.

**D5 — Additions to the file tree (all inside `src/recreation/`, import rule unchanged).**
`motionScale.ts`, `controller.ts`, `ui/units.ts`, `ui/transitions.ts`, `ui/motionPrefs.tsx`, `ui/focus.ts`,
`ui/RecreationContext.tsx`, `ui/NotchSilhouette.tsx`, `ui/Popover.tsx`, `ui/NumericText.tsx`, `ui/keyboard.ts`,
`ui/recreation.css`, `dev/harness.tsx` (+ `recreation-harness.html` at the repo root). `NotchRuntime` gains
`reset()` and the option `onDispatched`. `icons.tsx` carries the SF Symbol → Phosphor table (the contract said
"table in part 03"; this part owns it, part 03 must not duplicate it).

**D6 — Older machine effects.** The contract's `NotchMachine` still has `canvasGrown`, `growCanvasForSchedule`,
`fitCanvasToPanel` (removed in the code by `90956b3`). The runtime treats both as no-ops, so either machine version works.

**Cross-part requirements (part 04, desktop):**
- The recreation handles every key whose target is inside it, then calls `preventDefault()` and
  `stopPropagation()` on the React event. `DesktopScene` must route keys with a React `onKeyDown` on its container
  (not a native listener), so it only ever sees keys with focus on the container itself (`FocusTarget 'none'`).
- `DesktopScene` root carries `data-qr-screen`; "click outside the black shape closes" is scoped to that element.
- The recreation root must sit above the menu bar and windows (`z-index` set by the desktop on the notch slot).
- `ScenePoint`, `PointerTarget` and `CursorLike` (structural subset of `FakeCursorHandle`: `moveTo`, `click`,
  `cancel`) are exported from `recreation/index.ts`; `desktop/fakeCursor.ts` imports `ScenePoint` from there.

## 0.1 Conventions for every task in this part

- Branch `develop` (created by the plan's first task in part 01; B1 Step 1 switches to it).
- Every length in `ui/` goes through `px(pt)` → `calc(<pt> * var(--pt) * 1px)` (contract §6.2). Tests read it back
  with `ptOf()`. No raw `px` values in `ui/`.
- Fonts: the root class `.qr-root` sets `font-family: var(--qr-font)` (contract §6.2, landing spec §3). Swift
  weights map 1:1: regular 400, medium 500, semibold 600, bold 700. `monospacedDigit()` → class `qr-tabular`
  (`font-variant-numeric: tabular-nums`).
- UI and recreation test files start with `// @vitest-environment jsdom`, then `import './setup';` (`tests/ui/*`) or
  `import '../ui/setup';` (`tests/recreation/*`). Run with `npx vitest run <file>`.
- Test time: `TEST_NOW` = Friday 2026-09-18 10:00 Europe/Prague (`2026-09-18T08:00:00Z`, the parser suite's now),
  calendar `{ timeZone: 'Europe/Prague', locale: 'en-US', firstWeekday: 1 }`, formatter locale `en-US`, 12-hour.
  Strings from the formatter contain U+202F before AM/PM; tests compare through `plainSpaces()` (tests/support.ts).
- `origin`: every store/controller mutation takes `origin: 'user' | 'api'`. UI handlers pass `'user'`; the
  `RecreationHandle` passes `'api'`. Only `'user'` sets `dirty` and only `'user'` moves keyboard focus
  (exception: `show({ source: 'click' | 'hotkey' })` or `focus: true`).
- "Beep": the web has no `NSSound.beep()`; the store counts beeps (`beepCount`) and nothing is rendered.

---

### Task B1: Recreation UI foundations (units, time scale, reduced motion, transitions, test harness)

**Files:**
- Create: `src/recreation/ui/units.ts`, `src/recreation/motionScale.ts`, `src/recreation/ui/useReducedMotion.ts`,
  `src/recreation/ui/transitions.ts`, `src/recreation/ui/motionPrefs.tsx`, `src/recreation/ui/recreation.css`
- Create: `tests/ui/setup.ts`, `tests/ui/support.tsx`
- Test: `tests/ui/foundations.test.tsx`

**Interfaces:**
- Consumes: `Motion`, `scaled`, `EASE_OUT`, `PhysicalSpring`, `Easing` (`machine/springs.ts`, contract §7);
  `plainSpaces` (`tests/support.ts`, contract §1).
- Produces:
  ```ts
  // ui/units.ts
  export function px(pt: number): string;                       // `calc(${pt} * var(--pt) * 1px)`
  // motionScale.ts
  export function motionTimeScale(search?: string): 1 | 4;      // '?debug=motion' → 4; default window.location.search
  // ui/useReducedMotion.ts
  export function useReducedMotion(override?: boolean): boolean; // override wins; else matchMedia('(prefers-reduced-motion: reduce)'), live
  // ui/transitions.ts
  import type { Transition } from 'motion/react';
  export type FlagAnimation = 'open' | 'close' | 'saving' | 'schedule' | 'hoverIn' | 'hoverOut' | 'none';
  export const INSTANT: Transition;                             // { duration: 0 }
  export function toTransition(m: PhysicalSpring | Easing, timeScale: number): Transition;
  export type EffectiveMotion = 'open' | 'close' | 'schedule' | 'contentIn' | 'contentOut';
  export function effective(name: EffectiveMotion, reduceMotion: boolean, timeScale: number): Transition;
  export function staggerTransition(index: 0 | 1 | 2 | 3, reduceMotion: boolean, timeScale: number): Transition;
  // ui/motionPrefs.tsx
  export interface MotionPrefs { readonly reduceMotion: boolean; readonly timeScale: number }
  export function MotionPrefsProvider(props: { value: MotionPrefs; children: ReactNode }): JSX.Element;
  export function useMotionPrefs(): MotionPrefs;                // default { reduceMotion: false, timeScale: 1 }
  // tests/ui/support.tsx (test-only)
  export const TEST_NOW: Date; export const testCalendar: Calendar;
  export function useTestTime(): void;                          // fake setTimeout/setInterval/Date, system time TEST_NOW
  export function ptOf(value: string): number;                  // inverse of px(); throws on anything else
  ```

- [ ] **Step 1: Switch to the branch and add the UI test dependencies**
  ```bash
  cd ~/Developer/quickreminder.jholec.com && git switch develop
  npm i -D @testing-library/react@16.1.0 @testing-library/user-event@14.5.2 @testing-library/jest-dom@6.6.3 jsdom@25.0.1
  ```
  Expected: `git branch --show-current` prints `develop`; the four packages appear in `devDependencies`
  (skip any that part 01 already added at these versions).

- [ ] **Step 2: Write the test setup and support files**
  `tests/ui/setup.ts`: `import '@testing-library/jest-dom/vitest'`; `MotionGlobalConfig.skipAnimations = true`
  (from `motion/react`, so every motion animation lands on its target at once); a `window.matchMedia` stub whose
  `matches` reads a module-level `reducedMotionQuery` flag exported as `setPrefersReducedMotion(v: boolean)`;
  `Element.prototype.scrollIntoView = vi.fn()`; `afterEach(() => { cleanup(); vi.useRealTimers(); })`.
  `tests/ui/support.tsx`: `TEST_NOW = new Date('2026-09-18T08:00:00Z')`, `testCalendar`, `useTestTime()` =
  `vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] }); vi.setSystemTime(TEST_NOW)`,
  `ptOf(v)` parsing `/^calc\((-?\d+(?:\.\d+)?) \* var\(--pt\) \* 1px\)$/`.

- [ ] **Step 3: Write the failing test** `tests/ui/foundations.test.tsx`
  ```ts
  // @vitest-environment jsdom
  import './setup';
  import { renderHook } from '@testing-library/react';
  import { px } from '../../src/recreation/ui/units';
  import { motionTimeScale } from '../../src/recreation/motionScale';
  import { toTransition, effective, staggerTransition, INSTANT } from '../../src/recreation/ui/transitions';
  import { useReducedMotion } from '../../src/recreation/ui/useReducedMotion';
  import { Motion } from '../../src/recreation/machine/springs';
  import { ptOf } from './support';
  import { setPrefersReducedMotion } from './setup';

  test('px writes points against --pt and ptOf reads them back', () => {
    expect(px(22)).toBe('calc(22 * var(--pt) * 1px)');
    expect(ptOf(px(0.5))).toBe(0.5);
    expect(() => ptOf('22px')).toThrow();
  });
  test('motionTimeScale reads ?debug=motion', () => {
    expect(motionTimeScale('?debug=motion')).toBe(4);
    expect(motionTimeScale('?x=1')).toBe(1);
    expect(motionTimeScale('')).toBe(1);
  });
  test('springs keep their physical constants, scaled by the time scale', () => {
    const open = toTransition(Motion.open, 1) as any;
    expect(open.type).toBe('spring');
    expect(open.stiffness).toBeCloseTo(223.80, 2);
    expect(open.damping).toBeCloseTo(23.337, 3);
    expect(open.mass).toBe(1);
    const slow = toTransition(Motion.open, 4) as any;
    expect(slow.stiffness).toBeCloseTo(223.80 / 16, 2);
    expect(slow.damping).toBeCloseTo(23.337 / 4, 3);
  });
  test('easings map to tweens, durations and delays scaled', () => {
    expect(toTransition(Motion.contentIn, 4)).toEqual({ type: 'tween', ease: [0, 0, 0.58, 1], duration: 0.8, delay: 0.64 });
    expect(toTransition(Motion.contentOut, 1)).toEqual({ type: 'tween', ease: [0, 0, 0.58, 1], duration: 0.12 });
  });
  test('reduce motion swaps the effective animations for easeOut 0.15 without delay', () => {
    for (const n of ['open', 'close', 'schedule', 'contentIn', 'contentOut'] as const)
      expect(effective(n, true, 1)).toEqual({ type: 'tween', ease: [0, 0, 0.58, 1], duration: 0.15 });
    expect((effective('schedule', false, 1) as any).stiffness).toBeCloseTo(273.40, 2);
  });
  test('stagger: easeOut 0.24, delay 0.06 + i·0.035; reduced 0.15', () => {
    const t = staggerTransition(2, false, 1) as any;
    expect(t.duration).toBe(0.24);
    expect(t.delay).toBeCloseTo(0.13, 10);
    expect(staggerTransition(3, true, 1)).toEqual({ type: 'tween', ease: [0, 0, 0.58, 1], duration: 0.15 });
    expect(INSTANT).toEqual({ duration: 0 });
  });
  test('useReducedMotion: override wins, otherwise the media query', () => {
    setPrefersReducedMotion(true);
    expect(renderHook(() => useReducedMotion()).result.current).toBe(true);
    expect(renderHook(() => useReducedMotion(false)).result.current).toBe(false);
    setPrefersReducedMotion(false);
  });
  ```

- [ ] **Step 4: Run it** — `npx vitest run tests/ui/foundations.test.tsx`. Expected: FAIL (modules missing).

- [ ] **Step 5: Implement** the five modules with the signatures above. `toTransition`: a `PhysicalSpring` becomes
  `{ type: 'spring', ...scaled(m, timeScale) }` without its own `type` duplicated; an `Easing` becomes
  `{ type: 'tween', ease, duration: duration·t, delay: delay·t }` (omit `delay` when the Easing has none).
  `effective(name, true, t)` returns `toTransition(Motion.reduced, t)` (Swift `NotchLayout.effective*`,
  `NotchLayout.effectiveSection`); otherwise `Motion.open | close | schedule | contentIn | contentOut`.
  `staggerTransition` = `toTransition(Motion.stagger(i), t)` or reduced (Swift `View.staggered`: reduce → `.easeOut(0.15)`).
  `recreation.css`:
  ```css
  .qr-root { font-family: var(--qr-font); -webkit-font-smoothing: antialiased; font-synthesis: none; color: var(--qr-white); }
  .qr-root * { box-sizing: border-box; }
  .qr-root button { all: unset; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
  .qr-root button:disabled { cursor: default; }
  .qr-root input { all: unset; box-sizing: border-box; min-width: 0; }
  .qr-root input::placeholder { opacity: 1; color: var(--qr-ph); }   /* each field sets --qr-ph (Theme.placeholder / white 50 %) */
  .qr-tabular { font-variant-numeric: tabular-nums; }
  .qr-root :focus-visible { outline: calc(2 * var(--pt) * 1px) solid var(--qr-accent-70); outline-offset: calc(1 * var(--pt) * 1px); }
  .qr-root input:focus-visible, .qr-root [data-qr-own-ring]:focus-visible { outline: none; }
  ```
  (Visible focus per landing spec §9; text fields draw their own focus stroke like the app, title/notes show only the caret.)

- [ ] **Step 6: Run it** — `npx vitest run tests/ui/foundations.test.tsx`. Expected: PASS (7 tests).

- [ ] **Step 7: Commit**
  ```bash
  git add src/recreation/ui/units.ts src/recreation/motionScale.ts src/recreation/ui/useReducedMotion.ts src/recreation/ui/transitions.ts src/recreation/ui/motionPrefs.tsx src/recreation/ui/recreation.css tests/ui/setup.ts tests/ui/support.tsx tests/ui/foundations.test.tsx package.json package-lock.json
  git commit -m "feat(recreation): ui foundations — pt units, motion time scale, reduced motion, transitions"
  ```

---

### Task B2: Layout pins guard (Set Date below the bar, app 144d620)

**Files:**
- Test: `tests/ui/layoutPins.test.ts`
- Modify (only if Step 2 fails): `src/recreation/machine/notchLayout.ts`, `tests/machine/notchLayout.test.ts` (Area A files)

**Interfaces:**
- Consumes: `NotchLayout.{topContentHeight, contentHeight, scheduleContentHeight, openSize, maxPanelHeight, scheduleSectionTop, clickCancelsSchedule, canvasSize}`,
  `ScheduleMetrics.{calendarHeight, sectionHeight}` (`machine/notchLayout.ts`); `sizesFor, panelSize, savedSize, hoverSize` (`machine/notchState.ts`).
- Produces: nothing (guard).

- [ ] **Step 1: Write the test** (values from `NotchStateTests.swift` `openHeightFollowsTheRhythm`, `scheduleHeightFollowsTheRhythm`,
  `scheduleHeightIsClampedToTheScreen`, `maxPanelHeightStopsAboveTheDockWithRoomForTheOvershoot`, `clickOnTheTextRowsCancelsScheduling`)
  ```ts
  import { NotchLayout, ScheduleMetrics } from '../../src/recreation/machine/notchLayout';
  import { sizesFor, panelSize, savedSize, hoverSize } from '../../src/recreation/machine/notchState';
  test('plain rhythm', () => {
    expect(NotchLayout.topContentHeight(1)).toBe(100);   // 8 + 36 + 10 + (25 + 1 + 20)
    expect(NotchLayout.contentHeight(1)).toBe(202);      // + 26 + 8 + 48 + 20
  });
  test('Set Date section below the bottom bar', () => {
    expect(ScheduleMetrics.calendarHeight(1)).toBe(222);           // 26 + 18 + 6·28 + 5·2
    expect(ScheduleMetrics.sectionHeight(1, false)).toBe(258);     // 36+6+18+10+44+8+44+12+30+14+36
    expect(ScheduleMetrics.sectionHeight(1, true)).toBe(490);      // + 10 + 222
    expect(NotchLayout.scheduleContentHeight(1, false)).toBe(480); // "202 plain + 258 section + 20"
    expect(NotchLayout.scheduleContentHeight(1, true)).toBe(712);  // "480 + 10 + 26 + 18 + 168 + 10"
    expect(NotchLayout.openSize(39, 'none')).toEqual({ width: 600, height: 241 });
    expect(NotchLayout.openSize(39, 'controls')).toEqual({ width: 600, height: 519 });
    expect(NotchLayout.openSize(39, 'calendar')).toEqual({ width: 600, height: 751 });
    expect(NotchLayout.openSize(39, 'calendar', 600)).toEqual({ width: 600, height: 600 });
    expect(NotchLayout.openSize(39, 'controls', 100)).toEqual({ width: 600, height: 241 });
  });
  test('fake 14" screen sizes and canvas', () => {
    expect(NotchLayout.maxPanelHeight(982, 0)).toBe(942);
    const s = sizesFor({ width: 221, height: 38 }, 982, 0);
    expect(s.closedSize).toEqual({ width: 235, height: 39 });
    expect(s.scheduleSize).toEqual({ width: 600, height: 519 });
    expect(s.scheduleCalendarSize).toEqual({ width: 600, height: 751 });
    expect(NotchLayout.canvasSize(panelSize(s, 'calendar'))).toEqual({ width: 648, height: 775 });
    expect(savedSize(s)).toEqual({ width: 379, height: 39 });
    expect(hoverSize(s)).toEqual({ width: 257, height: 44 });
  });
  test('only header, title and notes cancel the section', () => {
    const top = NotchLayout.scheduleSectionTop(39, 1);
    expect(top).toBe(139);
    const c = (y: number, s: 'none' | 'controls' | 'calendar' = 'controls') => NotchLayout.clickCancelsSchedule(y, top, s);
    expect(c(60, 'calendar')).toBe(true); expect(c(105)).toBe(true); expect(c(128)).toBe(true);
    expect(c(152)).toBe(false); expect(c(197)).toBe(false); expect(c(39 + 202 + 10)).toBe(false);
    expect(c(105, 'none')).toBe(false);
  });
  ```
- [ ] **Step 2: Run it** — `npx vitest run tests/ui/layoutPins.test.ts`. Expected: PASS if Area A implemented D1;
  FAIL on `sectionHeight` / `scheduleContentHeight` / `openSize` if it followed the older contract table.
- [ ] **Step 3: If it failed, apply D1 in `machine/notchLayout.ts`:** delete `ScheduleMetrics.topGap`;
  `sectionHeight(s, cal) = sc(36) + 6 + sc(18) + 10 + 2·sc(44) + 8 + 12 + sc(30) + (cal ? 10 + calendarHeight(s) : 0) + 14 + sc(36)`;
  `scheduleContentHeight(s, cal) = contentHeight(s) + sectionHeight(s, cal) + 20`; keep `scheduleSectionTop(band, s) = band + topContentHeight(s)`
  (it is the click-cancel band, Swift `sectionCancelBandBottom`). Update the sums in `tests/machine/notchLayout.test.ts`
  to 258 / 490 / 480 / 712 / 519 / 751. Re-run both files.
- [ ] **Step 4: Run** — `npx vitest run tests/ui/layoutPins.test.ts tests/machine/notchLayout.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** — `git add tests/ui/layoutPins.test.ts src/recreation/machine/notchLayout.ts tests/machine/notchLayout.test.ts && git commit -m "test(recreation): pin the Set Date below-the-bar layout from app 144d620"`

---

### Task B3: SF Symbol → Phosphor glyph table (`icons.tsx`)

The app draws SF Symbols; the site may not ship them (landing spec §3). Each SF Symbol is replaced by the closest
Phosphor glyph (`@phosphor-icons/react@2.1.10`), sized so its ink box fits the SF glyph's ink box at the size and
weight the Swift view uses. SF ink boxes were measured by rendering `NSImage(systemSymbolName:)` with
`SymbolConfiguration(pointSize:weight:)` at 8× on macOS 26 (calendar.badge.clock at 22 pt: 25.75 × 21.88, matching
the 25.5 × 21.5 in the `BottomBar.swift` comment); Phosphor ink boxes from the glyph paths (256 grid).
Phosphor size = min(SF ink width / Phosphor ink width ratio, SF ink height / ratio), rounded to 0.5 pt.

| Key (`name@pt`) | Used in (Swift) | SF ink (pt) | Phosphor | Weight | Size (pt) |
|---|---|---|---|---|---|
| `calendar.badge.clock@18` | BottomBar pill | 21.75 × 18.88 | composite `CalendarClockIcon` (CalendarDots + Clock) | regular | box 21.75 × 18.88 |
| `calendar.badge.clock@12` | suggestion chip (medium) | 15.12 × 12.25 | composite, scaled 12/18 | regular | box 14.5 × 12.587 |
| `location@18` | pill | 17.88 × 17.25 | `NavigationArrow`, mirrored (SF points north-east) | regular | 21 |
| `location.fill@18` | pill, active | 17.12 × 17.25 | `NavigationArrow`, mirrored | fill | 21 |
| `flag@18` / `flag.fill@18` | pill | 16.00 × 18.00 | `Flag` | regular / fill | 21.5 |
| `checkmark@22` | ✓ button (semibold) | 19.25 × 19.00 | `Check` | bold | 23.5 |
| `checkmark@13` | list picker row (semibold) | 11.25 × 11.88 | `Check` | bold | 14 |
| `xmark@11` | ⓧ (bold) | 10.62 × 9.88 | `X` | bold | 15 |
| `xmark.circle.fill@13` | chip dismiss / clear | 13.00 × 13.00 | `XCircle` | fill | 16 |
| `chevron.down@13` | header (bold) | 11.12 × 6.88 | `CaretDown` | bold | 15.5 |
| `chevron.down@9` | day button (bold) | 9.00 × 4.88 | `CaretDown` | bold | 12 |
| `chevron.left@11` / `chevron.right@11` | month ‹ › (semibold) | 6.00 × 9.88 | `CaretLeft` / `CaretRight` | bold | 13.5 |
| `calendar@12` | date chip, day button (medium) | 12.62 × 11.00 | `CalendarDots` | regular | 13.5 |
| `calendar@13` | preset Next Month (medium) | 12.12 × 12.00 | `CalendarDots` | regular | 14.5 |
| `keyboard@12` | type field (medium) | 16.00 × 10.00 | `Keyboard` | regular | 16 |
| `exclamationmark.triangle.fill@12` | preview "In the past" | 12.88 × 12.00 | `Warning` | fill | 14.5 |
| `clock@13` | preset In 1 Hour | 14.00 × 14.00 | `Clock` | regular | 17 |
| `clock@11` | time field | 12.00 × 12.00 | `Clock` | regular | 14.5 |
| `moon@13` | preset Evening | 12.88 × 13.75 | `Moon` | regular | 16 |
| `sunrise@13` | preset Tomorrow | 16.25 × 14.12 | `SunHorizon` | regular | 17 |
| `sofa@13` | preset Weekend | 19.25 × 12.00 | `Armchair` | regular | 16.5 |
| `calendar.badge.plus@13` | preset Next Week | 15.25 × 13.00 | `CalendarPlus` | regular | 16 |

`CalendarClockIcon` at 18 pt (all numbers × `pointSize / 18` at 12 pt): an `<svg>` box 21.75 × 18.88 with
`overflow: visible`; `CalendarDots` regular size 23 at (x −2.875, y −1.4375) so its ink starts at the box origin
(ink 17.25 × 18.6875), masked by a hole: `<mask>` white rect with a black circle at (16.46875, 13.59875) r 6.78125
(clock ink radius 5.28125 + 1.5 pt gap); `Clock` regular size 13 at (x 9.96875, y 7.09875) so its ink
(10.5625 square) ends at the box's bottom-right corner. All glyphs use `currentColor`.

**Files:**
- Create: `src/recreation/ui/icons.tsx`
- Test: `tests/ui/icons.test.tsx`

**Interfaces:**
- Consumes: `px` (B1); `DatePresets.systemImage` return union (contract §2.4).
- Produces:
  ```ts
  export type SFSymbol = 'calendar.badge.clock' | 'calendar' | 'calendar.badge.plus' | 'location' | 'location.fill'
    | 'flag' | 'flag.fill' | 'checkmark' | 'xmark' | 'xmark.circle.fill' | 'chevron.down' | 'chevron.left'
    | 'chevron.right' | 'keyboard' | 'exclamationmark.triangle.fill' | 'clock' | 'moon' | 'sunrise' | 'sofa';
  export interface GlyphSpec { readonly phosphor: string; readonly weight: 'regular' | 'bold' | 'fill'; readonly size: number; readonly mirrored?: true }
  export const GLYPHS: Readonly<Record<string, GlyphSpec>>;        // keys exactly the table's `name@pt` (composites excluded)
  export function SFIcon(props: { name: SFSymbol; pointSize: number; style?: CSSProperties; className?: string }): JSX.Element;
  export function CalendarClockIcon(props: { pointSize: 18 | 12; style?: CSSProperties }): JSX.Element;
  ```
  Every rendered glyph root carries `data-sf="<name>@<pt>"` and `data-phosphor="<Name>:<weight>"` (composite: `CalendarDots+Clock:regular`),
  `aria-hidden="true"`, and its size as `style.width/height = px(size)`.

- [ ] **Step 1: Write the failing test**
  ```ts
  // @vitest-environment jsdom
  import './setup';
  import { render } from '@testing-library/react';
  import { SFIcon, GLYPHS, CalendarClockIcon } from '../../src/recreation/ui/icons';
  import { ptOf } from './support';
  test('every table entry renders its Phosphor glyph at the pinned size', () => {
    const expected: Record<string, [string, number, boolean?]> = {
      'location@18': ['NavigationArrow:regular', 21, true], 'location.fill@18': ['NavigationArrow:fill', 21, true],
      'flag@18': ['Flag:regular', 21.5], 'flag.fill@18': ['Flag:fill', 21.5], 'checkmark@22': ['Check:bold', 23.5],
      'checkmark@13': ['Check:bold', 14], 'xmark@11': ['X:bold', 15], 'xmark.circle.fill@13': ['XCircle:fill', 16],
      'chevron.down@13': ['CaretDown:bold', 15.5], 'chevron.down@9': ['CaretDown:bold', 12],
      'chevron.left@11': ['CaretLeft:bold', 13.5], 'chevron.right@11': ['CaretRight:bold', 13.5],
      'calendar@12': ['CalendarDots:regular', 13.5], 'calendar@13': ['CalendarDots:regular', 14.5],
      'keyboard@12': ['Keyboard:regular', 16], 'exclamationmark.triangle.fill@12': ['Warning:fill', 14.5],
      'clock@13': ['Clock:regular', 17], 'clock@11': ['Clock:regular', 14.5], 'moon@13': ['Moon:regular', 16],
      'sunrise@13': ['SunHorizon:regular', 17], 'sofa@13': ['Armchair:regular', 16.5], 'calendar.badge.plus@13': ['CalendarPlus:regular', 16],
    };
    expect(Object.keys(GLYPHS).sort()).toEqual(Object.keys(expected).sort());
    for (const [key, [phosphor, size, mirrored]] of Object.entries(expected)) {
      const [name, pt] = key.split('@');
      const { container, unmount } = render(<SFIcon name={name as any} pointSize={Number(pt)} />);
      const el = container.querySelector(`[data-sf="${key}"]`) as HTMLElement;
      expect(el.dataset.phosphor).toBe(phosphor);
      expect(ptOf(el.style.width)).toBe(size);
      expect(ptOf(el.style.height)).toBe(size);
      expect(el.style.transform).toBe(mirrored ? 'scaleX(-1)' : '');
      expect(el.getAttribute('aria-hidden')).toBe('true');
      unmount();
    }
  });
  test('an unlisted size is a programming error', () => {
    expect(() => render(<SFIcon name="flag" pointSize={17} />)).toThrow(/flag@17/);
  });
  test('calendar.badge.clock is the CalendarDots + Clock composite with a knockout', () => {
    const { container } = render(<SFIcon name="calendar.badge.clock" pointSize={18} />);
    const root = container.querySelector('[data-sf="calendar.badge.clock@18"]') as SVGElement;
    expect(root.dataset.phosphor).toBe('CalendarDots+Clock:regular');
    expect(ptOf(root.style.width)).toBe(21.75);
    expect(ptOf(root.style.height)).toBe(18.88);
    expect(root.querySelector('mask circle')!.getAttribute('r')).toBe('6.78125');
    const small = render(<CalendarClockIcon pointSize={12} />).container.firstElementChild as SVGElement;
    expect(ptOf(small.style.width)).toBeCloseTo(14.5, 3);
    expect(small.querySelector('mask circle')!.getAttribute('r')).toBe(String(6.78125 * 12 / 18));
  });
  ```
- [ ] **Step 2: Run it** — `npx vitest run tests/ui/icons.test.tsx`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `icons.tsx` with `GLYPHS` exactly as the table, `SFIcon` looking up ``${name}@${pointSize}``
  (routes `calendar.badge.clock` to `CalendarClockIcon`, throws `Error('No glyph for <key>')` otherwise), Phosphor
  components imported by name from `@phosphor-icons/react`, `mirrored` → `style.transform = 'scaleX(-1)'`. The mask id
  comes from `useId()`.
- [ ] **Step 4: Run it** — Expected: PASS (3 tests).
- [ ] **Step 5: Commit** — `git add src/recreation/ui/icons.tsx tests/ui/icons.test.tsx && git commit -m "feat(recreation): SF Symbol to Phosphor glyph table at the app's optical sizes"`

---

### Task B4: Button styles (`buttons.tsx`, port of HoverButtonStyle.swift + NotchButtonStyles.swift)

**Files:**
- Create: `src/recreation/ui/buttons.tsx`
- Test: `tests/ui/buttons.test.tsx`

**Interfaces:**
- Consumes: `px` (B1), `useMotionPrefs`, `toTransition`, `INSTANT` (B1), `Motion.{hoverScale, press, highlight}` (contract §7);
  `PointerTarget` (type, contract §3.2, declared in `Recreation.tsx` by B23 — until then a local `type PointerTarget = string` alias in `buttons.tsx`, replaced in B23 Step 5).
- Produces:
  ```ts
  export type PressState = 'rest' | 'hover' | 'pressed';
  export function usePressState(disabled?: boolean): { state: PressState; handlers: Pick<DOMAttributes<HTMLElement>,
    'onPointerEnter' | 'onPointerLeave' | 'onPointerDown' | 'onPointerUp' | 'onPointerCancel'> };
  export function hoverScaleFor(state: PressState, reduceMotion: boolean): number;      // 1.06 hover, 0.94 pressed, 1 rest / reduced
  export function highlightAlpha(state: PressState): number;                            // 0, 0.10, 0.18
  export type FillKind = 'neutral' | 'selected' | 'prominent';
  export function notchFill(kind: FillKind, state: PressState, enabled: boolean): string;
  export function notchTextAlpha(state: PressState): number;                            // 0.6, 0.85, 0.95
  export function dayCellAlpha(state: PressState, selected: boolean, enabled: boolean): number; // 0 / 0.09 / 0.16
  type BaseProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style'> & { target?: PointerTarget; style?: CSSProperties };
  export const HoverButton: ForwardRefExoticComponent<BaseProps & RefAttributes<HTMLButtonElement>>;
  export const HoverHighlightButton: ForwardRefExoticComponent<BaseProps & { size: number } & RefAttributes<HTMLButtonElement>>;
  export const NotchFillButton: ForwardRefExoticComponent<BaseProps & { kind: FillKind; radius: number | null } & RefAttributes<HTMLButtonElement>>;
  export const NotchTextButton: ForwardRefExoticComponent<BaseProps & RefAttributes<HTMLButtonElement>>;
  export const DayCellButton: ForwardRefExoticComponent<BaseProps & { selected: boolean } & RefAttributes<HTMLButtonElement>>;
  export function KeyHint(props: { children: string }): JSX.Element;
  ```
  Every button renders `data-state={state}` and `data-qr-target={target}` when given; `type="button"`; `NotchFillButton` also renders `data-kind={kind}`.

Values (Swift): `HoverMotion` hoverScale 1.06, pressedScale 0.94, scale spring `.spring(duration: 0.22, bounce: 0.12)`
(`Motion.hoverScale`), press `.spring(duration: 0.14, bounce: 0)` (`Motion.press`), highlight 0.10 / 0.18 with
`.easeOut(0.12)` (`Motion.highlight`). `NotchFillButtonStyle`: neutral white 6 % / 11 % / 15 %; selected accent
20 % / 27 % / 32 % + `strokeBorder(accent 80 %, 1)`; prominent = the accent at every state, disabled `#474749`;
disabled opacity 0.55; press scale 0.97 (none under Reduce Motion); radius `nil` = capsule (999). `NotchTextButtonStyle`:
13/500, white 60 % / 85 % hover / 95 % pressed, padding-x 8, height 36. `KeyHint`: 11/600 white 50 %, background
white 10 % radius 4, padding 1 × 5, `aria-hidden`. `DayCellStyle`: white 9 % hover / 16 % pressed disc, only when
not selected and enabled. Hand cursor (`cursor: pointer`) only while enabled.

- [ ] **Step 1: Write the failing test**
  ```ts
  // @vitest-environment jsdom
  import './setup';
  import { render, screen, fireEvent, waitFor } from '@testing-library/react';
  import { hoverScaleFor, highlightAlpha, notchFill, notchTextAlpha, dayCellAlpha, HoverButton, NotchFillButton, HoverHighlightButton, KeyHint } from '../../src/recreation/ui/buttons';
  import { MotionPrefsProvider } from '../../src/recreation/ui/motionPrefs';
  import { ptOf } from './support';
  test('HoverMotion values', () => {
    expect([hoverScaleFor('rest', false), hoverScaleFor('hover', false), hoverScaleFor('pressed', false)]).toEqual([1, 1.06, 0.94]);
    expect(hoverScaleFor('hover', true)).toBe(1);
    expect([highlightAlpha('rest'), highlightAlpha('hover'), highlightAlpha('pressed')]).toEqual([0, 0.1, 0.18]);
    expect([notchTextAlpha('rest'), notchTextAlpha('hover'), notchTextAlpha('pressed')]).toEqual([0.6, 0.85, 0.95]);
    expect([dayCellAlpha('hover', false, true), dayCellAlpha('pressed', false, true), dayCellAlpha('hover', true, true), dayCellAlpha('hover', false, false)]).toEqual([0.09, 0.16, 0, 0]);
  });
  test('NotchFillButtonStyle fills', () => {
    expect(notchFill('neutral', 'rest', true)).toBe('rgba(255, 255, 255, 0.06)');
    expect(notchFill('neutral', 'hover', true)).toBe('rgba(255, 255, 255, 0.11)');
    expect(notchFill('neutral', 'pressed', true)).toBe('rgba(255, 255, 255, 0.15)');
    expect(notchFill('selected', 'rest', true)).toBe('var(--qr-accent-20)');
    expect(notchFill('selected', 'hover', true)).toBe('var(--qr-accent-27)');
    expect(notchFill('selected', 'pressed', true)).toBe('var(--qr-accent-32)');
    expect(notchFill('prominent', 'pressed', true)).toBe('var(--qr-list-accent)');
    expect(notchFill('prominent', 'rest', false)).toBe('var(--qr-gray-circle-disabled)');
  });
  test('HoverButton scales its label, not its hit frame', async () => {
    render(<HoverButton aria-label="Close" target="close">x</HoverButton>);
    const b = screen.getByRole('button', { name: 'Close' });
    expect(b.dataset.qrTarget).toBe('close');
    fireEvent.pointerEnter(b);
    expect(b.dataset.state).toBe('hover');
    await waitFor(() => expect((b.firstElementChild as HTMLElement).style.transform).toBe('scale(1.06)'));
    expect(b.style.transform).toBe('');
    fireEvent.pointerDown(b);
    await waitFor(() => expect((b.firstElementChild as HTMLElement).style.transform).toBe('scale(0.94)'));
    expect(b.style.cursor).toBe('pointer');
  });
  test('reduce motion: no scale', async () => {
    render(<MotionPrefsProvider value={{ reduceMotion: true, timeScale: 1 }}><HoverButton aria-label="Save">✓</HoverButton></MotionPrefsProvider>);
    const b = screen.getByRole('button', { name: 'Save' });
    fireEvent.pointerEnter(b);
    await waitFor(() => expect(b.dataset.state).toBe('hover'));
    expect(['', 'none'].includes((b.firstElementChild as HTMLElement).style.transform)).toBe(true);
  });
  test('NotchFillButton selected draws the accent stroke; disabled dims to 0.55', () => {
    const { rerender } = render(<NotchFillButton kind="selected" radius={12}>Tomorrow</NotchFillButton>);
    const b = screen.getByRole('button', { name: 'Tomorrow' });
    expect(b.style.boxShadow).toBe('inset 0 0 0 calc(1 * var(--pt) * 1px) var(--qr-accent-80)');
    expect(ptOf(b.style.borderRadius)).toBe(12);
    rerender(<NotchFillButton kind="prominent" radius={null} disabled>Set</NotchFillButton>);
    expect(b.style.opacity).toBe('0.55');
    expect(ptOf(b.style.borderRadius)).toBe(999);
    expect(b.style.cursor).toBe('default');
  });
  test('HoverHighlightButton: circular highlight of its own size', async () => {
    render(<HoverHighlightButton aria-label="Toggle flag" size={38}>f</HoverHighlightButton>);
    const b = screen.getByRole('button', { name: 'Toggle flag' });
    expect(ptOf(b.style.width)).toBe(38);
    const disc = b.querySelector('[data-qr-highlight]') as HTMLElement;
    expect(disc.style.borderRadius).toBe('50%');
    fireEvent.pointerEnter(b);
    await waitFor(() => expect(disc.style.backgroundColor).toBe('rgba(255, 255, 255, 0.1)'));
  });
  test('KeyHint', () => {
    render(<KeyHint>⏎</KeyHint>);
    const k = screen.getByText('⏎');
    expect(ptOf(k.style.fontSize)).toBe(11);
    expect(k.style.fontWeight).toBe('600');
    expect(k.style.color).toBe('rgba(255, 255, 255, 0.5)');
    expect(k.style.backgroundColor).toBe('rgba(255, 255, 255, 0.1)');
    expect(ptOf(k.style.borderRadius)).toBe(4);
    expect(k.getAttribute('aria-hidden')).toBe('true');
  });
  ```
- [ ] **Step 2: Run it** — `npx vitest run tests/ui/buttons.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.** `HoverButton` = `<button>` (unscaled hit frame, Swift `contentShape` after `scaleEffect`)
  wrapping a `motion.span` (`display: inline-flex`) animated to `scale: hoverScaleFor(...)` with `toTransition(Motion.hoverScale)`
  when only hover changed and `toTransition(Motion.press)` when pressed changed. `HoverHighlightButton`: `width/height = px(size)`,
  an absolutely positioned `motion.span data-qr-highlight` (inset 0, `border-radius: 50%`) animating `backgroundColor`
  `rgba(255, 255, 255, <highlightAlpha>)` with `Motion.highlight` (hover) / `Motion.press` (press), `INSTANT` under reduce
  (Swift `reduceMotion ? nil`). `NotchFillButton`: `motion.button` animating `backgroundColor` to `notchFill(...)` and
  `scale` to `0.97` while pressed (1 under reduce), stroke as `box-shadow: inset 0 0 0 px(1) var(--qr-accent-80)` for
  selected (`strokeBorder` draws inside), `opacity: 0.55` when disabled, `border-radius: px(radius ?? 999)`.
  `NotchTextButton`: font `px(13)` 500, colour `rgba(255, 255, 255, notchTextAlpha)`, padding `0 px(8)`, height `px(36)`.
  `DayCellButton`: full-cell button, centred 28 pt disc span with `dayCellAlpha`. Pointer state: pointerenter → hover,
  pointerdown → pressed, pointerup → hover, pointerleave/cancel → rest; disabled → always rest.
- [ ] **Step 4: Run it** — Expected: PASS (7 tests).
- [ ] **Step 5: Commit** — `git add src/recreation/ui/buttons.tsx tests/ui/buttons.test.tsx && git commit -m "feat(recreation): hover, highlight, fill and text button styles from HoverButtonStyle and NotchButtonStyles"`

---

### Task B5: Notch silhouette with animatable size and radii (`NotchSilhouette.tsx`)

**Files:**
- Create: `src/recreation/ui/NotchSilhouette.tsx`
- Test: `tests/ui/NotchSilhouette.test.tsx`

**Interfaces:**
- Consumes: `notchPathSegments`, `PathSegment` (`machine/notchShape.ts`); `Size` (`machine/notchLayout.ts`);
  `Motion.{open, close, saving, schedule, hoverIn, hoverOut}`, `toTransition`, `effective`, `INSTANT`, `FlagAnimation`, `useMotionPrefs`, `px` (B1).
- Produces:
  ```ts
  export interface ShapeTarget { readonly width: number; readonly height: number; readonly top: number; readonly bottom: number }
  /** The transaction the shape springs in, per NotchRuntimeHost.setFlags animation (PanelController.perform). */
  export function geometryTransition(animation: FlagAnimation, reduceMotion: boolean, timeScale: number): Transition;
  /** notchPathSegments(w, h, top, bottom) shifted right by (containerWidth − w) / 2, numbers rounded to 3 decimals, closed with "Z". */
  export function translatedNotchPath(shape: ShapeTarget, containerWidth: number): string;
  export interface NotchGeometry { readonly width: MotionValue<number>; readonly height: MotionValue<number>; readonly top: MotionValue<number>; readonly bottom: MotionValue<number> }
  export function useNotchGeometry(target: ShapeTarget, animation: FlagAnimation): NotchGeometry;
  export function useNotchPath(geometry: NotchGeometry, containerWidth: number): MotionValue<string>;
  export function NotchSilhouette(props: { geometry: NotchGeometry; canvas: Size; onHoverChange(entered: boolean): void; onPress(): void }): JSX.Element;
  ```

Rules (Swift `NotchShape.animatableData` animates both radii with the shape; `PanelController.perform`):
`open` → `effective('open')` (spring 0.42 / 0.78); `close` → `effective('close')` (0.30 / 0.92); `saving` →
`Motion.saving` (0.45 / 0.82; never under reduce: the machine turns a reduced save into a close); `schedule` →
`effective('schedule')` (0.38 / 0.80); `hoverIn` → `Motion.hoverIn` (0.32 / 0.55); `hoverOut` → `Motion.hoverOut`
(0.30 / 0.85); `none` → `INSTANT`. Width, height, top and bottom radius are four motion values animated with the
same transition (one SwiftUI transaction). The `<svg>` covers the canvas (`width/height = px(canvas)`,
`viewBox="0 0 W H"`, `pointer-events: none`); its single `<path fill="#000000">` has `pointer-events: visiblePainted`,
`data-qr-target="notch"`, and the handlers `onPointerEnter → onHoverChange(true)`, `onPointerLeave → onHoverChange(false)`,
`onPointerDown → onPress()` (Swift `NotchWindow.sendEvent` acts on mouse-down).

- [ ] **Step 1: Write the failing test**
  ```ts
  // @vitest-environment jsdom
  import './setup';
  import { render, fireEvent, waitFor } from '@testing-library/react';
  import { useNotchGeometry, NotchSilhouette, translatedNotchPath, geometryTransition, type ShapeTarget } from '../../src/recreation/ui/NotchSilhouette';
  import type { FlagAnimation } from '../../src/recreation/ui/transitions';
  import { ptOf } from './support';
  const CLOSED: ShapeTarget = { width: 235, height: 39, top: 6, bottom: 14 };
  const OPEN: ShapeTarget = { width: 600, height: 241, top: 19, bottom: 32 };
  function Harness(p: { target: ShapeTarget; animation: FlagAnimation; onHover?: (v: boolean) => void; onPress?: () => void }) {
    const g = useNotchGeometry(p.target, p.animation);
    return <NotchSilhouette geometry={g} canvas={{ width: 648, height: 775 }} onHoverChange={p.onHover ?? (() => {})} onPress={p.onPress ?? (() => {})} />;
  }
  test('path is centred in the canvas', () => {
    const d = translatedNotchPath(CLOSED, 648);
    expect(d.startsWith('M206.5 0 Q212.5 0 212.5 6 ')).toBe(true);  // (648 − 235) / 2 = 206.5; fillet control (6, 0) → (6, 6)
    expect(d.endsWith('Z')).toBe(true);
  });
  test('transition per animation', () => {
    expect((geometryTransition('open', false, 1) as any).stiffness).toBeCloseTo(223.80, 2);
    expect((geometryTransition('close', false, 1) as any).damping).toBeCloseTo(38.537, 3);
    expect((geometryTransition('saving', false, 1) as any).stiffness).toBeCloseTo(194.96, 2);
    expect((geometryTransition('schedule', false, 1) as any).damping).toBeCloseTo(26.456, 3);
    expect((geometryTransition('hoverIn', false, 1) as any).damping).toBeCloseTo(21.598, 3);
    expect((geometryTransition('hoverOut', false, 1) as any).damping).toBeCloseTo(35.605, 3);
    expect(geometryTransition('open', true, 1)).toEqual({ type: 'tween', ease: [0, 0, 0.58, 1], duration: 0.15 });
    expect(geometryTransition('none', false, 1)).toEqual({ duration: 0 });
  });
  test('the path follows the target', async () => {
    const { container, rerender } = render(<Harness target={CLOSED} animation="none" />);
    const svg = container.querySelector('svg')!;
    expect(ptOf(svg.style.width)).toBe(648);
    const path = container.querySelector('path[data-qr-target="notch"]')!;
    expect(path.getAttribute('d')).toBe(translatedNotchPath(CLOSED, 648));
    rerender(<Harness target={OPEN} animation="open" />);
    await waitFor(() => expect(path.getAttribute('d')).toBe(translatedNotchPath(OPEN, 648)));
  });
  test('hover and press on the black shape only', () => {
    const onHover = vi.fn(), onPress = vi.fn();
    const { container } = render(<Harness target={CLOSED} animation="none" onHover={onHover} onPress={onPress} />);
    const path = container.querySelector('path')!;
    expect((container.querySelector('svg') as SVGElement).style.pointerEvents).toBe('none');
    expect(path.style.pointerEvents).toBe('visiblePainted');
    fireEvent.pointerEnter(path); fireEvent.pointerLeave(path); fireEvent.pointerDown(path);
    expect(onHover.mock.calls).toEqual([[true], [false]]);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
  ```
- [ ] **Step 2: Run it** — `npx vitest run tests/ui/NotchSilhouette.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.** `useNotchGeometry`: four `useMotionValue`s initialised to the first target; on every
  change of `target` call `animate(mv, value, geometryTransition(animation, reduceMotion, timeScale))` for all four in
  the same effect (stop running animations first, so a reopen mid-collapse reverses from the current shape, SPEC §1
  "Reopen during the collapse animation"). `useNotchPath` = `useTransform([w, h, t, b], ([w, h, t, b]) => translatedNotchPath({ width: w, height: h, top: t, bottom: b }, containerWidth))`.
  `NotchSilhouette` renders `<motion.path d={path} />`.
- [ ] **Step 4: Run it** — Expected: PASS (4 tests).
- [ ] **Step 5: Commit** — `git add src/recreation/ui/NotchSilhouette.tsx tests/ui/NotchSilhouette.test.tsx && git commit -m "feat(recreation): animated notch silhouette with springing size and radii"`

---
### Task B6: RecreationStore — draft, suggestion, lists, flag, location, dirty (`store.ts`, part 1)

Port of `QuickReminderView`'s `@State` (title, notes, dueDate, flagged, locationText, showListPicker,
showLocationField, saveErrorText, suggestion, dismissedSuggestionText, presetPick) and of `resetState`,
`updateSuggestion`, `applySuggestionIfAny`, `stripSuggestionPhrase`, plus the `NotchState` flags mirror the views read.

**Files:**
- Create: `src/recreation/store.ts`
- Test: `tests/recreation/store.test.ts`

**Interfaces:**
- Consumes: `RecreationState` shape (contract §3.1); `NaturalDateParser.{parse, removingMatch}`, `DateSuggestion`;
  `ScheduleDefaults.resolveDayOnly`; `SuggestionDateFormatter`; `FAKE_LISTS`, `DEFAULT_LIST_ID`, `accentFor`, `ListId`;
  `ReminderDraft`, `SavedReminder`; `PresetPick`; `NotchFlags`, `NotchSizes`, `INITIAL_FLAGS`; `NotchMachineSnapshot`,
  `NotchPhase`; `Clock`; `Calendar`; `FlagAnimation` (B1).
- Produces:
  ```ts
  export interface RecreationState { /* exactly contract §3.1 */ }
  export type Origin = 'user' | 'api';
  export interface PanelView { readonly flags: NotchFlags; readonly animation: FlagAnimation; readonly sizes: NotchSizes; readonly ignoresMouse: boolean }
  export interface RecreationStoreOptions { readonly clock: Clock; readonly calendar: Calendar; readonly formatter: SuggestionDateFormatter; readonly sizes: NotchSizes }
  export class RecreationStore {
    constructor(opts: RecreationStoreOptions);
    getState(): RecreationState;                 // same object until something changes (useSyncExternalStore)
    getPanel(): PanelView;                       // same object until the flags / animation / ignoresMouse change
    subscribe(listener: () => void): () => void; // any change: state, panel or (B7) schedule
    get beepCount(): number;
    beep(): void;
    setFlags(patch: Partial<NotchFlags>, animation: FlagAnimation): void;
    setIgnoresMouse(ignores: boolean): void;
    setMachine(m: NotchMachineSnapshot): void;   // phase, schedule, hoverSwollen, badgeShown → RecreationState; settled/contentVisible come from setFlags
    resetDraft(): void;                          // .panelWillShow → resetState(); openedOnce = true
    closePopovers(): void;                       // .panelDidHide
    reset(opts: { keepSaved: boolean }): void;   // resetDraft + flags = INITIAL_FLAGS ('none') + listId default + popovers closed + dirty false + openedOnce false
    setTitle(text: string, origin: Origin): void;
    setNotes(text: string, origin: Origin): void;
    applySuggestion(origin: Origin): boolean;
    stripSuggestionPhrase(): void;
    dismissSuggestion(origin: Origin): void;
    setDueDate(date: Date | null, pick: PresetPick | null, origin: Origin): void;
    setListPickerOpen(open: boolean): void;
    setList(id: ListId, origin: Origin): void;
    setFlag(flagged: boolean, origin: Origin): void;
    setLocationPopoverOpen(open: boolean): void;
    setLocation(text: string | null, origin: Origin): void;  // "" → null (RecreationState.location never "")
    setSaveError(text: string | null): void;                  // never called on the site; keeps the slot 1:1
    markClean(): void;
    prepareReminder(): ReminderDraft | null;     // applies an undismissed suggestion first (save path), null when the title trims to ""
    appendSaved(item: SavedReminder): void;
  }
  ```

Rules (Swift `QuickReminderView`): the suggestion is re-parsed on every title change and whenever `dueDate` becomes
null; `parse(title, now floored to the second, calendar)`; while `dueDate != null` it is null; a parse whose
`matchedText` equals `dismissedSuggestionText` yields null; a null parse clears `dismissedSuggestionText`.
`applySuggestion`: none → false; date = `hasTime ? date : ScheduleDefaults.resolveDayOnly(date, now, calendar)`;
`dueDate` = date (presetPick unchanged: the app writes only `dueDate`); then `stripSuggestionPhrase()`:
`removingMatch(title, s)`, suggestion = null, title replaced only when the stripped text is not blank.
`resetDraft` keeps `listId` (the app persists `selectedListId` in `@AppStorage`) and `savedItems`.
`dirty` is set by every `'user'` change of a **draft field** (title, notes, listId, flagged, location, dueDate,
presetPick, an applied or dismissed suggestion); opening or closing a popover is not a draft change.
`canSave` = `title.trim() !== ''`; `accent` = `accentFor(listId)`; `schedulingInNotch` = `schedule !== 'none'`.

- [ ] **Step 1: Write the failing test** `tests/recreation/store.test.ts`
  ```ts
  // @vitest-environment jsdom
  import '../ui/setup';
  import { RecreationStore } from '../../src/recreation/store';
  import { SuggestionDateFormatter } from '../../src/recreation/core/suggestionDateFormatter';
  import { sizesFor } from '../../src/recreation/machine/notchState';
  import { TEST_NOW, testCalendar } from '../ui/support';
  import { plainSpaces } from '../support';
  const formatter = new SuggestionDateFormatter({ locale: 'en-US', calendar: testCalendar });
  const make = () => new RecreationStore({ clock: () => TEST_NOW, calendar: testCalendar, formatter, sizes: sizesFor({ width: 221, height: 38 }, 982, 0) });

  test('initial state', () => {
    const s = make().getState();
    expect(s).toMatchObject({ phase: { type: 'closed', parked: false }, schedule: 'none', title: '', notes: '', listId: 'reminders',
      flagged: false, location: null, dueDate: null, suggestion: null, canSave: false, accent: '#0A84FF', dirty: false,
      savedItems: [], openedOnce: false, listPickerOpen: false, locationPopoverOpen: false, saveError: null });
  });
  test('typing a phrase shows the suggestion and turns ✓ on', () => {
    const st = make();
    st.setTitle('Call mum tomorrow at 2pm', 'user');
    const s = st.getState();
    expect(s.suggestion!.matchedText).toBe('tomorrow at 2pm');
    expect(plainSpaces(formatter.string(s.suggestion!.date, s.suggestion!.hasTime, TEST_NOW))).toBe('Tomorrow, 2:00 PM');
    expect(s.canSave).toBe(true);
    expect(s.dirty).toBe(true);
  });
  test('Tab applies: due date set, phrase stripped', () => {
    const st = make();
    st.setTitle('Call mum tomorrow at 2pm', 'user');
    expect(st.applySuggestion('user')).toBe(true);
    expect(st.getState()).toMatchObject({ title: 'Call mum', suggestion: null, dueDate: new Date('2026-09-19T12:00:00Z') });
    expect(st.applySuggestion('user')).toBe(false);
  });
  test('day-only phrases go through resolveDayOnly (9:00)', () => {
    const st = make();
    st.setTitle('Call mum tomorrow', 'user');
    st.applySuggestion('user');
    expect(st.getState().dueDate).toEqual(new Date('2026-09-19T07:00:00Z'));
  });
  test('a title that is only the phrase keeps its text', () => {
    const st = make();
    st.setTitle('tomorrow', 'user');
    st.applySuggestion('user');
    expect(st.getState().title).toBe('tomorrow');
  });
  test('ⓧ dismisses for that phrase only', () => {
    const st = make();
    st.setTitle('Call tomorrow at 2pm', 'user');
    st.dismissSuggestion('user');
    expect(st.getState()).toMatchObject({ suggestion: null, dismissedSuggestionText: 'tomorrow at 2pm' });
    st.setTitle('Call tomorrow at 2pm!', 'user');
    expect(st.getState().suggestion).toBeNull();
    st.setTitle('Call', 'user');
    expect(st.getState().dismissedSuggestionText).toBeNull();
    st.setTitle('Call tomorrow at 2pm', 'user');
    expect(st.getState().suggestion!.matchedText).toBe('tomorrow at 2pm');
  });
  test('no suggestion while a date is set; it comes back when the date is cleared', () => {
    const st = make();
    st.setDueDate(new Date('2026-09-20T07:00:00Z'), null, 'user');
    st.setTitle('Pay rent tomorrow', 'user');
    expect(st.getState().suggestion).toBeNull();
    st.setDueDate(null, null, 'user');
    expect(st.getState().suggestion!.matchedText).toBe('tomorrow');
  });
  test('list, flag, location', () => {
    const st = make();
    st.setListPickerOpen(true);
    st.setList('work', 'user');
    expect(st.getState()).toMatchObject({ listId: 'work', accent: '#BF5AF2', listPickerOpen: false });
    st.setFlag(true, 'user');
    st.setLocation('', 'user');
    expect(st.getState().location).toBeNull();
    st.setLocation('Office', 'user');
    expect(st.getState()).toMatchObject({ flagged: true, location: 'Office' });
  });
  test("'api' writes never set dirty; markClean clears it", () => {
    const st = make();
    st.setTitle('x', 'api'); st.setList('home', 'api'); st.setFlag(true, 'api');
    expect(st.getState().dirty).toBe(false);
    st.setNotes('n', 'user');
    expect(st.getState().dirty).toBe(true);
    st.markClean();
    expect(st.getState().dirty).toBe(false);
    st.setListPickerOpen(true);
    expect(st.getState().dirty).toBe(false);
  });
  test('resetDraft = resetState(): list kept, openedOnce set', () => {
    const st = make();
    st.setList('ideas', 'user'); st.setTitle('a tomorrow', 'user'); st.setNotes('n', 'user'); st.setFlag(true, 'user');
    st.setLocation('Office', 'user'); st.setSaveError('x'); st.dismissSuggestion('user');
    st.resetDraft();
    expect(st.getState()).toMatchObject({ title: '', notes: '', dueDate: null, flagged: false, location: null, saveError: null,
      suggestion: null, dismissedSuggestionText: null, presetPick: null, listId: 'ideas', openedOnce: true });
  });
  test('prepareReminder auto-applies an undismissed suggestion (like iOS Reminders)', () => {
    const st = make();
    expect(st.prepareReminder()).toBeNull();
    st.setTitle('  Call mum tomorrow at 2pm ', 'user');
    expect(st.prepareReminder()).toEqual({ title: 'Call mum', notes: '', listId: 'reminders',
      dueDate: new Date('2026-09-19T12:00:00Z'), flagged: false, location: null });
  });
  test('panel mirror: stable snapshots, one notification per change', () => {
    const st = make();
    const fn = vi.fn();
    st.subscribe(fn);
    const p0 = st.getPanel(), s0 = st.getState();
    expect(st.getPanel()).toBe(p0);
    st.setFlags({ isOpen: true, contentVisible: true }, 'open');
    expect(st.getPanel()).not.toBe(p0);
    expect(st.getPanel()).toMatchObject({ animation: 'open', flags: { isOpen: true, contentVisible: true, isSettled: false } });
    expect(st.getState().contentVisible).toBe(true);
    expect(st.getState()).not.toBe(s0);
    expect(fn).toHaveBeenCalledTimes(1);
    st.beep();
    expect(st.beepCount).toBe(1);
  });
  ```
- [ ] **Step 2: Run it** — `npx vitest run tests/recreation/store.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `store.ts` with the signatures above. `RecreationState.contentVisible` / `settled` mirror
  `flags.contentVisible` / `flags.isSettled`; `phase`, `schedule`, `hoverSwollen`, `badgeShown` come from `setMachine`.
  `getState()` and `getPanel()` are rebuilt only inside mutations (never in the getters).
- [ ] **Step 4: Run it** — Expected: PASS (12 tests).
- [ ] **Step 5: Commit** — `git add src/recreation/store.ts tests/recreation/store.test.ts && git commit -m "feat(recreation): RecreationStore with draft, suggestion, lists, flag, location and dirty tracking"`

---

### Task B7: RecreationStore — the Set Date draft (`store.ts`, part 2)

Port of `ScheduleNotchSection`'s state (`model`, `timeText`, `calendarMonth`) and its decisions (`finish`,
`saveFromBar` → `ScheduleDraft.prepareSave`, `applyTypedTime`, `moveDay`, `page`), kept in the store so the
controller and the `RecreationHandle` reach them without the view.

**Files:**
- Modify: `src/recreation/store.ts`
- Test: `tests/recreation/storeSchedule.test.ts`

**Interfaces:**
- Consumes: `ScheduleDraft`, `ScheduleOutcome` (contract §2.7); `MonthGrid.{startOfMonth, shiftMonth, canGoBack}`;
  `SuggestionDateFormatter.time`; B6 store.
- Produces (added to `RecreationStore`):
  ```ts
  export type SaveDecision =
    | { readonly type: 'saveAsIs' }
    | { readonly type: 'commitThenSave'; readonly outcome: ScheduleOutcome }
    | { readonly type: 'invalid' };
  // RecreationStore
  openScheduleDraft(): ScheduleDraft;     // new ScheduleDraft({ selected: dueDate, initialText: dueDate === null ? suggestion?.matchedText ?? null : null, calendar, clock })
  get scheduleDraft(): ScheduleDraft | null;
  closeScheduleDraft(): void;             // the section keeps rendering its own reference while it fades out (B19)
  get scheduleVersion(): number;          // +1 on every draft, timeText or calendarMonth change
  get calendarMonth(): Date;              // MonthGrid.startOfMonth(draft) at open, then follows the draft
  get timeText(): string;                 // the time field's text; formatter.time(draft) unless the field is being edited
  setScheduleText(text: string, origin: Origin): void;
  editSchedule(edit: (d: ScheduleDraft) => void, origin: Origin): void;  // pick / setTime / stepTime / moveDay / moveInto
  setTimeText(text: string): void;
  setTimeFieldEditing(editing: boolean): void;
  applyTimeText(): boolean;               // false = not a time: timeText reverts, draft unchanged
  pageMonth(delta: -1 | 1): boolean;      // −1 blocked by MonthGrid.canGoBack
  moveDayInGrid(days: -7 | -1 | 1 | 7): boolean;  // paged away → moveInto(calendarMonth); else moveDay; false → beep()
  finishSchedule(outcome: ScheduleOutcome | null, origin: Origin): boolean;  // writes dueDate / presetPick, strips the phrase when consumesSuggestion
  saveDecision(): SaveDecision;           // ScheduleDraft.prepareSave
  ```

Rules: "touched" (Swift `ScheduleDraft.isDirty`) becomes true on any `setScheduleText` that changes the text and on
every `editSchedule` / successful `applyTimeText`; `saveDecision()`: not touched or `draft.committed` → `saveAsIs`;
else `outcome = draft.set()`, null → `invalid`, otherwise `commitThenSave`. After every draft change: if
`startOfMonth(draft.draft) !== calendarMonth` the month follows (Swift `.onChange(of: model.draft)`), and `timeText`
re-syncs unless the time field is being edited. `applyTimeText`: trimmed text equal to `formatter.time(draft)` →
true, no change; else `draft.applyTypedTime(typed)`; on false the text reverts. `'user'` edits set `dirty` only
through `finishSchedule` (the reminder's date), not through draft edits.

- [ ] **Step 1: Write the failing test** `tests/recreation/storeSchedule.test.ts` (same `make()` as B6)
  ```ts
  const sat9 = new Date('2026-09-19T07:00:00Z');
  test('opens on tomorrow 9:00 with no date and no phrase', () => {
    const st = make();
    const d = st.openScheduleDraft();
    expect(d.draft).toEqual(sat9);
    expect(d.text).toBe('');
    expect(st.calendarMonth).toEqual(new Date('2026-08-31T22:00:00Z'));   // 1 Sep 2026 00:00 Prague
    expect(plainSpaces(st.timeText)).toBe('9:00 AM');
  });
  test('opens on the live phrase, prefilled', () => {
    const st = make();
    st.setTitle('Call mum tomorrow at 2pm', 'user');
    const d = st.openScheduleDraft();
    expect(d.text).toBe('tomorrow at 2pm');
    expect(d.draft).toEqual(new Date('2026-09-19T12:00:00Z'));
  });
  test('an existing date wins and the field is empty', () => {
    const st = make();
    st.setDueDate(new Date('2026-09-25T16:00:00Z'), null, 'user');
    expect(st.openScheduleDraft()).toMatchObject({ text: '', draft: new Date('2026-09-25T16:00:00Z') });
  });
  test('Set from the phrase consumes it; Clear keeps it', () => {
    const st = make();
    st.setTitle('Call mum tomorrow at 2pm', 'user');
    const d = st.openScheduleDraft();
    expect(st.finishSchedule(d.set(), 'user')).toBe(true);
    expect(st.getState()).toMatchObject({ dueDate: new Date('2026-09-19T12:00:00Z'), title: 'Call mum', presetPick: null });
    const st2 = make();
    st2.setTitle('Call mum tomorrow at 2pm', 'user');
    st2.finishSchedule(st2.openScheduleDraft().clear(), 'user');
    expect(st2.getState()).toMatchObject({ dueDate: null, title: 'Call mum tomorrow at 2pm' });
    expect(st2.finishSchedule(null, 'user')).toBe(false);
  });
  test('✓ while open: untouched saves as is, an edit is Set first, a non-date is invalid', () => {
    const st = make();
    st.openScheduleDraft();
    expect(st.saveDecision()).toEqual({ type: 'saveAsIs' });
    st.setScheduleText('+2h', 'user');
    const dec = st.saveDecision();
    expect(dec.type).toBe('commitThenSave');
    expect((dec as any).outcome.date).toEqual(new Date('2026-09-18T10:00:00Z'));
    const st2 = make();
    st2.openScheduleDraft();
    st2.setScheduleText('tomorrow please', 'user');
    expect(st2.saveDecision()).toEqual({ type: 'invalid' });
  });
  test('typed time: valid applies, invalid reverts', () => {
    const st = make();
    st.openScheduleDraft();
    st.setTimeFieldEditing(true);
    st.setTimeText('1430');
    expect(st.applyTimeText()).toBe(true);
    st.setTimeFieldEditing(false);
    expect(st.scheduleDraft!.draft).toEqual(new Date('2026-09-19T12:30:00Z'));
    expect(plainSpaces(st.timeText)).toBe('2:30 PM');
    st.setTimeText('abc');
    expect(st.applyTimeText()).toBe(false);
    expect(plainSpaces(st.timeText)).toBe('2:30 PM');
  });
  test('month paging and arrow movement', () => {
    const st = make();
    st.openScheduleDraft();
    expect(st.pageMonth(-1)).toBe(false);                          // current month: canGoBack false
    expect(st.pageMonth(1)).toBe(true);
    expect(st.calendarMonth).toEqual(new Date('2026-09-30T22:00:00Z'));   // 1 Oct 2026 00:00 Prague
    expect(st.moveDayInGrid(1)).toBe(true);                       // paged away → lands on the same day number
    expect(st.scheduleDraft!.draft).toEqual(new Date('2026-10-19T07:00:00Z'));
    const st2 = make();
    st2.openScheduleDraft();
    expect(st2.moveDayInGrid(-1)).toBe(true);                     // Sat 19 → Fri 18 (today is allowed)
    expect(st2.moveDayInGrid(-1)).toBe(false);                    // never before today
    expect(st2.beepCount).toBe(1);
  });
  test('the month follows the draft; stepTime snaps to 15 min', () => {
    const st = make();
    st.openScheduleDraft();
    st.editSchedule(d => d.stepTime(1), 'user');
    expect(plainSpaces(st.timeText)).toBe('9:15 AM');
    st.editSchedule(d => d.pick(new Date('2026-10-02T22:00:00Z')), 'user');   // 3 Oct 00:00 Prague
    expect(st.calendarMonth).toEqual(new Date('2026-09-30T22:00:00Z'));
    expect(st.saveDecision().type).toBe('commitThenSave');
  });
  ```
- [ ] **Step 2: Run it** — `npx vitest run tests/recreation/storeSchedule.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the methods above in `store.ts`. `finishSchedule(outcome)`: null → false; else
  `setDueDate(outcome.date, outcome.presetPick, origin)`, then `stripSuggestionPhrase()` when
  `outcome.consumesSuggestion` (Swift `finish(_:)`); true.
- [ ] **Step 4: Run it** — `npx vitest run tests/recreation/store.test.ts tests/recreation/storeSchedule.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** — `git add src/recreation/store.ts tests/recreation/storeSchedule.test.ts && git commit -m "feat(recreation): Set Date draft in the store with prepareSave, typed time and month paging"`

---

### Task B8: NotchRuntime — PanelController's effect performer with browser timers (`runtime.ts`)

**Files:**
- Create: `src/recreation/runtime.ts`
- Test: `tests/recreation/runtime.test.ts`

**Interfaces:**
- Consumes: `NotchMachine`, `NotchEvent`, `NotchEffect`, `NotchMachineSnapshot` (contract §2.14); `NotchFlags`;
  `FlagAnimation` (B1); `NotchLayout.{closeDuration, savedHold, hoverDwell, settleDelay, focusRetryDelays}`.
- Produces (contract §3.4 plus D5 additions):
  ```ts
  export interface NotchRuntimeHost { /* exactly contract §3.4; setFlags' animation param is FlagAnimation */ }
  export interface NotchRuntimeOptions {
    reduceMotion: () => boolean; timeScale: () => number; hasNotch: () => boolean; pointerOnNotch: () => boolean;
    onDispatched?: (event: NotchEvent, snapshot: NotchMachineSnapshot) => void;   // D5
  }
  export class NotchRuntime {
    constructor(host: NotchRuntimeHost, opts: NotchRuntimeOptions);   // dispatches screenChanged({ hasNotch: opts.hasNotch() }) at once (PanelController.init parks)
    dispatch(event: NotchEvent): void;
    get machine(): NotchMachineSnapshot;
    reset(): void;      // D5: clears every timer, new NotchMachine(), dispatches screenChanged again
    destroy(): void;
  }
  export const RUNTIME_TIMERS: { readonly close: 0.36; readonly savedHold: 1.0; readonly settle: 0.5; readonly hoverDwell: 0.09; readonly focusRetries: readonly [0.12, 0.30] };
  ```

Effect → action (Swift `PanelController.perform`); every delay is seconds × `timeScale()` × 1000 ms:

| Effect | Web |
|---|---|
| `configureGeometry`, `relayoutOpenWindow`, `makeKeyAndOrderFront`, `growCanvasForSchedule`, `fitCanvasToPanel`, `installLocalMonitor`, `removeLocalMonitor` | no-op (the canvas is CSS and never resizes; the container listens while `isVisible`) |
| `switchToOpenCanvas` | `setFlags({ schedule: 'none', isOpen: false, contentVisible: false }, 'none')` |
| `park` | `setFlags({ isOpen: false, contentVisible: false, isHovering: false }, 'none')` |
| `orderOut` | `setFlags({ isOpen: false, contentVisible: false }, 'none')` |
| `setIgnoresMouse(b)` / `resignFirstResponder` / `haptic` | `host.setIgnoresMouse(b)` / `host.blurAll()` / `host.haptic()` |
| `postWillShow` / `postDidHide` | `host.willShow()` / `host.didHide()` |
| `animateOpen` | next turn (`setTimeout(…, 0)`, Swift `DispatchQueue.main.async`): `setFlags({ isSaving: false, isHovering: false, isOpen: true, contentVisible: true }, 'open')` |
| `animateClose` | `setFlags({ contentVisible: false, isOpen: false, isSaving: false, schedule: 'none' }, 'close')` |
| `animateSaving` | `setFlags({ contentVisible: false, isOpen: false, isSaving: true, schedule: 'none', savedBadgeShown: true }, 'saving')` |
| `clearBadgeNoAnimation` / `setSettled(b)` | `setFlags({ savedBadgeShown: false }, 'none')` / `setFlags({ isSettled: b }, 'none')` |
| `swellHover` / `unswellHover` | `setFlags({ isHovering: true }, 'hoverIn')` / `setFlags({ isHovering: false }, 'hoverOut')` |
| `animateSchedule(x)` | `setFlags({ schedule: x }, 'schedule')` |
| `scheduleClose` / `cancelClose` | 0.36 s → `closeTimerFired({ hasNotch: hasNotch() })` / clear |
| `scheduleSaveHold` / `cancelSaveHold` | 1.0 s → `saveHoldElapsed` / clear |
| `scheduleSettle(g)` | 0.5 s → `settleTimerFired({ generation: g })` |
| `scheduleFocusRetries` | 0.12 s and 0.30 s → `host.focusTitle()` |
| `scheduleHoverDwell` / `cancelHoverDwell` | 0.09 s → `hoverDwellElapsed({ reduceMotion: reduceMotion() })` / clear |

`dispatch` queues like `PanelController.dispatch` (an event raised while effects run is handled after the batch);
`machine.handle(event, pointerOnNotch)` receives `opts.pointerOnNotch()` only for `closeTimerFired(true)` and
`screenChanged(true)`, `false` otherwise; `onDispatched` runs after each event's effects.

- [ ] **Step 1: Write the failing test** `tests/recreation/runtime.test.ts`
  ```ts
  // @vitest-environment jsdom
  import '../ui/setup';
  import { NotchRuntime, type NotchRuntimeHost } from '../../src/recreation/runtime';
  import { useTestTime } from '../ui/support';
  const host = (): NotchRuntimeHost & Record<string, any> => ({ setFlags: vi.fn(), focusTitle: vi.fn(), blurAll: vi.fn(),
    setIgnoresMouse: vi.fn(), haptic: vi.fn(), willShow: vi.fn(), didHide: vi.fn() });
  const make = (h: any, o: Partial<{ reduce: boolean; scale: number; onNotch: boolean }> = {}) => new NotchRuntime(h, {
    reduceMotion: () => o.reduce ?? false, timeScale: () => o.scale ?? 1, hasNotch: () => true, pointerOnNotch: () => o.onNotch ?? false });
  beforeEach(() => useTestTime());

  test('parks at construction', () => {
    const h = host(); const rt = make(h);
    expect(rt.machine.phase).toEqual({ type: 'closed', parked: true });
    expect(h.setFlags).toHaveBeenCalledWith({ isOpen: false, contentVisible: false, isHovering: false }, 'none');
  });
  test('show: will-show now, open spring next turn, focus at 0.12 / 0.30 s, settled at 0.5 s', () => {
    const h = host(); const rt = make(h);
    rt.dispatch({ type: 'show' });
    expect(h.willShow).toHaveBeenCalledTimes(1);
    expect(h.setIgnoresMouse).toHaveBeenLastCalledWith(false);
    expect(h.setFlags).not.toHaveBeenCalledWith(expect.anything(), 'open');
    vi.advanceTimersByTime(0);
    expect(h.setFlags).toHaveBeenLastCalledWith({ isSaving: false, isHovering: false, isOpen: true, contentVisible: true }, 'open');
    vi.advanceTimersByTime(119); expect(h.focusTitle).toHaveBeenCalledTimes(0);
    vi.advanceTimersByTime(1);   expect(h.focusTitle).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(180); expect(h.focusTitle).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(199); expect(h.setFlags).not.toHaveBeenCalledWith({ isSettled: true }, 'none');
    vi.advanceTimersByTime(1);   expect(h.setFlags).toHaveBeenLastCalledWith({ isSettled: true }, 'none');
  });
  test('?debug=motion stretches every timer 4×', () => {
    const h = host(); const rt = make(h, { scale: 4 });
    rt.dispatch({ type: 'show' });
    vi.advanceTimersByTime(1999); expect(h.setFlags).not.toHaveBeenCalledWith({ isSettled: true }, 'none');
    vi.advanceTimersByTime(1);    expect(h.setFlags).toHaveBeenLastCalledWith({ isSettled: true }, 'none');
  });
  test('hide: close spring, parked after 0.36 s', () => {
    const h = host(); const rt = make(h);
    rt.dispatch({ type: 'show' }); vi.advanceTimersByTime(600);
    rt.dispatch({ type: 'hide' });
    expect(h.didHide).toHaveBeenCalledTimes(1);
    expect(h.blurAll).toHaveBeenCalled();
    expect(h.setFlags).toHaveBeenCalledWith({ contentVisible: false, isOpen: false, isSaving: false, schedule: 'none' }, 'close');
    vi.advanceTimersByTime(359); expect(rt.machine.phase).toEqual({ type: 'closing' });
    vi.advanceTimersByTime(1);   expect(rt.machine.phase).toEqual({ type: 'closed', parked: true });
  });
  test('save: saved pill, 1.0 s hold, then close', () => {
    const h = host(); const rt = make(h);
    rt.dispatch({ type: 'show' }); vi.advanceTimersByTime(600);
    rt.dispatch({ type: 'save', reduceMotion: false });
    expect(h.setFlags).toHaveBeenCalledWith({ contentVisible: false, isOpen: false, isSaving: true, schedule: 'none', savedBadgeShown: true }, 'saving');
    expect(h.setIgnoresMouse).toHaveBeenLastCalledWith(true);
    vi.advanceTimersByTime(999);  expect(rt.machine.phase).toEqual({ type: 'saving' });
    vi.advanceTimersByTime(1);    expect(rt.machine.phase).toEqual({ type: 'closing' });
    vi.advanceTimersByTime(360);  expect(rt.machine.phase).toEqual({ type: 'closed', parked: true });
    expect(h.setFlags).toHaveBeenCalledWith({ savedBadgeShown: false }, 'none');
  });
  test('save with reduce motion is a plain close', () => {
    const h = host(); const rt = make(h);
    rt.dispatch({ type: 'show' }); vi.advanceTimersByTime(600);
    rt.dispatch({ type: 'save', reduceMotion: true });
    expect(rt.machine.phase).toEqual({ type: 'closing' });
    expect(h.setFlags).not.toHaveBeenCalledWith(expect.anything(), 'saving');
  });
  test('hover: 90 ms dwell, then swell; reduce motion → haptic only', () => {
    const h = host(); const rt = make(h);
    rt.dispatch({ type: 'hoverEntered' });
    vi.advanceTimersByTime(89); expect(h.setFlags).not.toHaveBeenCalledWith({ isHovering: true }, 'hoverIn');
    vi.advanceTimersByTime(1);  expect(h.setFlags).toHaveBeenLastCalledWith({ isHovering: true }, 'hoverIn');
    expect(h.haptic).toHaveBeenCalledTimes(1);
    rt.dispatch({ type: 'hoverExited' });
    expect(h.setFlags).toHaveBeenLastCalledWith({ isHovering: false }, 'hoverOut');
    const h2 = host(); const rt2 = make(h2, { reduce: true });
    rt2.dispatch({ type: 'hoverEntered' }); vi.advanceTimersByTime(90);
    expect(h2.setFlags).not.toHaveBeenCalledWith({ isHovering: true }, 'hoverIn');
    expect(h2.haptic).toHaveBeenCalledTimes(1);
  });
  test('Set Date grows with the schedule spring and re-settles', () => {
    const h = host(); const rt = make(h);
    rt.dispatch({ type: 'show' }); vi.advanceTimersByTime(600);
    rt.dispatch({ type: 'scheduleChanged', expansion: 'controls' });
    expect(h.setFlags).toHaveBeenCalledWith({ isSettled: false }, 'none');
    expect(h.setFlags).toHaveBeenLastCalledWith({ schedule: 'controls' }, 'schedule');
    vi.advanceTimersByTime(500);
    expect(h.setFlags).toHaveBeenLastCalledWith({ isSettled: true }, 'none');
  });
  test('events raised during effects run after the batch', () => {
    const h = host(); let rt!: NotchRuntime;
    h.willShow = vi.fn(() => rt.dispatch({ type: 'hide' }));
    rt = make(h);
    rt.dispatch({ type: 'show' });
    expect(rt.machine.phase).toEqual({ type: 'closing' });
  });
  test('destroy clears timers; reset parks a fresh machine', () => {
    const h = host(); const rt = make(h);
    rt.dispatch({ type: 'show' }); rt.destroy();
    const n = h.setFlags.mock.calls.length;
    vi.advanceTimersByTime(1000);
    expect(h.setFlags.mock.calls.length).toBe(n);
    const rt2 = make(host()); rt2.dispatch({ type: 'show' }); rt2.reset();
    expect(rt2.machine.phase).toEqual({ type: 'closed', parked: true });
  });
  ```
- [ ] **Step 2: Run it** — `npx vitest run tests/recreation/runtime.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `runtime.ts` per the table. Timer handles live in a `Map<'close' | 'saveHold' | 'hoverDwell', number>`
  plus a `Set<number>` for settle / focus / next-turn timers; `destroy` and `reset` clear both.
- [ ] **Step 4: Run it** — Expected: PASS (10 tests).
- [ ] **Step 5: Commit** — `git add src/recreation/runtime.ts tests/recreation/runtime.test.ts && git commit -m "feat(recreation): NotchRuntime performs machine effects with scaled browser timers"`

---

### Task B9: RecreationController, focus registry and React context (`controller.ts`, `ui/focus.ts`, `ui/RecreationContext.tsx`)

The controller is where `QuickReminderView`'s actions and `PanelController`'s public API meet: every UI handler and
every `RecreationHandle` method goes through it, with an `origin`.

**Files:**
- Create: `src/recreation/controller.ts`, `src/recreation/ui/focus.ts`, `src/recreation/ui/RecreationContext.tsx`
- Modify: `tests/ui/support.tsx` (add `createTestCore`, `renderWithCore`)
- Test: `tests/recreation/controller.test.ts`

**Interfaces:**
- Consumes: B6/B7 store, B8 runtime; `sizesFor`, `panelSize` (contract §2.16); `SuggestionDateFormatter`; `toSavedReminder`;
  `DatePresets.date`, `DATE_PRESETS`, `DatePreset`; `ScheduleCommit.{textRowSubmit, consumesSuggestion}`; `afterEscape`;
  `NotchLayout.{scheduleSectionTop, clickCancelsSchedule}`; `RUNTIME_TIMERS`; `MotionPrefsProvider` (B1); `ShowSource` (contract §3.2).
- Produces:
  ```ts
  // ui/focus.ts
  export type FocusField = 'title' | 'notes' | 'scheduleField' | 'timeField' | 'calendar' | 'locationField';
  export interface FocusRegistry {
    setRoot(el: HTMLElement | null): void;
    register(field: FocusField, el: HTMLElement | null): void;   // elements also carry data-qr-field="<field>"
    focus(field: FocusField): boolean;   // el.focus({ preventScroll: true }); inputs get the caret at the end (SingleLineTextView); false when not mounted
    active(): FocusField | null;
    isInside(): boolean;                 // document.activeElement inside the root
    blur(): void;                        // blurs activeElement when inside the root
  }
  export function createFocusRegistry(): FocusRegistry;
  // controller.ts
  export interface RecreationCoreOptions {
    notch: Size; screenHeight: number; dockHeight: number; clock: Clock; calendar: Calendar; locale: string; hour12?: boolean;
    reduceMotion: () => boolean; timeScale: () => number; onSaved?: (item: SavedReminder) => void;
  }
  export interface RecreationCore { readonly store: RecreationStore; readonly runtime: NotchRuntime; readonly controller: RecreationController;
    readonly focus: FocusRegistry; readonly formatter: SuggestionDateFormatter; readonly sizes: NotchSizes; readonly calendar: Calendar; readonly clock: Clock }
  export function createRecreationCore(opts: RecreationCoreOptions): RecreationCore;
  export type EscapeResult = 'calendar' | 'section' | 'popover' | 'panel' | 'none';
  export class RecreationController {
    show(source: ShowSource, focus: boolean): Promise<void>;     // 'click' → notchTapped, else show; resolves after settle (0.5 s × scale), at once when the machine did nothing
    hide(): Promise<void>;                                       // resolves after 0.36 s × scale (at once when not visible)
    toggle(): void;                                              // ⇧⌘R: open → hide, else show('hotkey', true)
    hover(entered: boolean): void;                               // hoverEntered / hoverExited + pointerOnNotch bookkeeping
    escape(): EscapeResult;                                      // D2 order
    save(origin: Origin): Promise<SavedReminder | null>;         // ⌘↩ / API: section open → commitSchedule, resolves null
    saveFromBar(origin: Origin): Promise<SavedReminder | null>;  // ✓ click: SaveDecision while the section is open
    textRowSubmit(origin: Origin): Promise<SavedReminder | null>;// ↩ in title / notes: ScheduleCommit.textRowSubmit
    setTitle(t: string, o: Origin): void; setNotes(t: string, o: Origin): void;
    applySuggestion(o: Origin): boolean; dismissSuggestion(o: Origin): void;
    openSchedule(o: Origin): void; toggleSchedule(o: Origin): void; openCalendar(o: Origin): void; closeCalendar(o: Origin): void;
    toggleCalendar(o: Origin): void; cancelSchedule(o: Origin): void; commitSchedule(o: Origin): boolean;
    applyPreset(p: DatePreset, o: Origin): void; clearDueDate(o: Origin): void; setDueDate(d: Date | null, pick: PresetPick | null, o: Origin): void;
    setScheduleText(t: string, o: Origin): void; pickDay(day: Date, o: Origin): void; setTime(h: number, m: number, o: Origin): void;
    stepTime(steps: 1 | -1, o: Origin): void; applyTypedTime(beepOnInvalid: boolean): boolean; pageMonth(d: -1 | 1): void; moveDay(days: -7 | -1 | 1 | 7): void;
    toggleListPicker(): void; openListPicker(): void; closeListPicker(): void; setList(id: ListId, o: Origin): void;
    toggleFlag(o: Origin): void; setFlag(f: boolean, o: Origin): void;
    openLocationPopover(o: Origin): void; closeLocationPopover(): void; setLocation(t: string | null, o: Origin): void;
    pointerDownInPanel(yPt: number): void;                       // clickCancelsSchedule band (header / title / notes)
    pointerDownOutside(): void;                                  // a click outside the black shape: closes any popover and hides the panel (global click monitor)
    destroy(): void;
  }
  // ui/RecreationContext.tsx
  export function RecreationProvider(props: { core: RecreationCore; reduceMotion: boolean; timeScale: number; children: ReactNode }): JSX.Element;
  export function useCore(): RecreationCore;
  export function useRecreationState(): RecreationState;   // useSyncExternalStore(store.subscribe, store.getState)
  export function usePanel(): PanelView;
  export function useScheduleDraft(): ScheduleDraft | null; // re-renders on scheduleVersion
  // tests/ui/support.tsx
  export function createTestCore(o?: Partial<RecreationCoreOptions>): RecreationCore;   // clock () => new Date(), testCalendar, en-US, 982 / 0, scale 1
  export function renderWithCore(ui: ReactElement, core?: RecreationCore, prefs?: { reduceMotion?: boolean }): RenderResult & { core: RecreationCore };   // its rerender(ui) re-wraps ui in the same RecreationProvider
  export async function openPanel(core: RecreationCore): Promise<void>;                 // show('api', false) + advance 600 ms inside act()
  ```

Rules (Swift sources named):
- Host (`createRecreationCore`): `focusTitle` focuses `'title'` only when the current show asked for focus, `panel.flags.schedule === 'none'`
  and `focus.active()` is neither `'title'` nor `'notes'` (`focusTitleFieldIfNeeded`). `willShow` → `store.resetDraft()`;
  `didHide` → `store.closePopovers()`; `blurAll` → `focus.blur()`; `haptic` no-op; `onDispatched` → `store.setMachine`.
- `escape()` (D2): not visible → `'none'`; saving → `hide()`, `'panel'` (the Esc monitor hides during the saved hold too); a popover open → close both,
  `'popover'`; schedule `'calendar'` → `'controls'`, `'calendar'`; `'controls'` → `cancelSchedule`, `'section'`; else `hide()`, `'panel'`.
- `save`: badge shown → null; schedule ≠ none → `commitSchedule`, null; `store.prepareReminder()` null → null; else
  `item = toSavedReminder(draft, clock(), formatter)`, dispatch `save({ reduceMotion })`; reduced → `appendSaved` + `onSaved` at once,
  otherwise after 0.32 s × scale (the tick starts drawing when the badge has landed, `SavedCheckView` delay 0.32); the promise resolves
  when the machine next reaches `closed` or `open`.
- `saveFromBar`: section closed → `save`; time field focused and `applyTypedTime(true)` false → null; `saveDecision()`:
  `saveAsIs` → `cancelSchedule` then `save`; `commitThenSave` → `finishSchedule` + `scheduleChanged(none)` then `save`; `invalid` → `beep`, null.
- `textRowSubmit`: `ScheduleCommit.textRowSubmit(schedule !== 'none', canSave)`: `'setSchedule'` → `commitSchedule`, null; `'saveReminder'` → `save`; `'none'` → null.
- `openSchedule`: only when phase open, badge not shown, schedule `'none'` (Swift `openSetDate` guard "⌘D must not collapse it") →
  `openScheduleDraft()`, dispatch `scheduleChanged('controls')`, `'user'` → focus `'scheduleField'` on the next turn (`setTimeout(…, 0)`, after the section mounts; Swift `DispatchQueue.main.async { focus = .text }`).
  `toggleSchedule` (calendar icon): open → `cancelSchedule`, else `openSchedule`. `openCalendar`: opens the section if needed, then
  `'calendar'`, `'user'` → focus `'calendar'`. `closeCalendar` → `'controls'`, `'user'` and focus was in the grid or nowhere → `'scheduleField'`.
- `cancelSchedule` / every commit: dispatch `scheduleChanged('none')`, `closeScheduleDraft()`; `'user'` and focus inside the root (or on
  `body` because the focused field unmounted) → focus `'title'` (`restoreKeyFocus`).
- `commitSchedule`: time field focused → `applyTypedTime(false)` first; `outcome = draft.set()`; null → `beep()` unless `draft.committed`, false;
  else `finishSchedule`, close, true. `applyPreset`: section open → `draft.apply(p)` → finish + close; closed → `setDueDate(DatePresets.date(p), { preset: p, date }, o)`
  and strip a live phrase when `ScheduleCommit.consumesSuggestion(suggestion?.matchedText ?? null, 'preset')` (BottomBar `consumeLiveSuggestion`).
  `clearDueDate`: open → `draft.clear()` → finish + close; closed → `setDueDate(null, null, o)` (date-chip ⓧ writes `dueDate = nil` only).
- `pointerDownInPanel(y)`: `clickCancelsSchedule(y, scheduleSectionTop(39, 1), schedule)` → `cancelSchedule('user')`; the click still lands.
- `openLocationPopover('user')` → focus `'locationField'` on the next turn (`setTimeout(…, 0)`); `setList` closes the picker.

- [ ] **Step 1: Write the failing test** `tests/recreation/controller.test.ts`
  ```ts
  // @vitest-environment jsdom
  import '../ui/setup';
  import { act } from '@testing-library/react';
  import { createTestCore, useTestTime, openPanel } from '../ui/support';
  import { plainSpaces } from '../support';
  beforeEach(() => useTestTime());
  const adv = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

  test('click opens with focus, scroll never focuses', async () => {
    const a = createTestCore(); const spyA = vi.spyOn(a.focus, 'focus');
    a.controller.show('click', true); await adv(300);
    expect(spyA).toHaveBeenCalledWith('title');
    const b = createTestCore(); const spyB = vi.spyOn(b.focus, 'focus');
    b.controller.show('scroll', false); await adv(600);
    expect(spyB).not.toHaveBeenCalled();
    expect(b.store.getState().phase).toEqual({ type: 'open' });
  });
  test('save: item lands at 0.32 s, promise resolves after hold + close', async () => {
    const onSaved = vi.fn();
    const core = createTestCore({ onSaved });
    await openPanel(core);
    core.controller.setTitle('Call mum tomorrow at 2pm', 'user');
    const p = core.controller.save('user');
    await adv(319); expect(core.store.getState().savedItems).toHaveLength(0);
    await adv(1);
    const item = core.store.getState().savedItems[0];
    expect(item).toMatchObject({ title: 'Call mum', listId: 'reminders', listColor: '#0A84FF', flagged: false });
    expect(plainSpaces(item.dueLabel!)).toBe('Tomorrow, 2:00 PM');
    expect(onSaved).toHaveBeenCalledWith(item);
    await adv(1040);
    await expect(p).resolves.toBe(item);
    expect(core.store.getState().phase).toEqual({ type: 'closed', parked: true });
  });
  test('empty title: nothing happens', async () => {
    const core = createTestCore(); await openPanel(core);
    await expect(core.controller.save('user')).resolves.toBeNull();
    expect(core.store.getState().phase).toEqual({ type: 'open' });
  });
  test('⌘↩ while Set Date is open means Set, never save', async () => {
    const core = createTestCore(); await openPanel(core);
    core.controller.setTitle('Pay rent', 'user');
    core.controller.openSchedule('user');
    await expect(core.controller.save('user')).resolves.toBeNull();
    expect(core.store.getState()).toMatchObject({ schedule: 'none', dueDate: new Date('2026-09-19T07:00:00Z'), savedItems: [] });
  });
  test('✓ while open: untouched → saved with no date; edited → Set then saved; invalid → beep', async () => {
    const a = createTestCore(); await openPanel(a);
    a.controller.setTitle('A', 'user'); a.controller.openSchedule('user');
    a.controller.saveFromBar('user'); await adv(320);
    expect(a.store.getState().savedItems[0].dueDate).toBeNull();
    const b = createTestCore(); await openPanel(b);
    b.controller.setTitle('B', 'user'); b.controller.openSchedule('user'); b.controller.setScheduleText('+2h', 'user');
    b.controller.saveFromBar('user'); await adv(320);
    expect(b.store.getState().savedItems[0].dueDate).toEqual(new Date('2026-09-18T10:00:00Z'));
    const c = createTestCore(); await openPanel(c);
    c.controller.setTitle('C', 'user'); c.controller.openSchedule('user'); c.controller.setScheduleText('tomorrow please', 'user');
    await expect(c.controller.saveFromBar('user')).resolves.toBeNull();
    expect(c.store.beepCount).toBe(1);
    expect(c.store.getState().schedule).toBe('controls');
  });
  test('Esc steps back one level: popover → calendar → section → panel', async () => {
    const core = createTestCore(); await openPanel(core);
    core.controller.openCalendar('user'); core.controller.openListPicker();
    expect(core.controller.escape()).toBe('popover');
    expect(core.controller.escape()).toBe('calendar');
    expect(core.store.getState().schedule).toBe('controls');
    expect(core.controller.escape()).toBe('section');
    expect(core.controller.escape()).toBe('panel');
    expect(core.controller.escape()).toBe('none');
  });
  test('presets, invalid Set, Clear, Cancel', async () => {
    const core = createTestCore(); await openPanel(core);
    core.controller.openSchedule('user');
    core.controller.applyPreset('tomorrow', 'user');
    expect(core.store.getState()).toMatchObject({ schedule: 'none', dueDate: new Date('2026-09-19T07:00:00Z'),
      presetPick: { preset: 'tomorrow', date: new Date('2026-09-19T07:00:00Z') } });
    core.controller.openSchedule('user'); core.controller.setScheduleText('nope nope', 'user');
    expect(core.controller.commitSchedule('user')).toBe(false);
    expect(core.store.getState().schedule).toBe('controls');
    core.controller.clearDueDate('user');
    expect(core.store.getState()).toMatchObject({ schedule: 'none', dueDate: null });
    core.controller.setDueDate(new Date('2026-09-20T07:00:00Z'), null, 'user');
    core.controller.openSchedule('user'); core.controller.setScheduleText('+3d', 'user'); core.controller.cancelSchedule('user');
    expect(core.store.getState().dueDate).toEqual(new Date('2026-09-20T07:00:00Z'));
  });
  test('a click on header / title / notes cancels the section; chip slot and bar do not', async () => {
    const core = createTestCore(); await openPanel(core);
    core.controller.openSchedule('user');
    core.controller.pointerDownInPanel(197); expect(core.store.getState().schedule).toBe('controls');
    core.controller.pointerDownInPanel(152); expect(core.store.getState().schedule).toBe('controls');
    core.controller.pointerDownInPanel(105); expect(core.store.getState().schedule).toBe('none');
  });
  test('calendar icon toggles; ⌘D never collapses an open section; nothing opens while closed', async () => {
    const core = createTestCore();
    core.controller.openSchedule('user'); expect(core.store.getState().schedule).toBe('none');
    await openPanel(core);
    core.controller.toggleSchedule('user'); expect(core.store.getState().schedule).toBe('controls');
    core.controller.openCalendar('user'); core.controller.openSchedule('user');
    expect(core.store.getState().schedule).toBe('calendar');
    core.controller.toggleSchedule('user'); expect(core.store.getState().schedule).toBe('none');
  });
  test('a click outside the shape closes the popover and the panel together (transient popover + global monitor)', async () => {
    const core = createTestCore(); await openPanel(core);
    core.controller.openLocationPopover('user');
    core.controller.pointerDownOutside();
    expect(core.store.getState()).toMatchObject({ locationPopoverOpen: false, phase: { type: 'closing' } });
  });
  ```
- [ ] **Step 2: Run it** — `npx vitest run tests/recreation/controller.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `focus.ts`, `controller.ts`, `RecreationContext.tsx` and the support helpers with the rules above.
  `createRecreationCore` builds `formatter = new SuggestionDateFormatter({ locale, calendar, hour12 })`, `sizes = sizesFor(notch, screenHeight, dockHeight)`,
  the store, the runtime (`hasNotch: () => true`) and the controller. `RecreationProvider` also renders `MotionPrefsProvider`.
- [ ] **Step 4: Run it** — `npx vitest run tests/recreation`. Expected: PASS.
- [ ] **Step 5: Commit** — `git add src/recreation/controller.ts src/recreation/ui/focus.ts src/recreation/ui/RecreationContext.tsx tests/ui/support.tsx tests/recreation/controller.test.ts && git commit -m "feat(recreation): controller joining store and runtime, focus registry and React context"`

---
### Task B10: DashedCircle, PlaceholderTextField and InputView

Ports `DashedCircle.swift`, `PlainTextView.swift` (single-line behaviour) + `PlaceholderTextField`, `InputView.swift`.

**Files:**
- Create: `src/recreation/ui/DashedCircle.tsx`, `src/recreation/ui/PlaceholderTextField.tsx`, `src/recreation/ui/InputView.tsx`
- Test: `tests/ui/InputView.test.tsx`

**Interfaces:**
- Consumes: `px` (B1); `useCore`, `useRecreationState` (B9); `FocusField`, `FocusRegistry.register` (B9); `controller.setTitle/setNotes` (B9).
- Produces:
  ```ts
  export function DashedCircle(props: { size?: number }): JSX.Element;           // default 21
  export const TITLE_ROW = { fontSize: 19, lineHeight: 23, rowHeight: 25, maxLength: 2000, placeholder: 'New Reminder' } as const;
  export const NOTES_ROW = { fontSize: 15, lineHeight: 18, rowHeight: 20, maxLength: 10000, placeholder: 'Notes' } as const;
  export function flattenLineBreaks(s: string): string;                            // \r\n, \r, \n, U+0085, U+2028, U+2029 → one space each (\r\n counts once)
  export function PlaceholderTextField(props: { field: 'title' | 'notes'; row: typeof TITLE_ROW | typeof NOTES_ROW; value: string; onChange(v: string): void }): JSX.Element;
  export function InputView(): JSX.Element;
  ```

Values: `DashedCircleView` — `Circle().stroke(#59595D, lineWidth 1.5, lineCap .round, dash [0.1, 3.2])` in a 21 pt frame.
`.stroke` straddles the inscribed circle, so the SVG is `viewBox="0 0 21 21"`, `overflow: visible`, circle (10.5, 10.5) r 10.5,
`stroke="var(--qr-dashed-ring)"`, `stroke-width="1.5"`, `stroke-linecap="round"`, `stroke-dasharray="0.1 3.2"`, `fill="none"`,
`aria-hidden`. `InputView`: row `display: flex; align-items: flex-start; gap: px(10)`; the circle `margin-top: px(2)`; a column with
`gap: px(1)`: title row, notes row. Field: `<input type="text">` with `font-size: px(19 | 15)`, weight 400, colour white,
`caret-color: var(--qr-list-accent)` (Swift `insertionPointColor = accent`), `height: px(rowHeight)` (`lineHeight(for:) + 2`), width 100 %,
`--qr-ph: var(--qr-placeholder)` (#59595D), `aria-label` = placeholder, `data-qr-field`, `data-qr-target` (`title` / `notes`),
`maxLength`, `spellCheck={false}`, `autoComplete="off"`, `autoCorrect="off"`, `autoCapitalize="off"` (Swift turns every automatic substitution off).
Paste: prevent the default, flatten line breaks, clip to the remaining UTF-16 room (`maxLength − (length − selection length)`),
insert with `setRangeText(…, 'end')`, then `onChange` (Swift `shouldChangeTextIn`). The field registers with the focus registry.

- [ ] **Step 1: Write the failing test** `tests/ui/InputView.test.tsx`
  ```ts
  // @vitest-environment jsdom
  import './setup';
  import { screen, fireEvent } from '@testing-library/react';
  import { InputView, flattenLineBreaks } from '../../src/recreation/ui/InputView';
  import { renderWithCore, ptOf } from './support';
  test('dotted circle: 21 pt, 1.5 pt round dots of 0.1 every 3.2, #59595D', () => {
    const { container } = renderWithCore(<InputView />);
    const svg = container.querySelector('[data-qr-dashed-circle]') as SVGSVGElement;
    expect(ptOf(svg.style.width)).toBe(21);
    expect(ptOf(svg.style.marginTop)).toBe(2);
    const c = svg.querySelector('circle')!;
    expect([c.getAttribute('cx'), c.getAttribute('cy'), c.getAttribute('r')]).toEqual(['10.5', '10.5', '10.5']);
    expect(c.getAttribute('stroke-width')).toBe('1.5');
    expect(c.getAttribute('stroke-dasharray')).toBe('0.1 3.2');
    expect(c.getAttribute('stroke-linecap')).toBe('round');
    expect(c.getAttribute('stroke')).toBe('var(--qr-dashed-ring)');
  });
  test('title and notes rows', () => {
    renderWithCore(<InputView />);
    const title = screen.getByRole('textbox', { name: 'New Reminder' }) as HTMLInputElement;
    const notes = screen.getByRole('textbox', { name: 'Notes' }) as HTMLInputElement;
    expect([ptOf(title.style.fontSize), ptOf(title.style.height), title.maxLength]).toEqual([19, 25, 2000]);
    expect([ptOf(notes.style.fontSize), ptOf(notes.style.height), notes.maxLength]).toEqual([15, 20, 10000]);
    expect(title.placeholder).toBe('New Reminder');
    expect(title.style.fontWeight).toBe('400');
    expect(title.style.caretColor).toBe('var(--qr-list-accent)');
    expect(title.style.getPropertyValue('--qr-ph')).toBe('var(--qr-placeholder)');
    expect(title.dataset.qrField).toBe('title');
    expect(title.getAttribute('spellcheck')).toBe('false');
    const row = title.closest('[data-qr-input-row]') as HTMLElement;
    expect(ptOf(row.style.gap)).toBe(10);
    expect(ptOf((title.closest('[data-qr-input-column]') as HTMLElement).style.gap)).toBe(1);
  });
  test('typing writes the title as a user edit', () => {
    const { core } = renderWithCore(<InputView />);
    fireEvent.change(screen.getByRole('textbox', { name: 'New Reminder' }), { target: { value: 'Buy milk' } });
    expect(core.store.getState()).toMatchObject({ title: 'Buy milk', dirty: true });
  });
  test('pasted line breaks become spaces; the paste is clipped to the cap', () => {
    expect(flattenLineBreaks('a\nb\r\nc d')).toBe('a b c d');
    const { core } = renderWithCore(<InputView />);
    const title = screen.getByRole('textbox', { name: 'New Reminder' }) as HTMLInputElement;
    fireEvent.paste(title, { clipboardData: { getData: () => 'a\nb\r\nc' } });
    expect(core.store.getState().title).toBe('a b c');
    core.controller.setTitle('x'.repeat(1998), 'user');
    title.setSelectionRange(1998, 1998);
    fireEvent.paste(title, { clipboardData: { getData: () => 'abcd' } });
    expect(core.store.getState().title).toBe('x'.repeat(1998) + 'ab');
  });
  test('focus by registry puts the caret at the end', () => {
    const { core } = renderWithCore(<InputView />);
    core.controller.setTitle('Call mum', 'api');
    expect(core.focus.focus('title')).toBe(true);
    const title = screen.getByRole('textbox', { name: 'New Reminder' }) as HTMLInputElement;
    expect(document.activeElement).toBe(title);
    expect(title.selectionStart).toBe(8);
  });
  ```
- [ ] **Step 2: Run it** — `npx vitest run tests/ui/InputView.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** the three files (re-export `flattenLineBreaks` from `InputView.tsx`; it lives in `PlaceholderTextField.tsx`).
- [ ] **Step 4: Run it** — Expected: PASS (5 tests).
- [ ] **Step 5: Commit** — `git add src/recreation/ui/DashedCircle.tsx src/recreation/ui/PlaceholderTextField.tsx src/recreation/ui/InputView.tsx tests/ui/InputView.test.tsx && git commit -m "feat(recreation): dotted circle and single-line title / notes rows"`

---

### Task B11: HeaderView and the list picker (landing spec §11.4 style)

**Files:**
- Create: `src/recreation/ui/HeaderView.tsx`, `src/recreation/ui/Popover.tsx`, `src/recreation/ui/ListPickerMenu.tsx`
- Test: `tests/ui/HeaderView.test.tsx`

**Interfaces:**
- Consumes: `HoverButton`, `NotchFillButton` (B4); `SFIcon` (B3); `FAKE_LISTS`, `listById` (contract §2.12); B9 context and controller.
- Produces:
  ```ts
  export function HeaderView(): JSX.Element;
  export interface PopoverAnchor { readonly x: number; readonly y: number; readonly align: 'start' | 'center' }   // canvas points
  export const LIST_PICKER_ANCHOR: PopoverAnchor;      // { x: 63, y: 91, align: 'start' }
  export function PopoverSurface(props: { anchor: PopoverAnchor; name: 'lists' | 'location'; label: string; role: 'menu' | 'dialog';
    minWidth?: number; padding?: string; children: ReactNode }): JSX.Element;
  export function ListPickerMenu(): JSX.Element;       // renders only while state.listPickerOpen
  ```

Values: `HeaderView.swift` — row `display: flex; align-items: center`, no gap; list button = `HoverButton` (`aria-label="Choose list"`,
`aria-haspopup="menu"`, `aria-expanded`, `data-qr-target="header"`) holding a flex row with `gap: px(7)`: the list title 22 / 700 in
`var(--qr-list-accent)`, `white-space: nowrap`, then `SFIcon chevron.down@13` in the accent with `transform: translateY(px(0.5))`.
A spacer `flex: 1 0 auto; min-width: px(12)`. ⓧ = `HoverButton` 36 × 36 (`aria-label="Close"`, `data-qr-target="close"`) with a centred
24 pt circle `background: var(--qr-gray-circle)` holding `SFIcon xmark@11` in white. Click on the list button → `toggleListPicker()`; ⓧ → `hide()`.
Popover surface (§11.4): `position: absolute` in the canvas at the anchor (`align: 'center'` → `translateX(-50%)`), `background: var(--qr-black)`,
`border: px(1) solid var(--qr-pill-stroke)`, `border-radius: px(12)`, no shadow, `pointer-events: auto`, `data-qr-popover={name}`,
enter / exit opacity 0 → 1 and scale 0.96 → 1 from the top (`transform-origin: top left` or `top center`) with `Motion.highlight`
(easeOut 0.12), reduced → opacity only. Anchors are 8 pt below the trigger (author's call within §11.4): list picker left = content
inset 24 + 39 = 63, top = header row bottom 83 + 8 = 91. `ListPickerMenu.swift`: `min-width: px(200)`, padding-bottom 8; heading
"Lists" 13 / 600 white 50 %, padding top 12, bottom 6, sides 16; rows `role="menuitemradio"`, `aria-checked`, `data-qr-target="list:<id>"`:
`NotchFillButton` kind `selected` for the current list and `neutral` otherwise, radius 8, inset 4 pt from the surface sides, 2 pt apart,
padding 8 × 12 (text starts 16 pt from the surface edge as in the app), a flex row gap 8: 10 pt dot in the list colour, title 15 / 400 white,
spacer, `SFIcon checkmark@13` in the accent (selected row only). Click → `setList(id, 'user')` (closes the picker).

- [ ] **Step 1: Write the failing test**
  ```ts
  // @vitest-environment jsdom
  import './setup';
  import { screen, fireEvent, within } from '@testing-library/react';
  import { HeaderView } from '../../src/recreation/ui/HeaderView';
  import { ListPickerMenu } from '../../src/recreation/ui/ListPickerMenu';
  import { renderWithCore, ptOf, useTestTime, openPanel } from './support';
  test('“Reminders ▾” in the accent, 22 bold, chevron 7 pt to the right', () => {
    const { container } = renderWithCore(<HeaderView />);
    const button = screen.getByRole('button', { name: 'Choose list' });
    const label = within(button).getByText('Reminders');
    expect([ptOf(label.style.fontSize), label.style.fontWeight, label.style.color]).toEqual([22, '700', 'var(--qr-list-accent)']);
    expect(ptOf((label.parentElement as HTMLElement).style.gap)).toBe(7);
    const chevron = button.querySelector('[data-sf="chevron.down@13"]') as HTMLElement;
    expect(chevron.style.transform).toBe('translateY(calc(0.5 * var(--pt) * 1px))');
    expect(ptOf((container.querySelector('[data-qr-header-spacer]') as HTMLElement).style.minWidth)).toBe(12);
  });
  test('ⓧ: 24 pt #59595D circle, 11 pt bold x, 36 pt hit area', async () => {
    useTestTime();
    const { core } = renderWithCore(<HeaderView />);
    await openPanel(core);
    const close = screen.getByRole('button', { name: 'Close' });
    expect([ptOf(close.style.width), ptOf(close.style.height)]).toEqual([36, 36]);
    const circle = close.querySelector('[data-qr-close-circle]') as HTMLElement;
    expect([ptOf(circle.style.width), circle.style.background]).toEqual([24, 'var(--qr-gray-circle)']);
    expect(circle.querySelector('[data-sf="xmark@11"]')).not.toBeNull();
    fireEvent.click(close);
    expect(core.store.getState().phase).toEqual({ type: 'closing' });
  });
  test('the picker lists the five lists and recolours on pick', () => {
    const { core } = renderWithCore(<><HeaderView /><ListPickerMenu /></>);
    fireEvent.click(screen.getByRole('button', { name: 'Choose list' }));
    const menu = screen.getByRole('menu', { name: 'Lists' });
    expect([ptOf(menu.style.left), ptOf(menu.style.top), ptOf(menu.style.minWidth), ptOf(menu.style.borderRadius)]).toEqual([63, 91, 200, 12]);
    expect(menu.style.border).toBe('calc(1 * var(--pt) * 1px) solid var(--qr-pill-stroke)');
    const rows = within(menu).getAllByRole('menuitemradio');
    expect(rows.map(r => r.textContent)).toEqual(['Reminders', 'Work', 'Home', 'Groceries', 'Ideas']);
    expect(rows.map(r => (r.querySelector('[data-qr-dot]') as HTMLElement).style.background))
      .toEqual(['rgb(10, 132, 255)', 'rgb(191, 90, 242)', 'rgb(255, 159, 10)', 'rgb(48, 209, 88)', 'rgb(255, 55, 95)']);   // FAKE_LISTS, as jsdom normalises hex
    expect(rows[0].getAttribute('aria-checked')).toBe('true');
    expect(rows[0].querySelector('[data-sf="checkmark@13"]')).not.toBeNull();
    expect(rows[1].querySelector('[data-sf="checkmark@13"]')).toBeNull();
    const heading = within(menu).getByText('Lists');
    expect([ptOf(heading.style.fontSize), heading.style.fontWeight, heading.style.color]).toEqual([13, '600', 'rgba(255, 255, 255, 0.5)']);
    fireEvent.click(rows[1]);
    expect(core.store.getState()).toMatchObject({ listId: 'work', listPickerOpen: false, accent: '#BF5AF2' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(within(screen.getByRole('button', { name: 'Choose list' })).getByText('Work')).toBeTruthy();
  });
  ```
- [ ] **Step 2: Run it** — `npx vitest run tests/ui/HeaderView.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** the three files with the values above.
- [ ] **Step 4: Run it** — Expected: PASS (3 tests).
- [ ] **Step 5: Commit** — `git add src/recreation/ui/HeaderView.tsx src/recreation/ui/Popover.tsx src/recreation/ui/ListPickerMenu.tsx tests/ui/HeaderView.test.tsx && git commit -m "feat(recreation): header with list picker and close button"`

---

### Task B12: ChipSlot — suggestion chip, date chip, error (`QuickReminderView.regularBottom`)

**Files:**
- Create: `src/recreation/ui/ChipSlot.tsx`
- Test: `tests/ui/ChipSlot.test.tsx`

**Interfaces:**
- Consumes: `HoverButton` (B4), `SFIcon`, `CalendarClockIcon` (B3), `toTransition`, `Motion.{chip, suggestion}` (B1 / §7), formatter, B9 context.
- Produces:
  ```ts
  export type ChipChange = 'dueDate' | 'suggestion' | 'dismiss';
  export function chipTransition(change: ChipChange, timeScale: number): Transition;   // Motion.chip | Motion.suggestion | easeOut 0.15
  export const CHIP_ENTER: { opacity: 0; y: '100%' };  export const CHIP_SHOWN: { opacity: 1; y: 0 };
  export function ChipSlot(): JSX.Element;
  ```

Values (`QuickReminderView.swift`): slot `height: px(26)`, content bottom-left aligned, `padding-left: px(31)` (`Theme.s(21) + 10`);
priority error → date chip → suggestion. Error: 12 / 500 `var(--qr-error-red)`, one line, ellipsis, fade `Motion.error`.
Suggestion: flex row gap 8: [`HoverButton` `aria-label="Use suggested date"` `data-qr-target="suggestionChip"`: flex row gap 6,
colour accent, padding 5 × 10, capsule `background: var(--qr-accent-14)`; `CalendarClockIcon pointSize 12`; text 13 / 500
`formatter.string(date, hasTime, now)`; keycap "⇥" 11 / 600 white 45 %, background white 10 %, radius 4, padding 1 × 5]
[`HoverButton` `aria-label="Dismiss suggestion"` `data-qr-target="suggestionDismiss"`: `SFIcon xmark.circle.fill@13` white 40 %].
Date chip: flex row gap 6, colour accent: [`HoverButton` `aria-label="Change date"` `data-qr-target="dateChip"` (value text in
`aria-description`): flex row gap 6, `SFIcon calendar@12`, text 13 / 500 `formatter.string(date, true, now)`] [plain button
`aria-label="Clear date"`: `SFIcon xmark.circle.fill@13` white 50 %]. Enter / exit: opacity + move from the bottom edge
(`CHIP_ENTER`), transition by what changed: `dueDate` presence → `Motion.chip` (spring 0.3 / 0.8), suggestion text → `Motion.suggestion`
(easeOut 0.18), dismiss → easeOut 0.15. Actions: chip → `applySuggestion('user')`; ⓧ → `dismissSuggestion('user')`; date chip →
`openSchedule('user')` (no-op while open); clear → `clearDueDate('user')` (section closed: `dueDate = nil` only).

- [ ] **Step 1: Write the failing test**
  ```ts
  // @vitest-environment jsdom
  import './setup';
  import { screen, fireEvent, within } from '@testing-library/react';
  import { ChipSlot, chipTransition } from '../../src/recreation/ui/ChipSlot';
  import { renderWithCore, ptOf, useTestTime, openPanel } from './support';
  import { plainSpaces } from '../support';
  beforeEach(() => useTestTime());
  test('slot: 26 pt, bottom-left, 31 pt leading inset', () => {
    const { container } = renderWithCore(<ChipSlot />);
    const slot = container.querySelector('[data-qr-chip-slot]') as HTMLElement;
    expect([ptOf(slot.style.height), ptOf(slot.style.paddingLeft), slot.style.alignItems]).toEqual([26, 31, 'flex-end']);
  });
  test('suggestion chip “Tomorrow, 2:00 PM ⇥”, Tab-free apply and dismiss', () => {
    const { core } = renderWithCore(<ChipSlot />);
    core.controller.setTitle('Call mum tomorrow at 2pm', 'user');
    const chip = screen.getByRole('button', { name: 'Use suggested date' });
    expect(plainSpaces(chip.textContent!)).toBe('Tomorrow, 2:00 PM⇥');
    const pill = chip.firstElementChild as HTMLElement;
    expect([ptOf(pill.style.paddingTop), ptOf(pill.style.paddingLeft), pill.style.background, ptOf(pill.style.gap)]).toEqual([5, 10, 'var(--qr-accent-14)', 6]);
    expect(pill.querySelector('[data-sf="calendar.badge.clock@12"]')).not.toBeNull();
    const key = within(chip).getByText('⇥');
    expect([ptOf(key.style.fontSize), key.style.color, ptOf(key.style.borderRadius)]).toEqual([11, 'rgba(255, 255, 255, 0.45)', 4]);
    const dismiss = screen.getByRole('button', { name: 'Dismiss suggestion' });
    expect((dismiss.querySelector('[data-sf="xmark.circle.fill@13"]') as HTMLElement).style.color).toBe('rgba(255, 255, 255, 0.4)');
    fireEvent.click(dismiss);
    expect(core.store.getState().suggestion).toBeNull();
    core.controller.setTitle('Call dad tomorrow', 'user');
    fireEvent.click(screen.getByRole('button', { name: 'Use suggested date' }));
    expect(core.store.getState()).toMatchObject({ title: 'Call dad', dueDate: new Date('2026-09-19T07:00:00Z') });
  });
  test('date chip reopens Set Date; its ⓧ clears the date', async () => {
    const { core } = renderWithCore(<ChipSlot />);
    await openPanel(core);
    core.controller.setDueDate(new Date('2026-09-19T12:00:00Z'), null, 'user');
    const chip = screen.getByRole('button', { name: 'Change date' });
    expect(plainSpaces(chip.textContent!)).toBe('Tomorrow, 2:00 PM');
    expect(chip.querySelector('[data-sf="calendar@12"]')).not.toBeNull();
    fireEvent.click(chip);
    expect(core.store.getState().schedule).toBe('controls');
    core.controller.cancelSchedule('user');
    fireEvent.click(screen.getByRole('button', { name: 'Clear date' }));
    expect(core.store.getState().dueDate).toBeNull();
  });
  test('error line wins the slot', () => {
    const { core } = renderWithCore(<ChipSlot />);
    core.store.setSaveError('Reminders access denied');
    const err = screen.getByText('Reminders access denied');
    expect([ptOf(err.style.fontSize), err.style.fontWeight, err.style.color, err.style.whiteSpace]).toEqual([12, '500', 'var(--qr-error-red)', 'nowrap']);
  });
  test('transitions', () => {
    expect((chipTransition('dueDate', 1) as any).stiffness).toBeCloseTo(438.65, 2);
    expect(chipTransition('suggestion', 1)).toEqual({ type: 'tween', ease: [0, 0, 0.58, 1], duration: 0.18 });
    expect(chipTransition('dismiss', 1)).toEqual({ type: 'tween', ease: [0, 0, 0.58, 1], duration: 0.15 });
  });
  ```
- [ ] **Step 2: Run it** — `npx vitest run tests/ui/ChipSlot.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** `ChipSlot.tsx` (`AnimatePresence initial={false}` keyed `error` / `date` / `suggestion:<matchedText>`; the
  component remembers what changed last to pick `chipTransition`).
- [ ] **Step 4: Run it** — Expected: PASS (5 tests).
- [ ] **Step 5: Commit** — `git add src/recreation/ui/ChipSlot.tsx tests/ui/ChipSlot.test.tsx && git commit -m "feat(recreation): chip slot with suggestion chip, date chip and error line"`

---

### Task B13: BottomBar — pill with calendar / location / flag and the ✓ (`BottomBar.swift`)

**Files:**
- Create: `src/recreation/ui/BottomBar.tsx`
- Test: `tests/ui/BottomBar.test.tsx`

**Interfaces:**
- Consumes: `HoverHighlightButton`, `HoverButton` (B4); `SFIcon` (B3); `toTransition`, `Motion.{flag, canSave, highlight}`; B9 context.
- Produces:
  ```ts
  export const PILL = { height: 44, padX: 11, gap: 17, iconSize: 18, hit: 38 } as const;
  export const SAVE_BUTTON = { size: 48, glyph: 22 } as const;
  export function BottomBar(): JSX.Element;
  export function saveHelp(state: RecreationState): string;   // 'Save reminder' | 'Applies the date in Set Date, then saves'
  ```

Values: bar `display: flex; align-items: center`; pill `height: px(44)`, `padding: 0 px(11)`, `gap: px(17)`, capsule
`background: var(--qr-pill-fill)`, inner stroke `box-shadow: inset 0 0 0 px(1) var(--qr-pill-stroke)` (`strokeBorder`); spacer
`flex: 1 0 auto; min-width: px(16)`; three `HoverHighlightButton size={38}`:
- calendar: `aria-label="Set date and time"`, `aria-pressed={schedulingInNotch}` (toggle trait in notch style), `data-qr-target="calendarIcon"`,
  glyph `calendar.badge.clock@18`, colour accent when `dueDate !== null || schedulingInNotch`, else white; behind the glyph an open-state
  disc inset 3 pt (32 pt) `color-mix(in srgb, var(--qr-list-accent) 22%, transparent)` while the section is open, opacity faded with
  `Motion.highlight`; click → `toggleSchedule('user')`.
- location: `aria-label` = `location ? 'Location, ' + location : 'Add location'`, `data-qr-target="locationIcon"`, glyph `location.fill@18`
  in the accent when a location is set, else `location@18` white; click → `openLocationPopover('user')`.
- flag: `aria-label="Toggle flag"`, `aria-pressed={flagged}`, `data-qr-target="flagIcon"`, glyph `flag.fill@18` in `var(--qr-flag-orange)`
  when flagged, else `flag@18` white; click → `toggleFlag('user')`.
- glyph swaps (`.contentTransition(.symbolEffect(.replace))`): `AnimatePresence mode="popLayout"` keyed by the glyph name, old glyph
  scale → 0.5 and opacity → 0, new glyph from scale 0.5 / opacity 0, `Motion.flag` (spring 0.25 / 0.7); reduced → opacity with `Motion.reduced`.
- ✓: `HoverButton` with `layoutId="save"` (motion, shared with the saved badge, Swift `matchedGeometryEffect(id: "save")`),
  `aria-label="Save reminder"`, `title={saveHelp(state)}`, `data-qr-target="save"`, disabled when `!canSave`; a 48 pt circle,
  `background` `var(--qr-list-accent)` when `canSave` else `var(--qr-gray-circle-disabled)` (colour animated with `Motion.canSave`,
  easeInOut 0.18), `SFIcon checkmark@22` white. While `badgeShown` the button is not rendered; an empty 48 × 48 slot `data-qr-save-slot` keeps
  the row. Click → `saveFromBar('user')`.

- [ ] **Step 1: Write the failing test**
  ```ts
  // @vitest-environment jsdom
  import './setup';
  import { screen, fireEvent } from '@testing-library/react';
  import { BottomBar } from '../../src/recreation/ui/BottomBar';
  import { renderWithCore, ptOf, useTestTime, openPanel } from './support';
  beforeEach(() => useTestTime());
  test('pill: 44 pt capsule, 3 % fill, 1 pt #3D3D3F stroke, 18 pt icons in 38 pt hits, 55 pt centre spacing', () => {
    const { container } = renderWithCore(<BottomBar />);
    const pill = container.querySelector('[data-qr-pill]') as HTMLElement;
    expect([ptOf(pill.style.height), ptOf(pill.style.paddingLeft), ptOf(pill.style.gap), pill.style.background])
      .toEqual([44, 11, 17, 'var(--qr-pill-fill)']);
    expect(pill.style.boxShadow).toBe('inset 0 0 0 calc(1 * var(--pt) * 1px) var(--qr-pill-stroke)');
    const names = ['Set date and time', 'Add location', 'Toggle flag'];
    for (const n of names) expect(ptOf(screen.getByRole('button', { name: n }).style.width)).toBe(38);
    expect(screen.getByRole('button', { name: 'Set date and time' }).querySelector('[data-sf="calendar.badge.clock@18"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Add location' }).querySelector('[data-sf="location@18"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Toggle flag' }).querySelector('[data-sf="flag@18"]')).not.toBeNull();
    expect(ptOf((container.querySelector('[data-qr-bar-spacer]') as HTMLElement).style.minWidth)).toBe(16);
  });
  test('✓: 48 pt, #474749 until there is a title, then the accent', () => {
    const { core } = renderWithCore(<BottomBar />);
    const save = screen.getByRole('button', { name: 'Save reminder' }) as HTMLButtonElement;
    const disc = save.querySelector('[data-qr-save-disc]') as HTMLElement;
    expect(ptOf(disc.style.width)).toBe(48);
    expect(save.disabled).toBe(true);
    expect(disc.dataset.fill).toBe('var(--qr-gray-circle-disabled)');
    expect(save.querySelector('[data-sf="checkmark@22"]')).not.toBeNull();
    core.controller.setTitle('Buy milk', 'user');
    expect(save.disabled).toBe(false);
    expect(disc.dataset.fill).toBe('var(--qr-list-accent)');
    expect(save.title).toBe('Save reminder');
  });
  test('flag toggles to the orange filled flag', () => {
    const { core } = renderWithCore(<BottomBar />);
    const flag = screen.getByRole('button', { name: 'Toggle flag' });
    fireEvent.click(flag);
    expect(core.store.getState().flagged).toBe(true);
    expect(flag.getAttribute('aria-pressed')).toBe('true');
    const glyph = flag.querySelector('[data-sf="flag.fill@18"]') as HTMLElement;
    expect(glyph.closest('[data-qr-glyph]')!.getAttribute('style')).toContain('color: var(--qr-flag-orange)');
  });
  test('a location fills the pin in the accent and names it', () => {
    const { core } = renderWithCore(<BottomBar />);
    core.controller.setLocation('Office', 'user');
    const loc = screen.getByRole('button', { name: 'Location, Office' });
    expect(loc.querySelector('[data-sf="location.fill@18"]')).not.toBeNull();
    expect(loc.querySelector('[data-qr-glyph]')!.getAttribute('style')).toContain('color: var(--qr-list-accent)');
  });
  test('calendar icon toggles Set Date and shows it is open', async () => {
    const { core } = renderWithCore(<BottomBar />);
    await openPanel(core);
    const cal = screen.getByRole('button', { name: 'Set date and time' });
    fireEvent.click(cal);
    expect(core.store.getState().schedule).toBe('controls');
    expect(cal.getAttribute('aria-pressed')).toBe('true');
    const disc = cal.querySelector('[data-qr-open-disc]') as HTMLElement;
    expect([ptOf(disc.style.inset)]).toEqual([3]);
    expect(screen.getByRole('button', { name: 'Save reminder' }).title).toBe('Applies the date in Set Date, then saves');
    fireEvent.click(cal);
    expect(core.store.getState().schedule).toBe('none');
  });
  test('the ✓ yields its slot to the flying badge', async () => {
    const { core, container } = renderWithCore(<BottomBar />);
    await openPanel(core);
    core.controller.setTitle('Buy milk', 'user');
    fireEvent.click(screen.getByRole('button', { name: 'Save reminder' }));
    expect(screen.queryByRole('button', { name: 'Save reminder' })).toBeNull();
    expect(ptOf((container.querySelector('[data-qr-save-slot]') as HTMLElement).style.width)).toBe(48);
  });
  ```
- [ ] **Step 2: Run it** — `npx vitest run tests/ui/BottomBar.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** `BottomBar.tsx`. The ✓ disc exposes its target fill as `data-fill` (the animated `background` follows it).
  Each glyph sits in a `span data-qr-glyph` that carries the colour.
- [ ] **Step 4: Run it** — Expected: PASS (6 tests).
- [ ] **Step 5: Commit** — `git add src/recreation/ui/BottomBar.tsx tests/ui/BottomBar.test.tsx && git commit -m "feat(recreation): bottom bar pill with date, location and flag, and the save button"`

---

### Task B14: LocationPopover (landing spec §11.4, `BottomBar.locationPopover`)

**Files:**
- Create: `src/recreation/ui/LocationPopover.tsx`
- Test: `tests/ui/LocationPopover.test.tsx`

**Interfaces:**
- Consumes: `PopoverSurface`, `PopoverAnchor` (B11); `NotchFillButton` (B4); `AccentContrast.label`; B9 context.
- Produces:
  ```ts
  export const LOCATION_ANCHOR: PopoverAnchor;   // { x: 148, y: 224, align: 'center' }: icon centre 24 + 124; icon hit 178–216 (38 centred in the 44 pill at 175) + 8
  export function LocationPopover(): JSX.Element; // renders only while state.locationPopoverOpen
  ```

Values: surface padding 14, flex column gap 10 (Swift `VStack(spacing: 10).padding(14)`); "Location" 13 / 600 white; field
`<input>` `aria-label="Location"`, placeholder "Enter location", `data-qr-field="locationField"`, `data-qr-target="locationField"`,
width 220, height 28, padding-x 12, font 14 / 400 white, `--qr-ph: rgba(255, 255, 255, 0.5)`, background white 7 %, inner stroke white 8 %
(accent 70 % while focused, `Motion.focusRing`), radius 12 (type-field styling, `ScheduleNotchSection.typeField`); footer row
`justify-content: flex-end`; Done = `NotchFillButton kind="prominent" radius={12}`, height 28, padding-x 14, 13 / 600, label colour
`AccentContrast.label(accent)`, `data-qr-target="locationDone"`. The field is bound live (Swift binds `locationText` directly):
`setLocation(value, 'user')` on every change; ↩ in the field and Done close the popover (B22 maps ↩); opening from the icon focuses the field.

- [ ] **Step 1: Write the failing test**
  ```ts
  // @vitest-environment jsdom
  import './setup';
  import { screen, fireEvent, act } from '@testing-library/react';
  import { LocationPopover } from '../../src/recreation/ui/LocationPopover';
  import { renderWithCore, ptOf, useTestTime, openPanel } from './support';
  beforeEach(() => useTestTime());
  test('anchored under the pin, black §11.4 surface, live field, Done closes', async () => {
    const { core } = renderWithCore(<LocationPopover />);
    await openPanel(core);
    act(() => core.controller.openLocationPopover('user'));
    await act(async () => { vi.advanceTimersByTime(16); });
    const dlg = screen.getByRole('dialog', { name: 'Location' });
    expect([ptOf(dlg.style.left), ptOf(dlg.style.top), dlg.style.transform]).toEqual([148, 224, 'translateX(-50%)']);
    expect([ptOf(dlg.style.padding), ptOf(dlg.style.gap)]).toEqual([14, 10]);
    const field = screen.getByRole('textbox', { name: 'Location' }) as HTMLInputElement;
    expect([ptOf(field.style.width), ptOf(field.style.height), ptOf(field.style.borderRadius), field.placeholder]).toEqual([220, 28, 12, 'Enter location']);
    expect(document.activeElement).toBe(field);
    fireEvent.change(field, { target: { value: 'Office' } });
    expect(core.store.getState()).toMatchObject({ location: 'Office', dirty: true });
    const done = screen.getByRole('button', { name: 'Done' });
    expect(done.style.color).toBe('rgb(255, 255, 255)');   // AccentContrast.label('#0A84FF') = '#FFFFFF' (jsdom writes rgb)
    fireEvent.click(done);
    expect(core.store.getState().locationPopoverOpen).toBe(false);
  });
  test('Done label turns black on a light list colour (AccentContrast)', async () => {
    const { core } = renderWithCore(<LocationPopover />);
    await openPanel(core);
    act(() => { core.controller.setList('home', 'user'); core.controller.openLocationPopover('api'); });
    expect(screen.getByRole('button', { name: 'Done' }).style.color).toBe('rgb(0, 0, 0)');   // '#000000' on #FF9F0A
    expect(document.activeElement).not.toBe(screen.getByRole('textbox', { name: 'Location' }));
  });
  ```
- [ ] **Step 2: Run it** — `npx vitest run tests/ui/LocationPopover.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** `LocationPopover.tsx`.
- [ ] **Step 4: Run it** — Expected: PASS (2 tests).
- [ ] **Step 5: Commit** — `git add src/recreation/ui/LocationPopover.tsx tests/ui/LocationPopover.test.tsx && git commit -m "feat(recreation): location popover in the panel's own black style"`

---

### Task B15: SavedCheckView — the ✓ badge that draws itself and pops (`SavedCheckView.swift`)

**Files:**
- Create: `src/recreation/ui/SavedCheckView.tsx`
- Test: `tests/ui/SavedCheckView.test.tsx`

**Interfaces:**
- Consumes: `toTransition`, `Motion.{tickTrim, badgeBounce, badgeSettle, badgeFade}`, `useMotionPrefs` (B1).
- Produces:
  ```ts
  export const BADGE = { size: 24, strokeRatio: 0.11, insetRatio: 0.27 } as const;   // stroke 2.64, inset 6.48
  export function checkmarkPath(w: number, h: number): string;   // CheckmarkShape: M0 0.55h L0.38w 0.92h Lw 0.12h (3 decimals)
  export interface BadgeTimeline { tick: Transition; up: Transition & { to: 1.18 }; settle: Transition & { to: 1 } }
  export function badgeTimeline(reduceMotion: boolean, timeScale: number): BadgeTimeline | null;   // null under reduce: tick drawn, no pop
  export function SavedCheckView(props: { visible: boolean }): JSX.Element;   // visible = flags.isSaving; fades out with Motion.badgeFade
  ```

Values: circle 24 `var(--qr-list-accent)`; tick in an 11.04 × 11.04 box inset 6.48, stroke white 2.64, round caps and joins;
`pathLength` 0 → 1 with easeOut 0.28 delay 0.32; scale → 1.18 with spring (0.28, 0.45) delay 0.55, then → 1 with spring (0.30, 0.70)
delay 0.72; opacity 1 while `visible`, else 0 with easeOut 0.16 (Swift: "fades out in place, a little ahead of the notch shrinking").
The root is a `motion.div` with `layoutId="save"` and `layout` transition `Motion.saving`, `role="img"`, `aria-label="Saved"`, `data-qr-badge`.

- [ ] **Step 1: Write the failing test**
  ```ts
  // @vitest-environment jsdom
  import './setup';
  import { render, screen } from '@testing-library/react';
  import { SavedCheckView, checkmarkPath, badgeTimeline } from '../../src/recreation/ui/SavedCheckView';
  import { MotionPrefsProvider } from '../../src/recreation/ui/motionPrefs';
  import { ptOf } from './support';
  test('CheckmarkShape geometry', () => {
    expect(checkmarkPath(11.04, 11.04)).toBe('M0 6.072 L4.195 10.157 L11.04 1.325');
  });
  test('badge: 24 pt accent disc, 2.64 pt white tick inset 6.48', () => {
    render(<SavedCheckView visible />);
    const badge = screen.getByRole('img', { name: 'Saved' });
    expect([ptOf(badge.style.width), ptOf(badge.style.height), badge.style.background, badge.style.borderRadius]).toEqual([24, 24, 'var(--qr-list-accent)', '50%']);
    const svg = badge.querySelector('svg') as SVGSVGElement;
    expect([ptOf(svg.style.left), ptOf(svg.style.top), ptOf(svg.style.width)]).toEqual([6.48, 6.48, 11.04]);
    const path = svg.querySelector('path')!;
    expect([path.getAttribute('stroke'), path.getAttribute('stroke-width'), path.getAttribute('stroke-linecap'), path.getAttribute('stroke-linejoin')])
      .toEqual(['#FFFFFF', '2.64', 'round', 'round']);
  });
  test('timeline: trim after the flight, pop, settle', () => {
    const t = badgeTimeline(false, 1)!;
    expect(t.tick).toEqual({ type: 'tween', ease: [0, 0, 0.58, 1], duration: 0.28, delay: 0.32 });
    expect((t.up as any).stiffness).toBeCloseTo(503.55, 2);
    expect((t.up as any).delay).toBe(0.55);
    expect(t.up.to).toBe(1.18);
    expect((t.settle as any).damping).toBeCloseTo(29.322, 3);
    expect((t.settle as any).delay).toBe(0.72);
    expect(badgeTimeline(true, 1)).toBeNull();
  });
  test('reduce motion: the tick is simply there', () => {
    render(<MotionPrefsProvider value={{ reduceMotion: true, timeScale: 1 }}><SavedCheckView visible /></MotionPrefsProvider>);
    expect(screen.getByRole('img', { name: 'Saved' }).dataset.progress).toBe('1');
  });
  ```
- [ ] **Step 2: Run it** — `npx vitest run tests/ui/SavedCheckView.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** `SavedCheckView.tsx` (`useAnimate` on mount runs tick, up, settle with the `badgeTimeline` transitions;
  `data-progress` is 1 under reduce from the first render).
- [ ] **Step 4: Run it** — Expected: PASS (4 tests).
- [ ] **Step 5: Commit** — `git add src/recreation/ui/SavedCheckView.tsx tests/ui/SavedCheckView.test.tsx && git commit -m "feat(recreation): saved badge with trimmed tick and bounce"`

---

### Task B16: ScheduleMonthGrid (`ScheduleMonthGrid.swift`)

**Files:**
- Create: `src/recreation/ui/ScheduleMonthGrid.tsx`
- Test: `tests/ui/ScheduleMonthGrid.test.tsx`

**Interfaces:**
- Consumes: `MonthGrid.{cells, weekdaySymbols, canGoBack, isSelectable, startOfMonth, weeks}`; `isSameDay`, `components`;
  `AccentContrast.label`; formatter `format(date, 'LLLL y' | 'EEEE d MMMM')`; `HoverHighlightButton`, `DayCellButton` (B4); `SFIcon` (B3); B9 context.
- Produces:
  ```ts
  export function ScheduleMonthGrid(props: { draft: Date; month: Date; now: Date; keyboardFocused: boolean;
    onPick(day: Date): void; onPage(delta: -1 | 1): void }): JSX.Element;
  ```

Values: header row height 26: month title `LLLL y` 13 / 600 white, padding-left 4; spacer; ‹ › = `HoverHighlightButton size={26}`
(`aria-label="Previous month"` / `"Next month"`, `data-qr-target="calendarPrev"` / `"calendarNext"`) with `SFIcon chevron.left@11` /
`chevron.right@11` in white 75 % (20 % and disabled when `!canGoBack`), gap 2. Weekday row height 18: `weekdaySymbols(calendar)`
10 / 600 white 55 %, seven equal columns, `aria-hidden`. Six week rows of 28 with 2 pt between. Cell = `DayCellButton` filling its
column (≈ 74.6 × 28), `tabIndex={-1}`, `data-qr-target="day:<n>"`, label `day of month` 13 tabular, weight 600 when selected or today
else 400; colour: selected → `AccentContrast.label(accent)` on a 28 pt accent disc; not selectable → white 25 % (disabled); today →
accent; else white 85 %. Keyboard ring on the selected day while the grid has focus: 1.5 pt white 85 % circle inset −3 (34 pt).
Grid ring while focused and the draft is on another month: radius 12, 1.5 pt white 60 %, inset −4. Grid root: `role="group"`,
`aria-label="Calendar, <MMMM y>"`, `tabIndex={0}`, `data-qr-field="calendar"`, `data-qr-own-ring`. Day `aria-label` =
`format(day, 'EEEE d MMMM')`, today `aria-current="date"`, selected `aria-pressed="true"`. A month change crossfades header and cells
(`Motion.monthPage`, easeOut 0.15, keyed by month). ‹ blocked by `canGoBack` does nothing.

- [ ] **Step 1: Write the failing test** (September 2026 starts on a Tuesday; en-US weeks start on Sunday)
  ```ts
  // @vitest-environment jsdom
  import './setup';
  import { screen, fireEvent, within } from '@testing-library/react';
  import { ScheduleMonthGrid } from '../../src/recreation/ui/ScheduleMonthGrid';
  import { renderWithCore, ptOf, TEST_NOW, createTestCore } from './support';
  const sep1 = new Date('2026-08-31T22:00:00Z'), sat19 = new Date('2026-09-19T07:00:00Z');
  const grid = (p: Partial<Parameters<typeof ScheduleMonthGrid>[0]> = {}, core = createTestCore()) => renderWithCore(
    <ScheduleMonthGrid draft={sat19} month={sep1} now={TEST_NOW} keyboardFocused={false} onPick={vi.fn()} onPage={vi.fn()} {...p} />, core);
  test('header, weekdays, six weeks', () => {
    const { container } = grid();
    const title = screen.getByText('September 2026');
    expect([ptOf(title.style.fontSize), title.style.fontWeight, ptOf(title.style.paddingLeft)]).toEqual([13, '600', 4]);
    expect(ptOf((container.querySelector('[data-qr-month-header]') as HTMLElement).style.height)).toBe(26);
    const wd = container.querySelector('[data-qr-weekdays]') as HTMLElement;
    expect(ptOf(wd.style.height)).toBe(18);
    expect([...wd.children].map(c => c.textContent)).toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'S']);
    expect((wd.children[0] as HTMLElement).style.color).toBe('rgba(255, 255, 255, 0.55)');
    const rows = container.querySelectorAll('[data-qr-week]');
    expect(rows).toHaveLength(6);
    expect(ptOf((rows[0] as HTMLElement).style.height)).toBe(28);
    expect(ptOf((container.querySelector('[data-qr-weeks]') as HTMLElement).style.gap)).toBe(2);
    const cells = container.querySelectorAll('[data-qr-cell]');
    expect(cells).toHaveLength(42);
    expect(cells[0].textContent).toBe(''); expect(cells[1].textContent).toBe(''); expect(cells[2].textContent).toBe('1');
    expect(cells[31].textContent).toBe('30'); expect(cells[32].textContent).toBe('');
  });
  test('past dimmed and disabled, today in the accent, picked day in the accent disc', () => {
    grid();
    const d17 = screen.getByRole('button', { name: 'Thursday, September 17' }) as HTMLButtonElement;
    expect(d17.disabled).toBe(true);
    expect((d17.querySelector('[data-qr-day-label]') as HTMLElement).style.color).toBe('rgba(255, 255, 255, 0.25)');
    const d18 = screen.getByRole('button', { name: 'Friday, September 18' });
    expect(d18.getAttribute('aria-current')).toBe('date');
    const l18 = d18.querySelector('[data-qr-day-label]') as HTMLElement;
    expect([l18.style.color, l18.style.fontWeight]).toEqual(['var(--qr-list-accent)', '600']);
    const d19 = screen.getByRole('button', { name: 'Saturday, September 19' });
    const l19 = d19.querySelector('[data-qr-day-label]') as HTMLElement;
    expect([l19.style.color, l19.style.fontWeight]).toEqual(['rgb(255, 255, 255)', '600']);
    expect(ptOf((d19.querySelector('[data-qr-day-disc]') as HTMLElement).style.width)).toBe(28);
    const l20 = screen.getByRole('button', { name: 'Sunday, September 20' }).querySelector('[data-qr-day-label]') as HTMLElement;
    expect([l20.style.color, l20.style.fontWeight]).toEqual(['rgba(255, 255, 255, 0.85)', '400']);
  });
  test('picked-day label follows AccentContrast (orange → black)', () => {
    const core = createTestCore(); core.store.setList('home', 'api');
    grid({}, core);
    const l19 = screen.getByRole('button', { name: 'Saturday, September 19' }).querySelector('[data-qr-day-label]') as HTMLElement;
    expect(l19.style.color).toBe('rgb(0, 0, 0)');
  });
  test('paging and picking', () => {
    const onPick = vi.fn(), onPage = vi.fn();
    grid({ onPick, onPage });
    const prev = screen.getByRole('button', { name: 'Previous month' }) as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
    expect((prev.querySelector('[data-qr-glyph]') as HTMLElement).style.color).toBe('rgba(255, 255, 255, 0.2)');
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(onPage).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByRole('button', { name: 'Friday, September 25' }));
    expect(onPick).toHaveBeenCalledWith(new Date('2026-09-24T22:00:00Z'));
  });
  test('one Tab stop; rings', () => {
    const { container, rerender, core } = grid({ keyboardFocused: true });
    const root = screen.getByRole('group', { name: 'Calendar, September 2026' });
    expect(root.tabIndex).toBe(0);
    expect([...root.querySelectorAll('button[data-qr-cell]')].every(b => (b as HTMLButtonElement).tabIndex === -1)).toBe(true);
    const ring = screen.getByRole('button', { name: 'Saturday, September 19' }).querySelector('[data-qr-day-ring]') as HTMLElement;
    expect([ptOf(ring.style.inset), ring.style.opacity]).toEqual([-3, '1']);
    expect((container.querySelector('[data-qr-grid-ring]') as HTMLElement).style.opacity).toBe('0');
    rerender(<ScheduleMonthGrid draft={sat19} month={new Date('2026-09-30T22:00:00Z')} now={TEST_NOW} keyboardFocused onPick={vi.fn()} onPage={vi.fn()} />);
    const gridRing = container.querySelector('[data-qr-grid-ring]') as HTMLElement;
    expect([ptOf(gridRing.style.inset), ptOf(gridRing.style.borderRadius), gridRing.style.opacity]).toEqual([-4, 12, '1']);
  });
  ```
- [ ] **Step 2: Run it** — `npx vitest run tests/ui/ScheduleMonthGrid.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** `ScheduleMonthGrid.tsx`.
- [ ] **Step 4: Run it** — Expected: PASS (5 tests).
- [ ] **Step 5: Commit** — `git add src/recreation/ui/ScheduleMonthGrid.tsx tests/ui/ScheduleMonthGrid.test.tsx && git commit -m "feat(recreation): compact six-week month grid for Set Date"`

---
### Task B17: Set Date rows 1 — type field, preview line, preset cards (`ScheduleNotchSection.swift`)

**Files:**
- Create: `src/recreation/ui/ScheduleNotchSection.tsx` (this task: `ScheduleTypeField`, `SchedulePreview`, `PresetGrid`, `fitScale`)
- Test: `tests/ui/ScheduleRows.test.tsx`

**Interfaces:**
- Consumes: `ScheduleDraft` (`text`, `draft`, `now`, `isInvalid`, `textIsDate`, `highlightedPreset`); `DATE_PRESETS`,
  `DatePresets.{date, title, systemImage}`; formatter `presetDetail`, `dayAndTime`; `RelativeDistance.string`; `ScheduleText.{placeholder, invalidExample, notADate, inThePast}`;
  `KeyHint`, `NotchFillButton` (B4); `SFIcon` (B3); controller `setScheduleText`, `applyPreset` (B9); B9 context.
- Produces:
  ```ts
  export function fitScale(available: number, natural: number, minimum?: number): number;   // min(1, max(minimum = 0.75, available / natural)); natural 0 → 1
  export function ScheduleTypeField(props: { draft: ScheduleDraft }): JSX.Element;
  export function SchedulePreview(props: { draft: ScheduleDraft }): JSX.Element;
  export function previewSpoken(draft: ScheduleDraft, formatter: SuggestionDateFormatter): string;   // "Not a date" | "In the past, <dayAndTime>" | dayAndTime
  export function PresetGrid(props: { draft: ScheduleDraft }): JSX.Element;
  ```

Values (Swift `typeField`, `previewLine`, `presetGrid`, `presetCard`; heights from `ScheduleMetrics`):
- Type field: `data-qr-type-field` box height 36, padding-x 12, flex gap 8, background white 7 %, inner stroke 1 pt white 8 %
  (accent 70 % while the input is focused, `Motion.focusRing` easeOut 0.15), radius 12; `SFIcon keyboard@12` white 45 %; input
  `aria-label="Type a date"`, `data-qr-field="scheduleField"`, `data-qr-target="scheduleField"`, 14 / 400 white, placeholder
  `ScheduleText.placeholder` ("fri 2pm, zítra 14:00, +2h") with `--qr-ph: rgba(255, 255, 255, 0.5)`, `aria-description` = previewSpoken
  (empty text: "For example tomorrow 2pm"); `KeyHint` "⏎" (fade, easeOut 0.15) only while the text is non-empty and `textIsDate`.
  A click anywhere on the box focuses the input. Change → `setScheduleText(value, 'user')`.
- Preview `data-qr-preview`: height 18, padding-left 12, 12 / 500 tabular, one line, flex gap 4, `aria-label="Reminder date"`;
  invalid → `ScheduleText.notADate(ScheduleText.invalidExample(locale))` white 60 %; `draft < now` → `SFIcon exclamationmark.triangle.fill@12`,
  "In the past", both `var(--qr-flag-orange)`, then "· " + dayAndTime white 60 %; else dayAndTime white + "· " + `RelativeDistance.string(now, draft, locale)` white 60 %.
- Presets `data-qr-presets`: CSS grid `repeat(3, minmax(0, 1fr))`, gap 8 (rows and columns); card = `NotchFillButton` kind `selected`
  for `draft.highlightedPreset(state.presetPick)` else `neutral`, radius 12, height 44, padding-x 10, `data-qr-target="preset:<p>"`;
  inside a flex row gap 9: icon slot 18 wide with `SFIcon <DatePresets.systemImage(p)>@13` in the accent; text column gap 1:
  [row gap 4: title 13 / 500 white, spacer `min-width: 2`, "⌘n" 10 / 500 white 50 %], detail 11 / 400 tabular white 60 %
  (`presetDetail(date, now)`); one line each; the column's font sizes are multiplied by `fitScale(columnWidth, naturalWidth)` measured
  in a layout effect (Swift `.minimumScaleFactor(0.75)`, "Tomorrow Evening"). `aria-label` = `${title}, ${presetDetail(date, now, true)}, Command ${n}`,
  `aria-pressed` for the highlighted card. Click → `applyPreset(p, 'user')`.

- [ ] **Step 1: Write the failing test** `tests/ui/ScheduleRows.test.tsx`
  ```ts
  // @vitest-environment jsdom
  import './setup';
  import { screen, fireEvent, within, act } from '@testing-library/react';
  import { ScheduleTypeField, SchedulePreview, PresetGrid, fitScale } from '../../src/recreation/ui/ScheduleNotchSection';
  import { renderWithCore, ptOf, useTestTime, openPanel, createTestCore } from './support';
  import { plainSpaces } from '../support';
  beforeEach(() => useTestTime());
  async function opened() { const core = createTestCore(); await openPanel(core); act(() => core.controller.openSchedule('api')); return core; }
  test('type field', async () => {
    const core = await opened();
    const { container } = renderWithCore(<ScheduleTypeField draft={core.store.scheduleDraft!} />, core);
    const box = container.querySelector('[data-qr-type-field]') as HTMLElement;
    expect([ptOf(box.style.height), ptOf(box.style.paddingLeft), ptOf(box.style.gap), box.style.background, ptOf(box.style.borderRadius)])
      .toEqual([36, 12, 8, 'rgba(255, 255, 255, 0.07)', 12]);
    expect(box.style.boxShadow).toBe('inset 0 0 0 calc(1 * var(--pt) * 1px) rgba(255, 255, 255, 0.08)');
    const field = screen.getByRole('textbox', { name: 'Type a date' }) as HTMLInputElement;
    expect([ptOf(field.style.fontSize), field.placeholder, field.style.getPropertyValue('--qr-ph')]).toEqual([14, 'fri 2pm, zítra 14:00, +2h', 'rgba(255, 255, 255, 0.5)']);
    fireEvent.focus(field);
    expect(box.style.boxShadow).toBe('inset 0 0 0 calc(1 * var(--pt) * 1px) var(--qr-accent-70)');
    fireEvent.change(field, { target: { value: 'tomorrow 2pm' } });
    expect(core.store.scheduleDraft!.draft).toEqual(new Date('2026-09-19T12:00:00Z'));
    expect(screen.getByText('⏎')).toBeTruthy();
    fireEvent.change(field, { target: { value: 'tomorrow please' } });
    expect(screen.queryByText('⏎')).toBeNull();
  });
  test('preview: date, relative distance, past warning, not a date', async () => {
    const core = await opened();
    const { container } = renderWithCore(<SchedulePreview draft={core.store.scheduleDraft!} />, core);
    const line = container.querySelector('[data-qr-preview]') as HTMLElement;
    expect([ptOf(line.style.height), ptOf(line.style.paddingLeft), ptOf(line.style.fontSize), line.style.fontWeight, ptOf(line.style.gap)]).toEqual([18, 12, 12, '500', 4]);
    expect(line.classList.contains('qr-tabular')).toBe(true);
    expect([...line.children].map(c => plainSpaces(c.textContent!))).toEqual(['Saturday, September 19 9:00 AM', '· in 23 hr.']);
    expect((line.children[1] as HTMLElement).style.color).toBe('rgba(255, 255, 255, 0.6)');
    act(() => core.controller.pickDay(new Date('2026-09-17T22:00:00Z'), 'user'));       // today 9:00, an hour ago
    expect(line.querySelector('[data-sf="exclamationmark.triangle.fill@12"]')).not.toBeNull();
    expect(within(line).getByText('In the past').style.color).toBe('var(--qr-flag-orange)');
    expect(plainSpaces(line.lastElementChild!.textContent!)).toBe('· Friday, September 18 9:00 AM');
    act(() => core.controller.setScheduleText('tomorrow please', 'user'));
    expect(line.textContent).toBe('Not a date — try “tomorrow 2pm”');
  });
  test('six preset cards, one highlighted, one click commits', async () => {
    const core = await opened();
    const { container } = renderWithCore(<PresetGrid draft={core.store.scheduleDraft!} />, core);
    const grid = container.querySelector('[data-qr-presets]') as HTMLElement;
    expect([grid.style.display, grid.style.gridTemplateColumns, ptOf(grid.style.gap)]).toEqual(['grid', 'repeat(3, minmax(0, 1fr))', 8]);
    const cards = within(grid).getAllByRole('button');
    expect(cards.map(c => c.querySelector('[data-qr-preset-title]')!.textContent))
      .toEqual(['In 1 Hour', 'This Evening', 'Tomorrow', 'This Weekend', 'Next Week', 'Next Month']);
    expect(cards.map(c => plainSpaces(c.querySelector('[data-qr-preset-detail]')!.textContent!)))
      .toEqual(['11:00 AM', '7:00 PM', 'Sat 9:00 AM', 'Sat 9:00 AM', 'Mon 9:00 AM', 'Oct 1 9:00 AM']);
    expect(cards.map(c => c.querySelector('[data-qr-preset-key]')!.textContent)).toEqual(['⌘1', '⌘2', '⌘3', '⌘4', '⌘5', '⌘6']);
    expect(cards.map(c => c.querySelector('[data-sf]')!.getAttribute('data-sf')))
      .toEqual(['clock@13', 'moon@13', 'sunrise@13', 'sofa@13', 'calendar.badge.plus@13', 'calendar@13']);
    expect(cards.map(c => c.dataset.kind)).toEqual(['neutral', 'neutral', 'selected', 'neutral', 'neutral', 'neutral']);   // Tomorrow before This Weekend on the same minute
    expect([ptOf(cards[0].style.height), ptOf(cards[0].style.paddingLeft), ptOf(cards[0].style.borderRadius)]).toEqual([44, 10, 12]);
    expect(plainSpaces(cards[2].getAttribute('aria-label')!)).toBe('Tomorrow, Saturday 9:00 AM, Command 3');
    fireEvent.click(cards[4]);
    expect(core.store.getState()).toMatchObject({ dueDate: new Date('2026-09-21T07:00:00Z'), presetPick: { preset: 'nextWeek' }, schedule: 'none' });
  });
  test('minimumScaleFactor 0.75', () => {
    expect(fitScale(121.667, 100)).toBe(1);
    expect(fitScale(121.667, 140)).toBeCloseTo(0.869, 3);
    expect(fitScale(50, 140)).toBe(0.75);
    expect(fitScale(100, 0)).toBe(1);
  });
  ```
- [ ] **Step 2: Run it** — `npx vitest run tests/ui/ScheduleRows.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** the four exports in `ScheduleNotchSection.tsx`. Components re-render on `store.scheduleVersion`
  (subscribe through `useScheduleDraft()` or a version selector) and read `presetPick` from `useRecreationState()`.
- [ ] **Step 4: Run it** — Expected: PASS (4 tests).
- [ ] **Step 5: Commit** — `git add src/recreation/ui/ScheduleNotchSection.tsx tests/ui/ScheduleRows.test.tsx && git commit -m "feat(recreation): Set Date type field, live preview and preset cards"`

---

### Task B18: Set Date rows 2 — day / time row, footer, numeric label transition

**Files:**
- Modify: `src/recreation/ui/ScheduleNotchSection.tsx` (add `DayTimeRow`, `ScheduleFooter`)
- Create: `src/recreation/ui/NumericText.tsx`
- Test: `tests/ui/ScheduleControls.test.tsx`

**Interfaces:**
- Consumes: `ScheduleText.chipHours` `[9, 12, 15, 19]`; `ScheduleDefaults.at`; `components`; formatter `format(d, 'EEE d MMM' | 'EEEE d MMMM')`, `time`, `presetDetail`;
  `AccentContrast.label`; `NotchFillButton`, `NotchTextButton` (B4); `SFIcon` (B3); store `timeText`, `setTimeText`, `setTimeFieldEditing` (B7);
  controller `toggleCalendar`, `setTime`, `applyTypedTime`, `clearDueDate`, `cancelSchedule`, `commitSchedule` (B9).
- Produces:
  ```ts
  export function DayTimeRow(props: { draft: ScheduleDraft; showsCalendar: boolean }): JSX.Element;
  export function ScheduleFooter(props: { draft: ScheduleDraft }): JSX.Element;
  export function NumericText(props: { text: string }): JSX.Element;   // per-glyph roll, Swift .contentTransition(.numericText())
  ```

Values (Swift `dayTimeRow`, `timeField`, `timeChip`, `footer`):
- Row: flex, gap 6, height 30. Day button `NotchFillButton` capsule (`radius={null}`), kind `selected` while the calendar shows else `neutral`,
  padding-x 11, height 30, `aria-label="Calendar"`, `aria-description` = `format(draft, 'EEEE d MMMM')`, `title="Calendar ⌘K"`,
  `aria-expanded={showsCalendar}`, `data-qr-target="dayButton"`; inside gap 6: `SFIcon calendar@12` accent, text `format(draft, 'EEE d MMM')`
  13 / 500 tabular white, `SFIcon chevron.down@9` white 50 % rotated 180° while the calendar shows (easeOut 0.15). Click → `toggleCalendar('user')`.
- Time field: capsule width 96, height 30, padding-x 10, gap 5, background white 7 %, inner stroke accent 70 % while focused else none
  (`Motion.focusRing`); `SFIcon clock@11` white 45 %; input `aria-label="Time"`, `data-qr-field="timeField"`, `data-qr-target="timeField"`,
  13 / 500 tabular white, value `store.timeText`; focus → `setTimeFieldEditing(true)`; change → `setTimeText`; blur → `applyTypedTime(false)` then
  `setTimeFieldEditing(false)` (Swift `.onChange(of: focus)` applies on leaving, no beep).
- Spacer `flex: 1 0 auto; min-width: 6`. Chips: flex gap 4; each `NotchFillButton` capsule, padding-x 10, height 30, 12 / 500 tabular,
  label `formatter.time(ScheduleDefaults.at(h, 0, draft))`, kind `prominent` with label colour `AccentContrast.label(accent)` when the draft
  is exactly h:00, else `neutral` with white 75 %; `aria-label` "Set time to <label>", `aria-pressed`, `data-qr-target="timeChip:<h>"`;
  click → `setTime(h, 0, 'user')`.
- Footer: flex, gap 8, height 36. "Clear" `NotchTextButton` only while `state.dueDate !== null` (`data-qr-target="clear"`) → `clearDueDate('user')`;
  spacer; Cancel `NotchFillButton neutral radius 12`, 13 / 500 white 85 %, padding-x 16, height 36 (`data-qr-target="cancel"`) → `cancelSchedule('user')`;
  Set `NotchFillButton prominent radius 12`, 13 / 600 tabular, padding-x 18, height 36, label `NumericText` "Set · " + `presetDetail(draft, now)`,
  colour white while invalid else `AccentContrast.label(accent)`, disabled while `draft.isInvalid`, `aria-label` "Set, " + spoken detail,
  `data-qr-target="set"` → `commitSchedule('user')`.
- `NumericText`: one `span` per character keyed `${index}:${char}` inside `AnimatePresence initial={false} mode="popLayout"`; a changed
  character exits to y −0.6em with opacity 0 and the new one enters from y 0.6em, `Motion.chip`; reduced → `INSTANT`; `aria-hidden`
  on the glyph spans with the full text in a visually hidden span.

- [ ] **Step 1: Write the failing test** `tests/ui/ScheduleControls.test.tsx` (same `opened()` helper as B17)
  ```ts
  test('day button and calendar toggle', async () => {
    const core = await opened();
    const { rerender } = renderWithCore(<DayTimeRow draft={core.store.scheduleDraft!} showsCalendar={false} />, core);
    const day = screen.getByRole('button', { name: 'Calendar' });
    expect(within(day).getByText('Sat, Sep 19')).toBeTruthy();
    expect([ptOf(day.style.height), ptOf(day.style.paddingLeft), ptOf(day.style.borderRadius), day.dataset.kind]).toEqual([30, 11, 999, 'neutral']);
    expect(day.querySelector('[data-sf="calendar@12"]')).not.toBeNull();
    const chevron = day.querySelector('[data-sf="chevron.down@9"]')!.closest('[data-qr-glyph]') as HTMLElement;
    expect(chevron.dataset.rotation).toBe('0');
    fireEvent.click(day);
    expect(core.store.getState().schedule).toBe('calendar');
    rerender(<DayTimeRow draft={core.store.scheduleDraft!} showsCalendar />);
    expect(screen.getByRole('button', { name: 'Calendar' }).dataset.kind).toBe('selected');
    expect((screen.getByRole('button', { name: 'Calendar' }).querySelector('[data-qr-glyph][data-rotation]') as HTMLElement).dataset.rotation).toBe('180');
  });
  test('time field 96 pt, typed time applies on blur, invalid reverts', async () => {
    const core = await opened();
    renderWithCore(<DayTimeRow draft={core.store.scheduleDraft!} showsCalendar={false} />, core);
    const time = screen.getByRole('textbox', { name: 'Time' }) as HTMLInputElement;
    const cap = time.closest('[data-qr-time-field]') as HTMLElement;
    expect([ptOf(cap.style.width), ptOf(cap.style.height), ptOf(cap.style.paddingLeft), ptOf(cap.style.gap)]).toEqual([96, 30, 10, 5]);
    expect(plainSpaces(time.value)).toBe('9:00 AM');
    fireEvent.focus(time); fireEvent.change(time, { target: { value: '1430' } }); fireEvent.blur(time);
    expect(core.store.scheduleDraft!.draft).toEqual(new Date('2026-09-19T12:30:00Z'));
    expect(plainSpaces(time.value)).toBe('2:30 PM');
    fireEvent.focus(time); fireEvent.change(time, { target: { value: 'soon' } }); fireEvent.blur(time);
    expect(plainSpaces(time.value)).toBe('2:30 PM');
    expect(core.store.beepCount).toBe(0);
  });
  test('time chips 9 / 12 / 15 / 19, the current one prominent', async () => {
    const core = await opened();
    renderWithCore(<DayTimeRow draft={core.store.scheduleDraft!} showsCalendar={false} />, core);
    const chips = ['9:00 AM', '12:00 PM', '3:00 PM', '7:00 PM'].map(t => screen.getByRole('button', { name: `Set time to ${t.replace(' ', ' ')}` }));
    expect(chips.map(c => c.dataset.kind)).toEqual(['prominent', 'neutral', 'neutral', 'neutral']);
    expect(chips[0].style.color).toBe('rgb(255, 255, 255)');
    expect(chips[1].style.color).toBe('rgba(255, 255, 255, 0.75)');
    expect([ptOf(chips[1].style.height), ptOf(chips[1].style.paddingLeft), ptOf(chips[1].style.fontSize)]).toEqual([30, 10, 12]);
    fireEvent.click(chips[2]);
    expect(core.store.scheduleDraft!.draft).toEqual(new Date('2026-09-19T13:00:00Z'));
  });
  test('footer: Clear only with a date, Cancel, “Set · Sat 9:00 AM”', async () => {
    const core = await opened();
    renderWithCore(<ScheduleFooter draft={core.store.scheduleDraft!} />, core);
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect([ptOf(cancel.style.height), ptOf(cancel.style.paddingLeft), ptOf(cancel.style.borderRadius), cancel.style.color]).toEqual([36, 16, 12, 'rgba(255, 255, 255, 0.85)']);
    const set = screen.getByRole('button', { name: /^Set, / }) as HTMLButtonElement;
    expect(plainSpaces(set.textContent!)).toContain('Set · Sat 9:00 AM');
    expect([ptOf(set.style.paddingLeft), set.style.fontWeight, set.style.color, set.dataset.kind]).toEqual([18, '600', 'rgb(255, 255, 255)', 'prominent']);
    act(() => core.controller.setScheduleText('tomorrow please', 'user'));
    expect(set.disabled).toBe(true);
    act(() => core.controller.setScheduleText('', 'user'));
    fireEvent.click(set);
    expect(core.store.getState()).toMatchObject({ schedule: 'none', dueDate: new Date('2026-09-19T07:00:00Z') });
  });
  test('Clear shows once a date is set and removes it', async () => {
    const core = await opened();
    act(() => core.controller.cancelSchedule('api'));
    act(() => { core.controller.setDueDate(new Date('2026-09-20T07:00:00Z'), null, 'api'); core.controller.openSchedule('api'); });
    renderWithCore(<ScheduleFooter draft={core.store.scheduleDraft!} />, core);
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(core.store.getState()).toMatchObject({ dueDate: null, schedule: 'none' });
  });
  test('NumericText re-keys only the glyphs that changed', () => {
    const { container, rerender } = renderWithCore(<NumericText text="Sat 9:00" />);
    const keys = () => [...container.querySelectorAll('[data-char-key]')].map(e => (e as HTMLElement).dataset.charKey);
    expect(keys()).toEqual(['0:S', '1:a', '2:t', '3: ', '4:9', '5::', '6:0', '7:0']);
    rerender(<NumericText text="Sat 3:00" />);
    expect(keys()).toContain('4:3');
    expect(keys().filter(k => k !== '4:9' && k !== '4:3')).toEqual(['0:S', '1:a', '2:t', '3: ', '5::', '6:0', '7:0']);
  });
  ```
- [ ] **Step 2: Run it** — `npx vitest run tests/ui/ScheduleControls.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** `DayTimeRow`, `ScheduleFooter`, `NumericText` (the rotating chevron wrapper carries `data-rotation`).
- [ ] **Step 4: Run it** — Expected: PASS (6 tests).
- [ ] **Step 5: Commit** — `git add src/recreation/ui/ScheduleNotchSection.tsx src/recreation/ui/NumericText.tsx tests/ui/ScheduleControls.test.tsx && git commit -m "feat(recreation): Set Date day and time row, time chips and footer"`

---

### Task B19: The in-notch Set Date section — composition, stagger, calendar slot, focus, announcements, clamp

**Files:**
- Modify: `src/recreation/ui/ScheduleNotchSection.tsx` (add the default export `ScheduleNotchSection`)
- Test: `tests/ui/ScheduleNotchSection.test.tsx`

**Interfaces:**
- Consumes: B16, B17, B18; `staggerTransition`, `effective('schedule')`, `toTransition(Motion.sectionIn | sectionOut | reduced)` (B1);
  `NotchLayout.openSize`, `panelSize`, `ScheduleMetrics` (gaps); `usePanel`, `useScheduleDraft` (B9); store `calendarMonth`, `pageMonth`; controller `pickDay`.
- Produces:
  ```ts
  export function ScheduleNotchSection(): JSX.Element;   // mounted by QuickReminderView while panel.flags.schedule !== 'none'
  export const ANNOUNCE_PAUSE_MS: 400;
  ```

Layout (Swift `ScheduleNotchSection.body`, `rows`, `QuickReminderView` `.padding(.bottom, 20)`; heights `ScheduleMetrics`):
root `role="group"`, `aria-label="Set Date"`, `data-qr-section`, flex column, `flex: 1 1 auto; min-height: 0; padding-bottom: 20`;
a rows area (`data-qr-section-rows`, `flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain`) holding:
type field (stagger 0), preview `margin-top: 6` (stagger 0), presets `margin-top: 10` (stagger 1), day / time row `margin-top: 12`
(stagger 2), and while `schedule === 'calendar'` the month grid `margin-top: 10`; then the footer `margin-top: 14` (stagger 3) outside
the rows area (pinned). Stagger: each row starts at opacity 0, translateY −6 pt, blur 3 pt and animates to 0 with
`staggerTransition(i)` (easeOut 0.24, delay 0.06 + i·0.035); under reduce only the opacity, `Motion.reduced`. The y and blur are motion
values in points composed into `transform: translateY(calc(v * var(--pt) * 1px))` and `filter: blur(calc(b * var(--pt) * 1px))`.
Section enter: opacity with `Motion.sectionIn` (easeOut 0.12); exit (`AnimatePresence` in B20): opacity `Motion.sectionOut` (easeOut 0.10)
while the blob retracts over it. Calendar slot: `AnimatePresence`, enter / exit opacity + translateY −8 pt with `effective('schedule')`;
reduce → opacity only. The section keeps the `ScheduleDraft` it mounted with (`useRef`), so it can render during its exit after the store
dropped the draft. Clamp: `data-clamped` = `panelSize(sizes, schedule).height < NotchLayout.openSize(39, schedule).height`; when clamped and
the calendar opens, `grid.scrollIntoView({ block: 'end', behavior: reduce ? 'auto' : 'smooth' })` (Swift `proxy.scrollTo(calendarID, anchor: .bottom)`
with easeOut 0.25). Announcements: a visually hidden `aria-live="polite"` region; 400 ms × time scale after the last change of a non-blank
`draft.text` it receives `previewSpoken()`; a further change, a commit or the unmount cancels it (`ScheduleDraft.announceAfterPause`).
Grid wiring: `month = store.calendarMonth`, `onPick = pickDay(day, 'user')`, `onPage = store.pageMonth`, `keyboardFocused` = the grid has focus.

- [ ] **Step 1: Write the failing test**
  ```ts
  // @vitest-environment jsdom
  import './setup';
  import { screen, act, fireEvent } from '@testing-library/react';
  import { ScheduleNotchSection } from '../../src/recreation/ui/ScheduleNotchSection';
  import { renderWithCore, ptOf, useTestTime, openPanel, createTestCore } from './support';
  beforeEach(() => useTestTime());
  test('rows in the Swift rhythm, footer pinned below the rows', async () => {
    const core = createTestCore(); await openPanel(core);
    act(() => core.controller.openSchedule('user'));
    const { container } = renderWithCore(<ScheduleNotchSection />, core);
    const section = screen.getByRole('group', { name: 'Set Date' });
    expect(ptOf(section.style.paddingBottom)).toBe(20);
    const m = (sel: string) => ptOf((container.querySelector(sel)!.closest('[data-qr-row]') as HTMLElement).style.marginTop || 'calc(0 * var(--pt) * 1px)');
    expect([m('[data-qr-type-field]'), m('[data-qr-preview]'), m('[data-qr-presets]'), m('[data-qr-day-time]'), m('[data-qr-footer]')]).toEqual([0, 6, 10, 12, 14]);
    const rows = container.querySelector('[data-qr-section-rows]') as HTMLElement;
    expect(rows.style.overflowY).toBe('auto');
    expect(rows.contains(container.querySelector('[data-qr-footer]'))).toBe(false);
    expect([...container.querySelectorAll('[data-qr-row]')].map(r => (r as HTMLElement).dataset.stagger)).toEqual(['0', '0', '1', '2', '3']);
    expect(container.querySelector('[data-qr-calendar]')).toBeNull();
    act(() => core.controller.openCalendar('user'));
    expect(m('[data-qr-calendar]')).toBe(10);
  });
  test('focus: the field on open, the grid with the calendar, back to the field without it', async () => {
    const core = createTestCore(); await openPanel(core);
    renderWithCore(<ScheduleNotchSection />, core);   // renders nothing until the section opens
    act(() => core.controller.openSchedule('user'));
    await act(async () => { vi.advanceTimersByTime(0); });
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Type a date' }));
    act(() => core.controller.openCalendar('user'));
    await act(async () => { vi.advanceTimersByTime(0); });
    expect((document.activeElement as HTMLElement).dataset.qrField).toBe('calendar');
    act(() => core.controller.closeCalendar('user'));
    await act(async () => { vi.advanceTimersByTime(0); });
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Type a date' }));
  });
  test('an API open never takes focus', async () => {
    const core = createTestCore(); await openPanel(core);
    renderWithCore(<ScheduleNotchSection />, core);
    act(() => core.controller.openSchedule('api'));
    await act(async () => { vi.advanceTimersByTime(0); });
    expect(document.activeElement).toBe(document.body);
  });
  test('the preview is announced 400 ms after typing pauses', async () => {
    const core = createTestCore(); await openPanel(core);
    act(() => core.controller.openSchedule('user'));
    const { container } = renderWithCore(<ScheduleNotchSection />, core);
    const live = container.querySelector('[aria-live="polite"]') as HTMLElement;
    act(() => core.controller.setScheduleText('tomorrow', 'user'));
    await act(async () => { vi.advanceTimersByTime(300); });
    act(() => core.controller.setScheduleText('tomorrow 2pm', 'user'));
    await act(async () => { vi.advanceTimersByTime(399); });
    expect(live.textContent).toBe('');
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(live.textContent!.replace(/ /g, ' ')).toBe('Saturday, September 19 2:00 PM');
    act(() => core.controller.setScheduleText('tomorrow please', 'user'));
    await act(async () => { vi.advanceTimersByTime(400); });
    expect(live.textContent).toBe('Not a date');
  });
  test('clamped to a short screen: only the rows scroll', async () => {
    const core = createTestCore({ screenHeight: 600 }); await openPanel(core);
    act(() => core.controller.openCalendar('user'));
    renderWithCore(<ScheduleNotchSection />, core);
    expect(screen.getByRole('group', { name: 'Set Date' }).dataset.clamped).toBe('true');   // 751 natural > 600 − 40
    const tall = createTestCore(); await openPanel(tall);
    act(() => tall.controller.openCalendar('user'));
    const { container } = renderWithCore(<ScheduleNotchSection />, tall);
    expect((container.querySelector('[data-qr-section]') as HTMLElement).dataset.clamped).toBe('false');
  });
  ```
- [ ] **Step 2: Run it** — `npx vitest run tests/ui/ScheduleNotchSection.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** `ScheduleNotchSection` (renders `null` while `panel.flags.schedule === 'none'` and no draft was captured).
  The day / time wrapper carries `data-qr-day-time`, the footer `data-qr-footer`, the grid wrapper `data-qr-calendar`; every row wrapper is
  `data-qr-row` with `data-stagger`.
- [ ] **Step 4: Run it** — `npx vitest run tests/ui/ScheduleNotchSection.test.tsx tests/ui/ScheduleRows.test.tsx tests/ui/ScheduleControls.test.tsx`. Expected: PASS.
- [ ] **Step 5: Commit** — `git add src/recreation/ui/ScheduleNotchSection.tsx tests/ui/ScheduleNotchSection.test.tsx && git commit -m "feat(recreation): in-notch Set Date section with staggered rows, calendar slot and announcements"`

---

### Task B20: QuickReminderView — the open panel's vertical rhythm (`QuickReminderView.swift`)

**Files:**
- Create: `src/recreation/ui/QuickReminderView.tsx`
- Test: `tests/ui/QuickReminderView.test.tsx`

**Interfaces:**
- Consumes: `HeaderView` (B11), `InputView` (B10), `ChipSlot` (B12), `BottomBar` (B13), `ScheduleNotchSection` (B19); `panelSize`, `notchBandHeight`;
  `usePanel`, `useRecreationState`, `useCore` (B9); controller `pointerDownInPanel`.
- Produces:
  ```ts
  export const RHYTHM = { headerTop: 8, inputTop: 10, chipSlot: 26, chipToBar: 8, barBottom: 20, inset: 39 } as const;  // SPEC §4, Theme.horizontalPadding + openTopRadius
  export function QuickReminderView(): JSX.Element;
  ```

Layout: root `data-qr-panel-content`, `width: px(panel.width)`, `height: px(panel.height)` (the **target** panel size: the section is laid
out at its final height at once, `NotchMachine.changeSection`), flex column, `padding: 0 px(39)`, `pointer-events: none` on the root and
`auto` on its children while `flags.isOpen && !ignoresMouse` (Swift `allowsHitTesting(state.isOpen)`); a 39 pt band spacer (the notch band,
dead zone, `notchBandHeight`); header wrapper `margin-top: 8`; input wrapper `margin-top: 10`; chip slot wrapper `margin-bottom: 8`; bottom bar
wrapper `margin-bottom: 20`; then `AnimatePresence` with `ScheduleNotchSection` while `flags.schedule !== 'none'`. The plain panel never changes
for the section. `onPointerDownCapture`: y in points = `(clientY − rect.top) · panelHeight / rect.height` → `pointerDownInPanel(y)` (the click still lands).

- [ ] **Step 1: Write the failing test**
  ```ts
  // @vitest-environment jsdom
  import './setup';
  import { screen, act, fireEvent } from '@testing-library/react';
  import { QuickReminderView } from '../../src/recreation/ui/QuickReminderView';
  import { renderWithCore, ptOf, useTestTime, openPanel, createTestCore } from './support';
  beforeEach(() => useTestTime());
  test('band 39 → 8 → header → 10 → input → slot 26 → 8 → bar → 20; 39 pt side inset', async () => {
    const core = createTestCore(); await openPanel(core);
    const { container } = renderWithCore(<QuickReminderView />, core);
    const root = container.querySelector('[data-qr-panel-content]') as HTMLElement;
    expect([ptOf(root.style.width), ptOf(root.style.height), ptOf(root.style.paddingLeft), ptOf(root.style.paddingRight)]).toEqual([600, 241, 39, 39]);
    expect(ptOf((root.querySelector('[data-qr-band]') as HTMLElement).style.height)).toBe(39);
    const wrap = (sel: string) => container.querySelector(sel)!.closest('[data-qr-stack-item]') as HTMLElement;
    expect(ptOf(wrap('[data-qr-header]').style.marginTop)).toBe(8);
    expect(ptOf(wrap('[data-qr-input-row]').style.marginTop)).toBe(10);
    expect(ptOf(wrap('[data-qr-chip-slot]').style.marginBottom)).toBe(8);
    expect(ptOf(wrap('[data-qr-pill]').style.marginBottom)).toBe(20);
    expect(container.querySelector('[data-qr-section]')).toBeNull();
  });
  test('Set Date is appended below the bar; the plain panel stays', async () => {
    const core = createTestCore(); await openPanel(core);
    const { container } = renderWithCore(<QuickReminderView />, core);
    act(() => core.controller.openSchedule('user'));
    const root = container.querySelector('[data-qr-panel-content]') as HTMLElement;
    expect(ptOf(root.style.height)).toBe(519);
    const pill = root.querySelector('[data-qr-pill]')!, section = root.querySelector('[data-qr-section]')!;
    expect(pill.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(root.querySelector('[data-qr-chip-slot]')).not.toBeNull();
    act(() => core.controller.openCalendar('user'));
    expect(ptOf(root.style.height)).toBe(751);
  });
  test('a press on the title row cancels the section, a press on the bar does not', async () => {
    const core = createTestCore(); await openPanel(core);
    const { container } = renderWithCore(<QuickReminderView />, core);
    act(() => core.controller.openSchedule('user'));
    const root = container.querySelector('[data-qr-panel-content]') as HTMLElement;
    root.getBoundingClientRect = () => ({ top: 0, left: 0, width: 600, height: 519, right: 600, bottom: 519, x: 0, y: 0, toJSON() {} });
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Toggle flag' }), { clientY: 197 });
    expect(core.store.getState().schedule).toBe('controls');
    fireEvent.pointerDown(screen.getByRole('textbox', { name: 'New Reminder' }), { clientY: 105 });
    expect(core.store.getState().schedule).toBe('none');
  });
  test('no pointer input while closed', () => {
    const { container } = renderWithCore(<QuickReminderView />);
    expect((container.querySelector('[data-qr-panel-content]') as HTMLElement).dataset.interactive).toBe('false');
  });
  ```
- [ ] **Step 2: Run it** — `npx vitest run tests/ui/QuickReminderView.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** `QuickReminderView.tsx` (each wrapper carries `data-qr-stack-item`; `HeaderView`'s root carries `data-qr-header`;
  `data-interactive` mirrors the pointer-events decision).
- [ ] **Step 4: Run it** — Expected: PASS (4 tests).
- [ ] **Step 5: Commit** — `git add src/recreation/ui/QuickReminderView.tsx tests/ui/QuickReminderView.test.tsx && git commit -m "feat(recreation): open panel layout with the SPEC vertical rhythm"`

---

### Task B21: NotchContainer — silhouette, masked content transition, saved badge, popovers, click outside (`NotchContainerView.swift`)

**Files:**
- Create: `src/recreation/ui/NotchContainer.tsx`
- Test: `tests/ui/NotchContainer.test.tsx`

**Interfaces:**
- Consumes: `NotchSilhouette`, `useNotchGeometry`, `translatedNotchPath`, `ShapeTarget` (B5); `QuickReminderView` (B20); `SavedCheckView` (B15);
  `ListPickerMenu` (B11), `LocationPopover` (B14); `currentSize`, `radii`, `panelSize`, `savedSize`; `NotchLayout.{canvasSize, savedBadgeSize, savedBadgeTrailingPadding}`;
  `effective`, `INSTANT`, `FlagAnimation` (B1); `usePanel`, `useRecreationState`, `useCore` (B9); controller `show('click', true)` (press on the closed notch), `hover`, `pointerDownOutside`, `closeListPicker`, `closeLocationPopover`.
- Produces:
  ```ts
  export function canvasFor(sizes: NotchSizes): Size;                           // canvasSize(panelSize(sizes, 'calendar')): 648 × 775
  export function contentTransition(animation: FlagAnimation, reduceMotion: boolean, timeScale: number): Transition;
  export function badgeOrigin(sizes: NotchSizes, canvasWidth: number): { left: number; top: number };   // { 459.5, 7.5 }
  export function NotchContainer(): JSX.Element;
  ```

Rules (Swift `NotchContainerView`, `PanelController`):
- Canvas `data-qr-canvas`: `width/height = px(canvasFor(sizes))`, `position: relative`, `pointer-events: none`, `--qr-list-accent: <state.accent>`,
  class `qr-root`.
- Silhouette: target `{ ...currentSize(flags, sizes), ...radii(flags) }` (saving → saved pill 379 × 39; open → panelSize; hovering → 257 × 44;
  else 235 × 39; radii 19 / 32 open else 6 / 14), animation = `panel.animation`; hover → `controller.hover`; press while closed → `controller.show('click', true)`.
- Content wrapper `data-qr-content`: absolutely placed at `left: px((canvas.width − panel.width) / 2)` (24), top 0, size = `panelSize(sizes, flags.schedule)`;
  opacity 1 / 0, blur 0 / 8 pt and scale 1 / 0.94 from the top (`transform-origin: top center`) for `contentVisible` true / false; under reduce blur 0
  and scale 1 always; transition `contentTransition(panel.animation)`: `open` → `effective('contentIn')`, `close` and `saving` → `effective('contentOut')`
  (saving always `Motion.contentOut`), `none` → `INSTANT`. `aria-hidden` and `inert` while `!flags.isOpen`.
  Mask: while `!flags.isSettled`, `clip-path: path("<translatedNotchPath(live geometry, panel.width)>")` re-derived per frame from the silhouette's
  motion values; settled → `clip-path: none` (Swift drops the mask once settled).
- Saved badge: while `flags.savedBadgeShown`, a wrapper at `badgeOrigin` (right edge = canvas centre + savedWidth / 2 − 30, centre y = 39 / 2) holding
  `SavedCheckView visible={flags.isSaving}`; the ✓ and the badge share `layoutId="save"` inside one `LayoutGroup` (the whole container).
- Popover layer: `ListPickerMenu` and `LocationPopover` rendered last (above the content).
- Click outside: while the phase is open or saving, a capture `pointerdown` listener on the document: target inside a popover → nothing;
  a popover is open and the target is elsewhere inside the shape → close the popover only; target inside the content or the silhouette path → nothing;
  else (scoped to the closest `[data-qr-screen]` ancestor when there is one) → `pointerDownOutside()`.

- [ ] **Step 1: Write the failing test**
  ```ts
  // @vitest-environment jsdom
  import './setup';
  import { screen, act, fireEvent, waitFor } from '@testing-library/react';
  import { NotchContainer, canvasFor, contentTransition, badgeOrigin } from '../../src/recreation/ui/NotchContainer';
  import { translatedNotchPath } from '../../src/recreation/ui/NotchSilhouette';
  import { renderWithCore, ptOf, useTestTime, openPanel, createTestCore } from './support';
  beforeEach(() => useTestTime());
  const adv = (ms: number) => act(async () => { vi.advanceTimersByTime(ms); });
  test('pure parts', () => {
    const core = createTestCore();
    expect(canvasFor(core.sizes)).toEqual({ width: 648, height: 775 });
    expect(badgeOrigin(core.sizes, 648)).toEqual({ left: 459.5, top: 7.5 });
    expect(contentTransition('open', false, 1)).toEqual({ type: 'tween', ease: [0, 0, 0.58, 1], duration: 0.2, delay: 0.16 });
    expect(contentTransition('close', false, 1)).toEqual({ type: 'tween', ease: [0, 0, 0.58, 1], duration: 0.12 });
    expect(contentTransition('saving', false, 1)).toEqual({ type: 'tween', ease: [0, 0, 0.58, 1], duration: 0.12 });
    expect(contentTransition('open', true, 1)).toEqual({ type: 'tween', ease: [0, 0, 0.58, 1], duration: 0.15 });
  });
  test('closed: the notch silhouette only; content hidden and inert', () => {
    const { container } = renderWithCore(<NotchContainer />);
    const canvas = container.querySelector('[data-qr-canvas]') as HTMLElement;
    expect([ptOf(canvas.style.width), ptOf(canvas.style.height)]).toEqual([648, 775]);
    expect(container.querySelector('path[data-qr-target="notch"]')!.getAttribute('d')).toBe(translatedNotchPath({ width: 235, height: 39, top: 6, bottom: 14 }, 648));
    const content = container.querySelector('[data-qr-content]') as HTMLElement;
    expect(content.getAttribute('aria-hidden')).toBe('true');
    expect(content.hasAttribute('inert')).toBe(true);
    expect([ptOf(content.style.left), ptOf(content.style.width), ptOf(content.style.height)]).toEqual([24, 600, 241]);
  });
  test('open: 600 × 241 with open radii, content in, mask until settled', async () => {
    const core = createTestCore();
    const { container } = renderWithCore(<NotchContainer />, core);
    act(() => { core.controller.show('api', false); });
    await adv(100);
    const content = container.querySelector('[data-qr-content]') as HTMLElement;
    await waitFor(() => expect(container.querySelector('path')!.getAttribute('d')).toBe(translatedNotchPath({ width: 600, height: 241, top: 19, bottom: 32 }, 648)));
    expect(content.style.clipPath.startsWith('path("M0 0 Q19 0 19 19 ')).toBe(true);
    await waitFor(() => expect(content.style.opacity).toBe('1'));
    expect(content.getAttribute('aria-hidden')).toBeNull();
    await adv(400);
    expect(content.style.clipPath).toBe('none');
  });
  test('saving: the badge sits in the right extension of the 379 pt pill', async () => {
    const core = createTestCore();
    const { container } = renderWithCore(<NotchContainer />, core);
    await openPanel(core);
    act(() => core.controller.setTitle('Buy milk', 'user'));
    act(() => { core.controller.save('user'); });
    await waitFor(() => expect(container.querySelector('path')!.getAttribute('d')).toBe(translatedNotchPath({ width: 379, height: 39, top: 6, bottom: 14 }, 648)));
    const slot = container.querySelector('[data-qr-badge-slot]') as HTMLElement;
    expect([ptOf(slot.style.left), ptOf(slot.style.top)]).toEqual([459.5, 7.5]);
    expect(screen.getByRole('img', { name: 'Saved' })).toBeTruthy();
    await adv(1360);
    expect(container.querySelector('[data-qr-badge-slot]')).toBeNull();
  });
  test('click outside closes; a press on the black does not; outside a popover closes just the popover', async () => {
    const core = createTestCore();
    renderWithCore(<div data-qr-screen><NotchContainer /><button>Desktop</button></div>, core);
    await openPanel(core);
    fireEvent.pointerDown(document.querySelector('path[data-qr-target="notch"]')!);
    expect(core.store.getState().phase).toEqual({ type: 'open' });
    act(() => core.controller.openListPicker());
    fireEvent.pointerDown(screen.getByRole('textbox', { name: 'New Reminder' }));
    expect(core.store.getState()).toMatchObject({ listPickerOpen: false, phase: { type: 'open' } });
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Desktop' }));
    expect(core.store.getState().phase).toEqual({ type: 'closing' });
  });
  test('reduce motion: no blur and no scale on the content', () => {
    const { container } = renderWithCore(<NotchContainer />, undefined, { reduceMotion: true });
    const content = container.querySelector('[data-qr-content]') as HTMLElement;
    expect(content.style.filter).toBe('blur(calc(0 * var(--pt) * 1px))');
    expect(['', 'none'].includes(content.style.transform)).toBe(true);
  });
  ```
- [ ] **Step 2: Run it** — `npx vitest run tests/ui/NotchContainer.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** `NotchContainer.tsx` with the rules above (opacity, blur and scale as motion values; blur composed into the
  `filter` string in points; the clip path from `useTransform` over the silhouette's four motion values).
- [ ] **Step 4: Run it** — `npx vitest run tests/ui`. Expected: PASS.
- [ ] **Step 5: Commit** — `git add src/recreation/ui/NotchContainer.tsx tests/ui/NotchContainer.test.tsx && git commit -m "feat(recreation): notch container with masked content, saved badge and click-outside"`

---
### Task B22: Keyboard — scoped to the focused desktop, always `preventDefault` (landing spec §11.3)

The recreation handles every key whose target is inside it (fields, buttons, grid), only while `shortcutsEnabled`
(focus inside the desktop), and stops the event so the desktop router never sees it twice (§0 cross-part requirements).
Also makes the closed notch reachable by keyboard (landing spec §9).

**Files:**
- Create: `src/recreation/ui/keyboard.ts`
- Modify: `src/recreation/ui/NotchContainer.tsx` (keyboard notch button)
- Test: `tests/ui/keyboard.test.ts`, `tests/ui/keyboardIntegration.test.tsx`

**Interfaces:**
- Consumes: `RecreationState`; `FocusField`; `DATE_PRESETS`; controller methods (B9); `useCore` (B9).
- Produces:
  ```ts
  export type RecreationKeyAction =
    | { type: 'escape' } | { type: 'swallow' } | { type: 'toggle' } | { type: 'submit' } | { type: 'textRowSubmit' }
    | { type: 'commitSchedule' } | { type: 'applyTypedTime' } | { type: 'closeLocation' } | { type: 'applySuggestion' }
    | { type: 'openSchedule' } | { type: 'toggleCalendar' } | { type: 'preset'; preset: DatePreset }
    | { type: 'stepTime'; steps: 1 | -1 } | { type: 'moveDay'; days: -7 | -1 | 1 | 7 };
  export interface KeyContext { readonly state: RecreationState; readonly field: FocusField | null; readonly cmdKey: 'meta' | 'ctrl' }   // field = data-qr-field of the closest ancestor of the event target
  export function recreationKeyFor(e: Pick<KeyboardEvent, 'key' | 'code' | 'metaKey' | 'shiftKey' | 'altKey' | 'ctrlKey' | 'isComposing'>, ctx: KeyContext): RecreationKeyAction | null;
  export function platformCmdKey(platform?: string): 'meta' | 'ctrl';          // Mac / iPhone / iPad → 'meta'
  export function useRecreationKeys(enabled: boolean): (e: ReactKeyboardEvent) => void;   // for the recreation root's onKeyDown
  ```

Key map (Swift sources in brackets; ⌘ = `cmdKey` held with no other modifier unless stated; `open` = phase open, `section` = schedule ≠ none):

| Key | Condition | Action |
|---|---|---|
| any | `isComposing` (IME) | null |
| Esc | open or saving | `escape` [Esc monitor + `.panelDismissPopovers`; during the hold it hides] |
| any other key | phase saving | `swallow` [PanelController: "during the saved hold … swallow quietly"] |
| ⇧⌘R | any | `toggle` [hotkey again collapses] |
| ⌘↩ | open | `submit` [✓ `keyboardShortcut(.return, .command)`; `CommandReturnTwin` while a section is open] |
| ↩ | field `title` / `notes` | `textRowSubmit` [PlainTextView `insertNewline` → `submitFromTextRow`] |
| ↩ | field `scheduleField` | `commitSchedule` [`.onSubmit(commit)`] |
| ↩ | field `timeField` | `applyTypedTime` [consumes ↩, keeps the section open] |
| ↩ | field `locationField` | `closeLocation` [`.onSubmit { showLocationField = false }`] |
| ↩ | section open, focus on any other element inside | `commitSchedule` [Set is `.defaultAction`] |
| Tab (no modifiers) | field `title`, `state.suggestion !== null` | `applySuggestion` [`onTab`]; otherwise null (native focus move) |
| ⌘D | open, badge not shown | `openSchedule` [`setDateShortcut`] |
| ⌘K | section open | `toggleCalendar` [`calendarShortcut`] |
| ⌘1 … ⌘6 (`code` `Digit1`…`Digit6`) | section open | `preset` `DATE_PRESETS[n − 1]` [`presetCard` `.keyboardShortcut`] |
| ↑ / ↓ | field `timeField` | `stepTime` +1 / −1 [`.onKeyPress(.upArrow / .downArrow)`] |
| ← / → / ↑ / ↓ | field `calendar` | `moveDay` −1 / +1 / −7 / +7 [grid `.onKeyPress`] |
| anything else | | null (native behaviour, no `preventDefault`) |

Performing: `escape` → `controller.escape()`; `toggle` → `controller.toggle()`; `submit` → `controller.save('user')`; `textRowSubmit`;
`commitSchedule('user')`; `applyTypedTime(true)`; `closeLocationPopover()`; `applySuggestion('user')`; `openSchedule('user')`;
`toggleCalendar('user')`; `applyPreset(p, 'user')`; `stepTime(n, 'user')`; `moveDay(d)`; `swallow` → nothing. Every non-null action →
`e.preventDefault(); e.stopPropagation()`. Keyboard notch button: while the phase is closed, a transparent `<button>` over the closed
silhouette (235 × 39 at the canvas top centre, `aria-label="New reminder"`, `pointer-events: none` so the path keeps the pointer) — Enter /
Space activate it natively → `controller.show('click', true)`.

- [ ] **Step 1: Write the failing pure test** `tests/ui/keyboard.test.ts`
  ```ts
  import { recreationKeyFor, platformCmdKey, type KeyContext } from '../../src/recreation/ui/keyboard';
  const base = { phase: { type: 'open' }, schedule: 'none', suggestion: null, badgeShown: false } as any;
  const ctx = (field: KeyContext['field'], state: any = {}): KeyContext => ({ state: { ...base, ...state }, field, cmdKey: 'meta' });
  const k = (key: string, mods: Partial<{ meta: boolean; shift: boolean; ctrl: boolean; alt: boolean; code: string; isComposing: boolean }> = {}) =>
    ({ key, code: mods.code ?? '', metaKey: !!mods.meta, shiftKey: !!mods.shift, ctrlKey: !!mods.ctrl, altKey: !!mods.alt, isComposing: !!mods.isComposing });
  test.each([
    [k('Escape'), ctx('title'), { type: 'escape' }],
    [k('Escape'), ctx('title', { phase: { type: 'saving' } }), { type: 'escape' }],
    [k('a'), ctx(null, { phase: { type: 'saving' } }), { type: 'swallow' }],
    [k('r', { meta: true, shift: true }), ctx('title'), { type: 'toggle' }],
    [k('Enter', { meta: true }), ctx('notes'), { type: 'submit' }],
    [k('Enter'), ctx('title'), { type: 'textRowSubmit' }],
    [k('Enter'), ctx('scheduleField', { schedule: 'controls' }), { type: 'commitSchedule' }],
    [k('Enter'), ctx('timeField', { schedule: 'controls' }), { type: 'applyTypedTime' }],
    [k('Enter'), ctx('locationField'), { type: 'closeLocation' }],
    [k('Enter'), ctx(null, { schedule: 'calendar' }), { type: 'commitSchedule' }],
    [k('Enter'), ctx(null), null],
    [k('Tab'), ctx('title', { suggestion: { matchedText: 'tomorrow' } }), { type: 'applySuggestion' }],
    [k('Tab'), ctx('title'), null],
    [k('Tab', { shift: true }), ctx('title', { suggestion: { matchedText: 'tomorrow' } }), null],
    [k('d', { meta: true }), ctx('notes'), { type: 'openSchedule' }],
    [k('d', { meta: true }), ctx('notes', { badgeShown: true }), null],
    [k('k', { meta: true }), ctx('scheduleField', { schedule: 'controls' }), { type: 'toggleCalendar' }],
    [k('k', { meta: true }), ctx('title'), null],
    [k('3', { meta: true, code: 'Digit3' }), ctx(null, { schedule: 'controls' }), { type: 'preset', preset: 'tomorrow' }],
    [k('6', { meta: true, code: 'Digit6' }), ctx(null, { schedule: 'calendar' }), { type: 'preset', preset: 'nextMonth' }],
    [k('1', { meta: true, code: 'Digit1' }), ctx('title'), null],
    [k('ArrowUp'), ctx('timeField', { schedule: 'controls' }), { type: 'stepTime', steps: 1 }],
    [k('ArrowDown'), ctx('timeField', { schedule: 'controls' }), { type: 'stepTime', steps: -1 }],
    [k('ArrowLeft'), ctx('calendar', { schedule: 'calendar' }), { type: 'moveDay', days: -1 }],
    [k('ArrowDown'), ctx('calendar', { schedule: 'calendar' }), { type: 'moveDay', days: 7 }],
    [k('ArrowUp'), ctx('title'), null],
    [k('Enter', { isComposing: true }), ctx('title'), null],
  ])('%j in %j → %j', (e, c, expected) => expect(recreationKeyFor(e as any, c)).toEqual(expected));
  test('Ctrl stands in for ⌘ off Apple platforms', () => {
    expect(platformCmdKey('MacIntel')).toBe('meta');
    expect(platformCmdKey('Win32')).toBe('ctrl');
    expect(recreationKeyFor(k('d', { ctrl: true }) as any, { ...ctx('title'), cmdKey: 'ctrl' })).toEqual({ type: 'openSchedule' });
    expect(recreationKeyFor(k('d', { ctrl: true }) as any, ctx('title'))).toBeNull();
  });
  ```
- [ ] **Step 2: Write the failing integration test** `tests/ui/keyboardIntegration.test.tsx`
  ```ts
  // @vitest-environment jsdom
  import './setup';
  import { screen, act, fireEvent } from '@testing-library/react';
  import { NotchContainer } from '../../src/recreation/ui/NotchContainer';
  import { useRecreationKeys } from '../../src/recreation/ui/keyboard';
  import { renderWithCore, useTestTime, openPanel, createTestCore } from './support';
  beforeEach(() => useTestTime());
  function Root({ enabled, onOuter }: { enabled: boolean; onOuter: () => void }) {
    const onKeyDown = useRecreationKeys(enabled);
    return <div onKeyDown={onOuter}><div onKeyDown={onKeyDown}><NotchContainer /></div></div>;
  }
  test('handled keys are prevented and never reach the desktop', async () => {
    const outer = vi.fn(); const core = createTestCore();
    renderWithCore(<Root enabled onOuter={outer} />, core);
    await openPanel(core);
    const title = screen.getByRole('textbox', { name: 'New Reminder' });
    fireEvent.change(title, { target: { value: 'Call mum tomorrow at 2pm' } });
    const tab = fireEvent.keyDown(title, { key: 'Tab' });
    expect(tab).toBe(false);                                   // defaultPrevented
    expect(core.store.getState().title).toBe('Call mum');
    expect(outer).not.toHaveBeenCalled();
    fireEvent.keyDown(title, { key: 'd', metaKey: true });
    expect(core.store.getState().schedule).toBe('controls');
    fireEvent.keyDown(title, { key: 'k', metaKey: true });
    expect(core.store.getState().schedule).toBe('calendar');
    fireEvent.keyDown(title, { key: '5', code: 'Digit5', metaKey: true });
    expect(core.store.getState()).toMatchObject({ schedule: 'none', presetPick: { preset: 'nextWeek' } });
    fireEvent.keyDown(title, { key: 'Enter', metaKey: true });
    await act(async () => { vi.advanceTimersByTime(320); });
    expect(core.store.getState().savedItems[0].title).toBe('Call mum');
  });
  test('arrows in the time field and the grid', async () => {
    const core = createTestCore();
    renderWithCore(<Root enabled onOuter={() => {}} />, core);
    await openPanel(core);
    act(() => core.controller.openSchedule('user'));
    const time = screen.getByRole('textbox', { name: 'Time' });
    time.focus();
    fireEvent.keyDown(time, { key: 'ArrowUp' });
    expect(core.store.scheduleDraft!.draft).toEqual(new Date('2026-09-19T07:15:00Z'));
    act(() => core.controller.openCalendar('user'));
    await act(async () => { vi.advanceTimersByTime(0); });
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(core.store.scheduleDraft!.draft).toEqual(new Date('2026-09-20T07:15:00Z'));
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(core.store.getState().schedule).toBe('controls');
  });
  test('disabled while focus is outside the desktop', async () => {
    const outer = vi.fn(); const core = createTestCore();
    renderWithCore(<Root enabled={false} onOuter={outer} />, core);
    await openPanel(core);
    const title = screen.getByRole('textbox', { name: 'New Reminder' });
    expect(fireEvent.keyDown(title, { key: 'Escape' })).toBe(true);
    expect(outer).toHaveBeenCalled();
    expect(core.store.getState().phase).toEqual({ type: 'open' });
  });
  test('the closed notch opens from the keyboard', () => {
    const core = createTestCore();
    renderWithCore(<Root enabled onOuter={() => {}} />, core);
    fireEvent.click(screen.getByRole('button', { name: 'New reminder' }));
    expect(core.store.getState().phase).toEqual({ type: 'open' });
  });
  ```
- [ ] **Step 3: Run both** — `npx vitest run tests/ui/keyboard.test.ts tests/ui/keyboardIntegration.test.tsx`. Expected: FAIL.
- [ ] **Step 4: Implement** `keyboard.ts` per the table and the notch button in `NotchContainer.tsx` (`useRecreationKeys` reads `useCore()`,
  takes `field` from `(e.target as HTMLElement).closest('[data-qr-field]')` — the element the key was typed into — and `platformCmdKey(navigator.platform)` once).
- [ ] **Step 5: Run** — `npx vitest run tests/ui`. Expected: PASS.
- [ ] **Step 6: Commit** — `git add src/recreation/ui/keyboard.ts src/recreation/ui/NotchContainer.tsx tests/ui/keyboard.test.ts tests/ui/keyboardIntegration.test.tsx && git commit -m "feat(recreation): scoped keyboard map with preventDefault and a keyboard-reachable notch"`

---

### Task B23: `Recreation` + `RecreationHandle` (`Recreation.tsx`, `index.ts`)

**Files:**
- Create: `src/recreation/Recreation.tsx`, `src/recreation/index.ts`
- Modify: `src/recreation/ui/buttons.tsx` (replace the local `PointerTarget` alias with `import type { PointerTarget } from '../Recreation'`)
- Test: `tests/recreation/Recreation.test.tsx`

**Interfaces:**
- Consumes: everything above; `AppClock.now`, `Clock` (`clock.ts`); `currentCalendar`; `motionTimeScale`, `useReducedMotion` (B1);
  `createRecreationCore` (B9); `NotchContainer` (B21); `useRecreationKeys` (B22); `RecreationProvider` (B9).
- Produces: exactly contract §3.2 `RecreationHandle`, `ShowSource`, `PointerTarget`, `ScenePoint`, §3.3 `RecreationProps`, plus:
  ```ts
  export interface CursorLike { moveTo(point: ScenePoint, opts?: { durationMs?: number }): Promise<void>; click(): Promise<void>; cancel(): void }
  // RecreationProps.cursor is RefObject<CursorLike | null> (structural subset of desktop's FakeCursorHandle)
  export const Recreation: ForwardRefExoticComponent<RecreationProps & RefAttributes<RecreationHandle>>;
  export const DEFAULT_TYPING_CPS: 18;                          // landing spec §7 (02)
  export const TARGET_ACTIONS: (h: RecreationHandle, target: PointerTarget) => (() => void) | null;
  // index.ts re-exports: Recreation, RecreationHandle, RecreationProps, RecreationState, SavedReminder, ShowSource, PointerTarget,
  // ScenePoint, CursorLike, DEFAULT_TYPING_CPS, ListId, FAKE_LISTS, DatePreset, DATE_PRESETS, ScheduleExpansion, NotchPhase, NotchMachineSnapshot,
  // Clock, AppClock, Calendar, currentCalendar, SuggestionDateFormatter, resolve helpers the page needs: NaturalDateParser, ScheduleDefaults, DatePresets
  ```

Rules:
- Root `<div data-qr-root>` absolutely placed with its canvas' top centre on `notchOrigin`: `left: px(notchOrigin.x − canvas.width / 2)`
  (756 − 324 = 432), `top: px(notchOrigin.y)`, `pointer-events: none`; `onKeyDown = useRecreationKeys(shortcutsEnabled)`; the focus
  registry's root. Defaults: `clock = AppClock.now`, `calendar = currentCalendar()`, `locale = 'en-US'`, `dockHeight = 0`,
  `reduceMotion = useReducedMotion(props.reduceMotion)`, time scale `motionTimeScale()` read once. Props read through refs so the core is created once.
- Every method calls the controller with origin `'api'`. `show({ source = 'api', focus })`: focus defaults to `source === 'click' || source === 'hotkey'`.
- Typing (`typeTitle`, `typeScheduleText`, `typeLocation`): characters by code point (`Array.from`), one every `1000 / cps × timeScale` ms, the first after one
  interval; `typeTitle` clears the title first unless `append`; `typeScheduleText` opens the section first when it is closed; `typeLocation` opens the popover,
  types through `setLocation`, then closes it. Each run owns an `AbortController`; `cancel()` aborts all runs (their Promises reject with
  `new DOMException('Aborted', 'AbortError')`) and calls `cursor.current?.cancel()`.
- `pointFor(target)`: `'notch'` → `{ x: notchOrigin.x, y: notchOrigin.y + 39 / 2 }`; else the element `[data-qr-target="<target>"]` inside the root (null when
  absent); scale = canvas client width / canvas width in points (fallback `sceneScale`); point = notchOrigin + (element centre − canvas top centre) / scale.
- `pointerTo(target, { duration, click })`: no point → false; `cursor.moveTo(point, { durationMs: duration })`; with `click`: `cursor.click()` then
  `TARGET_ACTIONS(handle, target)?.()`; true. `TARGET_ACTIONS`: notch → `show({ source: 'api' })`; close → `hide`; header → `openListPicker`/`closeListPicker` toggle;
  suggestionChip → `applySuggestion`; suggestionDismiss → `dismissSuggestion`; dateChip → `openSchedule`; calendarIcon → `openSchedule` or `cancelSchedule`;
  locationIcon → `openLocationPopover`; flagIcon → `toggleFlag`; save → `save`; `list:<id>` → `setList(id)`; locationDone → `closeLocationPopover`;
  `preset:<p>` → `applyPreset(p)`; dayButton → `toggleCalendar`; `timeChip:<h>` → `setTime(h)`; calendarPrev / Next → `pageMonth(−1 / 1)`;
  `day:<n>` → `pickDay(day n of store.calendarMonth)`; clear → `clearDueDate`; cancel → `cancelSchedule`; set → `commitSchedule`;
  title, notes, scheduleField, timeField, locationField → null (pointing at a field never focuses it).
- `subscribe(listener)` passes `getState()`; `onStateChange` and `onSaved` props are wired through the store / core options.
- `reset({ keepSaved = true })`: `cancel()`, `runtime.reset()`, `store.reset({ keepSaved })`.

- [ ] **Step 1: Write the failing test** `tests/recreation/Recreation.test.tsx`
  ```ts
  // @vitest-environment jsdom
  import '../ui/setup';
  import { render, act, screen } from '@testing-library/react';
  import { createRef } from 'react';
  import { Recreation, type RecreationHandle } from '../../src/recreation';
  import { useTestTime, testCalendar, ptOf } from '../ui/support';
  import { plainSpaces } from '../support';
  beforeEach(() => useTestTime());
  const adv = (ms: number) => act(async () => { vi.advanceTimersByTime(ms); });
  function mount(extra: Record<string, unknown> = {}) {
    const ref = createRef<RecreationHandle>();
    const utils = render(<Recreation ref={ref} notch={{ width: 221, height: 38 }} screenHeight={982} shortcutsEnabled sceneScale={1}
      notchOrigin={{ x: 756, y: 0 }} clock={() => new Date()} calendar={testCalendar} {...extra} />);
    return { ref, ...utils };
  }
  test('placed on the notch', () => {
    const { container } = mount();
    const root = container.querySelector('[data-qr-root]') as HTMLElement;
    expect([ptOf(root.style.left), ptOf(root.style.top)]).toEqual([432, 0]);
  });
  test('scroll-driven demo: no focus, no dirty, the reminder lands', async () => {
    const onSaved = vi.fn();
    const { ref } = mount({ onSaved });
    const h = ref.current!;
    const shown = h.show({ source: 'scroll' });
    await adv(500); await shown;
    expect(document.activeElement).toBe(document.body);
    const typed = h.typeTitle('Call mum tomorrow at 2pm');
    await adv(Math.ceil(24 * 1000 / 18) + 1); await typed;
    expect(h.getState().suggestion!.matchedText).toBe('tomorrow at 2pm');
    expect(h.applySuggestion()).toBe(true);
    h.setList('work'); h.setFlag(true);
    const loc = h.typeLocation('Office'); await adv(Math.ceil(6 * 1000 / 18) + 1); await loc;
    expect(h.getState()).toMatchObject({ title: 'Call mum', listId: 'work', accent: '#BF5AF2', flagged: true, location: 'Office', locationPopoverOpen: false, dirty: false });
    const saved = h.save();
    await adv(320);
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onSaved.mock.calls[0][0]).toMatchObject({ title: 'Call mum', listColor: '#BF5AF2', flagged: true, notes: '📍 Office' });
    expect(plainSpaces(onSaved.mock.calls[0][0].dueLabel)).toBe('Tomorrow, 2:00 PM');
    await adv(1040);
    await expect(saved).resolves.toMatchObject({ title: 'Call mum' });
    expect(h.machine().phase).toEqual({ type: 'closed', parked: true });
  });
  test('a click or the hotkey focuses the title', async () => {
    const { ref } = mount();
    ref.current!.show({ source: 'hotkey' });
    await adv(300);
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'New Reminder' }));
  });
  test('Set Date through the handle', async () => {
    const { ref } = mount();
    const h = ref.current!;
    h.show(); await adv(500);
    h.openSchedule();
    expect(h.scheduleDraft()!.draft).toEqual(new Date('2026-09-19T07:00:00Z'));
    h.openCalendar();
    expect(h.getState().schedule).toBe('calendar');
    h.pickDay(new Date('2026-09-24T22:00:00Z')); h.setTime(15);
    expect(h.commitSchedule()).toBe(true);
    expect(h.getState()).toMatchObject({ schedule: 'none', dueDate: new Date('2026-09-25T13:00:00Z') });
    expect(h.escape()).toBe('panel');
  });
  test('cancel aborts typing; reset closes and clears', async () => {
    const { ref } = mount();
    const h = ref.current!;
    h.show(); await adv(500);
    const typing = h.typeTitle('Buy milk');
    await adv(120);
    h.cancel();
    await expect(typing).rejects.toMatchObject({ name: 'AbortError' });
    expect(h.getState().title).toBe('Bu');
    h.reset();
    expect(h.getState()).toMatchObject({ title: '', phase: { type: 'closed', parked: true }, listId: 'reminders' });
  });
  test('pointer targets in scene points and the cursor click path', async () => {
    const cursor = { moveTo: vi.fn(async () => {}), click: vi.fn(async () => {}), cancel: vi.fn() };
    const { ref, container } = mount({ cursor: { current: cursor } });
    const h = ref.current!;
    expect(h.pointFor('notch')).toEqual({ x: 756, y: 19.5 });
    h.show(); await adv(500);
    const canvas = container.querySelector('[data-qr-canvas]') as HTMLElement;
    canvas.getBoundingClientRect = () => ({ left: 100, top: 0, width: 648, height: 775, right: 748, bottom: 775, x: 100, y: 0, toJSON() {} });
    const flag = container.querySelector('[data-qr-target="flagIcon"]') as HTMLElement;
    flag.getBoundingClientRect = () => ({ left: 100 + 184, top: 178, width: 38, height: 38, right: 0, bottom: 0, x: 0, y: 0, toJSON() {} });
    expect(h.pointFor('flagIcon')).toEqual({ x: 432 + 203, y: 197 });
    await act(async () => { await h.pointerTo('flagIcon', { click: true }); });
    expect(cursor.moveTo).toHaveBeenCalledWith({ x: 635, y: 197 }, { durationMs: undefined });
    expect(cursor.click).toHaveBeenCalled();
    expect(h.getState()).toMatchObject({ flagged: true, dirty: false });
    expect(h.pointFor('set')).toBeNull();
  });
  ```
- [ ] **Step 2: Run it** — `npx vitest run tests/recreation/Recreation.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** `Recreation.tsx` and `index.ts` with the rules above; swap the `PointerTarget` alias in `buttons.tsx`.
- [ ] **Step 4: Run** — `npx vitest run tests/recreation tests/ui && npx tsc --noEmit`. Expected: PASS, no type errors.
- [ ] **Step 5: Commit** — `git add src/recreation/Recreation.tsx src/recreation/index.ts src/recreation/ui/buttons.tsx tests/recreation/Recreation.test.tsx && git commit -m "feat(recreation): Recreation component and the imperative RecreationHandle"`

---

### Task B24: Hover swell end to end (90 ms dwell, `spring(0.32, 0.55)`, SPEC §1)

**Files:**
- Test: `tests/recreation/hover.test.tsx`
- Modify (only if a step fails): `src/recreation/controller.ts` (pointer-on-notch bookkeeping), `src/recreation/ui/NotchContainer.tsx`

**Interfaces:**
- Consumes: `Recreation` (B23), `translatedNotchPath` (B5).
- Produces: nothing new (verifies B5 + B8 + B9 + B21 together).

Swift rules: hover arms only while parked (`hoverEntered` guard); the swell needs the pointer to rest 0.09 s; a pointer merely crossing does
nothing; leaving unswells with `spring(0.30, 0.85)`; parking with the pointer still on the notch disarms until it leaves
(`park(pointerOnNotch:)`); Reduce Motion: no swell (haptic only, a no-op on the web). The controller's `pointerOnNotch` is true between the
silhouette's `pointerenter` and `pointerleave`.

- [ ] **Step 1: Write the test**
  ```ts
  // @vitest-environment jsdom
  import '../ui/setup';
  import { render, act, fireEvent, waitFor } from '@testing-library/react';
  import { createRef } from 'react';
  import { Recreation, type RecreationHandle } from '../../src/recreation';
  import { translatedNotchPath } from '../../src/recreation/ui/NotchSilhouette';
  import { useTestTime, testCalendar } from '../ui/support';
  beforeEach(() => useTestTime());
  const CLOSED = translatedNotchPath({ width: 235, height: 39, top: 6, bottom: 14 }, 648);
  const SWOLLEN = translatedNotchPath({ width: 257, height: 44, top: 6, bottom: 14 }, 648);
  function mount(reduceMotion = false) {
    const ref = createRef<RecreationHandle>();
    const u = render(<Recreation ref={ref} notch={{ width: 221, height: 38 }} screenHeight={982} shortcutsEnabled sceneScale={1}
      notchOrigin={{ x: 756, y: 0 }} clock={() => new Date()} calendar={testCalendar} reduceMotion={reduceMotion} />);
    return { ref, path: u.container.querySelector('path[data-qr-target="notch"]')! };
  }
  test('swells after a 90 ms rest, settles back on leave', async () => {
    const { ref, path } = mount();
    fireEvent.pointerEnter(path);
    await act(async () => { vi.advanceTimersByTime(89); });
    expect(path.getAttribute('d')).toBe(CLOSED);
    await act(async () => { vi.advanceTimersByTime(1); });
    await waitFor(() => expect(path.getAttribute('d')).toBe(SWOLLEN));
    expect(ref.current!.getState().hoverSwollen).toBe(true);
    fireEvent.pointerLeave(path);
    await waitFor(() => expect(path.getAttribute('d')).toBe(CLOSED));
  });
  test('a pointer crossing the notch does nothing', async () => {
    const { path } = mount();
    fireEvent.pointerEnter(path);
    await act(async () => { vi.advanceTimersByTime(50); });
    fireEvent.pointerLeave(path);
    await act(async () => { vi.advanceTimersByTime(100); });
    expect(path.getAttribute('d')).toBe(CLOSED);
  });
  test('closing under a resting pointer waits for it to leave first', async () => {
    const { ref, path } = mount();
    fireEvent.pointerEnter(path);
    fireEvent.pointerDown(path);                                 // click opens
    await act(async () => { vi.advanceTimersByTime(600); });
    ref.current!.hide();
    await act(async () => { vi.advanceTimersByTime(360); });     // parks with the pointer still on the notch
    fireEvent.pointerEnter(path);
    await act(async () => { vi.advanceTimersByTime(200); });
    expect(ref.current!.getState().hoverSwollen).toBe(false);
    fireEvent.pointerLeave(path); fireEvent.pointerEnter(path);
    await act(async () => { vi.advanceTimersByTime(90); });
    expect(ref.current!.getState().hoverSwollen).toBe(true);
  });
  test('reduce motion: no swell', async () => {
    const { ref, path } = mount(true);
    fireEvent.pointerEnter(path);
    await act(async () => { vi.advanceTimersByTime(200); });
    expect(ref.current!.getState().hoverSwollen).toBe(false);
    expect(path.getAttribute('d')).toBe(CLOSED);
  });
  ```
- [ ] **Step 2: Run it** — `npx vitest run tests/recreation/hover.test.tsx`. Expected: PASS when B5–B23 are right; on FAIL fix the bookkeeping named above and re-run.
- [ ] **Step 3: Commit** — `git add tests/recreation/hover.test.tsx src/recreation/controller.ts src/recreation/ui/NotchContainer.tsx && git commit -m "test(recreation): hover swell dwell, crossing, disarm and reduced motion"`

---

### Task B25: Reduced motion audit (`prefers-reduced-motion`, SPEC §1 "Reduce Motion enabled")

**Files:**
- Test: `tests/recreation/reducedMotion.test.tsx`
- Modify (only if a step fails): the component the failing assertion names

**Interfaces:**
- Consumes: `Recreation` (B23); `setPrefersReducedMotion` (B1 setup).
- Produces: nothing new.

What Reduce Motion means in the app: plain crossfades (`easeOut 0.15`) instead of the open / close / section springs; no blur or scale on the
content; no hover swell; no 1.06 / 0.94 scaling on round controls and no 0.97 press on fills; Set Date rows fade without drop or blur; the
saved choreography is a plain collapse (no badge); the media query is honoured without the prop.

- [ ] **Step 1: Write the test**
  ```ts
  // @vitest-environment jsdom
  import '../ui/setup';
  import { render, act, fireEvent, screen } from '@testing-library/react';
  import { createRef } from 'react';
  import { Recreation, type RecreationHandle } from '../../src/recreation';
  import { useTestTime, testCalendar } from '../ui/support';
  import { setPrefersReducedMotion } from '../ui/setup';
  beforeEach(() => useTestTime());
  afterEach(() => setPrefersReducedMotion(false));
  function mount(props: Record<string, unknown> = {}) {
    const ref = createRef<RecreationHandle>();
    const u = render(<Recreation ref={ref} notch={{ width: 221, height: 38 }} screenHeight={982} shortcutsEnabled sceneScale={1}
      notchOrigin={{ x: 756, y: 0 }} clock={() => new Date()} calendar={testCalendar} {...props} />);
    return { ref, ...u };
  }
  test('the media query alone switches the recreation to reduced motion', async () => {
    setPrefersReducedMotion(true);
    const { ref, container } = mount();
    const h = ref.current!;
    h.show(); await act(async () => { vi.advanceTimersByTime(500); });
    const content = container.querySelector('[data-qr-content]') as HTMLElement;
    expect(content.style.filter).toBe('blur(calc(0 * var(--pt) * 1px))');
    h.setTitle('Buy milk');
    const saving = h.save();
    expect(h.machine().phase).toEqual({ type: 'closing' });           // plain collapse
    expect(container.querySelector('[data-qr-badge-slot]')).toBeNull();
    expect(h.getState().savedItems).toHaveLength(1);                  // lands at once without a badge
    await act(async () => { vi.advanceTimersByTime(360); });
    await expect(saving).resolves.toMatchObject({ title: 'Buy milk' });
  });
  test('no hover scale on round controls, no press scale on fills, no row drop', async () => {
    const { ref, container } = mount({ reduceMotion: true });
    const h = ref.current!;
    h.show(); await act(async () => { vi.advanceTimersByTime(500); });
    const close = screen.getByRole('button', { name: 'Close' });
    fireEvent.pointerEnter(close);
    expect(['', 'none'].includes((close.firstElementChild as HTMLElement).style.transform)).toBe(true);
    h.openSchedule();
    const rows = [...container.querySelectorAll('[data-qr-row]')] as HTMLElement[];
    expect(rows.every(r => !r.style.transform.includes('-6'))).toBe(true);
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.pointerDown(cancel);
    expect(['', 'none'].includes(cancel.style.transform)).toBe(true);
  });
  ```
- [ ] **Step 2: Run it** — `npx vitest run tests/recreation/reducedMotion.test.tsx`. Expected: PASS; on FAIL fix the component named in the failing assertion.
- [ ] **Step 3: Commit** — `git add tests/recreation/reducedMotion.test.tsx && git commit -m "test(recreation): reduced motion audit across panel, controls and save"`

---

### Task B26: Visual review against the Swift metrics (harness + Playwright metrics + 2× shots)

**Files:**
- Create: `recreation-harness.html` (repo root, dev only: not in `build.rollupOptions.input`), `src/recreation/dev/harness.tsx`
- Test: `e2e/recreation-metrics.spec.ts`

**Interfaces:**
- Consumes: `Recreation`, `RecreationHandle` (B23); Playwright config from part 01 (dev server `baseURL`).
- Produces: `recreation-harness.html?state=<plain|typed|suggestion|applied|flag|section|calendar|saving|hover|lists|location>&list=<ListId>&now=<ISO>`
  renders one `Recreation` at `--pt: 1` on a 1512 × 982 mid-grey (`#808080`) scene, drives it to the state through the handle (`source: 'scroll'`),
  and sets `document.body.dataset.ready = 'true'` when the settle timer has fired (`saving`: 0.8 s into the hold; `hover`: 0.6 s after `hoverNotch(true)`).

- [ ] **Step 1: Write the metrics spec** `e2e/recreation-metrics.spec.ts` — Chromium and WebKit projects, viewport 1512 × 982,
  `deviceScaleFactor: 2`. A helper `box(sel)` returns the element's rect in canvas points (`(rect − canvasRect) / (canvasRect.width / 648)`).
  Assertions (± 0.5 pt), canvas coordinates (panel left = 24):

  | State | Selector | x, y, w, h (pt) | Source |
  |---|---|---|---|
  | plain | `path[data-qr-target=notch]` bbox | 24, 0, 600, 241 | `openSize` |
  | plain | `[data-qr-target=close]` / its circle | 549, 47, 36, 36 / 555, 53, 24, 24 | HeaderView, rhythm 39 + 8 |
  | plain | `[data-qr-dashed-circle]` | 63, 95, 21, 21 | InputView padding-top 2 |
  | plain | title / notes input | 94, 93, 491, 25 / 94, 119, 491, 20 | 63 + 21 + 10; row heights 25, 20 |
  | plain | `[data-qr-chip-slot]` | y 139, h 26 | 241 − 20 − 48 − 8 − 26 |
  | plain | `[data-qr-pill]` | 63, 175, 170, 44 | 11 + 3·38 + 2·17 + 11 = 170 |
  | plain | calendar / location / flag icon centres | (93, 197) (148, 197) (203, 197) | 55 pt centre spacing |
  | plain | `[data-qr-target=save]` | 537, 173, 48, 48 | 24 + 600 − 39 − 48; ✓ 20 pt from the right and bottom edges |
  | section | path bbox / type field / preview | h 519 / 63, 241, 522, 36 / y 283, h 18 | D1 rows |
  | section | first / second preset row | y 311 / y 363, h 44, card w 168.667 | (522 − 16) / 3 |
  | section | `[data-qr-day-time]` / `[data-qr-footer]` | y 419, h 30 / y 463, h 36 | D1 rows |
  | calendar | path bbox / `[data-qr-calendar]` / footer | h 751 / y 459, h 222 / y 695 | D1 rows |
  | saving | path bbox / `[data-qr-badge-slot]` | 134.5, 0, 379, 39 / 459.5, 7.5, 24, 24 | `savedSize`, `badgeOrigin` |
  | hover | path bbox | 195.5, 0, 257, 44 | `hoverSize` |
  | lists / location | `[data-qr-popover=lists]` / `[data-qr-popover=location]` | left 63, top 91 / centre x 148, top 224 | §11.4 anchors |
  | section | day / time row fits | right edge of the last time chip ≤ 585 in en-US | content width 522 |

  Each state also saves `test-results/recreation/<state>.png` (`page.locator('[data-qr-canvas]').screenshot()`).
- [ ] **Step 2: Run it** — `npx playwright test e2e/recreation-metrics.spec.ts`. Expected: FAIL (harness missing).
- [ ] **Step 3: Implement** `recreation-harness.html` and `src/recreation/dev/harness.tsx` per the Produces line.
- [ ] **Step 4: Run it** — Expected: PASS in Chromium and WebKit. A failing box is fixed in the component that owns it (task named in the
  Source column), never by loosening the tolerance.
- [ ] **Step 5: Compare by eye with the app's 2× captures** (`~/Developer/Xcode Apps/QuickReminder/build/shots/`, 2026-09-22, no in-notch Set Date
  shots): `n_en_suggest.png` ↔ `suggestion.png`, `n_en_applied.png` ↔ `applied.png`, `flag_on.png` ↔ `flag.png`, `icons_zoom.png` ↔ `plain.png` (pill glyph
  balance), `accent.png` ↔ `?state=plain&list=work`, `hov_zoom.png` ↔ `hover.png`, `sv_1.png`…`sv_12.png` ↔ a `?debug=motion` screen recording of
  `saving`, `final_closed.png` ↔ the closed notch. In WebKit (SF via `-apple-system`) measure the rendered width of "Reminders" (22 bold) and of the
  suggestion chip against the shots; a difference above 1 pt is recorded in the commit body with both numbers (Chromium differences from SF tracking
  are expected and noted, not patched with letter-spacing).
- [ ] **Step 6: Commit** — `git add recreation-harness.html src/recreation/dev/harness.tsx e2e/recreation-metrics.spec.ts && git commit -m "test(recreation): Playwright metric review of the recreation against the Swift layout"`

---

## Coverage check (landing spec → task)

| Requirement | Task |
|---|---|
| §5.1 closed 235 × 39 (+bleed), radii 6 / 14 → 19 / 32, open 600 × 241, band 39 dead zone | B2, B5, B20, B21 |
| §5.1 hover swell +22 × 5, spring 0.32 / 0.55, 90 ms dwell | B5, B8, B24 |
| §5.1 open spring 0.42 / 0.78, content easeOut 0.20 delay 0.16, blur 8 → 0, scale 0.94 → 1 from top, masked to the live silhouette | B5, B21 |
| §5.1 close spring 0.30 / 0.92, content easeOut 0.12 | B5, B8, B21 |
| §5.1 saved: +2 × 72 at notch height, spring 0.45 / 0.82, 24 pt badge flies (shared layout), trim 0.28 after 0.32, bounce 1.18 at 0.55, hold 1.0 | B8, B13, B15, B21 |
| §5.1 in-notch Set Date heights, spring 0.38 / 0.8, 35 ms stagger, 6 pt drop, 3 pt un-blur, clamp to the fake screen | B2 (D1), B19, B20 |
| §5.1 spring conversion documented | consumed from `machine/springs.ts`; B1 pins it |
| §5.1 reduced motion | B1, B25 |
| §5.2 every visual value (padding, header, ⓧ, dotted circle, title, notes, pill, ✓, chip slot, rhythm, pointer feedback, text scale 1) | B3, B4, B10–B13, B20 |
| §5.3 open by click / ⇧⌘R / scroll; focus only for click / hotkey; layered Esc; click outside; ⓧ; ✓ turns accent | B9, B21, B22, B23 |
| §5.3 suggestion chip, Tab / click apply, ⓧ dismiss, auto-apply on save | B6, B12, B22 |
| §5.3 list picker with five lists, accent everywhere | B6, B11, B13 |
| §5.3 Set Date: type field, preview, In the past, presets ⌘1…⌘6, day + time (↑ / ↓, chips), ⌘K grid, footer, ↩ = Set, Esc one level | B7, B16–B19, B22 |
| §5.3 location popover, `📍` in notes, filled pin; flag | B13, B14 (D3) |
| §5.3 save choreography, reminder handed to the page | B9, B23 |
| §4 imperative API (`show`, `hide`, `setTitle`, `typeTitle`, `openSchedule`, `openCalendar`, `save`, `setList`, `toggleFlag`, `setPointer`, `state`) | B23 |
| §3 Phosphor at the same optical sizes; system font stack; tabular figures | B1, B3 |
| §9 keyboard reachable, visible focus, ARIA names, live announcements | B1, B4, B19, B22 |
| §9 `?debug=motion` slows 4× | B1, B8 |
| §9 visual check against Swift / 2× shots | B26 |
| §11.3 shortcuts only with focus inside the desktop, always `preventDefault` | B22 |
| §11.4 original black popovers (12 pt corners, 6 / 11 / 15 % fills, accent selection, 1 pt #3D3D3F, below the trigger) | B11, B14 |
