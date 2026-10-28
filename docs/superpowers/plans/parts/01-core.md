# 01 · Core — scaffold, tokens and the pure-logic ports (Area A)

Date: 2026-10-28 · Consumes: `00-contracts.md` (binding names) · Source of truth: app repo
`~/Developer/Xcode Apps/QuickReminder` at `main` = `144d620` (release 0.5.3). Where this file says
"Swift", it means that checkout.

Every task runs on branch `develop` (created in A1). Every test command is run from the site repo
root `~/Developer/quickreminder.jholec.com`. "Expected FAIL" for a new module means Vitest reports
`Failed to resolve import "../../src/…"` (the module does not exist yet); for an extended module it
means the named assertions fail.

---

## 0. Deviations from `00-contracts.md` (the code wins, landing spec §3)

The contracts were written against app commit `3d93fc7` (2026-10-26). `main` moved on the same
day (`d641200` "Set Date in the notch grows below the bottom bar", `90956b3` "Set Date never
resizes the window", `0c87117` "Location in the notch"). Names from the contracts are kept; the
values and effect lists below follow `144d620`. Parts 02–05 must read this table.

| # | Contract says | Code (`144d620`) and therefore this part |
|---|---|---|
| D1 | `scheduleControlsSize` 600 × 431, `scheduleCalendarSize` 600 × 663 (also landing spec §5.1, §11.1) | **600 × 519** and **600 × 751**: `NotchLayout.scheduleContentHeight` = `contentHeight` (202) + section (258 / 490) + 20 (`NotchStateTests.scheduleHeightFollowsTheRhythm`: 480 / 712) |
| D2 | `ScheduleMetrics.topGap: 14`; section rows from y 139 | **no `topGap`**: the section is appended *below the bottom bar*; the plain panel's 20 pt inset is the gap. `sectionHeight` = 258 (controls) / 490 (calendar). Rows from y **241**: type field 241–277 · preview 283–301 · presets 311–355 / 363–407 · day/time 419–449 · [calendar 459–681] · footer 463–499 / 695–731 · inset 20 → 519 / 751 |
| D3 | `scheduleSectionTop(band)` = band + topContentHeight = 139, used for click-cancel | `scheduleSectionTop(band)` = band + **contentHeight** = **241** (the section's real top). The click-cancel band is the new `sectionCancelBandBottom(band)` = band + topContentHeight = **139** (Swift `sectionCancelBandBottom`); `clickCancelsSchedule(y, bandBottom, schedule)` |
| D4 | `NotchMachine.canvasGrown`, effects `growCanvasForSchedule` / `fitCanvasToPanel`; first `scheduleChanged` = `[setSettled(false), growCanvasForSchedule, animateSchedule, scheduleSettle]`; settle with schedule none = `[setSettled(true), fitCanvasToPanel]` | **removed** (the window never resizes). Every `scheduleChanged` = `[setSettled(false), animateSchedule(x), scheduleSettle(g+1)]`; every current settle = `[setSettled(true)]` (`NotchMachineScheduleTests.noScheduleStepTouchesTheWindow`) |
| D5 | `ScheduleExpansion` = none / controls / calendar | Swift `NotchSection` also has `.location` (in-notch Location, 347 pt). The site keeps the **Location popover** (landing spec §5.3, §11.4), so `ScheduleExpansion` stays three-valued and the Location tests are not ported (listed per task). Swift `sectionChanged` / `animateSection` / `section` ⇒ TS `scheduleChanged` / `animateSchedule` / `schedule` |
| D6 | `ScheduleCommit.textRowSubmit(schedulingInNotch, canSave): 'setSchedule' \| …` | Swift `textRowSubmit(sectionOpen:canSave:)` → `.commitSection`. Contract names kept; `'setSchedule'` ≡ `.commitSection` |
| D7 | `ScheduleDraft` without a save decision | adds `isDirty` and `prepareSave(): SaveDecision` (Swift `ScheduleDraft.prepareSave`, SPEC §1 "✓ while the section is open") |
| D8 | `MonthGrid` without `week` | adds `week(day, calendar)` (`MonthGridTests.weekRowOfADay`) |
| D9 | `SuggestionDateFormatter.string` relative words "Today"/"Tomorrow", "dnes"/"zítra" | words as Foundation renders them on macOS 26 (measured 2026-10-28): en ±1 day `Yesterday`/`Today`/`Tomorrow`; cs ±2 days `Předevčírem`/`Včera`/`Dnes`/`Zítra`/`Pozítří` (**capitalised**). The en glue stays the contract pin `", "` (Foundation now writes `" at "`; SPEC §1 shows "Tomorrow, 2:00 PM"); cs glue `" "` (Foundation) |
| D10 | `RelativeDistance` en "in 28 hr.", cs "za 28 h"; `string(from, to, locale)` | Foundation `.abbreviated` on macOS 26 prints `in 1d`, `in 23h`, `3h ago`, cs `za 1 den`, `za 23 h` (measured table in A12). Largest **calendar** component first, so the signature gains a 4th parameter: `string(from, to, locale, calendar)` |
| D11 | `Motion.open` damping 23.337, `Motion.hoverScale` damping 50.266 | correctly rounded: **23.338**, **50.265** (4π·0.78/0.42 = 23.33755; 4π·0.88/0.22 = 50.26548) |
| D12 | `NotchLayout` exports | adds `lineHeight(pointSize)`, `sectionCancelBandBottom`, `passesMouseThrough`, `openCanvasSize` (648 × 775), all from `NotchState.swift` |
| D13 | `Theme.pill` | adds `activeFillAlpha 0.22` / `activeInset 3` (BottomBar.swift:140, the calendar icon's accent disc while Set Date is open) |
| D14 | `AppClock` + "createClock()" | `createClock(opts)` signature fixed in A3 |
| D15 | NaturalDateParser "~240 cases" | `NaturalDateParserTests.swift` has 103 argument cases + 4 single tests; all are mirrored (A5, A6) |
| D16 | `contains()` "same as Swift" | Swift hit-tests through CoreGraphics, which **flattens each quadratic into n equal-parameter chords**, n = max(1, ⌈√(r·√2 / 4)⌉) (r 6 → 2, 14 → 3, 19 → 3, 32 → 4; measured against `Path.contains` on macOS 26, exact to 0.005 pt). The port hit-tests that polygon; drawing keeps the true `Q` curves |

---

## Task A1: Scaffold, tokens, lint boundaries, branch `develop`

**Files:**
- Create: `package.json`, `.npmrc`, `.nvmrc`, `.gitignore`, `index.html`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `tsconfig.json`, `eslint.config.js`, `README.md`
- Create: `src/main.tsx`, `src/App.tsx` (placeholder shell, replaced by part 05), `src/index.css`, `src/tokens.css`, `src/vite-env.d.ts`
- Test: `tests/scaffold.test.ts`, `tests/tokens.test.ts`, `e2e/boot.spec.ts`

**Interfaces:**
- Consumes: contracts §1 (file tree, import rule), §6.1, §6.2 (token text).
- Produces: npm scripts `dev`, `build`, `preview`, `typecheck`, `lint`, `test`, `test:watch`, `e2e`; CSS custom properties `--jh-*`, `--qr-*`, `--pt` exactly as contracts §6; Tailwind theme names `jh-white`, `jh-black`, `jh-black-light`, `jh-gray-light`, `jh-gray-medium`, `jh-gray`, `jh-gray-dark`, `jh-accent`, font families `sans` (Inter stack), `mono` (Fragment Mono stack), `qr` (recreation stack); utility classes `.qr-font`, `.qr-tabular`; Vitest root `tests/` running in time zone `Pacific/Auckland`; Playwright `testDir: 'e2e'`, `baseURL: 'http://localhost:4173'`.

- [ ] **Step 1: Create the branch.** `git checkout -b develop` → `git branch --show-current` prints `develop`.

- [ ] **Step 2: Write `package.json`** with `"name": "quickreminder-landing"`, `"private": true`, `"type": "module"`, `"engines": { "node": ">=22" }`, and exact versions (`.npmrc`: `save-exact=true`; `.nvmrc`: `22`):
  - dependencies: `react 18.3.1`, `react-dom 18.3.1`, `motion 12.43.0`, `gsap 3.15.0`, `@phosphor-icons/react 2.1.10`, `@fontsource/inter 5.3.0`, `@fontsource/fragment-mono 5.3.0`
  - devDependencies: `vite 7.3.7`, `@vitejs/plugin-react 5.2.0`, `typescript 5.9.3`, `@types/react 18.3.31`, `@types/react-dom 18.3.7`, `@types/node 22.20.5`, `tailwindcss 4.3.3`, `@tailwindcss/vite 4.3.3`, `vitest 4.1.11`, `jsdom 29.1.1`, `@testing-library/react 16.3.3`, `@playwright/test 1.64.0`, `eslint 9.39.5`, `@eslint/js 9.39.5`, `typescript-eslint 8.71.2`, `eslint-plugin-react-hooks 7.1.1`, `globals 16.5.0`
  - scripts: `"dev": "vite"`, `"typecheck": "tsc -p tsconfig.json"`, `"build": "npm run typecheck && vite build"`, `"preview": "vite preview --port 4173 --strictPort"`, `"lint": "eslint ."`, `"test": "vitest run"`, `"test:watch": "vitest"`, `"e2e": "playwright test"`.
  - `.gitignore`: `node_modules/`, `dist/`, `playwright-report/`, `test-results/`, `.vercel/`, `.DS_Store`.

- [ ] **Step 3: Install.** `npm install && npx playwright install chromium webkit` → exit 0, `package-lock.json` created.

- [ ] **Step 4: Write the configs.**
  - `tsconfig.json`: `target ES2022`, `lib ["ES2023","DOM","DOM.Iterable"]`, `module ESNext`, `moduleResolution Bundler`, `jsx react-jsx`, `strict true`, `noUncheckedIndexedAccess true`, `noEmit true`, `isolatedModules true`, `types ["vite/client","node"]`, `include ["src","tests","e2e","vite.config.ts","vitest.config.ts","playwright.config.ts"]`.
  - `vite.config.ts`: `plugins: [react(), tailwindcss()]`, `build: { target: 'es2022' }`.
  - `vitest.config.ts`: `test: { include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'], environment: 'node', env: { TZ: 'Pacific/Auckland' } }` (a zone far from Prague and with its own DST, so any accidental use of host local time in `core/` or `machine/` breaks a test; UI test files opt into jsdom with `// @vitest-environment jsdom`).
  - `playwright.config.ts`: `testDir: 'e2e'`, `webServer: { command: 'npm run build && npm run preview', port: 4173, reuseExistingServer: !process.env.CI, timeout: 120_000 }`, `use: { baseURL: 'http://localhost:4173' }`, projects `chromium` (Desktop Chrome) and `webkit` (Desktop Safari).
  - `eslint.config.js` (flat): ignores `dist`, `playwright-report`, `test-results`; `js.configs.recommended`, `tseslint.configs.recommended`, `reactHooks.configs.flat.recommended`, `languageOptions.globals: { ...globals.browser, ...globals.node }`; boundary rules (contracts §1 import rule):
    - `files: ['src/recreation/**']` → `'no-restricted-imports': ['error', { patterns: [{ group: ['**/app', '**/app/**', '**/desktop', '**/desktop/**'], message: 'recreation/ is self-contained (contracts §1).' }] }]`
    - `files: ['src/desktop/**']` → `patterns: [{ group: ['**/app', '**/app/**', '**/recreation/*', '!**/recreation/index'], message: 'desktop/ imports only the recreation public surface (recreation/index.ts).' }]`

- [ ] **Step 5: Write the failing token test** `tests/tokens.test.ts`:
  ```ts
  import { readFileSync } from 'node:fs';
  import { describe, expect, it } from 'vitest';

  const css = readFileSync(new URL('../src/tokens.css', import.meta.url), 'utf8');
  const tokens = new Map([...css.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));

  describe('tokens.css', () => {
    it.each([
      // page, landing spec §8 / jholec.com
      ['--jh-white', '#FFFFFF'], ['--jh-black', '#0A0A0A'], ['--jh-black-light', '#121212'],
      ['--jh-gray-light', '#EBEBEB'], ['--jh-gray-light-90', 'rgba(235, 235, 235, 0.9)'],
      ['--jh-gray-medium', '#757575'], ['--jh-gray', '#A8A8A8'], ['--jh-gray-dark', '#4D4D4D'],
      ['--jh-accent', '#0099FF'], ['--jh-text-label', '14px'], ['--jh-text-body', '16px'],
      ['--jh-text-body-l', '18px'], ['--jh-text-h3', '24px'], ['--jh-text-h2', '32px'], ['--jh-text-h1', '54px'],
      ['--jh-space-140', '140px'], ['--jh-space-160', '160px'], ['--jh-radius', '16px'], ['--jh-progress-height', '2px'],
      // recreation, Views/Theme.swift
      ['--pt', '1'], ['--qr-black', '#000000'], ['--qr-accent', '#0A84FF'], ['--qr-placeholder', '#59595D'],
      ['--qr-dashed-ring', '#59595D'], ['--qr-gray-circle', '#59595D'], ['--qr-gray-circle-disabled', '#474749'],
      ['--qr-pill-fill', 'rgba(255, 255, 255, 0.03)'], ['--qr-pill-stroke', '#3D3D3F'],
      ['--qr-flag-orange', '#FF9E0A'], ['--qr-error-red', '#FF453A'], ['--qr-padding', '20'], ['--qr-control-radius', '12'],
      ['--qr-list-reminders', '#0A84FF'], ['--qr-list-work', '#BF5AF2'], ['--qr-list-home', '#FF9F0A'],
      ['--qr-list-groceries', '#30D158'], ['--qr-list-ideas', '#FF375F'],
    ])('%s is %s', (name, value) => expect(tokens.get(name)).toBe(value));

    it('recreation font stack is the system stack (landing spec §3)', () =>
      expect(tokens.get('--qr-font')).toBe('-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Inter, sans-serif'));
  });
  ```
  and `tests/scaffold.test.ts`:
  ```ts
  import { expect, it } from 'vitest';
  it('runs in a non-Prague time zone so core code cannot lean on the host zone', () =>
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Pacific/Auckland'));
  ```

- [ ] **Step 6: Run** `npx vitest run tests/tokens.test.ts tests/scaffold.test.ts` → expected FAIL (`ENOENT … src/tokens.css`); `scaffold.test.ts` PASS.

- [ ] **Step 7: Write `src/tokens.css`** as the verbatim text of contracts §6.1 and §6.2 (the `:root` blocks and the `[data-section="dark"]` rule). Values cross-checked against `Views/Theme.swift`: accent 0x0A/0x84/0xFF, placeholder / dashedRing / grayCircle 0x59/0x59/0x5D, grayCircleDisabled 0x47/0x47/0x49, pillFill white 0.03, pillStroke 0x3D/0x3D/0x3F, flagOrange (1.0, 0.62, 0.04) = `#FF9E0A`; error red (1.0, 0.27, 0.23) = `#FF453A` (QuickReminderView).

- [ ] **Step 8: Run** `npx vitest run` → expected PASS (all of `tests/`).

- [ ] **Step 9: Write the failing e2e** `e2e/boot.spec.ts`:
  ```ts
  import { expect, test } from '@playwright/test';
  test('the page boots', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'QuickReminder' })).toBeVisible();
    await expect(page).toHaveTitle('QuickReminder — a reminder, straight out of the notch');
  });
  ```
  Run `npx playwright test` → expected FAIL (`vite build` has no `src/main.tsx` / `index.html` yet).

- [ ] **Step 10: Write `src/index.css`**: `@import "tailwindcss";` then `@theme inline` mapping `--color-jh-white: var(--jh-white)` … `--color-jh-accent: var(--jh-accent)` (the eight names in Produces), `--font-sans: var(--jh-font-sans)`, `--font-mono: var(--jh-font-mono)`, `--font-qr: var(--qr-font)`; base layer: `html { background: var(--jh-bg); color: var(--jh-fg); font-family: var(--jh-font-sans); }`; `.qr-font { font-family: var(--qr-font); -webkit-font-smoothing: antialiased; }`; `.qr-tabular { font-variant-numeric: tabular-nums; }`.
  `src/main.tsx` imports `@fontsource/inter/400.css`, `/500.css`, `/600.css`, `@fontsource/fragment-mono/400.css`, `./tokens.css`, `./index.css`, and mounts `<App/>` in `StrictMode` on `#root`. `src/App.tsx` renders `<main><h1>QuickReminder</h1></main>` (placeholder). `index.html`: `<title>QuickReminder — a reminder, straight out of the notch</title>`, `<meta name="viewport" content="width=device-width, initial-scale=1">`, `<div id="root">`.
  Run `npx playwright test` → expected PASS on chromium and webkit.

- [ ] **Step 11: Prove the boundary rule.** Create `src/recreation/__probe.ts` containing `import '../app/x';` and `src/desktop/__probe.ts` containing `import '../recreation/core/x';`, run `npx eslint src/recreation/__probe.ts src/desktop/__probe.ts` → expected two `no-restricted-imports` errors; delete both files; `npm run lint && npm run typecheck && npm run build` → exit 0.

- [ ] **Step 12: Write `README.md`** (stub): one-paragraph intent (landing spec §1), stack line (landing spec §4), commands (`npm run dev | test | e2e | lint | build`), "Source of truth: the app repo `holecjakub/QuickReminder` (SPEC.md and the Swift sources)", and the trademark disclaimer placeholder "QuickReminder is an independent app and is not affiliated with Apple Inc." (final wording from the app README in part 05).

- [ ] **Step 13: Commit.** `git add -A && git commit -m "chore: scaffold Vite, React 18, Tailwind, Vitest, Playwright and design tokens"`

---

## Task A2: `core/calendar.ts` — time-zone-safe calendar arithmetic + test support

**Files:**
- Create: `src/recreation/core/calendar.ts`, `tests/support.ts`
- Test: `tests/core/calendar.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (contracts §2.1, exact): `type Weekday`, `interface Calendar`, `interface DateComponents`, `currentCalendar(): Calendar`, `pragueCalendar: Calendar` (`{ timeZone: 'Europe/Prague', locale: 'cs-CZ', firstWeekday: 2 }`), `components`, `dateFrom`, `settingTime`, `startOfDay`, `startOfHour`, `startOfMonth`, `daysInMonth`, `addDays`, `addMonths`, `addMinutes`, `addHours`, `isSameDay`, `isSameMinute`, `daysBetween`, `weekdayOf`.
  `tests/support.ts` (port of `ScheduleTestSupport.swift`): `pragueCalendar` (re-export), `prague(year, month, day, hour = 0, minute = 0): Date` (throws on a non-date), `pragueString(date): string` (`"yyyy-MM-dd HH:mm"` in Prague), `plainSpaces(text): string` (U+202F and U+00A0 → U+0020).

Algorithm (not determined by the signatures):
- `offset(zone, t)` = `Date.UTC(wall parts of t)` − `t` (floored to the second), wall parts from a per-zone cached `Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year/month/day/hour/minute/second: 'numeric' }).formatToParts`.
- `components`: wall parts as above; `weekday = new Date(Date.UTC(y, m − 1, d)).getUTCDay() + 1`.
- `dateFrom`: validate month 1…12, day 1…daysInMonth, hour 0…23, minute/second 0…59, else `null`. `w = Date.UTC(wall)`, `o1 = offset(w − 12 h)`, `o2 = offset(w + 12 h)`; candidates `w − o1`, `w − o2` that read back as the requested wall time; two valid → the earlier (repeated time, first occurrence); one → it; none (gap) → `w − o1` (shifted forward by the gap, Foundation `date(from:)`).
- `settingTime` (`.nextTime`): same, but in a gap return the transition instant: the first whole minute in `[w − o2, w − o1]` whose offset is `o2` (bisection).
- `startOfHour(t)` = `t` − (wall minute · 60 + second) · 1000 − milliseconds (stays on the instant's own offset in a repeated hour).
- `addDays` / `addMonths`: shift the wall date (`Date.UTC` normalises day/month overflow; `addMonths` clamps the day to the target month's length), keep hour:minute:second, rebuild with `dateFrom`. `daysBetween` = (UTC midnight of `to`'s wall date − UTC midnight of `from`'s) / 86 400 000.
- `currentCalendar()` = `{ timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, locale: 'en-US', firstWeekday: 1 }` (contracts §8.2).

- [ ] **Step 1: Write the failing test** `tests/core/calendar.test.ts` (TS-only; the behaviours the Swift tests rely on, Prague DST days: 29 Mar 2026 02:00→03:00, 25 Oct 2026 03:00→02:00, 28 Mar 2027):
  ```ts
  import { describe, expect, it } from 'vitest';
  import { addDays, addHours, addMonths, components, currentCalendar, dateFrom, daysBetween, daysInMonth,
    isSameDay, isSameMinute, pragueCalendar as cal, settingTime, startOfDay, startOfHour, startOfMonth, weekdayOf } from '../../src/recreation/core/calendar';
  import { prague, pragueString } from '../support';

  describe('calendar', () => {
    it('componentsReadTheWallClockOfTheZone', () =>
      expect(components(cal, new Date('2026-10-23T08:00:00Z'))).toEqual({ year: 2026, month: 10, day: 23, hour: 10, minute: 0, second: 0, weekday: 6 }));
    it('dateFromBuildsTheInstant', () =>
      expect(dateFrom(cal, { year: 2026, month: 10, day: 23, hour: 10, minute: 0 })?.toISOString()).toBe('2026-10-23T08:00:00.000Z'));
    it('dateFromShiftsASkippedTimeByTheGap', () =>
      expect(dateFrom(cal, { year: 2026, month: 3, day: 29, hour: 2, minute: 30 })?.toISOString()).toBe('2026-03-29T01:30:00.000Z')); // 03:30 CEST
    it('dateFromTakesTheFirstOfARepeatedTime', () =>
      expect(dateFrom(cal, { year: 2026, month: 10, day: 25, hour: 2, minute: 30 })?.toISOString()).toBe('2026-10-25T00:30:00.000Z')); // CEST
    it('dateFromRejectsImpossibleDates', () => {
      expect(dateFrom(cal, { year: 2026, month: 2, day: 31 })).toBeNull();
      expect(dateFrom(cal, { year: 2026, month: 4, day: 31 })).toBeNull();
      expect(dateFrom(cal, { year: 2026, month: 13, day: 1 })).toBeNull();
      expect(dateFrom(cal, { year: 2026, month: 1, day: 1, hour: 24 })).toBeNull();
    });
    it('settingTimeSnapsASkippedTimeToTheNextValidInstant', () =>
      expect(settingTime(cal, prague(2027, 3, 28), 2, 30).toISOString()).toBe('2027-03-28T01:00:00.000Z')); // 03:00 CEST
    it('settingTimeOnAnOrdinaryDay', () => expect(settingTime(cal, prague(2026, 10, 23, 15), 9, 5)).toEqual(prague(2026, 10, 23, 9, 5)));
    it('startOfDayOnTheFallBackDay', () => expect(startOfDay(cal, new Date('2026-10-25T14:00:00Z')).toISOString()).toBe('2026-10-24T22:00:00.000Z'));
    it('startOfHourAndMonth', () => {
      expect(startOfHour(cal, new Date('2026-10-23T08:44:30.500Z')).toISOString()).toBe('2026-10-23T08:00:00.000Z');
      expect(startOfMonth(cal, prague(2026, 10, 23, 10))).toEqual(prague(2026, 10, 1));
    });
    it('daysInMonth', () => {
      expect(daysInMonth(cal, prague(2028, 2, 10))).toBe(29);
      expect(daysInMonth(cal, prague(2026, 2, 10))).toBe(28);
      expect(daysInMonth(cal, prague(2026, 10, 10))).toBe(31);
    });
    it('addDaysKeepsTheWallClockAcrossDST', () => {
      expect(pragueString(addDays(cal, prague(2026, 10, 24, 9), 2))).toBe('2026-10-26 09:00');
      expect(addDays(cal, prague(2026, 10, 24, 9), 2).toISOString()).toBe('2026-10-26T08:00:00.000Z');
    });
    it('addMonthsClampsLikeFoundation', () => {
      expect(addMonths(cal, prague(2026, 1, 31, 12), 1)).toEqual(prague(2026, 2, 28, 12));
      expect(addMonths(cal, prague(2028, 1, 31, 12), 1)).toEqual(prague(2028, 2, 29, 12));
      expect(addMonths(cal, prague(2026, 12, 15), 1)).toEqual(prague(2027, 1, 15));
    });
    it('addHoursIsAbsolute', () => {
      const later = addHours(prague(2026, 10, 25, 1, 30), 2);
      expect(later.toISOString()).toBe('2026-10-25T01:30:00.000Z');
      expect(pragueString(later)).toBe('2026-10-25 02:30'); // the second 02:30 (CET)
    });
    it('sameDayAndSameMinute', () => {
      expect(isSameDay(cal, prague(2026, 10, 23, 0), prague(2026, 10, 23, 23, 59))).toBe(true);
      expect(isSameDay(cal, prague(2026, 10, 23, 23, 59), prague(2026, 10, 24))).toBe(false);
      expect(isSameMinute(cal, prague(2026, 10, 23, 10), new Date(prague(2026, 10, 23, 10).getTime() + 59_000))).toBe(true);
      expect(isSameMinute(cal, prague(2026, 10, 23, 10), prague(2026, 10, 23, 10, 1))).toBe(false);
    });
    it('daysBetweenCountsCalendarDays', () => {
      expect(daysBetween(cal, prague(2026, 10, 24, 17, 39), prague(2026, 10, 31, 9))).toBe(7);
      expect(daysBetween(cal, prague(2026, 10, 24, 17, 39), prague(2026, 10, 23, 9))).toBe(-1);
      expect(daysBetween(cal, prague(2026, 10, 24, 0), prague(2026, 10, 24, 23))).toBe(0);
    });
    it('weekdayOfUsesFoundationNumbering', () => {
      expect(weekdayOf(cal, prague(2026, 10, 25))).toBe(1); // Sunday
      expect(weekdayOf(cal, prague(2026, 10, 24))).toBe(7); // Saturday
    });
    it('currentCalendarIsTheVisitorsZoneInEnUS', () =>
      expect(currentCalendar()).toEqual({ timeZone: 'Pacific/Auckland', locale: 'en-US', firstWeekday: 1 }));
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/core/calendar.test.ts` → expected FAIL (module missing).
- [ ] **Step 3: Implement** `src/recreation/core/calendar.ts` with the contract §2.1 signatures and the algorithm above; then `tests/support.ts` with the four helpers in Produces.
- [ ] **Step 4: Run** `npx vitest run tests/core/calendar.test.ts` → expected PASS (17 tests).
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(core): time-zone-safe calendar arithmetic and Prague test support"`

---

## Task A3: `core/scheduleDefaults.ts` + `recreation/clock.ts`

**Files:**
- Create: `src/recreation/core/scheduleDefaults.ts`, `src/recreation/clock.ts`
- Test: `tests/core/scheduleDefaults.test.ts`

**Interfaces:**
- Consumes: A2 `Calendar`, `components`, `dateFrom`, `settingTime`, `startOfDay`, `startOfHour`, `addDays`, `addMinutes`, `isSameDay`.
- Produces (contracts §2.3): `DayPart = { morningHour: 9, afternoonHour: 15, eveningHour: 19, nightHour: 20 } as const`; `ScheduleDefaults = { dayOnlyHour: 9, nextSlot(now, calendar, granularity = 30, minLeadSeconds = 900): Date, resolveDayOnly(day, now, calendar): Date, compose(day, time, calendar): Date, at(hour, minute, day, calendar): Date } as const`. In `clock.ts`: `type Clock = () => Date`; `AppClock = { parse(raw: string, timeZone: string): Date | null; now(): Date }`; `createClock(opts: { search: string; timeZone: string; realNow?: () => number }): Clock` (reads `now=` from the query string once; offset = parsed − realNow at creation; returns `() => new Date(realNow() + offset)`; no or unparseable `now=` → offset 0). `AppClock.now` lazily creates its clock from `window.location.search` and `Intl.DateTimeFormat().resolvedOptions().timeZone` (`search: ''` outside a browser).

Rules (Swift `ScheduleDefaults.swift`): `nextSlot`: `earliest = now + minLead`; `slot = startOfHour(earliest)`; while `slot < earliest` add `granularity` minutes (absolute). `resolveDayOnly`: `morning = at(9, 0, day)`; `morning > now` → morning; else `slot = nextSlot(now)`; same day as `now` → slot; else `at(9, 0, startOfDay(now) + 1 day)`. `compose`: hour:minute of `time` (wall) through `at`. `at`: `dateFrom` with the day's y/m/d, `second 0`; `null` → `settingTime`. `AppClock.parse`: first ISO 8601 with seconds and a zone (`/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:?\d{2})$/`, Swift `ISO8601DateFormatter` default), then the local forms `yyyy-MM-dd'T'HH:mm:ss`, `yyyy-MM-dd'T'HH:mm`, `yyyy-MM-dd HH:mm` in `timeZone`; else `null`.

Swift cases mirrored (`ScheduleDefaultsTests.swift`): `nextSlot` (5 arguments), `nextSlotIgnoresSeconds`, `resolveDayOnlyFutureDayIsNine`, `resolveDayOnlyToday` (3 arguments), `composeKeepsDayAndTime`, `composeSkippedTimeMovesForward`, `composeRepeatedTimeTakesFirst`, `appClockParsesLocalAndISO`.

- [ ] **Step 1: Write the failing test** `tests/core/scheduleDefaults.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';
  import { DayPart, ScheduleDefaults } from '../../src/recreation/core/scheduleDefaults';
  import { AppClock, createClock } from '../../src/recreation/clock';
  import { prague, pragueCalendar as cal, pragueString } from '../support';

  describe('ScheduleDefaultsTests', () => {
    it.each([
      [[14, 0], '2026-10-20 14:30'], [[14, 12], '2026-10-20 14:30'], [[14, 15], '2026-10-20 14:30'],
      [[14, 20], '2026-10-20 15:00'], [[23, 50], '2026-10-21 00:30'],
    ] as const)('nextSlot %j → %s', ([h, m], expected) =>
      expect(pragueString(ScheduleDefaults.nextSlot(prague(2026, 10, 20, h, m), cal))).toBe(expected));
    it('nextSlotIgnoresSeconds', () =>
      expect(pragueString(ScheduleDefaults.nextSlot(new Date(prague(2026, 10, 20, 14, 15).getTime() + 1000), cal))).toBe('2026-10-20 15:00'));
    it('resolveDayOnlyFutureDayIsNine', () =>
      expect(pragueString(ScheduleDefaults.resolveDayOnly(prague(2026, 10, 23), prague(2026, 10, 20, 15, 0), cal))).toBe('2026-10-23 09:00'));
    it.each([[[8, 0], '2026-10-20 09:00'], [[10, 5], '2026-10-20 10:30'], [[23, 40], '2026-10-21 09:00']] as const)(
      'resolveDayOnlyToday %j → %s', ([h, m], expected) =>
        expect(pragueString(ScheduleDefaults.resolveDayOnly(prague(2026, 10, 20), prague(2026, 10, 20, h, m), cal))).toBe(expected));
    it('composeKeepsDayAndTime', () =>
      expect(pragueString(ScheduleDefaults.compose(prague(2026, 11, 3, 18, 45), prague(2026, 10, 20, 7, 15), cal))).toBe('2026-11-03 07:15'));
    it('composeSkippedTimeMovesForward', () =>
      expect(pragueString(ScheduleDefaults.compose(prague(2026, 3, 29), prague(2026, 3, 28, 2, 30), cal))).toBe('2026-03-29 03:30'));
    it('composeRepeatedTimeTakesFirst', () => {
      const date = ScheduleDefaults.compose(prague(2026, 10, 25), prague(2026, 10, 24, 2, 30), cal);
      expect(pragueString(date)).toBe('2026-10-25 02:30');
      expect(date.toISOString()).toBe('2026-10-25T00:30:00.000Z'); // UTC+2, the first occurrence
    });
    it('appClockParsesLocalAndISO', () => {
      expect(AppClock.parse('2026-10-23T10:00', 'Europe/Prague')).toEqual(prague(2026, 10, 23, 10, 0));
      expect(AppClock.parse('2026-10-23T08:00:00Z', 'Europe/Prague')).toEqual(prague(2026, 10, 23, 10, 0));
      expect(AppClock.parse('tomorrow', 'Europe/Prague')).toBeNull();
    });
  });

  describe('scheduleDefaults (TS)', () => {
    it('dayPartHours', () => expect(DayPart).toEqual({ morningHour: 9, afternoonHour: 15, eveningHour: 19, nightHour: 20 }));
    it('dayOnlyHourIsTheMorning', () => expect(ScheduleDefaults.dayOnlyHour).toBe(9));
    it('appClockAcceptsTheSpaceForm', () => expect(AppClock.parse('2026-10-23 10:00', 'Europe/Prague')).toEqual(prague(2026, 10, 23, 10, 0)));
    it('createClockShiftsToTheQueryAndKeepsTicking', () => {
      let real = Date.UTC(2030, 0, 1);
      const clock = createClock({ search: '?debug=motion&now=2026-10-23T10:00', timeZone: 'Europe/Prague', realNow: () => real });
      expect(clock()).toEqual(prague(2026, 10, 23, 10, 0));
      real += 90_000;
      expect(pragueString(clock())).toBe('2026-10-23 10:01');
    });
    it('createClockWithoutAnOverrideIsRealTime', () =>
      expect(createClock({ search: '', timeZone: 'Europe/Prague', realNow: () => 42 })().getTime()).toBe(42));
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/core/scheduleDefaults.test.ts` → expected FAIL (modules missing).
- [ ] **Step 3: Implement** both files with the signatures and rules above.
- [ ] **Step 4: Run** the same command → expected PASS (19 tests).
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(core): ScheduleDefaults, DayPart and the ?now= AppClock"`

---

## Task A4: `core/datePresets.ts`

**Files:**
- Create: `src/recreation/core/datePresets.ts`
- Test: `tests/core/datePresets.test.ts`

**Interfaces:**
- Consumes: A2 `Calendar`, `Weekday`, `startOfDay`, `addDays`, `addMinutes`, `addMonths`, `startOfMonth`, `isSameDay`, `isSameMinute`, `weekdayOf`, `daysBetween`; A3 `ScheduleDefaults.at`, `ScheduleDefaults.dayOnlyHour`, `DayPart.eveningHour`.
- Produces (contracts §2.4, exact): `type DatePreset`, `DATE_PRESETS = ['inOneHour', 'evening', 'tomorrow', 'weekend', 'nextWeek', 'nextMonth']`, `interface PresetPick`, `DatePresets = { eveningCutoffMinutes: 30, date, title, menuTitle, systemImage, dayTemplate, highlighted, nextWeekday }`.

Rules (Swift `DatePresets.swift`): `inOneHour` = now + 60 min (absolute, minutes kept); `evening`: `tonight = at(19, 0, today)`; `now ≥ tonight − 30 min` → `at(19, 0, today + 1)` else tonight; `tomorrow` = `at(9, 0, today + 1)`; `weekend` = `at(9, 0, nextWeekday(7))`; `nextWeek` = `at(9, 0, nextWeekday(2))`; `nextMonth` = `at(9, 0, addMonths(startOfMonth(today), 1))`. `title`: evening → "This Evening" when `date(evening)` is the same day as now else "Tomorrow Evening"; weekend → "Next Weekend" when today's weekday is 7 or 1 else "This Weekend". `nextWeekday(w)`: `delta = (w − weekday(today) + 7) % 7`, 0 → 7; `startOfDay(today) + delta days`. `dayTemplate`: `days = daysBetween(now, date)`; 0 → null; 1…6 → `'EEE'` (`'EEEE'` spoken); otherwise (incl. the past) → `'d MMM'` (`'EEEE d MMMM'`). `highlighted`: with `same = isSameMinute`, the pick wins when `same(pick.date, draft) && same(date(pick.preset, now), draft)`; else the first of `DATE_PRESETS` with `same(date(p, now), draft)`; else null.

Swift cases mirrored (`DatePresetsTests.swift`): `mondayMorningResolvesAllSix`, `inOneHourKeepsMinutes`, `eveningSwitchesAtHalfPastSix`, `fridayEveningWeekendEqualsTomorrowBothListed`, `onTheWeekendItIsNextWeekend` (24, 25), `sundayNextWeekIsTomorrow`, `nextMonthRollsOver`, `menuTitlesKeepTheRemindMeRows`, `dayTemplateByDistance`, `onlyOnePresetIsHighlighted`, `aPickWhosePresetMovedOnIsDropped`. Deferred: `parity`, `tonightVersusEvening` → A6 (need the parser); `PresetDetailTests` → A12 (need the formatter).

- [ ] **Step 1: Write the failing test** `tests/core/datePresets.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';
  import { DATE_PRESETS, DatePresets, type DatePreset, type PresetPick } from '../../src/recreation/core/datePresets';
  import { ScheduleDefaults } from '../../src/recreation/core/scheduleDefaults';
  import { prague, pragueCalendar as cal, pragueString } from '../support';

  const date = (p: DatePreset, now: Date) => pragueString(DatePresets.date(p, now, cal));
  const title = (p: DatePreset, now: Date) => DatePresets.title(p, now, cal);

  describe('DatePresetsTests', () => {
    it('mondayMorningResolvesAllSix', () => {
      const now = prague(2026, 10, 19, 10, 0);
      expect(date('inOneHour', now)).toBe('2026-10-19 11:00');
      expect(date('evening', now)).toBe('2026-10-19 19:00');
      expect(date('tomorrow', now)).toBe('2026-10-20 09:00');
      expect(date('weekend', now)).toBe('2026-10-24 09:00');
      expect(date('nextWeek', now)).toBe('2026-10-26 09:00');
      expect(date('nextMonth', now)).toBe('2026-11-01 09:00');
      expect(title('evening', now)).toBe('This Evening');
      expect(title('weekend', now)).toBe('This Weekend');
    });
    it('inOneHourKeepsMinutes', () => expect(date('inOneHour', prague(2026, 10, 19, 14, 37))).toBe('2026-10-19 15:37'));
    it('eveningSwitchesAtHalfPastSix', () => {
      const before = prague(2026, 10, 19, 18, 29), after = prague(2026, 10, 19, 18, 30);
      expect(date('evening', before)).toBe('2026-10-19 19:00');
      expect(title('evening', before)).toBe('This Evening');
      expect(date('evening', after)).toBe('2026-10-20 19:00');
      expect(title('evening', after)).toBe('Tomorrow Evening');
    });
    it('fridayEveningWeekendEqualsTomorrowBothListed', () => {
      const now = prague(2026, 10, 23, 17, 0);
      expect(date('weekend', now)).toBe('2026-10-24 09:00');
      expect(date('weekend', now)).toBe(date('tomorrow', now));
      expect(DATE_PRESETS).toHaveLength(6);
    });
    it.each([24, 25])('onTheWeekendItIsNextWeekend (%i Oct)', (day) => {
      const now = prague(2026, 10, day, 11, 0);
      expect(title('weekend', now)).toBe('Next Weekend');
      const expected = DatePresets.nextWeekday(7, now, cal);
      expect(date('weekend', now)).toBe(pragueString(ScheduleDefaults.at(9, 0, expected, cal)));
      expect(date('weekend', now)).toBe('2026-10-31 09:00');
    });
    it('sundayNextWeekIsTomorrow', () => expect(date('nextWeek', prague(2026, 10, 25, 11, 0))).toBe('2026-10-26 09:00'));
    it('nextMonthRollsOver', () => {
      expect(date('nextMonth', prague(2026, 1, 31, 12, 0))).toBe('2026-02-01 09:00');
      expect(date('nextMonth', prague(2026, 12, 15, 12, 0))).toBe('2027-01-01 09:00');
    });
    it('menuTitlesKeepTheRemindMeRows', () => {
      const now = prague(2026, 10, 19, 10, 0);
      expect(DatePresets.menuTitle('inOneHour', now, cal)).toBe('Remind Me In 1 Hour');
      expect(DatePresets.menuTitle('tomorrow', now, cal)).toBe('Remind Me Tomorrow');
      expect(DatePresets.menuTitle('nextWeek', now, cal)).toBe('Next Week');
    });
    it('dayTemplateByDistance', () => {
      const now = prague(2026, 10, 24, 17, 39); // Saturday
      const t = (d: Date, spoken = false) => DatePresets.dayTemplate(d, now, cal, spoken);
      expect(t(prague(2026, 10, 24, 19, 0))).toBeNull();
      expect(t(prague(2026, 10, 25, 9, 0))).toBe('EEE');
      expect(t(prague(2026, 10, 30, 9, 0))).toBe('EEE');
      expect(t(prague(2026, 10, 31, 9, 0))).toBe('d MMM');
      expect(t(prague(2026, 10, 31, 9, 0), true)).toBe('EEEE d MMMM');
      expect(t(prague(2026, 10, 23, 9, 0))).toBe('d MMM');
    });
    it('onlyOnePresetIsHighlighted', () => {
      const now = prague(2026, 10, 23, 10, 0), saturday = prague(2026, 10, 24, 9, 0);
      const pick = (preset: DatePreset): PresetPick => ({ preset, date: DatePresets.date(preset, now, cal) });
      expect(DatePresets.highlighted(saturday, null, now, cal)).toBe('tomorrow');
      expect(DatePresets.highlighted(saturday, pick('weekend'), now, cal)).toBe('weekend');
      expect(DatePresets.highlighted(saturday, pick('tomorrow'), now, cal)).toBe('tomorrow');
      expect(DatePresets.highlighted(prague(2026, 10, 24, 14, 0), pick('weekend'), now, cal)).toBeNull();
      expect(DatePresets.highlighted(prague(2026, 10, 26, 9, 0), pick('weekend'), now, cal)).toBe('nextWeek');
    });
    it('aPickWhosePresetMovedOnIsDropped', () => {
      const picked: PresetPick = { preset: 'inOneHour', date: prague(2026, 10, 23, 11, 0) };
      expect(DatePresets.highlighted(picked.date, picked, prague(2026, 10, 23, 10, 0), cal)).toBe('inOneHour');
      expect(DatePresets.highlighted(picked.date, picked, prague(2026, 10, 23, 10, 30), cal)).toBeNull();
    });
  });

  describe('datePresets (TS)', () => {
    it('displayOrderIsCmd1ToCmd6', () =>
      expect(DATE_PRESETS).toEqual(['inOneHour', 'evening', 'tomorrow', 'weekend', 'nextWeek', 'nextMonth']));
    it('systemImages', () =>
      expect(DATE_PRESETS.map(DatePresets.systemImage)).toEqual(['clock', 'moon', 'sunrise', 'sofa', 'calendar.badge.plus', 'calendar']));
    it('eveningCutoff', () => expect(DatePresets.eveningCutoffMinutes).toBe(30));
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/core/datePresets.test.ts` → expected FAIL (module missing).
- [ ] **Step 3: Implement** `datePresets.ts` per the rules.
- [ ] **Step 4: Run** → expected PASS (15 tests).
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(core): DatePresets with highlight, evening cutoff and weekend rules"`

---

## Task A5: `core/naturalDateParser.ts` — normalisation, days, dates, `removingMatch`

**Files:**
- Create: `src/recreation/core/naturalDateParser.ts`
- Test: `tests/core/naturalDateParser.test.ts`

**Interfaces:**
- Consumes: A2 `Calendar`, `dateFrom`, `startOfDay`, `addDays`, `addMonths`, `startOfMonth`, `components`; A4 `DatePresets.nextWeekday`.
- Produces (contracts §2.2, exact): `interface DateSuggestion { date; hasTime; matchedRange: { start; end }; matchedText }`; `NaturalDateParser = { maxLengthUTF16: 1000, parse(text, now, calendar): DateSuggestion | null, removingMatch(text, suggestion): string, disambiguate(hour): number } as const`. After this task `parse` handles day candidates only; A6 adds times and offsets.

Port rules (Swift `NaturalDateParser.swift`, lines cited):
- `parse` guards: `text.length > 1000` → null; `text.trim() === ''` → null.
- `normalize` (l.178): iterate graphemes (`Intl.Segmenter(undefined, { granularity: 'grapheme' })`); for each `g`: `folded = g.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')`; keep `folded` when `folded.length === g.length`, else `g.toLowerCase()` when that keeps the length, else `g`. The result has the same UTF-16 length as the input, so offsets map 1:1.
- `looksCzech` (l.235): any of `áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ` in the original, or any `normalized.split(/[^\p{L}]+/u)` word in `czechHintWords` (l.223, copy verbatim: `zitra zejtra dnes dneska pozitri vcera tyden tydne tydnu tydny mesic mesice hodina hodinu hodiny hodin minuta minutu minuty minut rano vecer vecera odpoledne dopoledne poledne pulnoc pulnoci pul pondeli pondelek utery streda stredu ctvrtek patek sobota sobotu nedele nedeli vikend vikendu pristi tento tuto ve za schuzka zubar lekar koupit zavolat napsat`).
- Word lists verbatim: `weekdayNumbers` (l.299), `monthNumbers` (l.309), `DANGLING_PUNCTUATION = , . ; : ! ? - – — ( ) [ ] { } " '` (l.198), `DANGLING_PREPOSITIONS = at on by for until till v ve o do na za od` (l.205). Alternations: weekday keys longer than 4 chars (full) and ≤ 4 (abbrev), each sorted by length descending then alphabetically; month keys sorted the same way.
- Regexes, flags `gu`, with `B = '(?<![\\p{L}])'`, `A = '(?![\\p{L}])'`, `YEAR = '20\\d{2}'` (copy as written):
  ```ts
  relativeDay = B + '(?:(?:next|pristi)\\s+(?:weekend|week|tyden|month|mesic)|day\\s+after\\s+tomorrow|pozitri|tomorrow|tmrw|tmr|zitra|zejtra|tonight|today|dneska|dnes|(?:this\\s+|tento\\s+|toto\\s+|o\\s+)?(?:weekend|vikendu|vikend))' + A
  weekday     = B + '(?:(?:(?:on|next|this|upcoming|v|ve|pristi|tento|tuto)\\s+)?(' + FULL + ')|(?:on|next|this|upcoming|v|ve|pristi|tento|tuto)\\s+(' + ABBR + '))' + A
  dottedDate  = '(?<![\\p{L}\\d.])(\\d{1,2})\\.\\s?(\\d{1,2})\\.(?:\\s?(' + YEAR + '))?(?![\\d])'
  slashDate   = '(?<![\\p{L}\\d/])(\\d{1,2})/(\\d{1,2})(?:/(' + YEAR + '))?(?![\\d/])'
  dayMonth    = '(?<![\\p{L}\\d])(\\d{1,2})\\.?\\s+(' + MONTHS + ')' + A + '(?:\\s+(' + YEAR + ')(?!\\d))?'
  monthDay    = B + '(' + MONTHS + ')\\s+(\\d{1,2})(?:st|nd|rd|th)?(?![\\p{L}\\d])(?:,?\\s+(' + YEAR + ')(?!\\d))?'
  ```
- `relativeDay(phrase)` (l.503), checked in this order on the normalised match: contains `month`|`mesic` → first of next month; `weekend`|`vikend` → `nextWeekday(7)`; `week`|`tyden` → `nextWeekday(2)`; `day after tomorrow`|`pozitri` → today + 2; `tomorrow`|`tmrw`|`tmr`|`zitra`|`zejtra` → today + 1; `tonight` → today with implied time 20:00 (`DayPart.nightHour`, used in A6); `today`|`dnes` → today.
- `resolveDate(day, month, year | null)` (l.550): month 1…12 and day 1…31 else null; `dateFrom` must succeed (no rollover); a given year must satisfy `|year − thisYear| ≤ 10` (`yearWindow`) and not be before today; no year → first year `thisYear + 0…8` (`yearSearchSpan`) whose date exists and is ≥ today.
- Slash dates: `czech ? (day = first, month = second) : (day = second, month = first)`.
- `dedupe` (l.265): sort by start ascending, then length descending; drop any candidate intersecting a kept one.
- Right-most wins: sort all candidates by start; take the last. A day-only result → `hasTime false`, `date = startOfDay`.
- `removingMatch` (l.124): `head = text.slice(0, start)`, `tail = text.slice(end)`; drop leading tail characters that are whitespace or in `DANGLING_PUNCTUATION`; `words = head.split(/\s+/u)` (non-empty); if the last word stripped of dangling punctuation at both ends is empty or `normalize(bare)` is in `DANGLING_PREPOSITIONS` → drop it; append the tail's words; trim trailing dangling punctuation off the final word (drop it when empty); `join(' ').trim()`.

Test helpers (top of the file, shared with A6): `ndpCalendar = { timeZone: 'Europe/Prague', locale: 'en-US', firstWeekday: 1 }` (Swift uses `TimeZone.current`; a fixed zone keeps the run deterministic, and no case falls on a DST change), `ndp(y, m, d, h = 0, min = 0)` via `dateFrom(ndpCalendar, …)`, `NOW = ndp(2026, 9, 18, 10, 0)` (Friday), `dc(text, y, m, d, h, min, hasTime, stripped?)`, `verify(c)` (parse → `date` equals `ndp(…)`, `hasTime` equals, and when `stripped` is given `removingMatch` equals it), `verifyNil(text)`.

Swift cases mirrored now (`NaturalDateParserTests.swift`): `relativeDays` (11), `weekdays` (7), `explicitDates` (10), `explicitDateNegatives` (3), `foldAlignmentAcrossMixedWidthCharacters`, `invalidDatesNeverRollOverNegatives` (5), `invalidDatesNeverRollOverPositives` (2), `rightMostPhraseWins`.

- [ ] **Step 1: Write the failing test** `tests/core/naturalDateParser.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';
  import { dateFrom, type Calendar } from '../../src/recreation/core/calendar';
  import { NaturalDateParser } from '../../src/recreation/core/naturalDateParser';

  const ndpCalendar: Calendar = { timeZone: 'Europe/Prague', locale: 'en-US', firstWeekday: 1 };
  const ndp = (y: number, m: number, d: number, h = 0, min = 0) => dateFrom(ndpCalendar, { year: y, month: m, day: d, hour: h, minute: min })!;
  const NOW = ndp(2026, 9, 18, 10, 0);
  type DateCase = { text: string; y: number; m: number; d: number; h: number; min: number; hasTime: boolean; stripped?: string };
  const dc = (text: string, y: number, m: number, d: number, h: number, min: number, hasTime: boolean, stripped?: string): DateCase =>
    ({ text, y, m, d, h, min, hasTime, stripped });
  function verify(c: DateCase) {
    const s = NaturalDateParser.parse(c.text, NOW, ndpCalendar);
    expect(s, `"${c.text}" should parse`).not.toBeNull();
    expect(s!.date).toEqual(ndp(c.y, c.m, c.d, c.h, c.min));
    expect(s!.hasTime).toBe(c.hasTime);
    if (c.stripped !== undefined) expect(NaturalDateParser.removingMatch(c.text, s!)).toBe(c.stripped);
  }
  const verifyNil = (text: string) => expect(NaturalDateParser.parse(text, NOW, ndpCalendar)).toBeNull();

  describe('NaturalDateParserTests', () => {
    it.each([
      dc('zavolat mámě zítra', 2026, 9, 19, 0, 0, false, 'zavolat mámě'),
      dc('tmrw', 2026, 9, 19, 0, 0, false), dc('day after tomorrow', 2026, 9, 20, 0, 0, false),
      dc('pozítří', 2026, 9, 20, 0, 0, false), dc('dnes', 2026, 9, 18, 0, 0, false), dc('dneska', 2026, 9, 18, 0, 0, false),
      dc('next week', 2026, 9, 21, 0, 0, false), dc('příští týden', 2026, 9, 21, 0, 0, false),
      dc('next month', 2026, 10, 1, 0, 0, false), dc('this weekend', 2026, 9, 19, 0, 0, false),
      dc('o víkendu', 2026, 9, 19, 0, 0, false),
    ])('relativeDays "$text"', verify);

    it.each([
      dc('meeting on friday', 2026, 9, 25, 0, 0, false, 'meeting'), dc('next friday', 2026, 9, 25, 0, 0, false),
      dc('MONDAY', 2026, 9, 21, 0, 0, false), dc('v pondělí', 2026, 9, 21, 0, 0, false, ''),
      dc('ve středu', 2026, 9, 23, 0, 0, false), dc('příští pátek', 2026, 9, 25, 0, 0, false),
      dc('lunch on sat', 2026, 9, 19, 0, 0, false, 'lunch'),
    ])('weekdays "$text"', verify);

    it.each([
      dc('12. března', 2027, 3, 12, 0, 0, false), dc('March 12', 2027, 3, 12, 0, 0, false), dc('Mar 12', 2027, 3, 12, 0, 0, false),
      dc('12 March', 2027, 3, 12, 0, 0, false), dc('12. 3.', 2027, 3, 12, 0, 0, false), dc('12.3.2027', 2027, 3, 12, 0, 0, false),
      dc('Buy milk tomorrow', 2026, 9, 19, 0, 0, false, 'Buy milk'), dc('dentist 3/12', 2027, 3, 12, 0, 0, false, 'dentist'),
      dc('zubař 3.12.', 2026, 12, 3, 0, 0, false, 'zubař'), dc('odevzdat do 5. prosince', 2026, 12, 5, 0, 0, false),
    ])('explicitDates "$text"', verify);

    it.each(['12.3.2026', 'I sat on the bench', 'mon amour'])('explicitDateNegatives "%s"', verifyNil);

    it('foldAlignmentAcrossMixedWidthCharacters', () =>
      expect(NaturalDateParser.parse('ŉ zítra é', NOW, ndpCalendar)?.matchedText).toBe('zítra'));

    it.each(['30.2.', '31. února', '31. dubna', '31 April', '12.3.2040'])('invalidDatesNeverRollOverNegatives "%s"', verifyNil);

    it.each([
      dc('29.2.', 2028, 2, 29, 0, 0, false),
      dc('12 March 1000 items', 2027, 3, 12, 0, 0, false, '1000 items'),
    ])('invalidDatesNeverRollOverPositives "$text"', verify);

    it('rightMostPhraseWins', () => {
      const s = NaturalDateParser.parse('tomorrow report for friday', NOW, ndpCalendar)!;
      expect(['for friday', 'friday']).toContain(s.matchedText);
      expect(s.date).toEqual(ndp(2026, 9, 25));
    });
  });

  describe('naturalDateParser (TS)', () => {
    it('cutsOffPathologicalPastes', () => {
      expect(NaturalDateParser.parse('a'.repeat(991) + ' tomorrow', NOW, ndpCalendar)?.matchedText).toBe('tomorrow'); // 1000 units
      expect(NaturalDateParser.parse('a'.repeat(992) + ' tomorrow', NOW, ndpCalendar)).toBeNull();                    // 1001 units
    });
    it('matchedRangeIsUTF16OffsetsIntoTheOriginal', () => {
      const text = 'zavolat mámě zítra';
      const s = NaturalDateParser.parse(text, NOW, ndpCalendar)!;
      expect(s.matchedRange).toEqual({ start: 13, end: 18 });
      expect(text.slice(s.matchedRange.start, s.matchedRange.end)).toBe(s.matchedText);
    });
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/core/naturalDateParser.test.ts` → expected FAIL (module missing).
- [ ] **Step 3: Implement** the parser skeleton (normalise, `looksCzech`, the six day regexes, `relativeDay`, `resolveDate`, `dedupe`, right-most selection for day candidates) and `removingMatch`; `disambiguate(hour)` = `1 ≤ hour ≤ 6 ? hour + 12 : hour`.
- [ ] **Step 4: Run** → expected PASS (42 tests).
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(core): NaturalDateParser days, dates and phrase removal (EN + CZ)"`

---

## Task A6: `core/naturalDateParser.ts` — times, offsets, merging, DST + preset parity

**Files:**
- Modify: `src/recreation/core/naturalDateParser.ts`
- Test: `tests/core/naturalDateParser.test.ts` (extend), `tests/core/datePresets.test.ts` (extend)

**Interfaces:**
- Consumes: A2 `settingTime`, `addHours`, `addMinutes`, `addDays`, `addMonths`, `startOfDay`; A3 `DayPart`, `ScheduleDefaults.resolveDayOnly`; A4 `DatePresets.date`.
- Produces: the complete `NaturalDateParser` of contracts §2.2 (no new exports).

Port rules (Swift lines cited):
- Regexes (flags `gu`; `SUFFIX = '(rano|dopoledne|odpoledne|vecera|vecer|morning|afternoon|evening|night|in\\s+the\\s+morning|in\\s+the\\s+afternoon|in\\s+the\\s+evening)' + A`; `HALF` = keys of `czechHalfOrdinals` `jedne 1 druhe 2 treti 3 ctvrte 4 pate 5 seste 6 sedme 7 osme 8 devate 9 desate 10 jedenacte 11 dvanacte 12`, length-descending):
  ```ts
  timeWord      = B + '(?:in\\s+the\\s+(morning|afternoon|evening)|(?:at\\s+)?(noon|midnight)|(?:v\\s+)?(poledne)|(?:o\\s+)?(pulnoci|pulnoc)|(rano|dopoledne|odpoledne|vecera|vecer)|(morning|afternoon|evening|night))' + A
  halfHour      = B + '(?:v\\s+)?pul\\s+(' + HALF + ')' + A + '(?:\\s+' + SUFFIX + ')?'
  numericTime   = '(?<![\\p{L}\\d])(?:(at|v|ve)\\s+)?(\\d{1,2})(?::(\\d{2})|\\.(\\d{2})(?!\\d|\\.\\d))?(?!\\d)(?:\\s*(am|pm)(?![\\p{L}]))?(?:\\s+' + SUFFIX + ')?'
  englishOffset = B + 'in\\s+(?:(\\d{1,3})|an|a)\\s+(hours|hour|hrs|hr|minutes|minute|mins|min|days|day|weeks|week|months|month)' + A
  czechOffset   = B + 'za\\s+(?:(\\d{1,3})\\s+)?(hodinu|hodiny|hodin|minutu|minuty|minut|dny|dni|dnu|den|tydny|tydnu|tyden|mesice|mesicu|mesic)' + A
  ```
- `dayPartTimes` (l.336): `rano 9, dopoledne 10, poledne 12, odpoledne 15, vecer 19, vecera 19, pulnoc 0, pulnoci 0, noon 12, midnight 0, morning 9, afternoon 15, evening 19, night 20` (all :00; 9/15/19/20 from `DayPart`).
- Numeric time (l.582): groups 1 prefix, 2 hour, 3/4 minutes, 5 am|pm, 6 suffix. No prefix, meridiem, minutes or suffix → skip (bare numbers are never times); minute ≥ 60 or hour > 23 → skip; meridiem: hour must be 1…12, `pm` → 12 stays 12 else +12, `am` → 12 → 0; else suffix → `shifted(hour, suffix)`; else `disambiguate(hour)`; result > 23 → skip; `explicit = meridiem || minutes || suffix`.
- Half hour (l.609): ordinal 1 → 12, else `disambiguate(ordinal − 1)`; suffix → `shifted`; minute 30.
- `dayPartKey(suffix)` (l.636): first of `afternoon` → `odpoledne`, `evening`/`night` → `vecer`, `morning` → `rano` contained in the suffix; else the suffix itself when it is a table key. `shifted(hour, suffix)` = table hour ≥ 12 and hour < 12 → hour + 12.
- Candidate classes and precedence (l.67): offsets; days not overlapping offsets; times not overlapping offsets or days; each class deduped.
- Offset dates (l.714): unit prefix `hod`/`hour`/`hr` → absolute hours (keeps time); `min` → absolute minutes; `day`/`den`/`dn` → `addDays`, `hasTime false`; `week`/`tyd` → `addDays(7·n)`, `hasTime false`; `month`/`mesic` → `addMonths`, `hasTime false`; day-sized results are `startOfDay`. Missing amount → 1.
- Merge (l.81): last is a time and the previous candidate is adjacent (gap ≤ 3 UTF-16 units, only whitespace or `,`) and offers a day (a day, or a day-sized offset as its start of day) → union range, `merge(time, day)`; a lone time → `timeOnly` (today via `settingTime`, strictly after now, else tomorrow). Last is a day and the previous is an adjacent time → union, merge. A day with an implied time (`tonight`) → `settingTime(20:00)`. `merge`: a non-explicit hour < 12 next to a day whose implied hour ≥ 12 → +12. Every time application goes through `settingTime` (`.nextTime`: a skipped 02:30 → 03:00).

Swift cases mirrored (`NaturalDateParserTests.swift`): `dayAndTime` (8), `times` (13), `relativeOffsets` (12), `sentenceFinalPeriodAfterTime` (2), `englishDayParts` (5), `hourDisambiguationWithEveningContext` (5), `offsetMergedWithTime` (2), `removingMatchKeepsRealTitleWords` (7), `dstSpringForwardEuropePrague`, `negatives` (7), `dayAndTimeMergeIntoOneRange`. From `DatePresetsTests.swift`: `parity` (7 phrases × 3 nows), `tonightVersusEvening`.

- [ ] **Step 1: Write the failing tests** — append to `describe('NaturalDateParserTests')` in `tests/core/naturalDateParser.test.ts`:
  ```ts
  it.each([
    dc('Buy milk tomorrow at 2pm', 2026, 9, 19, 14, 0, true, 'Buy milk'), dc('koupit mléko zítra ve 14:00', 2026, 9, 19, 14, 0, true, 'koupit mléko'),
    dc('zitra v 8 rano', 2026, 9, 19, 8, 0, true, ''), dc('zítra v 8 ráno', 2026, 9, 19, 8, 0, true),
    dc('Call mom tomorrow 2pm', 2026, 9, 19, 14, 0, true, 'Call mom'), dc('at 2pm tomorrow', 2026, 9, 19, 14, 0, true, ''),
    dc('schůzka v úterý ráno', 2026, 9, 22, 9, 0, true, 'schůzka'), dc('call mom tonight', 2026, 9, 18, 20, 0, true, 'call mom'),
  ])('dayAndTime "$text"', verify);

  it.each([
    dc('meeting at 14:00', 2026, 9, 18, 14, 0, true, 'meeting'), dc('at 9', 2026, 9, 19, 9, 0, true), dc('noon', 2026, 9, 18, 12, 0, true),
    dc('midnight', 2026, 9, 19, 0, 0, true), dc('o půlnoci', 2026, 9, 19, 0, 0, true), dc('v poledne', 2026, 9, 18, 12, 0, true),
    dc('in the morning', 2026, 9, 19, 9, 0, true), dc('večer', 2026, 9, 18, 19, 0, true), dc('odpoledne', 2026, 9, 18, 15, 0, true),
    dc('ve 2 odpoledne', 2026, 9, 18, 14, 0, true), dc('v půl třetí', 2026, 9, 18, 14, 30, true), dc('ve 14.30', 2026, 9, 18, 14, 30, true),
    dc('call at 2:30pm', 2026, 9, 18, 14, 30, true, 'call'),
  ])('times "$text"', verify);

  it.each([
    dc('in 2 hours', 2026, 9, 18, 12, 0, true), dc('in an hour', 2026, 9, 18, 11, 0, true), dc('in 30 minutes', 2026, 9, 18, 10, 30, true),
    dc('in 3 days', 2026, 9, 21, 0, 0, false), dc('in a week', 2026, 9, 25, 0, 0, false), dc('za hodinu', 2026, 9, 18, 11, 0, true),
    dc('za 2 hodiny', 2026, 9, 18, 12, 0, true), dc('za 5 hodin', 2026, 9, 18, 15, 0, true), dc('za 30 minut', 2026, 9, 18, 10, 30, true),
    dc('za 3 dny', 2026, 9, 21, 0, 0, false), dc('za týden', 2026, 9, 25, 0, 0, false), dc('za 2 týdny', 2026, 10, 2, 0, 0, false),
  ])('relativeOffsets "$text"', verify);

  it.each([
    dc('ve 14.30.', 2026, 9, 18, 14, 30, true, ''), dc('meeting at 14.30.', 2026, 9, 18, 14, 30, true, 'meeting'),
  ])('sentenceFinalPeriodAfterTime "$text"', verify);

  it.each([
    dc('tomorrow evening', 2026, 9, 19, 19, 0, true, ''), dc('tomorrow morning', 2026, 9, 19, 9, 0, true, ''),
    dc('tomorrow night', 2026, 9, 19, 20, 0, true, ''), dc('call mom tomorrow evening', 2026, 9, 19, 19, 0, true, 'call mom'),
    dc('friday afternoon', 2026, 9, 25, 15, 0, true, ''),
  ])('englishDayParts "$text"', verify);

  it.each([
    dc('tonight at 8', 2026, 9, 18, 20, 0, true, ''), dc('12am', 2026, 9, 19, 0, 0, true), dc('12pm', 2026, 9, 18, 12, 0, true),
    dc('v 12 večer', 2026, 9, 18, 12, 0, true, ''), dc('půl třetí odpoledne', 2026, 9, 18, 14, 30, true, ''),
  ])('hourDisambiguationWithEveningContext "$text"', verify);

  it.each([
    dc('in 2 days at 3pm', 2026, 9, 20, 15, 0, true, ''), dc('za 3 dny v 9 ráno', 2026, 9, 21, 9, 0, true, ''),
  ])('offsetMergedWithTime "$text"', verify);

  it.each([
    dc('Fix this tomorrow', 2026, 9, 19, 0, 0, false, 'Fix this'), dc('check in tomorrow', 2026, 9, 19, 0, 0, false, 'check in'),
    dc('Log in at 3pm', 2026, 9, 18, 15, 0, true, 'Log in'), dc('Buy milk, tomorrow', 2026, 9, 19, 0, 0, false, 'Buy milk'),
    dc('Review this by friday', 2026, 9, 25, 0, 0, false, 'Review this'), dc('The report tomorrow', 2026, 9, 19, 0, 0, false, 'The report'),
    dc('odevzdat do 5. prosince', 2026, 12, 5, 0, 0, false, 'odevzdat'),
  ])('removingMatchKeepsRealTitleWords "$text"', verify);

  it('dstSpringForwardEuropePrague', () => {
    const prague: Calendar = { timeZone: 'Europe/Prague', locale: 'en-US', firstWeekday: 1 };
    const now = dateFrom(prague, { year: 2026, month: 9, day: 18, hour: 10 })!;
    const text = 'schůzka 28.3.2027 v 2:30 ráno';
    const s = NaturalDateParser.parse(text, now, prague)!;
    expect(s.date).toEqual(dateFrom(prague, { year: 2027, month: 3, day: 28, hour: 3 }));
    expect(s.hasTime).toBe(true);
    expect(NaturalDateParser.removingMatch(text, s)).toBe('schůzka');
  });

  it.each(['', '   ', 'buy 2 apples', 'iPhone 17', 'call 5 people', 'zavolat 3 lidem', 'write the summary'])('negatives "%s"', verifyNil);

  it('dayAndTimeMergeIntoOneRange', () => {
    const text = 'Buy milk tomorrow at 2pm';
    const s = NaturalDateParser.parse(text, NOW, ndpCalendar)!;
    expect(s.matchedText).toBe('tomorrow at 2pm');
    expect(text.slice(s.matchedRange.start, s.matchedRange.end)).toBe(s.matchedText);
  });
  ```
  and to `describe('naturalDateParser (TS)')`:
  ```ts
  it.each([[0, 0], [1, 13], [6, 18], [7, 7], [12, 12], [23, 23]])('disambiguate(%i) = %i', (h, e) => expect(NaturalDateParser.disambiguate(h)).toBe(e));
  ```
  and a new block at the end of `tests/core/datePresets.test.ts` (imports `NaturalDateParser`):
  ```ts
  describe('DatePresetsTests (parser parity)', () => {
    const nows = [prague(2026, 10, 19, 10, 0), prague(2026, 10, 23, 17, 0), prague(2026, 10, 25, 11, 0)];
    it.each([
      ['next week', 'nextWeek'], ['weekend', 'weekend'], ['this weekend', 'weekend'], ['tomorrow', 'tomorrow'],
      ['zítra', 'tomorrow'], ['příští týden', 'nextWeek'], ['next month', 'nextMonth'],
    ] as const)('parity "%s" ≡ %s', (phrase, preset) => {
      for (const now of nows) {
        const parsed = NaturalDateParser.parse(phrase, now, cal)!;
        expect(parsed.hasTime).toBe(false);
        expect(pragueString(ScheduleDefaults.resolveDayOnly(parsed.date, now, cal))).toBe(date(preset, now));
      }
    });
    it('tonightVersusEvening', () => {
      const now = prague(2026, 10, 19, 10, 0);
      expect(pragueString(NaturalDateParser.parse('tonight', now, cal)!.date)).toBe('2026-10-19 20:00');
      expect(date('evening', now)).toBe('2026-10-19 19:00');
    });
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/core/naturalDateParser.test.ts tests/core/datePresets.test.ts` → expected FAIL (the time, offset and merge cases and `tonightVersusEvening`; `negatives`, `disambiguate` and `parity` already pass, they pin behaviour A5 shipped).
- [ ] **Step 3: Implement** time and offset candidates, the precedence filter and the merge rules.
- [ ] **Step 4: Run** → expected PASS (naturalDateParser 111 tests, datePresets 23 tests).
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(core): NaturalDateParser times, offsets, merging and DST (EN + CZ)"`

---

## Task A7: `core/scheduleInput.ts`

**Files:**
- Create: `src/recreation/core/scheduleInput.ts`
- Test: `tests/core/scheduleInput.test.ts`

**Interfaces:**
- Consumes: A2 `startOfDay`, `addDays`, `addHours`, `addMinutes`; A3 `ScheduleDefaults.at`, `.resolveDayOnly`; A6 `NaturalDateParser.parse`, `.removingMatch`, `.disambiguate`.
- Produces (contracts §2.5, exact): `type ScheduleInputResult`, `ScheduleInput = { resolve(text, now, calendar): ScheduleInputResult }`, `WEEKDAY_ABBREVIATIONS: ReadonlySet<string>` (`mon tue tues wed weds thu thur thurs fri sat sun`).

Rules (Swift `ScheduleInput.swift`): `t = text.trim()`; empty → `{ type: 'empty' }`. If `t` matches `/^(\d{1,2})\.(\d{2})$/` with day 1…31 and month 10…12 → phrase `t + '.'`. Otherwise try the shorthands: all ASCII digits (`/^[0-9]+$/`) of length 1–2 → time(hour = t, minute 0), length 3–4 → time(hour = all but the last two, minute = last two), longer → not a shorthand; `/^(\d{1,2})[:.](\d{2})$/` → time; `/^\+(\d{1,3})\s*(m|min|h|d)$/i` → `d`: `resolveDayOnly(startOfDay(addDays(now, n)))`, `h`: now + n hours, else now + n minutes. `time(h, m)`: outside 0…23 / 0…59 → invalid; `h' = disambiguate(h)`; `at(h', m, today)` if after now else `at(h', m, today + 1)`. Not a shorthand → if the first space-separated word, lowercased, is in `WEEKDAY_ABBREVIATIONS` → phrase `'on ' + t`, else `t`. Parse the phrase; null → invalid; leftover = `removingMatch(phrase, s)` stripped of whitespace and `\p{P}` at both ends; non-empty → invalid; `hasTime` → date; else `resolveDayOnly(s.date)`.

Swift cases mirrored (`ScheduleInputTests.swift`, now = Fri 23 Oct 2026 10:00 Prague): `valid` (28 arguments), `offsetKeepsMinutes`, `bareHourAlreadyPastRollsToTomorrow`, `todayAfterNineIsNextSlot`, `invalid` (7), `empty` (3), `leniencyStaysOutOfTheTitleParser`.

- [ ] **Step 1: Write the failing test** `tests/core/scheduleInput.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';
  import { NaturalDateParser } from '../../src/recreation/core/naturalDateParser';
  import { ScheduleInput } from '../../src/recreation/core/scheduleInput';
  import { prague, pragueCalendar as cal, pragueString } from '../support';

  const NOW = prague(2026, 10, 23, 10, 0);
  const resolve = (text: string, now = NOW) => {
    const r = ScheduleInput.resolve(text, now, cal);
    return r.type === 'date' ? pragueString(r.date) : r.type;
  };

  describe('ScheduleInputTests', () => {
    it.each([
      ['zítra 14:00', '2026-10-24 14:00'], ['zitra 14:00', '2026-10-24 14:00'], ['next fri 9am', '2026-10-30 09:00'],
      ['fri 2pm', '2026-10-30 14:00'], ['sat', '2026-10-24 09:00'], ['v pátek', '2026-10-30 09:00'],
      ['next week', '2026-10-26 09:00'], ['tonight', '2026-10-23 20:00'], ['14', '2026-10-23 14:00'], ['3', '2026-10-23 15:00'],
      ['930', '2026-10-24 09:30'], ['1430', '2026-10-23 14:30'], ['14:30', '2026-10-23 14:30'], ['14.30', '2026-10-23 14:30'],
      ['+90m', '2026-10-23 11:30'], ['+2h', '2026-10-23 12:00'], ['+2 H', '2026-10-23 12:00'], ['+3d', '2026-10-26 09:00'],
      ['15.11.', '2026-11-15 09:00'], ['15.11', '2026-11-15 09:00'], ['24.12', '2026-12-24 09:00'], ['31.12', '2026-12-31 09:00'],
      ['1.12', '2026-12-01 09:00'], ['5.11', '2026-11-05 09:00'], ['8.05', '2026-10-24 08:05'], ['12:10', '2026-10-23 12:10'],
      ['tomorrow 2pm', '2026-10-24 14:00'], ['  zítra 14:00  ', '2026-10-24 14:00'],
    ])('valid "%s" → %s', (text, expected) => expect(resolve(text)).toBe(expected));
    it('offsetKeepsMinutes', () => expect(resolve('za 2 hodiny', prague(2026, 10, 23, 10, 17))).toBe('2026-10-23 12:17'));
    it('bareHourAlreadyPastRollsToTomorrow', () => expect(resolve('14', prague(2026, 10, 23, 15, 0))).toBe('2026-10-24 14:00'));
    it('todayAfterNineIsNextSlot', () => {
      expect(resolve('today', prague(2026, 10, 23, 10, 5))).toBe('2026-10-23 10:30');
      expect(resolve('dnes', prague(2026, 10, 23, 8, 0))).toBe('2026-10-23 09:00');
    });
    it.each(['buy milk tomorrow', '2500', '25:00', '14:75', 'abc', 'tomorrow please', '+5y'])('invalid "%s"', (t) => expect(resolve(t)).toBe('invalid'));
    it.each(['', '   ', '\n\t'])('empty %j', (t) => expect(resolve(t)).toBe('empty'));
    it('leniencyStaysOutOfTheTitleParser', () => {
      expect(NaturalDateParser.parse('buy 2 apples', NOW, cal)).toBeNull();
      expect(NaturalDateParser.parse('1430', NOW, cal)).toBeNull();
      expect(NaturalDateParser.parse('+2h', NOW, cal)).toBeNull();
    });
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/core/scheduleInput.test.ts` → expected FAIL (module missing).
- [ ] **Step 3: Implement** `scheduleInput.ts` per the rules.
- [ ] **Step 4: Run** → expected PASS (42 tests).
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(core): ScheduleInput whole-input reading with picker shorthands"`

---

## Task A8: `core/scheduleCommit.ts`

**Files:**
- Create: `src/recreation/core/scheduleCommit.ts`
- Test: `tests/core/scheduleCommit.test.ts`

**Interfaces:**
- Consumes: A4 `DatePresets.date`; A7 `ScheduleInput.resolve`, `ScheduleInputResult`.
- Produces (contracts §2.6, exact; D6): `type ScheduleAction = 'set' | 'preset' | 'cancel' | 'clear'`, `type TextRowSubmit = 'setSchedule' | 'saveReminder' | 'none'`, `ScheduleCommit = { opening, textRowSubmit, dateToSet, consumesSuggestion }`.

Rules (Swift `ScheduleCommit.swift`): `opening`: `selected` → `{ draft: selected, text: '' }`; `phrase = initialText` trimmed of `.whitespaces` (`/^[\p{Zs}\t]+|[\p{Zs}\t]+$/gu`, no newlines); empty/null → `{ tomorrow 9:00, '' }`; `resolve(phrase)` is a date → `{ that date, phrase }`; else `{ tomorrow 9:00, phrase }`. `textRowSubmit`: scheduling → `'setSchedule'`; else `canSave ? 'saveReminder' : 'none'`. `dateToSet`: invalid → null, date → it, empty → draft. `consumesSuggestion`: same trim; empty/null → false; `set`/`preset` → true; `cancel`/`clear` → false.

Swift cases mirrored (`ScheduleCommitTests.swift`): `ScheduleCommitTests.setWritesTheParsedDateOrTheDraft`, `anyDateWriteConsumesThePrefilledPhrase` (set, preset), `cancelAndClearKeepTheTitle` (cancel, clear), `noSuggestionNothingToConsume` (null, "", "  "); `ScheduleOpeningTests.anExistingDateWinsAndTheFieldStartsEmpty`, `aLiveSuggestionIsPrefilledAndDrivesTheDraft`, `otherwiseTomorrowMorning`, `anUnreadablePhraseStaysInTheFieldOverTomorrow`; `TextRowSubmitTests.returnInTheTitleCommitsTheOpenSection`.

- [ ] **Step 1: Write the failing test** `tests/core/scheduleCommit.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';
  import { ScheduleCommit, type ScheduleAction } from '../../src/recreation/core/scheduleCommit';
  import { prague, pragueCalendar as cal, pragueString } from '../support';

  describe('ScheduleCommitTests', () => {
    const draft = prague(2026, 10, 24, 9, 0);
    it('setWritesTheParsedDateOrTheDraft', () => {
      const typed = prague(2026, 10, 25, 16, 0);
      expect(ScheduleCommit.dateToSet({ type: 'date', date: typed }, draft)).toEqual(typed);
      expect(ScheduleCommit.dateToSet({ type: 'empty' }, draft)).toEqual(draft);
      expect(ScheduleCommit.dateToSet({ type: 'invalid' }, draft)).toBeNull();
    });
    it.each<ScheduleAction>(['set', 'preset'])('anyDateWriteConsumesThePrefilledPhrase (%s)', (a) =>
      expect(ScheduleCommit.consumesSuggestion('zítra', a)).toBe(true));
    it.each<ScheduleAction>(['cancel', 'clear'])('cancelAndClearKeepTheTitle (%s)', (a) =>
      expect(ScheduleCommit.consumesSuggestion('zítra', a)).toBe(false));
    it.each([null, '', '  '])('noSuggestionNothingToConsume (%j)', (t) => {
      expect(ScheduleCommit.consumesSuggestion(t, 'set')).toBe(false);
      expect(ScheduleCommit.consumesSuggestion(t, 'preset')).toBe(false);
    });
  });

  describe('ScheduleOpeningTests', () => {
    const now = prague(2026, 10, 23, 10, 0);
    it('anExistingDateWinsAndTheFieldStartsEmpty', () => {
      const set = prague(2026, 11, 2, 15, 0);
      expect(ScheduleCommit.opening(set, 'zítra', now, cal)).toEqual({ draft: set, text: '' });
    });
    it('aLiveSuggestionIsPrefilledAndDrivesTheDraft', () => {
      const o = ScheduleCommit.opening(null, ' zítra 14:00 ', now, cal);
      expect(pragueString(o.draft)).toBe('2026-10-24 14:00');
      expect(o.text).toBe('zítra 14:00');
    });
    it.each([null, '', '  '])('otherwiseTomorrowMorning (%j)', (t) => {
      const o = ScheduleCommit.opening(null, t, now, cal);
      expect(pragueString(o.draft)).toBe('2026-10-24 09:00');
      expect(o.text).toBe('');
    });
    it('anUnreadablePhraseStaysInTheFieldOverTomorrow', () => {
      const o = ScheduleCommit.opening(null, 'zítra prosím', now, cal);
      expect(pragueString(o.draft)).toBe('2026-10-24 09:00');
      expect(o.text).toBe('zítra prosím');
    });
  });

  describe('TextRowSubmitTests', () => {
    it('returnInTheTitleCommitsTheOpenSection', () => {
      expect(ScheduleCommit.textRowSubmit(true, true)).toBe('setSchedule');
      expect(ScheduleCommit.textRowSubmit(true, false)).toBe('setSchedule');
      expect(ScheduleCommit.textRowSubmit(false, true)).toBe('saveReminder');
      expect(ScheduleCommit.textRowSubmit(false, false)).toBe('none');
    });
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/core/scheduleCommit.test.ts` → expected FAIL (module missing).
- [ ] **Step 3: Implement** `scheduleCommit.ts`.
- [ ] **Step 4: Run** → expected PASS (15 tests).
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(core): ScheduleCommit open and commit decisions"`

---

## Task A9: `core/monthGrid.ts`

**Files:**
- Create: `src/recreation/core/monthGrid.ts`
- Test: `tests/core/monthGrid.test.ts`

**Interfaces:**
- Consumes: A2 `startOfMonth`, `daysInMonth`, `addDays`, `addMonths`, `startOfDay`, `weekdayOf`.
- Produces (contracts §2.8 + D8): `MonthGrid = { weeks: 6, cellCount: 42, startOfMonth, cells, week, weekdaySymbols, fullWeekdaySymbols, shiftMonth, moving, isSelectable, canGoBack }` with the added `week(day: Date, calendar: Calendar): number | null` (grid row 0…5 of the day in its own month).

Rules (Swift `MonthGrid.swift`): `cells`: `first = startOfMonth(month)`; `lead = (weekday(first) − firstWeekday + 7) % 7`; cell `lead + i` = `addDays(first, i)` for `i < daysInMonth`, others null. `week`: index of `startOfDay(day)` in its month's cells, `/ 7` (floor). Symbols: `Intl.DateTimeFormat(calendar.locale, { weekday: 'narrow' })` (`'long'` for full) over Sunday 1 Nov 2026 … Saturday 7 Nov 2026 in UTC, rotated to start at `firstWeekday − 1`. `shiftMonth` = `addMonths(startOfMonth(month), n)`. `moving` = `addDays(day, n)`; its start of day before `startOfDay(earliest)` → `day` unchanged. `isSelectable` = `startOfDay(day) ≥ startOfDay(now)`. `canGoBack` = `startOfMonth(month) > startOfMonth(now)`.

Swift cases mirrored (`MonthGridTests.swift`): `octoberStartsOnThursdayInAMondayFirstLocale`, `sundayFirstLocaleShiftsTheColumns`, `sixRowsAlwaysFit`, `arrowMovementKeepsTheTimeAndNeverEntersThePast`, `movementCrossesDSTOnWallClockTime`, `paging`, `weekRowOfADay`.

- [ ] **Step 1: Write the failing test** `tests/core/monthGrid.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';
  import type { Calendar } from '../../src/recreation/core/calendar';
  import { MonthGrid } from '../../src/recreation/core/monthGrid';
  import { prague, pragueCalendar as cal, pragueString } from '../support';

  const us: Calendar = { ...cal, locale: 'en-US', firstWeekday: 1 };

  describe('MonthGridTests', () => {
    it('octoberStartsOnThursdayInAMondayFirstLocale', () => {
      const cells = MonthGrid.cells(prague(2026, 10, 23, 10), cal);
      expect(cells).toHaveLength(42);
      expect(cells.slice(0, 3).every((c) => c === null)).toBe(true);
      expect(cells[3]).toEqual(prague(2026, 10, 1));
      expect(cells[3 + 30]).toEqual(prague(2026, 10, 31));
      expect(cells.slice(34).every((c) => c === null)).toBe(true);
      expect(cells.filter(Boolean)).toHaveLength(31);
    });
    it('sundayFirstLocaleShiftsTheColumns', () => {
      expect(MonthGrid.cells(prague(2026, 10, 5), us)[4]).toEqual(prague(2026, 10, 1));
      expect(MonthGrid.weekdaySymbols(us)[0]).toBe('S');
      expect(MonthGrid.weekdaySymbols(cal)).toHaveLength(7);
    });
    it('sixRowsAlwaysFit', () => {
      const cells = MonthGrid.cells(prague(2026, 3, 10), cal);
      expect(cells[6]).toEqual(prague(2026, 3, 1));
      expect(cells[36]).toEqual(prague(2026, 3, 31));
    });
    it('arrowMovementKeepsTheTimeAndNeverEntersThePast', () => {
      const now = prague(2026, 10, 23, 10), draft = prague(2026, 10, 24, 14, 30);
      expect(MonthGrid.moving(draft, 7, now, cal)).toEqual(prague(2026, 10, 31, 14, 30));
      expect(MonthGrid.moving(draft, -1, now, cal)).toEqual(prague(2026, 10, 23, 14, 30));
      expect(MonthGrid.moving(draft, -7, now, cal)).toEqual(draft);
    });
    it('movementCrossesDSTOnWallClockTime', () => {
      const draft = prague(2026, 10, 24, 9);
      expect(pragueString(MonthGrid.moving(draft, 2, draft, cal))).toBe('2026-10-26 09:00');
    });
    it('paging', () => {
      const now = prague(2026, 10, 23, 10);
      expect(MonthGrid.shiftMonth(prague(2026, 10, 31), 1, cal)).toEqual(prague(2026, 11, 1));
      expect(MonthGrid.shiftMonth(prague(2026, 12, 15), 1, cal)).toEqual(prague(2027, 1, 1));
      expect(MonthGrid.canGoBack(prague(2026, 10, 1), now, cal)).toBe(false);
      expect(MonthGrid.canGoBack(prague(2026, 11, 1), now, cal)).toBe(true);
      expect(MonthGrid.isSelectable(prague(2026, 10, 23, 0), now, cal)).toBe(true);
      expect(MonthGrid.isSelectable(prague(2026, 10, 22, 23, 59), now, cal)).toBe(false);
    });
    it('weekRowOfADay', () => {
      expect(MonthGrid.week(prague(2026, 10, 1, 9), cal)).toBe(0);
      expect(MonthGrid.week(prague(2026, 10, 24, 9), cal)).toBe(3);
      expect(MonthGrid.week(prague(2026, 10, 31, 9), cal)).toBe(4);
      expect(MonthGrid.week(prague(2026, 3, 31, 9), cal)).toBe(5);
    });
  });

  describe('monthGrid (TS)', () => {
    it('veryShortSymbolsInGridOrder', () => {
      expect(MonthGrid.weekdaySymbols(cal)).toEqual(['P', 'Ú', 'S', 'Č', 'P', 'S', 'N']);
      expect(MonthGrid.weekdaySymbols(us)).toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'S']);
    });
    it('fullSymbolsInGridOrder', () => {
      expect(MonthGrid.fullWeekdaySymbols(cal)[0]).toBe('pondělí');
      expect(MonthGrid.fullWeekdaySymbols(us)).toEqual(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
    });
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/core/monthGrid.test.ts` → expected FAIL (module missing).
- [ ] **Step 3: Implement** `monthGrid.ts`.
- [ ] **Step 4: Run** → expected PASS (9 tests).
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(core): MonthGrid six-week model with locale first weekday"`

---

## Task A10: `core/scheduleDraft.ts`

**Files:**
- Create: `src/recreation/core/scheduleDraft.ts`
- Test: `tests/core/scheduleDraft.test.ts`

**Interfaces:**
- Consumes: A2 `components`, `daysInMonth`, `addDays`, `startOfDay`; A3 `ScheduleDefaults.compose`, `.at`, `Clock`; A4 `DatePresets.date`, `.highlighted`, `DatePreset`, `PresetPick`; A7 `ScheduleInput.resolve`, `ScheduleInputResult`; A8 `ScheduleCommit.opening`, `.dateToSet`, `.consumesSuggestion`; A9 `MonthGrid.moving`, `.startOfMonth`, `.isSelectable`.
- Produces (contracts §2.7 + D7): `interface ScheduleOutcome`, `class ScheduleDraft` with every member of §2.7 plus `get isDirty(): boolean` and `prepareSave(): SaveDecision`, `type SaveDecision = { readonly type: 'saveAsIs' } | { readonly type: 'commitThenSave'; readonly outcome: ScheduleOutcome } | { readonly type: 'invalid' }`.

Rules (Swift `ScheduleDraft.swift`): constructor: `opening(selected, initialText, clock())` → `draft`, `text`; `parsed = resolve(text, clock())`; `isDirty false` (the prefilled text is not an edit). `set text(v)`: when `v !== text` → `isDirty = true`, reparse at `clock()`, a date moves `draft`. `setFromControls(d)`: `isDirty = true`, `draft = d`, `text = ''`. `pick(day)` = `setFromControls(compose(day, draft))`. `setTime(h, m = 0)` = `setFromControls(at(h, m, draft))`. `applyTypedTime(s)`: `resolve(s, clock())` not a date → false; else `setFromControls(compose(draft, thatDate))`, true. `stepTime(n)`: `mins = hour·60 + minute` of `draft`; `snapped = n > 0 ? (trunc(mins / 15) + n)·15 : (trunc((mins + 14) / 15) + n)·15` (Swift `Int` division truncates); `wrapped = ((snapped % 1440) + 1440) % 1440`; `setTime(⌊wrapped/60⌋, wrapped % 60)`. `moveDay(n)`: `moved = MonthGrid.moving(draft, n, clock())`; equal to `draft` → false; else `setFromControls(moved)`, true. `moveInto(month)`: `first = startOfMonth(month)`; `day = addDays(first, min(day(draft), daysInMonth(first)) − 1)`; not selectable → `startOfDay(clock())`; `pick(day)`. `set()`: text non-empty → re-resolve at `clock()` (relative phrases count from the moment of Set); committed or `dateToSet` null → null; `draft = date`; outcome `{ date, presetPick: null, consumesSuggestion('set') }`. `apply(p)`: committed → null; `date = DatePresets.date(p, clock())`; `{ date, presetPick: { preset: p, date }, consumesSuggestion('preset') }`. `clear()`: committed → null; `{ date: null, presetPick: null, consumesSuggestion('clear') }`. Each commit sets `committed = true`. `prepareSave()`: `!isDirty || committed` → `saveAsIs`; `set()` null → `invalid`; else `commitThenSave`. `subscribe`: listeners run once after every public mutation.

Swift cases mirrored (`ScheduleDraftTests.swift`, now Fri 23 Oct 2026 10:00 Prague): `opensOnTheSharedRules`, `relativeTextResolvesAtSetNotAtTheLastKeystroke`, `typingParsesOnceAndMovesTheDraft`, `controlsClearTheTypedText`, `timeStepsSnapToQuarterHours`, `gridMovementAndPaging`, `setWritesTheTypedDateOnceAndConsumesThePhrase`, `setOnInvalidTextStaysOpen`, `presetRecordsThePickAndClearKeepsTheTitle`, `singleHighlight`, `untouchedSavesAsIs`, `anEditIsCommittedBeforeSaving`, `invalidTextBlocksTheSave`, `afterACommitTheSaveGoesThroughAsIs`. Not ported: `switchingKeepsTheEdit` (`prepareSwitch` exists only for the in-notch Location section, D5).

- [ ] **Step 1: Write the failing test** `tests/core/scheduleDraft.test.ts`:
  ```ts
  import { describe, expect, it, vi } from 'vitest';
  import { ScheduleDraft } from '../../src/recreation/core/scheduleDraft';
  import { prague, pragueCalendar as cal, pragueString } from '../support';

  const NOW = prague(2026, 10, 23, 10, 0);
  const make = (selected: Date | null = null, initialText: string | null = null) =>
    new ScheduleDraft({ selected, initialText, calendar: cal, clock: () => NOW });

  describe('ScheduleDraftTests', () => {
    it('opensOnTheSharedRules', () => {
      expect(pragueString(make().draft)).toBe('2026-10-24 09:00');
      const fromPhrase = make(null, 'zítra 14:00');
      expect(fromPhrase.text).toBe('zítra 14:00');
      expect(pragueString(fromPhrase.draft)).toBe('2026-10-24 14:00');
      expect(fromPhrase.textIsDate).toBe(true);
      const existing = prague(2026, 11, 2, 15, 0);
      expect(make(existing, 'zítra').draft).toEqual(existing);
    });
    it('relativeTextResolvesAtSetNotAtTheLastKeystroke', () => {
      let t = NOW;
      const d = new ScheduleDraft({ selected: null, initialText: null, calendar: cal, clock: () => t });
      d.text = '+2h';
      t = prague(2026, 10, 23, 10, 30);
      expect(d.set()?.date).toEqual(prague(2026, 10, 23, 12, 30));
    });
    it('typingParsesOnceAndMovesTheDraft', () => {
      const d = make();
      d.text = 'fri 2pm';
      expect(d.parsed).toEqual({ type: 'date', date: prague(2026, 10, 30, 14, 0) });
      expect(d.draft).toEqual(prague(2026, 10, 30, 14, 0));
      d.text = 'fri 2pm please';
      expect(d.isInvalid).toBe(true);
      expect(d.draft).toEqual(prague(2026, 10, 30, 14, 0));
      d.text = '';
      expect(d.parsed).toEqual({ type: 'empty' });
    });
    it('controlsClearTheTypedText', () => {
      const d = make(null, 'zítra');
      d.setTime(15);
      expect(d.text).toBe('');
      expect(pragueString(d.draft)).toBe('2026-10-24 15:00');
      d.pick(prague(2026, 10, 28));
      expect(pragueString(d.draft)).toBe('2026-10-28 15:00');
      expect(d.applyTypedTime('1430')).toBe(true);
      expect(pragueString(d.draft)).toBe('2026-10-28 14:30');
      expect(d.applyTypedTime('25:00')).toBe(false);
      expect(pragueString(d.draft)).toBe('2026-10-28 14:30');
    });
    it('timeStepsSnapToQuarterHours', () => {
      const d = make();
      d.setTime(9, 7); d.stepTime(1);
      expect(pragueString(d.draft)).toBe('2026-10-24 09:15');
      d.setTime(9, 7); d.stepTime(-1);
      expect(pragueString(d.draft)).toBe('2026-10-24 09:00');
      d.setTime(23, 50); d.stepTime(1);
      expect(pragueString(d.draft)).toBe('2026-10-24 00:00');
    });
    it('gridMovementAndPaging', () => {
      const d = make();
      expect(d.moveDay(7)).toBe(true);
      expect(pragueString(d.draft)).toBe('2026-10-31 09:00');
      expect(d.moveDay(-14)).toBe(false);
      d.moveInto(prague(2026, 12, 1));
      expect(pragueString(d.draft)).toBe('2026-12-31 09:00');
      d.moveInto(prague(2026, 11, 1));
      expect(pragueString(d.draft)).toBe('2026-11-30 09:00');
    });
    it('setWritesTheTypedDateOnceAndConsumesThePhrase', () => {
      const d = make(null, 'zítra');
      d.text = 'zítra 16:00';
      const o = d.set()!;
      expect(pragueString(o.date!)).toBe('2026-10-24 16:00');
      expect(o.presetPick).toBeNull();
      expect(o.consumesSuggestion).toBe(true);
      expect(d.committed).toBe(true);
      expect(d.set()).toBeNull();
      expect(d.apply('tomorrow')).toBeNull();
    });
    it('setOnInvalidTextStaysOpen', () => {
      const d = make();
      d.text = 'not a date';
      expect(d.set()).toBeNull();
      expect(d.committed).toBe(false);
    });
    it('presetRecordsThePickAndClearKeepsTheTitle', () => {
      const weekend = make().apply('weekend')!;
      expect(weekend.presetPick).toEqual({ preset: 'weekend', date: prague(2026, 10, 24, 9, 0) });
      expect(weekend.consumesSuggestion).toBe(false);
      const cleared = make(prague(2026, 11, 2, 9, 0), 'zítra').clear()!;
      expect(cleared).toEqual({ date: null, presetPick: null, consumesSuggestion: false });
    });
    it('singleHighlight', () => {
      const d = make();
      expect(d.highlightedPreset(null)).toBe('tomorrow');
      expect(d.highlightedPreset({ preset: 'weekend', date: prague(2026, 10, 24, 9, 0) })).toBe('weekend');
    });
    it('untouchedSavesAsIs', () => {
      const d = make();
      expect(d.isDirty).toBe(false);
      expect(d.prepareSave()).toEqual({ type: 'saveAsIs' });
      expect(d.committed).toBe(false);
      const prefilled = make(null, 'zítra');
      expect(prefilled.isDirty).toBe(false);
      expect(prefilled.prepareSave()).toEqual({ type: 'saveAsIs' });
    });
    it('anEditIsCommittedBeforeSaving', () => {
      const typed = make(null, 'zítra');
      typed.text = 'zítra 16:00';
      const a = typed.prepareSave();
      expect(a.type).toBe('commitThenSave');
      if (a.type === 'commitThenSave') {
        expect(pragueString(a.outcome.date!)).toBe('2026-10-24 16:00');
        expect(a.outcome.consumesSuggestion).toBe(true);
      }
      expect(typed.committed).toBe(true);
      const chip = make();
      chip.setTime(15);
      const b = chip.prepareSave();
      expect(b.type === 'commitThenSave' && pragueString(b.outcome.date!)).toBe('2026-10-24 15:00');
    });
    it('invalidTextBlocksTheSave', () => {
      const d = make();
      d.text = 'not a date';
      expect(d.prepareSave()).toEqual({ type: 'invalid' });
      expect(d.committed).toBe(false);
    });
    it('afterACommitTheSaveGoesThroughAsIs', () => {
      const d = make();
      d.setTime(15);
      d.set();
      expect(d.committed).toBe(true);
      expect(d.prepareSave()).toEqual({ type: 'saveAsIs' });
    });
  });

  describe('scheduleDraft (TS)', () => {
    it('subscribersHearEveryMutation', () => {
      const d = make();
      const listener = vi.fn();
      const off = d.subscribe(listener);
      d.text = 'fri 2pm'; d.setTime(9); d.set();
      expect(listener).toHaveBeenCalledTimes(3);
      off(); d.clear();
      expect(listener).toHaveBeenCalledTimes(3);
    });
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/core/scheduleDraft.test.ts` → expected FAIL (module missing).
- [ ] **Step 3: Implement** `scheduleDraft.ts` per the rules.
- [ ] **Step 4: Run** → expected PASS (15 tests).
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(core): ScheduleDraft model shared by every Set Date control"`

---

## Task A11: `core/accentContrast.ts`

**Files:**
- Create: `src/recreation/core/accentContrast.ts`
- Test: `tests/core/accentContrast.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (contracts §2.9, exact): `AccentContrast = { minimumTextContrast: 3.0, relativeLuminance, contrastRatio, prefersDarkLabel, label }`, `hexToRgb(hex): { r; g; b } | null` (accepts `#RRGGBB` / `RRGGBB`, case-insensitive; components 0…1).

Rules (Swift `AccentContrast.swift`): `linear(c) = c ≤ 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4`; `L = 0.2126 R + 0.7152 G + 0.0722 B`; ratio `(max + 0.05) / (min + 0.05)`; `prefersDarkLabel`: `onWhite = ratio(L, 1)`; `≥ 3` → false; else `ratio(L, 0) > onWhite`. `label(hex)`: unparseable → `'#FFFFFF'`; dark → `'#000000'`.

Swift cases mirrored (`AccentContrastTests.swift`): `luminanceEndpointsAndRatio`, `lightListColoursGetADarkLabel` (orange 255/141/40, green 131/215/84, yellow 255/204/0, light blue 27/173/248), `midToneListColoursKeepWhite` (blue 0/122/255, default blue 10/132/255, sky blue 0/136/255, purple 203/48/224, red 255/56/60), `darkListColoursKeepWhite`, `labelResolvesSwiftUIColours`. TS-only: the five fake list colours (contracts §2.9 pins; ratios on white measured: `#0A84FF` 3.647, `#BF5AF2` 3.524, `#FF375F` 3.521 → white; `#FF9F0A` 2.056, `#30D158` 2.022 → black).

- [ ] **Step 1: Write the failing test** `tests/core/accentContrast.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';
  import { AccentContrast as A, hexToRgb } from '../../src/recreation/core/accentContrast';

  const onWhite = (r: number, g: number, b: number) => A.contrastRatio(A.relativeLuminance(r / 255, g / 255, b / 255), 1);

  describe('AccentContrastTests', () => {
    it('luminanceEndpointsAndRatio', () => {
      expect(A.relativeLuminance(0, 0, 0)).toBe(0);
      expect(A.relativeLuminance(1, 1, 1)).toBeCloseTo(1, 9);
      expect(A.contrastRatio(0, 1)).toBeCloseTo(21, 9);
      expect(A.contrastRatio(0.3, 0.3)).toBe(1);
    });
    it.each([['orange', 255, 141, 40], ['green', 131, 215, 84], ['yellow', 255, 204, 0], ['light blue', 27, 173, 248]])(
      'lightListColoursGetADarkLabel (%s)', (_n, r, g, b) => {
        expect(onWhite(r, g, b)).toBeLessThan(3);
        expect(A.prefersDarkLabel(r / 255, g / 255, b / 255)).toBe(true);
        expect(A.contrastRatio(A.relativeLuminance(r / 255, g / 255, b / 255), 0)).toBeGreaterThanOrEqual(4.5);
      });
    it.each([['blue', 0, 122, 255], ['default blue', 10, 132, 255], ['sky blue', 0, 136, 255], ['purple', 203, 48, 224], ['red', 255, 56, 60]])(
      'midToneListColoursKeepWhite (%s)', (_n, r, g, b) => {
        expect(onWhite(r, g, b)).toBeGreaterThanOrEqual(3);
        expect(A.prefersDarkLabel(r / 255, g / 255, b / 255)).toBe(false);
      });
    it('darkListColoursKeepWhite', () => {
      expect(A.prefersDarkLabel(0, 0.25, 0.63)).toBe(false);
      expect(A.prefersDarkLabel(0.55, 0.12, 0.1)).toBe(false);
      expect(onWhite(140, 31, 26)).toBeGreaterThanOrEqual(4.5);
    });
    it('labelResolvesSwiftUIColours', () => {
      expect(A.label('#FFCC00')).toBe('#000000');
      expect(A.label('#0040A1')).toBe('#FFFFFF');
    });
  });

  describe('accentContrast (TS)', () => {
    it.each([['#0A84FF', '#FFFFFF'], ['#BF5AF2', '#FFFFFF'], ['#FF375F', '#FFFFFF'], ['#FF9F0A', '#000000'], ['#30D158', '#000000']])(
      'fake list %s → %s', (fill, label) => expect(A.label(fill)).toBe(label));
    it('unparseableKeepsWhite', () => expect(A.label('not a colour')).toBe('#FFFFFF'));
    it('hexToRgb', () => {
      expect(hexToRgb('#FF0000')).toEqual({ r: 1, g: 0, b: 0 });
      expect(hexToRgb('0a84ff')).toEqual({ r: 10 / 255, g: 132 / 255, b: 1 });
      expect(hexToRgb('#FFF')).toBeNull();
    });
    it('threshold', () => expect(A.minimumTextContrast).toBe(3));
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/core/accentContrast.test.ts` → expected FAIL (module missing).
- [ ] **Step 3: Implement** `accentContrast.ts`.
- [ ] **Step 4: Run** → expected PASS (20 tests).
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(core): AccentContrast label colour on the list accent"`

---

## Task A12: `core/suggestionDateFormatter.ts` + `RelativeDistance`

**Files:**
- Create: `src/recreation/core/suggestionDateFormatter.ts`
- Test: `tests/core/suggestionDateFormatter.test.ts`

**Interfaces:**
- Consumes: A2 `Calendar`, `daysBetween`, `addMonths`, `addDays`, `addHours`, `addMinutes`; A4 `DatePresets.dayTemplate`, `DatePresets.date`.
- Produces (contracts §2.10 + D9, D10): `type DateTemplate`; `class SuggestionDateFormatter { constructor({ locale, calendar, hour12? }); string(date, hasTime, now); time(date); presetDetail(date, now, spoken = false); dayAndTime(date); format(date, template); static invalidateCache(): void; static get cachedFormatterCount(): number }`; `RelativeDistance = { string(from: Date, to: Date, locale: string, calendar: Calendar): string }`.

Rules:
- Template → `Intl.DateTimeFormat(locale, { timeZone: calendar.timeZone, … })`: `'j:mm'` `{ hour: 'numeric', minute: '2-digit', hour12 }` (`hour12` omitted when undefined = locale default); `'EEE'` `{ weekday: 'short' }`; `'EEEE'` `{ weekday: 'long' }`; `'d MMM'` `{ day: 'numeric', month: 'short' }`; `'EEEE d MMMM'` `{ weekday: 'long', day: 'numeric', month: 'long' }`; `'EEE d MMM'` `{ weekday: 'short', day: 'numeric', month: 'short' }`; `'LLLL y'` and `'MMMM y'` `{ month: 'long', year: 'numeric' }`; the medium date `{ dateStyle: 'medium' }`. Formatters cached in a static `Map` keyed `template|locale|timeZone|hour12`.
- `time(date)`: `formatToParts` of `'j:mm'`; a whitespace literal next to a `dayPeriod` part becomes U+202F (Foundation's glyph, deterministic across engines).
- `string(date, hasTime, now)`: `n = daysBetween(now, date)`; relative word = `Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(n, 'day')` when it contains no digit (en ±1, cs ±2), first letter upper-cased with `toLocaleUpperCase(locale)`; else the medium date. No time → that. With time: en (`locale` starts with `en`) → `day + ', ' + time(date)`; otherwise `day + ' ' + time(date)`.
- `presetDetail`: `dayTemplate(date, now, calendar, spoken)` null → `time(date)`; else `format(date, tpl) + ' ' + time(date)`. `dayAndTime` = `format(date, 'EEEE d MMMM') + ' ' + time(date)`.
- `RelativeDistance.string(from, to, locale, calendar)`: `sign = to ≥ from ? 1 : −1`; walk units `year` (12 months), `month`, `week` (7 days), `day` (calendar arithmetic, A2) then `hour`, `minute`, `second` (absolute) from the earlier instant towards the later; the first unit whose greatest whole count `n` with `add(earlier, unit, n) ≤ later` is > 0 wins; nothing → `n = 0` seconds. Output `Intl.RelativeTimeFormat(locale, { style: 'narrow', numeric: 'always' }).format(sign · n, unit)` (matches Foundation `.abbreviated` / `.numeric` exactly, measured on macOS 26 for en_US and cs_CZ).

Swift cases mirrored: `SuggestionDateFormatterTests.relativeTomorrowLabelWithTime`, `dateOnlyOmitsTime` (with a fixed `now` instead of the system clock); `PresetDetailTests.followsLocale`, `aWeekOrMoreAheadShowsTheDate`, `mixedLocaleReadsAsOneFormat` (`en_US@rg=czzzzz` → `en-US-u-rg-czzzzz`), `cacheIsPerLocaleAndCanBeDropped` (from `DatePresetsTests.swift`). TS-only: the template table and the relative-distance table, both measured with Foundation on macOS 26 (`DateFormatter.setLocalizedDateFormatFromTemplate`, `RelativeDateTimeFormatter`) for Sat 24 Oct 2026 14:00 Prague.

- [ ] **Step 1: Write the failing test** `tests/core/suggestionDateFormatter.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';
  import { DatePresets, type DatePreset } from '../../src/recreation/core/datePresets';
  import { RelativeDistance, SuggestionDateFormatter, type DateTemplate } from '../../src/recreation/core/suggestionDateFormatter';
  import { plainSpaces, prague, pragueCalendar as cal } from '../support';

  const en = new SuggestionDateFormatter({ locale: 'en-US', calendar: cal });
  const cs = new SuggestionDateFormatter({ locale: 'cs-CZ', calendar: cal });
  const NOW = prague(2026, 10, 23, 10, 0);

  describe('SuggestionDateFormatterTests', () => {
    it('relativeTomorrowLabelWithTime', () => {
      expect(plainSpaces(en.string(prague(2026, 10, 24, 14, 0), true, NOW))).toBe('Tomorrow, 2:00 PM');
      expect(cs.string(prague(2026, 10, 24, 14, 0), true, NOW)).toBe('Zítra 14:00');
    });
    it('dateOnlyOmitsTime', () => {
      expect(en.string(prague(2026, 10, 24, 14, 0), false, NOW)).toBe('Tomorrow');
      expect(cs.string(prague(2026, 10, 24, 14, 0), false, NOW)).toBe('Zítra');
    });
  });

  describe('PresetDetailTests', () => {
    const detail = (f: SuggestionDateFormatter, p: DatePreset, now: Date, spoken = false) =>
      plainSpaces(f.presetDetail(DatePresets.date(p, now, cal), now, spoken));
    it('followsLocale', () => {
      const now = prague(2026, 10, 19, 10, 0);
      expect(detail(cs, 'weekend', now)).toBe('so 9:00');
      expect(detail(en, 'weekend', now)).toBe('Sat 9:00 AM');
      expect(detail(cs, 'evening', now)).toBe('19:00');
      expect(detail(en, 'evening', now)).toBe('7:00 PM');
    });
    it('aWeekOrMoreAheadShowsTheDate', () => {
      const now = prague(2026, 10, 24, 17, 39);
      expect(detail(en, 'tomorrow', now)).toBe('Sun 9:00 AM');
      expect(detail(en, 'nextMonth', now)).toBe('Nov 1 9:00 AM');
      expect(detail(en, 'weekend', now)).toBe('Oct 31 9:00 AM');
      expect(detail(cs, 'tomorrow', now)).toBe('ne 9:00');
      expect(detail(cs, 'nextMonth', now)).not.toBe(detail(cs, 'tomorrow', now));
      expect(detail(cs, 'nextMonth', now)).toBe('1. 11. 9:00');
      expect(detail(cs, 'weekend', now).startsWith('so')).toBe(false);
      expect(detail(en, 'nextMonth', now, true)).toBe('Sunday, November 1 9:00 AM');
      expect(detail(en, 'tomorrow', now, true)).toBe('Sunday 9:00 AM');
    });
    it('mixedLocaleReadsAsOneFormat', () => {
      const mixed = new SuggestionDateFormatter({ locale: 'en-US-u-rg-czzzzz', calendar: cal });
      const saturday = prague(2026, 10, 24, 9, 0);
      expect(plainSpaces(mixed.presetDetail(saturday, NOW))).toBe('Sat ' + plainSpaces(mixed.time(saturday)));
      expect(mixed.presetDetail(prague(2026, 11, 1, 9, 0), NOW)).not.toContain(' at ');
      expect(mixed.dayAndTime(saturday)).not.toContain(' at ');
      expect(plainSpaces(mixed.dayAndTime(saturday)).endsWith(' ' + plainSpaces(mixed.time(saturday)))).toBe(true);
      expect(plainSpaces(cs.dayAndTime(saturday))).toBe('sobota 24. října 9:00');
      expect(plainSpaces(en.dayAndTime(saturday))).toBe('Saturday, October 24 9:00 AM');
    });
    it('cacheIsPerLocaleAndCanBeDropped', () => {
      const now = prague(2026, 10, 19, 10, 0);
      expect(detail(cs, 'evening', now)).not.toBe(detail(en, 'evening', now));
      SuggestionDateFormatter.invalidateCache();
      expect(SuggestionDateFormatter.cachedFormatterCount).toBe(0);
      expect(detail(en, 'evening', now)).toBe('7:00 PM');
    });
  });

  describe('suggestionDateFormatter (TS)', () => {
    const sat = prague(2026, 10, 24, 14, 0);
    it.each<[DateTemplate, string, string]>([
      ['j:mm', '2:00 PM', '14:00'], ['EEE', 'Sat', 'so'], ['EEEE', 'Saturday', 'sobota'], ['d MMM', 'Oct 24', '24. 10.'],
      ['EEEE d MMMM', 'Saturday, October 24', 'sobota 24. října'], ['EEE d MMM', 'Sat, Oct 24', 'so 24. 10.'],
      ['LLLL y', 'October 2026', 'říjen 2026'], ['MMMM y', 'October 2026', 'říjen 2026'],
    ])('template %s', (tpl, enText, csText) => {
      expect(plainSpaces(en.format(sat, tpl))).toBe(enText);
      expect(plainSpaces(cs.format(sat, tpl))).toBe(csText);
    });
    it('timeUsesTheNarrowNoBreakSpaceBeforeTheDayPeriod', () => expect(en.time(sat)).toBe('2:00 PM'));
    it('hour12FalseInEnglish', () => expect(new SuggestionDateFormatter({ locale: 'en-US', calendar: cal, hour12: false }).time(sat)).toBe('14:00'));
    it('relativeWordsAndMediumDates', () => {
      expect(plainSpaces(en.string(prague(2026, 10, 23, 14, 0), true, NOW))).toBe('Today, 2:00 PM');
      expect(plainSpaces(en.string(prague(2026, 10, 22, 14, 0), true, NOW))).toBe('Yesterday, 2:00 PM');
      expect(plainSpaces(en.string(prague(2026, 10, 25, 14, 0), true, NOW))).toBe('Oct 25, 2026, 2:00 PM');
      expect(plainSpaces(en.string(prague(2026, 10, 31, 14, 0), true, NOW))).toBe('Oct 31, 2026, 2:00 PM');
      expect(cs.string(prague(2026, 10, 23, 14, 0), true, NOW)).toBe('Dnes 14:00');
      expect(cs.string(prague(2026, 10, 21, 14, 0), true, NOW)).toBe('Předevčírem 14:00');
      expect(cs.string(prague(2026, 10, 25, 14, 0), true, NOW)).toBe('Pozítří 14:00');
      expect(plainSpaces(cs.string(prague(2026, 10, 31, 14, 0), true, NOW))).toBe('31. 10. 2026 14:00');
    });
    it.each<[Date, string, string]>([
      [NOW, 'in 0s', 'za 0 s'], [new Date(NOW.getTime() + 30_000), 'in 30s', 'za 30 s'],
      [prague(2026, 10, 23, 10, 45), 'in 45m', 'za 45 min'], [prague(2026, 10, 23, 11, 0), 'in 1h', 'za 1 h'],
      [prague(2026, 10, 24, 9, 0), 'in 23h', 'za 23 h'], [prague(2026, 10, 24, 14, 0), 'in 1d', 'za 1 den'],
      [prague(2026, 10, 25, 10, 0), 'in 2d', 'za 2 dny'], [prague(2026, 10, 26, 9, 0), 'in 2d', 'za 2 dny'],
      [prague(2026, 10, 30, 9, 0), 'in 6d', 'za 6 dní'], [prague(2026, 10, 31, 9, 0), 'in 1w', 'za 1 týd.'],
      [prague(2026, 11, 1, 9, 0), 'in 1w', 'za 1 týd.'], [prague(2026, 11, 23, 10, 0), 'in 1mo', 'za 1 měs.'],
      [prague(2026, 12, 24, 9, 0), 'in 2mo', 'za 2 měs.'], [prague(2027, 10, 23, 10, 0), 'in 1y', 'za 1 r.'],
      [prague(2026, 10, 23, 7, 0), '3h ago', 'před 3 h'], [prague(2026, 10, 20, 9, 0), '3d ago', 'před 3 dny'],
    ])('RelativeDistance to %s', (to, enText, csText) => {
      expect(plainSpaces(RelativeDistance.string(NOW, to, 'en-US', cal))).toBe(enText);
      expect(plainSpaces(RelativeDistance.string(NOW, to, 'cs-CZ', cal))).toBe(csText);
    });
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/core/suggestionDateFormatter.test.ts` → expected FAIL (module missing).
- [ ] **Step 3: Implement** `suggestionDateFormatter.ts` per the rules.
- [ ] **Step 4: Run** → expected PASS (33 tests).
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(core): SuggestionDateFormatter and RelativeDistance matching Foundation"`

---

## Task A13: `core/scheduleText.ts`

**Files:**
- Create: `src/recreation/core/scheduleText.ts`
- Test: `tests/core/scheduleText.test.ts`

**Interfaces:**
- Consumes: A7 `ScheduleInput.resolve` (test only).
- Produces (contracts §2.11, exact): `ScheduleText = { chipHours: [9, 12, 15, 19], placeholder: 'fri 2pm, zítra 14:00, +2h', invalidExample(locale), notADate(example), inThePast: 'In the past' } as const`.

Rules (Swift `Views/ScheduleText.swift`, `ScheduleNotchSection.swift:235,239`): `invalidExample(locale)` = language subtag `cs` → `'zítra 14:00'`, else `'tomorrow 2pm'`; `notADate(e)` = `` `Not a date — try “${e}”` `` (U+2014, U+201C, U+201D).

- [ ] **Step 1: Write the failing test** `tests/core/scheduleText.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';
  import { ScheduleInput } from '../../src/recreation/core/scheduleInput';
  import { ScheduleText } from '../../src/recreation/core/scheduleText';
  import { prague, pragueCalendar as cal } from '../support';

  describe('scheduleText', () => {
    it('constants', () => {
      expect(ScheduleText.chipHours).toEqual([9, 12, 15, 19]);
      expect(ScheduleText.placeholder).toBe('fri 2pm, zítra 14:00, +2h');
      expect(ScheduleText.inThePast).toBe('In the past');
    });
    it('invalidExampleFollowsTheLanguage', () => {
      expect(ScheduleText.invalidExample('cs-CZ')).toBe('zítra 14:00');
      expect(ScheduleText.invalidExample('cs')).toBe('zítra 14:00');
      expect(ScheduleText.invalidExample('en-US')).toBe('tomorrow 2pm');
    });
    it('notADate', () => expect(ScheduleText.notADate('tomorrow 2pm')).toBe('Not a date — try “tomorrow 2pm”'));
    it.each(['cs-CZ', 'en-US'])('theExampleItselfParses (%s)', (locale) =>
      expect(ScheduleInput.resolve(ScheduleText.invalidExample(locale), prague(2026, 10, 23, 10), cal).type).toBe('date'));
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/core/scheduleText.test.ts` → expected FAIL (module missing).
- [ ] **Step 3: Implement** `scheduleText.ts`.
- [ ] **Step 4: Run** → expected PASS (5 tests).
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(core): Set Date copy shared by every control"`

---

## Task A14: `core/lists.ts` + `core/reminder.ts`

**Files:**
- Create: `src/recreation/core/lists.ts`, `src/recreation/core/reminder.ts`
- Test: `tests/core/reminder.test.ts`

**Interfaces:**
- Consumes: A12 `SuggestionDateFormatter.string`.
- Produces (contracts §2.12, §2.13, exact): `type ListId`, `interface ReminderList`, `FAKE_LISTS`, `DEFAULT_LIST_ID = 'reminders'`, `listById(id)`, `accentFor(id)`; `interface ReminderDraft`, `buildNotes(notes, location)`, `interface SavedReminder`, `toSavedReminder(draft, now, formatter)`.

Rules: `accentFor` = the list colour, `'#0A84FF'` (Theme.accent) for an unknown id; `listById` throws on an unknown id. `buildNotes` (Swift `RemindersService.buildNotes`): parts = notes if non-empty, then `'📍 ' + location.trim()` if the trimmed location is non-empty (trim = whitespace and newlines); none → null; `join('\n')`. `toSavedReminder`: `id = crypto.randomUUID()`, `notes = buildNotes(…)`, `listColor = accentFor(listId)`, `dueLabel = dueDate ? formatter.string(dueDate, true, now) : null`, `savedAt = now`, other fields copied.

Swift cases mirrored (`LocationDraftTests.swift`): `BuildNotesTests.notesAndLocation`; the two `buildNotes` assertions of `doneWritesTheFieldAsTyped` and `blankingTheFieldRemovesTheLocation`. Not ported: the rest of `LocationDraftTests` (in-notch Location, D5).

- [ ] **Step 1: Write the failing test** `tests/core/reminder.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';
  import { accentFor, DEFAULT_LIST_ID, FAKE_LISTS, listById, type ListId } from '../../src/recreation/core/lists';
  import { buildNotes, toSavedReminder } from '../../src/recreation/core/reminder';
  import { SuggestionDateFormatter } from '../../src/recreation/core/suggestionDateFormatter';
  import { plainSpaces, prague, pragueCalendar as cal } from '../support';

  describe('BuildNotesTests', () => {
    it('notesAndLocation', () => {
      expect(buildNotes('', null)).toBeNull();
      expect(buildNotes('Bring cake', null)).toBe('Bring cake');
      expect(buildNotes('Bring cake', ' Office ')).toBe('Bring cake\n📍 Office');
      expect(buildNotes('', '\n  \t')).toBeNull();
    });
    it('theSavePathTrimsOnce (LocationDraftTests)', () => {
      expect(buildNotes('', '  Holešovice, Praha \n')).toBe('📍 Holešovice, Praha');
      expect(buildNotes('', '   ')).toBeNull();
    });
  });

  describe('lists', () => {
    it('fiveFakeListsInPickerOrder', () => {
      expect(FAKE_LISTS.map((l) => [l.id, l.title, l.color])).toEqual([
        ['reminders', 'Reminders', '#0A84FF'], ['work', 'Work', '#BF5AF2'], ['home', 'Home', '#FF9F0A'],
        ['groceries', 'Groceries', '#30D158'], ['ideas', 'Ideas', '#FF375F'],
      ]);
      expect(DEFAULT_LIST_ID).toBe('reminders');
    });
    it('accentFor', () => {
      expect(accentFor('work')).toBe('#BF5AF2');
      expect(accentFor('nope' as ListId)).toBe('#0A84FF');
      expect(listById('home').title).toBe('Home');
    });
  });

  describe('toSavedReminder', () => {
    it('buildsTheWindowRow', () => {
      const now = prague(2026, 10, 23, 10, 0);
      const f = new SuggestionDateFormatter({ locale: 'en-US', calendar: cal });
      const saved = toSavedReminder({ title: 'Call mum', notes: '', listId: 'work', dueDate: prague(2026, 10, 24, 14, 0), flagged: true, location: 'Office' }, now, f);
      expect(saved).toMatchObject({ title: 'Call mum', notes: '📍 Office', listId: 'work', listColor: '#BF5AF2', flagged: true, savedAt: now });
      expect(plainSpaces(saved.dueLabel!)).toBe('Tomorrow, 2:00 PM');
      expect(saved.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(toSavedReminder({ title: 'x', notes: '', listId: 'home', dueDate: null, flagged: false, location: null }, now, f).dueLabel).toBeNull();
    });
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/core/reminder.test.ts` → expected FAIL (modules missing).
- [ ] **Step 3: Implement** `lists.ts` (constants verbatim from contracts §2.12) and `reminder.ts`.
- [ ] **Step 4: Run** → expected PASS (5 tests).
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(core): fake reminder lists and the saved-reminder record"`

---

## Task A15: `machine/notchShape.ts`

**Files:**
- Create: `src/recreation/machine/notchShape.ts`
- Test: `tests/machine/notchShape.test.ts`

**Interfaces:**
- Consumes: nothing (`Size` is declared in A16; this file declares `interface Size { readonly width: number; readonly height: number }` locally and A16 re-exports it from here).
- Produces (contracts §2.17, exact): `NotchRadius = { closedTop: 6, closedBottom: 14, openTop: 19, openBottom: 32 }`, `notchPath`, `notchPathSegments`, `type PathSegment`, `widthForNotch(notchWidth, top = 6)`, `contains(point, canvasWidth, shapeSize, top, bottom)`, `NotchGeometry = { fallbackSize: { width: 200, height: 32 }, closedShapeSize(notch, top) }`, `interface Size`.

Rules (Swift `NotchShape.swift`): clamp `t = max(0, min(top, w/2))`, `b = max(0, min(bottom, min(h, w/2 − t)))`. Segments in order: `M 0 0`, `Q t 0 t t`, `L t h−b`, `Q t h t+b h`, `L w−t−b h`, `Q w−t h w−t h−b`, `L w−t t`, `Q w−t 0 w 0`, `L 0 0`. `notchPath` joins `cmd + args.join(' ')` with single spaces, each number rounded to 3 decimals and printed via `String(Number(x.toFixed(3)))`, and ends with ` Z`. `widthForNotch` = `notchWidth + 2·top`. `closedShapeSize(notch, top)` = `{ widthForNotch(notch.width, top) + 2, notch.height + 1 }` (a real notch, 2 × 1 pt bleed). `contains` (D16): point shifted by `−(canvasWidth − shapeSize.width) / 2`; each `Q` flattened into `n = max(1, ⌈√(r·√2 / 4)⌉)` chords at equal parameter steps `k/n` (r = the clamped radius of that corner); non-zero winding point-in-polygon on the resulting polygon.

Swift cases mirrored (`NotchShapeTests.swift`): `widthAddsBothTopFillets`, `closedSilhouetteContainsTests`, `openShapeFillsItsRect`, `hitTestTopDownCanvasCoordinates`, `notchGeometryChecks` (the fallback size; the `NSScreen` half has no web counterpart). TS-only: pinned path string, clamping, and the measured CoreGraphics boundary.

- [ ] **Step 1: Write the failing test** `tests/machine/notchShape.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';
  import { contains, NotchGeometry, notchPath, notchPathSegments, NotchRadius, widthForNotch } from '../../src/recreation/machine/notchShape';

  describe('NotchShapeTests', () => {
    it('widthAddsBothTopFillets', () => expect(widthForNotch(221, 6)).toBe(233));
    it('closedSilhouetteContainsTests', () => {
      const r = (x: number, y: number) => contains({ x, y }, 233, { width: 233, height: 38 }, 6, 14);
      expect(r(116, 19)).toBe(true);
      expect(r(1, 37)).toBe(false);
      expect(r(7, 37)).toBe(false);
      expect(r(3, 0.05)).toBe(true);
    });
    it('openShapeFillsItsRect', () => {
      const xs = notchPathSegments(600, 241, 19, 32).flatMap((s) => s.args.filter((_, i) => i % 2 === 0));
      expect(Math.max(...xs) - Math.min(...xs)).toBe(600);
    });
    it('hitTestTopDownCanvasCoordinates', () => {
      const canvas = 648, size = { width: 600, height: 241 }, ox = 24;
      const r = (x: number, y: number) => contains({ x, y }, canvas, size, 19, 32);
      expect(r(ox + 300, 120.5)).toBe(true);
      expect(r(ox + 2, 0.2)).toBe(true);
      expect(r(ox + 25, 237)).toBe(false);
      expect(r(ox - 5, 50)).toBe(false);
      expect(r(ox + 20, 50)).toBe(true);
    });
    it('notchGeometryChecks', () => expect(NotchGeometry.fallbackSize).toEqual({ width: 200, height: 32 }));
  });

  describe('notchShape (TS)', () => {
    it('radii', () => expect(NotchRadius).toEqual({ closedTop: 6, closedBottom: 14, openTop: 19, openBottom: 32 }));
    it('closedShapeSizeOfThe14InchNotch', () => expect(NotchGeometry.closedShapeSize({ width: 221, height: 38 }, 6)).toEqual({ width: 235, height: 39 }));
    it('pathString', () => expect(notchPath(233, 38, 6, 14)).toBe('M0 0 Q6 0 6 6 L6 24 Q6 38 20 38 L213 38 Q227 38 227 24 L227 6 Q227 0 233 0 L0 0 Z'));
    it('equalCommandCountInEveryState', () => {
      for (const [w, h, t, b] of [[235, 39, 6, 14], [600, 241, 19, 32], [379, 39, 6, 14], [600, 751, 19, 32]])
        expect(notchPathSegments(w, h, t, b).map((s) => s.cmd).join('')).toBe('MQLQLQLQL');
    });
    it('clampsATooSmallRect', () => expect(notchPath(20, 10, 19, 32)).toBe('M0 0 Q10 0 10 10 L10 10 Q10 10 10 10 L10 10 Q10 10 10 10 L10 10 Q10 0 20 0 L0 0 Z'));
    it.each([[0.5, 2.5], [4.5, 12.944], [10.5, 17.3], [240, 44]])('matchesCoreGraphicsFlattening (open, left edge at y %f ≈ x %f)', (y, x) => {
      const r = (px: number) => contains({ x: px, y }, 600, { width: 600, height: 241 }, 19, 32);
      expect(r(x + 0.02)).toBe(true);
      expect(r(x - 0.02)).toBe(false);
    });
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/machine/notchShape.test.ts` → expected FAIL (module missing).
- [ ] **Step 3: Implement** `notchShape.ts` per the rules.
- [ ] **Step 4: Run** → expected PASS (14 tests).
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(machine): notch silhouette path and CoreGraphics-equivalent hit test"`

---

## Task A16: `machine/notchLayout.ts` — `NotchLayout` and `ScheduleMetrics`

**Files:**
- Create: `src/recreation/machine/notchLayout.ts`
- Test: `tests/machine/notchLayout.test.ts`

**Interfaces:**
- Consumes: A15 `Size`, `NotchRadius`, `widthForNotch`, `NotchGeometry.closedShapeSize`, `contains`.
- Produces (contracts §2.15, §5.1, §5.3 with D1–D3, D12): `type Size` (re-export), `ScheduleExpansion` is imported from A19's file later, so this file declares `type LayoutSchedule = 'none' | 'controls' | 'calendar'` and A19 declares `type ScheduleExpansion = LayoutSchedule` (same union, contract name). `NotchLayout` = every constant of contracts §5.1 (`baseOpenWidth 600`, `defaultNotchBandHeight 39`, `textScale 1`, `horizontalPadding 20`, `contentInsetX 39`, `closedTopRadius 6`, `closedBottomRadius 14`, `openTopRadius 19`, `openBottomRadius 32`, `overshootPadding 24`, `scheduleScreenMargin 40`, `savedExtension 72`, `savedBadgeSize 24`, `savedBadgeTrailingPadding 30`, `savedHold 1.0`, `hoverGrowth {22, 5}`, `hoverDwell 0.09`, `closedCanvasMargin {16, 8}`, `closeDuration 0.36`, `settleDelay 0.5`, `focusRetryDelays [0.12, 0.30]`, `titleLineHeight 23`, `notesLineHeight 18`, `titleRowHeight 25`, `notesRowHeight 20`, `inputRowSpacing 1`, `headerHeight 36`, `chipSlotHeight 26`, `bottomBarHeight 48`, `NOTCH {221, 38}`, `closedSize {235, 39}`, `openSize` (function below; the 600 × 241 value is `openSize()`), `scheduleControlsSize {600, 519}`, `scheduleCalendarSize {600, 751}`, `savedSize {379, 39}`, `hoverSize {257, 44}`, `closedCanvasSize {273, 52}`) and the functions `lineHeight(pointSize)`, `widthForNotch`, `closedShapeSize`, `topContentHeight(s = 1)`, `contentHeight(s = 1)`, `scheduleContentHeight(s, calendar)`, `openSize(band = 39, schedule = 'none', maxHeight = Infinity)`, `maxPanelHeight(screenHeight, dockHeight)`, `scheduleSectionTop(band = 39, s = 1)`, `sectionCancelBandBottom(band = 39, s = 1)`, `clickCancelsSchedule(y, bandBottom, schedule)`, `canvasSize(open)`, `openCanvasSize(open, tallest)`, `passesMouseThrough(point, canvasWidth, panelSize)`. `ScheduleMetrics = { typeField 36, previewGap 6, preview 18, presetsGap 10, presetRow 44, presetSpacing 8, dayTimeGap 12, dayTimeRow 30, calendarGap 10, monthHeader 26, weekdayRow 18, dayCell 28, dayRowSpacing 2, footerGap 14, footer 36, controlRadius 12, calendarHeight(s = 1), sectionHeight(s = 1, calendar) }`.

Rules (Swift `NotchState.swift` `enum NotchLayout`):
- `sc(v) = roundHalfEven(v · s)` where `roundHalfEven(x) = Math.abs(x % 1) === 0.5 ? 2·Math.round(x / 2) : Math.round(x)` (Swift `.toNearestOrEven`, ties only on exact halves).
- `lineHeight(p) = ⌈p · 2412 / 2048⌉`: `PlainTextView.lineHeight(for:)` = ⌈ascender − descender + leading⌉ of `NSFont.systemFont`, measured on macOS 26 as ascender 1980/2048 em, descender −432/2048 em, leading 0 (13 → 16, 15 → 18, 16 → 19, 19 → 23, 20 → 24, 24 → 29, 25 → 30, 30 → 36).
- `topContentHeight = 8 + sc(36) + 10 + (lineHeight(sc(19)) + 2) + 1 + (lineHeight(sc(15)) + 2)`; `contentHeight = topContentHeight + sc(26) + 8 + sc(48) + 20`; `calendarHeight = sc(26) + sc(18) + 6·sc(28) + 5·2`; `sectionHeight = sc(36) + 6 + sc(18) + 10 + 2·sc(44) + 8 + 12 + sc(30) [+ 10 + calendarHeight] + 14 + sc(36)`; `scheduleContentHeight = contentHeight + sectionHeight + 20`.
- `openSize(band, schedule, maxHeight)`: plain = `{ round(600 · min(1 + (s − 1)·0.5, 1.3)), band + contentHeight }`; `'none'` → plain; else `{ plain.width, max(plain.height, min(band + scheduleContentHeight, floor(maxHeight))) }`.
- `maxPanelHeight(screenHeight, dockHeight) = screenHeight − dockHeight − 40`; `scheduleSectionTop = band + contentHeight`; `sectionCancelBandBottom = band + topContentHeight`; `clickCancelsSchedule = schedule !== 'none' && y < bandBottom`; `canvasSize(o) = { o.width + 48, o.height + 24 }`; `openCanvasSize(open, tallest) = canvasSize({ open.width, max(open.height, tallest.height) })`; `passesMouseThrough`: outside the bounding box `x ∈ [(cw − w)/2, (cw + w)/2]`, `y ∈ [0, h]` → true; else `!contains(point, cw, panelSize, 19, 32)`.

Swift cases mirrored (`NotchStateTests.swift`): `notchLayoutInvariants`, `openHeightFollowsTheRhythm`, `scheduleHeightFollowsTheRhythm`, `scheduleSizesGrowOnlyInHeight`, `scheduleHeightIsClampedToTheScreen`, `maxPanelHeightStopsAboveTheDockWithRoomForTheOvershoot`, `clickOnTheTextRowsCancelsScheduling`, `onlyTheBlackShapeTakesTheMouse`, `openCanvasFitsTheTallestScheduleStateInNotchStyle` (notch style only), `openCanvasAtDefaultTextSize` (notch style only). Not ported: `ignoringTheMouseWaitsForTheButtonRelease`, `canvasPointConversion` (AppKit window plumbing), `locationHeightFollowsTheRhythm`, `locationSizeAndPrecedence` (D5). The precedence tests move to A18.

- [ ] **Step 1: Write the failing test** `tests/machine/notchLayout.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';
  import { NotchLayout as L, ScheduleMetrics as M } from '../../src/recreation/machine/notchLayout';

  describe('NotchStateTests (layout)', () => {
    it('notchLayoutInvariants', () => {
      expect(L.openSize().height).toBeGreaterThan(38 + 150);
      expect(L.openSize(50).height).toBe(L.openSize(39).height + 11);
      expect(L.canvasSize(L.openSize()).width).toBe(L.openSize().width + 48);
      expect(L.closeDuration).toBeGreaterThanOrEqual(0.3);
    });
    it.each([[0.85, 89, 180], [1, 100, 202], [1.3, 124, 248], [1.6, 146, 293]])('openHeightFollowsTheRhythm at %f', (s, top, plain) => {
      expect(L.topContentHeight(s)).toBe(top);
      expect(L.contentHeight(s)).toBe(plain);
    });
    it.each([[0.85, 427, 628], [1, 480, 712], [1.3, 588, 881], [1.6, 696, 1057]])('scheduleHeightFollowsTheRhythm at %f', (s, controls, calendar) => {
      expect(L.scheduleContentHeight(s, false)).toBe(controls);
      expect(L.scheduleContentHeight(s, true)).toBe(calendar);
    });
    it('scheduleHeightFollowsTheRhythm (sums at 100 %)', () => {
      expect(M.sectionHeight(1, false)).toBe(258);
      expect(M.calendarHeight(1)).toBe(222);
      expect(L.scheduleContentHeight(1, false)).toBe(202 + 258 + 20);
      expect(L.scheduleContentHeight(1, true)).toBe(480 + 10 + 26 + 18 + 168 + 10);
    });
    it('scheduleSizesGrowOnlyInHeight', () => {
      const plain = L.openSize(39), controls = L.openSize(39, 'controls'), calendar = L.openSize(39, 'calendar');
      expect(L.openSize(39, 'none')).toEqual(plain);
      expect([plain, controls, calendar].map((x) => x.width)).toEqual([600, 600, 600]);
      expect([plain.height, controls.height, calendar.height]).toEqual([241, 519, 751]);
      expect(L.openSize(50, 'calendar').height).toBe(calendar.height + 11);
      expect(L.canvasSize(calendar).height).toBeLessThan(900);
    });
    it('scheduleHeightIsClampedToTheScreen', () => {
      const natural = L.openSize(39, 'calendar');
      expect(L.openSize(39, 'calendar', natural.height + 100)).toEqual(natural);
      expect(L.openSize(39, 'calendar', 500.7)).toEqual({ width: 600, height: 500 });
      expect(L.openSize(39, 'controls', 100).height).toBe(241);
      expect(L.openSize(39, 'none', 100)).toEqual(L.openSize(39));
    });
    it('maxPanelHeightStopsAboveTheDockWithRoomForTheOvershoot', () => {
      expect(L.maxPanelHeight(982, 70)).toBe(982 - 70 - 40);
      expect(L.scheduleScreenMargin).toBe(40);
      expect(L.maxPanelHeight(982, 0)).toBe(942);
      expect(L.maxPanelHeight(1080, 0)).toBe(1040);
    });
    it('clickOnTheTextRowsCancelsScheduling', () => {
      const band = L.sectionCancelBandBottom(39, 1);
      expect(band).toBe(139);
      const cancels = (y: number, s: 'none' | 'controls' | 'calendar' = 'controls') => L.clickCancelsSchedule(y, band, s);
      expect(cancels(60, 'calendar')).toBe(true);
      expect(cancels(105)).toBe(true);
      expect(cancels(128)).toBe(true);
      expect(cancels(152)).toBe(false);
      expect(cancels(197)).toBe(false);
      expect(cancels(39 + 202 + 10)).toBe(false);
      expect(cancels(105, 'none')).toBe(false);
    });
    it('onlyTheBlackShapeTakesTheMouse', () => {
      const cw = 648, plain = { width: 600, height: 241 }, grown = { width: 600, height: 519 }, cx = cw / 2, inset = 24 + 19;
      const pass = (x: number, y: number, p = plain) => L.passesMouseThrough({ x, y }, cw, p);
      expect(pass(cx, 100)).toBe(false);
      expect(pass(24 + 560, 197)).toBe(false);
      expect(pass(cx, 400)).toBe(true);
      expect(pass(10, 100)).toBe(true);
      expect(pass(24 + 2, 239)).toBe(true);
      expect(pass(cx, 400, grown)).toBe(false);
      expect(pass(cx, 700, grown)).toBe(true);
      expect(pass(cw - inset - 2, 120)).toBe(false);
      expect(pass(cw - inset + 2, 120)).toBe(true);
      expect(pass(inset + 2, 120)).toBe(false);
      expect(pass(inset - 2, 120)).toBe(true);
      expect(pass(cx, 242)).toBe(true);
    });
    it('openCanvasFitsTheTallestScheduleStateInNotchStyle', () => {
      const plain = L.openSize(39), calendar = L.openSize(39, 'calendar');
      const canvas = L.openCanvasSize(plain, calendar);
      expect(canvas).toEqual(L.canvasSize(calendar));
      expect(canvas.height).toBeGreaterThanOrEqual(L.openSize(39, 'controls').height + L.overshootPadding);
      expect(L.openCanvasSize(plain, { width: 600, height: plain.height - 50 })).toEqual(L.canvasSize(plain));
    });
    it('openCanvasAtDefaultTextSize', () =>
      expect(L.openCanvasSize({ width: 600, height: 241 }, { width: 600, height: 751 })).toEqual({ width: 648, height: 775 }));
  });

  describe('notchLayout (TS)', () => {
    it.each([[13, 16], [15, 18], [16, 19], [19, 23], [20, 24], [24, 29], [25, 30], [30, 36]])('lineHeight(%i) = %i (NSFont.systemFont, macOS 26)', (p, h) =>
      expect(L.lineHeight(p)).toBe(h));
    it('derivedSizesOnTheFake14InchScreen', () => {
      expect(L.closedSize).toEqual({ width: 235, height: 39 });
      expect(L.hoverSize).toEqual({ width: 257, height: 44 });
      expect(L.closedCanvasSize).toEqual({ width: 273, height: 52 });
      expect(L.savedSize).toEqual({ width: 379, height: 39 });
      expect(L.scheduleControlsSize).toEqual({ width: 600, height: 519 });
      expect(L.scheduleCalendarSize).toEqual({ width: 600, height: 751 });
      expect(L.canvasSize(L.openSize())).toEqual({ width: 648, height: 265 });
    });
    it('sectionTopIsBelowTheBottomBar', () => expect(L.scheduleSectionTop(39, 1)).toBe(241));
    it('insets', () => {
      expect(L.contentInsetX).toBe(L.horizontalPadding + L.openTopRadius);
      expect(L.savedBadgeTrailingPadding).toBe(L.closedTopRadius + (L.savedExtension - L.savedBadgeSize) / 2);
    });
    it('sectionRows', () => {
      const top = L.scheduleSectionTop();
      const presets = top + M.typeField + M.previewGap + M.preview + M.presetsGap;
      expect(presets).toBe(311);
      const dayTime = presets + 2 * M.presetRow + M.presetSpacing + M.dayTimeGap;
      expect(dayTime).toBe(419);
      expect(dayTime + M.dayTimeRow + M.footerGap).toBe(463);
      expect(dayTime + M.dayTimeRow + M.calendarGap + M.calendarHeight() + M.footerGap).toBe(695);
    });
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/machine/notchLayout.test.ts` → expected FAIL (module missing).
- [ ] **Step 3: Implement** `notchLayout.ts` per the rules (constants + functions; the derived `*Size` constants are computed from the functions at module load, not typed in).
- [ ] **Step 4: Run** → expected PASS (29 tests).
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(machine): NotchLayout and ScheduleMetrics with the below-the-bar Set Date rhythm"`

---

## Task A17: `Theme` metrics (`machine/notchLayout.ts`)

**Files:**
- Modify: `src/recreation/machine/notchLayout.ts`
- Test: `tests/machine/theme.test.ts`

**Interfaces:**
- Consumes: A16 `NotchLayout`.
- Produces: `Theme` (contracts §5.4 + D13), exactly this shape (parts 03/04 read these keys):
  ```ts
  export const Theme = {
    horizontalPadding: 20,
    header:        { titleSize: 22, titleWeight: 700, chevronSize: 13, chevronWeight: 700, chevronGap: 7, chevronOffsetY: 0.5, spacerMin: 12 },
    close:         { circle: 24, hit: 36, glyphSize: 11, glyphWeight: 700 },
    dashedCircle:  { size: 21, stroke: 1.5, dash: [0.1, 3.2], paddingTop: 2 },
    input:         { circleGap: 10, rowSpacing: 1 },
    title:         { size: 19, weight: 400, maxLength: 2000 },
    notes:         { size: 15, weight: 400, maxLength: 10000 },
    chipSlot:      { height: 26, leading: 31 },
    suggestionChip:{ iconSize: 12, iconWeight: 500, textSize: 13, textWeight: 500, padX: 10, padY: 5, fillAlpha: 0.14, gap: 6,
                     keycap: { size: 11, weight: 600, textAlpha: 0.45, fillAlpha: 0.10, radius: 4, padX: 5, padY: 1 },
                     dismiss: { size: 13, alpha: 0.40, gap: 8 } },
    dateChip:      { iconSize: 12, iconWeight: 500, textSize: 13, textWeight: 500, gap: 6, dismissSize: 13, dismissAlpha: 0.50 },
    error:         { size: 12, weight: 500, color: '#FF453A' },
    pill:          { height: 44, padX: 11, iconGap: 17, iconSize: 18, hitSize: 38, fillAlpha: 0.03, stroke: '#3D3D3F', strokeWidth: 1,
                     activeFillAlpha: 0.22, activeInset: 3 },
    bottomBar:     { spacerMin: 16 },
    save:          { size: 48, glyphSize: 22, glyphWeight: 600, disabled: '#474749' },
    hover:         { scale: 1.06, pressScale: 0.94, highlight: 0.10, pressHighlight: 0.18 },
    notchFill:     { neutral: [0.06, 0.11, 0.15], selected: [0.20, 0.27, 0.32], selectedStrokeAlpha: 0.80, pressScale: 0.97, prominentDisabledOpacity: 0.55 },
    notchText:     { size: 13, weight: 500, alpha: [0.60, 0.85, 0.95], padX: 8 },
    keyHint:       { size: 11, weight: 600, textAlpha: 0.50, fillAlpha: 0.10, radius: 4, padX: 5, padY: 1 },
    typeField:     { padX: 12, iconSize: 12, iconWeight: 500, iconAlpha: 0.45, textSize: 14, placeholderAlpha: 0.50, fillAlpha: 0.07, strokeAlpha: 0.08, focusStrokeAlpha: 0.70, radius: 12 },
    preview:       { size: 12, weight: 500, padL: 12, secondaryAlpha: 0.60, pastColor: '#FF9E0A' },
    presetCard:    { columns: 3, gap: 8, padX: 10, iconSize: 13, iconWeight: 500, iconWidth: 18, titleSize: 13, titleWeight: 500, hintSize: 10, hintWeight: 500, hintAlpha: 0.50, detailSize: 11, detailAlpha: 0.60, innerGap: 9, minScale: 0.75 },
    dayButton:     { padX: 11, iconSize: 12, iconWeight: 500, textSize: 13, textWeight: 500, chevronSize: 9, chevronWeight: 700, chevronAlpha: 0.50 },
    timeField:     { width: 96, padX: 10, iconSize: 11, iconWeight: 500, iconAlpha: 0.45, textSize: 13, textWeight: 500, fillAlpha: 0.07, focusStrokeAlpha: 0.70 },
    timeChip:      { size: 12, weight: 500, padX: 10, alpha: 0.75, gap: 4 },
    dayTimeRow:    { gap: 6, spacerMin: 6 },
    footer:        { gap: 8, cancelSize: 13, cancelWeight: 500, cancelAlpha: 0.85, cancelPadX: 16, setSize: 13, setWeight: 600, setPadX: 18 },
    monthGrid:     { headerSize: 13, headerWeight: 600, headerPadL: 4, navSize: 11, navWeight: 600, navAlpha: 0.75, navDisabledAlpha: 0.20, navCircle: 26, navGap: 2,
                     weekdaySize: 10, weekdayWeight: 600, weekdayAlpha: 0.55, daySize: 13, dayAlpha: 0.85, pastAlpha: 0.25, hoverFill: [0.09, 0.16],
                     focusRing: { alpha: 0.85, width: 1.5, inset: -3 }, gridRing: { radius: 12, alpha: 0.60, width: 1.5, inset: -4 } },
    listPicker:    { radius: 12, stroke: '#3D3D3F', minWidth: 200, headerSize: 13, headerWeight: 600, headerAlpha: 0.50, headerPad: [16, 12, 6], rowPadX: 16, rowPadY: 8, dot: 10, titleSize: 15, checkSize: 13, checkWeight: 600, rowFill: [0.06, 0.11, 0.15], selectedFillAlpha: 0.20 },
    locationPopover: { padding: 14, headerSize: 13, headerWeight: 600, fieldWidth: 220, fieldHeight: 28 },
    savedBadge:    { size: 24, strokeRatio: 0.11, paddingRatio: 0.27, tick: [[0, 0.55], [0.38, 0.92], [1, 0.12]] },
    font: { recreation: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Inter, sans-serif' },
  } as const;
  ```
  (Values: contracts §5.4; `pill.active*` BottomBar.swift:140; `savedBadge` SavedCheckView.swift:18 and CheckmarkShape; `preview.pastColor` = Theme.flagOrange.)

- [ ] **Step 1: Write the failing test** `tests/machine/theme.test.ts` (the derived relations SPEC §4 states):
  ```ts
  import { describe, expect, it } from 'vitest';
  import { NotchLayout, Theme } from '../../src/recreation/machine/notchLayout';

  describe('Theme', () => {
    it('pillIconsSit55ptApart (SPEC §4)', () => expect(Theme.pill.hitSize + Theme.pill.iconGap).toBe(55));
    it('chipSlotLeadingClearsTheDottedCircle', () => expect(Theme.chipSlot.leading).toBe(Theme.dashedCircle.size + Theme.input.circleGap));
    it('closeHitIsTheHeaderRow', () => expect(Theme.close.hit).toBe(NotchLayout.headerHeight));
    it('saveButtonIsTheBottomBar', () => expect(Theme.save.size).toBe(NotchLayout.bottomBarHeight));
    it('controlRadiusIsConcentricWithThePanel', () => expect(32 - Theme.horizontalPadding).toBe(Theme.typeField.radius));
    it('savedBadgeTick', () => {
      expect(Theme.savedBadge.size * Theme.savedBadge.strokeRatio).toBeCloseTo(2.64, 10);
      expect(Theme.savedBadge.size * Theme.savedBadge.paddingRatio).toBeCloseTo(6.48, 10);
    });
    it('hoverAndPress', () => expect(Theme.hover).toEqual({ scale: 1.06, pressScale: 0.94, highlight: 0.10, pressHighlight: 0.18 }));
    it('activeCalendarIconDisc (BottomBar.swift:140)', () => expect([Theme.pill.activeFillAlpha, Theme.pill.activeInset]).toEqual([0.22, 3]));
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/machine/theme.test.ts` → expected FAIL (`Theme` is not exported).
- [ ] **Step 3: Implement** — add the `Theme` constant above to `notchLayout.ts`.
- [ ] **Step 4: Run** → expected PASS (8 tests).
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(machine): Theme metrics for every recreation control"`

---

## Task A18: `machine/notchState.ts`

**Files:**
- Create: `src/recreation/machine/notchState.ts`
- Test: `tests/machine/notchState.test.ts`

**Interfaces:**
- Consumes: A15 `Size`, `NotchGeometry.closedShapeSize`, `contains`; A16 `NotchLayout.openSize`, `.maxPanelHeight`, `.hoverGrowth`, `.closedCanvasMargin`, `.savedExtension`, `.canvasSize`, `LayoutSchedule`.
- Produces (contracts §2.16 with D1): `interface NotchFlags`, `interface NotchSizes` (`closedSize`, `openSize`, `scheduleSize`, `scheduleCalendarSize`), `INITIAL_FLAGS` (all false, `schedule: 'none'`), `sizesFor(notch, screenHeight, dockHeight = 0)`, `notchBandHeight(s)`, `panelSize(s, schedule)`, `currentSize(f, s)`, `hoverSize(s)`, `closedCanvasSize(s)`, `savedSize(s)`, `radii(f)`.

Rules (Swift `NotchState`, `PanelController.configureGeometry`): `sizesFor`: `closed = closedShapeSize(notch, 6)`; `band = closed.height`; `open = openSize(band)`; `max = maxPanelHeight(screenHeight, dockHeight)`; `scheduleSize = openSize(band, 'controls', max)`; `scheduleCalendarSize = openSize(band, 'calendar', max)`. `currentSize`: `isSaving` → saved; `isOpen` → `panelSize(f.schedule)`; `isHovering` → hover; else closed. `radii`: `isOpen` → `{ 19, 32 }` else `{ 6, 14 }`.

Swift cases mirrored (`NotchStateTests.swift`): `hoverSizeIsClosedPlusGrowth`, `closedCanvasContainsSwollenShapeAndIsSmallerThanOpenCanvas`, `currentSizePrecedence`, `closedHitTest`, `currentSizeFollowsTheScheduleWhileOpen`.

- [ ] **Step 1: Write the failing test** `tests/machine/notchState.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';
  import { NotchLayout } from '../../src/recreation/machine/notchLayout';
  import { contains } from '../../src/recreation/machine/notchShape';
  import { closedCanvasSize, currentSize, hoverSize, INITIAL_FLAGS, notchBandHeight, radii, savedSize, sizesFor, type NotchFlags } from '../../src/recreation/machine/notchState';

  const S = sizesFor({ width: 221, height: 38 }, 982);
  const f = (patch: Partial<NotchFlags>): NotchFlags => ({ ...INITIAL_FLAGS, ...patch });

  describe('NotchStateTests (precedence)', () => {
    it('hoverSizeIsClosedPlusGrowth', () => {
      expect(hoverSize(S).width - S.closedSize.width).toBe(NotchLayout.hoverGrowth.width);
      expect(hoverSize(S).height - S.closedSize.height).toBe(NotchLayout.hoverGrowth.height);
    });
    it('closedCanvasContainsSwollenShapeAndIsSmallerThanOpenCanvas', () => {
      const c = closedCanvasSize(S), h = hoverSize(S), open = NotchLayout.canvasSize(S.openSize);
      expect(c.width >= h.width && c.height >= h.height).toBe(true);
      expect(c.width < open.width && c.height < open.height).toBe(true);
    });
    it('currentSizePrecedence', () => {
      expect(currentSize(f({ isSaving: true, isOpen: true, isHovering: true }), S)).toEqual(savedSize(S));
      expect(currentSize(f({ isOpen: true, isHovering: true }), S)).toEqual(S.openSize);
      expect(currentSize(f({ isHovering: true }), S)).toEqual(hoverSize(S));
      expect(currentSize(f({}), S)).toEqual(S.closedSize);
    });
    it('closedHitTest', () => {
      const c = closedCanvasSize(S);
      expect(contains({ x: c.width / 2, y: S.closedSize.height / 2 }, c.width, S.closedSize, 6, 14)).toBe(true);
      expect(contains({ x: 2, y: 10 }, c.width, S.closedSize, 6, 14)).toBe(false);
    });
    it('currentSizeFollowsTheScheduleWhileOpen', () => {
      expect(currentSize(f({ isOpen: true }), S)).toEqual(S.openSize);
      expect(currentSize(f({ isOpen: true, schedule: 'controls' }), S)).toEqual(S.scheduleSize);
      expect(currentSize(f({ isOpen: true, schedule: 'calendar' }), S)).toEqual(S.scheduleCalendarSize);
      expect(currentSize(f({ isOpen: true, schedule: 'calendar', isSaving: true }), S)).toEqual(savedSize(S));
      expect(currentSize(f({ schedule: 'calendar' }), S)).toEqual(S.closedSize);
    });
  });

  describe('notchState (TS)', () => {
    it('sizesOnTheFake14InchScreen', () => expect(S).toEqual({
      closedSize: { width: 235, height: 39 }, openSize: { width: 600, height: 241 },
      scheduleSize: { width: 600, height: 519 }, scheduleCalendarSize: { width: 600, height: 751 },
    }));
    it('aShortScreenClampsTheCalendar', () => expect(sizesFor({ width: 221, height: 38 }, 700).scheduleCalendarSize).toEqual({ width: 600, height: 660 }));
    it('bandAndSaved', () => {
      expect(notchBandHeight(S)).toBe(39);
      expect(savedSize(S)).toEqual({ width: 379, height: 39 });
    });
    it('radii', () => {
      expect(radii(f({ isOpen: true }))).toEqual({ top: 19, bottom: 32 });
      expect(radii(f({ isSaving: true }))).toEqual({ top: 6, bottom: 14 });
    });
    it('initialFlags', () => expect(INITIAL_FLAGS).toEqual({ isOpen: false, contentVisible: false, isSettled: false, isSaving: false, savedBadgeShown: false, isHovering: false, schedule: 'none' }));
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/machine/notchState.test.ts` → expected FAIL (module missing).
- [ ] **Step 3: Implement** `notchState.ts`.
- [ ] **Step 4: Run** → expected PASS (10 tests).
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(machine): NotchState size derivation and precedence"`

---

## Task A19: `machine/notchMachine.ts` — phases, save, hover, screen changes

**Files:**
- Create: `src/recreation/machine/notchMachine.ts`
- Test: `tests/machine/notchMachine.test.ts`

**Interfaces:**
- Consumes: A16 `LayoutSchedule`.
- Produces (contracts §2.14 with D4): `type NotchPhase`, `type ScheduleExpansion = LayoutSchedule`, `afterEscape(s)` (calendar → controls, else none), `type NotchEvent` (contract list), `type NotchEffect` (contract list **minus** `growCanvasForSchedule` and `fitCanvasToPanel`), `interface NotchMachineSnapshot` (**minus** `canvasGrown`), `class NotchMachine` (`phase`, `badgeShown`, `hoverSwollen`, `hoverArmed`, `hoverDwellPending`, `generation`, `schedule`, `isVisible`, `handle(event, pointerOnNotch = false): NotchEffect[]`, `snapshot()`, `equals(other)`, `clone()`), `phaseEquals(a, b)`. In this task `scheduleChanged` returns `[]` and a show while open returns `[]`; A20 adds both.

Rules (Swift `Panel/NotchMachine.swift`, port `handle` line by line):
- `show`: open → `[]`. Else: pending dwell → `cancelHoverDwell` (dwell off); `wasVisible = isVisible`, `fromSaved = phase saving`; closing → `cancelClose`, saving → `cancelSaveHold` (both mid-collapse); `badgeShown = false`, `clearBadgeNoAnimation`, `configureGeometry`; not mid-collapse → `switchToOpenCanvas`; `schedule = 'none'`; `setIgnoresMouse(false)`, `makeKeyAndOrderFront`; `!wasVisible` → `installLocalMonitor`; `postWillShow`, `animateOpen(fromSaved)`; `hoverSwollen = false`; phase open; `generation = (generation + 1) >>> 0`; `scheduleSettle(generation)`, `scheduleFocusRetries`.
- `notchTapped`: only from `closed(parked: true)` → `show`; else `[]`.
- `hide`: visible → `close(cancellingHold: true)`; else `[]`.
- `save(reduceMotion)`: not open → `[]`; reduce motion → `close(true)`; else bump generation, phase saving, `badgeShown = true`, `schedule = 'none'`, `[setSettled(false), animateSaving, setIgnoresMouse(true), resignFirstResponder, scheduleSaveHold]`.
- `saveHoldElapsed`: saving → `close(false)`; else `[]`.
- `closeTimerFired(hasNotch)`: closing only; `badgeShown = false`; `[clearBadgeNoAnimation, hasNotch ? park(pointerOnNotch) : orderOut()]`.
- `settleTimerFired(g)`: open and `g === generation` → `[setSettled(true)]`; else `[]`.
- `hoverEntered`: parked, armed, not swollen, no pending dwell → pending, `[scheduleHoverDwell]`. `hoverDwellElapsed(rm)`: no pending → `[]`; pending off; not parked or not armed → `[]`; `!rm` → swollen, `swellHover`; always `haptic`. `hoverExited`: parked only; pending → off + `cancelHoverDwell`; `hoverArmed = true`; swollen → off + `unswellHover`.
- `screenChanged(hasNotch)`: `[configureGeometry]` + open/saving → `relayoutOpenWindow`; closing → nothing; closed → `hasNotch ? park(pointerOnNotch)` : (parked ? `orderOut()` : nothing).
- `close(cancellingHold)`: saving and cancelling → `cancelSaveHold`; phase closing; `schedule = 'none'`; `[postDidHide, removeLocalMonitor, resignFirstResponder, setIgnoresMouse(true), setSettled(false), animateClose, scheduleClose]`.
- `park(p)`: phase `closed(parked: true)`, `hoverSwollen = false`, `hoverArmed = !p` → `park`. `orderOut()`: phase `closed(parked: false)`, `hoverSwollen = false` → `orderOut`.

Swift cases mirrored (`NotchMachineTests.swift`, all 28): `showFromClosedOpensTheFullChoreography`, `showFromParkedLeavesParkingAndCancelsAPendingDwell`, `showWhileOpenIsANoOp`, `showFromClosingReversesWithoutSnapping`, `reopenDuringSavedHoldCancelsTheHoldAndDropsTheBadge`, `notchTapDuringSavedHoldDoesNothing`, `notchTapOnlyActsOnTheParkedNotch`, `saveThenHoldThenCloseParksOverANotch`, `closeTimerOrdersOutWithoutANotch`, `saveWithReduceMotionIsAPlainHide`, `saveBumpsTheGenerationSoTheSettleTimerCannotDropTheMask`, `settleTimerOnlyCountsForTheCurrentGeneration`, `hoverDwellSwellsWithHapticAndUnswellsOnExit`, `hoverExitDuringDwellCancelsIt`, `hoverDwellWithReduceMotionOnlyTapsTheTrackpad`, `parkingUnderThePointerDisarmsHoverUntilItLeaves`, `parkingAwayFromThePointerArmsHoverImmediately`, `hoverIsIgnoredUnlessParked`, `screenChangeWhileParkedReparksAndRearmsFromThePointer`, `secondSaveIsSwallowed`, `saveIsOnlyPossibleWhileOpen`, `hideDuringSavingCancelsTheHold`, `hideIsANoOpUnlessVisible`, `staleTimersAreIgnored`, `screenChangeRelayoutsTheOpenWindowAndSkipsAClosingOne`, `screenChangeParksAndUnparksClosedWindows`, `everySequenceUpToLengthFiveKeepsTheInvariants`, `handleIsDeterministicAndValueSemantic`. TS-only: the exact show effect list (contracts §2.14).

- [ ] **Step 1: Write the failing test** `tests/machine/notchMachine.test.ts`. Helpers and representative bodies (every other test is the Swift body with `m.handle(.x)` → `m.handle({ type: 'x' })`, `#expect(a == b)` → `expect(a).toEqual(b)`, `effects.contains(e)` → `expect(effects).toContainEqual(e)`, `before = m` → `before = m.clone()`, `m == before` → `m.equals(before)`):
  ```ts
  import { describe, expect, it } from 'vitest';
  import { NotchMachine, phaseEquals, type NotchEffect, type NotchEvent, type NotchPhase } from '../../src/recreation/machine/notchMachine';

  const ALL_PHASES: NotchPhase[] = [{ type: 'closed', parked: false }, { type: 'closed', parked: true }, { type: 'open' }, { type: 'saving' }, { type: 'closing' }];
  function machineIn(phase: NotchPhase): NotchMachine {
    const m = new NotchMachine();
    if (phase.type === 'closed' && phase.parked) m.handle({ type: 'screenChanged', hasNotch: true });
    if (phase.type === 'open' || phase.type === 'saving' || phase.type === 'closing') m.handle({ type: 'show' });
    if (phase.type === 'saving') m.handle({ type: 'save', reduceMotion: false });
    if (phase.type === 'closing') m.handle({ type: 'hide' });
    expect(phaseEquals(m.phase, phase)).toBe(true);
    return m;
  }

  describe('NotchMachineTests', () => {
    it('showFromClosedOpensTheFullChoreography', () => {
      const m = new NotchMachine();
      const e = m.handle({ type: 'show' });
      expect(m.phase).toEqual({ type: 'open' });
      expect(m.generation).toBe(1);
      for (const x of [{ type: 'switchToOpenCanvas' }, { type: 'setIgnoresMouse', ignores: false }, { type: 'installLocalMonitor' },
        { type: 'animateOpen', fromSaved: false }, { type: 'postWillShow' }, { type: 'scheduleSettle', generation: 1 }, { type: 'scheduleFocusRetries' }] as NotchEffect[])
        expect(e).toContainEqual(x);
      expect(e).not.toContainEqual({ type: 'cancelClose' });
      expect(e).not.toContainEqual({ type: 'cancelSaveHold' });
      const i = (x: NotchEffect) => e.findIndex((y) => JSON.stringify(y) === JSON.stringify(x));
      expect(i({ type: 'setIgnoresMouse', ignores: false }) < i({ type: 'makeKeyAndOrderFront' })).toBe(true);
      expect(i({ type: 'makeKeyAndOrderFront' }) < i({ type: 'installLocalMonitor' })).toBe(true);
      expect(i({ type: 'installLocalMonitor' }) < i({ type: 'postWillShow' })).toBe(true);
    });
    it('saveThenHoldThenCloseParksOverANotch', () => {
      const m = machineIn({ type: 'open' });
      expect(m.handle({ type: 'save', reduceMotion: false })).toEqual([{ type: 'setSettled', settled: false }, { type: 'animateSaving' },
        { type: 'setIgnoresMouse', ignores: true }, { type: 'resignFirstResponder' }, { type: 'scheduleSaveHold' }]);
      expect(m.badgeShown).toBe(true);
      const hold = m.handle({ type: 'saveHoldElapsed' });
      expect(m.phase).toEqual({ type: 'closing' });
      expect(m.badgeShown).toBe(true);
      expect(hold).not.toContainEqual({ type: 'cancelSaveHold' });
      for (const x of ['postDidHide', 'removeLocalMonitor', 'resignFirstResponder', 'animateClose', 'scheduleClose'] as const) expect(hold).toContainEqual({ type: x });
      expect(m.handle({ type: 'closeTimerFired', hasNotch: true })).toEqual([{ type: 'clearBadgeNoAnimation' }, { type: 'park' }]);
      expect(m.phase).toEqual({ type: 'closed', parked: true });
      expect(m.badgeShown).toBe(false);
    });
    it('hoverIsIgnoredUnlessParked', () => {
      for (const p of ALL_PHASES.filter((p) => !(p.type === 'closed' && p.parked))) {
        const m = machineIn(p), before = m.clone();
        expect(m.handle({ type: 'hoverEntered' })).toEqual([]);
        expect(m.handle({ type: 'hoverExited' })).toEqual([]);
        expect(m.equals(before)).toBe(true);
      }
    });
    it('everySequenceUpToLengthFiveKeepsTheInvariants', () => {
      // alphabet(m): the 18 (event, pointerOnNotch) pairs of the Swift test, settle at m.generation and (m.generation - 1) >>> 0
      // shape(m) = JSON of { phase, badgeShown, hoverSwollen, hoverArmed, hoverDwellPending }; memo key = shape + depth
      // checkTransition(before, event, pointer, effects, after): the 30 #expect invariants of NotchMachineTests.checkTransition,
      //   effect identity by JSON.stringify, "each effect at most once" via a Set of JSON strings
      let sequences = 0; const memo = new Map<string, number>(); const shapes = new Set<string>();
      for (const p of ALL_PHASES) sequences += explore(machineIn(p), 5, memo, shapes);
      expect(alphabet(new NotchMachine())).toHaveLength(18);
      expect(sequences).toBe(5 * (18 + 18 ** 2 + 18 ** 3 + 18 ** 4 + 18 ** 5)); // 10 003 590
      expect(shapes.size).toBe(17);
      for (const p of ALL_PHASES) expect([...shapes].some((s) => s.startsWith(JSON.stringify(p)))).toBe(true);
    });
  });

  describe('notchMachine (TS)', () => {
    it('showFromClosedEffectOrder (contracts §2.14)', () => expect(new NotchMachine().handle({ type: 'show' })).toEqual([
      { type: 'clearBadgeNoAnimation' }, { type: 'configureGeometry' }, { type: 'switchToOpenCanvas' }, { type: 'setIgnoresMouse', ignores: false },
      { type: 'makeKeyAndOrderFront' }, { type: 'installLocalMonitor' }, { type: 'postWillShow' }, { type: 'animateOpen', fromSaved: false },
      { type: 'scheduleSettle', generation: 1 }, { type: 'scheduleFocusRetries' }]));
    it('closeEffectOrder (contracts §2.14)', () => expect(machineIn({ type: 'saving' }).handle({ type: 'hide' })).toEqual([
      { type: 'cancelSaveHold' }, { type: 'postDidHide' }, { type: 'removeLocalMonitor' }, { type: 'resignFirstResponder' },
      { type: 'setIgnoresMouse', ignores: true }, { type: 'setSettled', settled: false }, { type: 'animateClose' }, { type: 'scheduleClose' }]));
    it('generationWrapsLikeUInt32', () => {
      const m = new NotchMachine();
      (m as unknown as { _generation: number })._generation = 0xFFFF_FFFF;
      m.handle({ type: 'show' });
      expect(m.generation).toBe(0);
    });
  });
  ```
  `explore`, `alphabet`, `checkTransition` are file-local functions ported from the Swift helpers of the same names; every remaining Swift test is written out under its Swift name.
- [ ] **Step 2: Run** `npx vitest run tests/machine/notchMachine.test.ts` → expected FAIL (module missing).
- [ ] **Step 3: Implement** `notchMachine.ts` per the rules (private mutable fields with public getters; `_generation` is the backing field name used by the wrap test).
- [ ] **Step 4: Run** → expected PASS (31 tests; the exhaustive test runs in < 5 s thanks to the memo).
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(machine): NotchMachine phases, save choreography and hover dwell"`

---

## Task A20: `machine/notchMachine.ts` — in-notch Set Date expansion

**Files:**
- Modify: `src/recreation/machine/notchMachine.ts`
- Test: `tests/machine/notchMachineSchedule.test.ts`

**Interfaces:**
- Consumes: A19 `NotchMachine`, `afterEscape`.
- Produces: `scheduleChanged` and show-while-scheduled behaviour (no new exports).

Rules (Swift `changeSection`, `show`): `scheduleChanged(x)`: phase open and `x !== schedule` → `schedule = x`, bump generation, `[setSettled(false), animateSchedule(x), scheduleSettle(generation)]`; else `[]`. `show` while open: `schedule === 'none'` → `[]`, else the same transition to `'none'`.

Swift cases mirrored (`NotchMachineScheduleTests.swift`): `openingTheScheduleOnlyAnimatesUnderTheMask`, `noScheduleStepTouchesTheWindow`, `calendarToggleOnlyAnimatesTheCanvasIsAlreadyTallEnough`, `showWhileScheduledResetsTheSchedule`, `sameExpansionTwiceIsANoOp`, `ignoredUnlessOpen` (hide, save), `closingSettlesUnderTheMask`, `staleSettleFromBeforeTheScheduleChangeIsDropped`, `hideAndSaveResetTheSchedule`, `reopenAfterParkingSwitchesCanvasOnceAndStartsPlain`, `reopenMidCollapseKeepsTheWindow`, `screenChangeWhileScheduledRelayoutsTheOpenWindow`, `escapeStepsBackOneLevel`. Not ported (D5): `locationIsASectionLikeSetDate`, `switchingSectionsIsOneStep`, `escapeAndShowCloseLocation`.

- [ ] **Step 1: Write the failing test** `tests/machine/notchMachineSchedule.test.ts` (each Swift test under its name; representative bodies):
  ```ts
  import { describe, expect, it } from 'vitest';
  import { afterEscape, NotchMachine, type NotchEffect, type NotchEvent, type ScheduleExpansion } from '../../src/recreation/machine/notchMachine';

  const open = () => { const m = new NotchMachine(); m.handle({ type: 'show' }); return m; };
  const step = (x: ScheduleExpansion, g: number): NotchEffect[] =>
    [{ type: 'setSettled', settled: false }, { type: 'animateSchedule', expansion: x }, { type: 'scheduleSettle', generation: g }];

  describe('NotchMachineScheduleTests', () => {
    it('openingTheScheduleOnlyAnimatesUnderTheMask', () => {
      const m = open(), before = m.generation;
      expect(m.handle({ type: 'scheduleChanged', expansion: 'controls' })).toEqual(step('controls', before + 1));
      expect(m.schedule).toBe('controls');
      expect(m.generation).toBe(before + 1);
    });
    it('noScheduleStepTouchesTheWindow', () => {
      const m = open();
      const windowEffects = ['configureGeometry', 'switchToOpenCanvas', 'relayoutOpenWindow', 'park', 'orderOut'];
      for (const x of ['controls', 'calendar', 'controls', 'none', 'calendar', 'none'] as ScheduleExpansion[]) {
        const e = m.handle({ type: 'scheduleChanged', expansion: x });
        expect(e).toEqual(step(x, m.generation));
        expect(e.some((y) => windowEffects.includes(y.type))).toBe(false);
        expect(m.handle({ type: 'settleTimerFired', generation: m.generation })).toEqual([{ type: 'setSettled', settled: true }]);
      }
    });
    it('showWhileScheduledResetsTheSchedule', () => {
      const m = open();
      m.handle({ type: 'scheduleChanged', expansion: 'calendar' });
      expect(m.handle({ type: 'show' })).toEqual(step('none', m.generation));
      expect(m.phase).toEqual({ type: 'open' });
      expect(m.schedule).toBe('none');
      expect(m.handle({ type: 'settleTimerFired', generation: m.generation })).toEqual([{ type: 'setSettled', settled: true }]);
      expect(m.handle({ type: 'show' })).toEqual([]);
      expect(m.handle({ type: 'scheduleChanged', expansion: 'controls' })).toContainEqual({ type: 'animateSchedule', expansion: 'controls' });
    });
    it.each<NotchEvent>([{ type: 'hide' }, { type: 'save', reduceMotion: false }])('ignoredUnlessOpen (%j)', (leaving) => {
      const m = open();
      m.handle(leaving);
      expect(m.handle({ type: 'scheduleChanged', expansion: 'controls' })).toEqual([]);
      expect(m.schedule).toBe('none');
      expect(new NotchMachine().handle({ type: 'scheduleChanged', expansion: 'calendar' })).toEqual([]);
    });
    it('escapeStepsBackOneLevel', () => {
      expect(afterEscape('calendar')).toBe('controls');
      expect(afterEscape('controls')).toBe('none');
      expect(afterEscape('none')).toBe('none');
      const m = open();
      m.handle({ type: 'scheduleChanged', expansion: 'calendar' });
      m.handle({ type: 'scheduleChanged', expansion: afterEscape(m.schedule) });
      expect([m.schedule, m.phase.type]).toEqual(['controls', 'open']);
      m.handle({ type: 'scheduleChanged', expansion: afterEscape(m.schedule) });
      expect([m.schedule, m.phase.type]).toEqual(['none', 'open']);
    });
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/machine/notchMachineSchedule.test.ts` → expected FAIL (A19 returns `[]` for `scheduleChanged`).
- [ ] **Step 3: Implement** `changeSchedule(x)` and the open branch of `show`.
- [ ] **Step 4: Run** `npx vitest run tests/machine` → expected PASS (14 schedule tests; A19's 31 still pass, the exhaustive alphabet has no `scheduleChanged`, so its 17 shapes hold).
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(machine): in-notch Set Date expansion in NotchMachine"`

---

## Task A21: `machine/springs.ts` — SwiftUI → physical springs and every named animation

**Files:**
- Create: `src/recreation/machine/springs.ts`
- Test: `tests/machine/springs.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (contracts §7 with D11): `interface PhysicalSpring`, `springFromResponse(response, dampingFraction, mass = 1)`, `springFromDurationBounce(duration, bounce, mass = 1)`, `scaled(spring, timeScale)`, `interface Easing`, `EASE_OUT = [0, 0, 0.58, 1]`, `EASE_IN_OUT = [0.42, 0, 0.58, 1]`, `Motion` with every key of contracts §7.

Rules: `stiffness = mass·(2π/response)²`, `damping = 4π·dampingFraction·mass/response` (the derivation comment of contracts §7 goes into the file); `springFromDurationBounce(d, b) = springFromResponse(d, 1 − b)` for `b ≥ 0`; `scaled`: stiffness / t², damping / t. Sources: `NotchState.swift` (open 0.42/0.78, close 0.30/0.92, hoverIn 0.32/0.55, hoverOut 0.30/0.85, saving 0.45/0.82, section 0.38/0.8, contentIn easeOut 0.20 delay 0.16, contentOut easeOut 0.12, reduced easeOut 0.15), `HoverButtonStyle.swift` (scale `.spring(duration: 0.22, bounce: 0.12)`, highlight easeOut 0.12, press `.spring(duration: 0.14, bounce: 0)`), `BottomBar.swift` (flag 0.25/0.7, canSave easeInOut 0.18), `QuickReminderView.swift` (chip 0.3/0.8, suggestion easeOut 0.18, dismiss easeOut 0.15, error easeOut 0.2), `SavedCheckView.swift` (tick easeOut 0.28 delay 0.32, bounce 0.28/0.45 delay 0.55 → 1.18, settle 0.3/0.7 delay 0.72 → 1), `NotchContainerView.swift` (badge fade easeOut 0.16), `NotchButtonStyles.swift` (stagger easeOut 0.24 delay 0.06 + i·0.035, section in easeOut 0.12 / out 0.10), `ScheduleMonthGrid.swift` (month page easeOut 0.15), `ScheduleNotchSection.swift` (focus ring easeOut 0.15, calendar scroll easeOut 0.25). The remaining easings (`regularBottomIn` 0.18 delay 0.12, `regularBottomOut` 0.08, `calendarIn` from y −8) are taken from contracts §7.

- [ ] **Step 1: Write the failing test** `tests/machine/springs.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';
  import { EASE_IN_OUT, EASE_OUT, Motion, scaled, springFromDurationBounce, springFromResponse } from '../../src/recreation/machine/springs';

  describe('springs', () => {
    it.each([
      ['open', 223.801, 23.338], ['close', 438.649, 38.537], ['hoverIn', 385.531, 21.598], ['hoverOut', 438.649, 35.605],
      ['saving', 194.955, 22.899], ['schedule', 273.396, 26.456], ['chip', 438.649, 33.51], ['flag', 631.655, 35.186],
      ['badgeBounce', 503.551, 20.196], ['badgeSettle', 438.649, 29.322], ['hoverScale', 815.67, 50.265], ['press', 2014.205, 89.76],
    ] as const)('%s → stiffness %f, damping %f', (key, stiffness, damping) => {
      const s = Motion[key];
      expect(s.type).toBe('spring');
      expect(s.mass).toBe(1);
      expect(s.stiffness).toBeCloseTo(stiffness, 3);
      expect(s.damping).toBeCloseTo(damping, 3);
    });
    it('durationBounceIsResponseAndOneMinusBounce', () => {
      const a = springFromDurationBounce(0.22, 0.12), b = springFromResponse(0.22, 0.88);
      expect(a.stiffness).toBeCloseTo(b.stiffness, 9);
      expect(a.damping).toBeCloseTo(b.damping, 9);
    });
    it('debugMotionSlowsBy4', () => {
      const s = scaled(Motion.open, 4);
      expect(s.stiffness).toBeCloseTo(223.801 / 16, 3);
      expect(s.damping).toBeCloseTo(23.338 / 4, 3);
    });
    it('easings', () => {
      expect(EASE_OUT).toEqual([0, 0, 0.58, 1]);
      expect(EASE_IN_OUT).toEqual([0.42, 0, 0.58, 1]);
      expect(Motion.contentIn).toEqual({ type: 'tween', ease: EASE_OUT, duration: 0.2, delay: 0.16 });
      expect(Motion.contentOut).toEqual({ type: 'tween', ease: EASE_OUT, duration: 0.12 });
      expect(Motion.reduced).toEqual({ type: 'tween', ease: EASE_OUT, duration: 0.15 });
      expect(Motion.canSave).toEqual({ type: 'tween', ease: EASE_IN_OUT, duration: 0.18 });
      expect(Motion.tickTrim).toEqual({ type: 'tween', ease: EASE_OUT, duration: 0.28, delay: 0.32 });
      expect(Motion.badgeFade).toEqual({ type: 'tween', ease: EASE_OUT, duration: 0.16 });
      expect(Motion.stagger(2).delay).toBeCloseTo(0.13, 10);
      expect(Motion.stagger(0)).toEqual({ type: 'tween', ease: EASE_OUT, duration: 0.24, delay: 0.06 });
    });
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/machine/springs.test.ts` → expected FAIL (module missing).
- [ ] **Step 3: Implement** `springs.ts` (every `Motion` spring built with `springFromResponse` / `springFromDurationBounce` from the SwiftUI constants, never typed as physical numbers).
- [ ] **Step 4: Run** `npx vitest run` → expected PASS (the whole suite: A1–A21).
- [ ] **Step 5: Run** `npm run lint && npm run typecheck` → exit 0.
- [ ] **Step 6: Commit.** `git add -A && git commit -m "feat(machine): SwiftUI spring conversion and the app's named animations"`
