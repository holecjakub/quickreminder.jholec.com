# QuickReminder Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `quickreminder.jholec.com`: a one-page landing for the macOS app QuickReminder whose hero is a fake macOS desktop running a 1:1 functional, animated web recreation of the app (same geometry, radii, springs, timings, colours, type sizes, keyboard behaviour and ported logic as `SPEC.md` and the Swift sources at app commit `144d620`, release 0.5.3), followed by a scroll choreography that turns the desktop into a MacBook and drives the recreation through seven feature sections, a download section and a footer.

**Architecture:** Three directories with a one-way import rule enforced by ESLint. `src/recreation/` is self-contained: `core/` (pure TS ports of `Services/*` and two `Views/*` helpers, Vitest-mirrored from `Tests/QuickReminderCoreTests/*`), `machine/` (the `NotchMachine` reducer, `NotchLayout` metrics, `NotchState` size derivation, the silhouette path and the SwiftUI → physical spring table), `store.ts` / `runtime.ts` / `controller.ts` (the view state, the `PanelController` effect performer with browser timers, and the one place every UI handler and every imperative call goes through, each carrying an `origin: 'user' | 'api'`), and `ui/` (one component per Swift view, `motion` for springs, CSS for easings, every length in points through `px(pt)` against `--pt`). `src/desktop/` imports only `recreation/index.ts` and hosts the 1512 × 982 pt fake screen (wallpaper, menu bar with the notch cut-out, hint, fake cursor, fake Reminders window, keyboard router). `src/app/` imports both and owns the page: the pinned Stage with a GSAP ScrollTrigger-scrubbed camera, the MacBook frame, the section copy, and the choreography (deterministic per-section snapshots, a reconciler that animates only each section's own delta and respects visitor edits through a `dirty` flag, and a throttled section driver).

**Tech Stack:** Vite 7 + React 18.3 + TypeScript 5.9, Tailwind CSS 4 (tokens as CSS variables in `src/tokens.css`), `motion` 12 (springs, layout animations), GSAP 3 + ScrollTrigger (scroll choreography), Vitest 4 (logic + jsdom component tests), Playwright 1.64 (smoke / choreography / responsive e2e, chromium + webkit), `@phosphor-icons/react` (icons), `@fontsource/inter` + `@fontsource/fragment-mono` (page type), Vercel static hosting on `quickreminder.jholec.com`.

**Spec:** /Users/jakub/Developer/quickreminder.jholec.com/docs/superpowers/specs/2026-10-27-quickreminder-landing-design.md

Binding companions (read before any task): the contracts `docs/superpowers/plans/parts/00-contracts.md` (every exported name and signature) and the app repo `/Users/jakub/Developer/Xcode Apps/QuickReminder` at `144d620` (`SPEC.md` §1 §3 §4, `Sources/QuickReminder/**`, `Tests/QuickReminderCoreTests/**`). Where the contracts and the Swift code disagree, the code wins (landing spec §3); the deviations are listed under Global Constraints and already folded into every task below.

## Global Constraints (one line each, exact values from the spec)

- Source of truth: the Swift code at `144d620` plus `SPEC.md`; code wins over SPEC and over the contracts; nothing is eyeballed or approximated.
- Units: every recreation and desktop length is in points on a 1512 × 982 pt fake 14" MacBook Pro screen; one CSS variable `--pt` scales the scene; `ui/` writes lengths only as `px(pt)` = `calc(<pt> * var(--pt) * 1px)`.
- Closed silhouette 235 × 39 (`NotchGeometry.closedShapeSize`: notch 221 × 38 + 2·6 fillets + 2 bleed, +1 tall), radii 6 / 14; open 600 × 241, radii 19 / 32; notch band 39 pt dead zone; hover 257 × 44 (+22 × 5) after a 90 ms dwell; saved 379 × 39 (+2·72); Set Date 600 × 519 (controls) / 600 × 751 (calendar) and Location 600 × 347 (`LocationMetrics`: field 36 + 14 + footer 36 = 86 pt section), each appended below the bottom bar, one section at a time; open canvas 648 × 775 (the calendar stays the tallest state).
- Springs are SwiftUI `response` / `dampingFraction` converted to physical springs (`stiffness = (2π/response)²`, `damping = 4π·dampingFraction/response`, mass 1): open 0.42 / 0.78, close 0.30 / 0.92, hover in 0.32 / 0.55, hover out 0.30 / 0.85, saving 0.45 / 0.82, schedule 0.38 / 0.80, chip 0.30 / 0.80, flag 0.25 / 0.70, badge bounce 0.28 / 0.45 (delay 0.55 s, 1.18×), badge settle 0.30 / 0.70 (delay 0.72 s), hover scale duration 0.22 bounce 0.12, press 0.14 / 0.
- Easings: content in easeOut 0.20 delayed 0.16 (blur 8 → 0, scale 0.94 → 1 from the top, masked to the live silhouette until settled); content out easeOut 0.12; section rows stagger easeOut 0.24 at 0.06 + i·0.035 from y −6 / blur 3; tick trim easeOut 0.28 after 0.32; hold 1.0 s; close 0.36 s; settle 0.5 s; focus retries 0.12 / 0.30 s; reduced motion = easeOut 0.15 everywhere, no swell, blur or scale.
- Visual (SPEC §4, text scale fixed 1.0): 20 pt horizontal padding (content inset 39); header "Reminders" 22 / 700 in the list accent + chevron 13 / 700 at 7 pt; ⓧ 24 pt circle `#59595D`, glyph 11 / 700, hit 36; dotted circle 21 pt, 1.5 pt, `#59595D`; title 19 / 400 (row 25, line 23, max 2000) placeholder "New Reminder"; notes 15 / 400 (row 20, line 18, max 10000) placeholder "Notes"; pill 44 pt capsule, fill white 3 %, 1 pt `#3D3D3F`, three 18 pt icons, 38 pt hits, 55 pt centre spacing; ✓ 48 pt circle `#474749` disabled / accent enabled, glyph 22 / 600; chip slot 26 pt; hover 1.06× / press 0.94×, pill highlight white 10 % / 18 %.
- Set Date rhythm (`ScheduleMetrics`): type field 36, preview 18, presets 2 × 3 cards 44 tall gap 8, day/time row 30, month grid 26 + 18 + 6·28 + 5·2 = 222, footer 36, control radius 12; rows from y 241: 241–277 · 283–301 · 311–355 / 363–407 · 419–449 · [459–681] · 463–499 / 695–731 · inset 20.
- Colours of the recreation come from `Views/Theme.swift` only (`--qr-*`): black `#000000`, accent `#0A84FF`, placeholder / dashed ring / grey circle `#59595D`, disabled `#474749`, pill stroke `#3D3D3F`, flag orange `#FF9E0A`, error `#FF453A`; lists Reminders `#0A84FF`, Work `#BF5AF2`, Home `#FF9F0A`, Groceries `#30D158`, Ideas `#FF375F`; accent label contrast via `AccentContrast` (min 3.0).
- Page tokens (`--jh-*`, jholec.com): white `#FFFFFF`, black `#0A0A0A`, light black `#121212`, light grey `#EBEBEB` (90 % card variant), medium grey `#757575`, grey `#A8A8A8`, dark grey `#4D4D4D`, link `#0099FF`; Inter 400 / 500 / 600; type 14 / 16 / 18 / 24 / 32 / 54; spacing 8 / 16 / 24 / 40 / 48 / 80 / 140 / 160; radius 16; section gap 160; page margins 140 top/bottom, 20–40 sides; progress bar 2 px; breakpoint 810 px; pinned column 58 %.
- Fonts: the recreation uses the system stack `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Inter, sans-serif` with tabular figures where Swift uses `monospacedDigit()`; the page uses Inter; SF Pro is never self-hosted.
- Icons: Phosphor only, at the app's optical sizes (table in Task 23 (B3)); the app icon comes from `Resources/AppIcon.icns`; the menu-bar glyph is Phosphor `ListChecks` at 16 pt; no SF Symbol files, no Apple wallpapers, no Apple chrome.
- Time: `now: Date` and `calendar: Calendar` are explicit parameters everywhere in `core/` and `machine/`; production uses `AppClock.now` (`?now=` override) and `currentCalendar()` (visitor's zone, locale `en-US`, 12-hour, first weekday Sunday); Czech phrases parse regardless; tests inject fixed values (parser `now` = Friday 2026-09-18 10:00 Europe/Prague; Vitest runs in `Pacific/Auckland`).
- Keyboard: shortcuts work only while focus is inside the focusable desktop container and always `preventDefault()`; ⌘ = `metaKey || ctrlKey`; ⌘1…⌘6 by key `code`; Esc steps back one level in the code's order list picker → calendar → section (Set Date controls or Location, closed without writing) → panel (`QuickReminderView.panelDismissPopovers`, `NotchSection.afterEscape`); there is no Location popover; `show({ source: 'scroll' })` never focuses; a user-originated mutation sets `dirty`, an API one never does.
- Choreography: sections trigger at `start: 'top center'`; one action at a time, a running action may finish up to 2.5 s before the next starts; demo reminder "Call mum tomorrow at 2pm" typed at 18 cps, chip applied after 900 ms, list Work, flag on, location "Office"; list cycle Reminders → Work → Home → Work; visitor edits win (`dirty`); scrolling up only closes for the hero; `?debug=motion` slows every animation and timer 4×.
- Camera: hero scale `min(w / 1512, h / 982)` letterboxed; features scale 1 CSS px per point clamped to the pinned column and never below 0.75, origin at the notch top centre (scene 756, 0); no pinning below 810 px, the recreation is scaled, never reflowed.
- Quality: Vitest mirrors every applicable Swift test case by name; Lighthouse performance ≥ 95 desktop; page copy contrast ≥ 4.5:1; `prefers-reduced-motion` honoured; Playwright smoke = load, notch click opens, "tomorrow at 2pm" shows the chip, Tab applies it, ⌘↩ saves and the item lands in the fake window.
- Repo: branch `develop` (created in Task 1), Conventional Commits in English, `main` deploys to Vercel; no analytics, nothing typed leaves the browser; MIT licence; trademark disclaimer in the footer.

### Contract deviations applied to every task (the code at `144d620` wins over `00-contracts.md`)

The contracts were written against app commit `3d93fc7`; `main` moved to `144d620` the same day (`d641200` Set Date grows below the bottom bar, `90956b3` Set Date never resizes the window, `0c87117` Location in the notch). Names from the contracts are kept (except the section names of A-D5 and the Location API of B-D3, which follow Swift), values and effect lists follow the code. Tasks 1–21 cite the A list as "D1"…"D16"; Tasks 22–46 cite the B list as "D1"…"D6"; Tasks 47–71 cite the C list as "cross-area note n".

| # | Contract | This plan (and the Swift source) |
|---|---|---|
| A-D1 | `scheduleControlsSize` 600 × 431, `scheduleCalendarSize` 600 × 663 (also landing spec §5.1, §11.1) | **600 × 519** and **600 × 751**: `scheduleContentHeight` = `contentHeight` (202) + section (258 / 490) + 20 (`NotchStateTests.scheduleHeightFollowsTheRhythm`: 480 / 712) |
| A-D2 | `ScheduleMetrics.topGap 14`; section rows from y 139 | no `topGap`: the section is appended below the bottom bar; `sectionHeight` 258 / 490; rows from y **241**: type field 241–277 · preview 283–301 · presets 311–355 / 363–407 · day/time 419–449 · [calendar 459–681] · footer 463–499 / 695–731 · inset 20 → 519 / 751 |
| A-D3 | `scheduleSectionTop(band)` = 139, used for click-cancel | `scheduleSectionTop(band)` = band + `contentHeight` = **241** (the section's real top); the click-cancel band is `sectionCancelBandBottom(band)` = band + `topContentHeight` = **139** (Swift `sectionCancelBandBottom`); `clickCancelsSection(y, bandBottom, section)` |
| A-D4 | `NotchMachine.canvasGrown`, effects `growCanvasForSchedule` / `fitCanvasToPanel` | **removed** (`90956b3`): every `sectionChanged` = `[setSettled(false), animateSection(x), scheduleSettle(g+1)]`; every settle = `[setSettled(true)]` (`NotchMachineScheduleTests.noScheduleStepTouchesTheWindow`) |
| A-D5 | `ScheduleExpansion` = none / controls / calendar; `scheduleChanged` / `animateSchedule` / field `schedule`; `clickCancelsSchedule` | **Swift names and the fourth case** (`0c87117`, landing spec §5.3, §11.4, §11.6): `NotchSection = 'none' \| 'controls' \| 'calendar' \| 'location'` (Swift `.none`, `.schedule(.controls)`, `.schedule(.calendar)`, `.location`, flattened like the Swift shorthands `NotchSection.controls` / `.calendar`), `isSchedule(s)`, `afterEscape(s)` (calendar → controls, every other → none); event `sectionChanged(section)`, effect `animateSection(section)`, the machine / `NotchFlags` / `RecreationState` / `SectionSnapshot` field `section`, `clickCancelsSection(y, bandBottom, section)`, DOM attribute `data-section`; the Location tests are ported (`NotchStateTests.locationHeightFollowsTheRhythm`, `.locationSizeAndPrecedence`, `NotchMachineScheduleTests.locationIsASectionLikeSetDate`, `.switchingSectionsIsOneStep`, `.escapeAndShowCloseLocation`, `LocationDraftTests`, `ScheduleDraftTests.switchingKeepsTheEdit`). The spring keeps the contract name `Motion.schedule` (Swift `NotchLayout.sectionAnimation`, 0.38 / 0.8) and drives every section |
| A-D6 | `ScheduleCommit.textRowSubmit(schedulingInNotch, canSave): 'setSchedule' \| …` | Swift `textRowSubmit(sectionOpen:canSave:)` → `.commitSection`; contract names kept, `'setSchedule'` ≡ `.commitSection` = the open section's commit (Set Date: Set, Location: Done) |
| A-D7 | `ScheduleDraft` without a save decision | adds `isDirty`, `prepareSave(): SaveDecision` (`'saveAsIs' \| 'commitThenSave' \| 'invalid'`, Swift `ScheduleDraft.prepareSave`) and `prepareSwitch()` (= `prepareSave()`, Swift `ScheduleDraft.prepareSwitch`, used when the panel switches from Set Date to Location) |
| A-D8 | `MonthGrid` without `week` | adds `week(day, calendar)` (`MonthGridTests.weekRowOfADay`) |
| A-D9 | relative words "Today" / "Tomorrow", "dnes" / "zítra" | as Foundation on macOS 26: en ±1 day `Yesterday` / `Today` / `Tomorrow`; cs ±2 days `Předevčírem` / `Včera` / `Dnes` / `Zítra` / `Pozítří` (capitalised); en glue stays `", "` (SPEC §1 "Tomorrow, 2:00 PM"), cs glue `" "` |
| A-D10 | `RelativeDistance` en "in 28 hr.", cs "za 28 h"; `string(from, to, locale)` | Foundation `.abbreviated` prints `in 1d`, `in 23h`, `3h ago`, cs `za 1 den`, `za 23 h`; largest calendar component first, so the signature is `string(from, to, locale, calendar)` |
| A-D11 | `Motion.open` damping 23.337, `Motion.hoverScale` damping 50.266 | correctly rounded **23.338**, **50.265** |
| A-D12 | `NotchLayout` exports | adds `lineHeight(pointSize)` (⌈p · 2412 / 2048⌉), `sectionCancelBandBottom`, `passesMouseThrough`, `openCanvasSize` (648 × 775), all from `NotchState.swift` |
| A-D13 | `Theme.pill` | adds `activeFillAlpha 0.22` / `activeInset 3` (`BottomBar.swift:140`) |
| A-D14 | `AppClock` + "createClock()" | `createClock(opts: { search; timeZone; realNow? }): Clock` (Task 3 (A3)) |
| A-D15 | NaturalDateParser "~240 cases" | `NaturalDateParserTests.swift` has 103 argument cases + 4 single tests; all mirrored (Tasks 5–6) |
| A-D16 | `contains()` "same as Swift" | Swift hit-tests the CoreGraphics flattening of each quadratic into n = max(1, ⌈√(r·√2 / 4)⌉) chords (r 6 → 2, 14 → 3, 19 → 3, 32 → 4); the port hit-tests that polygon; drawing keeps true `Q` curves |
| B-D1 | Set Date rows from y 153, heights 431 / 663 (= A-D1, A-D2) | section below the bottom bar; chip slot and bottom bar stay visible and live while it is open; `Motion.regularBottomIn/Out` unused |
| B-D2 | `RecreationHandle.escape()` comment: calendar → controls → popovers → panel | code order **list picker → calendar → section → panel** (`QuickReminderView.panelDismissPopovers`: the list picker first, then `setSection(notch.section.afterEscape)`; `PanelController` Esc monitor hides when nothing is open): `'popover'` = the list picker, `'calendar'` = calendar → controls, `'section'` = Set Date controls or Location closed without writing; signature unchanged |
| B-D3 | Location popover (`LocationPopover.tsx`, `locationPopoverOpen`, `openLocationPopover` / `closeLocationPopover`, `typeLocation` "opens the popover") | **the in-notch Location section is ported** (`0c87117`; `Views/LocationNotchSection.swift`, `Services/LocationDraft.swift`, `Views/SectionHandoff.swift`): `core/locationDraft.ts` (Task 14 (A14)), section `'location'` in the machine (Tasks 19–20), 86 pt section / 600 × 347 panel (Tasks 16, 18), `ui/LocationNotchSection.tsx` (Task 34 (B14)) appended below the bottom bar like Set Date. `RecreationState.locationPopoverOpen` ⇒ `section === 'location'` plus `locationField` (the open section's field text) and the derived `locationInNotch` / `sectionOpen`; handle / controller `openLocationPopover` / `closeLocationPopover` ⇒ `openLocation`, `toggleLocation` (location button), `cancelLocation` (Cancel, Esc, click on header / title / notes: nothing written), `commitLocation` (Done, ↩ / ⌘↩), `clearLocation`, `setLocationText`, `locationDraft()`; `PointerTarget` adds `locationClear`, `locationCancel`; `save()` / ⌘↩ while a section is open commits that section (Set / Done) and resolves null; ✓ applies an edited location then saves (`LocationDraft.saveDecision`); opening one section while the other is shown keeps what was typed (`switchSection`, Swift `QuickReminderView.switchSection` + `SectionHandoff`; an invalid typed date beeps and blocks the switch). No popover for Location anywhere |
| B-D4 | ✓ while Set Date is open | `ScheduleDraft.prepareSave()` from Task 10 (A10) decides (untouched → close and save as is; edited → Set then save; invalid → beep) — the store keeps no "touched" flag of its own |
| B-D5 | file tree | adds inside `src/recreation/`: `motionScale.ts`, `controller.ts`, `ui/units.ts`, `ui/transitions.ts`, `ui/motionPrefs.tsx`, `ui/focus.ts`, `ui/RecreationContext.tsx`, `ui/NotchSilhouette.tsx`, `ui/Popover.tsx`, `ui/NumericText.tsx`, `ui/keyboard.ts`, `ui/recreation.css`, `dev/harness.tsx` (+ `recreation-harness.html`); `NotchRuntime.reset()` and option `onDispatched`; `icons.tsx` owns the SF → Phosphor table; the contract's `ui/LocationPopover.tsx` is replaced by `ui/LocationNotchSection.tsx`, and `core/locationDraft.ts` is added (B-D3) |
| B-D6 | machine effects | the runtime switches only on the effects Task 19 (A19) emits (no canvas effects, A-D4) |
| C-N1 | menu-bar glyph from `MenuBarIcon.imageset` | the imageset holds only `Contents.json`; the app's status item is SF `checklist` → Phosphor `ListChecks` at 16 pt; the `.icns` serves the Download section and favicon |
| C-N2 | `listCycle` "ends on the last" | `['reminders', 'work', 'home', 'work']`: the spec's three lists, ending on the demo list Work |
| C-N3 | Reminders window bottom-right | at scene x 790, y 330 (320 wide, max 340 tall) so it is visible in the features crop (x ≈ 338…1174 pt at 1440 px) |
| C-N4 | `DesktopSceneProps` | adds `timeScale?: number` (default 1): `desktop/` may not import `app/motionDebug.ts`, the Stage passes the `?debug=motion` scale in |
| C-N5 | `stageCamera.ts` exports | adds `CAMERA`, `pinnedColumnWidth`, `featuresScale` (height clamp), `renderPtFor`, `clipFor`, `titleOpacityFor`, `phoneStageHeight`, `cameraTransform`; `featuresPt` keeps the contract signature |
| C-N6 | area B requirements | `pointFor()` divides by the canvas' `getBoundingClientRect()` scale, so it is exact under the Stage transform (B23); `focusTitle()` uses `focus({ preventScroll: true })` (B9); field components `preventDefault()` every key they handle (B22); the title field is an `<input>` named "New Reminder" (B10); Swift accessibility labels kept ("Save reminder", "Use suggested date", "Change date", "Saved", "Close", "Type a date") |
| C-N7 | `icons.tsx` "table in part 03" | belongs to Task 23 (B3) |
| C-N8 | calendar height 663 in the camera | area C reads `NotchLayout.scheduleCalendarSize.height` symbolically (751 after A-D1) |
| C-N9 | file tree | adds `src/app/gsap.ts` (Task 47, GSAP with ScrollTrigger registered once), `src/desktop/scene.ts` (Task 48, `SCENE`, `ptCss`, layout constants), `src/desktop/useMediaQuery.ts` (Task 50, `useMediaQuery`, `useColorScheme`), and the test-only `tests/fakes/*` (Tasks 47, 54) and `tests/{ui,recreation,desktop,app}/*` |

## Review Focus (the five input classes or failure modes the spec implies but no task's tests exercise that are most likely to bite a visitor; for each, add the pinning test to the owning task)

1. **R1 — Touch pointers on the notch (Task 44 (B24)).** On a phone a tap fires `pointerenter` with `pointerType: 'touch'` before `pointerdown`; without a guard the 90 ms dwell arms, the swell plays and the open spring starts from 257 × 44. The pin: a touch `pointerEnter` leaves `hoverDwellPending` and `hoverSwollen` false and the path at the closed geometry; the touch `pointerDown` still opens.
2. **R2 — The closed notch at phone scale (Task 41 (B21)).** At `--pt` 0.258 the closed silhouette is 61 × 10 CSS px; landing §7 promises it "remains tappable". The pin: an invisible hit layer sized `max(px(235), 44px)` × `max(px(39), 44px)` is present while closed, forwards the press to `show('click')`, and ignores the pointer once open.
3. **R3 — Crossing the 810 px breakpoint while pinned (Task 57 (C11)).** Narrowing a laptop window or rotating a tablet flips the sticky/phone layout live; a stale pin spacer or a stale `--pt` breaks the hero. The pin: a media-query flip plus `resize` kills the scrub trigger once, calls `ScrollTrigger.refresh()`, re-renders the phone block at `phoneStageHeight` and recomputes `--pt`; flipping back creates the trigger again.
4. **R4 — Background-tab timer throttling (Task 61 (C15)).** A `typeTitle` run started just before the visitor switches tabs is throttled to ≥ 1 s per timer, overruns the 2.5 s deadline when another section is pending, and leaves "Call mum tomo" with no chip on return. The pin: `SectionQueue.pause()` / `resume()` on `visibilitychange`, and an aborted section is replayed instantly (`cps: Infinity`, no cursor) when the tab becomes visible.
5. **R5 — Astral characters before a date phrase (Task 5 (A5)).** No Swift test has a character outside the BMP, but visitors type emoji; `matchedRange` is defined in UTF-16 units and `removingMatch` slices by them. The pin: `'🎉 party tomorrow at 2pm'` → range `{ 9, 24 }`, stripped `'🎉 party'`; `'🇨🇿 zítra ve 14:00'` → range `{ 5, 19 }`, stripped `'🇨🇿'`.

## Build order and parallelism (which tasks depend on which; which groups can run in parallel by directory: core, recreation/ui, desktop+page)

Area letters map to task numbers as follows (every cross-reference inside a task keeps the area id):

| Area | Tasks |
|---|---|
| A (scaffold, `recreation/core`, `recreation/machine`) | A1 = 1, A2 = 2, … A21 = 21 |
| B (`recreation/ui`, store, runtime, controller, `Recreation`) | B1 = 22, B3 = 23, B4 = 24, B5 = 25, B6 = 26, B7 = 27, B8 = 28, B9 = 29, B10 = 30, B11 = 31, B12 = 32, B13 = 33, B14 = 34, B15 = 35, B16 = 36, B17 = 37, B18 = 38, B19 = 39, B20 = 40, B21 = 41, B22 = 42, B23 = 43, B24 = 44, B25 = 45, B26 = 46 (B2 merged into Task 16) |
| C (`desktop`, `app`, e2e, deploy) | C1 = 47, C2 = 48, C3 = 49, C4 = 50, C5 = 51, C6 = 52, C7 = 53, C8 = 54, C9 = 55, C10 = 56, C11 = 57, C12 = 58, C13 = 59, C14 = 60, C15 = 61, C16 = 62, C17 = 63, C18 = 64, C19 = 65, C20 = 66, C21 = 67, C22 = 68, C23 = 69, C24 = 70, C25 = 71 |

Dependencies (a task consumes only tasks listed before it in the document):

- **Task 1 (A1)** first, alone: scaffold, tokens, lint boundaries, branch `develop`.
- **Group core — `src/recreation/core/`, Tasks 2–14**, sequential: A2 → A3 → A4 → A5 → A6 → A7 → A8 → A9 → A10 (needs A2–A4, A7–A9) → A11 → A12 (needs A2, A4) → A13 (A7) → A14 (A12).
- **Group machine — `src/recreation/machine/`, Tasks 15–21**, sequential: A15 → A16 (A15) → A17 (A16) → A18 (A15, A16) → A19 (A16) → A20 (A19) → A21 (nothing). Group machine runs **in parallel with group core** (no imports between them).
- **Group recreation/ui — Tasks 22–46**, sequential, after groups core and machine: B1 (A21) → B3 → B4 → B5 (A15, A16) → B6 (A5–A6, A12, A14 incl. `LocationDraft`, A19 `isSchedule`) → B7 (A9, A10 incl. `prepareSwitch`) → B8 (A19, A20) → B9 (B6–B8, A8, A18) → B10 → B11 → B12 → B13 (B9 `toggleLocation`) → B14 (A11, A14, A16 `LocationMetrics`, A17 `Theme.locationField`, B1, B3 `location@12`, B4, B9) → B15 → B16 (A9) → B17 (A4, A10, A12, A13) → B18 → B19 → B20 (B14, B19) → B21 → B22 → B23 (everything above) → B24 → B25 → B26 (Playwright config from A1).
- **Group desktop+page — Tasks 47–66**, may start as soon as Tasks 1–21 are in, **in parallel with group recreation/ui**: everything in it is tested against the contract types and `tests/fakes/fakeRecreationHandle.ts` (C8) with `vi.mock('src/recreation')`; C2 creates `src/recreation/index.ts` with type re-exports when B23 has not landed yet (B23 then extends it). Order inside the group: C1 → C2 → {C3, C4, C9, C10, C13 in any order} → C5 (C2) → C6 (C2, C4) → C7 (C2) → C8 (C2–C7) → C11 (C1, C4, C8–C10) → C12 (C1, C10) → C14 (C1, C13, C8 fakes) → C15 (C1, C4, C13, C14) → C16 (C11, C13, C15) → {C17, C18, C19} (C12, C16) → C20 (C1, C11, C12, C16–C19).
- **Join — Tasks 67–71**, after Task 46 and Task 66: C21 (a11y + contrast, A11) → C22 (Playwright smoke) → C23 (choreography + responsive e2e) → C24 (Lighthouse) → C25 (Vercel, README, GitHub, deploy).
- Three parallel lanes at most: lane 1 = core (2–14), lane 2 = machine (15–21), then lane 1 = recreation/ui (22–46) and lane 2 = desktop+page (47–66); the join (67–71) is single-lane. Each lane commits to `develop`; lanes touch disjoint directories except `package.json` / `package-lock.json` (B1 and C1 each add only their own exact devDependencies; rebase, do not merge-resolve by hand) and `src/recreation/index.ts` (C2 creates, B23 extends).

---

### Task 1 (A1): Scaffold, tokens, lint boundaries, branch `develop`

**Files:**
- Create: `package.json`, `.npmrc`, `.nvmrc`, `.gitignore`, `index.html`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `tsconfig.json`, `eslint.config.js`, `README.md`
- Create: `src/main.tsx`, `src/App.tsx` (placeholder shell, replaced by Task 66 (C20)), `src/index.css`, `src/tokens.css`, `src/vite-env.d.ts`
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

- [ ] **Step 12: Write `README.md`** (stub): one-paragraph intent (landing spec §1), stack line (landing spec §4), commands (`npm run dev | test | e2e | lint | build`), "Source of truth: the app repo `holecjakub/QuickReminder` (SPEC.md and the Swift sources)", and the trademark disclaimer placeholder "QuickReminder is an independent app and is not affiliated with Apple Inc." (final wording from the app README in Task 65 (C19) `FOOTER_COPY.disclaimer` and Task 71 (C25) README).

- [ ] **Step 13: Commit.** `git add -A && git commit -m "chore: scaffold Vite, React 18, Tailwind, Vitest, Playwright and design tokens"`

---

### Task 2 (A2): `core/calendar.ts` — time-zone-safe calendar arithmetic + test support

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

### Task 3 (A3): `core/scheduleDefaults.ts` + `recreation/clock.ts`

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

### Task 4 (A4): `core/datePresets.ts`

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

### Task 5 (A5): `core/naturalDateParser.ts` — normalisation, days, dates, `removingMatch`

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

- [ ] **Step 6: Review-focus pin R5 — astral characters keep UTF-16 offsets.** No Swift case has a character outside the BMP, yet visitors type emoji. Add to `tests/core/naturalDateParser.test.ts` (inside `describe('NaturalDateParserTests')`):
  ```ts
  it('reviewFocus_astralCharactersBeforeThePhraseKeepUTF16Offsets', () => {
    const text = '🎉 party tomorrow at 2pm';                 // "🎉" is two UTF-16 code units
    const s = NaturalDateParser.parse(text, NOW, ndpCalendar)!;
    expect(s.matchedText).toBe('tomorrow at 2pm');
    expect(s.matchedRange).toEqual({ start: 9, end: 24 });
    expect(text.slice(s.matchedRange.start, s.matchedRange.end)).toBe('tomorrow at 2pm');
    expect(NaturalDateParser.removingMatch(text, s)).toBe('🎉 party');
    const cz = '🇨🇿 zítra ve 14:00';                          // regional-indicator pair: four code units
    const f = NaturalDateParser.parse(cz, NOW, ndpCalendar)!;
    expect(f.matchedRange).toEqual({ start: 5, end: 19 });
    expect(f.date).toEqual(ndp(2026, 9, 19, 14, 0));
    expect(NaturalDateParser.removingMatch(cz, f)).toBe('🇨🇿');
  });
  ```
  Run `npx vitest run tests/core/naturalDateParser.test.ts` → expected PASS (the contracts §2.2 normalisation keeps every character's UTF-16 length, so offsets map 1:1 onto the original text); then `git add tests/core/naturalDateParser.test.ts && git commit -m "test(core): pin UTF-16 offsets around astral characters"`.

---

### Task 6 (A6): `core/naturalDateParser.ts` — times, offsets, merging, DST + preset parity

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

### Task 7 (A7): `core/scheduleInput.ts`

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

### Task 8 (A8): `core/scheduleCommit.ts`

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

### Task 9 (A9): `core/monthGrid.ts`

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

### Task 10 (A10): `core/scheduleDraft.ts`

**Files:**
- Create: `src/recreation/core/scheduleDraft.ts`
- Test: `tests/core/scheduleDraft.test.ts`

**Interfaces:**
- Consumes: A2 `components`, `daysInMonth`, `addDays`, `startOfDay`; A3 `ScheduleDefaults.compose`, `.at`, `Clock`; A4 `DatePresets.date`, `.highlighted`, `DatePreset`, `PresetPick`; A7 `ScheduleInput.resolve`, `ScheduleInputResult`; A8 `ScheduleCommit.opening`, `.dateToSet`, `.consumesSuggestion`; A9 `MonthGrid.moving`, `.startOfMonth`, `.isSelectable`.
- Produces (contracts §2.7 + D7): `interface ScheduleOutcome`, `class ScheduleDraft` with every member of §2.7 plus `get isDirty(): boolean`, `prepareSave(): SaveDecision` and `prepareSwitch(): SaveDecision`, `type SaveDecision = { readonly type: 'saveAsIs' } | { readonly type: 'commitThenSave'; readonly outcome: ScheduleOutcome } | { readonly type: 'invalid' }`.

Rules (Swift `ScheduleDraft.swift`): constructor: `opening(selected, initialText, clock())` → `draft`, `text`; `parsed = resolve(text, clock())`; `isDirty false` (the prefilled text is not an edit). `set text(v)`: when `v !== text` → `isDirty = true`, reparse at `clock()`, a date moves `draft`. `setFromControls(d)`: `isDirty = true`, `draft = d`, `text = ''`. `pick(day)` = `setFromControls(compose(day, draft))`. `setTime(h, m = 0)` = `setFromControls(at(h, m, draft))`. `applyTypedTime(s)`: `resolve(s, clock())` not a date → false; else `setFromControls(compose(draft, thatDate))`, true. `stepTime(n)`: `mins = hour·60 + minute` of `draft`; `snapped = n > 0 ? (trunc(mins / 15) + n)·15 : (trunc((mins + 14) / 15) + n)·15` (Swift `Int` division truncates); `wrapped = ((snapped % 1440) + 1440) % 1440`; `setTime(⌊wrapped/60⌋, wrapped % 60)`. `moveDay(n)`: `moved = MonthGrid.moving(draft, n, clock())`; equal to `draft` → false; else `setFromControls(moved)`, true. `moveInto(month)`: `first = startOfMonth(month)`; `day = addDays(first, min(day(draft), daysInMonth(first)) − 1)`; not selectable → `startOfDay(clock())`; `pick(day)`. `set()`: text non-empty → re-resolve at `clock()` (relative phrases count from the moment of Set); committed or `dateToSet` null → null; `draft = date`; outcome `{ date, presetPick: null, consumesSuggestion('set') }`. `apply(p)`: committed → null; `date = DatePresets.date(p, clock())`; `{ date, presetPick: { preset: p, date }, consumesSuggestion('preset') }`. `clear()`: committed → null; `{ date: null, presetPick: null, consumesSuggestion('clear') }`. Each commit sets `committed = true`. `prepareSave()`: `!isDirty || committed` → `saveAsIs`; `set()` null → `invalid`; else `commitThenSave`. `prepareSwitch()` = `prepareSave()` (Swift `ScheduleDraft.prepareSwitch`: the panel switching to Location keeps an edit by Setting it, an untouched draft writes nothing, an invalid typed date blocks the switch; the caller writes the outcome without closing, Task 29 (B9) `switchSection`). `subscribe`: listeners run once after every public mutation.

Swift cases mirrored (`ScheduleDraftTests.swift`, now Fri 23 Oct 2026 10:00 Prague): `opensOnTheSharedRules`, `relativeTextResolvesAtSetNotAtTheLastKeystroke`, `typingParsesOnceAndMovesTheDraft`, `controlsClearTheTypedText`, `timeStepsSnapToQuarterHours`, `gridMovementAndPaging`, `setWritesTheTypedDateOnceAndConsumesThePhrase`, `setOnInvalidTextStaysOpen`, `presetRecordsThePickAndClearKeepsTheTitle`, `singleHighlight`, `untouchedSavesAsIs`, `anEditIsCommittedBeforeSaving`, `invalidTextBlocksTheSave`, `afterACommitTheSaveGoesThroughAsIs`, `switchingKeepsTheEdit` (D5, D7).

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
    it('switchingKeepsTheEdit', () => {
      expect(make().prepareSwitch()).toEqual({ type: 'saveAsIs' });        // untouched: nothing written
      const edited = make();
      edited.setTime(15);
      const d = edited.prepareSwitch();
      expect(d.type === 'commitThenSave' && pragueString(d.outcome.date!)).toBe('2026-10-24 15:00');
      const invalid = make();
      invalid.text = 'not a date';
      expect(invalid.prepareSwitch()).toEqual({ type: 'invalid' });       // blocks the switch
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
- [ ] **Step 4: Run** → expected PASS (16 tests).
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(core): ScheduleDraft model shared by every Set Date control"`

---

### Task 11 (A11): `core/accentContrast.ts`

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

### Task 12 (A12): `core/suggestionDateFormatter.ts` + `RelativeDistance`

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

### Task 13 (A13): `core/scheduleText.ts`

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

### Task 14 (A14): `core/lists.ts` + `core/reminder.ts` + `core/locationDraft.ts`

**Files:**
- Create: `src/recreation/core/lists.ts`, `src/recreation/core/reminder.ts`, `src/recreation/core/locationDraft.ts`
- Test: `tests/core/reminder.test.ts`, `tests/core/locationDraft.test.ts`

**Interfaces:**
- Consumes: A12 `SuggestionDateFormatter.string`.
- Produces (contracts §2.12, §2.13, exact): `type ListId`, `interface ReminderList`, `FAKE_LISTS`, `DEFAULT_LIST_ID = 'reminders'`, `listById(id)`, `accentFor(id)`; `interface ReminderDraft`, `buildNotes(notes, location)`, `interface SavedReminder`, `toSavedReminder(draft, now, formatter)`; and (B-D3, Swift `Services/LocationDraft.swift`, the in-notch Location section's working state):
  ```ts
  // core/locationDraft.ts
  export type LocationSaveDecision = { readonly type: 'saveAsIs' } | { readonly type: 'applyThenSave'; readonly text: string };   // Swift LocationDraft.SaveDecision
  export class LocationDraft {
    constructor(original: string);              // the reminder's location when the section opened ('' = none); text starts equal to it
    readonly original: string;
    text: string;                               // the field
    get isDirty(): boolean;                     // text !== original
    get committed(): string;                    // what Done writes: the field as typed (the save path trims; blank removes the location)
    get saveDecision(): LocationSaveDecision;   // ✓ while the section is open: isDirty ? applyThenSave(committed) : saveAsIs
    get textToKeepOnSwitch(): string | null;    // switching to Set Date: isDirty ? committed : null (nothing to write)
  }
  ```

Rules: `accentFor` = the list colour, `'#0A84FF'` (Theme.accent) for an unknown id; `listById` throws on an unknown id. `buildNotes` (Swift `RemindersService.buildNotes`): parts = notes if non-empty, then `'📍 ' + location.trim()` if the trimmed location is non-empty (trim = whitespace and newlines); none → null; `join('\n')`. `toSavedReminder`: `id = crypto.randomUUID()`, `notes = buildNotes(…)`, `listColor = accentFor(listId)`, `dueLabel = dueDate ? formatter.string(dueDate, true, now) : null`, `savedAt = now`, other fields copied.

`LocationDraft`: a plain port, no trimming (Swift writes the text as typed, like the popover; `buildNotes` is the one place it is trimmed).

Swift cases mirrored (`LocationDraftTests.swift`, all six): `BuildNotesTests.notesAndLocation`; `LocationDraftTests.opensOnTheCurrentLocation`, `doneWritesTheFieldAsTyped`, `blankingTheFieldRemovesTheLocation`, `switchingKeepsWhatWasTyped`, `typingBackTheOriginalIsNotAnEdit` (D5).

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
  and `tests/core/locationDraft.test.ts` (Swift `LocationDraftTests`, bodies 1:1):
  ```ts
  import { describe, expect, it } from 'vitest';
  import { LocationDraft } from '../../src/recreation/core/locationDraft';
  import { buildNotes } from '../../src/recreation/core/reminder';

  describe('LocationDraftTests', () => {
    it('opensOnTheCurrentLocation', () => {
      const d = new LocationDraft('Café Slavia');
      expect(d.text).toBe('Café Slavia');
      expect(d.isDirty).toBe(false);
      expect(d.saveDecision).toEqual({ type: 'saveAsIs' });
    });
    it('doneWritesTheFieldAsTyped', () => {
      const d = new LocationDraft('');
      d.text = '  Holešovice, Praha \n';
      expect(d.isDirty).toBe(true);
      expect(d.committed).toBe('  Holešovice, Praha \n');
      expect(d.saveDecision).toEqual({ type: 'applyThenSave', text: '  Holešovice, Praha \n' });
      expect(buildNotes('', d.committed)).toBe('📍 Holešovice, Praha');
    });
    it('blankingTheFieldRemovesTheLocation', () => {
      const d = new LocationDraft('Office');
      d.text = '   ';
      expect(d.saveDecision).toEqual({ type: 'applyThenSave', text: '   ' });
      expect(buildNotes('', d.committed)).toBeNull();
    });
    it('switchingKeepsWhatWasTyped', () => {
      const d = new LocationDraft('Office');
      expect(d.textToKeepOnSwitch).toBeNull();
      d.text = 'Home';
      expect(d.textToKeepOnSwitch).toBe('Home');
    });
    it('typingBackTheOriginalIsNotAnEdit', () => {
      const d = new LocationDraft('Office');
      d.text = 'Off';
      d.text = 'Office';
      expect(d.isDirty).toBe(false);
      expect(d.saveDecision).toEqual({ type: 'saveAsIs' });
    });
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/core/reminder.test.ts tests/core/locationDraft.test.ts` → expected FAIL (modules missing).
- [ ] **Step 3: Implement** `lists.ts` (constants verbatim from contracts §2.12), `reminder.ts` and `locationDraft.ts`.
- [ ] **Step 4: Run** → expected PASS (9 tests: 4 + 5).
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(core): fake reminder lists, the saved-reminder record and the Location draft"`

---

### Task 15 (A15): `machine/notchShape.ts`

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

### Task 16 (A16): `machine/notchLayout.ts` — `NotchLayout`, `ScheduleMetrics` and `LocationMetrics`

> Absorbs the recreation plan's guard task B2 ("Layout pins guard"): every value B2 pinned (258 / 490 / 480 / 712 / 519 / 751, Location 86 / 308 / 347, canvas 648 × 775, cancel band 139,
> `openSize(39, 'calendar', maxHeight)` clamped) is asserted here or in Task 18 (A18). B2's `scheduleSectionTop(39, 1) === 139` contradicted the code
> (`NotchState.swift` has no such function; the section starts at band + `contentHeight` = 241) and is `sectionCancelBandBottom(39, 1)` here.

**Files:**
- Create: `src/recreation/machine/notchLayout.ts`
- Test: `tests/machine/notchLayout.test.ts`

**Interfaces:**
- Consumes: A15 `Size`, `NotchRadius`, `widthForNotch`, `NotchGeometry.closedShapeSize`, `contains`.
- Produces (contracts §2.15, §5.1, §5.3 with D1–D3, D12): `type Size` (re-export), `export type NotchSection = 'none' | 'controls' | 'calendar' | 'location'` (A-D5: Swift declares `NotchSection` in `NotchMachine.swift`; the layout needs it first, so it lives here and A19 re-exports it with `isSchedule` / `afterEscape`). `NotchLayout` = every constant of contracts §5.1 (`baseOpenWidth 600`, `defaultNotchBandHeight 39`, `textScale 1`, `horizontalPadding 20`, `contentInsetX 39`, `closedTopRadius 6`, `closedBottomRadius 14`, `openTopRadius 19`, `openBottomRadius 32`, `overshootPadding 24`, `scheduleScreenMargin 40`, `savedExtension 72`, `savedBadgeSize 24`, `savedBadgeTrailingPadding 30`, `savedHold 1.0`, `hoverGrowth {22, 5}`, `hoverDwell 0.09`, `closedCanvasMargin {16, 8}`, `closeDuration 0.36`, `settleDelay 0.5`, `focusRetryDelays [0.12, 0.30]`, `titleLineHeight 23`, `notesLineHeight 18`, `titleRowHeight 25`, `notesRowHeight 20`, `inputRowSpacing 1`, `headerHeight 36`, `chipSlotHeight 26`, `bottomBarHeight 48`, `NOTCH {221, 38}`, `closedSize {235, 39}`, `openSize` (function below; the 600 × 241 value is `openSize()`), `scheduleControlsSize {600, 519}`, `scheduleCalendarSize {600, 751}`, `locationSize {600, 347}`, `savedSize {379, 39}`, `hoverSize {257, 44}`, `closedCanvasSize {273, 52}`) and the functions `lineHeight(pointSize)`, `widthForNotch`, `closedShapeSize`, `topContentHeight(s = 1)`, `contentHeight(s = 1)`, `scheduleContentHeight(s, calendar)`, `locationContentHeight(s = 1)`, `openSize(band = 39, section = 'none', maxHeight = Infinity)`, `maxPanelHeight(screenHeight, dockHeight)`, `scheduleSectionTop(band = 39, s = 1)`, `sectionCancelBandBottom(band = 39, s = 1)`, `clickCancelsSection(y, bandBottom, section)`, `canvasSize(open)`, `openCanvasSize(open, tallest)`, `passesMouseThrough(point, canvasWidth, panelSize)`. `ScheduleMetrics = { typeField 36, previewGap 6, preview 18, presetsGap 10, presetRow 44, presetSpacing 8, dayTimeGap 12, dayTimeRow 30, calendarGap 10, monthHeader 26, weekdayRow 18, dayCell 28, dayRowSpacing 2, footerGap 14, footer 36, controlRadius 12, calendarHeight(s = 1), sectionHeight(s = 1, calendar) }`. `LocationMetrics = { field 36, footerGap 14, footer 36, sectionHeight(s = 1) }` (Swift `NotchLayout.LocationMetrics`: `field = ScheduleMetrics.typeField`, `footerGap = ScheduleMetrics.footerGap`, `footer = ScheduleMetrics.footer`).

Rules (Swift `NotchState.swift` `enum NotchLayout`):
- `sc(v) = roundHalfEven(v · s)` where `roundHalfEven(x) = Math.abs(x % 1) === 0.5 ? 2·Math.round(x / 2) : Math.round(x)` (Swift `.toNearestOrEven`, ties only on exact halves).
- `lineHeight(p) = ⌈p · 2412 / 2048⌉`: `PlainTextView.lineHeight(for:)` = ⌈ascender − descender + leading⌉ of `NSFont.systemFont`, measured on macOS 26 as ascender 1980/2048 em, descender −432/2048 em, leading 0 (13 → 16, 15 → 18, 16 → 19, 19 → 23, 20 → 24, 24 → 29, 25 → 30, 30 → 36).
- `topContentHeight = 8 + sc(36) + 10 + (lineHeight(sc(19)) + 2) + 1 + (lineHeight(sc(15)) + 2)`; `contentHeight = topContentHeight + sc(26) + 8 + sc(48) + 20`; `calendarHeight = sc(26) + sc(18) + 6·sc(28) + 5·2`; `sectionHeight = sc(36) + 6 + sc(18) + 10 + 2·sc(44) + 8 + 12 + sc(30) [+ 10 + calendarHeight] + 14 + sc(36)`; `scheduleContentHeight = contentHeight + sectionHeight + 20`; `LocationMetrics.sectionHeight = sc(36) + 14 + sc(36)` (86 at 100 %); `locationContentHeight = contentHeight + LocationMetrics.sectionHeight + 20` (308 at 100 %).
- `openSize(band, section, maxHeight)`: plain = `{ round(600 · min(1 + (s − 1)·0.5, 1.3)), band + contentHeight }`; `'none'` → plain; else `natural` = `band + scheduleContentHeight(s, section === 'calendar')` for `'controls'` / `'calendar'`, `band + locationContentHeight(s)` for `'location'`; `{ plain.width, max(plain.height, min(natural, floor(maxHeight))) }`.
- `maxPanelHeight(screenHeight, dockHeight) = screenHeight − dockHeight − 40`; `scheduleSectionTop = band + contentHeight`; `sectionCancelBandBottom = band + topContentHeight`; `clickCancelsSection = section !== 'none' && y < bandBottom`; `canvasSize(o) = { o.width + 48, o.height + 24 }`; `openCanvasSize(open, tallest) = canvasSize({ open.width, max(open.height, tallest.height) })`; `passesMouseThrough`: outside the bounding box `x ∈ [(cw − w)/2, (cw + w)/2]`, `y ∈ [0, h]` → true; else `!contains(point, cw, panelSize, 19, 32)`.

Swift cases mirrored (`NotchStateTests.swift`): `notchLayoutInvariants`, `openHeightFollowsTheRhythm`, `scheduleHeightFollowsTheRhythm`, `scheduleSizesGrowOnlyInHeight`, `scheduleHeightIsClampedToTheScreen`, `maxPanelHeightStopsAboveTheDockWithRoomForTheOvershoot`, `clickOnTheTextRowsCancelsScheduling`, `onlyTheBlackShapeTakesTheMouse`, `openCanvasFitsTheTallestScheduleStateInNotchStyle` (notch style only), `openCanvasAtDefaultTextSize` (notch style only). `locationHeightFollowsTheRhythm`, `locationSizeAndPrecedence` (its `NotchLayout` half; the `NotchState` half is in A18). Not ported: `ignoringTheMouseWaitsForTheButtonRelease`, `canvasPointConversion` (AppKit window plumbing). The precedence tests move to A18.

- [ ] **Step 1: Write the failing test** `tests/machine/notchLayout.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';
  import { NotchLayout as L, ScheduleMetrics as M, LocationMetrics as LM, type NotchSection } from '../../src/recreation/machine/notchLayout';

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
    it.each([[0.85, 76, 276], [1, 86, 308], [1.3, 108, 376], [1.6, 130, 443]])('locationHeightFollowsTheRhythm at %f', (s, section, content) => {
      expect(LM.sectionHeight(s)).toBe(section);                                  // sc(36) + 14 + sc(36)
      expect(L.locationContentHeight(s)).toBe(content);
      expect(content).toBe(L.contentHeight(s) + section + L.horizontalPadding);
    });
    it('locationHeightFollowsTheRhythm (sums at 100 %)', () => {
      expect(LM.sectionHeight(1)).toBe(86);
      expect(L.locationContentHeight(1)).toBe(202 + 86 + 20);
      expect([LM.field, LM.footerGap, LM.footer]).toEqual([M.typeField, M.footerGap, M.footer]);
    });
    it('locationSizeAndPrecedence (layout)', () => {
      const plain = L.openSize(39), location = L.openSize(39, 'location'), controls = L.openSize(39, 'controls');
      expect(location).toEqual({ width: 600, height: 347 });
      expect(location.width).toBe(plain.width);
      expect(plain.height < location.height && location.height < controls.height).toBe(true);   // Location is the shortest section
      expect(L.openSize(39, 'location', plain.height + 10).height).toBe(plain.height + 10);     // clamped like Set Date
      expect(L.clickCancelsSection(105, L.sectionCancelBandBottom(39, 1), 'location')).toBe(true);   // title cancels Location too
      expect(L.clickCancelsSection(197, L.sectionCancelBandBottom(39, 1), 'location')).toBe(false);  // the bar does not
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
      const cancels = (y: number, s: NotchSection = 'controls') => L.clickCancelsSection(y, band, s);
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
      expect(L.locationSize).toEqual({ width: 600, height: 347 });
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
      expect(top + LM.field + LM.footerGap).toBe(291);                       // Location footer 291–327
      expect(top + LM.sectionHeight() + L.horizontalPadding).toBe(347);
    });
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/machine/notchLayout.test.ts` → expected FAIL (module missing).
- [ ] **Step 3: Implement** `notchLayout.ts` per the rules (constants + functions; the derived `*Size` constants are computed from the functions at module load, not typed in).
- [ ] **Step 4: Run** → expected PASS (35 tests).
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(machine): NotchLayout, ScheduleMetrics and LocationMetrics with the below-the-bar section rhythm"`

---

### Task 17 (A17): `Theme` metrics (`machine/notchLayout.ts`)

**Files:**
- Modify: `src/recreation/machine/notchLayout.ts`
- Test: `tests/machine/theme.test.ts`

**Interfaces:**
- Consumes: A16 `NotchLayout`.
- Produces: `Theme` (contracts §5.4 + D13), exactly this shape (Tasks 22–46 read these keys):
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
    locationField: { padX: 12, gap: 8, iconSize: 12, iconWeight: 500, textSize: 14, placeholderAlpha: 0.50, fillAlpha: 0.07, strokeAlpha: 0.08, focusStrokeAlpha: 0.70, radius: 12 },
    savedBadge:    { size: 24, strokeRatio: 0.11, paddingRatio: 0.27, tick: [[0, 0.55], [0.38, 0.92], [1, 0.12]] },
    font: { recreation: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Inter, sans-serif' },
  } as const;
  ```
  (Values: contracts §5.4; `locationField` = `LocationNotchSection.swift` `field` (HStack spacing 8, `location` 12 pt medium in the accent, `TextField` 14 pt white, prompt white 50 %, `.padding(.horizontal, 12)`, white 7 % fill, 1 pt stroke white 8 % / accent 70 % focused, `ScheduleMetrics.controlRadius`); its footer reuses `footer` (Cancel padX 16, Done = `setPadX` 18, `LocationNotchSection.footer`); the contract's `locationPopover` is dropped (B-D3); `pill.active*` BottomBar.swift:140; `savedBadge` SavedCheckView.swift:18 and CheckmarkShape; `preview.pastColor` = Theme.flagOrange.)

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
    it('locationFieldIsStyledLikeTheTypeField (LocationNotchSection.swift)', () => {
      const { padX, textSize, placeholderAlpha, fillAlpha, strokeAlpha, focusStrokeAlpha, radius } = Theme.typeField;
      expect(Theme.locationField).toMatchObject({ padX, textSize, placeholderAlpha, fillAlpha, strokeAlpha, focusStrokeAlpha, radius });
      expect([Theme.locationField.gap, Theme.locationField.iconSize, Theme.locationField.iconWeight]).toEqual([8, 12, 500]);
      expect('locationPopover' in Theme).toBe(false);
    });
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/machine/theme.test.ts` → expected FAIL (`Theme` is not exported).
- [ ] **Step 3: Implement** — add the `Theme` constant above to `notchLayout.ts`.
- [ ] **Step 4: Run** → expected PASS (9 tests).
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(machine): Theme metrics for every recreation control"`

---

### Task 18 (A18): `machine/notchState.ts`

**Files:**
- Create: `src/recreation/machine/notchState.ts`
- Test: `tests/machine/notchState.test.ts`

**Interfaces:**
- Consumes: A15 `Size`, `NotchGeometry.closedShapeSize`, `contains`; A16 `NotchLayout.openSize`, `.maxPanelHeight`, `.hoverGrowth`, `.closedCanvasMargin`, `.savedExtension`, `.canvasSize`, `NotchSection`.
- Produces (contracts §2.16 with D1): `interface NotchFlags`, `interface NotchSizes` (`closedSize`, `openSize`, `scheduleSize`, `scheduleCalendarSize`, `locationSize`), `INITIAL_FLAGS` (all false, `section: 'none'`), `sizesFor(notch, screenHeight, dockHeight = 0)`, `notchBandHeight(s)`, `panelSize(s, section)`, `tallestSectionSize(s)`, `currentSize(f, s)`, `hoverSize(s)`, `closedCanvasSize(s)`, `savedSize(s)`, `radii(f)`.

Rules (Swift `NotchState`, `PanelController.configureGeometry`): `sizesFor`: `closed = closedShapeSize(notch, 6)`; `band = closed.height`; `open = openSize(band)`; `max = maxPanelHeight(screenHeight, dockHeight)`; `scheduleSize = openSize(band, 'controls', max)`; `scheduleCalendarSize = openSize(band, 'calendar', max)`; `locationSize = openSize(band, 'location', max)` (`PanelController.configureGeometry`). `panelSize` (Swift `NotchState.size(for:)`): `'none'` → `openSize`, `'controls'` → `scheduleSize`, `'calendar'` → `scheduleCalendarSize`, `'location'` → `locationSize`. `tallestSectionSize` = the tallest of `scheduleSize`, `scheduleCalendarSize`, `locationSize` (Swift `NotchState.tallestSectionSize`; the calendar, so the open canvas never changes for Location). `currentSize`: `isSaving` → saved; `isOpen` → `panelSize(f.section)`; `isHovering` → hover; else closed. `radii`: `isOpen` → `{ 19, 32 }` else `{ 6, 14 }`.

Swift cases mirrored (`NotchStateTests.swift`): `hoverSizeIsClosedPlusGrowth`, `closedCanvasContainsSwollenShapeAndIsSmallerThanOpenCanvas`, `currentSizePrecedence`, `closedHitTest`, `currentSizeFollowsTheScheduleWhileOpen`, `locationSizeAndPrecedence` (its `NotchState` half; the layout half is in A16).

- [ ] **Step 1: Write the failing test** `tests/machine/notchState.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';
  import { NotchLayout } from '../../src/recreation/machine/notchLayout';
  import { contains } from '../../src/recreation/machine/notchShape';
  import { closedCanvasSize, currentSize, hoverSize, INITIAL_FLAGS, notchBandHeight, panelSize, radii, savedSize, sizesFor, tallestSectionSize, type NotchFlags } from '../../src/recreation/machine/notchState';

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
      expect(currentSize(f({ isOpen: true, section: 'controls' }), S)).toEqual(S.scheduleSize);
      expect(currentSize(f({ isOpen: true, section: 'calendar' }), S)).toEqual(S.scheduleCalendarSize);
      expect(currentSize(f({ isOpen: true, section: 'calendar', isSaving: true }), S)).toEqual(savedSize(S));
      expect(currentSize(f({ section: 'calendar' }), S)).toEqual(S.closedSize);
    });
    it('locationSizeAndPrecedence (state)', () => {
      expect(currentSize(f({ isOpen: true, section: 'location' }), S)).toEqual(S.locationSize);
      expect(panelSize(S, 'location')).toEqual({ width: 600, height: 347 });
      expect(tallestSectionSize(S)).toEqual(S.scheduleCalendarSize);   // the calendar stays the tallest: the canvas does not change
    });
  });

  describe('notchState (TS)', () => {
    it('sizesOnTheFake14InchScreen', () => expect(S).toEqual({
      closedSize: { width: 235, height: 39 }, openSize: { width: 600, height: 241 },
      scheduleSize: { width: 600, height: 519 }, scheduleCalendarSize: { width: 600, height: 751 }, locationSize: { width: 600, height: 347 },
    }));
    it('aShortScreenClampsTheCalendar', () => {
      const short = sizesFor({ width: 221, height: 38 }, 700);
      expect(short.scheduleCalendarSize).toEqual({ width: 600, height: 660 });
      expect(short.locationSize).toEqual({ width: 600, height: 347 });            // 347 < 660: unclamped
    });
    it('bandAndSaved', () => {
      expect(notchBandHeight(S)).toBe(39);
      expect(savedSize(S)).toEqual({ width: 379, height: 39 });
    });
    it('radii', () => {
      expect(radii(f({ isOpen: true }))).toEqual({ top: 19, bottom: 32 });
      expect(radii(f({ isSaving: true }))).toEqual({ top: 6, bottom: 14 });
    });
    it('initialFlags', () => expect(INITIAL_FLAGS).toEqual({ isOpen: false, contentVisible: false, isSettled: false, isSaving: false, savedBadgeShown: false, isHovering: false, section: 'none' }));
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/machine/notchState.test.ts` → expected FAIL (module missing).
- [ ] **Step 3: Implement** `notchState.ts`.
- [ ] **Step 4: Run** → expected PASS (11 tests).
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(machine): NotchState size derivation and precedence"`

---

### Task 19 (A19): `machine/notchMachine.ts` — phases, save, hover, screen changes

**Files:**
- Create: `src/recreation/machine/notchMachine.ts`
- Test: `tests/machine/notchMachine.test.ts`

**Interfaces:**
- Consumes: A16 `NotchSection`.
- Produces (contracts §2.14 with D4, D5): `type NotchPhase`, `type NotchSection` (re-exported from A16: `'none' | 'controls' | 'calendar' | 'location'`), `isSchedule(s)` (`'controls'` or `'calendar'`, Swift `NotchSection.isSchedule`), `afterEscape(s)` (calendar → controls, every other section → none, Swift `NotchSection.afterEscape`), `type NotchEvent` (contract list with `{ type: 'sectionChanged'; section: NotchSection }` for `scheduleChanged`), `type NotchEffect` (contract list with `{ type: 'animateSection'; section: NotchSection }` for `animateSchedule`, **minus** `growCanvasForSchedule` and `fitCanvasToPanel`), `interface NotchMachineSnapshot` (**minus** `canvasGrown`), `class NotchMachine` (`phase`, `badgeShown`, `hoverSwollen`, `hoverArmed`, `hoverDwellPending`, `generation`, `section`, `isVisible`, `handle(event, pointerOnNotch = false): NotchEffect[]`, `snapshot()`, `equals(other)`, `clone()`), `phaseEquals(a, b)`. In this task `sectionChanged` returns `[]` and a show while open returns `[]`; A20 adds both.

Rules (Swift `Panel/NotchMachine.swift`, port `handle` line by line):
- `show`: open → `[]`. Else: pending dwell → `cancelHoverDwell` (dwell off); `wasVisible = isVisible`, `fromSaved = phase saving`; closing → `cancelClose`, saving → `cancelSaveHold` (both mid-collapse); `badgeShown = false`, `clearBadgeNoAnimation`, `configureGeometry`; not mid-collapse → `switchToOpenCanvas`; `section = 'none'`; `setIgnoresMouse(false)`, `makeKeyAndOrderFront`; `!wasVisible` → `installLocalMonitor`; `postWillShow`, `animateOpen(fromSaved)`; `hoverSwollen = false`; phase open; `generation = (generation + 1) >>> 0`; `scheduleSettle(generation)`, `scheduleFocusRetries`.
- `notchTapped`: only from `closed(parked: true)` → `show`; else `[]`.
- `hide`: visible → `close(cancellingHold: true)`; else `[]`.
- `save(reduceMotion)`: not open → `[]`; reduce motion → `close(true)`; else bump generation, phase saving, `badgeShown = true`, `section = 'none'`, `[setSettled(false), animateSaving, setIgnoresMouse(true), resignFirstResponder, scheduleSaveHold]`.
- `saveHoldElapsed`: saving → `close(false)`; else `[]`.
- `closeTimerFired(hasNotch)`: closing only; `badgeShown = false`; `[clearBadgeNoAnimation, hasNotch ? park(pointerOnNotch) : orderOut()]`.
- `settleTimerFired(g)`: open and `g === generation` → `[setSettled(true)]`; else `[]`.
- `hoverEntered`: parked, armed, not swollen, no pending dwell → pending, `[scheduleHoverDwell]`. `hoverDwellElapsed(rm)`: no pending → `[]`; pending off; not parked or not armed → `[]`; `!rm` → swollen, `swellHover`; always `haptic`. `hoverExited`: parked only; pending → off + `cancelHoverDwell`; `hoverArmed = true`; swollen → off + `unswellHover`.
- `screenChanged(hasNotch)`: `[configureGeometry]` + open/saving → `relayoutOpenWindow`; closing → nothing; closed → `hasNotch ? park(pointerOnNotch)` : (parked ? `orderOut()` : nothing).
- `close(cancellingHold)`: saving and cancelling → `cancelSaveHold`; phase closing; `section = 'none'`; `[postDidHide, removeLocalMonitor, resignFirstResponder, setIgnoresMouse(true), setSettled(false), animateClose, scheduleClose]`.
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

### Task 20 (A20): `machine/notchMachine.ts` — in-notch sections (Set Date and Location)

**Files:**
- Modify: `src/recreation/machine/notchMachine.ts`
- Test: `tests/machine/notchMachineSchedule.test.ts`

**Interfaces:**
- Consumes: A19 `NotchMachine`, `afterEscape`, `isSchedule`.
- Produces: `sectionChanged` (also for a switch between Set Date and Location) and show-while-sectioned behaviour (no new exports).

Rules (Swift `changeSection`, `show`): `sectionChanged(x)`: phase open and `x !== section` → `section = x`, bump generation, `[setSettled(false), animateSection(x), scheduleSettle(generation)]`; else `[]`. `show` while open: `section === 'none'` → `[]`, else the same transition to `'none'`. A switch (`'calendar'` → `'location'`, `'location'` → `'controls'`, …) is one step, no close first (Swift: "one section at a time: opening one while another is shown switches over in one spring"); what the section being left keeps is the controller's job (Task 29 (B9) `switchSection`), not the machine's.

Swift cases mirrored (`NotchMachineScheduleTests.swift`, all 16): `openingTheScheduleOnlyAnimatesUnderTheMask`, `noScheduleStepTouchesTheWindow`, `calendarToggleOnlyAnimatesTheCanvasIsAlreadyTallEnough`, `showWhileScheduledResetsTheSchedule`, `sameExpansionTwiceIsANoOp`, `ignoredUnlessOpen` (hide, save), `closingSettlesUnderTheMask`, `staleSettleFromBeforeTheScheduleChangeIsDropped`, `hideAndSaveResetTheSchedule`, `reopenAfterParkingSwitchesCanvasOnceAndStartsPlain`, `reopenMidCollapseKeepsTheWindow`, `screenChangeWhileScheduledRelayoutsTheOpenWindow`, `escapeStepsBackOneLevel`, `locationIsASectionLikeSetDate`, `switchingSectionsIsOneStep` (3 arguments), `escapeAndShowCloseLocation` (D5).

- [ ] **Step 1: Write the failing test** `tests/machine/notchMachineSchedule.test.ts` (each Swift test under its name; representative bodies):
  ```ts
  import { describe, expect, it } from 'vitest';
  import { afterEscape, isSchedule, NotchMachine, type NotchEffect, type NotchEvent, type NotchSection } from '../../src/recreation/machine/notchMachine';

  const open = () => { const m = new NotchMachine(); m.handle({ type: 'show' }); return m; };
  const step = (x: NotchSection, g: number): NotchEffect[] =>
    [{ type: 'setSettled', settled: false }, { type: 'animateSection', section: x }, { type: 'scheduleSettle', generation: g }];

  describe('NotchMachineScheduleTests', () => {
    it('openingTheScheduleOnlyAnimatesUnderTheMask', () => {
      const m = open(), before = m.generation;
      expect(m.handle({ type: 'sectionChanged', section: 'controls' })).toEqual(step('controls', before + 1));
      expect(m.section).toBe('controls');
      expect(m.generation).toBe(before + 1);
    });
    it('noScheduleStepTouchesTheWindow', () => {
      const m = open();
      const windowEffects = ['configureGeometry', 'switchToOpenCanvas', 'relayoutOpenWindow', 'park', 'orderOut'];
      for (const x of ['controls', 'calendar', 'controls', 'none', 'calendar', 'none'] as NotchSection[]) {
        const e = m.handle({ type: 'sectionChanged', section: x });
        expect(e).toEqual(step(x, m.generation));
        expect(e.some((y) => windowEffects.includes(y.type))).toBe(false);
        expect(m.handle({ type: 'settleTimerFired', generation: m.generation })).toEqual([{ type: 'setSettled', settled: true }]);
      }
    });
    it('showWhileScheduledResetsTheSchedule', () => {
      const m = open();
      m.handle({ type: 'sectionChanged', section: 'calendar' });
      expect(m.handle({ type: 'show' })).toEqual(step('none', m.generation));
      expect(m.phase).toEqual({ type: 'open' });
      expect(m.section).toBe('none');
      expect(m.handle({ type: 'settleTimerFired', generation: m.generation })).toEqual([{ type: 'setSettled', settled: true }]);
      expect(m.handle({ type: 'show' })).toEqual([]);
      expect(m.handle({ type: 'sectionChanged', section: 'controls' })).toContainEqual({ type: 'animateSection', section: 'controls' });
    });
    it.each<NotchEvent>([{ type: 'hide' }, { type: 'save', reduceMotion: false }])('ignoredUnlessOpen (%j)', (leaving) => {
      const m = open();
      m.handle(leaving);
      expect(m.handle({ type: 'sectionChanged', section: 'controls' })).toEqual([]);
      expect(m.section).toBe('none');
      expect(new NotchMachine().handle({ type: 'sectionChanged', section: 'calendar' })).toEqual([]);
    });
    it('escapeStepsBackOneLevel', () => {
      expect(afterEscape('calendar')).toBe('controls');
      expect(afterEscape('controls')).toBe('none');
      expect(afterEscape('none')).toBe('none');
      const m = open();
      m.handle({ type: 'sectionChanged', section: 'calendar' });
      m.handle({ type: 'sectionChanged', section: afterEscape(m.section) });
      expect([m.section, m.phase.type]).toEqual(['controls', 'open']);
      m.handle({ type: 'sectionChanged', section: afterEscape(m.section) });
      expect([m.section, m.phase.type]).toEqual(['none', 'open']);
    });
    // Location (one section at a time)
    it('locationIsASectionLikeSetDate', () => {
      const m = open();
      const e = m.handle({ type: 'sectionChanged', section: 'location' });
      expect(m.section).toBe('location');
      expect(e).toEqual(step('location', m.generation));
    });
    it.each<[NotchSection, NotchSection]>([['calendar', 'location'], ['location', 'controls'], ['controls', 'location']])('switchingSectionsIsOneStep (%s → %s)', (from, to) => {
      const m = open();
      m.handle({ type: 'sectionChanged', section: from });
      const e = m.handle({ type: 'sectionChanged', section: to });
      expect(m.section).toBe(to);
      expect(e).toEqual(step(to, m.generation));
    });
    it('escapeAndShowCloseLocation', () => {
      expect(afterEscape('location')).toBe('none');
      expect(isSchedule('location')).toBe(false);
      expect(isSchedule('controls') && isSchedule('calendar')).toBe(true);
      expect(isSchedule('none')).toBe(false);
      const m = open();
      m.handle({ type: 'sectionChanged', section: 'location' });
      m.handle({ type: 'show' });
      expect(m.section).toBe('none');                    // a show while Location is open returns to the plain panel
      m.handle({ type: 'sectionChanged', section: 'location' });
      m.handle({ type: 'hide' });
      expect(m.section).toBe('none');
    });
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/machine/notchMachineSchedule.test.ts` → expected FAIL (A19 returns `[]` for `sectionChanged`).
- [ ] **Step 3: Implement** `changeSection(x)` and the open branch of `show`.
- [ ] **Step 4: Run** `npx vitest run tests/machine` → expected PASS (19 section tests: the 13 Set Date ones with `ignoredUnlessOpen` ×2, plus 5 Location; A19's 31 still pass, the exhaustive alphabet has no `sectionChanged`, so its 17 shapes hold).
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(machine): in-notch Set Date and Location sections in NotchMachine"`

---

### Task 21 (A21): `machine/springs.ts` — SwiftUI → physical springs and every named animation

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

---

### Task 22 (B1): Recreation UI foundations (units, time scale, reduced motion, transitions, test harness)

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
  npm i -D @testing-library/user-event@14.5.2 @testing-library/jest-dom@6.6.3
  ```
  Expected: `git branch --show-current` prints `develop`; the two packages appear in `devDependencies` as exact versions
  (`.npmrc` has `save-exact`). `@testing-library/react 16.3.3` and `jsdom 29.1.1` are already pinned by Task 1 (A1) and are not reinstalled.

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
    expect(open.damping).toBeCloseTo(23.338, 3);   // 4π·0.78/0.42 = 23.33755 (Task 21 (A21), A-D11)
    expect(open.mass).toBe(1);
    const slow = toTransition(Motion.open, 4) as any;
    expect(slow.stiffness).toBeCloseTo(223.80 / 16, 2);
    expect(slow.damping).toBeCloseTo(23.338 / 4, 3);
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

### Task 23 (B3): SF Symbol → Phosphor glyph table (`icons.tsx`)

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
| `location@12` | Location section field (medium, `LocationNotchSection.field`) | 11.92 × 11.50 (the @18 box × 12/18; re-measure at 12 pt medium in Task 46 (B26)) | `NavigationArrow`, mirrored | regular | 14 |
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
      'location@18': ['NavigationArrow:regular', 21, true], 'location.fill@18': ['NavigationArrow:fill', 21, true], 'location@12': ['NavigationArrow:regular', 14, true],
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

### Task 24 (B4): Button styles (`buttons.tsx`, port of HoverButtonStyle.swift + NotchButtonStyles.swift)

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

### Task 25 (B5): Notch silhouette with animatable size and radii (`NotchSilhouette.tsx`)

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

### Task 26 (B6): RecreationStore — draft, suggestion, lists, flag, location, dirty (`store.ts`, part 1)

Port of `QuickReminderView`'s `@State` (title, notes, dueDate, flagged, locationText, showListPicker,
saveErrorText, suggestion, dismissedSuggestionText, presetPick; `showLocationField` is the Popover style's and is not
ported, B-D3), of the in-notch Location section's `@State draft: LocationDraft` (`LocationNotchSection.swift`), and of
`resetState`, `updateSuggestion`, `applySuggestionIfAny`, `stripSuggestionPhrase`, plus the `NotchState` flags mirror the views read.

**Files:**
- Create: `src/recreation/store.ts`
- Test: `tests/recreation/store.test.ts`

**Interfaces:**
- Consumes: `RecreationState` shape (contract §3.1); `NaturalDateParser.{parse, removingMatch}`, `DateSuggestion`;
  `ScheduleDefaults.resolveDayOnly`; `SuggestionDateFormatter`; `FAKE_LISTS`, `DEFAULT_LIST_ID`, `accentFor`, `ListId`;
  `ReminderDraft`, `SavedReminder`, `LocationDraft` (A14); `PresetPick`; `NotchFlags`, `NotchSizes`, `INITIAL_FLAGS`; `NotchMachineSnapshot`,
  `NotchPhase`, `NotchSection`, `isSchedule` (A19); `Clock`; `Calendar`; `FlagAnimation` (B1).
- Produces:
  ```ts
  export interface RecreationState { /* contract §3.1 with A-D5 / B-D3: `section: NotchSection` for `schedule`, `locationField: string | null`
     (the open Location section's field, null while it is not shown) for `locationPopoverOpen`, derived `locationInNotch`, `sectionOpen` */ }
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
    setMachine(m: NotchMachineSnapshot): void;   // phase, section, hoverSwollen, badgeShown → RecreationState; settled/contentVisible come from setFlags
    resetDraft(): void;                          // .panelWillShow → resetState(); openedOnce = true
    closePopovers(): void;                       // .panelDidHide: list picker closed, Location draft dropped (the section view is gone)
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
    setLocation(text: string | null, origin: Origin): void;  // "" → null (RecreationState.location never ""); otherwise as typed (Swift writes the text untrimmed)
    openLocationDraft(): LocationDraft;          // new LocationDraft(location ?? ''): LocationNotchSection.init; locationField = its text
    get locationDraft(): LocationDraft | null;
    setLocationText(text: string): void;         // the field (draft.text); locationField follows; not a draft change (no dirty)
    closeLocationDraft(): void;                  // locationField = null; the section keeps rendering its own reference while it fades out (B14)
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
presetPick, an applied or dismissed suggestion); opening or closing a popover or a section, and typing in the Location field, are not
draft changes (the location itself changes only through Done, ✓, Clear or a switch to Set Date, each a `setLocation(…, origin)`).
`canSave` = `title.trim() !== ''`; `accent` = `accentFor(listId)`; `schedulingInNotch` = `isSchedule(section)`; `locationInNotch` =
`section === 'location'`; `sectionOpen` = `section !== 'none'` (Swift `QuickReminderView.schedulingInNotch` / `locationInNotch` / `sectionOpen`).

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
    expect(s).toMatchObject({ phase: { type: 'closed', parked: false }, section: 'none', title: '', notes: '', listId: 'reminders',
      flagged: false, location: null, dueDate: null, suggestion: null, canSave: false, accent: '#0A84FF', dirty: false,
      savedItems: [], openedOnce: false, listPickerOpen: false, locationField: null, saveError: null,
      schedulingInNotch: false, locationInNotch: false, sectionOpen: false });
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
  test('the Location field is not the location until Done (LocationDraft)', () => {
    const st = make();
    st.setLocation('Office', 'api');
    const d = st.openLocationDraft();
    expect([d.original, d.text]).toEqual(['Office', 'Office']);
    expect(st.getState().locationField).toBe('Office');
    st.setLocationText('Home');
    expect(st.getState()).toMatchObject({ location: 'Office', locationField: 'Home', dirty: false });
    expect(st.locationDraft!.saveDecision).toEqual({ type: 'applyThenSave', text: 'Home' });
    st.closeLocationDraft();
    expect(st.getState()).toMatchObject({ location: 'Office', locationField: null });
    expect(st.locationDraft).toBeNull();
    expect(st.openLocationDraft().original).toBe('Office');
    expect(make().openLocationDraft().original).toBe('');            // no location → an empty field
    st.closePopovers();
    expect(st.getState().locationField).toBeNull();
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
  `flags.contentVisible` / `flags.isSettled`; `phase`, `section`, `hoverSwollen`, `badgeShown` come from `setMachine` (and the derived
  `schedulingInNotch` / `locationInNotch` / `sectionOpen` with them).
  `getState()` and `getPanel()` are rebuilt only inside mutations (never in the getters).
- [ ] **Step 4: Run it** — Expected: PASS (13 tests).
- [ ] **Step 5: Commit** — `git add src/recreation/store.ts tests/recreation/store.test.ts && git commit -m "feat(recreation): RecreationStore with draft, suggestion, lists, flag, Location draft and dirty tracking"`

---

### Task 27 (B7): RecreationStore — the Set Date draft (`store.ts`, part 2)

Port of `ScheduleNotchSection`'s state (`model`, `timeText`, `calendarMonth`) and its decisions (`finish`,
`saveFromBar` → `ScheduleDraft.prepareSave`, `applyTypedTime`, `moveDay`, `page`), kept in the store so the
controller and the `RecreationHandle` reach them without the view.

**Files:**
- Modify: `src/recreation/store.ts`
- Test: `tests/recreation/storeSchedule.test.ts`

**Interfaces:**
- Consumes: `ScheduleDraft`, `ScheduleOutcome`, `SaveDecision` (contract §2.7 + Task 10 (A10): `isDirty`, `prepareSave()`); `MonthGrid.{startOfMonth, shiftMonth, canGoBack}`;
  `SuggestionDateFormatter.time`; B6 store.
- Produces (added to `RecreationStore`):
  ```ts
  export type { SaveDecision } from './core/scheduleDraft';   // Task 10 (A10): Swift ScheduleDraft.SaveDecision, not redeclared here
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
  switchDecision(): SaveDecision;         // ScheduleDraft.prepareSwitch: the panel is switching to Location (Task 29 (B9) switchSection)
  ```

Rules: the store keeps no "touched" flag of its own: `saveDecision()` returns `scheduleDraft.prepareSave()` (Task 10 (A10) ports Swift
`ScheduleDraft.isDirty` / `prepareSave`: `!isDirty || committed` → `saveAsIs`; `set()` null → `invalid`; else `commitThenSave`), and `isDirty`
turns true inside the draft through `text`, `setFromControls`, `pick`, `setTime`, `applyTypedTime`, `stepTime`, `moveDay`, `moveInto`. After every draft change: if
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
    expect(st2.switchDecision()).toEqual({ type: 'invalid' });            // the same decision blocks a switch to Location
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

### Task 28 (B8): NotchRuntime — PanelController's effect performer with browser timers (`runtime.ts`)

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
| `configureGeometry`, `relayoutOpenWindow`, `makeKeyAndOrderFront`, `installLocalMonitor`, `removeLocalMonitor` | no-op (the canvas is CSS and never resizes; the container listens while `isVisible`) |
| `switchToOpenCanvas` | `setFlags({ section: 'none', isOpen: false, contentVisible: false }, 'none')` |
| `park` | `setFlags({ isOpen: false, contentVisible: false, isHovering: false }, 'none')` |
| `orderOut` | `setFlags({ isOpen: false, contentVisible: false }, 'none')` |
| `setIgnoresMouse(b)` / `resignFirstResponder` / `haptic` | `host.setIgnoresMouse(b)` / `host.blurAll()` / `host.haptic()` |
| `postWillShow` / `postDidHide` | `host.willShow()` / `host.didHide()` |
| `animateOpen` | next turn (`setTimeout(…, 0)`, Swift `DispatchQueue.main.async`): `setFlags({ isSaving: false, isHovering: false, isOpen: true, contentVisible: true }, 'open')` |
| `animateClose` | `setFlags({ contentVisible: false, isOpen: false, isSaving: false, section: 'none' }, 'close')` |
| `animateSaving` | `setFlags({ contentVisible: false, isOpen: false, isSaving: true, section: 'none', savedBadgeShown: true }, 'saving')` |
| `clearBadgeNoAnimation` / `setSettled(b)` | `setFlags({ savedBadgeShown: false }, 'none')` / `setFlags({ isSettled: b }, 'none')` |
| `swellHover` / `unswellHover` | `setFlags({ isHovering: true }, 'hoverIn')` / `setFlags({ isHovering: false }, 'hoverOut')` |
| `animateSection(x)` | `setFlags({ section: x }, 'schedule')` |
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
    expect(h.setFlags).toHaveBeenCalledWith({ contentVisible: false, isOpen: false, isSaving: false, section: 'none' }, 'close');
    vi.advanceTimersByTime(359); expect(rt.machine.phase).toEqual({ type: 'closing' });
    vi.advanceTimersByTime(1);   expect(rt.machine.phase).toEqual({ type: 'closed', parked: true });
  });
  test('save: saved pill, 1.0 s hold, then close', () => {
    const h = host(); const rt = make(h);
    rt.dispatch({ type: 'show' }); vi.advanceTimersByTime(600);
    rt.dispatch({ type: 'save', reduceMotion: false });
    expect(h.setFlags).toHaveBeenCalledWith({ contentVisible: false, isOpen: false, isSaving: true, section: 'none', savedBadgeShown: true }, 'saving');
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
  test('a section grows with the schedule spring and re-settles; Set Date → Location is one step', () => {
    const h = host(); const rt = make(h);
    rt.dispatch({ type: 'show' }); vi.advanceTimersByTime(600);
    rt.dispatch({ type: 'sectionChanged', section: 'controls' });
    expect(h.setFlags).toHaveBeenCalledWith({ isSettled: false }, 'none');
    expect(h.setFlags).toHaveBeenLastCalledWith({ section: 'controls' }, 'schedule');
    vi.advanceTimersByTime(500);
    expect(h.setFlags).toHaveBeenLastCalledWith({ isSettled: true }, 'none');
    rt.dispatch({ type: 'sectionChanged', section: 'location' });
    expect(h.setFlags).toHaveBeenLastCalledWith({ section: 'location' }, 'schedule');
    expect(h.setFlags).not.toHaveBeenCalledWith({ section: 'none' }, 'schedule');      // no close first
    vi.advanceTimersByTime(500);
    expect(h.setFlags).toHaveBeenLastCalledWith({ isSettled: true }, 'none');
    expect(rt.machine.section).toBe('location');
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

### Task 29 (B9): RecreationController, focus registry and React context (`controller.ts`, `ui/focus.ts`, `ui/RecreationContext.tsx`)

The controller is where `QuickReminderView`'s actions and `PanelController`'s public API meet: every UI handler and
every `RecreationHandle` method goes through it, with an `origin`.

**Files:**
- Create: `src/recreation/controller.ts`, `src/recreation/ui/focus.ts`, `src/recreation/ui/RecreationContext.tsx`
- Modify: `tests/ui/support.tsx` (add `createTestCore`, `renderWithCore`)
- Test: `tests/recreation/controller.test.ts`

**Interfaces:**
- Consumes: B6/B7 store, B8 runtime; `sizesFor`, `panelSize` (contract §2.16); `SuggestionDateFormatter`; `toSavedReminder`;
  `DatePresets.date`, `DATE_PRESETS`, `DatePreset`; `ScheduleCommit.{textRowSubmit, consumesSuggestion}`; `afterEscape`, `isSchedule`, `NotchSection`;
  `LocationDraft` (via the B6 store); `NotchLayout.{sectionCancelBandBottom, clickCancelsSection}`; `RUNTIME_TIMERS`; `MotionPrefsProvider` (B1); `ShowSource` (contract §3.2).
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
    save(origin: Origin): Promise<SavedReminder | null>;         // ⌘↩ / API: a section open → commitSection (Set / Done), resolves null
    saveFromBar(origin: Origin): Promise<SavedReminder | null>;  // ✓ click: SaveDecision (Set Date) / LocationDraft.saveDecision while a section is open
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
    openLocation(o: Origin): void; toggleLocation(o: Origin): void; cancelLocation(o: Origin): void; commitLocation(o: Origin): void;
    clearLocation(o: Origin): void; setLocationText(t: string, o: Origin): void; setLocation(t: string | null, o: Origin): void;
    switchSection(target: Exclude<NotchSection, 'none'>, o: Origin): boolean;   // QuickReminderView.switchSection; false = not open or blocked (invalid typed date, beep)
    commitSection(o: Origin): boolean;                           // .sectionCommitRequested / CommandReturnTwin: Set or Done
    cancelSection(o: Origin): void;                              // .panelCancelSection: the open section closes, nothing written
    pointerDownInPanel(yPt: number): void;                       // clickCancelsSection band (header / title / notes)
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
- Host (`createRecreationCore`): `focusTitle` focuses `'title'` only when the current show asked for focus, `panel.flags.section === 'none'`
  and `focus.active()` is neither `'title'` nor `'notes'` (`focusTitleFieldIfNeeded`). `willShow` → `store.resetDraft()`;
  `didHide` → `store.closePopovers()`; `blurAll` → `focus.blur()`; `haptic` no-op; `onDispatched` → `store.setMachine`.
- `escape()` (D2, `QuickReminderView.panelDismissPopovers` + `NotchSection.afterEscape`): not visible → `'none'`; saving → `hide()`, `'panel'` (the Esc monitor hides during the saved hold too); the list picker open → close it,
  `'popover'`; section `'calendar'` → `'controls'`, `'calendar'`; `'controls'` → `cancelSchedule`, `'section'`; `'location'` → `cancelLocation`, `'section'` (nothing written); else `hide()`, `'panel'`.
- `save`: badge shown → null; section ≠ none → `commitSection`, null (⌘↩ belongs to Set / Done while a section is open, `BottomBar.saveButton` drops its shortcut); `store.prepareReminder()` null → null; else
  `item = toSavedReminder(draft, clock(), formatter)`, dispatch `save({ reduceMotion })`; reduced → `appendSaved` + `onSaved` at once,
  otherwise after 0.32 s × scale (the tick starts drawing when the badge has landed, `SavedCheckView` delay 0.32); the promise resolves
  when the machine next reaches `closed` or `open`.
- `saveFromBar`: section none → `save`. Location (`LocationNotchSection.saveFromBar`): `locationDraft.saveDecision` `applyThenSave(text)` →
  `setLocation(text, o)`; either way close (`sectionChanged(none)`, `closeLocationDraft()`), then `save`. Set Date: time field focused and `applyTypedTime(true)` false → null; `saveDecision()`:
  `saveAsIs` → `cancelSchedule` then `save`; `commitThenSave` → `finishSchedule` + `sectionChanged(none)` then `save`; `invalid` → `beep`, null.
- `textRowSubmit`: `ScheduleCommit.textRowSubmit(sectionOpen, canSave)`: `'setSchedule'` (≡ `.commitSection`) → `commitSection`, null; `'saveReminder'` → `save`; `'none'` → null.
- `commitSection`: Set Date shown → `commitSchedule(o)`; Location → `commitLocation(o)`, true; none → false. `cancelSection`: Set Date → `cancelSchedule(o)`; Location → `cancelLocation(o)`.
- `switchSection(target)` (Swift `QuickReminderView.switchSection` + `SectionHandoff.commitForSwitch`): phase not open or badge shown → false. When a section is
  shown and `section !== target`, the section being left keeps its edit first, like ✓ would: Location → `locationDraft.textToKeepOnSwitch` non-null →
  `setLocation(text, o)`, then `closeLocationDraft()`; Set Date (`ScheduleNotchSection.commitForSwitch`) → time field focused and `applyTypedTime(true)` false →
  false (beep inside, stays); `switchDecision()`: `saveAsIs` → nothing written; `commitThenSave(outcome)` → `finishSchedule(outcome, o)` (Swift `write`: the date,
  the pick and the phrase strip, without closing); `invalid` → `beep()`, false (the switch is blocked); then `closeScheduleDraft()`. Then the target opens:
  `openScheduleDraft()` when the target is Set Date and Set Date was not shown, `openLocationDraft()` for `'location'`; dispatch `sectionChanged(target)` (one spring,
  no close first, A20); `'user'` → focus `'scheduleField'` / `'calendar'` / `'locationField'` on the next turn (`setTimeout(…, 0)`, after the section mounts;
  Swift `DispatchQueue.main.async { focus = .text }` / `fieldFocused = true`); true. Closing a section (Cancel, Esc, its own button, a click above) never writes.
- `openSchedule`: only when phase open, badge not shown and Set Date not already shown (Swift `openSetDate` guard "⌘D must not collapse it") →
  `switchSection('controls', o)` (from Location this keeps what was typed there).
  `toggleSchedule` (calendar icon, `toggleSetDate`): Set Date shown → `cancelSchedule`, else `openSchedule`. `openCalendar`: Set Date not shown → `openSchedule` (stop when it
  was blocked), then `'calendar'`, `'user'` → focus `'calendar'`. `closeCalendar` → `'controls'`, `'user'` and focus was in the grid or nowhere → `'scheduleField'`.
- `cancelSchedule` / every commit: dispatch `sectionChanged('none')`, `closeScheduleDraft()`; `'user'` and focus inside the root (or on
  `body` because the focused field unmounted) → focus `'title'` (`restoreKeyFocus`).
- `commitSchedule`: time field focused → `applyTypedTime(false)` first; `outcome = draft.set()`; null → `beep()` unless `draft.committed`, false;
  else `finishSchedule`, close, true. `applyPreset`: section open → `draft.apply(p)` → finish + close; closed → `setDueDate(DatePresets.date(p), { preset: p, date }, o)`
  and strip a live phrase when `ScheduleCommit.consumesSuggestion(suggestion?.matchedText ?? null, 'preset')` (BottomBar `consumeLiveSuggestion`).
  `clearDueDate`: Set Date shown → `draft.clear()` → finish + close; otherwise → `setDueDate(null, null, o)` (date-chip ⓧ writes `dueDate = nil` only).
  `commitSchedule`, `applyPreset` with the section path and `clearDueDate` with the draft act only while Set Date is shown (`isSchedule(section)`), never on Location.
- Location (`LocationNotchSection.swift`, `QuickReminderView.toggleLocation`): `openLocation` → Location not shown → `switchSection('location', o)`; `toggleLocation`
  (location button) → Location shown → `cancelLocation`, else `openLocation`; `cancelLocation` (Cancel, Esc, the location button, a click above) → dispatch
  `sectionChanged('none')`, `closeLocationDraft()`, nothing written; `commitLocation` (Done, ↩ in the field, ↩ / ⌘↩ anywhere while it is open) →
  `setLocation(locationDraft.committed, o)` (as typed; `''` → null), then the same close; `clearLocation` (Clear, rendered only while `location !== null`) →
  `setLocation(null, o)`, close; `setLocationText(t, o)` → `store.setLocationText(t)` while Location is shown. Every Location close with `'user'` and focus inside
  the root (or on `body`) → focus `'title'` (`restoreKeyFocus`, like `cancelSchedule`). All of them act only while Location is shown.
- `pointerDownInPanel(y)`: `clickCancelsSection(y, sectionCancelBandBottom(39, 1), section)` → `cancelSection('user')` (Set Date or Location); the click still lands
  (band bottom 139 = band + topContentHeight; `scheduleSectionTop` is the section's own top, 241, Task 16 (A16) A-D3).
- `setList` closes the picker.

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
    expect(core.store.getState()).toMatchObject({ section: 'none', dueDate: new Date('2026-09-19T07:00:00Z'), savedItems: [] });
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
    expect(c.store.getState().section).toBe('controls');
  });
  test('Esc steps back one level: list picker → calendar → section → panel', async () => {
    const core = createTestCore(); await openPanel(core);
    core.controller.openCalendar('user'); core.controller.openListPicker();
    expect(core.controller.escape()).toBe('popover');
    expect(core.controller.escape()).toBe('calendar');
    expect(core.store.getState().section).toBe('controls');
    expect(core.controller.escape()).toBe('section');
    expect(core.controller.escape()).toBe('panel');
    expect(core.controller.escape()).toBe('none');
  });
  test('presets, invalid Set, Clear, Cancel', async () => {
    const core = createTestCore(); await openPanel(core);
    core.controller.openSchedule('user');
    core.controller.applyPreset('tomorrow', 'user');
    expect(core.store.getState()).toMatchObject({ section: 'none', dueDate: new Date('2026-09-19T07:00:00Z'),
      presetPick: { preset: 'tomorrow', date: new Date('2026-09-19T07:00:00Z') } });
    core.controller.openSchedule('user'); core.controller.setScheduleText('nope nope', 'user');
    expect(core.controller.commitSchedule('user')).toBe(false);
    expect(core.store.getState().section).toBe('controls');
    core.controller.clearDueDate('user');
    expect(core.store.getState()).toMatchObject({ section: 'none', dueDate: null });
    core.controller.setDueDate(new Date('2026-09-20T07:00:00Z'), null, 'user');
    core.controller.openSchedule('user'); core.controller.setScheduleText('+3d', 'user'); core.controller.cancelSchedule('user');
    expect(core.store.getState().dueDate).toEqual(new Date('2026-09-20T07:00:00Z'));
  });
  test('a click on header / title / notes cancels the section; chip slot and bar do not', async () => {
    const core = createTestCore(); await openPanel(core);
    core.controller.openSchedule('user');
    core.controller.pointerDownInPanel(197); expect(core.store.getState().section).toBe('controls');
    core.controller.pointerDownInPanel(152); expect(core.store.getState().section).toBe('controls');
    core.controller.pointerDownInPanel(105); expect(core.store.getState().section).toBe('none');
  });
  test('calendar icon toggles; ⌘D never collapses an open section; nothing opens while closed', async () => {
    const core = createTestCore();
    core.controller.openSchedule('user'); expect(core.store.getState().section).toBe('none');
    await openPanel(core);
    core.controller.toggleSchedule('user'); expect(core.store.getState().section).toBe('controls');
    core.controller.openCalendar('user'); core.controller.openSchedule('user');
    expect(core.store.getState().section).toBe('calendar');
    core.controller.toggleSchedule('user'); expect(core.store.getState().section).toBe('none');
  });
  test('a click outside the shape closes the list picker or a section with the panel (global monitor), nothing written', async () => {
    const core = createTestCore(); await openPanel(core);
    core.controller.openListPicker();
    core.controller.pointerDownOutside();
    expect(core.store.getState()).toMatchObject({ listPickerOpen: false, phase: { type: 'closing' } });
    const loc = createTestCore(); await openPanel(loc);
    loc.controller.openLocation('user'); loc.controller.setLocationText('Home', 'user');
    loc.controller.pointerDownOutside();
    expect(loc.store.getState()).toMatchObject({ section: 'none', locationField: null, location: null, phase: { type: 'closing' } });
  });
  test('Location: Done writes the field; Cancel, Esc, a click above and the location button leave it (LocationNotchSection)', async () => {
    const core = createTestCore(); await openPanel(core);
    core.controller.toggleLocation('user');
    expect(core.store.getState()).toMatchObject({ section: 'location', locationField: '', locationInNotch: true });
    core.controller.setLocationText('Office', 'user');
    expect(core.store.getState()).toMatchObject({ location: null, dirty: false });
    core.controller.commitLocation('user');
    expect(core.store.getState()).toMatchObject({ section: 'none', location: 'Office', locationField: null, dirty: true });
    core.controller.openLocation('user'); core.controller.setLocationText('Home', 'user'); core.controller.cancelLocation('user');
    expect(core.store.getState().location).toBe('Office');
    core.controller.openLocation('user'); core.controller.setLocationText('Home', 'user');
    expect(core.controller.escape()).toBe('section');
    expect(core.store.getState()).toMatchObject({ section: 'none', location: 'Office', phase: { type: 'open' } });
    core.controller.openLocation('user'); core.controller.setLocationText('Home', 'user');
    core.controller.pointerDownInPanel(197); expect(core.store.getState().section).toBe('location');   // the bar keeps its meaning
    core.controller.pointerDownInPanel(105); expect(core.store.getState()).toMatchObject({ section: 'none', location: 'Office' });
    core.controller.openLocation('user'); core.controller.setLocationText('Home', 'user'); core.controller.toggleLocation('user');
    expect(core.store.getState()).toMatchObject({ section: 'none', location: 'Office' });
    core.controller.openLocation('user'); core.controller.clearLocation('user');
    expect(core.store.getState()).toMatchObject({ section: 'none', location: null });
  });
  test('Location: ↩ and ⌘↩ mean Done, never save; ✓ applies an edited location, then saves', async () => {
    const a = createTestCore(); await openPanel(a);
    a.controller.setTitle('Call mum', 'user');
    a.controller.openLocation('user'); a.controller.setLocationText('Office', 'user');
    await expect(a.controller.textRowSubmit('user')).resolves.toBeNull();
    expect(a.store.getState()).toMatchObject({ section: 'none', location: 'Office', savedItems: [] });
    a.controller.openLocation('user'); a.controller.setLocationText('Home', 'user');
    await expect(a.controller.save('user')).resolves.toBeNull();
    expect(a.store.getState()).toMatchObject({ section: 'none', location: 'Home', savedItems: [] });
    a.controller.openLocation('user'); a.controller.setLocationText('Café Slavia', 'user');
    a.controller.saveFromBar('user'); await adv(320);
    expect(a.store.getState().savedItems[0]).toMatchObject({ title: 'Call mum', notes: '📍 Café Slavia' });
    const b = createTestCore(); await openPanel(b);
    b.controller.setTitle('B', 'user'); b.controller.setLocation('Office', 'user'); b.controller.openLocation('user');
    b.controller.saveFromBar('user'); await adv(320);
    expect(b.store.getState().savedItems[0].notes).toBe('📍 Office');                              // untouched: saved as it was
  });
  test('switching between Location and Set Date keeps what was typed; an invalid typed date beeps and blocks it (SectionHandoff)', async () => {
    const core = createTestCore(); await openPanel(core);
    core.controller.openLocation('user'); core.controller.setLocationText('Office', 'user');
    core.controller.toggleSchedule('user');                                                         // calendar button while Location is open
    expect(core.store.getState()).toMatchObject({ section: 'controls', location: 'Office', locationField: null });
    core.controller.setScheduleText('+2h', 'user');
    core.controller.toggleLocation('user');                                                         // the edited draft is Set first
    expect(core.store.getState()).toMatchObject({ section: 'location', dueDate: new Date('2026-09-18T10:00:00Z'), locationField: 'Office' });
    core.controller.openSchedule('user');                                                           // ⌘D from an untouched Location: nothing written
    expect(core.store.getState()).toMatchObject({ section: 'controls', location: 'Office' });
    core.controller.setScheduleText('tomorrow please', 'user');
    expect(core.controller.switchSection('location', 'user')).toBe(false);
    expect(core.store.getState().section).toBe('controls');
    expect(core.store.beepCount).toBe(1);
  });
  ```
- [ ] **Step 2: Run it** — `npx vitest run tests/recreation/controller.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `focus.ts`, `controller.ts`, `RecreationContext.tsx` and the support helpers with the rules above.
  `createRecreationCore` builds `formatter = new SuggestionDateFormatter({ locale, calendar, hour12 })`, `sizes = sizesFor(notch, screenHeight, dockHeight)`,
  the store, the runtime (`hasNotch: () => true`) and the controller. `RecreationProvider` also renders `MotionPrefsProvider`.
- [ ] **Step 4: Run it** — `npx vitest run tests/recreation`. Expected: PASS.
- [ ] **Step 5: Commit** — `git add src/recreation/controller.ts src/recreation/ui/focus.ts src/recreation/ui/RecreationContext.tsx tests/ui/support.tsx tests/recreation/controller.test.ts && git commit -m "feat(recreation): controller joining store and runtime, focus registry and React context"`

---

### Task 30 (B10): DashedCircle, PlaceholderTextField and InputView

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

### Task 31 (B11): HeaderView and the list picker (landing spec §11.4 style)

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
  export function PopoverSurface(props: { anchor: PopoverAnchor; name: 'lists'; label: string; role: 'menu';   // the list picker is the only popover (B-D3)
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

### Task 32 (B12): ChipSlot — suggestion chip, date chip, error (`QuickReminderView.regularBottom`)

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
    expect(core.store.getState().section).toBe('controls');
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

### Task 33 (B13): BottomBar — pill with calendar / location / flag and the ✓ (`BottomBar.swift`)

**Files:**
- Create: `src/recreation/ui/BottomBar.tsx`
- Test: `tests/ui/BottomBar.test.tsx`

**Interfaces:**
- Consumes: `HoverHighlightButton`, `HoverButton` (B4); `SFIcon` (B3); `toTransition`, `Motion.{flag, canSave, highlight}`; B9 context; controller `toggleSchedule`, `toggleLocation`, `toggleFlag`, `saveFromBar`.
- Produces:
  ```ts
  export const PILL = { height: 44, padX: 11, gap: 17, iconSize: 18, hit: 38 } as const;
  export const SAVE_BUTTON = { size: 48, glyph: 22 } as const;
  export function BottomBar(): JSX.Element;
  export function saveHelp(state: RecreationState): string;   // 'Save reminder' | 'Applies the date in Set Date, then saves' | 'Applies the location, then saves' (BottomBar.saveHelp)
  ```

Values: bar `display: flex; align-items: center`; pill `height: px(44)`, `padding: 0 px(11)`, `gap: px(17)`, capsule
`background: var(--qr-pill-fill)`, inner stroke `box-shadow: inset 0 0 0 px(1) var(--qr-pill-stroke)` (`strokeBorder`); spacer
`flex: 1 0 auto; min-width: px(16)`; three `HoverHighlightButton size={38}`:
- calendar: `aria-label="Set date and time"`, `aria-pressed={schedulingInNotch}` (toggle trait in notch style), `data-qr-target="calendarIcon"`,
  glyph `calendar.badge.clock@18`, colour accent when `dueDate !== null || schedulingInNotch`, else white; behind the glyph an open-state
  disc inset 3 pt (32 pt) `color-mix(in srgb, var(--qr-list-accent) 22%, transparent)` while the section is open, opacity faded with
  `Motion.highlight`; click → `toggleSchedule('user')`.
- location (Swift `BottomBar.locationButton`, notch style): `aria-label` = `location ? 'Location, ' + location : 'Add location'` (the label names the
  location, the open state is separate), `aria-pressed={locationInNotch}` (toggle trait), `aria-description` = `locationInNotch ? 'Hides Location' : 'Shows Location below'`,
  `data-qr-target="locationIcon"`; glyph `location.fill@18` when a location is set, else `location@18`; colour accent when `location !== null || locationInNotch`,
  else white; behind the glyph the same open-state disc as the calendar (inset 3 pt, accent 22 %, `Motion.highlight`) while Location is shown;
  click → `toggleLocation('user')` (opens Location below the bar, switching over from Set Date if that is shown, or closes it again; never a popover).
- flag: `aria-label="Toggle flag"`, `aria-pressed={flagged}`, `data-qr-target="flagIcon"`, glyph `flag.fill@18` in `var(--qr-flag-orange)`
  when flagged, else `flag@18` white; click → `toggleFlag('user')`.
- glyph swaps (`.contentTransition(.symbolEffect(.replace))`): `AnimatePresence mode="popLayout"` keyed by the glyph name, old glyph
  scale → 0.5 and opacity → 0, new glyph from scale 0.5 / opacity 0, `Motion.flag` (spring 0.25 / 0.7); reduced → opacity with `Motion.reduced`.
- ✓: `HoverButton` with `layoutId="save"` (motion, shared with the saved badge, Swift `matchedGeometryEffect(id: "save")`),
  `aria-label="Save reminder"`, `title={saveHelp(state)}`, `data-qr-target="save"`, disabled when `!canSave`; it gives up ⌘↩ while a section is open (B22 routes ⌘↩ to Set / Done then); a 48 pt circle,
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
    expect(core.store.getState().section).toBe('controls');
    expect(cal.getAttribute('aria-pressed')).toBe('true');
    const disc = cal.querySelector('[data-qr-open-disc]') as HTMLElement;
    expect([ptOf(disc.style.inset)]).toEqual([3]);
    expect(screen.getByRole('button', { name: 'Save reminder' }).title).toBe('Applies the date in Set Date, then saves');
    fireEvent.click(cal);
    expect(core.store.getState().section).toBe('none');
  });
  test('location icon toggles the in-notch Location section and shows it is open', async () => {
    const { core } = renderWithCore(<BottomBar />);
    await openPanel(core);
    const loc = screen.getByRole('button', { name: 'Add location' });
    fireEvent.click(loc);
    expect(core.store.getState().section).toBe('location');
    expect([loc.getAttribute('aria-pressed'), loc.getAttribute('aria-description')]).toEqual(['true', 'Hides Location']);
    expect(loc.querySelector('[data-qr-glyph]')!.getAttribute('style')).toContain('color: var(--qr-list-accent)');   // active while shown
    expect(loc.querySelector('[data-sf="location@18"]')).not.toBeNull();                                            // still no location
    expect(ptOf((loc.querySelector('[data-qr-open-disc]') as HTMLElement).style.inset)).toBe(3);
    expect(screen.getByRole('button', { name: 'Save reminder' }).title).toBe('Applies the location, then saves');
    fireEvent.click(loc);
    expect(core.store.getState().section).toBe('none');
    expect([loc.getAttribute('aria-pressed'), loc.getAttribute('aria-description')]).toEqual(['false', 'Shows Location below']);
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
- [ ] **Step 4: Run it** — Expected: PASS (7 tests).
- [ ] **Step 5: Commit** — `git add src/recreation/ui/BottomBar.tsx tests/ui/BottomBar.test.tsx && git commit -m "feat(recreation): bottom bar pill with date, location and flag, and the save button"`

---

### Task 34 (B14): LocationNotchSection — Location in the notch (`LocationNotchSection.swift`, landing spec §5.3, §11.4, B-D3)

The location button grows the panel downward and this short section is appended below the bottom bar, like Set Date (app `0c87117`,
SPEC §1 "Location icon"): a field, then Clear · Cancel · Done. Nothing reaches the reminder until Done (↩ in the field, ↩ / ⌘↩ anywhere in the
panel), Clear or ✓ (`LocationDraft.saveDecision`); Cancel, Esc, the location button and a click on the header / title / notes close it without
writing (Task 29 (B9)). Switching to Set Date keeps what was typed (`LocationDraft.textToKeepOnSwitch`, Task 29 `switchSection`). Heights are
`LocationMetrics` (Task 16 (A16)): field 36 + 14 + footer 36 = 86 pt, + the 20 pt inset → panel 241 + 86 + 20 = 347 pt.

**Files:**
- Create: `src/recreation/ui/LocationNotchSection.tsx`
- Test: `tests/ui/LocationNotchSection.test.tsx`

**Interfaces:**
- Consumes: `NotchFillButton`, `NotchTextButton` (B4); `SFIcon` (`location@12`, B3); `staggerTransition`, `Motion.focusRing` (B1); `AccentContrast.label` (A11);
  `Theme.{locationField, footer}`, `LocationMetrics`, `ScheduleMetrics.controlRadius` (A16, A17); `LocationDraft` (A14); `useRecreationState`, `useCore` (B9);
  store `locationDraft` (B6); controller `setLocationText`, `commitLocation`, `cancelLocation`, `clearLocation` (B9); focus registry `register('locationField', el)`.
- Produces:
  ```ts
  export function LocationNotchSection(): JSX.Element;    // mounted by QuickReminderView while panel.flags.section === 'location' (B20)
  export function doneLabel(committed: string): string;   // 'Done, no location' | `Done, ${committed}` (Swift Done accessibilityLabel)
  ```

Layout (Swift `LocationNotchSection.body`, `field`, `footer`; `QuickReminderView` `.frame(maxHeight: .infinity, alignment: .top).padding(.bottom, 20)`):
- Root `role="group"`, `aria-label="Location"`, `data-qr-section="location"`, flex column, `flex: 1 1 auto; min-height: 0; padding-bottom: 20`.
- Field row (`data-qr-row`, `data-stagger="0"`): box `data-qr-location-field`, height 36 (`LocationMetrics.field`), padding-x 12, flex gap 8,
  background white 7 %, inner stroke 1 pt white 8 % (accent 70 % while the input is focused, `Motion.focusRing` easeOut 0.15), radius 12
  (`ScheduleMetrics.controlRadius`); `SFIcon location@12` in the accent (`aria-hidden`); `<input>` `aria-label="Location"`,
  `aria-description="Added to the notes with a pin. Return applies it."`, placeholder "Enter location" with `--qr-ph: rgba(255, 255, 255, 0.5)`,
  14 / 400 white, `data-qr-field="locationField"`, `data-qr-target="locationField"`, value `state.locationField ?? ''`; change →
  `setLocationText(value, 'user')` (the draft, never the location); a click anywhere on the box focuses the input (`.onTapGesture { fieldFocused = true }`).
- Footer row (`data-qr-row`, `data-stagger="1"`) `margin-top: 14` (`LocationMetrics.footerGap`); footer `data-qr-footer` flex, gap 8, height 36
  (`LocationMetrics.footer`): "Clear" `NotchTextButton` only while `state.location !== null` (Swift `!locationText.isEmpty`), `data-qr-target="locationClear"`,
  `aria-description="Removes the location from the reminder"` → `clearLocation('user')`; spacer `flex: 1 0 0; min-width: 0` (`Spacer(minLength: 0)`);
  Cancel `NotchFillButton kind="neutral" radius={12}`, 13 / 500 white 85 %, padding-x 16, height 36, `data-qr-target="locationCancel"` →
  `cancelLocation('user')`; Done `NotchFillButton kind="prominent" radius={12}`, 13 / 600, padding-x 18, height 36, label colour
  `AccentContrast.label(accent)`, `aria-label` = `doneLabel(draft.committed)`, `data-qr-target="locationDone"` → `commitLocation('user')`.
- Rows stagger in exactly like B19 (`staggerTransition(0)` field, `staggerTransition(1)` footer: opacity 0 → 1, translateY −6 pt, blur 3 pt, easeOut 0.24 at
  0.06 + i · 0.035 s; under reduce only the opacity, `Motion.reduced`); the section's own enter / exit opacity (`Motion.sectionIn` / `sectionOut`) is B20's
  `AnimatePresence`, the same as Set Date's (`notchSectionTransition`).
- The section keeps the `LocationDraft` it mounted with (`useRef`, replaced when the store hands out a new draft), so it can render during its exit after
  the store dropped the draft. Keys: ↩ in the field → `commitLocation` and ⌘↩ anywhere → `commitSection` are mapped in B22 (Swift `.onSubmit(done)`,
  `CommandReturnTwin(action: done)`, Done is the `.defaultAction`). Focus: a `'user'` open focuses the field on the next turn (B9); an `'api'` open never does.

- [ ] **Step 1: Write the failing test** `tests/ui/LocationNotchSection.test.tsx`
  ```ts
  // @vitest-environment jsdom
  import './setup';
  import { screen, fireEvent, act } from '@testing-library/react';
  import { LocationNotchSection, doneLabel } from '../../src/recreation/ui/LocationNotchSection';
  import { renderWithCore, ptOf, useTestTime, openPanel, createTestCore } from './support';
  beforeEach(() => useTestTime());
  test('field + Clear · Cancel · Done in the LocationMetrics rhythm (36 + 14 + 36, inset 20)', async () => {
    const core = createTestCore(); await openPanel(core);
    act(() => core.controller.openLocation('user'));
    const { container } = renderWithCore(<LocationNotchSection />, core);
    const section = screen.getByRole('group', { name: 'Location' });
    expect([section.dataset.qrSection, ptOf(section.style.paddingBottom)]).toEqual(['location', 20]);
    const box = container.querySelector('[data-qr-location-field]') as HTMLElement;
    expect([ptOf(box.style.height), ptOf(box.style.paddingLeft), ptOf(box.style.gap), ptOf(box.style.borderRadius)]).toEqual([36, 12, 8, 12]);
    expect(box.querySelector('[data-sf="location@12"]')).not.toBeNull();
    expect((screen.getByRole('textbox', { name: 'Location' }) as HTMLInputElement).placeholder).toBe('Enter location');
    const footer = container.querySelector('[data-qr-footer]') as HTMLElement;
    expect([ptOf((footer.closest('[data-qr-row]') as HTMLElement).style.marginTop), ptOf(footer.style.height), ptOf(footer.style.gap)]).toEqual([14, 36, 8]);
    expect([...container.querySelectorAll('[data-qr-row]')].map(r => (r as HTMLElement).dataset.stagger)).toEqual(['0', '1']);
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();                 // no location yet
    const cancel = screen.getByRole('button', { name: 'Cancel' }), done = screen.getByRole('button', { name: 'Done, no location' });
    expect([ptOf(cancel.style.height), ptOf(cancel.style.paddingLeft), ptOf(done.style.height), ptOf(done.style.paddingLeft)]).toEqual([36, 16, 36, 18]);
    expect(done.style.color).toBe('rgb(255, 255, 255)');                                 // AccentContrast.label('#0A84FF') = '#FFFFFF'
  });
  test('typing stays in the field until Done; a visitor open focuses the field', async () => {
    const core = createTestCore(); await openPanel(core);
    renderWithCore(<LocationNotchSection />, core);                                     // renders nothing until the section opens
    act(() => core.controller.openLocation('user'));
    await act(async () => { vi.advanceTimersByTime(0); });
    const field = screen.getByRole('textbox', { name: 'Location' });
    expect(document.activeElement).toBe(field);
    fireEvent.change(field, { target: { value: 'Office' } });
    expect(core.store.getState()).toMatchObject({ location: null, locationField: 'Office', dirty: false });
    fireEvent.click(screen.getByRole('button', { name: 'Done, Office' }));
    expect(core.store.getState()).toMatchObject({ location: 'Office', section: 'none', locationField: null, dirty: true });
  });
  test('Cancel leaves the location; Clear (shown only with a location) removes it; Done turns black on a light list colour', async () => {
    const core = createTestCore(); await openPanel(core);
    act(() => { core.controller.setList('home', 'user'); core.controller.setLocation('Office', 'user'); core.controller.openLocation('api'); });
    renderWithCore(<LocationNotchSection />, core);
    expect(document.activeElement).not.toBe(screen.getByRole('textbox', { name: 'Location' }));   // an API open never takes focus
    expect(screen.getByRole('button', { name: 'Done, Office' }).style.color).toBe('rgb(0, 0, 0)');  // '#000000' on #FF9F0A
    fireEvent.change(screen.getByRole('textbox', { name: 'Location' }), { target: { value: 'Home' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(core.store.getState()).toMatchObject({ location: 'Office', section: 'none' });
    act(() => core.controller.openLocation('user'));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(core.store.getState()).toMatchObject({ location: null, section: 'none' });
  });
  test('doneLabel (Done accessibilityLabel)', () => {
    expect(doneLabel('')).toBe('Done, no location');
    expect(doneLabel('Office')).toBe('Done, Office');
  });
  ```
- [ ] **Step 2: Run it** — `npx vitest run tests/ui/LocationNotchSection.test.tsx`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `LocationNotchSection.tsx` (renders `null` while `panel.flags.section !== 'location'` and no draft was captured).
- [ ] **Step 4: Run it** — Expected: PASS (4 tests).
- [ ] **Step 5: Commit** — `git add src/recreation/ui/LocationNotchSection.tsx tests/ui/LocationNotchSection.test.tsx && git commit -m "feat(recreation): in-notch Location section with Clear, Cancel and Done"`

---

### Task 35 (B15): SavedCheckView — the ✓ badge that draws itself and pops (`SavedCheckView.swift`)

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

### Task 36 (B16): ScheduleMonthGrid (`ScheduleMonthGrid.swift`)

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

### Task 37 (B17): Set Date rows 1 — type field, preview line, preset cards (`ScheduleNotchSection.swift`)

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
  "In the past", both `var(--qr-flag-orange)`, then "· " + dayAndTime white 60 %; else dayAndTime white + "· " + `RelativeDistance.string(now, draft, locale, calendar)` white 60 %.
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
    expect(core.store.getState()).toMatchObject({ dueDate: new Date('2026-09-21T07:00:00Z'), presetPick: { preset: 'nextWeek' }, section: 'none' });
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

### Task 38 (B18): Set Date rows 2 — day / time row, footer, numeric label transition

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
    expect(core.store.getState().section).toBe('calendar');
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
    expect(core.store.getState()).toMatchObject({ section: 'none', dueDate: new Date('2026-09-19T07:00:00Z') });
  });
  test('Clear shows once a date is set and removes it', async () => {
    const core = await opened();
    act(() => core.controller.cancelSchedule('api'));
    act(() => { core.controller.setDueDate(new Date('2026-09-20T07:00:00Z'), null, 'api'); core.controller.openSchedule('api'); });
    renderWithCore(<ScheduleFooter draft={core.store.scheduleDraft!} />, core);
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(core.store.getState()).toMatchObject({ dueDate: null, section: 'none' });
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

### Task 39 (B19): The in-notch Set Date section — composition, stagger, calendar slot, focus, announcements, clamp

**Files:**
- Modify: `src/recreation/ui/ScheduleNotchSection.tsx` (add the default export `ScheduleNotchSection`)
- Test: `tests/ui/ScheduleNotchSection.test.tsx`

**Interfaces:**
- Consumes: B16, B17, B18; `staggerTransition`, `effective('schedule')`, `toTransition(Motion.sectionIn | sectionOut | reduced)` (B1);
  `NotchLayout.openSize`, `panelSize`, `ScheduleMetrics` (gaps); `usePanel`, `useScheduleDraft` (B9); store `calendarMonth`, `pageMonth`; controller `pickDay`.
- Produces:
  ```ts
  export function ScheduleNotchSection(): JSX.Element;   // mounted by QuickReminderView while isSchedule(panel.flags.section)
  export const ANNOUNCE_PAUSE_MS: 400;
  ```

Layout (Swift `ScheduleNotchSection.body`, `rows`, `QuickReminderView` `.padding(.bottom, 20)`; heights `ScheduleMetrics`):
root `role="group"`, `aria-label="Set Date"`, `data-qr-section`, flex column, `flex: 1 1 auto; min-height: 0; padding-bottom: 20`;
a rows area (`data-qr-section-rows`, `flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain`) holding:
type field (stagger 0), preview `margin-top: 6` (stagger 0), presets `margin-top: 10` (stagger 1), day / time row `margin-top: 12`
(stagger 2), and while `section === 'calendar'` the month grid `margin-top: 10`; then the footer `margin-top: 14` (stagger 3) outside
the rows area (pinned). Stagger: each row starts at opacity 0, translateY −6 pt, blur 3 pt and animates to 0 with
`staggerTransition(i)` (easeOut 0.24, delay 0.06 + i·0.035); under reduce only the opacity, `Motion.reduced`. The y and blur are motion
values in points composed into `transform: translateY(calc(v * var(--pt) * 1px))` and `filter: blur(calc(b * var(--pt) * 1px))`.
Section enter: opacity with `Motion.sectionIn` (easeOut 0.12); exit (`AnimatePresence` in B20): opacity `Motion.sectionOut` (easeOut 0.10)
while the blob retracts over it. Calendar slot: `AnimatePresence`, enter / exit opacity + translateY −8 pt with `effective('schedule')`;
reduce → opacity only. The section keeps the `ScheduleDraft` it mounted with (`useRef`), so it can render during its exit after the store
dropped the draft; during that exit it also keeps the depth it last had (a switch from `'calendar'` to `'location'` fades the whole section
out, the calendar slot does not run its own exit). One section at a time (B20): a switch to Location plays this exit while Location's rows
stagger in, inside the blob's one spring. Clamp: `data-clamped` = `panelSize(sizes, section).height < NotchLayout.openSize(39, section).height`; when clamped and
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
- [ ] **Step 3: Implement** `ScheduleNotchSection` (renders `null` while `!isSchedule(panel.flags.section)` and no draft was captured).
  The day / time wrapper carries `data-qr-day-time`, the footer `data-qr-footer`, the grid wrapper `data-qr-calendar`; every row wrapper is
  `data-qr-row` with `data-stagger`.
- [ ] **Step 4: Run it** — `npx vitest run tests/ui/ScheduleNotchSection.test.tsx tests/ui/ScheduleRows.test.tsx tests/ui/ScheduleControls.test.tsx`. Expected: PASS.
- [ ] **Step 5: Commit** — `git add src/recreation/ui/ScheduleNotchSection.tsx tests/ui/ScheduleNotchSection.test.tsx && git commit -m "feat(recreation): in-notch Set Date section with staggered rows, calendar slot and announcements"`

---

### Task 40 (B20): QuickReminderView — the open panel's vertical rhythm (`QuickReminderView.swift`)

**Files:**
- Create: `src/recreation/ui/QuickReminderView.tsx`
- Test: `tests/ui/QuickReminderView.test.tsx`

**Interfaces:**
- Consumes: `HeaderView` (B11), `InputView` (B10), `ChipSlot` (B12), `BottomBar` (B13), `LocationNotchSection` (B14), `ScheduleNotchSection` (B19); `isSchedule`; `panelSize`, `notchBandHeight`;
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
wrapper `margin-bottom: 20`; then one `AnimatePresence` holding at most one section (Swift `if schedulingInNotch { ScheduleNotchSection } else if
locationInNotch { LocationNotchSection }`): `ScheduleNotchSection` keyed `schedule` while `isSchedule(flags.section)` (the calendar toggle keeps the
same key, so `'controls'` ↔ `'calendar'` never remounts it), `LocationNotchSection` keyed `location` while `flags.section === 'location'`. A switch
between them is one `sectionChanged` (A20): the leaving section fades out (`Motion.sectionOut`) and the entering one fades in with its stagger while the
blob springs once (`Motion.schedule`, Swift `sectionAnimation`) to the new height (519 / 751 / 347). The plain panel never changes for a section. `onPointerDownCapture`: y in points = `(clientY − rect.top) · panelHeight / rect.height` → `pointerDownInPanel(y)` (the click still lands).

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
    expect(core.store.getState().section).toBe('controls');
    fireEvent.pointerDown(screen.getByRole('textbox', { name: 'New Reminder' }), { clientY: 105 });
    expect(core.store.getState().section).toBe('none');
  });
  test('Location is appended below the bar (347 pt); a switch to Set Date swaps the section in one step', async () => {
    const core = createTestCore(); await openPanel(core);
    const { container } = renderWithCore(<QuickReminderView />, core);
    act(() => core.controller.openLocation('user'));
    const root = container.querySelector('[data-qr-panel-content]') as HTMLElement;
    expect(ptOf(root.style.height)).toBe(347);
    const pill = root.querySelector('[data-qr-pill]')!, loc = root.querySelector('[data-qr-section="location"]')!;
    expect(pill.compareDocumentPosition(loc) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Set Date' })).toBeNull();
    act(() => core.controller.openSchedule('user'));
    expect(ptOf(root.style.height)).toBe(519);
    expect(screen.getByRole('group', { name: 'Set Date' })).toBeTruthy();
    expect(core.store.getState()).toMatchObject({ section: 'controls', locationField: null });
  });
  test('no pointer input while closed', () => {
    const { container } = renderWithCore(<QuickReminderView />);
    expect((container.querySelector('[data-qr-panel-content]') as HTMLElement).dataset.interactive).toBe('false');
  });
  ```
- [ ] **Step 2: Run it** — `npx vitest run tests/ui/QuickReminderView.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** `QuickReminderView.tsx` (each wrapper carries `data-qr-stack-item`; `HeaderView`'s root carries `data-qr-header`;
  `data-interactive` mirrors the pointer-events decision).
- [ ] **Step 4: Run it** — Expected: PASS (5 tests).
- [ ] **Step 5: Commit** — `git add src/recreation/ui/QuickReminderView.tsx tests/ui/QuickReminderView.test.tsx && git commit -m "feat(recreation): open panel layout with the SPEC vertical rhythm"`

---

### Task 41 (B21): NotchContainer — silhouette, masked content transition, saved badge, list picker, click outside (`NotchContainerView.swift`)

**Files:**
- Create: `src/recreation/ui/NotchContainer.tsx`
- Test: `tests/ui/NotchContainer.test.tsx`

**Interfaces:**
- Consumes: `NotchSilhouette`, `useNotchGeometry`, `translatedNotchPath`, `ShapeTarget` (B5); `QuickReminderView` (B20); `SavedCheckView` (B15);
  `ListPickerMenu` (B11); `currentSize`, `radii`, `panelSize`, `tallestSectionSize`, `savedSize`; `NotchLayout.{canvasSize, openCanvasSize, savedBadgeSize, savedBadgeTrailingPadding}`;
  `effective`, `INSTANT`, `FlagAnimation` (B1); `usePanel`, `useRecreationState`, `useCore` (B9); controller `show('click', true)` (press on the closed notch), `hover`, `pointerDownOutside`, `closeListPicker`.
- Produces:
  ```ts
  export function canvasFor(sizes: NotchSizes): Size;                           // openCanvasSize(sizes.openSize, tallestSectionSize(sizes)): 648 × 775 (the calendar; Location 347 never changes it)
  export function contentTransition(animation: FlagAnimation, reduceMotion: boolean, timeScale: number): Transition;
  export function badgeOrigin(sizes: NotchSizes, canvasWidth: number): { left: number; top: number };   // { 459.5, 7.5 }
  export function NotchContainer(): JSX.Element;
  ```

Rules (Swift `NotchContainerView`, `PanelController`):
- Canvas `data-qr-canvas`: `width/height = px(canvasFor(sizes))`, `position: relative`, `pointer-events: none`, `--qr-list-accent: <state.accent>`,
  class `qr-root`.
- Silhouette: target `{ ...currentSize(flags, sizes), ...radii(flags) }` (saving → saved pill 379 × 39; open → panelSize; hovering → 257 × 44;
  else 235 × 39; radii 19 / 32 open else 6 / 14), animation = `panel.animation`; hover → `controller.hover`; press while closed → `controller.show('click', true)`.
- Content wrapper `data-qr-content`: absolutely placed at `left: px((canvas.width − panel.width) / 2)` (24), top 0, size = `panelSize(sizes, flags.section)`;
  opacity 1 / 0, blur 0 / 8 pt and scale 1 / 0.94 from the top (`transform-origin: top center`) for `contentVisible` true / false; under reduce blur 0
  and scale 1 always; transition `contentTransition(panel.animation)`: `open` → `effective('contentIn')`, `close` and `saving` → `effective('contentOut')`
  (saving always `Motion.contentOut`), `none` → `INSTANT`. `aria-hidden` and `inert` while `!flags.isOpen`.
  Mask: while `!flags.isSettled`, `clip-path: path("<translatedNotchPath(live geometry, panel.width)>")` re-derived per frame from the silhouette's
  motion values; settled → `clip-path: none` (Swift drops the mask once settled).
- Saved badge: while `flags.savedBadgeShown`, a wrapper at `badgeOrigin` (right edge = canvas centre + savedWidth / 2 − 30, centre y = 39 / 2) holding
  `SavedCheckView visible={flags.isSaving}`; the ✓ and the badge share `layoutId="save"` inside one `LayoutGroup` (the whole container).
- Popover layer: `ListPickerMenu` rendered last (above the content); Location is a section inside the content (B14, B20), not a popover.
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

- [ ] **Step 6: Review-focus pin R2 — the closed notch stays tappable at phone scale.** At `--pt` 0.258 (390 px phone, Task 56 (C10) phone scale) the closed silhouette is 61 × 10 CSS px, below any tap target. Add an invisible hit layer `<div data-qr-target="notchHit" class="qr-notch-hit" aria-hidden>` over the closed silhouette, centred on the canvas top centre, with `style={{ '--qr-hit-w': px(235), '--qr-hit-h': px(39) }}` and in `recreation.css` `.qr-notch-hit { width: max(var(--qr-hit-w), 44px); height: max(var(--qr-hit-h), 44px); }`; `pointer-events: auto` only while the phase is closed (else `none`); it forwards `pointerdown` → `controller.show('click', true)` and enter / leave → `controller.hover` exactly like the path (the path keeps its own handlers; the silhouette itself does not change). Test in `tests/ui/NotchContainer.test.tsx`:
  ```ts
  test('review focus: closed notch hit layer is at least 44 × 44 CSS px and opens on press', async () => {
    const { container, core } = renderWithCore(<NotchContainer />);
    const hit = container.querySelector('[data-qr-target="notchHit"]') as HTMLElement;
    expect(ptOf(hit.style.getPropertyValue('--qr-hit-w'))).toBe(235);
    expect(ptOf(hit.style.getPropertyValue('--qr-hit-h'))).toBe(39);
    expect(readFileSync(new URL('../../src/recreation/ui/recreation.css', import.meta.url), 'utf8'))
      .toMatch(/\.qr-notch-hit\s*\{[^}]*width:\s*max\(var\(--qr-hit-w\),\s*44px\)[^}]*height:\s*max\(var\(--qr-hit-h\),\s*44px\)/);
    expect(hit.style.pointerEvents).toBe('auto');
    fireEvent.pointerDown(hit);
    await adv(500);
    expect(core.runtime.machine.phase).toEqual({ type: 'open' });
    expect(hit.style.pointerEvents).toBe('none');
  });
  ```
  Run `npx vitest run tests/ui/NotchContainer.test.tsx` → PASS; then `git add src/recreation/ui/NotchContainer.tsx src/recreation/ui/recreation.css tests/ui/NotchContainer.test.tsx && git commit -m "feat(recreation): 44 px hit layer for the closed notch at phone scale"`.

---

### Task 42 (B22): Keyboard — scoped to the focused desktop, always `preventDefault` (landing spec §11.3)

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
    | { type: 'commitSchedule' } | { type: 'commitSection' } | { type: 'applyTypedTime' } | { type: 'commitLocation' } | { type: 'applySuggestion' }
    | { type: 'openSchedule' } | { type: 'toggleCalendar' } | { type: 'preset'; preset: DatePreset }
    | { type: 'stepTime'; steps: 1 | -1 } | { type: 'moveDay'; days: -7 | -1 | 1 | 7 };
  export interface KeyContext { readonly state: RecreationState; readonly field: FocusField | null; readonly cmdKey: 'meta' | 'ctrl' }   // field = data-qr-field of the closest ancestor of the event target
  export function recreationKeyFor(e: Pick<KeyboardEvent, 'key' | 'code' | 'metaKey' | 'shiftKey' | 'altKey' | 'ctrlKey' | 'isComposing'>, ctx: KeyContext): RecreationKeyAction | null;
  export function platformCmdKey(platform?: string): 'meta' | 'ctrl';          // Mac / iPhone / iPad → 'meta'
  export function useRecreationKeys(enabled: boolean): (e: ReactKeyboardEvent) => void;   // for the recreation root's onKeyDown
  ```

Key map (Swift sources in brackets; ⌘ = `cmdKey` held with no other modifier unless stated; `open` = phase open, `Set Date` = `isSchedule(section)`, `a section` = section ≠ none, Set Date or Location):

| Key | Condition | Action |
|---|---|---|
| any | `isComposing` (IME) | null |
| Esc | open or saving | `escape` [Esc monitor + `.panelDismissPopovers`; during the hold it hides] |
| any other key | phase saving | `swallow` [PanelController: "during the saved hold … swallow quietly"] |
| ⇧⌘R | any | `toggle` [hotkey again collapses] |
| ⌘↩ | open | `submit` [✓ `keyboardShortcut(.return, .command)`; while a section is open the ✓ drops it and the section's `CommandReturnTwin` commits (Set / Done): `controller.save` → `commitSection`] |
| ↩ | field `title` / `notes` | `textRowSubmit` [PlainTextView `insertNewline` → `submitFromTextRow`] |
| ↩ | field `scheduleField` | `commitSchedule` [`.onSubmit(commit)`] |
| ↩ | field `timeField` | `applyTypedTime` [consumes ↩, keeps the section open] |
| ↩ | field `locationField` | `commitLocation` [`LocationNotchSection.field` `.onSubmit(done)`] |
| ↩ | a section open, focus on any other element inside | `commitSection` [Set / Done is `.defaultAction`] |
| Tab (no modifiers) | field `title`, `state.suggestion !== null` | `applySuggestion` [`onTab`]; otherwise null (native focus move) |
| ⌘D | open, badge not shown | `openSchedule` [`setDateShortcut`; from Location it switches over, keeping what was typed] |
| ⌘K | Set Date open | `toggleCalendar` [`calendarShortcut`, part of `ScheduleNotchSection`; nothing while Location is open] |
| ⌘1 … ⌘6 (`code` `Digit1`…`Digit6`) | Set Date open | `preset` `DATE_PRESETS[n − 1]` [`presetCard` `.keyboardShortcut`] |
| ↑ / ↓ | field `timeField` | `stepTime` +1 / −1 [`.onKeyPress(.upArrow / .downArrow)`] |
| ← / → / ↑ / ↓ | field `calendar` | `moveDay` −1 / +1 / −7 / +7 [grid `.onKeyPress`] |
| anything else | | null (native behaviour, no `preventDefault`) |

Performing: `escape` → `controller.escape()`; `toggle` → `controller.toggle()`; `submit` → `controller.save('user')`; `textRowSubmit`;
`commitSchedule('user')`; `commitSection('user')`; `applyTypedTime(true)`; `commitLocation('user')`; `applySuggestion('user')`; `openSchedule('user')`;
`toggleCalendar('user')`; `applyPreset(p, 'user')`; `stepTime(n, 'user')`; `moveDay(d)`; `swallow` → nothing. Every non-null action →
`e.preventDefault(); e.stopPropagation()`. Keyboard notch button: while the phase is closed, a transparent `<button>` over the closed
silhouette (235 × 39 at the canvas top centre, `aria-label="New reminder"`, `pointer-events: none` so the path keeps the pointer) — Enter /
Space activate it natively → `controller.show('click', true)`.

- [ ] **Step 1: Write the failing pure test** `tests/ui/keyboard.test.ts`
  ```ts
  import { recreationKeyFor, platformCmdKey, type KeyContext } from '../../src/recreation/ui/keyboard';
  const base = { phase: { type: 'open' }, section: 'none', suggestion: null, badgeShown: false } as any;
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
    [k('Enter'), ctx('scheduleField', { section: 'controls' }), { type: 'commitSchedule' }],
    [k('Enter'), ctx('timeField', { section: 'controls' }), { type: 'applyTypedTime' }],
    [k('Enter'), ctx('locationField', { section: 'location' }), { type: 'commitLocation' }],
    [k('Enter'), ctx(null, { section: 'calendar' }), { type: 'commitSection' }],
    [k('Enter'), ctx(null, { section: 'location' }), { type: 'commitSection' }],
    [k('d', { meta: true }), ctx('locationField', { section: 'location' }), { type: 'openSchedule' }],
    [k('k', { meta: true }), ctx('locationField', { section: 'location' }), null],
    [k('3', { meta: true, code: 'Digit3' }), ctx('locationField', { section: 'location' }), null],
    [k('Enter'), ctx(null), null],
    [k('Tab'), ctx('title', { suggestion: { matchedText: 'tomorrow' } }), { type: 'applySuggestion' }],
    [k('Tab'), ctx('title'), null],
    [k('Tab', { shift: true }), ctx('title', { suggestion: { matchedText: 'tomorrow' } }), null],
    [k('d', { meta: true }), ctx('notes'), { type: 'openSchedule' }],
    [k('d', { meta: true }), ctx('notes', { badgeShown: true }), null],
    [k('k', { meta: true }), ctx('scheduleField', { section: 'controls' }), { type: 'toggleCalendar' }],
    [k('k', { meta: true }), ctx('title'), null],
    [k('3', { meta: true, code: 'Digit3' }), ctx(null, { section: 'controls' }), { type: 'preset', preset: 'tomorrow' }],
    [k('6', { meta: true, code: 'Digit6' }), ctx(null, { section: 'calendar' }), { type: 'preset', preset: 'nextMonth' }],
    [k('1', { meta: true, code: 'Digit1' }), ctx('title'), null],
    [k('ArrowUp'), ctx('timeField', { section: 'controls' }), { type: 'stepTime', steps: 1 }],
    [k('ArrowDown'), ctx('timeField', { section: 'controls' }), { type: 'stepTime', steps: -1 }],
    [k('ArrowLeft'), ctx('calendar', { section: 'calendar' }), { type: 'moveDay', days: -1 }],
    [k('ArrowDown'), ctx('calendar', { section: 'calendar' }), { type: 'moveDay', days: 7 }],
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
    expect(core.store.getState().section).toBe('controls');
    fireEvent.keyDown(title, { key: 'k', metaKey: true });
    expect(core.store.getState().section).toBe('calendar');
    fireEvent.keyDown(title, { key: '5', code: 'Digit5', metaKey: true });
    expect(core.store.getState()).toMatchObject({ section: 'none', presetPick: { preset: 'nextWeek' } });
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
    expect(core.store.getState().section).toBe('controls');
  });
  test('Location: ↩ in the field is Done, Esc closes it without writing, ⌘↩ is Done and never saves', async () => {
    const core = createTestCore();
    renderWithCore(<Root enabled onOuter={() => {}} />, core);
    await openPanel(core);
    const field = () => screen.getAllByRole('textbox', { name: 'Location' }).at(-1)!;
    const open = async () => { act(() => core.controller.openLocation('user')); await act(async () => { vi.advanceTimersByTime(0); }); };
    const settle = () => act(async () => { vi.advanceTimersByTime(600); });
    core.controller.setTitle('Call mum', 'user');
    await open();
    fireEvent.change(field(), { target: { value: 'Office' } });
    expect(fireEvent.keyDown(field(), { key: 'Enter' })).toBe(false);                    // defaultPrevented
    expect(core.store.getState()).toMatchObject({ section: 'none', location: 'Office' });
    await settle(); await open();
    fireEvent.change(field(), { target: { value: 'Home' } });
    fireEvent.keyDown(field(), { key: 'Escape' });
    expect(core.store.getState()).toMatchObject({ section: 'none', location: 'Office', phase: { type: 'open' } });
    await settle(); await open();
    fireEvent.change(field(), { target: { value: 'Home' } });
    fireEvent.keyDown(field(), { key: 'Enter', metaKey: true });
    expect(core.store.getState()).toMatchObject({ section: 'none', location: 'Home', savedItems: [], phase: { type: 'open' } });
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

### Task 43 (B23): `Recreation` + `RecreationHandle` (`Recreation.tsx`, `index.ts`)

**Files:**
- Create: `src/recreation/Recreation.tsx`, `src/recreation/index.ts`
- Modify: `src/recreation/ui/buttons.tsx` (replace the local `PointerTarget` alias with `import type { PointerTarget } from '../Recreation'`)
- Test: `tests/recreation/Recreation.test.tsx`

**Interfaces:**
- Consumes: everything above; `AppClock.now`, `Clock` (`clock.ts`); `currentCalendar`; `motionTimeScale`, `useReducedMotion` (B1);
  `createRecreationCore` (B9); `NotchContainer` (B21); `useRecreationKeys` (B22); `RecreationProvider` (B9).
- Produces: contract §3.2 `RecreationHandle`, `ShowSource`, `PointerTarget`, `ScenePoint`, §3.3 `RecreationProps` with A-D5 / B-D3 applied
  (`RecreationState` as Task 26 (B6); `openSchedule` = `sectionChanged(controls)` through `switchSection`; `escape()` order of B-D2), with the
  contract's Location members replaced by the section's (Swift `LocationNotchSection` / `QuickReminderView.toggleLocation`), plus:
  ```ts
  // RecreationHandle, Flag / location (replaces openLocationPopover / closeLocationPopover)
  toggleFlag(): void;
  setFlag(flagged: boolean): void;
  openLocation(): void;                      // the location button when Location is not shown: switchSection('location'), keeps Set Date's edit
  toggleLocation(): void;                    // the location button: open, or close without writing
  cancelLocation(): void;                    // Cancel / Esc / click above: closes, nothing written
  commitLocation(): void;                    // Done / ↩ / ⌘↩: writes the field as typed ('' → null), closes
  clearLocation(): void;                     // Clear: location null, closes
  setLocationText(text: string): void;       // the open section's field (the location is untouched until Done / ✓ / a switch)
  setLocation(text: string | null): void;    // instant, no section (reconciler); "" → null; the icon switches to the filled pin when non-null
  typeLocation(text: string, cps?: number): Promise<void>;   // opens the Location section, types into the field, then Done
  locationDraft(): LocationDraft | null;     // read-only access to the open section's draft (null otherwise)
  // PointerTarget adds 'locationClear' | 'locationCancel' (the section's footer; 'locationField' / 'locationDone' as in the contract)
  export interface CursorLike { moveTo(point: ScenePoint, opts?: { durationMs?: number }): Promise<void>; click(): Promise<void>; cancel(): void }
  // RecreationProps.cursor is RefObject<CursorLike | null> (structural subset of desktop's FakeCursorHandle)
  export const Recreation: ForwardRefExoticComponent<RecreationProps & RefAttributes<RecreationHandle>>;
  export const DEFAULT_TYPING_CPS: 18;                          // landing spec §7 (02)
  export const TARGET_ACTIONS: (h: RecreationHandle, target: PointerTarget) => (() => void) | null;
  // index.ts re-exports: Recreation, RecreationHandle, RecreationProps, RecreationState, SavedReminder, ShowSource, PointerTarget,
  // ScenePoint, CursorLike, DEFAULT_TYPING_CPS, ListId, FAKE_LISTS, DatePreset, DATE_PRESETS, NotchSection, isSchedule, LocationDraft, NotchPhase, NotchMachineSnapshot,
  // Clock, AppClock, Calendar, currentCalendar, SuggestionDateFormatter, resolve helpers the page needs: NaturalDateParser, ScheduleDefaults, DatePresets
  ```

Rules:
- Root `<div data-qr-root>` absolutely placed with its canvas' top centre on `notchOrigin`: `left: px(notchOrigin.x − canvas.width / 2)`
  (756 − 324 = 432), `top: px(notchOrigin.y)`, `pointer-events: none`; `onKeyDown = useRecreationKeys(shortcutsEnabled)`; the focus
  registry's root. Defaults: `clock = AppClock.now`, `calendar = currentCalendar()`, `locale = 'en-US'`, `dockHeight = 0`,
  `reduceMotion = useReducedMotion(props.reduceMotion)`, time scale `motionTimeScale()` read once. Props read through refs so the core is created once.
- Every method calls the controller with origin `'api'`. `show({ source = 'api', focus })`: focus defaults to `source === 'click' || source === 'hotkey'`.
- Typing (`typeTitle`, `typeScheduleText`, `typeLocation`): characters by code point (`Array.from`), one every `1000 / cps × timeScale` ms, the first after one
  interval; `typeTitle` clears the title first unless `append`; `typeScheduleText` opens the section first when it is closed; `typeLocation` opens the Location
  section first when it is not shown (`openLocation`), types through `setLocationText` (the field; `location` is untouched meanwhile), then `commitLocation` (Done). Each run owns an `AbortController`; `cancel()` aborts all runs (their Promises reject with
  `new DOMException('Aborted', 'AbortError')`) and calls `cursor.current?.cancel()`.
- `pointFor(target)`: `'notch'` → `{ x: notchOrigin.x, y: notchOrigin.y + 39 / 2 }`; else the element `[data-qr-target="<target>"]` inside the root (null when
  absent); scale = canvas client width / canvas width in points (fallback `sceneScale`); point = notchOrigin + (element centre − canvas top centre) / scale.
- `pointerTo(target, { duration, click })`: no point → false; `cursor.moveTo(point, { durationMs: duration })`; with `click`: `cursor.click()` then
  `TARGET_ACTIONS(handle, target)?.()`; true. `TARGET_ACTIONS`: notch → `show({ source: 'api' })`; close → `hide`; header → `openListPicker`/`closeListPicker` toggle;
  suggestionChip → `applySuggestion`; suggestionDismiss → `dismissSuggestion`; dateChip → `openSchedule`; calendarIcon → `openSchedule` or `cancelSchedule`;
  locationIcon → `toggleLocation`; flagIcon → `toggleFlag`; save → `save`; `list:<id>` → `setList(id)`; locationDone → `commitLocation`; locationCancel → `cancelLocation`;
  locationClear → `clearLocation`;
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
    expect(h.getState()).toMatchObject({ title: 'Call mum', listId: 'work', accent: '#BF5AF2', flagged: true, location: 'Office', section: 'none', locationField: null, dirty: false });
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
  test('Location through the handle: typeLocation opens the section, types into the field, then Done', async () => {
    const { ref, container } = mount();
    const h = ref.current!;
    h.show(); await adv(500);
    const typing = h.typeLocation('Office');
    expect(h.getState().section).toBe('location');
    await adv(Math.ceil(3 * 1000 / 18));
    expect(h.getState()).toMatchObject({ locationField: 'Off', location: null });
    await adv(Math.ceil(3 * 1000 / 18) + 1); await typing;
    expect(h.getState()).toMatchObject({ section: 'none', location: 'Office', locationField: null, dirty: false });
    h.openLocation(); h.setLocationText('Home');
    expect(h.locationDraft()!.saveDecision).toEqual({ type: 'applyThenSave', text: 'Home' });
    expect(h.escape()).toBe('section');
    expect(h.getState().location).toBe('Office');
    h.toggleLocation();
    expect(container.querySelector('[data-qr-target="locationDone"]')).not.toBeNull();
    h.clearLocation();
    expect(h.getState()).toMatchObject({ section: 'none', location: null });
  });
  test('Set Date through the handle', async () => {
    const { ref } = mount();
    const h = ref.current!;
    h.show(); await adv(500);
    h.openSchedule();
    expect(h.scheduleDraft()!.draft).toEqual(new Date('2026-09-19T07:00:00Z'));
    h.openCalendar();
    expect(h.getState().section).toBe('calendar');
    h.pickDay(new Date('2026-09-24T22:00:00Z')); h.setTime(15);
    expect(h.commitSchedule()).toBe(true);
    expect(h.getState()).toMatchObject({ section: 'none', dueDate: new Date('2026-09-25T13:00:00Z') });
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

### Task 44 (B24): Hover swell end to end (90 ms dwell, `spring(0.32, 0.55)`, SPEC §1)

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

- [ ] **Step 4: Review-focus pin R1 — touch pointers never arm the hover dwell.** A tap on a phone fires `pointerenter` with `pointerType: 'touch'` before `pointerdown`; the app has no hover on touch, so the 90 ms dwell must not start (otherwise the swell plays and the open spring starts from 257 × 44). In `NotchContainer` (Task 41 (B21)) the silhouette's and the hit layer's enter / leave handlers call `controller.hover` only when `e.pointerType === 'mouse' || e.pointerType === 'pen'`. Add to `tests/recreation/hover.test.tsx`:
  ```ts
  test('review focus: a touch pointer does not swell; the tap opens from the closed size', async () => {
    const { ref, path } = mount();
    fireEvent.pointerEnter(path, { pointerType: 'touch' });
    await act(async () => { vi.advanceTimersByTime(200); });
    expect(ref.current!.machine()).toMatchObject({ hoverDwellPending: false, hoverSwollen: false });
    expect(path.getAttribute('d')).toBe(CLOSED);
    fireEvent.pointerDown(path, { pointerType: 'touch' });
    await act(async () => { vi.advanceTimersByTime(500); });
    expect(ref.current!.machine().phase).toEqual({ type: 'open' });
  });
  ```
  Run `npx vitest run tests/recreation/hover.test.tsx` → PASS; then `git add src/recreation/ui/NotchContainer.tsx tests/recreation/hover.test.tsx && git commit -m "fix(recreation): touch pointers never arm the hover dwell"`.

---

### Task 45 (B25): Reduced motion audit (`prefers-reduced-motion`, SPEC §1 "Reduce Motion enabled")

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

### Task 46 (B26): Visual review against the Swift metrics (harness + Playwright metrics + 2× shots)

**Files:**
- Create: `recreation-harness.html` (repo root, dev only: not in `build.rollupOptions.input`), `src/recreation/dev/harness.tsx`
- Test: `e2e/recreation-metrics.spec.ts`

**Interfaces:**
- Consumes: `Recreation`, `RecreationHandle` (B23); Playwright config from area A (Tasks 1–21) (dev server `baseURL`).
- Produces: `recreation-harness.html?state=<plain|typed|suggestion|applied|flag|section|calendar|saving|hover|lists|location>&list=<ListId>&now=<ISO>`
  renders one `Recreation` at `--pt: 1` on a 1512 × 982 mid-grey (`#808080`) scene, drives it to the state through the handle (`source: 'scroll'`; `location` = `openLocation()`, the in-notch section),
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
  | lists | `[data-qr-popover=lists]` | left 63, top 91 | §11.4 anchor |
  | location | path bbox / `[data-qr-location-field]` / `[data-qr-footer]` | h 347 / 63, 241, 522, 36 / y 291, h 36 | `LocationMetrics` (Task 16 (A16)): 241 + 36 + 14, + 36 + 20 = 347 |
  | location | `[data-sf="location@12"]` ink | ≈ 11.92 × 11.50 | re-measure the SF `location` at 12 pt medium and correct Task 23 (B3) if it differs |
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

### Task 47 (C1): Page dependencies, GSAP module, motion debug flag, test fakes

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
  `npm i -D @testing-library/dom@10.4.0 @axe-core/playwright@4.10.1 lighthouse@12.3.0` (exact versions; `.npmrc` has `save-exact`).
  `gsap 3.15.0`, `@phosphor-icons/react 2.1.10`, `@fontsource/fragment-mono 5.3.0`, `@testing-library/react 16.3.3` and `jsdom 29.1.1` are already
  pinned by Task 1 (A1) and are not reinstalled.
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

### Task 48 (C2): Scene constants and the desktop keyboard router

**Files:**
- Modify: `src/recreation/index.ts` (only missing re-exports, step 1; when Task 43 (B23) has not landed yet, create the file with these re-exports and B23 extends it)
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
  /** Closest `[data-qr-field]` value (the recreation's focus-registry attribute, Task 29 (B9)), else by name: placeholder/aria-label "New Reminder" → title, "Notes" → notes,
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
  `section 'none'`, empty draft, `listId 'reminders'`, `suggestion null`, …) merged with `patch`; `OPEN = { phase: { type: 'open' } }`.
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
    it('↩ in the time field → applyTypedTime', () => expect(shortcutFor(key('Enter'), { state: st({ ...OPEN, section: 'controls' }), focus: 'timeField' })).toEqual({ type: 'applyTypedTime' }));
    it('↩ in the location field → null (Done belongs to the field)', () => expect(shortcutFor(key('Enter'), { state: st({ ...OPEN, section: 'location' }), focus: 'locationField' })).toBeNull());
    it('↩ without a focused field → null', () => expect(shortcutFor(key('Enter'), { state: st(OPEN), focus: 'none' })).toBeNull());
    it('Tab in the title with a live suggestion → tab', () => expect(shortcutFor(key('Tab'), { state: st({ ...OPEN, suggestion: SUGGESTION }), focus: 'title' })).toEqual({ type: 'tab' }));
    it('Tab without a suggestion → null', () => expect(shortcutFor(key('Tab'), { state: st(OPEN), focus: 'title' })).toBeNull());
    it('⇧Tab → null', () => expect(shortcutFor(key('Tab', { shiftKey: true }), { state: st({ ...OPEN, suggestion: SUGGESTION }), focus: 'title' })).toBeNull());
    it('⌘D opens Set Date only while open and Set Date is not shown (from Location it switches over)', () => {
      expect(shortcutFor(key('d', { metaKey: true }), { state: st(OPEN), focus: 'title' })).toEqual({ type: 'openSchedule' });
      expect(shortcutFor(key('d', { metaKey: true }), { state: st({ ...OPEN, section: 'location' }), focus: 'locationField' })).toEqual({ type: 'openSchedule' });
      expect(shortcutFor(key('d', { metaKey: true }), { state: st({ ...OPEN, section: 'controls' }), focus: 'title' })).toBeNull();
      expect(shortcutFor(key('d', { metaKey: true }), { state: st({}), focus: 'none' })).toBeNull();
    });
    it('⌘K toggles the calendar only with Set Date open', () => {
      expect(shortcutFor(key('k', { metaKey: true }), { state: st({ ...OPEN, section: 'location' }), focus: 'locationField' })).toBeNull();
      expect(shortcutFor(key('k', { metaKey: true }), { state: st({ ...OPEN, section: 'controls' }), focus: 'scheduleField' })).toEqual({ type: 'toggleCalendar' });
      expect(shortcutFor(key('k', { metaKey: true }), { state: st(OPEN), focus: 'title' })).toBeNull();
    });
    it('⌘1…⌘6 by code map to DATE_PRESETS order, section open only', () => {
      DATE_PRESETS.forEach((preset, i) =>
        expect(shortcutFor({ key: '+ěščř'[i] ?? 'ž', code: `Digit${i + 1}`, metaKey: true, shiftKey: false, altKey: false, ctrlKey: false },
          { state: st({ ...OPEN, section: 'controls' }), focus: 'scheduleField' })).toEqual({ type: 'preset', preset }));
      expect(shortcutFor(key('1', { metaKey: true }), { state: st(OPEN), focus: 'title' })).toBeNull();
    });
    it('↑/↓ in the time field → stepTime ±1', () => {
      const s = st({ ...OPEN, section: 'controls' });
      expect(shortcutFor(key('ArrowUp'), { state: s, focus: 'timeField' })).toEqual({ type: 'stepTime', steps: 1 });
      expect(shortcutFor(key('ArrowDown'), { state: s, focus: 'timeField' })).toEqual({ type: 'stepTime', steps: -1 });
    });
    it('arrows in the calendar → moveDay −1 / +1 / −7 / +7', () => {
      const s = st({ ...OPEN, section: 'calendar' });
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
    it('reads data-qr-field', () => { const el = document.createElement('input'); el.dataset.qrField = 'timeField'; expect(focusTargetOf(el)).toBe('timeField'); });
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

### Task 49 (C3): Fake cursor

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

### Task 50 (C4): Wallpaper (original CSS mesh, light and dark) and media-query hook

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

### Task 51 (C5): Menu bar with the notch cut-out, app menu-bar icon and menu, real clock

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

### Task 52 (C6): Notch hint

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

### Task 53 (C7): Fake Reminders window

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

### Task 54 (C8): DesktopScene (assembly, focus handling, keyboard routing, click outside)

**Files:**
- Create: `src/desktop/DesktopScene.tsx`
- Create: `tests/fakes/fakeRecreationHandle.ts`, `tests/fakes/recreationMock.tsx`
- Test: `tests/desktop/desktopScene.test.tsx`

**Interfaces:**
- Consumes: `Recreation`, `RecreationProps`, `RecreationHandle`, `RecreationState`, `SavedReminder`, `Clock`,
  `Calendar` (recreation index, contracts §3); C2 `SCENE`, `ptCss`, `shortcutFor`, `focusTargetOf`, `performShortcut`;
  C3 `FakeCursor`, `FakeCursorHandle`; C4 `Wallpaper`, `useColorScheme`, `useMediaQuery`; C5 `MenuBar`; C6 `NotchHint`;
  C7 `RemindersWindow`. Area B: `pointFor()` (Task 43 (B23)) divides by the canvas' own `getBoundingClientRect()` scale, so it stays exact under
  the Stage's CSS transform; `RecreationProps.cursor` is typed `RefObject<CursorLike | null>`, a structural subset of `FakeCursorHandle` (C3).
- Produces:
  ```ts
  // src/desktop/DesktopScene.tsx  (contracts §4.1 + cross-area note 4)
  export { SCENE } from './scene';
  export interface DesktopSceneProps { recreationRef: RefObject<RecreationHandle | null>; cursorRef?: RefObject<FakeCursorHandle | null>;
    pt: number; colorScheme?: 'light' | 'dark' | 'auto'; clock?: Clock; calendar?: Calendar; locale?: string; reduceMotion?: boolean;
    hintEnabled?: boolean; onSaved?(item: SavedReminder): void; className?: string; timeScale?: number }
  export function DesktopScene(props: DesktopSceneProps): JSX.Element;
  // root attributes other parts and e2e rely on:
  //   role="application" aria-label="QuickReminder demo desktop" tabIndex={-1} data-qr-screen   (B21 scopes "click outside" to this element)
  //   data-phase={state.phase.type} data-section={state.section} data-scheme={scheme}
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
  `phase { type: 'closed', parked: false }`, `section 'none'`, `contentVisible false`, `settled false`, `hoverSwollen false`,
  `badgeShown false`, `title ''`, `notes ''`, `listId 'reminders'`, `flagged false`, `location null`, `dueDate null`,
  `presetPick null`, `suggestion null`, `dismissedSuggestionText null`, `listPickerOpen false`, `locationField null`,
  `saveError null`, `savedItems []`, `dirty false`, `openedOnce false`, `canSave false`, `accent '#0A84FF'`, `schedulingInNotch false`,
  `locationInNotch false`, `sectionOpen false` (A-D5, B-D3).
  Every method records `{ method, args }` (not `getState`, `subscribe`, `machine`, `scheduleDraft`, `pointFor`), recomputes
  `canSave` / `accent` (list colours of contracts §2.12) / `schedulingInNotch` / `locationInNotch` / `sectionOpen` and notifies subscribers. Behaviour:
  `show` (from closed/closing: resets title, notes, flagged, location, dueDate, presetPick, suggestion, section, list picker, Location field; keeps listId;
  phase open; openedOnce true) resolves after 500 ms; `hide` → closed, 360 ms; `save` → null when `!canSave`; when
  `section !== 'none'` → commits it (Location: `location` = `locationField || null`), section 'none', resolves null; else phase saving, appends a `SavedReminder`
  (`id 'saved-<n>'`, `notes` = location ? `📍 ${location}` (prefixed by notes + `\n` when notes non-empty) : notes || null,
  `listColor`, `dueLabel null`, `savedAt` = opts.now) at 320 ms, phase closed at 1680 ms (0.32 + 1.0 + 0.36), resolves the item;
  `typeTitle(text, cps = 18)` sets the title after `text.length / cps × 1000` ms; `applySuggestion()` strips a trailing
  `' tomorrow at 2pm'` and sets `dueDate = phraseDate` → true, else false; `typeLocation(text, cps = 18)` opens the Location section
  (`section 'location'`, `locationField ''`), after `text.length / cps × 1000` ms sets `location`, then section 'none', `locationField null` (Done);
  `openLocation` / `toggleLocation` → 'location' (open only) or back to 'none', `setLocationText` → `locationField`, `commitLocation` → `location` = `locationField || null`
  and 'none', `cancelLocation` → 'none', `clearLocation` → `location null` and 'none', `locationDraft()` → null (not recorded); `pointerTo` / `setPointer` resolve after 300 ms → true;
  `openSchedule` → 'controls' (open only), `openCalendar` → 'calendar', `closeCalendar` → 'controls', `toggleCalendar`,
  `cancelSchedule` → 'none'; `escape()` layered list picker → calendar → section (Set Date controls or Location, nothing written) → panel (→ hide), the code's order (Task 29 (B9) B-D2); `setList`, `setFlag`, `toggleFlag`,
  `setLocation('' → null)`, `setTitle`, `setNotes`, `setDueDate`; `markClean` → dirty false; `cancel()` rejects every pending
  delay with `new DOMException('Aborted', 'AbortError')`; `reset`; `machine()` returns `{ phase, section, … }` with zeros.
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
    expect(root.tabIndex).toBe(-1); expect(root.hasAttribute('data-qr-screen')).toBe(true);
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
  it('mirrors phase and section on the root', async () => { /* show → data-phase="open"; openSchedule → data-section="controls" */ });
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
  `sceneScale: pt`, `notchOrigin: SCENE.notchOrigin`, `onSaved`, `onStateChange` (stores only `phase.type`, `section`,
  `openedOnce`, `savedItems` in React state; sets them only when they change). Behaviour:
  - `onPointerDownCapture`: when the target is not inside a focusable element in the scene, `root.focus({ preventScroll: true })`.
    Click outside is **not** handled here: `NotchContainer` (Task 41 (B21)) owns it with the silhouette hit-test (a press on the transparent
    canvas outside the black shape closes, like `passesMouseThrough`), scoped to the closest `[data-qr-screen]` ancestor, which is this root
    (clicks on the page around the desktop are not "the screen" and do nothing).
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

### Task 55 (C9): MacBook frame (CSS/SVG)

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

### Task 56 (C10): Stage camera (pure)

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

### Task 57 (C11): Stage (sticky track, GSAP scrub camera, hero title, phone layout, reduced motion)

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

- [ ] **Step 6: Review-focus pin R3 — crossing the 810 px breakpoint while pinned.** A visitor who narrows the window (or rotates a tablet) crosses `CAMERA.phoneBreakpoint` with the stage pinned; nothing in the spec's tests exercises a live crossing. Rule: when the `(min-width: 810px)` media query flips, the Stage kills its scrubbed ScrollTrigger (desktop → phone) or creates it (phone → desktop), recomputes `renderPt` / `--pt` from the new viewport, resets `[data-camera].style.transform` to `''` for the phone block and calls `ScrollTrigger.refresh()` so the pin spacer is dropped; a second kill of an already-killed trigger is never attempted. Add to `tests/app/stage.test.tsx`:
  ```ts
  it('review focus: resizing across 810 px swaps layouts, recomputes --pt and refreshes the triggers', () => {
    /* mount with installMatchMedia({ '(min-width: 810px)': true }) at innerSize(1440, 900) → ScrollTrigger.create called once;
       mm.set('(min-width: 810px)', false); innerSize(800, 900); window.dispatchEvent(new Event('resize')); run rAF →
       the trigger's kill called exactly once, ScrollTrigger.refresh called, [data-stage].style.position !== 'sticky',
       [data-stage].style.height === `${phoneStageHeight(800)}px`, application root --pt === String(renderPtFor({ width: 800, height: 900 }, 800));
       mm.set(…, true); innerSize(1440, 900); resize → ScrollTrigger.create called a second time, kill still once */
  });
  ```
  Run `npx vitest run tests/app/stage.test.tsx` → PASS; then `git add src/app/Stage.tsx tests/app/stage.test.tsx && git commit -m "fix(page): swap stage layouts and refresh triggers when crossing 810 px"`.

---

### Task 58 (C12): Scroll progress bar and floating nav

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

### Task 59 (C13): Section snapshots and the demo reminder

**Files:**
- Create: `src/app/choreography/snapshot.ts`, `src/app/choreography/demo.ts`
- Test: `tests/app/choreography/snapshot.test.ts`

**Interfaces:**
- Consumes: `NaturalDateParser.parse` (contracts §2.2), `ScheduleDefaults.resolveDayOnly` (§2.3), `DatePresets.date` (§2.4),
  `Calendar`, `PresetPick`, `DatePreset`, `ListId`, `NotchSection` (core/machine); `pragueCalendar`, `prague` (tests/support.ts).
- Produces (contracts §4.4 with A-D5: `SectionSnapshot.section: NotchSection` for `schedule`): `SectionId`, `SectionAction`, `DueSpec`, `SectionSnapshot`, `resolveDue` in `snapshot.ts`;
  `DEMO_REMINDER`, `SECTION_SNAPSHOTS` in `demo.ts`; plus
  ```ts
  export const SECTION_ORDER: readonly SectionId[];          // ['hero', '01', '02', '03', '04', '05', '06', '07']
  export function previousSection(id: SectionId): SectionId; // '01' → 'hero'; 'hero' → 'hero'
  ```
  `SECTION_SNAPSHOTS` (landing §7, §11.2; `PHRASE = { type: 'phrase', text: 'tomorrow at 2pm' }`; unlisted fields: `section 'none'`,
  `notes ''`, `listId 'reminders'`, `flagged false`, `location null`, `due null`, `saved false`):

  | id | panel | section | title | listId | flagged | location | due | saved | action | extras |
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
    expect(SECTION_SNAPSHOTS.hero).toEqual({ id: 'hero', panel: 'closed', section: 'none', title: '', notes: '', listId: 'reminders', flagged: false, location: null, due: null, saved: false, action: 'close' });
    expect(SECTION_SNAPSHOTS['02']).toEqual({ id: '02', panel: 'open', section: 'none', title: 'Call mum', typedTitle: 'Call mum tomorrow at 2pm', notes: '', listId: 'reminders', flagged: false, location: null, due: { type: 'phrase', text: 'tomorrow at 2pm' }, saved: false, action: 'typeTitle', applyDelayMs: 900 });
    expect(SECTION_SNAPSHOTS['03']).toMatchObject({ section: 'calendar', action: 'schedule', highlightPreset: 'tomorrow' });
    expect(SECTION_SNAPSHOTS['04']).toMatchObject({ listId: 'work', action: 'lists', listCycle: ['reminders', 'work', 'home', 'work'] });
    expect(SECTION_SNAPSHOTS['05']).toMatchObject({ section: 'none', listId: 'work', flagged: true, location: 'Office', action: 'flagLocation' });   // the Location section is opened, typed into and closed by Done inside the action
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

### Task 60 (C14): Reconciler

**Files:**
- Create: `src/app/choreography/reconcile.ts`
- Test: `tests/app/choreography/reconcile.test.ts`

**Interfaces:**
- Consumes: C13 everything; C1 `scaleMs`; `isSameMinute` (contracts §2.1); `RecreationHandle`, `RecreationState`, `PointerTarget`
  (contracts §3.2); `FakeCursorHandle` (C3); `FakeRecreationHandle` (C8, tests).
- Produces (contracts §4.4, exact): `ReconcileOptions`, `ReconcileResult`, `reconcile`; plus
  ```ts
  export const RECONCILE_TIMING: { readonly scheduleRowsMs: 420 /* 0.06 + 3 · 0.035 + 0.24 s stagger, contracts §7 */;
    readonly presetHoverMs: 450; readonly listOpenMs: 220; readonly listStepMs: 380; readonly flagToLocationMs: 300;
    readonly locationFieldMs: 300 /* 0.06 + 0 · 0.035 + 0.24 s: the Location field row's stagger (NotchButtonStyles.swift View.staggered(0)) */ };
  ```
  Rules (landing §11.2; the tests pin them; `visible` = phase open or saving; `keep` = `getState().dirty` at start;
  `instant` = `opts.cps === Infinity`: no cursor, no sleeps, `setTitle` instead of `typeTitle`, `setLocation` instead of `typeLocation`;
  every sleep is `scaleMs(ms)` and rejects on `opts.signal`; `opts.signal` abort → `handle.cancel()` and `opts.cursor?.cancel()`;
  any `AbortError` → `{ performed, keptVisitorEdits: keep, aborted: true }`; `show` always gets `{ source: 'scroll' }`):
  1. `direction 'up'`: action `close` with `visible && !keep` → `await hide()`, performed `close`; anything else → performed `none`, no calls.
  2. action `none` → performed `none`, no calls.
  3. Panel: snapshot `open` (or action `save`) and not visible → `await show({ source: 'scroll' })`, then `markClean()` and `keep = false`
     (show resets the draft). Action `close`: `visible && !keep` → `await hide()`, done. Snapshot `closed`, action ≠ save, visible → `void hide()`.
  4. Close `listPicker` unless action `lists`; `section === 'location'` → `cancelLocation()` (nothing written; `flagLocation` opens it again itself); `isSchedule(section)` and action ≠ `schedule` → `cancelSchedule()`.
  5. Unless `keep`, write fields that differ, in this order: `setList(action === 'lists' ? listCycle[0] : listId)`;
     `setFlag(action === 'flagLocation' ? false : flagged)`; `setLocation(action === 'flagLocation' ? null : location)`; `setNotes(notes)`;
     title + due: action `typeTitle` → `setDueDate(null)`, `setTitle('')`; else `setTitle(title)` and `resolveDue(due)` →
     `setDueDate(date, presetPick)` unless `isSameMinute(calendar, current, date)` (null vs null equal). Then `markClean()` (only when not `keep`).
  6. Action: `open` → nothing more. `typeTitle` → keep: none; else `await typeTitle(typedTitle, cps)`, sleep `applyDelayMs`, `applySuggestion()`, `markClean()`.
     `schedule` → `openSchedule()`, sleep 420, cursor: `await pointerTo('preset:' + highlightPreset)`, sleep 450, `openCalendar()`.
     `lists` → keep: none; else for each id of `listCycle.slice(1)`: cursor `await pointerTo('header', { click: true })`, `openListPicker()`, sleep 220,
     cursor `await pointerTo('list:' + id, { click: true })`, `setList(id)`, sleep 380; then `markClean()`.
     `flagLocation` → keep: none; else cursor `pointerTo('flagIcon', { click: true })`, `setFlag(true)`, sleep 300, cursor `pointerTo('locationIcon', { click: true })`
     (its click is `toggleLocation`: the panel grows into the in-notch Location section, 347 pt), sleep `locationFieldMs` 300, `await typeLocation(location, cps)`
     (opens the section when the cursor did not, types "Office" into the field at `cps`, then Done: the section closes and the pin fills), `markClean()`. `save` → `!canSave` → none; else cursor `pointerTo('save', { click: true })`, `await save()`.
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
    const h = new FakeRecreationHandle({ state: { phase: { type: 'open' }, section: 'calendar', title: 'Call mum', dueDate: PHRASE_DATE } });
    await run(reconcile(h, SECTION_SNAPSHOTS['04'], opts()));
    expect(h.methods()).toEqual(['cancelSchedule', 'markClean', 'openListPicker', 'setList', 'openListPicker', 'setList', 'openListPicker', 'setList', 'markClean']);
    expect(h.calls.filter(c => c.method === 'setList').map(c => c.args[0])).toEqual(['work', 'home', 'work']);
  });
  it('a Location section left open is closed without writing before 04 cycles the lists', async () => {
    const h = new FakeRecreationHandle({ state: { phase: { type: 'open' }, section: 'location', locationField: 'Home', title: 'Call mum', dueDate: PHRASE_DATE } });
    await run(reconcile(h, SECTION_SNAPSHOTS['04'], opts()));
    expect(h.methods()[0]).toBe('cancelLocation');
    expect(h.getState()).toMatchObject({ section: 'none', location: null, locationField: null });
  });
  it('05 flags, then opens the Location section, types Office and presses Done', async () => {
    const h = new FakeRecreationHandle({ state: { phase: { type: 'open' }, title: 'Call mum', listId: 'work', dueDate: PHRASE_DATE } });
    await run(reconcile(h, SECTION_SNAPSHOTS['05'], opts()));
    expect(h.methods()).toEqual(['markClean', 'setFlag', 'typeLocation', 'markClean']); expect(h.calls[2].args).toEqual(['Office', 18]);
    expect(h.getState()).toMatchObject({ flagged: true, location: 'Office', section: 'none', locationField: null });
  });
  it('up into the hero closes a clean panel', async () => { const h = new FakeRecreationHandle({ state: { phase: { type: 'open' } } }); const r = await run(reconcile(h, SECTION_SNAPSHOTS.hero, opts({ direction: 'up' }))); expect(h.methods()).toEqual(['hide']); expect(r.performed).toBe('close'); });
  it('up into the hero keeps a dirty panel open', async () => { const h = new FakeRecreationHandle({ state: { phase: { type: 'open' }, dirty: true } }); expect((await run(reconcile(h, SECTION_SNAPSHOTS.hero, opts({ direction: 'up' })))).performed).toBe('none'); expect(h.methods()).toEqual([]); });
  it('up into any other section leaves content alone', async () => { const h = new FakeRecreationHandle({ state: { phase: { type: 'open' }, section: 'calendar' } }); await run(reconcile(h, SECTION_SNAPSHOTS['03'], opts({ direction: 'up' }))); expect(h.methods()).toEqual([]); });
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

### Task 61 (C15): Section driver (throttled queue + ScrollTrigger hook)

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

- [ ] **Step 7: Review-focus pin R4 — a run aborted while the tab was hidden is replayed on return.** Background tabs throttle timers to ≥ 1 s, so a `typeTitle` run (24 characters at 18 cps = 1.33 s) started just before the visitor switches tabs overruns `MAX_ACTION_MS` when another section is pending and is aborted, leaving "Call mum tomo" with no chip when they come back. Rule: `SectionQueue` gains `pause()` / `resume()` (the deadline timer is cleared on pause and re-armed with the remaining time on resume) and `lastResult: ReconcileResult | null`; the hook listens to `document` `visibilitychange`: `hidden` → `queue.pause()`; `visible` → `queue.resume()`, and when `lastResult?.aborted` is true it reconciles `current` again with `{ cps: Infinity, cursor: null, direction: 'down' }` (the instant path, same as reduced motion). Add to `tests/app/choreography/sectionQueue.test.ts`:
  ```ts
  it('pause stops the deadline clock; resume re-arms it with the remaining time', async () => { /* 02 takes 10000 ms; enqueue 03 at 500 ms; pause at 1500 ms; advance 5000 → not aborted; resume → aborted 1000 ms later (2500 − 1500) */ });
  ```
  and to `tests/app/choreography/useSectionDriver.test.tsx`:
  ```ts
  it('review focus: a hidden tab pauses the deadline and an aborted section is replayed instantly on return', async () => {
    /* reconcile mock resolves { performed: 'typeTitle', keptVisitorEdits: false, aborted: true }; onEnter 02;
       Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange'));
       advance 5000 ms → onAbort not called; set 'visible' + visibilitychange → reconcile called again with (handle, SECTION_SNAPSHOTS['02'],
       objectContaining({ cps: Infinity, cursor: null, direction: 'down' })) */
  });
  ```
  Run `npx vitest run tests/app/choreography` → PASS; then `git add src/app/choreography/useSectionDriver.ts tests/app/choreography/sectionQueue.test.ts tests/app/choreography/useSectionDriver.test.tsx && git commit -m "fix(choreography): pause the deadline in hidden tabs and replay aborted sections"`.

---

### Task 62 (C16): Section copy, FeatureSection, Features column (01–06)

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
  | 05 | Flag & location | Flag it, pin it. | The flag marks what matters. The pin grows the panel into a Location field, right below the bar, like Set Date. Type a place and press Return: it is saved in the notes as “📍 Office”, so you see it wherever the reminder shows up. | Flag · A flagged reminder is saved with high priority / MapPin · The place is a line of text in the notes. Nothing tracks your location / ArrowsLeftRight · Switch between Location and Set Date and what you typed stays |
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
  it('typography: label 14/500 muted, headline 24/600, paragraph 18/500, bullets 16/500', () => {
    /* for '(02) Dates /': label element style fontSize 'var(--jh-text-label)', fontWeight '500', color 'var(--jh-muted)';
       h2 'Say when.' fontSize 'var(--jh-text-h3)', fontWeight '600', lineHeight 'var(--jh-leading-heading)', color 'var(--jh-fg)';
       paragraph (the <p> after the h2) fontSize 'var(--jh-text-body-l)', fontWeight '500', lineHeight 'var(--jh-leading-body)';
       first bullet text span fontSize 'var(--jh-text-body)', fontWeight '500' */
  });
  it('registers 01…06 with the driver (one ScrollTrigger each)', () => { /* ScrollTrigger.create called 6 times; triggers are the six sections in order */ });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/app/sections/features.test.tsx` — expected FAIL.
- [ ] **Step 3: Implement.** The typography values below are written as inline `style` properties (jsdom reads them; the typography test pins them). FeatureSection markup: `<section id="feature-0n" aria-labelledby="feature-0n-title">`,
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

### Task 63 (C17): Integrations (07) with the terminal card

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

### Task 64 (C18): Download section and app-icon assets

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

### Task 65 (C19): Footer with the trademark disclaimer

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

### Task 66 (C20): App assembly, entry and document metadata

**Files:**
- Modify: `src/App.tsx`, `src/main.tsx`, `index.html`, `src/index.css`, `e2e/boot.spec.ts` (Task 1's placeholder assertions)
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
  `main.tsx` calls `applyGsapTimeScale()` before render and keeps area A (Tasks 1–21)'s imports; `index.html` gets the tags above plus
  `og:title` (= the `<title>` text), `og:description` (= description), `og:type website`, `og:image https://quickreminder.jholec.com/app-icon-512.png`,
  `<link rel="icon" sizes="64x64" href="/favicon-64.png">`; no analytics script (landing §2 non-goals). `index.css` adds:
  `html { scroll-behavior: smooth }` inside `@media (prefers-reduced-motion: no-preference)`; `body { overflow-x: clip; background: var(--jh-white); }`;
  `:focus-visible { outline: 2px solid var(--jh-fg); outline-offset: 2px }`; `[data-section="dark"] :focus-visible { outline-color: var(--jh-white) }`.
- [ ] **Step 3b: Update `e2e/boot.spec.ts`** (Task 1 asserted the placeholder h1 "QuickReminder" and the title "QuickReminder — a reminder, straight out of the notch", both replaced here): `toHaveTitle('QuickReminder · A reminder, straight out of the notch')` and `getByRole('heading', { level: 1, name: 'A reminder, straight out of the notch.' })` visible. Run `npx playwright test e2e/boot.spec.ts` — expected PASS on chromium and webkit.
- [ ] **Step 4: Run** `npx vitest run tests/app/app.test.tsx` — expected PASS; then `npm test` — expected PASS (whole suite) and `npm run build` — expected exit 0.
- [ ] **Step 5: Smoke by hand (asserted for real by Tasks 68 and 69).** `npm run dev`, open `http://localhost:5173/?now=2026-10-23T10:00`: the hero fills the viewport, the notch
  opens on click, scrolling shrinks to the MacBook with the title, then pins it on the left while (01)…(06) play.
- [ ] **Step 6: Commit.** `git add src/App.tsx src/main.tsx index.html src/index.css e2e/boot.spec.ts tests/app/app.test.tsx && git commit -m "feat(page): assemble the landing page"`

---

### Task 67 (C21): Accessibility and contrast

**Files:**
- Create: `tests/app/contrast.test.ts`, `e2e/a11y.spec.ts`
- Modify: `playwright.config.ts` (create if area A (Tasks 1–21) did not)

**Interfaces:**
- Consumes: `AccentContrast.contrastRatio`, `AccentContrast.relativeLuminance`, `hexToRgb` (contracts §2.9); C4 `WALLPAPER` colours;
  C6 hint colours; Playwright, `@axe-core/playwright`.
- Produces: `playwright.config.ts` with projects `chromium` (Desktop Chrome, 1440 × 900) and `webkit` (Desktop Safari, 1440 × 900),
  `use: { baseURL: 'http://localhost:4173', timezoneId: 'Europe/Prague', locale: 'en-US' }`,
  `webServer: { command: 'npm run build && npx vite preview --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI, timeout: 120_000 }`,
  `testDir: 'e2e'`; `package.json` script `"e2e": "playwright test"` (keep area A (Tasks 1–21)'s when present).

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

### Task 68 (C22): Playwright smoke suite (landing §9, exactly)

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

### Task 69 (C23): Choreography and responsive e2e

**Files:**
- Create: `e2e/choreography.spec.ts`, `e2e/responsive.spec.ts`

**Interfaces:**
- Consumes: C11 DOM contract (`[data-stage]`, `[data-features-column]`), C16 section ids `#feature-0n`, C8 `data-phase` / `data-section`,
  C7 window region, C13 snapshots (expected end states).
- Produces: e2e coverage of landing §7 (states per section, visitor edits, back to the hero, clickable while pinned) and §7 Mobile (< 810 px).

- [ ] **Step 1: Write** `e2e/choreography.spec.ts` (chromium + webkit; helper `toSection(page, n)` = `page.locator('#feature-' + n).evaluate(el => el.scrollIntoView({ block: 'start' }))`
  then `page.mouse.wheel(0, 1)` so ScrollTrigger sees a scroll; `title = page.getByRole('textbox', { name: 'New Reminder' })`):
  ```ts
  test('(01) opens the panel without taking focus', async ({ page }) => { await toSection(page, '01'); await expect(desktop(page)).toHaveAttribute('data-phase', 'open'); await expect(title).not.toBeFocused(); });
  test('(02) types the demo title and applies the chip', async ({ page }) => { await toSection(page, '02'); await expect(title).toHaveValue('Call mum', { timeout: 6000 }); await expect(page.getByRole('button', { name: 'Change date' })).toContainText(/Tomorrow, 2:00\sPM/); });
  test('(03) grows Set Date and opens the calendar', async ({ page }) => { await toSection(page, '03'); await expect(desktop(page)).toHaveAttribute('data-section', 'calendar', { timeout: 6000 }); });
  test('(04) ends on the Work list', async ({ page }) => { await toSection(page, '04'); await expect(page.getByRole('button', { name: 'Choose list' })).toContainText('Work', { timeout: 6000 }); });
  test('jumping straight to (06) fills the reminder and saves it', async ({ page }) => {
    await page.goto('/?now=2026-10-23T10:00'); await toSection(page, '06');
    const win = page.getByRole('region', { name: 'Your reminders' });
    await expect(win).toContainText('Call mum', { timeout: 8000 }); await expect(win).toContainText(/Tomorrow, 2:00\sPM/); await expect(win).toContainText('📍 Office'); await expect(win.getByLabel('Flagged')).toBeVisible();
  });
  test('visitor edits win: (03) opens Set Date on the visitor title', async ({ page }) => {
    await toSection(page, '01'); await title.click(); await page.keyboard.type('Buy milk');
    await toSection(page, '03'); await expect(desktop(page)).toHaveAttribute('data-section', 'calendar', { timeout: 6000 }); await expect(title).toHaveValue('Buy milk');
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

### Task 70 (C24): Lighthouse budget

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
  initial camera before paint (C11), intrinsic-size lazy app icon (C18), no web fonts in the hero path except area A (Tasks 1–21)'s Inter,
  no analytics. Stop the preview server.
- [ ] **Step 6: Commit.** `git add scripts/assert-lighthouse.mjs package.json tests/app/lighthouse.test.ts && git commit -m "test(perf): add the Lighthouse budget check"`

---

### Task 71 (C25): Vercel config, README, GitHub repo and deploy

**Files:**
- Create: `vercel.json`, `README.md` (replace the template one if area A (Tasks 1–21) created it)
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

---
