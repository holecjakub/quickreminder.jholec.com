# 03 · Area C — desktop scene, page, scroll choreography, sections, deploy

Date: 2026-10-28 · Consumes: `00-contracts.md` (binding), the recreation from area B (`RecreationHandle`,
`RecreationState`, `Recreation`), the core ports from area A.
Spec: `docs/superpowers/specs/2026-10-27-quickreminder-landing-design.md` (cited below as "landing §n").
App repo (cited as "app"): `/Users/jakub/Developer/Xcode Apps/QuickReminder`.

All paths are relative to the site repo root `/Users/jakub/Developer/quickreminder.jholec.com`; run every
command from there. Every task runs on branch `develop` (created by the first task of the plan, part 01).

## Preconditions (from parts 01 and 02)

- Vite + React 18 + TS + Tailwind + Vitest + Playwright scaffold exists; `npm test` runs Vitest over
  `tests/**/*.test.{ts,tsx}`; `src/tokens.css` holds the `--jh-*` and `--qr-*` variables of contracts §6;
  `src/index.css`, `src/main.tsx`, `src/App.tsx`, `index.html` exist (Vite template level or better).
- `tests/support.ts` exports `pragueCalendar`, `prague(y, m, d, h, min)`, `plainSpaces(s)` (contracts §1).
- `src/recreation/index.ts` exports the public surface of contracts §3 (C2 step 1 adds any missing re-export).
- Component tests run in jsdom by a per-file docblock `// @vitest-environment jsdom`, so they do not
  depend on the global Vitest environment.

## Cross-area notes recorded by this part (the architect resolves them in 00)

1. **Menu-bar glyph.** `MenuBarIcon.imageset` contains only `Contents.json` (no image). The real app's
   status item is the SF Symbol `checklist` (app `Sources/QuickReminder/AppDelegate.swift` line 47,
   template image). The site cannot ship SF Symbols (landing §3), so the menu bar uses Phosphor
   `ListChecks` (closest glyph to `checklist`) at 16 pt. Contracts §8.3 suggested a template-tinted app
   icon; a template tint of the full-bleed `AppIcon.icns` squircle is a solid rounded square, so it is
   not used for the menu bar. The `.icns` is used for the Download section and the favicon (C18).
2. **List cycle.** Landing §7 (04) cycles Reminders → Work → Home, landing §11.2 makes Work the demo list,
   contracts §4.4 says the cycle "ends on the last". `SECTION_SNAPSHOTS['04'].listCycle` is therefore
   `['reminders', 'work', 'home', 'work']`: it shows the three lists in the spec's order and ends on Work.
3. **Reminders window position.** Landing §5.3 says bottom-right; in the features crop (landing §11.1) the
   visible scene spans x ≈ 338…1174 pt at 1440 px, so a window at the far bottom-right would never be
   seen in section (06). The window sits in the lower right of the panel: x 790, y 330 (scene points).
4. **`DesktopSceneProps.timeScale?: number`** (default 1) is added: `desktop/` may not import
   `app/motionDebug.ts` (import rule, contracts §1), so the Stage passes the `?debug=motion` scale in.
5. **`stageCamera.ts` adds exports** beyond contracts §4.6 (`pinnedColumnWidth`, `featuresScale`,
   `renderPtFor`, `clipFor`, `titleOpacityFor`, `phoneStageHeight`, `cameraTransform`, constants);
   `featuresPt` keeps the contract signature and the height clamp lives in `featuresScale`.
6. **Area B requirements this part relies on** (each listed again in the consuming task):
   `pointFor()` measures in layout coordinates (`offsetLeft/Top` chains, not `getBoundingClientRect`),
   because the Stage applies a CSS transform above `--pt`; `focusTitle()` uses
   `focus({ preventScroll: true })`; field components `preventDefault()` every key they handle; the
   title field is an `<input>` whose accessible name is "New Reminder"; Swift accessibility labels are
   kept ("Save reminder", "Use suggested date", "Change date", "Saved", "Close", "Type a date").
7. Contracts §1 says the `icons.tsx` table is "in part 03"; that file belongs to area B
   (`recreation/ui/icons.tsx`) and is not in this part.
8. App 0.5.3 code appends Set Date below the bottom bar (`scheduleContentHeight = contentHeight + section
   + 20`, SPEC §3: calendar 751 pt), while contracts §5.1 pins 663 pt. This part reads
   `NotchLayout.scheduleCalendarSize.height` symbolically, so the camera works with either value; area B
   decides the number.

---

### Task C1: Page dependencies, GSAP module, motion debug flag, test fakes

**Files:**
- Modify: `package.json` (dependencies), `.gitignore`
- Create: `src/app/gsap.ts`, `src/app/motionDebug.ts`
- Create: `tests/fakes/matchMedia.ts`, `tests/fakes/gsapMock.ts`
- Test: `tests/app/motionDebug.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```ts
  // src/app/gsap.ts
  export { gsap } from 'gsap';                // with ScrollTrigger registered once
  export { ScrollTrigger } from 'gsap/ScrollTrigger';
  // src/app/motionDebug.ts
  export function motionTimeScale(search: string): 1 | 4;   // "?debug=motion" (comma list allowed) → 4
  export const MOTION_TIME_SCALE: 1 | 4;                    // motionTimeScale(window.location.search), read once
  export function scaleMs(ms: number, timeScale?: number): number;   // ms × timeScale (default MOTION_TIME_SCALE)
  export function applyGsapTimeScale(target?: { globalTimeline: { timeScale(v: number): unknown } }): void; // timeScale(1 / MOTION_TIME_SCALE)
  // tests/fakes/matchMedia.ts
  export function installMatchMedia(matches: Record<string, boolean>): { set(query: string, value: boolean): void };
  // tests/fakes/gsapMock.ts  (module shape of src/app/gsap.ts for vi.mock)
  export const gsap: { registerPlugin: Mock; globalTimeline: { timeScale: Mock } };
  export const ScrollTrigger: { create: Mock<(vars: ScrollTriggerVars) => { kill: Mock; progress: number }>; refresh: Mock; getAll: Mock };
  ```

- [ ] **Step 1: Confirm the branch.** `git branch --show-current` prints `develop`.
- [ ] **Step 2: Install page dependencies.**
  `npm i gsap@^3.13.0 @phosphor-icons/react@^2.1.7 @fontsource/fragment-mono@^5.1.0` and
  `npm i -D @testing-library/react@^16.1.0 @testing-library/dom@^10.4.0 jsdom@^26.0.0 @axe-core/playwright@^4.10.1 lighthouse@^12.3.0`.
  Expected: `npm ls gsap @phosphor-icons/react jsdom` lists all three without `missing`.
- [ ] **Step 3: Append `.lighthouse/` and `test-results/` and `playwright-report/` to `.gitignore`** (skip lines already present).
- [ ] **Step 4: Write the failing test** `tests/app/motionDebug.test.ts`:
  ```ts
  import { describe, it, expect, vi } from 'vitest';
  import { motionTimeScale, scaleMs, applyGsapTimeScale } from '../../src/app/motionDebug';

  describe('motionTimeScale', () => {
    it('is 4 for ?debug=motion', () => expect(motionTimeScale('?debug=motion')).toBe(4));
    it('is 4 when motion is one of several debug flags', () => expect(motionTimeScale('?now=2026-10-23T10:00&debug=layout,motion')).toBe(4));
    it('is 1 without the flag', () => expect(motionTimeScale('')).toBe(1));
    it('is 1 for another debug value', () => expect(motionTimeScale('?debug=layout')).toBe(1));
  });
  describe('scaleMs', () => {
    it('multiplies by the given scale', () => expect(scaleMs(900, 4)).toBe(3600));
    it('is identity at scale 1', () => expect(scaleMs(2500, 1)).toBe(2500));
  });
  describe('applyGsapTimeScale', () => {
    it('sets the global timeline to 1 / scale', () => {
      const timeScale = vi.fn();
      applyGsapTimeScale({ globalTimeline: { timeScale } });
      expect(timeScale).toHaveBeenCalledWith(1); // jsdom URL has no ?debug=motion
    });
  });
  ```
- [ ] **Step 5: Run** `npx vitest run tests/app/motionDebug.test.ts` — expected FAIL (module not found).
- [ ] **Step 6: Implement** `src/app/motionDebug.ts` with the signatures above (`URLSearchParams(search).get('debug')`
  split on `,`) and `src/app/gsap.ts` (`import { gsap } from 'gsap'; import { ScrollTrigger } from 'gsap/ScrollTrigger';
  gsap.registerPlugin(ScrollTrigger); export { gsap, ScrollTrigger };`).
- [ ] **Step 7: Write the fakes.** `tests/fakes/matchMedia.ts`: replaces `window.matchMedia` with a function
  returning `{ matches, media, addEventListener, removeEventListener, addListener, removeListener, onchange: null, dispatchEvent }`
  whose `matches` reads the map (unknown queries → `false`) and whose `set()` flips a value and calls the
  registered `change` listeners. `tests/fakes/gsapMock.ts`: the module shape above built from `vi.fn()`;
  `ScrollTrigger.create` returns `{ kill: vi.fn(), progress: 0 }` and keeps its `vars` in `mock.calls`.
- [ ] **Step 8: Run** `npx vitest run tests/app/motionDebug.test.ts` — expected PASS (7 tests).
- [ ] **Step 9: Commit.**
  `git add package.json package-lock.json .gitignore src/app/gsap.ts src/app/motionDebug.ts tests/fakes tests/app/motionDebug.test.ts && git commit -m "chore(page): add gsap, phosphor, test fakes and the motion debug flag"`

---

### Task C2: Scene constants and the desktop keyboard router

**Files:**
- Modify: `src/recreation/index.ts` (only missing re-exports, step 1)
- Create: `src/desktop/scene.ts`, `src/desktop/desktopShortcuts.ts`
- Test: `tests/desktop/desktopShortcuts.test.ts`

**Interfaces:**
- Consumes (from `src/recreation/index.ts`, contracts §2–§3): runtime `DATE_PRESETS`, `Recreation`;
  types `RecreationHandle`, `RecreationState`, `RecreationProps`, `SavedReminder`, `ScenePoint`, `Size`,
  `Clock`, `Calendar`, `DatePreset`, `ListId`, `NotchPhase`, `ScheduleDraft`.
  Area B requirement: field components call `preventDefault()` on every key they handle (landing §11.3);
  the router skips events that are already `defaultPrevented`.
- Produces:
  ```ts
  // src/desktop/scene.ts
  export const SCENE: { readonly width: 1512; readonly height: 982; readonly menuBarHeight: 38;
    readonly notch: Size /* { width: 221, height: 38 } */; readonly notchOrigin: ScenePoint /* { x: 756, y: 0 } */ };
  export const NOTCH_LEFT: 645.5;    // 756 − 221 / 2
  export const NOTCH_RIGHT: 866.5;   // 756 + 221 / 2
  export const HINT_TOP: 58;         // closed silhouette 39 + hover growth 5 (contracts §5.1) + 14 air
  export const REMINDERS_WINDOW: { readonly x: 790; readonly y: 330; readonly width: 320; readonly maxHeight: 340 };
  /** CSS length for a scene length in points: `calc(${v} * var(--pt) * 1px)` (contracts §6.2 rule). */
  export function ptCss(v: number): string;
  // src/desktop/desktopShortcuts.ts  (contracts §4.3, exact)
  export type FocusTarget = 'none' | 'title' | 'notes' | 'scheduleField' | 'timeField' | 'calendar' | 'locationField';
  export type ShortcutAction = /* contracts §4.3 union, verbatim */;
  export function shortcutFor(e: Pick<KeyboardEvent, 'key' | 'code' | 'metaKey' | 'shiftKey' | 'altKey' | 'ctrlKey'>,
    ctx: { state: RecreationState; focus: FocusTarget }): ShortcutAction | null;
  /** Closest `[data-qr-focus]` value, else by name: placeholder/aria-label "New Reminder" → title, "Notes" → notes,
   *  "Type a date" → scheduleField, "Time" → timeField, "Location" → locationField; `role="grid"` → calendar; else 'none'. */
  export function focusTargetOf(el: Element | null): FocusTarget;
  /** Executes an action on the handle; swallows AbortError rejections. `show` toggles like PanelController.toggle()
   *  (app Panel/PanelController.swift line 62): open → hide(), else show({ source: 'hotkey' }). */
  export function performShortcut(action: ShortcutAction, handle: RecreationHandle, ctx?: { typed?: string }): void;
  ```

- [ ] **Step 1: Ensure re-exports.** Open `src/recreation/index.ts`; for each name in Consumes that it does
  not export yet, add it (`export { DATE_PRESETS } from './core/datePresets';`, `export type { Clock } from './clock';`,
  `export type { Calendar } from './core/calendar';`, `export type { ScheduleDraft } from './core/scheduleDraft';`, …).
  Expected: `npx tsc --noEmit -p .` reports no error in `src/recreation/index.ts`.
- [ ] **Step 2: Write the failing test** `tests/desktop/desktopShortcuts.test.ts`. Helpers: `key(k, mods?)` builds
  the event pick (`code` defaults to `Key${k.toUpperCase()}` for letters, `Digit${n}` for digits, else `k`);
  `st(patch)` builds a `RecreationState` from the closed initial state of contracts §3.1 (`phase { type: 'closed', parked: false }`,
  `schedule 'none'`, empty draft, `listId 'reminders'`, `suggestion null`, …) merged with `patch`; `OPEN = { phase: { type: 'open' } }`.
  ```ts
  import { DATE_PRESETS } from '../../src/recreation/core/datePresets';
  describe('shortcutFor', () => {
    it('Esc while open → escape', () => expect(shortcutFor(key('Escape'), { state: st(OPEN), focus: 'title' })).toEqual({ type: 'escape' }));
    it('Esc while closed → null', () => expect(shortcutFor(key('Escape'), { state: st({}), focus: 'none' })).toBeNull());
    it('⇧⌘R → show hotkey, closed or open', () => {
      for (const s of [st({}), st(OPEN)]) expect(shortcutFor(key('R', { metaKey: true, shiftKey: true }), { state: s, focus: 'none' })).toEqual({ type: 'show', source: 'hotkey' });
    });
    it('⌘↩ while open → submit from any focus', () => {
      for (const f of ['none', 'title', 'notes', 'scheduleField', 'timeField', 'calendar'] as const)
        expect(shortcutFor(key('Enter', { metaKey: true }), { state: st(OPEN), focus: f })).toEqual({ type: 'submit' });
    });
    it('Ctrl+↩ counts as ⌘↩', () => expect(shortcutFor(key('Enter', { ctrlKey: true }), { state: st(OPEN), focus: 'none' })).toEqual({ type: 'submit' }));
    it('↩ in title, notes, scheduleField → submit', () => {
      for (const f of ['title', 'notes', 'scheduleField'] as const) expect(shortcutFor(key('Enter'), { state: st(OPEN), focus: f })).toEqual({ type: 'submit' });
    });
    it('↩ in the time field → applyTypedTime', () => expect(shortcutFor(key('Enter'), { state: st({ ...OPEN, schedule: 'controls' }), focus: 'timeField' })).toEqual({ type: 'applyTypedTime' }));
    it('↩ in the location field → null (Done belongs to the field)', () => expect(shortcutFor(key('Enter'), { state: st({ ...OPEN, locationPopoverOpen: true }), focus: 'locationField' })).toBeNull());
    it('↩ without a focused field → null', () => expect(shortcutFor(key('Enter'), { state: st(OPEN), focus: 'none' })).toBeNull());
    it('Tab in the title with a live suggestion → tab', () => expect(shortcutFor(key('Tab'), { state: st({ ...OPEN, suggestion: SUGGESTION }), focus: 'title' })).toEqual({ type: 'tab' }));
    it('Tab without a suggestion → null', () => expect(shortcutFor(key('Tab'), { state: st(OPEN), focus: 'title' })).toBeNull());
    it('⇧Tab → null', () => expect(shortcutFor(key('Tab', { shiftKey: true }), { state: st({ ...OPEN, suggestion: SUGGESTION }), focus: 'title' })).toBeNull());
    it('⌘D opens Set Date only while open with the section closed', () => {
      expect(shortcutFor(key('d', { metaKey: true }), { state: st(OPEN), focus: 'title' })).toEqual({ type: 'openSchedule' });
      expect(shortcutFor(key('d', { metaKey: true }), { state: st({ ...OPEN, schedule: 'controls' }), focus: 'title' })).toBeNull();
      expect(shortcutFor(key('d', { metaKey: true }), { state: st({}), focus: 'none' })).toBeNull();
    });
    it('⌘K toggles the calendar only with the section open', () => {
      expect(shortcutFor(key('k', { metaKey: true }), { state: st({ ...OPEN, schedule: 'controls' }), focus: 'scheduleField' })).toEqual({ type: 'toggleCalendar' });
      expect(shortcutFor(key('k', { metaKey: true }), { state: st(OPEN), focus: 'title' })).toBeNull();
    });
    it('⌘1…⌘6 by code map to DATE_PRESETS order, section open only', () => {
      DATE_PRESETS.forEach((preset, i) =>
        expect(shortcutFor({ key: '+ěščř'[i] ?? 'ž', code: `Digit${i + 1}`, metaKey: true, shiftKey: false, altKey: false, ctrlKey: false },
          { state: st({ ...OPEN, schedule: 'controls' }), focus: 'scheduleField' })).toEqual({ type: 'preset', preset }));
      expect(shortcutFor(key('1', { metaKey: true }), { state: st(OPEN), focus: 'title' })).toBeNull();
    });
    it('↑/↓ in the time field → stepTime ±1', () => {
      const s = st({ ...OPEN, schedule: 'controls' });
      expect(shortcutFor(key('ArrowUp'), { state: s, focus: 'timeField' })).toEqual({ type: 'stepTime', steps: 1 });
      expect(shortcutFor(key('ArrowDown'), { state: s, focus: 'timeField' })).toEqual({ type: 'stepTime', steps: -1 });
    });
    it('arrows in the calendar → moveDay −1 / +1 / −7 / +7', () => {
      const s = st({ ...OPEN, schedule: 'calendar' });
      expect(shortcutFor(key('ArrowLeft'), { state: s, focus: 'calendar' })).toEqual({ type: 'moveDay', days: -1 });
      expect(shortcutFor(key('ArrowRight'), { state: s, focus: 'calendar' })).toEqual({ type: 'moveDay', days: 1 });
      expect(shortcutFor(key('ArrowUp'), { state: s, focus: 'calendar' })).toEqual({ type: 'moveDay', days: -7 });
      expect(shortcutFor(key('ArrowDown'), { state: s, focus: 'calendar' })).toEqual({ type: 'moveDay', days: 7 });
    });
    it('arrows elsewhere → null', () => expect(shortcutFor(key('ArrowDown'), { state: st(OPEN), focus: 'title' })).toBeNull());
    it('browser shortcuts pass through', () => {
      for (const k of ['c', 'v', 'a', 'l', 't', 'r']) expect(shortcutFor(key(k, { metaKey: true }), { state: st(OPEN), focus: 'title' })).toBeNull();
    });
    it('⌥-modified keys → null', () => expect(shortcutFor(key('Enter', { metaKey: true, altKey: true }), { state: st(OPEN), focus: 'title' })).toBeNull());
  });
  describe('focusTargetOf', () => {
    it('reads data-qr-focus', () => { const el = document.createElement('input'); el.dataset.qrFocus = 'timeField'; expect(focusTargetOf(el)).toBe('timeField'); });
    it('maps the title placeholder', () => { const el = document.createElement('input'); el.placeholder = 'New Reminder'; expect(focusTargetOf(el)).toBe('title'); });
    it('maps aria-label "Type a date"', () => { const el = document.createElement('input'); el.setAttribute('aria-label', 'Type a date'); expect(focusTargetOf(el)).toBe('scheduleField'); });
    it('maps a grid ancestor to calendar', () => { const g = document.createElement('div'); g.setAttribute('role', 'grid'); const b = document.createElement('button'); g.append(b); expect(focusTargetOf(b)).toBe('calendar'); });
    it('is none for null and unrelated elements', () => { expect(focusTargetOf(null)).toBe('none'); expect(focusTargetOf(document.body)).toBe('none'); });
  });
  describe('performShortcut', () => {
    it('show toggles: open → hide, closed → show hotkey', () => { /* FakeRecreationHandle is not built yet: use a minimal object { getState, hide: vi.fn(() => Promise.resolve()), show: vi.fn(() => Promise.resolve()) } cast to RecreationHandle */ });
    it('stepTime goes through the live draft', () => { /* scheduleDraft: () => ({ stepTime: vi.fn() }); expect stepTime(1) */ });
    it('applyTypedTime passes the typed text', () => { /* expect applyTypedTime('1430') */ });
  });
  ```
  (`SUGGESTION` = `{ date: new Date('2026-10-24T12:00:00Z'), hasTime: true, matchedRange: { start: 9, end: 24 }, matchedText: 'tomorrow at 2pm' }`;
  file docblock `// @vitest-environment jsdom`. Write the three `performShortcut` bodies with the stated objects and assertions.)
- [ ] **Step 3: Run** `npx vitest run tests/desktop/desktopShortcuts.test.ts` — expected FAIL (module not found).
- [ ] **Step 4: Implement** `src/desktop/scene.ts` and `src/desktop/desktopShortcuts.ts`. Rules the tests pin:
  ⌘ = `metaKey || ctrlKey`; any `altKey` → null; letters by `code` (`KeyR`, `KeyD`, `KeyK`), presets by
  `code` `Digit1`…`Digit6` (layout independent: Czech keyboards send `+ěščřž`); `Enter`, `Escape`, `Tab`,
  `Arrow*` by `key`; Esc/⌘↩/↩/Tab/⌘D/⌘K/⌘n/arrows return null while `phase.type !== 'open'`.
- [ ] **Step 5: Run** the test — expected PASS (all).
- [ ] **Step 6: Commit.** `git add src/desktop/scene.ts src/desktop/desktopShortcuts.ts src/recreation/index.ts tests/desktop/desktopShortcuts.test.ts && git commit -m "feat(desktop): add scene constants and the keyboard shortcut router"`

---

### Task C3: Fake cursor

**Files:**
- Create: `src/desktop/fakeCursor.ts`, `src/desktop/FakeCursor.tsx`
- Test: `tests/desktop/fakeCursor.test.tsx`

**Interfaces:**
- Consumes: `ScenePoint` (recreation index), `ptCss` (C2).
- Produces:
  ```ts
  // src/desktop/fakeCursor.ts  (contracts §4.5, exact; ScenePoint re-exported for desktop callers)
  export type { ScenePoint } from '../recreation';
  export interface FakeCursorHandle { moveTo(point: ScenePoint, opts?: { durationMs?: number }): Promise<void>; click(): Promise<void>;
    show(): void; hide(): void; pin(pinned: boolean): void; position(): ScenePoint; cancel(): void; }
  export const CURSOR_HOME: ScenePoint;                 // { x: 1180, y: 640 }
  export const CURSOR_SPEED_PT_PER_MS: 1.6;
  export const CURSOR_HOTSPOT: { x: 2; y: 1.5 };        // tip of the arrow inside its 18 × 24 pt box
  export const CURSOR_EASE: readonly [0.42, 0, 0.58, 1]; // SwiftUI .easeInOut (contracts §7 EASE_IN_OUT)
  export const CURSOR_AUTO_HIDE_MS: 1200;
  export const CURSOR_PRESS: { scale: 0.94; ms: 80 };
  export function cursorDuration(from: ScenePoint, to: ScenePoint): number;   // clamp(distance / 1.6, 220, 700) ms
  // src/desktop/FakeCursor.tsx
  export interface FakeCursorProps { idleOpacity?: number /* default 0 */; timeScale?: number /* default 1 */; reduceMotion?: boolean }
  export const FakeCursor: ForwardRefExoticComponent<FakeCursorProps & RefAttributes<FakeCursorHandle>>;
  ```

- [ ] **Step 1: Write the failing test** `tests/desktop/fakeCursor.test.tsx` (jsdom, `vi.useFakeTimers()`):
  ```ts
  describe('cursorDuration', () => {
    it('clamps short moves to 220 ms', () => expect(cursorDuration({ x: 0, y: 0 }, { x: 160, y: 0 })).toBe(220));
    it('is distance / 1.6 in range', () => expect(cursorDuration({ x: 0, y: 0 }, { x: 480, y: 640 })).toBe(500));
    it('clamps long moves to 700 ms', () => expect(cursorDuration({ x: 0, y: 0 }, { x: 2000, y: 0 })).toBe(700));
  });
  it('rests at CURSOR_HOME', () => expect(CURSOR_HOME).toEqual({ x: 1180, y: 640 }));
  describe('<FakeCursor>', () => {
    it('is aria-hidden and ignores the pointer', () => { /* render; svg root has aria-hidden="true", style pointer-events none */ });
    it('moveTo writes the hotspot-adjusted transform and resolves after the default duration', async () => {
      const ref = createRef<FakeCursorHandle>(); render(<FakeCursor ref={ref} />);
      let done = false; ref.current!.moveTo({ x: 700, y: 640 }).then(() => { done = true; });   // 480 pt → 300 ms
      expect(cursorEl().style.transform).toBe('translate(calc(698 * var(--pt) * 1px), calc(638.5 * var(--pt) * 1px))');
      expect(cursorEl().style.transition).toBe('transform 300ms cubic-bezier(0.42, 0, 0.58, 1), opacity 250ms ease-out');
      await vi.advanceTimersByTimeAsync(299); expect(done).toBe(false);
      await vi.advanceTimersByTimeAsync(1); expect(done).toBe(true);
      expect(ref.current!.position()).toEqual({ x: 700, y: 640 });
    });
    it('durations scale with timeScale', async () => { /* timeScale 4: same move resolves at 1200 ms, not 1199 */ });
    it('reduced motion moves instantly', async () => { /* reduceMotion: transition 'opacity 250ms ease-out' only, resolves after 0 ms */ });
    it('auto-hides 1.2 s after the last move to idleOpacity, unless pinned', async () => {
      /* idleOpacity 0.4: after move + 1200 ms → style.opacity '0.4'; with pin(true) → stays '1' */
    });
    it('click presses to 0.94 for 80 ms', async () => { /* inner arrow scale(0.94) then scale(1) after 80 ms; promise resolves at 80 ms */ });
    it('cancel rejects a running move with AbortError', async () => {
      const ref = createRef<FakeCursorHandle>(); render(<FakeCursor ref={ref} />);
      const p = ref.current!.moveTo({ x: 0, y: 0 }); ref.current!.cancel();
      await expect(p).rejects.toMatchObject({ name: 'AbortError' });
    });
  });
  ```
  (`cursorEl()` = the element with `data-fake-cursor`. Fill the commented bodies with the stated assertions.)
- [ ] **Step 2: Run** `npx vitest run tests/desktop/fakeCursor.test.tsx` — expected FAIL.
- [ ] **Step 3: Implement.** The cursor is an absolutely positioned `<div data-fake-cursor>` at scene (0, 0),
  z-index 40, moved with a CSS `transform` transition (no rAF), wrapping an SVG `width=ptCss(18) height=ptCss(24) viewBox="0 0 18 24"`
  with the original arrow `path d="M2 1.5 L2 19.2 L6.4 15.1 L9.4 21.9 L12.3 20.7 L9.4 14 L15.2 14 Z"`, fill `#000000`,
  stroke `#FFFFFF` width 1.4, `stroke-linejoin="round"`, CSS `filter: drop-shadow(0 calc(1 * var(--pt) * 1px) calc(2 * var(--pt) * 1px) rgba(0,0,0,0.35))`.
  Opacity: 1 while moving/pinned, `idleOpacity` after `CURSOR_AUTO_HIDE_MS × timeScale`; `hide()` → 0; opacity transition 250 ms ease-out.
  `moveTo` rejects with `new DOMException('Aborted', 'AbortError')` on `cancel()`.
- [ ] **Step 4: Run** the test — expected PASS.
- [ ] **Step 5: Commit.** `git add src/desktop/fakeCursor.ts src/desktop/FakeCursor.tsx tests/desktop/fakeCursor.test.tsx && git commit -m "feat(desktop): add the fake demo cursor"`

---

### Task C4: Wallpaper (original CSS mesh, light and dark) and media-query hook

**Files:**
- Create: `src/desktop/useMediaQuery.ts`, `src/desktop/Wallpaper.tsx`
- Test: `tests/desktop/wallpaper.test.tsx`

**Interfaces:**
- Consumes: `installMatchMedia` (C1).
- Produces:
  ```ts
  // src/desktop/useMediaQuery.ts
  export function useMediaQuery(query: string): boolean;               // useSyncExternalStore over matchMedia; false when matchMedia is missing
  export function useColorScheme(pref: 'light' | 'dark' | 'auto'): 'light' | 'dark'; // 'auto' → (prefers-color-scheme: dark)
  // src/desktop/Wallpaper.tsx
  export const WALLPAPER: { readonly light: string; readonly dark: string };   // the CSS `background` values below
  export function Wallpaper(props: { scheme: 'light' | 'dark' }): JSX.Element;   // <div data-wallpaper={scheme} aria-hidden>
  ```

- [ ] **Step 1: Write the failing test** `tests/desktop/wallpaper.test.tsx` (jsdom):
  ```ts
  it('light wallpaper is three soft blobs on a pale base', () => {
    expect(WALLPAPER.light).toBe(
      'radial-gradient(60% 70% at 18% 22%, #9DB8FF 0%, rgba(157, 184, 255, 0) 70%), ' +
      'radial-gradient(55% 65% at 84% 30%, #F4B6D2 0%, rgba(244, 182, 210, 0) 70%), ' +
      'radial-gradient(70% 60% at 58% 96%, #FFD7A6 0%, rgba(255, 215, 166, 0) 72%), #E8ECF6');
  });
  it('dark wallpaper keeps the layout with deep colours', () => {
    expect(WALLPAPER.dark).toBe(
      'radial-gradient(60% 70% at 18% 22%, #2C3F92 0%, rgba(44, 63, 146, 0) 70%), ' +
      'radial-gradient(55% 65% at 84% 30%, #6A2C6F 0%, rgba(106, 44, 111, 0) 70%), ' +
      'radial-gradient(70% 60% at 58% 96%, #1D5D66 0%, rgba(29, 93, 102, 0) 72%), #0B1020');
  });
  it('renders the scheme it is given, aria-hidden, filling the scene', () => { /* data-wallpaper="dark", aria-hidden="true", class contains "absolute inset-0" */ });
  it("useColorScheme('auto') follows prefers-color-scheme and updates on change", () => {
    const mm = installMatchMedia({ '(prefers-color-scheme: dark)': false });
    /* render a probe that prints useColorScheme('auto'); expect 'light'; act(() => mm.set('(prefers-color-scheme: dark)', true)); expect 'dark' */
  });
  it("useColorScheme('dark') ignores the media query", () => { /* prints 'dark' with the query false */ });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/desktop/wallpaper.test.tsx` — expected FAIL.
- [ ] **Step 3: Implement** both files with the pinned strings (landing §3 "original gradient/mesh wallpaper", §6 "two or three soft blobs").
- [ ] **Step 4: Run** — expected PASS.
- [ ] **Step 5: Commit.** `git add src/desktop/useMediaQuery.ts src/desktop/Wallpaper.tsx tests/desktop/wallpaper.test.tsx && git commit -m "feat(desktop): add the original light and dark wallpaper"`

---

### Task C5: Menu bar with the notch cut-out, app menu-bar icon and menu, real clock

**Files:**
- Create: `src/desktop/MenuBarClock.tsx`, `src/desktop/MenuBar.tsx`
- Test: `tests/desktop/menuBar.test.tsx`

**Interfaces:**
- Consumes: `SCENE`, `NOTCH_LEFT`, `NOTCH_RIGHT`, `ptCss` (C2); `Clock`, `Calendar` (recreation index);
  `plainSpaces` (tests/support.ts).
- Produces:
  ```ts
  // src/desktop/MenuBarClock.tsx
  /** en*: "Fri Oct 23 10:00 AM" (weekday short, month short, day, j:mm); other locales: "pá 23. 10. 10:00"
   *  (weekday short, numeric day.month, j:mm). U+202F / U+00A0 become plain spaces. */
  export function formatMenuBarClock(date: Date, locale: string, timeZone: string): string;
  export function msUntilNextMinute(now: Date): number;      // 60000 − (s·1000 + ms); 60000 exactly on the minute
  export function MenuBarClock(props: { clock: Clock; locale: string; timeZone: string }): JSX.Element;
  // src/desktop/MenuBar.tsx
  export const MENU_BAR: { readonly appName: 'Notes'; readonly menus: readonly ['File', 'Edit', 'Format', 'View', 'Window', 'Help'];
    readonly fontSize: 13; readonly leftInset: 20; readonly itemGap: 20; readonly rightInset: 16; readonly statusGap: 18; readonly iconSize: 16 };
  export interface MenuBarProps { scheme: 'light' | 'dark'; clock: Clock; locale: string; timeZone: string; onShowPanel(): void }
  export function MenuBar(props: MenuBarProps): JSX.Element;
  ```

- [ ] **Step 1: Write the failing test** `tests/desktop/menuBar.test.tsx` (jsdom, `vi.useFakeTimers()`):
  ```ts
  import { prague, plainSpaces } from '../support';
  describe('formatMenuBarClock', () => {
    it('en-US', () => expect(formatMenuBarClock(prague(2026, 10, 23, 10, 0), 'en-US', 'Europe/Prague')).toBe('Fri Oct 23 10:00 AM'));
    it('cs-CZ', () => expect(plainSpaces(formatMenuBarClock(prague(2026, 10, 23, 14, 5), 'cs-CZ', 'Europe/Prague'))).toBe('pá 23. 10. 14:05'));
  });
  describe('msUntilNextMinute', () => {
    it('half a second before the minute', () => expect(msUntilNextMinute(new Date(2026, 9, 23, 10, 0, 59, 500))).toBe(500));
    it('on the minute waits a full minute', () => expect(msUntilNextMinute(new Date(2026, 9, 23, 10, 0, 0, 0))).toBe(60000));
  });
  describe('<MenuBar>', () => {
    it('is 38 pt tall and draws its background in two segments around the notch', () => {
      /* [data-menubar] style.height = 'calc(38 * var(--pt) * 1px)';
         [data-menubar-bg="left"] width 'calc(645.5 * var(--pt) * 1px)'; [data-menubar-bg="right"] left 'calc(866.5 * var(--pt) * 1px)', right '0' */
    });
    it('draws the hardware notch: 221 × 38 pt black, centred at x 756', () => { /* [data-hardware-notch] width calc(221…), height calc(38…), left calc(645.5…), background-color rgb(0, 0, 0) */ });
    it('shows an Apple-free app name and menus', () => { /* getByText('Notes') has font-weight 700; File…Help present; the left cluster is aria-hidden */ });
    it('shows the clock and ticks on the minute', async () => {
      let t = prague(2026, 10, 23, 10, 0); const clock = () => t;
      /* render with locale en-US → text 'Fri Oct 23 10:00 AM'; t = prague(…10, 1); advance 60000 → 'Fri Oct 23 10:01 AM' */
    });
    it('the QuickReminder icon opens its menu; "Show Quick Reminder" calls onShowPanel', async () => {
      /* getByRole('button', { name: 'QuickReminder menu' }) aria-haspopup="menu" aria-expanded false → click → true;
         getByRole('menuitem', { name: 'Show Quick Reminder' }) click → onShowPanel called once, menu closed;
         'Settings…' and 'Quit' menuitems have aria-disabled="true" */
    });
    it('Esc closes the menu and returns focus to the icon, with preventDefault', () => { /* fireEvent.keyDown(menu, { key: 'Escape' }) → returns false (defaultPrevented) */ });
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/desktop/menuBar.test.tsx` — expected FAIL.
- [ ] **Step 3: Implement.** Pinned values: height `SCENE.menuBarHeight` 38 pt, line-height 38 pt, font
  `var(--qr-font)` 13 pt (`MENU_BAR.fontSize`), app name weight 700, menus 400, `leftInset` 20, `itemGap` 20.
  Background segments: light `rgba(255, 255, 255, 0.28)`, dark `rgba(0, 0, 0, 0.22)`, both with
  `backdrop-filter: blur(calc(24 * var(--pt) * 1px)) saturate(1.6)`; text light `rgba(0, 0, 0, 0.86)`, dark
  `rgba(255, 255, 255, 0.92)`. Hardware notch: `#000000`, 221 × 38 pt at x 645.5, bottom corners 8 pt (the
  recreation's closed silhouette, 235 × 39 pt, covers it exactly; contracts §5.1). Right cluster from the right
  edge: clock (13 pt, weight 500, `font-variant-numeric: tabular-nums`), `statusGap` 18, then the icon button:
  Phosphor `ListChecks` 16 pt `weight="regular"` (cross-area note 1) in a 28 × 22 pt button, radius 5 pt, hover fill
  light `rgba(0,0,0,0.10)` / dark `rgba(255,255,255,0.15)`, `aria-label="QuickReminder menu"`, `aria-haspopup="menu"`.
  Its menu (items from app `AppDelegate.swift` lines 63–66: "Show Quick Reminder", separator, "Settings…", "Quit")
  follows landing §11.4: pure black surface, radius 12 pt, 1 pt `#3D3D3F` stroke, rows 13 pt white with fills
  white 6 % rest / 11 % hover / 15 % pressed, anchored below the icon at y 42 pt, min-width 220 pt, right-aligned to
  the icon; disabled rows show "In the app" (11 pt, white 50 %) on the right. Clock: `setTimeout(msUntilNextMinute(clock()))`
  then every 60000 ms; `formatMenuBarClock(clock(), locale, timeZone)`.
- [ ] **Step 4: Run** — expected PASS.
- [ ] **Step 5: Commit.** `git add src/desktop/MenuBar.tsx src/desktop/MenuBarClock.tsx tests/desktop/menuBar.test.tsx && git commit -m "feat(desktop): add the menu bar with the notch cut-out, app menu and live clock"`

---

### Task C6: Notch hint

**Files:**
- Create: `src/desktop/NotchHint.tsx`
- Test: `tests/desktop/notchHint.test.tsx`

**Interfaces:**
- Consumes: `HINT_TOP`, `ptCss` (C2); `useMediaQuery` (C4).
- Produces:
  ```ts
  export const HINT_COPY: { readonly line1: 'Click the notch to add a reminder'; readonly line1Touch: 'Tap the notch to add a reminder';
    readonly line2: 'In the app: ⇧⌘R from anywhere.' };   // landing §11.3, verbatim
  export const HINT_FADE_MS: 400;                          // contracts §4.1
  export interface NotchHintProps { visible: boolean; scheme: 'light' | 'dark'; reduceMotion: boolean; timeScale?: number; onOpen(): void }
  export function NotchHint(props: NotchHintProps): JSX.Element | null;
  ```

- [ ] **Step 1: Write the failing test** `tests/desktop/notchHint.test.tsx` (jsdom, fake timers, `installMatchMedia`):
  ```ts
  it('shows both lines of the §11.3 copy', () => { /* getByText(HINT_COPY.line1), getByText('In the app: ⇧⌘R from anywhere.') */ });
  it('says "Tap" on a coarse pointer', () => { /* installMatchMedia({ '(pointer: coarse)': true }) → getByText('Tap the notch to add a reminder') */ });
  it('is a button that opens the panel', () => { /* getByRole('button', { name: 'Click the notch to add a reminder' }) click → onOpen once */ });
  it('sits centred under the notch at y 58 pt', () => { /* root style top 'calc(58 * var(--pt) * 1px)', left 'calc(756 * var(--pt) * 1px)', transform contains 'translateX(-50%)' */ });
  it('fades out over 400 ms when visible turns false, then unmounts', async () => {
    /* rerender visible=false → style.opacity '0', transition 'opacity 400ms ease-out'; advance 400 → queryByRole('button') null */
  });
  it('reduced motion: no bob animation and a 150 ms fade', () => { /* style.animation 'none'; after visible false transition 'opacity 150ms ease-out' */ });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/desktop/notchHint.test.tsx` — expected FAIL.
- [ ] **Step 3: Implement.** Capsule: padding 8 × 14 pt, radius 999 pt, light `rgba(255, 255, 255, 0.78)` with
  `backdrop-filter: blur(calc(20 * var(--pt) * 1px))`, line 1 `#1D1D1F` 15 pt 600, line 2 `#3A3A3C` 12 pt 500;
  dark `rgba(0, 0, 0, 0.45)`, line 1 `#F5F5F7`, line 2 `#C7C7CC`; gap 2 pt; font `var(--qr-font)`; z-index 25.
  Bob (the nudge, landing §1): `@keyframes qr-hint-bob { 0%,100% { transform: translate(-50%, 0) } 50% { transform: translate(-50%, calc(3 * var(--pt) * 1px)) } }`,
  1.6 s ease-in-out infinite, defined in the component's `<style>` tag or `src/index.css`; off under reduced motion.
  Fade 400 ms × `timeScale` ease-out (150 ms under reduced motion, contracts §7 `reduced`).
- [ ] **Step 4: Run** — expected PASS.
- [ ] **Step 5: Commit.** `git add src/desktop/NotchHint.tsx tests/desktop/notchHint.test.tsx && git commit -m "feat(desktop): add the notch hint"`

---

### Task C7: Fake Reminders window

**Files:**
- Create: `src/desktop/RemindersWindow.tsx`
- Test: `tests/desktop/remindersWindow.test.tsx`

**Interfaces:**
- Consumes: `SavedReminder` (recreation index, contracts §2.13); `REMINDERS_WINDOW`, `ptCss` (C2);
  test-only `springFromResponse` from `src/recreation/machine/springs.ts` (contracts §7).
- Produces:
  ```ts
  /** = Motion.chip (contracts §7: response 0.30, damping 0.80), copied because desktop/ may only import the recreation's public surface. */
  export const WINDOW_SPRING: { readonly type: 'spring'; readonly stiffness: 438.65; readonly damping: 33.51; readonly mass: 1 };
  export const WINDOW_DELAY_S: 0.2;           // after the ✓ lands (contracts §4.1)
  export const WINDOW_COPY: { readonly title: 'Your reminders'; readonly footnote: 'Saved in this demo only. Nothing leaves your browser.' };
  export interface RemindersWindowProps { items: readonly SavedReminder[]; scheme: 'light' | 'dark'; pt: number; reduceMotion: boolean; timeScale?: number }
  export function RemindersWindow(props: RemindersWindowProps): JSX.Element | null;   // null while items is empty
  ```

- [ ] **Step 1: Write the failing test** `tests/desktop/remindersWindow.test.tsx` (jsdom):
  ```ts
  const ITEM: SavedReminder = { id: 'a', title: 'Call mum', notes: '📍 Office', listId: 'work', listColor: '#BF5AF2',
    dueDate: new Date('2026-10-24T12:00:00Z'), dueLabel: 'Tomorrow, 2:00 PM', flagged: true, savedAt: new Date('2026-10-23T08:00:00Z') };
  it('WINDOW_SPRING equals the chip spring', () => {
    const s = springFromResponse(0.30, 0.80);
    expect(WINDOW_SPRING.stiffness).toBeCloseTo(s.stiffness, 2); expect(WINDOW_SPRING.damping).toBeCloseTo(s.damping, 2);
  });
  it('renders nothing before the first save', () => { /* container empty for items [] */ });
  it('is a region named "Your reminders" at x 790, y 330, 320 pt wide', () => { /* getByRole('region', { name: 'Your reminders' }); style left/top/width via ptCss */ });
  it('shows title, list dot, due label, flag and notes', () => {
    /* getByText('Call mum'); dot [data-list-dot] style background-color rgb(191, 90, 242) and width calc(10 * var(--pt) * 1px);
       getByText('Tomorrow, 2:00 PM'); getByLabelText('Flagged'); getByText('📍 Office') */
  });
  it('lists the newest first and shows the count', () => { /* items [ITEM, {...ITEM, id:'b', title:'Buy milk', savedAt later}] → rows order ['Buy milk','Call mum']; count '2' */ });
  it('omits the flag and the notes line when absent', () => { /* flagged false, notes null → no 'Flagged', no notes element */ });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/desktop/remindersWindow.test.tsx` — expected FAIL.
- [ ] **Step 3: Implement** with motion (`motion.section`): enter `initial { opacity: 0, x: 40 × pt }` →
  `{ opacity: 1, x: 0 }` with `WINDOW_SPRING` scaled by `timeScale` (stiffness / t², damping / t, contracts §7 `scaled`)
  and `delay: WINDOW_DELAY_S × timeScale`; reduced motion: opacity only, tween 0.15 s ease-out. New rows use
  `AnimatePresence` + `layout` with the same spring and delay. Visual (original, not Apple chrome; no window
  buttons): radius 16 pt; light surface `rgba(255, 255, 255, 0.86)`, 1 pt border `rgba(0, 0, 0, 0.08)`, shadow
  `0 calc(18pt) calc(50pt) rgba(0, 0, 0, 0.18)` (each length through `ptCss`), text `#1D1D1F`, muted `#5E5E63`; dark surface
  `rgba(28, 28, 30, 0.86)`, border `rgba(255, 255, 255, 0.10)`, shadow alpha 0.5, text `#F5F5F7`, muted `#AEAEB2`;
  `backdrop-filter: blur(calc(30 * var(--pt) * 1px))`; header 48 pt, padding 0 16 pt, title 15 pt 700, count 15 pt 600 muted;
  rows padding 10 16 pt, gap 10 pt: dot 10 pt (contracts §4.2), title 14 pt 500, due label 12 pt 400 muted
  (`tabular-nums`), notes 12 pt muted (`white-space: pre-line`, 2-line clamp), flag Phosphor `Flag weight="fill"` 13 pt
  `#FF9E0A` (`--qr-flag-orange`) with `aria-label="Flagged"`; list body `max-height` 340 − 48 − 34 pt with `overflow-y: auto`;
  footnote 11 pt muted, padding 10 16 12 pt. Font `var(--qr-font)`. z-index 10.
- [ ] **Step 4: Run** — expected PASS.
- [ ] **Step 5: Commit.** `git add src/desktop/RemindersWindow.tsx tests/desktop/remindersWindow.test.tsx && git commit -m "feat(desktop): add the fake Reminders window"`

---

### Task C8: DesktopScene (assembly, focus handling, keyboard routing, click outside)

**Files:**
- Create: `src/desktop/DesktopScene.tsx`
- Create: `tests/fakes/fakeRecreationHandle.ts`, `tests/fakes/recreationMock.tsx`
- Test: `tests/desktop/desktopScene.test.tsx`

**Interfaces:**
- Consumes: `Recreation`, `RecreationProps`, `RecreationHandle`, `RecreationState`, `SavedReminder`, `Clock`,
  `Calendar` (recreation index, contracts §3); C2 `SCENE`, `ptCss`, `shortcutFor`, `focusTargetOf`, `performShortcut`;
  C3 `FakeCursor`, `FakeCursorHandle`; C4 `Wallpaper`, `useColorScheme`, `useMediaQuery`; C5 `MenuBar`; C6 `NotchHint`;
  C7 `RemindersWindow`. Area B requirement: `pointFor()` uses layout coordinates (cross-area note 6).
- Produces:
  ```ts
  // src/desktop/DesktopScene.tsx  (contracts §4.1 + cross-area note 4)
  export { SCENE } from './scene';
  export interface DesktopSceneProps { recreationRef: RefObject<RecreationHandle | null>; cursorRef?: RefObject<FakeCursorHandle | null>;
    pt: number; colorScheme?: 'light' | 'dark' | 'auto'; clock?: Clock; calendar?: Calendar; locale?: string; reduceMotion?: boolean;
    hintEnabled?: boolean; onSaved?(item: SavedReminder): void; className?: string; timeScale?: number }
  export function DesktopScene(props: DesktopSceneProps): JSX.Element;
  // root attributes other parts and e2e rely on:
  //   role="application" aria-label="QuickReminder demo desktop" tabIndex={-1}
  //   data-phase={state.phase.type} data-schedule={state.schedule} data-scheme={scheme}
  //   style --pt, width ptCss(1512), height ptCss(982)
  // tests/fakes/fakeRecreationHandle.ts
  export const INITIAL_STATE: RecreationState;
  export class FakeRecreationHandle implements RecreationHandle {
    constructor(opts?: { state?: Partial<RecreationState>; phraseDate?: Date; now?: Date });
    readonly calls: Array<{ method: string; args: unknown[] }>;
    methods(): string[];                                   // calls.map(c => c.method)
    visitorEdit(patch: Partial<RecreationState>): void;    // simulates the visitor: applies patch, dirty = true, notifies
  }
  // tests/fakes/recreationMock.tsx  (vi.mock('…/src/recreation', () => import('…/tests/fakes/recreationMock')))
  export const Recreation: ForwardRefExoticComponent<RecreationProps & RefAttributes<RecreationHandle>>; // installs a FakeRecreationHandle
  export const lastRecreation: { props: RecreationProps | null; handle: FakeRecreationHandle | null };
  export { DATE_PRESETS } from '../../src/recreation/core/datePresets';
  ```

- [ ] **Step 1: Write `tests/fakes/fakeRecreationHandle.ts`.** `INITIAL_STATE` is contracts §3.1 at rest:
  `phase { type: 'closed', parked: false }`, `schedule 'none'`, `contentVisible false`, `settled false`, `hoverSwollen false`,
  `badgeShown false`, `title ''`, `notes ''`, `listId 'reminders'`, `flagged false`, `location null`, `dueDate null`,
  `presetPick null`, `suggestion null`, `dismissedSuggestionText null`, `listPickerOpen false`, `locationPopoverOpen false`,
  `saveError null`, `savedItems []`, `dirty false`, `openedOnce false`, `canSave false`, `accent '#0A84FF'`, `schedulingInNotch false`.
  Every method records `{ method, args }` (not `getState`, `subscribe`, `machine`, `scheduleDraft`, `pointFor`), recomputes
  `canSave` / `accent` (list colours of contracts §2.12) / `schedulingInNotch` and notifies subscribers. Behaviour:
  `show` (from closed/closing: resets title, notes, flagged, location, dueDate, presetPick, suggestion, schedule, popovers; keeps listId;
  phase open; openedOnce true) resolves after 500 ms; `hide` → closed, 360 ms; `save` → null when `!canSave`; when
  `schedule !== 'none'` → schedule 'none', resolves null; else phase saving, appends a `SavedReminder`
  (`id 'saved-<n>'`, `notes` = location ? `📍 ${location}` (prefixed by notes + `\n` when notes non-empty) : notes || null,
  `listColor`, `dueLabel null`, `savedAt` = opts.now) at 320 ms, phase closed at 1680 ms (0.32 + 1.0 + 0.36), resolves the item;
  `typeTitle(text, cps = 18)` sets the title after `text.length / cps × 1000` ms; `applySuggestion()` strips a trailing
  `' tomorrow at 2pm'` and sets `dueDate = phraseDate` → true, else false; `typeLocation(text, cps = 18)` opens the popover,
  after `text.length / cps × 1000` ms sets `location`, closes it; `pointerTo` / `setPointer` resolve after 300 ms → true;
  `openSchedule` → 'controls' (open only), `openCalendar` → 'calendar', `closeCalendar` → 'controls', `toggleCalendar`,
  `cancelSchedule` → 'none'; `escape()` layered calendar → section → popover → panel (→ hide); `setList`, `setFlag`, `toggleFlag`,
  `setLocation('' → null)`, `setTitle`, `setNotes`, `setDueDate`; `markClean` → dirty false; `cancel()` rejects every pending
  delay with `new DOMException('Aborted', 'AbortError')`; `reset`; `machine()` returns `{ phase, schedule, … }` with zeros.
  Delays use `setTimeout`, so Vitest fake timers drive them.
- [ ] **Step 2: Write `tests/fakes/recreationMock.tsx`** per Produces (`useImperativeHandle` returns the fake; on every
  fake change it calls `props.onStateChange?.(state)`; when a saved item is appended it calls `props.onSaved?.(item)`;
  it renders `<div data-qr-root><input placeholder="New Reminder" /></div>` so focus tests have a field).
- [ ] **Step 3: Write the failing test** `tests/desktop/desktopScene.test.tsx` (jsdom, fake timers, `installMatchMedia({})`,
  `vi.mock('../../src/recreation', () => import('../fakes/recreationMock'))`):
  ```ts
  function setup(props?: Partial<DesktopSceneProps>) { const recreationRef = createRef<RecreationHandle>(); render(<DesktopScene recreationRef={recreationRef} pt={0.5} clock={() => NOW} calendar={pragueCalendar} {...props} />); return { recreationRef, root: screen.getByRole('application', { name: 'QuickReminder demo desktop' }), fake: lastRecreation.handle! }; }
  it('is a 1512 × 982 pt scene scaled by --pt', () => {
    const { root } = setup();
    expect(root.style.getPropertyValue('--pt')).toBe('0.5'); expect(root.style.width).toBe('calc(1512 * var(--pt) * 1px)'); expect(root.style.height).toBe('calc(982 * var(--pt) * 1px)');
    expect(root.tabIndex).toBe(-1);
  });
  it('hosts the recreation with the 14" notch geometry', () => {
    setup();
    expect(lastRecreation.props).toMatchObject({ notch: { width: 221, height: 38 }, screenHeight: 982, dockHeight: 0, notchOrigin: { x: 756, y: 0 }, sceneScale: 0.5, locale: 'en-US', shortcutsEnabled: false });
  });
  it('pointerdown on the wallpaper focuses the desktop and enables shortcuts', () => {
    const { root } = setup(); fireEvent.pointerDown(root.querySelector('[data-wallpaper]')!);
    expect(document.activeElement).toBe(root); expect(lastRecreation.props!.shortcutsEnabled).toBe(true);
  });
  it('routes ⌘D to openSchedule while focus is inside', async () => {
    const { root, fake } = setup(); await act(() => { void fake.show({ source: 'click' }); });
    root.focus(); const ev = fireEvent.keyDown(root, { key: 'd', code: 'KeyD', metaKey: true });
    expect(ev).toBe(false); expect(fake.methods()).toContain('openSchedule');
  });
  it('ignores keys another handler already prevented', () => { /* input inside data-qr-root: addEventListener('keydown', e => e.preventDefault()); Escape on it → fake.methods() has no 'escape' */ });
  it('does nothing for keys without a shortcut (browser keeps them)', () => { /* keyDown ⌘C → returns true */ });
  it('a click outside the panel hides it; a click inside does not', async () => { /* open; pointerDown on [data-wallpaper] → 'hide'; reopen; pointerDown inside [data-desktop-slot="notch"] → no new 'hide' */ });
  it('mirrors phase and schedule on the root', async () => { /* show → data-phase="open"; openSchedule → data-schedule="controls" */ });
  it('the hint shows until the first open, then fades', async () => { /* hint button present; show; advance 400 → gone */ });
  it('the menu-bar menu opens the panel with the click source', () => { /* click 'QuickReminder menu', click 'Show Quick Reminder' → calls includes { method: 'show', args: [{ source: 'click' }] } */ });
  it('mounts the Reminders window on the first saved item', async () => { /* setTitle('Call mum'); save; advance 320 → region 'Your reminders' with 'Call mum' */ });
  it('returns focus to the desktop when the panel closes with focus inside it', async () => { /* focus the mock input; hide; advance 360 → activeElement === root */ });
  it('colorScheme "dark" sets data-scheme', () => { /* root.dataset.scheme === 'dark' */ });
  ```
  (`NOW = prague(2026, 10, 23, 10, 0)`. Fill commented bodies with the stated assertions.)
- [ ] **Step 4: Run** `npx vitest run tests/desktop/desktopScene.test.tsx` — expected FAIL.
- [ ] **Step 5: Implement `DesktopScene`.** Layers (z-index): `Wallpaper` 0 · `RemindersWindow` 10 · `MenuBar` 20 ·
  `NotchHint` 25 · notch slot 30 (`<div data-desktop-slot="notch">` at `left: ptCss(756)`, `top: 0`, `transform: translateX(-50%)`,
  the panel overlaps the menu bar like the real one) · `FakeCursor` 40. Root: `position: relative; overflow: hidden;
  border-radius: ptCss(10) ptCss(10) ptCss(6) ptCss(6)` (MacBook display corners); `user-select: none`; `outline: none`.
  Recreation props: `notch: SCENE.notch`, `screenHeight: SCENE.height`, `dockHeight: 0`, `clock` (default `AppClock.now`
  through the index), `calendar` (default `currentCalendar()`), `locale` default `'en-US'` (contracts §8.2), `reduceMotion`
  (default `useMediaQuery('(prefers-reduced-motion: reduce)')`), `cursor: cursorRef`, `shortcutsEnabled: focusInside`,
  `sceneScale: pt`, `notchOrigin: SCENE.notchOrigin`, `onSaved`, `onStateChange` (stores only `phase.type`, `schedule`,
  `openedOnce`, `savedItems` in React state; sets them only when they change). Behaviour:
  - `onPointerDownCapture`: when the target is not inside a focusable element in the scene, `root.focus({ preventScroll: true })`;
    when `phase` is open or saving and the target is outside `[data-desktop-slot="notch"]` and outside the menu-bar menu →
    `handle.hide()` (landing §5.3 click outside; clicks on the page around the desktop are not "the screen" and do nothing).
  - `onFocus`/`onBlur` (capture) keep `focusInside` (blur with `relatedTarget` outside the root clears it).
  - `onKeyDown` (bubble): return when `e.defaultPrevented`; `action = shortcutFor(e, { state: handle.getState(), focus: focusTargetOf(document.activeElement) })`;
    when non-null → `e.preventDefault()` and `performShortcut(action, handle, { typed: (document.activeElement as HTMLInputElement | null)?.value })`.
  - When `phase` turns `closed` while `focusInside` and the active element is inside the slot or is `body` → `root.focus({ preventScroll: true })`.
  - Hint: `visible = hintEnabled !== false && !openedOnce`, `onOpen = () => handle.show({ source: 'click' })`.
  - Fake cursor `idleOpacity`: 0.4 until `openedOnce`, then 0 ("a faint fake cursor", landing §6); `cursor.hide()` on `pointerenter` of the root
    (the visitor's own pointer is there), `cursor.show()` on `pointerleave`.
  - MenuBar `onShowPanel = () => handle.show({ source: 'click' })`; `timeZone = calendar.timeZone`; clock locale `navigator.language`.
- [ ] **Step 6: Run** — expected PASS.
- [ ] **Step 7: Commit.** `git add src/desktop/DesktopScene.tsx tests/fakes/fakeRecreationHandle.ts tests/fakes/recreationMock.tsx tests/desktop/desktopScene.test.tsx && git commit -m "feat(desktop): assemble the desktop scene with focus and shortcut routing"`

---

### Task C9: MacBook frame (CSS/SVG)

**Files:**
- Create: `src/app/MacBookFrame.tsx`
- Test: `tests/app/macBookFrame.test.tsx`

**Interfaces:**
- Consumes: `ptCss` (C2).
- Produces:
  ```ts
  /** 14" MacBook Pro proportions in scene points, around the 1512 × 982 screen (landing §10, author's drawing). */
  export const FRAME: { readonly bezelSide: 18; readonly bezelTop: 18; readonly chin: 36; readonly lidWidth: 1548; readonly lidHeight: 1036;
    readonly lidRadiusTop: 36; readonly lidRadiusBottom: 20; readonly rim: 3;
    readonly deckWidth: 1700; readonly deckHeight: 34; readonly deckRadiusBottom: 24; readonly scoopWidth: 240; readonly scoopHeight: 9 };
  /** Rounded rectangle with separate top / bottom radii, arcs: `M rt 0 H w−rt A rt rt 0 0 1 w rt V h−rb A rb rb 0 0 1 w−rb h H rb A rb rb 0 0 1 0 h−rb V rt A rt rt 0 0 1 rt 0 Z`. */
  export function roundedRectPath(w: number, h: number, rTop: number, rBottom: number): string;
  export const FRAME_COLORS: { readonly light: { bezel: '#0B0B0C'; rim: '#A7AAB0'; deckTop: '#DADCE0'; deckBottom: '#A4A7AD'; scoop: '#B9BCC1' };
    readonly dark: { bezel: '#0B0B0C'; rim: '#4A4B4F'; deckTop: '#45464A'; deckBottom: '#222326'; scoop: '#2A2B2E' } };
  export interface MacBookFrameProps { drawIn: number /* 0…1 */; scheme: 'light' | 'dark' }
  export const MacBookFrame: ForwardRefExoticComponent<MacBookFrameProps & RefAttributes<SVGSVGElement>>;
  export function applyDrawIn(svg: SVGSVGElement, drawIn: number): void;   // per-frame write used by the Stage (no React render)
  ```

- [ ] **Step 1: Write the failing test** `tests/app/macBookFrame.test.tsx` (jsdom):
  ```ts
  it('roundedRectPath', () => expect(roundedRectPath(100, 50, 10, 5)).toBe('M10 0H90A10 10 0 0 1 100 10V45A5 5 0 0 1 95 50H5A5 5 0 0 1 0 45V10A10 10 0 0 1 10 0Z'));
  it('lid = screen + bezels', () => { expect(FRAME.lidWidth).toBe(1512 + 2 * FRAME.bezelSide); expect(FRAME.lidHeight).toBe(982 + FRAME.bezelTop + FRAME.chin); });
  it('draws the lid around the screen origin and the deck below it', () => {
    /* render drawIn 1: svg aria-hidden; style left ptCss(-18), top ptCss(-18); [data-lid] d === roundedRectPath(1548, 1036, 36, 20);
       [data-deck] x = (1548 − 1700) / 2 = -76, y = 1036, width 1700, height 34 */
  });
  it('drawIn traces the rim and fades the fills', () => {
    /* render drawIn 0.25: [data-rim] pathLength '1', stroke-dasharray '1', stroke-dashoffset '0.75'; [data-lid] fill-opacity '0.25'; [data-deck] opacity '0.25' */
  });
  it('applyDrawIn updates the same attributes', () => { /* applyDrawIn(svg, 0.6) → dashoffset '0.4' */ });
  it('uses the dark palette for scheme dark', () => { /* [data-rim] stroke '#4A4B4F' */ });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/app/macBookFrame.test.tsx` — expected FAIL.
- [ ] **Step 3: Implement.** One SVG positioned at scene (−18, −18) pt, `width ptCss(1700)`, `height ptCss(1036 + 34)`,
  `viewBox="-76 0 1700 1070"`, `overflow: visible`, `pointer-events: none`, behind the scene (z-index −1 inside the camera
  layer). Lid fill `bezel`; rim = the lid path stroked `rim` colour, width 3, `pathLength=1`; deck = path
  `roundedRectPath(1700, 34, 0, 24)` translated to (−76, 1036) with a vertical linear gradient `deckTop → deckBottom`;
  scoop = `roundedRectPath(240, 9, 0, 9)` centred on the deck top, fill `scoop`.
- [ ] **Step 4: Run** — expected PASS.
- [ ] **Step 5: Commit.** `git add src/app/MacBookFrame.tsx tests/app/macBookFrame.test.tsx && git commit -m "feat(page): draw the MacBook frame in SVG"`

---

### Task C10: Stage camera (pure)

**Files:**
- Create: `src/app/stageCamera.ts`
- Test: `tests/app/stageCamera.test.ts`

**Interfaces:**
- Consumes: `NotchLayout.scheduleCalendarSize` from `src/recreation/machine/notchLayout.ts` (contracts §5.1); `FRAME` (C9).
- Produces (contracts §4.6 + cross-area note 5):
  ```ts
  export interface Viewport { readonly width: number; readonly height: number }
  export interface Camera { readonly scale: number; readonly originX: number; readonly originY: number; readonly translateX: number; readonly translateY: number; readonly frameOpacity: number; readonly pageReveal: number }
  export const CAMERA: { readonly phoneBreakpoint: 810; readonly pinnedColumnRatio: 0.58; readonly featuresVisibleWidthPt: 760; readonly minFeaturesPt: 0.75;
    readonly featuresNotchTopPx: 64; readonly featuresBottomAirPx: 24; readonly overviewProgress: 0.625; readonly overviewScaleRatio: 0.62;
    readonly overviewCenterYRatio: 0.42; readonly runwayVh: 160; readonly phoneGutterPx: 16; readonly phoneTopPx: 64; readonly phoneBottomPx: 16 };
  export function pinnedColumnWidth(viewport: Viewport): number;                   // round(width · 0.58); phone → width
  export function heroPt(viewport: Viewport): number;                              // min(w / 1512, h / 982)
  export function featuresPt(pinnedColumnWidth: number): number;                   // clamp(col / 760, 0.75, 1)
  /** featuresPt clamped again so the tallest panel (calendar) fits under the notch: max(0.75, min(featuresPt(col), (h − 64 − 24) / NotchLayout.scheduleCalendarSize.height)). */
  export function featuresScale(viewport: Viewport, pinnedColumnWidth: number): number;
  export function cameraFor(progress: number, viewport: Viewport, pinnedColumnWidth: number): Camera;
  export function renderPtFor(viewport: Viewport, pinnedColumnWidth: number): number;   // phone: phone scale; else max(heroPt, featuresScale)
  export function clipFor(progress: number, viewport: Viewport, pinnedColumnWidth: number): { readonly right: number };
  export function titleOpacityFor(progress: number): number;
  export function phoneStageHeight(viewportWidth: number): number;                 // 64 + (1036 + 34) · s + 16, s = (w − 32) / 1548
  export function cameraTransform(camera: Camera, renderPt: number): string;       // `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${(scale / renderPt).toFixed(5)})`
  ```
  Algorithm (the tests pin it): three keyframes `K = { s, nx, ny }` where (nx, ny) is where the notch top-centre
  (scene 756, 0) lands in the viewport, `translateX = nx − 756 · s`, `translateY = ny`, `originX = nx`, `originY = ny`
  (transform-origin of the camera layer is `0 0`; the notch is the visual origin, landing §11.1).
  K0 hero: `s = heroPt`, `nx = w / 2`, `ny = (h − 982 s) / 2` (letterboxed). K1 overview (landing §7.2 "~62 %"):
  `s = 0.62 · heroPt`, `nx = w / 2`, `ny = 0.42 h − 491 s`. K2 features: `s = featuresScale`, `nx = col / 2`, `ny = 64`.
  `p ≤ 0.625`: lerp K0→K1 with `t = p / 0.625`, `frameOpacity = pageReveal = t`; else lerp K1→K2 with `t = (p − 0.625) / 0.375`,
  `frameOpacity = pageReveal = 1`. `clipFor`: `right = (w − col) · t` in the second segment, else 0.
  Phone (`w < 810`): progress ignored, `s = (w − 32) / 1548`, `nx = w / 2`, `ny = 64 + 18 s`, frame and reveal 1, clip 0.
  `titleOpacityFor`: 0 until 0.35, linear to 1 at 0.55, 1 until 0.7, linear to 0 at 0.85, then 0.

- [ ] **Step 1: Write the failing test** `tests/app/stageCamera.test.ts`:
  ```ts
  const V1440 = { width: 1440, height: 900 }, V1280 = { width: 1280, height: 800 }, V1920 = { width: 1920, height: 1080 }, V1024 = { width: 1024, height: 700 }, V390 = { width: 390, height: 844 };
  const close = (c: Camera, e: Partial<Record<keyof Camera, number>>) => Object.entries(e).forEach(([k, v]) => expect(c[k as keyof Camera]).toBeCloseTo(v!, 3));
  it('pinned column is 58 % on desktop, full width on phones', () => { expect(pinnedColumnWidth(V1440)).toBe(835); expect(pinnedColumnWidth(V1280)).toBe(742); expect(pinnedColumnWidth(V390)).toBe(390); });
  it('heroPt letterboxes the 16:10 screen', () => { expect(heroPt(V1440)).toBeCloseTo(0.916497, 6); expect(heroPt(V1920)).toBeCloseTo(1.099796, 6); expect(heroPt(V1024)).toBeCloseTo(0.677249, 6); });
  it('featuresPt is 1 px per pt, clamped to [0.75, 1]', () => { expect(featuresPt(835)).toBe(1); expect(featuresPt(742)).toBeCloseTo(0.976316, 6); expect(featuresPt(500)).toBe(0.75); });
  it('featuresScale also fits the calendar height', () => {
    expect(featuresScale(V1440, 835)).toBe(1);
    expect(featuresScale({ width: 1440, height: 600 }, 835)).toBeCloseTo(Math.max(0.75, 512 / NotchLayout.scheduleCalendarSize.height), 6);
    expect(featuresScale({ width: 1440, height: 500 }, 835)).toBe(0.75);
  });
  it('1440 × 900 hero', () => close(cameraFor(0, V1440, 835), { scale: 0.916497, originX: 720, originY: 0, translateX: 27.1283, translateY: 0, frameOpacity: 0, pageReveal: 0 }));
  it('1440 × 900 halfway to the overview', () => close(cameraFor(0.3125, V1440, 835), { scale: 0.742363, originX: 720, originY: 49.5, translateX: 158.7739, frameOpacity: 0.5, pageReveal: 0.5 }));
  it('1440 × 900 overview', () => close(cameraFor(0.625, V1440, 835), { scale: 0.568228, originX: 720, originY: 99, translateX: 290.4196, frameOpacity: 1 }));
  it('1440 × 900 halfway to the notch', () => close(cameraFor(0.8125, V1440, 835), { scale: 0.784114, originX: 568.75, originY: 81.5, translateX: -24.0402 }));
  it('1440 × 900 features: 1 px per pt, notch at the column centre, 64 px down', () => close(cameraFor(1, V1440, 835), { scale: 1, originX: 417.5, originY: 64, translateX: -338.5, translateY: 64, frameOpacity: 1, pageReveal: 1 }));
  it('1280 × 800 features', () => close(cameraFor(1, V1280, 742), { scale: 0.976316, originX: 371, translateX: -367.0947 }));
  it('1920 × 1080 hero and features', () => { close(cameraFor(0, V1920, 1114), { scale: 1.099796, translateX: 128.554, translateY: 0 }); close(cameraFor(1, V1920, 1114), { scale: 1, originX: 557, translateX: -199 }); });
  it('1024 × 700 features keep the 0.75 floor out of reach', () => close(cameraFor(1, V1024, 594), { scale: 0.781579, translateX: -293.8737 }));
  it('progress is clamped', () => { expect(cameraFor(-1, V1440, 835)).toEqual(cameraFor(0, V1440, 835)); expect(cameraFor(2, V1440, 835)).toEqual(cameraFor(1, V1440, 835)); });
  it('phones ignore progress', () => { const c = cameraFor(0.4, V390, 390); close(c, { scale: 0.231266, originX: 195, originY: 68.1628, translateX: 20.1628, frameOpacity: 1, pageReveal: 1 }); expect(cameraFor(1, V390, 390)).toEqual(c); });
  it('renderPtFor is the sharper of hero and features', () => { expect(renderPtFor(V1440, 835)).toBe(1); expect(renderPtFor(V1920, 1114)).toBeCloseTo(1.099796, 6); expect(renderPtFor(V390, 390)).toBeCloseTo(0.231266, 6); });
  it('clipFor crops to the pinned column in the second half', () => { expect(clipFor(0.5, V1440, 835).right).toBe(0); expect(clipFor(0.8125, V1440, 835).right).toBeCloseTo(302.5, 6); expect(clipFor(1, V1440, 835).right).toBe(605); expect(clipFor(1, V390, 390).right).toBe(0); });
  it('titleOpacityFor', () => { expect(titleOpacityFor(0.3)).toBe(0); expect(titleOpacityFor(0.45)).toBeCloseTo(0.5, 6); expect(titleOpacityFor(0.6)).toBe(1); expect(titleOpacityFor(0.775)).toBeCloseTo(0.5, 6); expect(titleOpacityFor(0.9)).toBe(0); });
  it('phoneStageHeight', () => expect(phoneStageHeight(390)).toBeCloseTo(64 + 1070 * (358 / 1548) + 16, 6));
  it('cameraTransform', () => expect(cameraTransform(cameraFor(0, V1440, 835), 1)).toBe('translate3d(27.13px, 0.00px, 0) scale(0.91650)'));
  ```
- [ ] **Step 2: Run** `npx vitest run tests/app/stageCamera.test.ts` — expected FAIL.
- [ ] **Step 3: Implement** `src/app/stageCamera.ts` per Produces and the algorithm.
- [ ] **Step 4: Run** — expected PASS.
- [ ] **Step 5: Commit.** `git add src/app/stageCamera.ts tests/app/stageCamera.test.ts && git commit -m "feat(page): add the hero-to-features stage camera"`

---

### Task C11: Stage (sticky track, GSAP scrub camera, hero title, phone layout, reduced motion)

**Files:**
- Create: `src/app/Stage.tsx`
- Test: `tests/app/stage.test.tsx`

**Interfaces:**
- Consumes: C1 `gsap`, `ScrollTrigger`, `MOTION_TIME_SCALE`; C4 `useMediaQuery`, `useColorScheme`; C8 `DesktopScene`;
  C9 `MacBookFrame`, `applyDrawIn`; C10 everything; `AppClock`, `Clock` from `src/recreation/clock.ts`;
  `currentCalendar`, `Calendar` from `src/recreation/core/calendar.ts`; `HERO_COPY` from C16 is not yet available, so the
  title strings are passed in from App (C20) through props.
- Produces:
  ```ts
  export interface StageContextValue { recreationRef: RefObject<RecreationHandle | null>; cursorRef: RefObject<FakeCursorHandle | null>; clock: Clock; calendar: Calendar }
  export function useStage(): StageContextValue;            // throws outside <Stage>
  export interface StageProps { title: string; subtitle: string; children?: ReactNode /* the features column */ }
  export function Stage(props: StageProps): JSX.Element;
  // DOM contract used by e2e: [data-stage-track] > [data-stage] (sticky ≥ 810) > [data-clip] > [data-camera] > (MacBookFrame, DesktopScene);
  //   [data-runway] (160svh, pointer-events none); [data-features-column]; h1[data-hero-title]
  ```

- [ ] **Step 1: Write the failing test** `tests/app/stage.test.tsx` (jsdom; `vi.mock('../../src/app/gsap', () => import('../fakes/gsapMock'))`;
  `vi.mock('../../src/recreation', () => import('../fakes/recreationMock'))`; `installMatchMedia`; set `window.innerWidth/innerHeight`):
  ```ts
  it('≥ 810 px: sticky full-height stage, 160svh runway that ignores the pointer, 58 % column', () => {
    installMatchMedia({ '(min-width: 810px)': true }); innerSize(1440, 900); render(<Stage title="T" subtitle="S"><p>copy</p></Stage>);
    const stage = document.querySelector<HTMLElement>('[data-stage]')!;
    expect(stage.style.position).toBe('sticky'); expect(stage.style.top).toBe('0px'); expect(stage.style.height).toBe('100svh');
    const runway = document.querySelector<HTMLElement>('[data-runway]')!; expect(runway.style.height).toBe('160svh'); expect(runway.style.marginTop).toBe('-100svh'); expect(runway.style.pointerEvents).toBe('none');
    const col = document.querySelector<HTMLElement>('[data-features-column]')!; expect(col.style.marginLeft).toBe('58%'); expect(col.style.width).toBe('42%');
  });
  it('applies the hero camera before paint (no layout shift)', () => {
    /* 1440×900, scrollY 0: [data-camera] style.transform === 'translate3d(27.13px, 0.00px, 0) scale(0.91650)'; transform-origin '0 0' */
  });
  it('renders the desktop at renderPt', () => { /* lastRecreation.props.sceneScale === 1; application root --pt '1' */ });
  it('creates one scrubbed ScrollTrigger on the runway', () => {
    /* ScrollTrigger.create called with { trigger: runway, start: 'top top', end: 'bottom top', scrub: true, onUpdate: fn };
       calling onUpdate({ progress: 1 }) → camera transform 'translate3d(-338.50px, 64.00px, 0) scale(1.00000)', [data-clip] clip-path 'inset(0px 605px 0px 0px)',
       [data-stage] style --reveal '1', title opacity '0' */
  });
  it('reduced motion snaps the camera at half progress but fades the title by raw progress', () => {
    /* '(prefers-reduced-motion: reduce)': true; onUpdate({ progress: 0.45 }) → transform equals cameraFor(0, …); onUpdate({ progress: 0.6 }) → equals cameraFor(1, …); title opacity '1' at 0.6 */
  });
  it('< 810 px: static block of phoneStageHeight, title below, no ScrollTrigger', () => {
    /* '(min-width: 810px)': false, innerSize(390, 844): [data-stage] style.position 'relative', height `${phoneStageHeight(390)}px`;
       ScrollTrigger.create not called; [data-features-column] marginLeft ''; h1 is after [data-stage] in DOM order */
  });
  it('the hero title is an h1 with the given copy', () => { /* getByRole('heading', { level: 1, name: 'T' }) */ });
  it('useStage exposes the refs to children', () => { /* child calls useStage(); recreationRef.current === lastRecreation.handle after mount */ });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/app/stage.test.tsx` — expected FAIL.
- [ ] **Step 3: Implement `Stage`.** Owns `recreationRef`, `cursorRef`, `clock = AppClock.now`, `calendar = currentCalendar()`
  (stable via `useRef`) and provides them through `StageContext`. Viewport: `{ innerWidth, innerHeight }` read in the
  `useState` initialiser, updated on `resize` (rAF-throttled); `col = pinnedColumnWidth(viewport)`; `renderPt =
  renderPtFor(viewport, col)` passed as `DesktopScene pt` and `timeScale={MOTION_TIME_SCALE}`. Per-frame writes go
  straight to refs (no React render): `[data-camera].style.transform = cameraTransform(cam, renderPt)`,
  `applyDrawIn(frame, cam.frameOpacity)`, `[data-clip].style.clipPath = inset(0px ${right}px 0px 0px)`,
  `[data-stage].style.setProperty('--reveal', String(cam.pageReveal))`, title `opacity = titleOpacityFor(p)`.
  `useLayoutEffect` applies `cameraFor(progressFromScroll(), …)` once before paint, where
  `progressFromScroll = clamp(scrollY / (1.6 · innerHeight), 0, 1)`. On ≥ 810 px an effect creates
  `ScrollTrigger.create({ trigger: runway, start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true, onUpdate })`
  and kills it on cleanup or breakpoint change; reduced motion passes `p < 0.5 ? 0 : 1` to the camera (snap, no zoom
  motion) and the raw `p` to the title. Stage background: `background-color: color-mix(in srgb, var(--jh-white) calc(var(--reveal) * 100%), var(--jh-black))`
  (hero letterbox is black, the page white reveals, landing §7.2); `overflow: hidden`. Hero title overlay (≥ 810):
  `position: absolute; inset-inline: 0; bottom: 7svh; text-align: center; pointer-events: none`, h1 `var(--jh-text-h2)` 32 px 600
  `var(--jh-leading-heading)`, subtitle `var(--jh-text-body-l)` 18 px 500 `var(--jh-muted)`. Phone: h1 24 px 600 in normal flow
  below the stage block (landing §7.2 "24 semibold → Heading 2 M"), padding `24px var(--jh-page-margin-x) 0`.
  Track (≥ 810): `[data-stage-track]` relative; `[data-stage]` sticky top 0, height 100svh; `[data-runway]` 160svh,
  margin-top −100svh, pointer-events none; `[data-features-column]` margin-left 58 %, width 42 %, position relative,
  z-index 10. Phone: stage block `position: relative; height: phoneStageHeight(w)px`, then title, then the column at full width.
  The camera layer: `position: absolute; left: 0; top: 0; transform-origin: 0 0; will-change: transform`; inside it the
  frame SVG then `DesktopScene` at (0, 0).
- [ ] **Step 4: Run** — expected PASS.
- [ ] **Step 5: Commit.** `git add src/app/Stage.tsx tests/app/stage.test.tsx && git commit -m "feat(page): add the pinned stage with the scrubbed camera"`

---

### Task C12: Scroll progress bar and floating nav

**Files:**
- Create: `src/app/ScrollProgress.tsx`, `src/app/Nav.tsx`
- Test: `tests/app/navAndProgress.test.tsx`

**Interfaces:**
- Consumes: C1 `ScrollTrigger`; C10 `heroPt`, `CAMERA.phoneBreakpoint`; `LINKS` is defined here and re-used by C16–C19.
- Produces:
  ```ts
  // src/app/ScrollProgress.tsx
  export function progressTransform(progress: number): string;   // `scaleX(${clamp01(p)})`
  export function ScrollProgress(): JSX.Element;                  // fixed, top 0, height var(--jh-progress-height) 2px, bg var(--jh-accent), aria-hidden
  // src/app/Nav.tsx
  export const LINKS: { readonly appRepo: 'https://github.com/holecjakub/QuickReminder'; readonly releasesLatest: 'https://github.com/holecjakub/QuickReminder/releases/latest';
    readonly siteRepo: 'https://github.com/holecjakub/quickreminder.jholec.com'; readonly jholec: 'https://jholec.com';
    readonly notice: 'https://github.com/holecjakub/QuickReminder/blob/main/NOTICE.md'; readonly license: 'https://github.com/holecjakub/QuickReminder/blob/main/LICENSE';
    readonly raycastScript: 'https://github.com/holecjakub/QuickReminder/tree/main/Scripts/raycast' };
  /** ≥ 810: on the desktop's top-right, under its menu bar: top = sceneTop + 38 · heroPt + 12, right = sceneGapX + 16; phone: { top: 12, right: 16 }. */
  export function navPosition(viewport: Viewport): { top: number; right: number };
  export const NAV_HIDE_AFTER_VH: 0.6;
  export function Nav(): JSX.Element;   // <nav aria-label="Primary">: "GitHub" → LINKS.appRepo, "Download" → "#download"
  ```

- [ ] **Step 1: Write the failing test** `tests/app/navAndProgress.test.tsx` (jsdom; gsap mocked):
  ```ts
  it('progressTransform', () => { expect(progressTransform(0.5)).toBe('scaleX(0.5)'); expect(progressTransform(1.2)).toBe('scaleX(1)'); expect(progressTransform(-1)).toBe('scaleX(0)'); });
  it('ScrollProgress is a 2 px decorative bar driven by a page-long ScrollTrigger', () => {
    /* aria-hidden="true"; style height 'var(--jh-progress-height)'; transform-origin '0 50%' or 'left';
       ScrollTrigger.create called with { start: 0, end: 'max', onUpdate }; onUpdate({ progress: 0.25 }) → style.transform 'scaleX(0.25)' */
  });
  it('navPosition 1920 × 1080', () => { const p = navPosition({ width: 1920, height: 1080 }); expect(p.top).toBeCloseTo(53.792, 3); expect(p.right).toBeCloseTo(144.554, 3); });
  it('navPosition 1440 × 900', () => { const p = navPosition({ width: 1440, height: 900 }); expect(p.top).toBeCloseTo(46.827, 3); expect(p.right).toBeCloseTo(43.128, 3); });
  it('navPosition phone', () => expect(navPosition({ width: 390, height: 844 })).toEqual({ top: 12, right: 16 }));
  it('Nav links', () => { /* getByRole('link', { name: 'GitHub' }) href LINKS.appRepo; getByRole('link', { name: 'Download' }) href '#download' */ });
  it('Nav hides once the page is scrolled past 0.6 viewport heights', () => {
    /* innerHeight 900; scrollY 541 + dispatch scroll → nav data-hidden="true", style pointer-events none, opacity '0'; links tabIndex -1 */
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/app/navAndProgress.test.tsx` — expected FAIL.
- [ ] **Step 3: Implement.** Pill: height 36 px, padding 0 6 px, radius 999 px, `rgba(10, 10, 10, 0.72)` with `backdrop-filter: blur(20px)`,
  links 14 px 500 white, padding 0 14 px, a `·` separator white 50 %, `position: fixed`, z-index 50; hidden state opacity 0,
  `translateY(-8px)` (omitted under reduced motion), 200 ms ease-out. Scroll listener passive. Progress bar z-index 100,
  `transform-origin: 0 50%`.
- [ ] **Step 4: Run** — expected PASS.
- [ ] **Step 5: Commit.** `git add src/app/ScrollProgress.tsx src/app/Nav.tsx tests/app/navAndProgress.test.tsx && git commit -m "feat(page): add the scroll progress bar and the floating nav"`

---

### Task C13: Section snapshots and the demo reminder

**Files:**
- Create: `src/app/choreography/snapshot.ts`, `src/app/choreography/demo.ts`
- Test: `tests/app/choreography/snapshot.test.ts`

**Interfaces:**
- Consumes: `NaturalDateParser.parse` (contracts §2.2), `ScheduleDefaults.resolveDayOnly` (§2.3), `DatePresets.date` (§2.4),
  `Calendar`, `PresetPick`, `DatePreset`, `ListId`, `ScheduleExpansion` (core/machine); `pragueCalendar`, `prague` (tests/support.ts).
- Produces (contracts §4.4, exact): `SectionId`, `SectionAction`, `DueSpec`, `SectionSnapshot`, `resolveDue` in `snapshot.ts`;
  `DEMO_REMINDER`, `SECTION_SNAPSHOTS` in `demo.ts`; plus
  ```ts
  export const SECTION_ORDER: readonly SectionId[];          // ['hero', '01', '02', '03', '04', '05', '06', '07']
  export function previousSection(id: SectionId): SectionId; // '01' → 'hero'; 'hero' → 'hero'
  ```
  `SECTION_SNAPSHOTS` (landing §7, §11.2; `PHRASE = { type: 'phrase', text: 'tomorrow at 2pm' }`; unlisted fields: `schedule 'none'`,
  `notes ''`, `listId 'reminders'`, `flagged false`, `location null`, `due null`, `saved false`):

  | id | panel | schedule | title | listId | flagged | location | due | saved | action | extras |
  |---|---|---|---|---|---|---|---|---|---|---|
  | hero | closed | none | '' | reminders | false | null | null | false | close | |
  | 01 | open | none | '' | reminders | false | null | null | false | open | |
  | 02 | open | none | 'Call mum' | reminders | false | null | PHRASE | false | typeTitle | `typedTitle 'Call mum tomorrow at 2pm'`, `applyDelayMs 900` |
  | 03 | open | calendar | 'Call mum' | reminders | false | null | PHRASE | false | schedule | `highlightPreset 'tomorrow'` |
  | 04 | open | none | 'Call mum' | work | false | null | PHRASE | false | lists | `listCycle ['reminders', 'work', 'home', 'work']` |
  | 05 | open | none | 'Call mum' | work | true | 'Office' | PHRASE | false | flagLocation | |
  | 06 | closed | none | 'Call mum' | work | true | 'Office' | PHRASE | true | save | |
  | 07 | closed | none | 'Call mum' | work | true | 'Office' | PHRASE | true | none | |

- [ ] **Step 1: Write the failing test** `tests/app/choreography/snapshot.test.ts`:
  ```ts
  const NOW = prague(2026, 10, 23, 10, 0);   // Friday
  it('DEMO_REMINDER', () => expect(DEMO_REMINDER).toEqual({ typed: 'Call mum tomorrow at 2pm', title: 'Call mum', phrase: 'tomorrow at 2pm', czechExample: 'zavolat mámě zítra ve 14:00', listId: 'work', location: 'Office', flagged: true }));
  it('typed = title + " " + phrase', () => expect(`${DEMO_REMINDER.title} ${DEMO_REMINDER.phrase}`).toBe(DEMO_REMINDER.typed));
  it('every snapshot is keyed by its id, in SECTION_ORDER', () => { expect(Object.keys(SECTION_SNAPSHOTS)).toEqual([...SECTION_ORDER]); SECTION_ORDER.forEach(id => expect(SECTION_SNAPSHOTS[id].id).toBe(id)); });
  it('pins the table', () => {
    expect(SECTION_SNAPSHOTS.hero).toEqual({ id: 'hero', panel: 'closed', schedule: 'none', title: '', notes: '', listId: 'reminders', flagged: false, location: null, due: null, saved: false, action: 'close' });
    expect(SECTION_SNAPSHOTS['02']).toEqual({ id: '02', panel: 'open', schedule: 'none', title: 'Call mum', typedTitle: 'Call mum tomorrow at 2pm', notes: '', listId: 'reminders', flagged: false, location: null, due: { type: 'phrase', text: 'tomorrow at 2pm' }, saved: false, action: 'typeTitle', applyDelayMs: 900 });
    expect(SECTION_SNAPSHOTS['03']).toMatchObject({ schedule: 'calendar', action: 'schedule', highlightPreset: 'tomorrow' });
    expect(SECTION_SNAPSHOTS['04']).toMatchObject({ listId: 'work', action: 'lists', listCycle: ['reminders', 'work', 'home', 'work'] });
    expect(SECTION_SNAPSHOTS['05']).toMatchObject({ listId: 'work', flagged: true, location: 'Office', action: 'flagLocation' });
    expect(SECTION_SNAPSHOTS['06']).toMatchObject({ panel: 'closed', saved: true, action: 'save', title: 'Call mum', listId: 'work', flagged: true, location: 'Office' });
    expect(SECTION_SNAPSHOTS['07']).toMatchObject({ panel: 'closed', action: 'none' });
  });
  it('04 ends its cycle on the demo list, and 05–07 keep it', () => {
    const cycle = SECTION_SNAPSHOTS['04'].listCycle!; expect(cycle.at(-1)).toBe(SECTION_SNAPSHOTS['04'].listId);
    for (const id of ['05', '06', '07'] as const) expect(SECTION_SNAPSHOTS[id].listId).toBe(DEMO_REMINDER.listId);
  });
  it('previousSection', () => { expect(previousSection('01')).toBe('hero'); expect(previousSection('06')).toBe('05'); expect(previousSection('hero')).toBe('hero'); });
  describe('resolveDue', () => {
    it('null → null', () => expect(resolveDue(null, NOW, pragueCalendar)).toBeNull());
    it('phrase with a time', () => expect(resolveDue({ type: 'phrase', text: 'tomorrow at 2pm' }, NOW, pragueCalendar)).toEqual({ date: prague(2026, 10, 24, 14, 0), presetPick: null }));
    it('day-only phrase goes through resolveDayOnly (9:00)', () => expect(resolveDue({ type: 'phrase', text: 'tomorrow' }, NOW, pragueCalendar)).toEqual({ date: prague(2026, 10, 24, 9, 0), presetPick: null }));
    it('preset carries its pick', () => { const d = prague(2026, 10, 24, 9, 0); expect(resolveDue({ type: 'preset', preset: 'tomorrow' }, NOW, pragueCalendar)).toEqual({ date: d, presetPick: { preset: 'tomorrow', date: d } }); });
    it('unparseable phrase → null', () => expect(resolveDue({ type: 'phrase', text: 'whenever' }, NOW, pragueCalendar)).toBeNull());
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/app/choreography/snapshot.test.ts` — expected FAIL.
- [ ] **Step 3: Implement** both files (`resolveDue`: phrase → `NaturalDateParser.parse(text, now, cal)`, `hasTime ? date :
  ScheduleDefaults.resolveDayOnly(date, now, cal)`; preset → `DatePresets.date(preset, now, cal)` with `presetPick { preset, date }`).
- [ ] **Step 4: Run** — expected PASS.
- [ ] **Step 5: Commit.** `git add src/app/choreography/snapshot.ts src/app/choreography/demo.ts tests/app/choreography/snapshot.test.ts && git commit -m "feat(choreography): add the section snapshots and the demo reminder"`

---

### Task C14: Reconciler

**Files:**
- Create: `src/app/choreography/reconcile.ts`
- Test: `tests/app/choreography/reconcile.test.ts`

**Interfaces:**
- Consumes: C13 everything; C1 `scaleMs`; `isSameMinute` (contracts §2.1); `RecreationHandle`, `RecreationState`, `PointerTarget`
  (contracts §3.2); `FakeCursorHandle` (C3); `FakeRecreationHandle` (C8, tests).
- Produces (contracts §4.4, exact): `ReconcileOptions`, `ReconcileResult`, `reconcile`; plus
  ```ts
  export const RECONCILE_TIMING: { readonly scheduleRowsMs: 420 /* 0.06 + 3 · 0.035 + 0.24 s stagger, contracts §7 */;
    readonly presetHoverMs: 450; readonly listOpenMs: 220; readonly listStepMs: 380; readonly flagToLocationMs: 300 };
  ```
  Rules (landing §11.2; the tests pin them; `visible` = phase open or saving; `keep` = `getState().dirty` at start;
  `instant` = `opts.cps === Infinity`: no cursor, no sleeps, `setTitle` instead of `typeTitle`, `setLocation` instead of `typeLocation`;
  every sleep is `scaleMs(ms)` and rejects on `opts.signal`; `opts.signal` abort → `handle.cancel()` and `opts.cursor?.cancel()`;
  any `AbortError` → `{ performed, keptVisitorEdits: keep, aborted: true }`; `show` always gets `{ source: 'scroll' }`):
  1. `direction 'up'`: action `close` with `visible && !keep` → `await hide()`, performed `close`; anything else → performed `none`, no calls.
  2. action `none` → performed `none`, no calls.
  3. Panel: snapshot `open` (or action `save`) and not visible → `await show({ source: 'scroll' })`, then `markClean()` and `keep = false`
     (show resets the draft). Action `close`: `visible && !keep` → `await hide()`, done. Snapshot `closed`, action ≠ save, visible → `void hide()`.
  4. Close `listPicker` unless action `lists`; close `locationPopover` unless action `flagLocation`; `schedule !== 'none'` and action ≠ `schedule` → `cancelSchedule()`.
  5. Unless `keep`, write fields that differ, in this order: `setList(action === 'lists' ? listCycle[0] : listId)`;
     `setFlag(action === 'flagLocation' ? false : flagged)`; `setLocation(action === 'flagLocation' ? null : location)`; `setNotes(notes)`;
     title + due: action `typeTitle` → `setDueDate(null)`, `setTitle('')`; else `setTitle(title)` and `resolveDue(due)` →
     `setDueDate(date, presetPick)` unless `isSameMinute(calendar, current, date)` (null vs null equal). Then `markClean()` (only when not `keep`).
  6. Action: `open` → nothing more. `typeTitle` → keep: none; else `await typeTitle(typedTitle, cps)`, sleep `applyDelayMs`, `applySuggestion()`, `markClean()`.
     `schedule` → `openSchedule()`, sleep 420, cursor: `await pointerTo('preset:' + highlightPreset)`, sleep 450, `openCalendar()`.
     `lists` → keep: none; else for each id of `listCycle.slice(1)`: cursor `await pointerTo('header', { click: true })`, `openListPicker()`, sleep 220,
     cursor `await pointerTo('list:' + id, { click: true })`, `setList(id)`, sleep 380; then `markClean()`.
     `flagLocation` → keep: none; else cursor `pointerTo('flagIcon', { click: true })`, `setFlag(true)`, sleep 300, cursor `pointerTo('locationIcon', { click: true })`,
     `await typeLocation(location, cps)`, `markClean()`. `save` → `!canSave` → none; else cursor `pointerTo('save', { click: true })`, `await save()`.
  Cursor steps run only when `opts.cursor` is non-null and not instant; they use `handle.pointerTo` (the handle drives the cursor it was given).

- [ ] **Step 1: Write the failing test** `tests/app/choreography/reconcile.test.ts` (fake timers; `NOW = prague(2026, 10, 23, 10, 0)`;
  `PHRASE_DATE = prague(2026, 10, 24, 14, 0)`; `opts = (o?) => ({ now: NOW, calendar: pragueCalendar, direction: 'down', signal: new AbortController().signal, cursor: null, ...o })`;
  `run(p)` = `const r = reconcile(...); await vi.runAllTimersAsync(); return r;`):
  ```ts
  it('jumping straight to 06 fills the reminder instantly and plays only the save', async () => {
    const h = new FakeRecreationHandle({ phraseDate: PHRASE_DATE, now: NOW });
    const r = await run(reconcile(h, SECTION_SNAPSHOTS['06'], opts()));
    expect(h.methods()).toEqual(['show', 'markClean', 'setList', 'setFlag', 'setLocation', 'setTitle', 'setDueDate', 'markClean', 'save']);
    expect(h.calls[0].args).toEqual([{ source: 'scroll' }]);
    expect(h.calls.find(c => c.method === 'setDueDate')!.args).toEqual([PHRASE_DATE, null]);
    expect(r).toEqual({ performed: 'save', keptVisitorEdits: false, aborted: false });
    expect(h.getState().savedItems.map(i => [i.title, i.listId, i.flagged, i.notes])).toEqual([['Call mum', 'work', true, '📍 Office']]);
  });
  it('02 types at 18 cps, waits 900 ms, then applies the chip', async () => {
    const h = new FakeRecreationHandle({ phraseDate: PHRASE_DATE, state: { phase: { type: 'open' } } });
    const p = reconcile(h, SECTION_SNAPSHOTS['02'], opts());
    await vi.advanceTimersByTimeAsync(2100); expect(h.methods()).not.toContain('applySuggestion');
    await vi.advanceTimersByTimeAsync(300); expect(h.methods()).toEqual(['markClean', 'typeTitle', 'applySuggestion', 'markClean']);
    expect(h.calls[1].args).toEqual(['Call mum tomorrow at 2pm', 18]);
    expect((await p).performed).toBe('typeTitle'); expect(h.getState().title).toBe('Call mum'); expect(h.getState().dueDate).toEqual(PHRASE_DATE);
  });
  it('instant mode (cps Infinity) sets the title and applies at once', async () => {
    const h = new FakeRecreationHandle({ phraseDate: PHRASE_DATE, state: { phase: { type: 'open' } } });
    const r = await reconcile(h, SECTION_SNAPSHOTS['02'], opts({ cps: Infinity }));
    expect(h.methods()).toEqual(['markClean', 'setTitle', 'applySuggestion', 'markClean']); expect(r.performed).toBe('typeTitle');
  });
  it('dirty: 02 keeps the visitor title and types nothing', async () => {
    const h = new FakeRecreationHandle({ state: { phase: { type: 'open' }, title: 'Buy milk', dirty: true } });
    const r = await run(reconcile(h, SECTION_SNAPSHOTS['02'], opts()));
    expect(h.methods()).toEqual([]); expect(r).toEqual({ performed: 'none', keptVisitorEdits: true, aborted: false });
  });
  it('dirty: 03 opens Set Date and the calendar on the visitor title', async () => {
    const h = new FakeRecreationHandle({ state: { phase: { type: 'open' }, title: 'Buy milk', dirty: true } });
    const r = await run(reconcile(h, SECTION_SNAPSHOTS['03'], opts()));
    expect(h.methods()).toEqual(['openSchedule', 'openCalendar']); expect(h.getState().title).toBe('Buy milk'); expect(r.keptVisitorEdits).toBe(true);
  });
  it('03 with the cursor points at the Tomorrow preset between the two steps', async () => {
    const h = new FakeRecreationHandle({ phraseDate: PHRASE_DATE, state: { phase: { type: 'open' }, title: 'Call mum', dueDate: PHRASE_DATE } });
    await run(reconcile(h, SECTION_SNAPSHOTS['03'], opts({ cursor: {} as FakeCursorHandle })));
    expect(h.methods()).toEqual(['markClean', 'openSchedule', 'pointerTo', 'openCalendar']); expect(h.calls[2].args[0]).toBe('preset:tomorrow');
  });
  it('dirty: 06 saves the visitor reminder', async () => {
    const h = new FakeRecreationHandle({ state: { phase: { type: 'open' }, title: 'Buy milk', canSave: true, dirty: true } });
    await run(reconcile(h, SECTION_SNAPSHOTS['06'], opts())); expect(h.methods()).toEqual(['save']); expect(h.getState().savedItems[0].title).toBe('Buy milk');
  });
  it('a dirty flag left from a closed panel is cleared by show (the draft was reset)', async () => {
    const h = new FakeRecreationHandle({ phraseDate: PHRASE_DATE, state: { dirty: true } });
    const r = await run(reconcile(h, SECTION_SNAPSHOTS['04'], opts())); expect(r.keptVisitorEdits).toBe(false); expect(h.getState().listId).toBe('work');
  });
  it('04 leaves Set Date instantly, then cycles reminders → work → home → work', async () => {
    const h = new FakeRecreationHandle({ state: { phase: { type: 'open' }, schedule: 'calendar', title: 'Call mum', dueDate: PHRASE_DATE } });
    await run(reconcile(h, SECTION_SNAPSHOTS['04'], opts()));
    expect(h.methods()).toEqual(['cancelSchedule', 'markClean', 'openListPicker', 'setList', 'openListPicker', 'setList', 'openListPicker', 'setList', 'markClean']);
    expect(h.calls.filter(c => c.method === 'setList').map(c => c.args[0])).toEqual(['work', 'home', 'work']);
  });
  it('05 flags, then types Office in the location popover', async () => {
    const h = new FakeRecreationHandle({ state: { phase: { type: 'open' }, title: 'Call mum', listId: 'work', dueDate: PHRASE_DATE } });
    await run(reconcile(h, SECTION_SNAPSHOTS['05'], opts()));
    expect(h.methods()).toEqual(['markClean', 'setFlag', 'typeLocation', 'markClean']); expect(h.calls[2].args).toEqual(['Office', 18]);
    expect(h.getState()).toMatchObject({ flagged: true, location: 'Office' });
  });
  it('up into the hero closes a clean panel', async () => { const h = new FakeRecreationHandle({ state: { phase: { type: 'open' } } }); const r = await run(reconcile(h, SECTION_SNAPSHOTS.hero, opts({ direction: 'up' }))); expect(h.methods()).toEqual(['hide']); expect(r.performed).toBe('close'); });
  it('up into the hero keeps a dirty panel open', async () => { const h = new FakeRecreationHandle({ state: { phase: { type: 'open' }, dirty: true } }); expect((await run(reconcile(h, SECTION_SNAPSHOTS.hero, opts({ direction: 'up' })))).performed).toBe('none'); expect(h.methods()).toEqual([]); });
  it('up into any other section leaves content alone', async () => { const h = new FakeRecreationHandle({ state: { phase: { type: 'open' }, schedule: 'calendar' } }); await run(reconcile(h, SECTION_SNAPSHOTS['03'], opts({ direction: 'up' }))); expect(h.methods()).toEqual([]); });
  it('hero down with a closed panel and 07 are no-ops', async () => { const h = new FakeRecreationHandle(); await run(reconcile(h, SECTION_SNAPSHOTS.hero, opts())); await run(reconcile(h, SECTION_SNAPSHOTS['07'], opts())); expect(h.methods()).toEqual([]); });
  it('abort mid-typing resolves aborted and cancels the handle', async () => {
    const h = new FakeRecreationHandle({ state: { phase: { type: 'open' } } }); const ac = new AbortController();
    const p = reconcile(h, SECTION_SNAPSHOTS['02'], opts({ signal: ac.signal })); await vi.advanceTimersByTimeAsync(500); ac.abort();
    await vi.runAllTimersAsync(); expect(await p).toEqual({ performed: 'typeTitle', keptVisitorEdits: false, aborted: true }); expect(h.methods()).toContain('cancel'); expect(h.methods()).not.toContain('applySuggestion');
  });
  it('honours the motion time scale in sleeps', async () => { /* vi.doMock('../../../src/app/motionDebug', () => ({ scaleMs: (ms: number) => ms * 4 })); re-import; 02 applySuggestion not before 1334 + 3600 ms */ });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/app/choreography/reconcile.test.ts` — expected FAIL.
- [ ] **Step 3: Implement** `reconcile.ts` per the rules above.
- [ ] **Step 4: Run** — expected PASS.
- [ ] **Step 5: Commit.** `git add src/app/choreography/reconcile.ts tests/app/choreography/reconcile.test.ts && git commit -m "feat(choreography): add the snapshot reconciler with the visitor-edits rule"`

---

### Task C15: Section driver (throttled queue + ScrollTrigger hook)

**Files:**
- Create: `src/app/choreography/useSectionDriver.ts`
- Test: `tests/app/choreography/sectionQueue.test.ts`, `tests/app/choreography/useSectionDriver.test.tsx`

**Interfaces:**
- Consumes: C1 `ScrollTrigger`, `MOTION_TIME_SCALE`; C4 `useMediaQuery`; C13 `SECTION_SNAPSHOTS`, `SECTION_ORDER`, `previousSection`;
  C14 `reconcile`; `Clock`, `Calendar`; `FakeRecreationHandle` (tests).
- Produces (contracts §4.4 hook, exact) plus:
  ```ts
  export interface SectionJob { readonly id: SectionId; readonly direction: 'down' | 'up' }
  export const MAX_ACTION_MS: 2500;                              // landing §11.2 "max ~2.5 s"
  export class SectionQueue {
    constructor(opts: { run(job: SectionJob, signal: AbortSignal): Promise<unknown>; maxDurationMs?: number; timeScale?: () => number; onAbort?(): void });
    enqueue(job: SectionJob): void;   // idle → start now; running → becomes the single pending job (latest wins) and arms the deadline
    interrupt(): void;                // visitor interaction: abort the running job (pending stays)
    readonly running: SectionJob | null;
    readonly pending: SectionJob | null;
    dispose(): void;
  }
  export function useSectionDriver(args: { handle: RefObject<RecreationHandle | null>; cursor: RefObject<FakeCursorHandle | null>; clock: Clock; calendar: Calendar; enabled: boolean }):
    { register(id: SectionId, el: HTMLElement | null): void; current: SectionId };
  ```
  Deadline: when a job becomes pending, the running job may continue until `maxDurationMs × timeScale()` after it
  started; then the queue aborts it (`AbortController.abort()` + `onAbort()`), and the pending job starts when the
  running promise settles. A running job without a pending successor is never aborted by time.

- [ ] **Step 1: Write the failing queue test** `tests/app/choreography/sectionQueue.test.ts` (fake timers; `run` resolves after a per-job duration from a map, or on abort):
  ```ts
  it('runs the first job at once', () => { /* enqueue 02 → run called with { id: '02', direction: 'down' }; running is 02 */ });
  it('lets a running job finish before the next starts', async () => { /* 02 takes 1000 ms; enqueue 03 at 100 ms → run called once; at 1000 ms → 03 starts; signal of 02 not aborted */ });
  it('keeps only the latest pending job', async () => { /* 02 running; enqueue 03 then 04 → pending 04; after 02 ends → run(04), 03 never runs */ });
  it('aborts a running job 2500 ms after it started when another is pending', async () => {
    /* 02 takes 10000 ms; enqueue 03 at 500 ms; at 2499 ms 02's signal not aborted; at 2500 ms aborted, onAbort called once, then 03 starts */
  });
  it('a lone long job is not aborted by time', async () => { /* 02 takes 10000 ms, nothing pending → signal never aborted */ });
  it('scales the deadline by the time scale', async () => { /* timeScale () => 4: abort at 10000 ms, not 9999 */ });
  it('interrupt aborts the running job and keeps the pending one', async () => { /* 02 running, 03 pending; interrupt → 02 aborted, onAbort called, 03 starts */ });
  it('dispose aborts and drops everything', () => { /* pending null, running aborted */ });
  ```
- [ ] **Step 2: Write the failing hook test** `tests/app/choreography/useSectionDriver.test.tsx` (jsdom; gsap mocked;
  `vi.mock('../../../src/app/choreography/reconcile', () => ({ reconcile: vi.fn(async () => ({ performed: 'none', keptVisitorEdits: false, aborted: false })) }))`;
  a harness renders two `<section>`s registered as '01' and '02'):
  ```ts
  it('one ScrollTrigger per registered section at "top center"', () => { /* ScrollTrigger.create called twice with { trigger: el, start: 'top center', onEnter, onLeaveBack } */ });
  it('onEnter reconciles the section downward, without focus, at 18 cps with the cursor', () => {
    /* create.mock.calls[1][0].onEnter() → reconcile called with (handle, SECTION_SNAPSHOTS['02'], objectContaining({ direction: 'down', cps: 18, maxDurationMs: 2500, cursor: cursorRef.current })); current === '02' */
  });
  it('onLeaveBack reconciles the previous snapshot upward', () => { /* calls[0][0].onLeaveBack() → reconcile(handle, SECTION_SNAPSHOTS.hero, { direction: 'up' }); current === 'hero' */ });
  it('visitor interaction interrupts the running action', () => { /* reconcile mock never resolves; onEnter 02; fake.visitorEdit({ title: 'x' }) → fake.methods() contains 'cancel' */ });
  it('reduced motion runs instant (cps Infinity) without the cursor', () => { /* matchMedia reduce true → reconcile opts cps Infinity, cursor null */ });
  it('initial sync: the last section above the viewport middle runs once after mount', () => {
    /* getBoundingClientRect: 01 top −400, 02 top 100 (innerHeight 900 → middle 450) → reconcile called once with SECTION_SNAPSHOTS['02'], 'down' */
  });
  it('enabled false registers nothing', () => { /* ScrollTrigger.create not called */ });
  it('kills its triggers on unmount', () => { /* each returned trigger.kill called */ });
  ```
- [ ] **Step 3: Run** `npx vitest run tests/app/choreography` — expected FAIL for both new files.
- [ ] **Step 4: Implement** `useSectionDriver.ts`: `SectionQueue` per Produces; the hook keeps a `Map<SectionId, ScrollTrigger>`,
  `register` (stable `useCallback`) kills the old trigger for the id and creates `{ trigger: el, start: 'top center', onEnter, onLeaveBack }`;
  `run(job, signal) = reconcile(handle.current!, SECTION_SNAPSHOTS[job.id], { now: clock(), calendar, direction: job.direction, signal,
  cursor: reduce ? null : cursor.current, maxDurationMs: MAX_ACTION_MS, cps: reduce ? Infinity : 18 })` (skipped when `handle.current` is null);
  `onAbort` → `handle.current?.cancel(); cursor.current?.cancel()`; subscription on the handle: `dirty` false → true calls `queue.interrupt()`;
  after mount and `document.fonts.ready`: `ScrollTrigger.refresh()`, then the initial sync (last registered section in
  `SECTION_ORDER` whose `getBoundingClientRect().top < innerHeight / 2`, else nothing).
- [ ] **Step 5: Run** `npx vitest run tests/app/choreography` — expected PASS.
- [ ] **Step 6: Commit.** `git add src/app/choreography/useSectionDriver.ts tests/app/choreography/sectionQueue.test.ts tests/app/choreography/useSectionDriver.test.tsx && git commit -m "feat(choreography): drive section states from ScrollTrigger with a throttled queue"`

---

### Task C16: Section copy, FeatureSection, Features column (01–06)

**Files:**
- Create: `src/app/choreography/copy.ts`, `src/app/sections/FeatureSection.tsx`, `src/app/sections/Features.tsx`
- Test: `tests/app/sections/features.test.tsx`

**Interfaces:**
- Consumes: C11 `useStage`; C15 `useSectionDriver`; C13 `DEMO_REMINDER`, `SectionId`; Phosphor `Icon` type and icons.
- Produces:
  ```ts
  // src/app/choreography/copy.ts
  export interface FeatureBullet { readonly icon: Icon; readonly text: string }
  export interface FeatureCopy { readonly id: Exclude<SectionId, 'hero'>; readonly label: string; readonly headline: string; readonly paragraph: string; readonly secondary?: string; readonly bullets: readonly FeatureBullet[] }
  export const HERO_COPY: { readonly title: 'A reminder, straight out of the notch.'; readonly subtitle: string };
  export const FEATURE_COPY: readonly FeatureCopy[];      // 01…06
  export const INTEGRATIONS_COPY: FeatureCopy & { readonly cards: readonly { icon: Icon; title: string; body: string }[]; readonly terminalCommand: 'open quickreminder://show' };
  export const DOWNLOAD_COPY: { headline: 'Free. Open source. macOS 26.'; primary: 'Download for macOS'; secondary: 'View on GitHub'; facts: readonly { icon: Icon; title: string; detail: string }[]; requirements: string; note: string };
  export const FOOTER_COPY: { madeBy: 'Made by Jakub Holec'; disclaimer: string; siteNote: string };
  /** "(02) Dates /" — jholec.com numbered section title (landing §7.3, contracts §6.1). */
  export function sectionTitle(id: Exclude<SectionId, 'hero'>, label: string): string;
  // src/app/sections/FeatureSection.tsx
  export const FeatureSection: ForwardRefExoticComponent<{ copy: FeatureCopy; tone?: 'light' | 'dark' } & RefAttributes<HTMLElement>>;
  // src/app/sections/Features.tsx
  export function Features(): JSX.Element;               // registers 01…06 with useSectionDriver (07 is static, not registered)
  ```
  Copy (headlines are fixed by landing §7; the rest is the builder's draft, Jakub edits after):

  | id | label | headline | paragraph | bullets (Phosphor icon · text) |
  |---|---|---|---|---|
  | 01 | Shortcut | One shortcut. | Press ⇧⌘R in any app and the notch opens into a panel, with the cursor already in the title. The app you were using stays in front, so you are back in it the moment you save. | Keyboard · ⇧⌘R from anywhere, or a shortcut of your own / CursorClick · Or click the notch, like on the screen here / X · Esc, ⓧ or a click outside closes it without saving |
  | 02 | Dates | Say when. | Write the date the way you would say it. The panel spots the phrase and shows when you will be reminded. Tab applies it and takes the phrase out of the title. (secondary: `Czech works too: “zavolat mámě zítra ve 14:00”.` built from `DEMO_REMINDER.czechExample`) | CalendarCheck · “tomorrow at 2pm”, “in 2 hours”, “v pátek” / Lightning · Skip the Tab and the date is applied when you save / Translate · English and Czech. With two dates, the last one counts |
  | 03 | Set Date | Set the date in the notch. | Press ⌘D or the calendar button and the panel grows downward into Set Date. Type a date, pick a preset, or set the day and time. Nothing above it moves. | SquaresFour · Six presets on ⌘1 to ⌘6, from “In 1 Hour” to “Next Month” / CalendarBlank · ⌘K opens a month calendar, and the arrow keys move the day / Clock · Type “fri 2pm”, “+90m” or “1430” and check the preview before you set it |
  | 04 | Lists | Your lists, your colour. | Click “Reminders ▾” to pick a list. The panel takes on the list’s colour: the header, the save button, the date chip and the text cursor all follow. | ListBullets · All your lists from Apple Reminders, each in its own colour / Palette · On light colours the labels turn dark, so they stay readable / ClockCounterClockwise · The list you pick is the one you get next time |
  | 05 | Flag & location | Flag it, pin it. | The flag marks what matters. The pin adds a place, saved in the notes as “📍 Office”, so you see it wherever the reminder shows up. | Flag · A flagged reminder is saved with high priority / MapPin · The place is a line of text in the notes. Nothing tracks your location |
  | 06 | Save | Save, and it flies home. | Press ⌘↩, Return or the check button. The panel folds back into the notch, a check mark lands next to it, and the reminder is already in your list. | CheckCircle · Saved to Apple Reminders through EventKit, so it syncs like any other reminder / Browser · Here it lands in the window on the desktop and never leaves your browser |
  | 07 | Integrations | Everywhere you already are. | Open the panel from Raycast, from Shortcuts or from a script. Launching the app from Spotlight or the Dock opens it too. | cards below |

  `HERO_COPY.subtitle` = `A free Mac app that adds reminders from the notch. The screen above is live: click the notch and type.`
  07 cards: MagnifyingGlass · Raycast · `Type “Quick Reminder” in Raycast. The repo ships a Script Command for it.` /
  Lightning · Shortcuts · `Add an Open URL action with quickreminder://show to any shortcut.` /
  Link · URL scheme · `quickreminder://show, hide and toggle work from scripts and other apps.` /
  GearSix · Settings · `Launch at login, your own hotkey, the default list, and whether Set Date opens in the notch or as a popover.`
  (Facts are app `README.md` "Use" table and SPEC §1.) Download and footer strings are listed in C18 and C19.

- [ ] **Step 1: Write the failing test** `tests/app/sections/features.test.tsx` (jsdom; gsap and recreation mocked; Features rendered inside `<Stage title="" subtitle="">`):
  ```ts
  it('headlines are the spec’s, in order', () => {
    expect(FEATURE_COPY.map(c => c.headline)).toEqual(['One shortcut.', 'Say when.', 'Set the date in the notch.', 'Your lists, your colour.', 'Flag it, pin it.', 'Save, and it flies home.']);
    expect(INTEGRATIONS_COPY.headline).toBe('Everywhere you already are.'); expect(HERO_COPY.title).toBe('A reminder, straight out of the notch.');
  });
  it('sectionTitle', () => expect(sectionTitle('02', 'Dates')).toBe('(02) Dates /'));
  it('every section has 2–3 bullets', () => [...FEATURE_COPY, INTEGRATIONS_COPY].forEach(c => { if (c.id !== '07') expect(c.bullets.length).toBeGreaterThanOrEqual(2); expect(c.bullets.length).toBeLessThanOrEqual(3); }));
  it('02 shows the Czech example', () => expect(FEATURE_COPY[1].secondary).toBe('Czech works too: “zavolat mámě zítra ve 14:00”.'));
  it('renders each section with label, h2 and bullets', () => {
    /* six <section aria-labelledby> elements; getByText('(01) Shortcut /') whose number part '(01)' is in a span with font-family var(--jh-font-mono);
       getByRole('heading', { level: 2, name: 'Say when.' }); list items with an svg aria-hidden and the text */
  });
  it('typography: label 14/500 muted, headline 24/600, paragraph 18/500, bullets 16/500', () => { /* inline style or class tokens: font-size var(--jh-text-label) etc. */ });
  it('registers 01…06 with the driver (one ScrollTrigger each)', () => { /* ScrollTrigger.create called 6 times; triggers are the six sections in order */ });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/app/sections/features.test.tsx` — expected FAIL.
- [ ] **Step 3: Implement.** FeatureSection markup: `<section id="feature-0n" aria-labelledby="feature-0n-title">`,
  label `<p>` (`--jh-text-label` 14 px, 500, `--jh-muted`; `(0n)` in `--jh-font-mono`), `<h2 id>` (`--jh-text-h3` 24 px, 600,
  `--jh-leading-heading`, `--jh-fg`, margin-top 16 px), paragraph (`--jh-text-body-l` 18 px, 500, `--jh-leading-body`,
  `--jh-fg`, margin-top 16 px, max-width 34em), optional secondary (16 px 500 `--jh-muted`, `lang="cs"` on the quoted example),
  `<ul>` margin-top 24 px, gap 16 px, rows icon 20 px `weight="regular"` `aria-hidden` + text 16 px 500. Desktop (≥ 810):
  `min-height: 100svh; display: flex; flex-direction: column; justify-content: center; padding: 80px var(--jh-page-margin-x) 80px 40px`;
  phone: `padding: 80px var(--jh-page-margin-x) 0` and the last section `padding-bottom: var(--jh-section-gap)`.
  Muted text on white is `#757575` (4.6:1, C21 pins it); no `--jh-accent` text on light sections.
- [ ] **Step 4: Run** — expected PASS.
- [ ] **Step 5: Commit.** `git add src/app/choreography/copy.ts src/app/sections/FeatureSection.tsx src/app/sections/Features.tsx tests/app/sections/features.test.tsx && git commit -m "feat(sections): add the six feature sections with their copy"`

---

### Task C17: Integrations (07) with the terminal card

**Files:**
- Create: `src/app/sections/Integrations.tsx`
- Modify: `src/main.tsx` (import `@fontsource/fragment-mono/400.css`)
- Test: `tests/app/sections/integrations.test.tsx`

**Interfaces:**
- Consumes: C16 `INTEGRATIONS_COPY`, `sectionTitle`; C12 `LINKS.raycastScript`; C4 `useMediaQuery`.
- Produces:
  ```ts
  export const COPIED_MS: 1600;
  export function Integrations(): JSX.Element;    // <section id="integrations" aria-labelledby="feature-07-title">
  export function TerminalCard(props: { command: string }): JSX.Element;
  ```

- [ ] **Step 1: Write the failing test** `tests/app/sections/integrations.test.tsx` (jsdom, fake timers):
  ```ts
  it('title, headline and paragraph', () => { /* '(07) Integrations /', h2 'Everywhere you already are.' */ });
  it('four dark cards in order', () => { /* card titles ['Raycast', 'Shortcuts', 'URL scheme', 'Settings']; card style background var(--jh-black-light) (#121212), radius var(--jh-radius) */ });
  it('terminal shows the prompt and the command in mono', () => { /* getByText('open quickreminder://show') font-family var(--jh-font-mono); prompt '~ %' */ });
  it('Copy writes the command to the clipboard and says Copied for 1.6 s', async () => {
    const writeText = vi.fn(() => Promise.resolve()); Object.assign(navigator, { clipboard: { writeText } });
    /* click button 'Copy command' → writeText('open quickreminder://show'); live region text 'Copied'; advance 1600 → 'Copy' */
  });
  it('the caret blinks unless reduced motion', () => { /* [data-caret] style.animation contains 'qr-caret-blink 1.06s steps(1) infinite'; with reduce → 'none' */ });
  it('the Raycast card links the Script Command folder', () => { /* link 'Script Command' href LINKS.raycastScript */ });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/app/sections/integrations.test.tsx` — expected FAIL.
- [ ] **Step 3: Implement.** White section (`data-section` unset), padding `var(--jh-section-gap) var(--jh-page-margin-x)`, max-width 1200 px centred;
  header block as FeatureSection's text styles; terminal card full width: bg `var(--jh-black)`, 1 px `var(--jh-gray-dark)` border,
  radius 16 px; title bar 36 px with three 10 px dots `#4D4D4D` gap 8 px and a centred `zsh` 12 px `#A8A8A8`; body padding 20 px 24 px,
  15 px `--jh-font-mono`, prompt `#A8A8A8`, command `#FFFFFF`, caret 8 × 18 px `#FFFFFF` (`@keyframes qr-caret-blink { 50% { opacity: 0 } }`);
  Copy button top-right of the body (13 px 500, Phosphor `Copy`/`Check` 16 px, white 85 %, `aria-label="Copy command"`),
  `aria-live="polite"` status. Cards grid gap 16 px: 4 columns ≥ 1200 px, 2 ≥ 810 px, 1 below; card bg `var(--jh-black-light)`,
  padding 24 px, icon 24 px white, title 16 px 500 white, body 14 px 400 `#A8A8A8`, `quickreminder://…` spans in mono.
- [ ] **Step 4: Run** — expected PASS.
- [ ] **Step 5: Commit.** `git add src/app/sections/Integrations.tsx src/main.tsx tests/app/sections/integrations.test.tsx && git commit -m "feat(sections): add the integrations section with the terminal card"`

---

### Task C18: Download section and app-icon assets

**Files:**
- Create: `public/app-icon-512.png`, `public/favicon-32.png`, `public/favicon-64.png`, `public/apple-touch-icon.png`
- Create: `src/app/sections/Download.tsx`
- Modify: `src/app/choreography/copy.ts` (fill `DOWNLOAD_COPY`)
- Test: `tests/app/sections/downloadFooter.test.tsx` (Download part)

**Interfaces:**
- Consumes: C16 `DOWNLOAD_COPY`; C12 `LINKS`.
- Produces: `export function Download(): JSX.Element;` (`<section id="download" data-section="dark" aria-labelledby="download-title">`);
  the four PNGs at the paths above.

- [ ] **Step 1: Extract the icons** from the app's own `.icns` (landing §3: app icon allowed):
  ```bash
  ICONSET="$(mktemp -d)/AppIcon.iconset"
  iconutil -c iconset "/Users/jakub/Developer/Xcode Apps/QuickReminder/Resources/AppIcon.icns" -o "$ICONSET"
  cp "$ICONSET/icon_256x256@2x.png" public/app-icon-512.png
  cp "$ICONSET/icon_32x32.png" public/favicon-32.png
  cp "$ICONSET/icon_32x32@2x.png" public/favicon-64.png
  sips -z 180 180 "$ICONSET/icon_128x128@2x.png" --out public/apple-touch-icon.png
  ```
  Expected: `sips -g pixelWidth public/app-icon-512.png public/apple-touch-icon.png` prints 512 and 180.
- [ ] **Step 2: Write the failing test** (Download part of `tests/app/sections/downloadFooter.test.tsx`, jsdom):
  ```ts
  it('copy', () => expect(DOWNLOAD_COPY).toMatchObject({ headline: 'Free. Open source. macOS 26.', primary: 'Download for macOS', secondary: 'View on GitHub',
    requirements: 'Requires macOS 26 on Apple silicon. Works on Macs without a notch too, with a virtual notch at the top of the screen.',
    note: 'On first launch, macOS asks for access to Reminders.' }));
  it('facts', () => expect(DOWNLOAD_COPY.facts.map(f => f.title)).toEqual(['Notarized Developer ID build', 'Only EventKit, no private APIs', 'MIT licence']));
  it('is the dark #0A0A0A section the nav links to', () => { /* section#download data-section="dark"; style background var(--jh-bg) under [data-section=dark] → var(--jh-black) */ });
  it('primary button downloads from the latest release; secondary opens the repo', () => {
    /* getByRole('link', { name: 'Download for macOS' }) href 'https://github.com/holecjakub/QuickReminder/releases/latest'; 'View on GitHub' href LINKS.appRepo */
  });
  it('the MIT fact links the LICENSE', () => { /* link inside the third fact href LINKS.license */ });
  it('app icon has intrinsic size and loads lazily', () => { /* img alt 'QuickReminder app icon' src '/app-icon-512.png' width 96 height 96 loading 'lazy' decoding 'async' */ });
  ```
  Fact details: `Signed and notarized, so macOS opens it without a warning.` / `It reads and writes your reminders through Apple’s public framework.` /
  `Read the code, build it yourself, or change it.` Icons: SealCheck, ShieldCheck, Scales.
- [ ] **Step 3: Run** `npx vitest run tests/app/sections/downloadFooter.test.tsx` — expected FAIL.
- [ ] **Step 4: Implement.** Padding `var(--jh-page-margin-y) var(--jh-page-margin-x)` (140 px), max-width 1200 px; icon 96 px, radius 22 px;
  h2 `--jh-text-h1` 54 px 600 white (phone 32 px); buttons 48 px tall, radius 999 px, padding 0 24 px, 16 px 600: primary bg white,
  text `#0A0A0A`, Phosphor `DownloadSimple` 20 px; secondary 1 px `#4D4D4D` border, white text, Phosphor `GithubLogo` 20 px;
  gap 16 px; facts grid 3 columns ≥ 810 (1 below), gap 24 px, margin-top 80 px: icon 24 px white, title 16 px 500 white, detail 14 px
  `#A8A8A8`; requirements and note 14 px `#A8A8A8`, margin-top 48 px. Focus outline white on this section (C21 global rule).
- [ ] **Step 5: Run** — expected PASS.
- [ ] **Step 6: Commit.** `git add public/app-icon-512.png public/favicon-32.png public/favicon-64.png public/apple-touch-icon.png src/app/sections/Download.tsx src/app/choreography/copy.ts tests/app/sections/downloadFooter.test.tsx && git commit -m "feat(sections): add the download section and app icon assets"`

---

### Task C19: Footer with the trademark disclaimer

**Files:**
- Create: `src/app/sections/Footer.tsx`
- Modify: `src/app/choreography/copy.ts` (fill `FOOTER_COPY`)
- Test: `tests/app/sections/downloadFooter.test.tsx` (Footer part)

**Interfaces:**
- Consumes: C16 `FOOTER_COPY`; C12 `LINKS`.
- Produces: `export function Footer(): JSX.Element;` (`<footer data-section="dark">`).

- [ ] **Step 1: Write the failing test** (append to `tests/app/sections/downloadFooter.test.tsx`):
  ```ts
  it('disclaimer is the app README’s, verbatim', () => expect(FOOTER_COPY.disclaimer).toBe(
    'Not affiliated with, endorsed by or sponsored by Apple Inc. Apple, macOS, iOS, Xcode, SF Symbols and Reminders are trademarks of Apple Inc. ' +
    'QuickReminder is an independent, from-scratch implementation using only public Apple frameworks; it contains no Apple source code or assets and uses no private APIs. ' +
    'It reads and writes your reminders through the public EventKit framework.'));
  it('site note', () => expect(FOOTER_COPY.siteNote).toBe('The desktop, wallpaper, window and cursor on this page are original drawings, and the icons are Phosphor. Nothing on this page is an Apple asset.'));
  it('links: jholec.com, the app repo, the site source, NOTICE', () => {
    /* getByRole('link', { name: 'Made by Jakub Holec' }) href 'https://jholec.com'; 'QuickReminder on GitHub' → LINKS.appRepo;
       'Source of this site' → LINKS.siteRepo; 'Trademarks and acknowledgements' → LINKS.notice */
  });
  it('is a dark contentinfo landmark', () => { /* getByRole('contentinfo') data-section="dark" */ });
  ```
- [ ] **Step 2: Run** — expected FAIL (Footer tests).
- [ ] **Step 3: Implement.** Dark, border-top 1 px `#4D4D4D`, padding 48 px `var(--jh-page-margin-x)` 64 px, max-width 1200 px;
  first row "Made by Jakub Holec" (16 px 500 white) left, links (14 px 500 white, gap 24 px) right, wrapping on phones;
  disclaimer and site note 14 px `#A8A8A8` (8.33:1 on `#0A0A0A`), max-width 70ch, margin-top 32 px.
- [ ] **Step 4: Run** `npx vitest run tests/app/sections/downloadFooter.test.tsx` — expected PASS (Download + Footer).
- [ ] **Step 5: Commit.** `git add src/app/sections/Footer.tsx src/app/choreography/copy.ts tests/app/sections/downloadFooter.test.tsx && git commit -m "feat(sections): add the footer with the trademark disclaimer"`

---

### Task C20: App assembly, entry and document metadata

**Files:**
- Modify: `src/App.tsx`, `src/main.tsx`, `index.html`, `src/index.css`
- Test: `tests/app/app.test.tsx`

**Interfaces:**
- Consumes: C1 `applyGsapTimeScale`; C11 `Stage`; C12 `ScrollProgress`, `Nav`; C16 `Features`, `HERO_COPY`; C17 `Integrations`; C18 `Download`; C19 `Footer`.
- Produces: `export default function App(): JSX.Element;` with the DOM order
  `ScrollProgress → Nav → <main>(Stage(Features) → Integrations → Download) → Footer`.

- [ ] **Step 1: Write the failing test** `tests/app/app.test.tsx` (jsdom; gsap and recreation mocked; `installMatchMedia({ '(min-width: 810px)': true })`):
  ```ts
  import { readFileSync } from 'node:fs';
  it('landmarks in order', () => {
    render(<App />);
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeTruthy();
    const main = screen.getByRole('main');
    const ids = [...main.querySelectorAll('[data-stage-track], section#integrations, section#download')].map(e => e.id || 'stage');
    expect(ids).toEqual(['stage', 'integrations', 'download']); expect(screen.getByRole('contentinfo')).toBeTruthy();
  });
  it('one h1, the hero title', () => { render(<App />); expect(screen.getAllByRole('heading', { level: 1 }).map(h => h.textContent)).toEqual(['A reminder, straight out of the notch.']); });
  it('the features column sits inside the stage track', () => { render(<App />); expect(document.querySelector('[data-features-column] #feature-01')).not.toBeNull(); });
  it('index.html metadata', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<title>QuickReminder · A reminder, straight out of the notch</title>');
    expect(html).toContain('<meta name="description" content="QuickReminder is a free, open-source macOS 26 app that opens a reminder panel out of the MacBook notch. Try it in the browser." />');
    expect(html).toContain('<meta name="theme-color" content="#0A0A0A" />');
    expect(html).toContain('<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />');
    expect(html).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />');
    expect(html).toContain('<meta property="og:url" content="https://quickreminder.jholec.com/" />');
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/app/app.test.tsx` — expected FAIL.
- [ ] **Step 3: Implement.** `App.tsx` per Produces (`<Stage title={HERO_COPY.title} subtitle={HERO_COPY.subtitle}><Features /></Stage>`);
  `main.tsx` calls `applyGsapTimeScale()` before render and keeps part 01's imports; `index.html` gets the tags above plus
  `og:title` (= the `<title>` text), `og:description` (= description), `og:type website`, `og:image https://quickreminder.jholec.com/app-icon-512.png`,
  `<link rel="icon" sizes="64x64" href="/favicon-64.png">`; no analytics script (landing §2 non-goals). `index.css` adds:
  `html { scroll-behavior: smooth }` inside `@media (prefers-reduced-motion: no-preference)`; `body { overflow-x: clip; background: var(--jh-white); }`;
  `:focus-visible { outline: 2px solid var(--jh-fg); outline-offset: 2px }`; `[data-section="dark"] :focus-visible { outline-color: var(--jh-white) }`.
- [ ] **Step 4: Run** `npx vitest run tests/app/app.test.tsx` — expected PASS; then `npm test` — expected PASS (whole suite) and `npm run build` — expected exit 0.
- [ ] **Step 5: Manual check.** `npm run dev`, open `http://localhost:5173/?now=2026-10-23T10:00`: the hero fills the viewport, the notch
  opens on click, scrolling shrinks to the MacBook with the title, then pins it on the left while (01)…(06) play.
- [ ] **Step 6: Commit.** `git add src/App.tsx src/main.tsx index.html src/index.css tests/app/app.test.tsx && git commit -m "feat(page): assemble the landing page"`

---

### Task C21: Accessibility and contrast

**Files:**
- Create: `tests/app/contrast.test.ts`, `e2e/a11y.spec.ts`
- Modify: `playwright.config.ts` (create if part 01 did not)

**Interfaces:**
- Consumes: `AccentContrast.contrastRatio`, `AccentContrast.relativeLuminance`, `hexToRgb` (contracts §2.9); C4 `WALLPAPER` colours;
  C6 hint colours; Playwright, `@axe-core/playwright`.
- Produces: `playwright.config.ts` with projects `chromium` (Desktop Chrome, 1440 × 900) and `webkit` (Desktop Safari, 1440 × 900),
  `use: { baseURL: 'http://localhost:4173', timezoneId: 'Europe/Prague', locale: 'en-US' }`,
  `webServer: { command: 'npm run build && npx vite preview --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI, timeout: 120_000 }`,
  `testDir: 'e2e'`; `package.json` script `"e2e": "playwright test"` (keep part 01's when present).

- [ ] **Step 1: Write the failing unit test** `tests/app/contrast.test.ts`:
  ```ts
  const ratio = (fg: string, bg: string) => { const a = hexToRgb(fg)!, b = hexToRgb(bg)!; return AccentContrast.contrastRatio(AccentContrast.relativeLuminance(a.r, a.g, a.b), AccentContrast.relativeLuminance(b.r, b.g, b.b)); };
  const over = (fg: [number, number, number], alpha: number, bg: string) => { /* sRGB alpha composite → '#RRGGBB' */ };
  it.each([
    ['#0A0A0A', '#FFFFFF', 19.80], ['#757575', '#FFFFFF', 4.61], ['#A8A8A8', '#0A0A0A', 8.33], ['#FFFFFF', '#121212', 18.73],
    ['#4D4D4D', '#EBEBEB', 7.09], ['#0099FF', '#0A0A0A', 6.60],
  ])('page text %s on %s ≥ 4.5:1', (fg, bg, expected) => { expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5); expect(ratio(fg, bg)).toBeCloseTo(expected, 1); });
  it('accent blue is never body text on white (3.00:1)', () => expect(ratio('#0099FF', '#FFFFFF')).toBeLessThan(4.5));
  it('muted gray is never body text on the light-gray card (3.86:1)', () => expect(ratio('#757575', '#EBEBEB')).toBeLessThan(4.5));
  it('hint lines stay ≥ 4.5:1 over every wallpaper blob', () => {
    for (const blob of ['#9DB8FF', '#F4B6D2', '#FFD7A6', '#E8ECF6']) { const bg = over([255, 255, 255], 0.78, blob); expect(ratio('#1D1D1F', bg)).toBeGreaterThanOrEqual(4.5); expect(ratio('#3A3A3C', bg)).toBeGreaterThanOrEqual(4.5); }
    for (const blob of ['#2C3F92', '#6A2C6F', '#1D5D66', '#0B1020']) { const bg = over([0, 0, 0], 0.45, blob); expect(ratio('#F5F5F7', bg)).toBeGreaterThanOrEqual(4.5); expect(ratio('#C7C7CC', bg)).toBeGreaterThanOrEqual(4.5); }
  });
  ```
- [ ] **Step 2: Write the failing e2e** `e2e/a11y.spec.ts`:
  ```ts
  import AxeBuilder from '@axe-core/playwright';
  test('page has no serious or critical axe violations outside the recreation', async ({ page }) => {
    await page.goto('/?now=2026-10-23T10:00');
    const r = await new AxeBuilder({ page }).exclude('[role="application"]').analyze();
    expect(r.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
  });
  test('the desktop has names for every control (contrast is the app’s own palette, landing §5.2)', async ({ page }) => {
    await page.goto('/?now=2026-10-23T10:00');
    const r = await new AxeBuilder({ page }).include('[role="application"]').disableRules(['color-contrast']).analyze();
    expect(r.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
  });
  test('Tab reaches the nav first and shows a visible focus ring', async ({ page }) => {
    await page.goto('/'); await page.keyboard.press('Tab');
    const link = page.getByRole('link', { name: 'GitHub' }); await expect(link).toBeFocused();
    expect(await link.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
  });
  test('the hint button opens the panel from the keyboard', async ({ page }) => {
    await page.goto('/?now=2026-10-23T10:00'); await page.getByRole('button', { name: 'Click the notch to add a reminder' }).focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('application', { name: 'QuickReminder demo desktop' })).toHaveAttribute('data-phase', 'open');
    await expect(page.getByRole('textbox', { name: 'New Reminder' })).toBeFocused();
  });
  ```
- [ ] **Step 3: Run** `npx vitest run tests/app/contrast.test.ts` — expected FAIL only if a component used a colour outside the table (fix the component, not the test);
  `npx playwright test e2e/a11y.spec.ts --project=chromium` — expected FAIL before the config exists, then run again.
- [ ] **Step 4: Implement** `playwright.config.ts` per Produces; fix any axe finding in this part's components (names, landmarks, `aria-hidden` on decorative SVGs).
- [ ] **Step 5: Run** both — expected PASS (`--project=chromium` and `--project=webkit`).
- [ ] **Step 6: Commit.** `git add tests/app/contrast.test.ts e2e/a11y.spec.ts playwright.config.ts package.json && git commit -m "test(a11y): pin page contrast and add axe and keyboard checks"`

---

### Task C22: Playwright smoke suite (landing §9, exactly)

**Files:**
- Create: `e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: DesktopScene root attributes (C8: `role="application"`, `aria-label`, `data-phase`); `RemindersWindow` region
  "Your reminders" (C7); area B accessible names (cross-area note 6): textbox "New Reminder", buttons "Save reminder",
  "Use suggested date", "Change date", element labelled "Saved" (app `SavedCheckView.swift` line 32).
- Produces: the four smoke tests below (the spec's list: loads, notch click opens, chip, Tab applies, ⌘↩ saves into the window).

- [ ] **Step 1: Write the test** `e2e/smoke.spec.ts`:
  ```ts
  import { test, expect, type Page } from '@playwright/test';
  const NOW = '2026-10-23T10:00';   // Friday, Europe/Prague (playwright.config timezoneId)
  const desktop = (page: Page) => page.getByRole('application', { name: 'QuickReminder demo desktop' });
  async function clickNotch(page: Page) {
    const box = (await desktop(page).boundingBox())!; const pt = box.width / 1512;
    await page.mouse.click(box.x + box.width / 2, box.y + 19 * pt);   // centre of the 221 × 38 pt notch
  }
  test.beforeEach(async ({ page }) => { await page.goto(`/?now=${NOW}`); });

  test('page loads with the desktop, the closed notch and the hint', async ({ page }) => {
    await expect(page).toHaveTitle('QuickReminder · A reminder, straight out of the notch');
    await expect(desktop(page)).toBeVisible(); await expect(desktop(page)).toHaveAttribute('data-phase', 'closed');
    await expect(page.getByText('Click the notch to add a reminder')).toBeVisible();
  });
  test('clicking the notch opens the panel with the title focused', async ({ page }) => {
    await clickNotch(page);
    await expect(desktop(page)).toHaveAttribute('data-phase', 'open');
    await expect(page.getByRole('textbox', { name: 'New Reminder' })).toBeFocused();
  });
  test('typing "tomorrow at 2pm" shows the chip and Tab applies it', async ({ page }) => {
    await clickNotch(page); await page.keyboard.type('Call mum tomorrow at 2pm');
    await expect(page.getByRole('button', { name: 'Use suggested date' })).toContainText(/Tomorrow, 2:00\sPM/);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('textbox', { name: 'New Reminder' })).toHaveValue('Call mum');
    await expect(page.getByRole('button', { name: 'Change date' })).toContainText(/Tomorrow, 2:00\sPM/);
  });
  test('⌘↩ runs the saved choreography and the item lands in the window', async ({ page }) => {
    await clickNotch(page); await page.keyboard.type('Call mum tomorrow at 2pm'); await page.keyboard.press('Tab');
    await page.keyboard.press('Meta+Enter');
    await expect(desktop(page)).toHaveAttribute('data-phase', 'saving');
    await expect(page.getByLabel('Saved')).toBeVisible();
    const win = page.getByRole('region', { name: 'Your reminders' });
    await expect(win).toBeVisible(); await expect(win).toContainText('Call mum'); await expect(win).toContainText(/Tomorrow, 2:00\sPM/);
    await expect(desktop(page)).toHaveAttribute('data-phase', 'closed', { timeout: 3000 });
  });
  ```
- [ ] **Step 2: Run** `npx playwright test e2e/smoke.spec.ts` — expected PASS on `chromium` and `webkit` (the suite exercises C8 and area B together;
  a FAIL here is fixed in the component it names, never by loosening an assertion).
- [ ] **Step 3: Commit.** `git add e2e/smoke.spec.ts && git commit -m "test(e2e): add the smoke suite from the landing spec"`

---

### Task C23: Choreography and responsive e2e

**Files:**
- Create: `e2e/choreography.spec.ts`, `e2e/responsive.spec.ts`

**Interfaces:**
- Consumes: C11 DOM contract (`[data-stage]`, `[data-features-column]`), C16 section ids `#feature-0n`, C8 `data-phase` / `data-schedule`,
  C7 window region, C13 snapshots (expected end states).
- Produces: e2e coverage of landing §7 (states per section, visitor edits, back to the hero, clickable while pinned) and §7 Mobile (< 810 px).

- [ ] **Step 1: Write** `e2e/choreography.spec.ts` (chromium + webkit; helper `toSection(page, n)` = `page.locator('#feature-' + n).evaluate(el => el.scrollIntoView({ block: 'start' }))`
  then `page.mouse.wheel(0, 1)` so ScrollTrigger sees a scroll; `title = page.getByRole('textbox', { name: 'New Reminder' })`):
  ```ts
  test('(01) opens the panel without taking focus', async ({ page }) => { await toSection(page, '01'); await expect(desktop(page)).toHaveAttribute('data-phase', 'open'); await expect(title).not.toBeFocused(); });
  test('(02) types the demo title and applies the chip', async ({ page }) => { await toSection(page, '02'); await expect(title).toHaveValue('Call mum', { timeout: 6000 }); await expect(page.getByRole('button', { name: 'Change date' })).toContainText(/Tomorrow, 2:00\sPM/); });
  test('(03) grows Set Date and opens the calendar', async ({ page }) => { await toSection(page, '03'); await expect(desktop(page)).toHaveAttribute('data-schedule', 'calendar', { timeout: 6000 }); });
  test('(04) ends on the Work list', async ({ page }) => { await toSection(page, '04'); await expect(page.getByRole('button', { name: 'Choose list' })).toContainText('Work', { timeout: 6000 }); });
  test('jumping straight to (06) fills the reminder and saves it', async ({ page }) => {
    await page.goto('/?now=2026-10-23T10:00'); await toSection(page, '06');
    const win = page.getByRole('region', { name: 'Your reminders' });
    await expect(win).toContainText('Call mum', { timeout: 8000 }); await expect(win).toContainText(/Tomorrow, 2:00\sPM/); await expect(win).toContainText('📍 Office'); await expect(win.getByLabel('Flagged')).toBeVisible();
  });
  test('visitor edits win: (03) opens Set Date on the visitor title', async ({ page }) => {
    await toSection(page, '01'); await title.click(); await page.keyboard.type('Buy milk');
    await toSection(page, '03'); await expect(desktop(page)).toHaveAttribute('data-schedule', 'calendar', { timeout: 6000 }); await expect(title).toHaveValue('Buy milk');
  });
  test('scrolling back to the top closes the panel', async ({ page }) => { await toSection(page, '01'); await expect(desktop(page)).toHaveAttribute('data-phase', 'open'); await page.evaluate(() => window.scrollTo(0, 0)); await page.mouse.wheel(0, -1); await expect(desktop(page)).toHaveAttribute('data-phase', 'closed', { timeout: 3000 }); });
  test('the recreation stays clickable while pinned', async ({ page }) => { await toSection(page, '04'); await title.click(); await expect(title).toBeFocused(); });
  test('reduced motion: (02) sets the title at once', async ({ page }) => { await page.emulateMedia({ reducedMotion: 'reduce' }); await toSection(page, '02'); await expect(title).toHaveValue('Call mum', { timeout: 1500 }); });
  test('features pin the stage on the left 58 %', async ({ page }) => {
    await toSection(page, '03'); expect(await page.locator('[data-stage]').evaluate(el => getComputedStyle(el).position)).toBe('sticky');
    const col = (await page.locator('[data-features-column]').boundingBox())!; expect(Math.round(col.x)).toBe(Math.round(1440 * 0.58));
  });
  ```
  (every test starts with `await page.goto('/?now=2026-10-23T10:00')` in `beforeEach`.)
- [ ] **Step 2: Write** `e2e/responsive.spec.ts` with `test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })` (chromium only via `test.skip(browserName !== 'chromium')`):
  ```ts
  test('no horizontal scroll and no pinning on phones', async ({ page }) => {
    await page.goto('/?now=2026-10-23T10:00');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    expect(await page.locator('[data-stage]').evaluate(el => getComputedStyle(el).position)).not.toBe('sticky');
  });
  test('the desktop keeps 16:10 inside the width and the hint says Tap', async ({ page }) => {
    await page.goto('/?now=2026-10-23T10:00'); const box = (await desktop(page).boundingBox())!;
    expect(box.width).toBeCloseTo(1512 * (358 / 1548), 0); expect(box.width / box.height).toBeCloseTo(1512 / 982, 2);
    await expect(page.getByText('Tap the notch to add a reminder')).toBeVisible();
  });
  test('tapping the notch opens the panel; ⓧ closes it', async ({ page }) => {
    await page.goto('/?now=2026-10-23T10:00'); const box = (await desktop(page).boundingBox())!; const pt = box.width / 1512;
    await page.touchscreen.tap(box.x + box.width / 2, box.y + 19 * pt); await expect(desktop(page)).toHaveAttribute('data-phase', 'open');
    await page.getByRole('button', { name: 'Close' }).tap(); await expect(desktop(page)).toHaveAttribute('data-phase', 'closed', { timeout: 3000 });
  });
  test('sections below still drive the state', async ({ page }) => { await page.goto('/?now=2026-10-23T10:00'); await page.locator('#feature-02').evaluate(el => el.scrollIntoView({ block: 'start' })); await page.mouse.wheel(0, 1); await expect(page.getByRole('textbox', { name: 'New Reminder' })).toHaveValue('Call mum', { timeout: 6000 }); });
  ```
- [ ] **Step 3: Run** `npx playwright test e2e/choreography.spec.ts e2e/responsive.spec.ts` — expected PASS.
- [ ] **Step 4: Commit.** `git add e2e/choreography.spec.ts e2e/responsive.spec.ts && git commit -m "test(e2e): cover the scroll choreography and the phone layout"`

---

### Task C24: Lighthouse budget

**Files:**
- Create: `scripts/assert-lighthouse.mjs`
- Modify: `package.json` (script `lighthouse`)
- Test: `tests/app/lighthouse.test.ts`

**Interfaces:**
- Consumes: the production build (C20).
- Produces:
  ```js
  // scripts/assert-lighthouse.mjs
  export const BUDGET = { performance: 0.95, cls: 0.01 };   // landing §9: ≥ 95 performance on desktop, no layout shift from the hero
  export function checkReport(report) // → { ok: boolean, performance: number, cls: number, message: string }
  // CLI: node scripts/assert-lighthouse.mjs <report.json>  → prints message, exit 0 / 1
  ```
  `package.json`: `"lighthouse": "npx lighthouse http://localhost:4173/?now=2026-10-23T10:00 --preset=desktop --only-categories=performance,accessibility --output=json --output-path=.lighthouse/desktop.json --chrome-flags=\"--headless=new\" --quiet && node scripts/assert-lighthouse.mjs .lighthouse/desktop.json"`.

- [ ] **Step 1: Write the failing test** `tests/app/lighthouse.test.ts`:
  ```ts
  import { checkReport } from '../../scripts/assert-lighthouse.mjs';
  const report = (score: number, cls: number) => ({ categories: { performance: { score } }, audits: { 'cumulative-layout-shift': { numericValue: cls } } });
  it('passes at 0.95 and no shift', () => expect(checkReport(report(0.95, 0))).toMatchObject({ ok: true, performance: 0.95, cls: 0 }));
  it('fails below 0.95', () => expect(checkReport(report(0.94, 0)).ok).toBe(false));
  it('fails on a layout shift of 0.01', () => expect(checkReport(report(0.99, 0.01)).ok).toBe(false));
  it('message', () => expect(checkReport(report(0.97, 0.002)).message).toBe('performance 0.97 · CLS 0.002'));
  ```
- [ ] **Step 2: Run** `npx vitest run tests/app/lighthouse.test.ts` — expected FAIL.
- [ ] **Step 3: Implement** `scripts/assert-lighthouse.mjs` (`cls < BUDGET.cls`, `performance >= BUDGET.performance`; CLI guard
  `if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)`), add the script to `package.json`.
- [ ] **Step 4: Run** the test — expected PASS.
- [ ] **Step 5: Measure.** `npm run build`, start `npx vite preview --port 4173 --strictPort` in the background, run `npm run lighthouse`.
  Expected output `performance ≥ 0.95 · CLS < 0.01` and exit 0. The measures already in place that the budget depends on:
  initial camera before paint (C11), intrinsic-size lazy app icon (C18), no web fonts in the hero path except part 01's Inter,
  no analytics. Stop the preview server.
- [ ] **Step 6: Commit.** `git add scripts/assert-lighthouse.mjs package.json tests/app/lighthouse.test.ts && git commit -m "test(perf): add the Lighthouse budget check"`

---

### Task C25: Vercel config, README, GitHub repo and deploy

**Files:**
- Create: `vercel.json`, `README.md` (replace the template one if part 01 created it)
- Test: `tests/app/vercelConfig.test.ts`

**Interfaces:**
- Consumes: everything above (deploys the build).
- Produces: `vercel.json` (below); the public GitHub repo `holecjakub/quickreminder.jholec.com` with `main` and `develop`; the
  Vercel project `quickreminder-jholec-com` with the domain `quickreminder.jholec.com`; a PR `develop → main`.

- [ ] **Step 1: Write the failing test** `tests/app/vercelConfig.test.ts`:
  ```ts
  import { readFileSync } from 'node:fs';
  const cfg = JSON.parse(readFileSync('vercel.json', 'utf8'));
  it('static Vite build', () => expect(cfg).toMatchObject({ framework: 'vite', buildCommand: 'npm run build', outputDirectory: 'dist', cleanUrls: true, trailingSlash: false }));
  it('hashed assets are immutable', () => expect(cfg.headers).toContainEqual({ source: '/assets/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] }));
  it('security headers on every path', () => {
    const all = cfg.headers.find((h: { source: string }) => h.source === '/(.*)').headers;
    expect(all).toEqual([
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'X-Frame-Options', value: 'DENY' },
    ]);
  });
  it('README names the flags and the deploy rule', () => {
    const readme = readFileSync('README.md', 'utf8');
    for (const s of ['?now=', '?debug=motion', 'npm run e2e', 'npm run lighthouse', 'main deploys to production', 'cname.vercel-dns.com', 'Not affiliated with, endorsed by or sponsored by Apple Inc.']) expect(readme).toContain(s);
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/app/vercelConfig.test.ts` — expected FAIL.
- [ ] **Step 3: Write `vercel.json`** with `"$schema": "https://openapi.vercel.sh/vercel.json"` and exactly the values the test pins.
- [ ] **Step 4: Write `README.md`** (English) with these sections: **QuickReminder landing page** (one paragraph: the page for
  `holecjakub/QuickReminder` with a 1:1 interactive recreation of the app; link to the app repo and the spec path);
  **Develop** (`npm ci`, `npm run dev` → `http://localhost:5173`; URL flags `?now=2026-10-23T10:00` fixes the clock
  (AppClock) and `?debug=motion` slows every animation 4×); **Test** (`npm test` Vitest, `npm run e2e` Playwright,
  `npm run lighthouse` after `npm run build` and `npx vite preview --port 4173`); **Structure** (the `src/` tree of contracts §1,
  one line each for `app/`, `desktop/`, `recreation/`, `tokens.css`); **Fidelity** (the Swift code and `SPEC.md` §1 §3 §4 of the app repo
  are the reference; where they disagree the code wins; values are copied, never eyeballed); **Deploy** (Vercel static
  build; `main deploys to production`, `develop` and PRs get preview URLs; domain `quickreminder.jholec.com` is a GoDaddy
  CNAME `quickreminder` → `cname.vercel-dns.com`, runbook `~/Developer/jholec.com/GODADDY-DNS.md`); **Trademarks** (the app
  README disclaimer verbatim, as in `FOOTER_COPY.disclaimer`).
- [ ] **Step 5: Run** `npx vitest run tests/app/vercelConfig.test.ts` and `npm test` — expected PASS; `npm run build` — exit 0.
- [ ] **Step 6: Commit.** `git add vercel.json README.md tests/app/vercelConfig.test.ts && git commit -m "chore(deploy): add the Vercel config and the README"`
- [ ] **Step 7: Create the GitHub repo and push both branches.**
  ```bash
  gh repo create holecjakub/quickreminder.jholec.com --public --source=. --remote=origin --description "Landing page for QuickReminder with a 1:1 interactive recreation of the app"
  git push -u origin main
  git push -u origin develop
  gh repo edit holecjakub/quickreminder.jholec.com --default-branch main --homepage https://quickreminder.jholec.com
  ```
  Expected: `gh repo view holecjakub/quickreminder.jholec.com --json visibility,defaultBranchRef -q '.visibility + " " + .defaultBranchRef.name'` prints `PUBLIC main`.
- [ ] **Step 8: Link Vercel and add the domain.**
  ```bash
  npx vercel@latest link --yes --project quickreminder-jholec-com
  npx vercel@latest git connect https://github.com/holecjakub/quickreminder.jholec.com
  npx vercel@latest domains add quickreminder.jholec.com quickreminder-jholec-com
  ```
  Expected: `npx vercel@latest project ls` lists `quickreminder-jholec-com`; the domain command prints the CNAME target
  `cname.vercel-dns.com`. Jakub adds the GoDaddy record `CNAME quickreminder → cname.vercel-dns.com` (landing §4); `.vercel/`
  is in `.gitignore` (add it if `vercel link` did not).
- [ ] **Step 9: Open the release PR** (Jakub merges; merging deploys production):
  `gh pr create --base main --head develop --title "feat: QuickReminder landing page with the interactive recreation" --body "Landing page per docs/superpowers/specs/2026-10-27-quickreminder-landing-design.md. Vitest, Playwright smoke/choreography/a11y and the Lighthouse budget pass locally."`
  Expected: the command prints the PR URL; the Vercel preview check appears on it.
- [ ] **Step 10: Verify production after merge and DNS.** `curl -sI https://quickreminder.jholec.com/ | head -1` → `HTTP/2 200`;
  `curl -sI https://quickreminder.jholec.com/ | grep -i x-content-type-options` → `nosniff`.
