# Mobile camera (pinned notch zoom on phones) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On phones (< 810 px) the stage pins as a 56 svh band and the camera zooms from the whole MacBook to the notch, so the recreation is readable and tappable while the copy scrolls underneath.

**Architecture:** Pure camera maths in `src/app/stageCamera.ts` gains phone keyframes (hero → notch, 100 svh runway); `src/app/Stage.tsx` pins the stage on both layouts and moves the phone title inside the band; `useSectionDriver` takes the trigger `start` so phones fire at `top 78%`; the responsive e2e spec pins the new geometry. No change to the recreation or the desktop layout values.

**Tech Stack:** Vite 7, React 18.3, TypeScript 5.9, GSAP ScrollTrigger, Vitest 4 (globals), Playwright (chromium phone emulation).

**Spec:** `docs/superpowers/specs/2026-10-27-quickreminder-landing-design.md` §7 "Mobile" (revised 2026-10-29) and §11.1 "Phones".

## Global Constraints

- Desktop (≥ 810 px) camera values do not change: every existing desktop test in `tests/app/stageCamera.test.ts`, `tests/app/stage.test.tsx`, `tests/app/navAndProgress.test.tsx` keeps passing unchanged.
- Phone constants (spec §7 Mobile, §11.1): band `phoneStageSvh: 56`; `phoneGutterPx: 16`; `phoneTopPx: 64` (nav); `phoneTitleReservePx: 96`; `phoneNotchTopPx: 28`; `phoneNotchBottomAirPx: 16`; `phonePanelWidthPt: 600`; `minPhoneNotchPt: 0.4`; `phoneRunwayVh: 100`; `phoneTitleFadeEnd: 0.5`; `phoneSectionStart: 'top 78%'`. Calendar height is read as `NotchLayout.scheduleCalendarSize.height` (751), never as a literal.
- Phone geometry for `{ width: w, height: h }`, with `SH = 0.56 · h`, `FRAME_HEIGHT = 1070`, `FRAME.deckWidth = 1700`, `FRAME.bezelTop = 18`, `SCENE.notchOrigin.x = 756`:
  - `phoneHeroPt = min((w − 32) / 1700, (SH − 64 − 96) / 1070)`
  - hero keyframe: `s = phoneHeroPt`, `nx = w / 2`, `ny = 64 + ((SH − 64 − 96) − 1070 · s) / 2 + 18 · s`
  - `phoneNotchPt = clamp(min((w − 32) / 600, (SH − 28 − 16) / 751), 0.4, 1)`
  - notch keyframe: `s = phoneNotchPt`, `nx = w / 2`, `ny = 28`
  - `cameraFor(progress)` on phones = `cameraAt(lerpKeyframe(hero, notch, clamp(progress, 0, 1)))`; `clipFor` stays `{ right: 0 }`; `renderPtFor = max(phoneHeroPt, phoneNotchPt)`.
  - Reference values at 390 × 844: `SH = 472.64`, `phoneHeroPt = 0.210588`, hero `ny = 111.446`, hero `translateX = 35.7953` (= 195 − 756 · 0.210588), `phoneNotchPt = 0.570759`, notch `translateX = −236.494` (= 195 − 756 · 0.570759); midway (progress 0.5): `scale 0.390674`, `originY 69.723`, `translateX −100.349`.
  - Reference at 390 × 667: `SH = 373.52`, `phoneHeroPt = 0.199551` (height-bound: 213.52 / 1070), `phoneNotchPt = 0.438775` (= 329.52 / 751).
- Phone title opacity: `phoneTitleOpacityFor(p) = 1 − clamp(p / 0.5, 0, 1)`.
- Phones ≤ 809 px are detected with the existing `DESKTOP_QUERY` / `useIsDesktop()`; nothing new reads `matchMedia`.
- Commit messages: Conventional Commits; trailers `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01AGeEr4goWWYvfK1CfRDGqS`.
- Tests use Vitest globals; `as any` is rejected by lint (use a typed cast). Run `npm test`, `npm run typecheck`, `npm run lint` before the last commit of every task.

## Review Focus

- A very short landscape phone (e.g. 740 × 360): `phoneNotchPt` hits the 0.4 floor and the calendar overflows the band; the band must still clip (overflow hidden) rather than paint over the copy. Pinned in Task 1 (floor test) and Task 2 (overflow hidden).
- Resizing across 810 px while scrolled: the trigger and the runway height change; `ScrollTrigger.refresh()` must run (existing effect) and the camera must be rewritten for the new layout before paint. Pinned in Task 2.
- Reduced motion on phones: the camera snaps at half progress and the title still fades by raw progress. Pinned in Task 2.
- A section whose top never reaches 78 % because the page ends (the last feature on a tall phone): the existing font-ready "reached" pass uses `innerHeight / 2`; Task 3 moves it to the same `start` fraction so the last section is not skipped.
- Tapping the notch while the band is pinned on a phone must open the panel inside the band, not scroll the page. Pinned in Task 4.

---

### Task 1: Phone camera maths

**Files:**
- Modify: `src/app/stageCamera.ts`
- Test: `tests/app/stageCamera.test.ts`

**Interfaces:**
- Consumes: `FRAME` (`./MacBookFrame`), `SCENE` (`../desktop/scene`), `NotchLayout.scheduleCalendarSize.height`.
- Produces (all exported from `src/app/stageCamera.ts`):
  - `CAMERA` gains `phoneStageSvh: 56`, `phoneTitleReservePx: 96`, `phoneNotchTopPx: 28`, `phoneNotchBottomAirPx: 16`, `phonePanelWidthPt: 600`, `minPhoneNotchPt: 0.4`, `phoneRunwayVh: 100`, `phoneTitleFadeEnd: 0.5`, `phoneSectionStart: 'top 78%'`; `phoneBottomPx` is removed (no longer used).
  - `phoneStageHeight(viewport: Viewport): number` → `CAMERA.phoneStageSvh / 100 * viewport.height` (replaces the old `(viewportWidth)` signature).
  - `phoneHeroPt(viewport: Viewport): number`, `phoneNotchPt(viewport: Viewport): number`.
  - `cameraFor`, `renderPtFor`, `clipFor` follow the Global Constraints on phones; desktop unchanged.
  - `phoneTitleOpacityFor(progress: number): number`.
  - `runwayVhFor(viewport: Viewport): number` → `CAMERA.phoneRunwayVh` on phones, `CAMERA.runwayVh` otherwise.

- [ ] **Step 1: Write the failing tests** in `tests/app/stageCamera.test.ts` (replace the two phone tests `'phones ignore progress'` and `'phoneStageHeight'`, keep every desktop test byte-for-byte):

```ts
const V390 = { width: 390, height: 844 };
const V390S = { width: 390, height: 667 };
const V740L = { width: 740, height: 360 };
it('phoneStageHeight is 56 svh', () => expect(phoneStageHeight(V390)).toBeCloseTo(472.64, 6));
it('phoneHeroPt fits the MacBook into the band under the nav and above the title', () => {
  expect(phoneHeroPt(V390)).toBeCloseTo(358 / 1700, 6);
  expect(phoneHeroPt(V390S)).toBeCloseTo((0.56 * 667 - 160) / 1070, 6);
});
it('phoneNotchPt fills the width with the panel, clamped to the calendar and the 0.4 floor', () => {
  expect(phoneNotchPt(V390)).toBeCloseTo((0.56 * 844 - 44) / 751, 6);
  expect(phoneNotchPt(V390S)).toBeCloseTo((0.56 * 667 - 44) / 751, 6);
  expect(phoneNotchPt(V740L)).toBe(0.4);
});
it('390 × 844 hero', () => close(cameraFor(0, V390, 390), { scale: 0.210588, originX: 195, originY: 111.446, translateX: 35.7953, translateY: 111.446 }));
it('390 × 844 midway', () => close(cameraFor(0.5, V390, 390), { scale: 0.390674, originX: 195, originY: 69.723, translateX: -100.349 }));
it('390 × 844 notch: the panel fills the width, notch top at 28 px', () => close(cameraFor(1, V390, 390), { scale: 0.570759, originX: 195, originY: 28, translateX: -236.494, translateY: 28 }));
it('phone progress is clamped and never clips', () => {
  expect(cameraFor(-1, V390, 390)).toEqual(cameraFor(0, V390, 390));
  expect(cameraFor(2, V390, 390)).toEqual(cameraFor(1, V390, 390));
  expect(clipFor(0.5, V390, 390).right).toBe(0);
});
it('renderPtFor on phones is the notch scale', () => expect(renderPtFor(V390, 390)).toBeCloseTo(0.570759, 6));
it('phoneTitleOpacityFor fades over the first half', () => { expect(phoneTitleOpacityFor(0)).toBe(1); expect(phoneTitleOpacityFor(0.25)).toBeCloseTo(0.5, 6); expect(phoneTitleOpacityFor(0.5)).toBe(0); expect(phoneTitleOpacityFor(1)).toBe(0); });
it('runwayVhFor', () => { expect(runwayVhFor(V390)).toBe(100); expect(runwayVhFor(V1440)).toBe(160); });
```

- [ ] **Step 2: Run** `npx vitest run tests/app/stageCamera.test.ts` — expected: FAIL (missing exports).
- [ ] **Step 3: Implement** the Global Constraints geometry in `src/app/stageCamera.ts`: `phoneHeroPt`, `phoneNotchPt`, a `phoneHeroKeyframe` / `phoneNotchKeyframe` pair, the phone branch of `cameraFor` (`lerpKeyframe(hero, notch, clamp(progress, 0, 1))`), `renderPtFor`, `phoneStageHeight(viewport)`, `phoneTitleOpacityFor`, `runwayVhFor`. Update the file's header comment (phones: two keyframes, 100 svh). Keep `heroPt`, `heroScreenRect` and all desktop maths unchanged.
- [ ] **Step 4: Run** `npx vitest run tests/app/stageCamera.test.ts` — expected: PASS. `npx tsc --noEmit -p .` will fail in `Stage.tsx` / `stage.test.tsx` on the changed `phoneStageHeight` signature: fix the call in `src/app/Stage.tsx` minimally (`phoneStageHeight(viewport)`) and in `tests/app/stage.test.tsx`, nothing else (Task 2 rewrites the phone layout).
- [ ] **Step 5: Run** `npm test && npm run typecheck && npm run lint` — expected: all pass.
- [ ] **Step 6: Commit** `feat(stage): phone camera keyframes (hero → notch over 100 svh)`.

### Task 2: Pinned phone stage

**Files:**
- Modify: `src/app/Stage.tsx`
- Test: `tests/app/stage.test.tsx`

**Interfaces:**
- Consumes: Task 1 exports (`phoneStageHeight(viewport)`, `phoneTitleOpacityFor`, `runwayVhFor`, `cameraFor`, `renderPtFor`, `clipFor`).
- Produces: the stage is `position: sticky; top: 0` on both layouts; height `100svh` on desktop, `${CAMERA.phoneStageSvh}svh` on phones; `overflow: hidden`; `zIndex: 20` on phones only (the copy column keeps `zIndex: 10`; on desktop the stage has no z-index, as now). The runway height is `${runwayVhFor(viewport)}svh` with `marginTop: -100svh` on desktop and `-${CAMERA.phoneStageSvh}svh` on phones. One scrubbed ScrollTrigger exists on both layouts (the `if (!isDesktop) return` guards go away; the trigger is recreated when `isDesktop` flips). The hero title block is inside the stage on both layouts (absolute, `bottom: 7svh` desktop / `bottom: 16px` with `padding: 0 var(--jh-page-margin-x)` phones); the former below-stage phone title block is removed; title opacity uses `titleOpacityFor` on desktop and `phoneTitleOpacityFor` on phones, driven per frame. `progressFromScroll` divides by `runwayVhFor(viewport) / 100 * viewport.height`. `DesktopScene` keeps `pt={renderPt}`. Update the header comment (lines 1–4).

- [ ] **Step 1: Write the failing tests** in `tests/app/stage.test.tsx`. Add a `mountPhone()` helper (`installMatchMedia({ [DESKTOP]: false })`, `innerSize(390, 844)`), then:

```ts
it('phones pin a 56svh band above the copy', () => {
  mountPhone();
  const stage = el('[data-stage]');
  expect(stage.style.position).toBe('sticky');
  expect(stage.style.height).toBe('56svh');
  expect(stage.style.zIndex).toBe('20');
  expect(stage.style.overflow).toBe('hidden');
  expect(el('[data-runway]').style.height).toBe('100svh');
  expect(el('[data-runway]').style.marginTop).toBe('-56svh');
  expect(el('[data-features-column]').style.marginLeft).toBe('');
});
it('phones apply the hero camera before paint and keep the title inside the band', () => {
  mountPhone();
  expect(el('[data-camera]').style.transform).toBe(cameraTransform(cameraFor(0, { width: 390, height: 844 }, 390), renderPtFor({ width: 390, height: 844 }, 390)));
  expect(el('[data-stage]').contains(el('[data-hero-title]'))).toBe(true);
  expect(el('[data-hero-title]').style.opacity).toBe('1');
});
it('phones scrub the camera to the notch and fade the title', () => {
  mountPhone();
  expect(ScrollTrigger.create).toHaveBeenCalledTimes(1);
  onUpdate(1);
  expect(el('[data-camera]').style.transform).toBe(cameraTransform(cameraFor(1, { width: 390, height: 844 }, 390), renderPtFor({ width: 390, height: 844 }, 390)));
  expect(el('[data-hero-title]').style.opacity).toBe('0');
  expect(el('[data-clip]').style.clipPath).toBe('inset(0px 0px 0px 0px)');
});
it('reduced motion on phones snaps the camera at half progress but fades the title by raw progress', () => {
  mountPhone(); // with { [REDUCED]: true } passed to installMatchMedia
  onUpdate(0.4);
  expect(el('[data-camera]').style.transform).toBe(cameraTransform(cameraFor(0, { width: 390, height: 844 }, 390), renderPtFor({ width: 390, height: 844 }, 390)));
  expect(el('[data-hero-title]').style.opacity).toBe('0.19999999999999996'); // 1 − 0.4 / 0.5, as String(number)
});
it('crossing 810 px re-creates the trigger and refreshes ScrollTrigger', () => {
  const mm = mountDesktop();
  act(() => mm.set(DESKTOP, false)); // helper semantics: see tests/fakes/matchMedia
  resize(390, 844);
  expect(ScrollTrigger.create).toHaveBeenCalledTimes(2);
  expect(ScrollTrigger.refresh).toHaveBeenCalled();
  expect(el('[data-stage]').style.height).toBe('56svh');
});
```
Keep every existing desktop test; delete the old phone tests that assert a static block / the below-stage title. Read `tests/fakes/matchMedia.ts` for the exact API of the installed fake before writing the flip test, and read `tests/fakes/gsapMock.ts` for how `onUpdate(progress)` reaches the trigger.

- [ ] **Step 2: Run** `npx vitest run tests/app/stage.test.tsx` — expected: FAIL.
- [ ] **Step 3: Implement** in `src/app/Stage.tsx` per the Interfaces block.
- [ ] **Step 4: Run** `npx vitest run tests/app/stage.test.tsx` — expected: PASS. Then `npm test && npm run typecheck && npm run lint`.
- [ ] **Step 5: Commit** `feat(stage): pin the stage on phones as a 56svh band with the camera zooming to the notch`.

### Task 3: Section trigger start on phones

**Files:**
- Modify: `src/app/choreography/useSectionDriver.ts`, `src/app/sections/Features.tsx`
- Test: `tests/app/choreography/useSectionDriver.test.tsx`, `tests/app/sections/features.test.tsx` (create if the sections tests live elsewhere: follow the existing test layout under `tests/app/sections/`)

**Interfaces:**
- Consumes: `CAMERA.phoneSectionStart` ('top 78%'), `useIsDesktop()`.
- Produces: `useSectionDriver(args)` accepts optional `start?: string` (default `'top center'`), used for every `ScrollTrigger.create` and for the font-ready "reached" pass (a section counts as reached when `el.getBoundingClientRect().top < window.innerHeight * fraction`, where `fraction` is parsed from `start` as the percentage after `top ` — `'top center'` → 0.5, `'top 78%'` → 0.78). Changing `start` after mount kills and recreates every trigger (so the breakpoint flip takes effect). `Features.tsx` passes `start: isDesktop ? undefined : CAMERA.phoneSectionStart`.

- [ ] **Step 1: Write the failing tests**: in `useSectionDriver.test.tsx` add `'start is forwarded to every trigger and recreated when it changes'` (render with `start: 'top 78%'`, expect `vars(0).start === 'top 78%'`; rerender with `'top center'`, expect the old triggers killed and new ones with `'top center'`) and `'the reached pass uses the start fraction'` (a section at top 0.7 × innerHeight is reached with `'top 78%'` and not with `'top center'`). In the Features test: phone layout passes `start: 'top 78%'`, desktop passes no `start` (spy on `useSectionDriver` via `vi.mock` of the module, asserting the args object).
- [ ] **Step 2: Run** the two test files — expected: FAIL.
- [ ] **Step 3: Implement** per the Interfaces block.
- [ ] **Step 4: Run** `npm test && npm run typecheck && npm run lint` — expected: PASS.
- [ ] **Step 5: Commit** `feat(choreography): sections start at 78% of the viewport on phones`.

### Task 4: Phone e2e and docs

**Files:**
- Modify: `e2e/responsive.spec.ts`
- Docs: `docs/superpowers/specs/2026-10-27-quickreminder-landing-design.md` (already revised; only fix wording if the implementation diverged), `README.md` (one line under the choreography/layout notes if such a section exists: phones pin a 56 svh band).

**Interfaces:**
- Consumes: the built page (`npm run build && npm run preview`, Playwright `webServer`), `[data-stage]`, `[data-camera]`, `role=application` "QuickReminder demo desktop", `#feature-02`, the hint text "Tap the notch to add a reminder", the title "A reminder, straight out of the notch.".
- Produces: `e2e/responsive.spec.ts` with these tests (chromium, `viewport 390 × 844, hasTouch, isMobile`, `?now=2026-10-23T10:00`):

```ts
test('phones pin a 56svh band and never scroll sideways', …)        // scrollWidth 390; [data-stage] position 'sticky'; its height ≈ 472.64 (±1)
test('the hero shows the whole MacBook under the nav with the title in the band', …) // application box width ≈ 1512 × 0.210588 (±1), ratio 1512/982 (±0.01), box.y ≈ 111.46 (±1); hint visible; title visible inside [data-stage]
test('tapping the notch opens the panel; ⓧ closes it', …)             // as today, tapping at box.x + box.width/2, box.y + 19 × pt
test('scrolling zooms to the notch and sections drive the state', …)  // scrollIntoView #feature-02 + wheel(0, 1); title textbox value 'Call mum' (timeout 6000); application box width ≈ 1512 × 0.570759 (±2) and box.y ≈ 28 (±1); the band still covers the top: [data-stage] boundingBox y === 0
test('the pinned panel stays tappable', …)                             // after the previous scroll: tap the Close button → data-phase 'closed' (timeout 3000); window.scrollY unchanged (±1) by the tap
```

- [ ] **Step 1: Write the tests** (replace the file's four tests).
- [ ] **Step 2: Run** `npx playwright test e2e/responsive.spec.ts --project=chromium` — expected: PASS (if a geometry assertion fails by more than the tolerance, the implementation or the plan number is wrong: check against the Global Constraints formulas before loosening anything; record the resolution in the report).
- [ ] **Step 3: Run** the whole suite once: `npm test && npm run typecheck && npm run lint && npx playwright test` — expected: all pass (phone specs skip on webkit as today).
- [ ] **Step 4: Commit** `test(e2e): phone band, notch zoom and tappable pinned panel`.
