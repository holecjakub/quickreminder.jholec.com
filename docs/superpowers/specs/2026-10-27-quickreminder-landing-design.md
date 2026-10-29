# quickreminder.jholec.com — landing page design

Date: 2026-10-27 · Owner: Jakub Holec · Status: approved in chat; builder check done, answers folded in (§11)

## 1. Intent

A presentation page for the macOS app **QuickReminder** (source: `~/Developer/Xcode Apps/QuickReminder`,
public repo `holecjakub/QuickReminder`). Instead of showing the app, the page lets the visitor
*use* it: the hero is a full-screen imitation of a macOS desktop with a **1:1 functional,
interactive, animated web recreation** of the app running in it. Scrolling turns the desktop into
a MacBook on a page, then walks through the features while the recreation inside the MacBook
switches to the state each feature talks about. The page keeps nudging the visitor to click and
type inside the recreation.

Why: the app's whole value is a feeling (a notch that grows into a panel, a ✓ that flies back in).
Screenshots and videos flatten that. A faithful recreation lets people feel it before downloading.

## 2. Goals, non-goals, anti-goals

Goals
- The recreation is **1:1** with the real app: same geometry, radii, springs, timings, colours,
  type sizes, vertical rhythm, states and keyboard behaviour, taken from `SPEC.md` (§1, §3, §4)
  and the Swift sources, never eyeballed.
- The ported logic (natural-language date parsing EN + CZ, schedule defaults, presets, month grid,
  accent contrast, suggestion formatting) passes the **same test cases** as the Swift test suite.
- Scroll choreography: desktop → MacBook, then feature sections drive the recreation's state.
- Looks like a jholec.com property (tokens below) and like a 2026 interactive product site:
  scroll-driven, state-driven, no static screenshots.
- Clear download path: notarized DMG from GitHub Releases, macOS 26, open source.

Non-goals
- No real Reminders integration, no accounts, no analytics beyond a simple privacy-friendly
  pageview counter if Vercel provides one by default. Nothing the visitor types leaves the browser.
- No Settings window recreation (mention it in copy only).
- No Popover Set Date style; the recreation uses the default **In notch** style only.
- No Czech version of the page. The recreation's parser understands Czech phrases (as the app does).
- No CMS, no blog, no multi-page site.

Anti-goals (what makes it a failure even if it "works")
- A recreation that is "close enough": wrong spring, wrong radius, wrong rhythm.
- Scroll hijacking that fights the user, or the recreation becoming unclickable while scrolled.
- Apple assets (wallpapers, SF Symbols as shipped files, Reminders app chrome) copied into the
  site, or copy that implies Apple affiliation. The app's own disclaimer applies to the site.
- Heavy page: no video, no 3D library. Everything is DOM, SVG and CSS.

## 3. Constraints

- **Source of truth for the recreation** is the Swift code plus `SPEC.md`. Where they disagree,
  the code wins. The builder reads `Sources/QuickReminder/**` and `Tests/QuickReminderCoreTests/**`
  directly (same machine). Key files: `Notch/NotchShape.swift`, `Notch/NotchState.swift`
  (`NotchLayout` metrics), `Notch/NotchContainerView.swift` (springs, content transition),
  `Panel/NotchMachine.swift` (state machine), `Views/*` (every control), `Services/*` (logic).
- **Icons**: the app uses SF Symbols. The site may not ship SF Symbol files. Use **Phosphor**
  (jholec.com's icon set) at the same optical sizes, choosing the closest glyph
  (calendar-with-clock, map-pin, flag, check, x, chevron-down, clock, moon, sun-horizon, armchair,
  calendar-blank, arrows-left-right). The menu-bar icon and app icon come from the app's own
  `Resources/Assets.xcassets` at the app repo root (Jakub's assets, allowed).
- **Fonts**: the app uses SF Pro. The site must not self-host SF Pro. Use the system stack
  `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Inter, sans-serif`
  **inside the recreation** (so on a Mac it renders with SF, which is what the real app uses) and
  **Inter** for the page itself (jholec.com type). Tabular figures in the recreation's times.
- **Wallpaper**: an original gradient/mesh wallpaper generated in CSS or SVG, in the spirit of
  macOS 26 but not an Apple image.
- Trademark disclaimer (from `README.md`) in the footer, verbatim in spirit.
- Repo language, commits, code comments: English, Conventional Commits, branches off `develop`
  (Jakub's house rules). `main` deploys to production.

## 4. Decided: how it gets made

- **Repo**: `~/Developer/quickreminder.jholec.com`, new GitHub repo `holecjakub/quickreminder.jholec.com`
  (public). Separate from the app repo.
- **Stack**: Vite + React 18 + TypeScript, Tailwind CSS (tokens as CSS variables), `motion`
  (framer-motion) for the recreation's springs and layout animations, **GSAP + ScrollTrigger** for
  the page scroll choreography, Vitest for logic tests, Playwright for a small smoke suite.
  Phosphor icons via `@phosphor-icons/react`. No Next.js: one static page.
- **Deploy**: Vercel, static output, custom domain `quickreminder.jholec.com` (DNS at GoDaddy,
  see `~/Developer/jholec.com/GODADDY-DNS.md` for the pattern). Jakub adds the DNS record.
- **Page language**: English.
- **Structure**:
  ```
  src/
    app/            page shell, sections, scroll choreography
    recreation/     the 1:1 app recreation (self-contained, no page imports)
      core/         ported logic (pure TS, tested)
      ui/           components mirroring Views/*
      machine/      NotchMachine port + layout metrics (NotchLayout)
    desktop/        fake macOS desktop: wallpaper, menu bar, fake Reminders window
    tokens.css      jholec.com + app colour/type/spacing tokens
  ```
  The recreation exposes an imperative API for the page: `show()`, `hide()`, `setTitle(text)`,
  `typeTitle(text, cps)`, `openSchedule()`, `openCalendar()`, `save()`, `setList(id)`,
  `toggleFlag()`, `setPointer(x,y)` (fake cursor for demos), `state` (observable).

## 5. The recreation (what "1:1" means)

### 5.1 Geometry and motion (from SPEC §3, §4, `NotchLayout`, `NotchContainerView`)
- Closed silhouette 221 × 38 (+bleed per code), radii top 6 / bottom 14; open 600 × 241,
  radii 19 / 32; notch band 39 dead zone; hover swell +22 × 5 with `spring(response 0.32,
  damping 0.55)` after a 90 ms dwell; open `spring(0.42, 0.78)`, content `easeOut 0.20`
  delayed 0.16 s with blur 8→0 and scale 0.94→1 from the top, masked to the live silhouette;
  close `spring(0.30, 0.92)`, content `easeOut 0.12`; saved: width +2×72 at notch height with
  `spring(0.45, 0.82)`, 24 pt ✓ badge flies into the right extension (shared-layout animation),
  tick trims in 0.28 s after 0.32 s, bounce 1.18× at 0.55 s, hold 1.0 s, then close.
- In-notch sections (app 0.5.3, commit `144d620`): the plain panel stays and the blob grows
  **below the bottom bar** with `spring(0.38, 0.8)`: Set Date `.controls` 519 pt, `.calendar`
  751 pt, **Location 347 pt** (86 pt section); one section at a time, switching keeps what was
  typed (`SectionHandoff.swift`); rows stagger in 35 ms apart with a 6 pt drop and 3 pt
  un-blur. Height clamped to the fake screen like the app clamps to the display.
- The spring parameters are SwiftUI `response`/`dampingFraction`. The builder converts them to
  physical springs (stiffness = (2π/response)², damping = 4π·dampingFraction/response, mass 1)
  so the curves match, and documents the conversion in code.
- Reduce Motion (`prefers-reduced-motion`): the app's reduced behaviour (plain fades, no spring,
  blur or scale, no hover swell).

### 5.2 Visual (SPEC §4)
Pure black panel; 20 pt horizontal padding; header "Reminders" 22 pt bold in the list accent with
a 13 pt bold chevron 7 pt to the right; ⓧ 24 pt circle #59595D with an 11 pt bold x (36 pt hit);
dotted circle 21 pt, 1.5 pt, #59595D; title 19 pt regular white, placeholder #59595D "New
Reminder"; notes 15 pt, placeholder "Notes"; pill 44 pt capsule, fill white 3 %, 1 pt stroke
#3D3D3F, three 18 pt icons with 38 pt hit areas at 55 pt centre spacing; save ✓ 48 pt circle,
#474749 disabled / accent enabled, 22 pt semibold check; chip slot fixed 26 pt; vertical rhythm
exactly as SPEC §4; Set Date rhythm exactly as SPEC §4 "In-notch Set Date rhythm". Hover and
press feedback per SPEC §4 "Pointer" (circular 10 %/18 % highlight on pill icons, 1.06×/0.94×
spring on round controls, hand cursor). Text scale fixed at 1.0.

### 5.3 Behaviour (SPEC §1)
- Open: click the notch, press ⇧⌘R while the page has focus, or the page's scroll choreography.
  The title field takes focus when opened by click/hotkey, never when opened by scroll (so the
  page doesn't steal focus while the visitor reads). A single `Esc` closes (layered: calendar →
  section → panel), click outside closes, ⓧ closes. Typing turns ✓ to the accent.
- Natural-language dates in the title (EN + CZ, right-most phrase wins, day-only → 9:00 rule)
  show the accent suggestion chip "Tomorrow, 2:00 PM ⇥"; Tab or click applies and strips the
  phrase; ⓧ dismisses for that phrase; un-dismissed suggestions apply on save.
- "Reminders ▾" opens a list picker with 5 fake lists (Reminders blue, Work purple, Home orange,
  Groceries green, Ideas pink). The list colour becomes the accent everywhere SPEC says.
- Calendar icon / ⌘D / date chip: in-notch Set Date with type field + live preview + "In the past",
  2 × 3 presets (⌘1…⌘6), day button + typed time (↑/↓ ±15 min, 9/12/15/19 chips), ⌘K month grid
  (six weeks, locale first weekday, past days dimmed, arrows move the day), Clear · Cancel ·
  "Set · Fri 9:00". ↩/⌘↩ inside the section means Set. Esc steps back one level.
- Location icon: the **in-notch Location section** (`LocationNotchSection.swift`,
  `LocationDraft`): field + Clear · Cancel · Done; ↩/⌘↩ = Done; Esc, Cancel or a click on the
  header/title/notes leave it unchanged; ✓ applies an edited location then saves; stored as
  "📍 …" in notes, icon switches to the filled pin. No popover anywhere. Flag: toggles orange
  filled flag.
- ⌘↩, ↩ in a field or ✓: the saved choreography, then the reminder appears in the **fake
  Reminders window** on the desktop (title, list colour, due label, flag). This is the demo's
  reward; the window is a simplified, original design (not Apple's), sitting bottom-right of the
  desktop, and slides in only after the first save.
- Locale: the recreation formats dates in `en-US` 12-hour by default (what the page audience
  sees in the app's screenshots), with CZ phrases parsed regardless. Builder's call on exposing a
  24-hour toggle; not required.

### 5.4 Logic ports (pure TS, Vitest, cases mirrored from the Swift tests)
`NaturalDateParser`, `ScheduleDefaults`, `DatePresets` (incl. `highlighted`, evening cutoff,
weekend/next-weekend rules), `ScheduleInput` (typed dates, `15.11` Czech day.month, `+90m`,
`fri 2pm`, whole-input rule), `ScheduleDraft`, `ScheduleCommit`, `MonthGrid`, `AccentContrast`,
`SuggestionDateFormatter`, `NotchMachine` (states closed/open/saving/closing, schedule
none/controls/calendar, events). Tests are deterministic: "now" is injected.

## 6. The desktop (hero scene)

Full-viewport scene at 16:10 (MacBook) letterboxed to the viewport: original gradient wallpaper
(two or three soft blobs, light and dark variants following `prefers-color-scheme`); a menu bar
with the real notch cut-out (the recreation's closed silhouette *is* the notch), an Apple-free
left side (a generic "Finder"-less app name, e.g. "Notes"), and on the right the app's own
menu-bar icon plus a clock showing the visitor's real time; no Dock (keeps the scene clean and
avoids Apple iconography). A faint fake cursor and a one-line hint under the notch:
"Click the notch, or press ⇧⌘R" that fades once the panel has been opened once.

## 7. Page and scroll choreography

Page = `desktop` scene pinned, then sections. Scroll never steals wheel events; GSAP
ScrollTrigger with `scrub` drives transforms only. The recreation stays interactive in every
state; a manual interaction pauses scroll-driven state changes for that section until the
visitor scrolls on to the next section (no fighting).

1. **Hero (0 vh)**: the whole MacBook (lid, bezel and keyboard deck, drawn in CSS/SVG, no
   photo) on the page background (jholec.com white), fitted into the viewport with 24 px side
   gutters and 48 px of air above and below, the full desktop on its screen. Recreation closed,
   hint visible. Page nav is a minimal top-right overlay (GitHub · Download) that sits *on* the
   desktop like a floating pill. (Changed 2026-10-29 from a full-screen desktop crop with the
   frame drawing in on scroll: Jakub asked for the desktop across the page, smaller, framed.)
2. **Shrink (0 → 100 vh)**: the MacBook scales to 72 % of the hero and settles centred at 42 %
   of the viewport height; the title "A reminder, straight out of the notch." (24 semibold →
   Heading 2 M scale) and a one-line subtitle appear below it.
3. **Features**: the MacBook stays pinned (sticky) on the left ~58 % at desktop, **cropped to the
   top of the lid** (see §11.1: the notch region is shown at 1 CSS px per point, the lower part of
   the MacBook runs out of the pinned area); copy sections scroll on the right, each with the jholec.com `(0n) Label /` section title, a 24-semibold
   headline, an 18-medium paragraph and 2–3 Phosphor icon + 16-medium bullets. When a section's
   copy reaches the middle of the viewport, the recreation plays the section's state:
   - (01) **One shortcut.** Panel opens from the notch (no typing). Hint: press ⇧⌘R.
   - (02) **Say when.** Types "Call mum tomorrow at 2pm" at 18 cps, chip appears; after 900 ms
     the chip applies (Tab animation), phrase stripped. A second line of copy shows the Czech
     example "zavolat mámě zítra ve 14:00".
   - (03) **Set the date in the notch.** Set Date grows out of the panel, highlights the
     Tomorrow preset, then ⌘K opens the calendar.
   - (04) **Your lists, your colour.** Cycles the list picker Reminders → Work → Home; the accent
     recolours header, chevron, ✓, chip, caret.
   - (05) **Flag it, pin it.** Toggles the flag, opens the in-notch Location section, types "Office", Done.
   - (06) **Save, and it flies home.** ⌘↩: saved choreography; the fake Reminders window slides
     in with the saved item.
   - (07) **Everywhere you already are.** Raycast / Shortcuts / `quickreminder://show` /
     Settings (launch at login, hotkey, default list). Static: a dark jholec.com card row with
     a faux terminal line `open quickreminder://show` (jholec.com's MacOSTerminal pattern).
   Scrolling back up reverses states where cheap (close, clear), otherwise just closes.
4. **Download** (dark section, `#0A0A0A`): "Free. Open source. macOS 26." Primary button
   "Download for macOS" → GitHub Releases latest DMG asset (link to `releases/latest`),
   secondary "View on GitHub". Three small facts: notarized Developer ID build; only EventKit,
   no private APIs; MIT licence (the repo's `LICENSE`). Requirements line:
   macOS 26, works on Macs without a notch (virtual pill at the top).
5. **Footer**: jholec.com link, "Made by Jakub Holec", trademark disclaimer, repo link.

Mobile (< 810 px, revised 2026-10-29 — Jakub: "víc close na ten notch"): the stage is
pinned on phones too, as a sticky band of **56 svh** at the top of the viewport, above the
copy (the copy scrolls underneath it, so the band paints over it). Two camera keyframes over
a **100 svh** runway, no overview:

- **Hero**: the whole MacBook fitted into the band between the nav (64 px) and a 96 px title
  reserve at the bottom, with 16 px side gutters; the title and subtitle sit inside the band
  at the bottom and fade out over the first half of the runway.
- **Notch**: the camera zooms so the open panel (600 pt) fills the width minus the gutters,
  clamped so the tallest in-notch section (the 751 pt calendar) fits under the notch inside
  the band (notch top at 28 px, 16 px of air below), never below 0.4 px/pt. The lid's top bezel
  stays visible above the notch, so it reads as a zoom into the laptop. On 390 × 844 the scale
  is 0.571 (panel 343 px wide).

Feature sections trigger their state when their top reaches **78 %** of the viewport (not the
centre, which lies under the band). The recreation stays tappable while pinned; keyboard
shortcuts are replaced by on-screen controls that already exist (notch tap, ✓, ⓧ). Reduced
motion snaps the camera at half progress, as on desktop.

## 8. Design tokens (page)

From jholec.com: white `#FFFFFF`, black `#0A0A0A`, light black `#121212`, light gray
`#EBEBEB` (90 % variant for cards), medium gray `#757575`, gray `#A8A8A8`, dark gray `#4D4D4D`,
accent link blue `#0099FF`; Inter (400/500/600); type scale 14/16/18/24/32/54 with the
jholec.com names; spacing 8/16/24/40/48/80/140/160; radius 16; section rhythm 160 px, page
margins 140 px top/bottom, 20–40 px sides; light/dark section alternation; numbered section
titles `(01) Label /`; Phosphor icons; 2 px scroll progress bar at the top. The recreation
keeps the app's own colours (Theme.swift), not the page's.

## 9. Quality bar

- Logic: Vitest suite mirrors every Swift test case that applies (parser, presets, defaults,
  input, draft, commit, month grid, contrast, formatter, machine, layout sums).
- Visual: the Swift code and SPEC §4 are the acceptance reference. The 2× captures in the app
  repo's `build/shots/*.png` (dated 2026-09-22, no in-notch Set Date shots) are a bonus check:
  render the recreation at 2× device pixels and compare by eye. Taking fresh captures with
  `Scripts/shot.sh` is optional and only if the app builds and runs without friction.
- Motion: spring constants documented; a `?debug=motion` flag slows animations 4× for review.
- A11y: keyboard reachable (Tab order as SPEC), visible focus, ARIA names on round buttons,
  `prefers-reduced-motion` honoured, colour contrast of page copy ≥ 4.5:1.
- Perf: Lighthouse ≥ 95 performance on desktop, no layout shift from the hero.
- Smoke (Playwright): page loads, notch click opens, typing "tomorrow at 2pm" shows the chip,
  Tab applies it, ⌘↩ runs the saved choreography and the item lands in the fake window.

## 10. Left to the builder

- Exact MacBook frame drawing (proportions of the 14" MacBook Pro, CSS/SVG).
- Wallpaper look, within "original, soft, not Apple's".
- Copy polish (keep headlines above; paragraphs are the builder's draft, Jakub edits after).
- How the fake cursor is drawn and moved for scroll-driven demos.
- Whether the Set Date type field uses a real `<input>` or a contenteditable (keyboard
  behaviour must match SPEC either way).
- Playwright scope beyond the smoke list.
- Vercel project setup details and the README.

## 11. Builder-check answers (Jakub's words or the author's calls)

### 11.1 Scale and legibility (author's call, from Jakub's brief "a MacBook with a preview of the top part of the screen")
- The fake screen is a 14" MacBook Pro logical screen: **1512 × 982 pt**. All recreation and
  desktop geometry is in these points; one CSS variable `--pt` scales the whole scene.
- Hero: the whole MacBook (1700 × 1070 pt with the deck) is scaled to fit the viewport minus
  the gutters and the air. At 1440 × 900 the scale is 0.75, so the panel is ~450 px wide,
  legible and typeable.
- Phones (< 810 px): the band is 56 svh; hero scale = min((w − 32) / 1700, (0.56 h − 64 − 96) / 1070);
  notch scale = clamp(min((w − 32) / 600, (0.56 h − 28 − 16) / 751), 0.4, 1). The camera
  lerps hero → notch over the 100 svh runway; `--pt` is the larger of the two.
- Features: the pinned MacBook is **zoomed and cropped to the top of the lid**. Target scale
  is 1 CSS px per point (the open panel 600 px wide), clamped to fit the pinned column (never
  below 0.75). The transform origin is the notch (top centre); the lower lid and the keyboard
  deck run out of the pinned area. The shrink transition (hero → features) animates scale and
  origin continuously, so the MacBook frame "draws in" while the camera settles on the notch.
- The section clamp uses the fake screen height (982 pt), so the 751 pt calendar always fits.
  The pinned column is at least 720 px tall at scale 1 on common laptop viewports; on shorter
  viewports the scale clamp handles it.

### 11.2 Section state: snapshots with a reconciler (author's call)
- Each feature section has a **deterministic target snapshot** (panel open/closed, title,
  notes, list, flag, location, schedule expansion, selected date, saved) built from one fixed
  demo reminder ("Call mum tomorrow at 2pm", list Work, flag on, location Office).
- A **reconciler** moves the recreation from its current state to the snapshot through the
  imperative API, animating only the delta the section is about (typing in 02, Set Date in 03,
  lists in 04, flag/location in 05, save in 06) and setting everything else instantly. Jumping
  straight to 06 therefore fills the reminder instantly and plays only the save.
- Visitor edits win: if the visitor changed the recreation since the last scroll-driven change
  (a `dirty` flag), the reconciler keeps their title/notes/list/flag/location and only performs
  the section's own action (03 opens Set Date on their title, 06 saves their reminder). A
  section's action runs once per entry; re-entering from above re-runs it, scrolling back up
  closes the panel for the hero and otherwise leaves content alone.
- Scroll driving is throttled: a section's action starts when its copy crosses the viewport
  middle, and a running action is allowed to finish (max ~2.5 s) before the next starts.

### 11.3 Keyboard shortcuts vs the browser (author's call)
- Shortcuts are handled only while **keyboard focus is inside the fake desktop** (the desktop
  container is focusable; clicking anywhere in it focuses it) and always `preventDefault`.
- ⇧⌘R is **not** relied upon: the hero hint reads "Click the notch to add a reminder" with a
  second line "In the app: ⇧⌘R from anywhere." The page also accepts ⇧⌘R when focus is inside
  the desktop, best effort; the smoke test never uses it.
- ⌘D, ⌘K, ⌘1…⌘6, ⌘↩, ↩, Tab, Esc, arrows work inside the recreation with `preventDefault`
  (best effort in Safari for ⌘1…⌘6; every shortcut has a click path, which the copy mentions).

### 11.4 Native popups (author's call, revised 2026-10-28)
- The list picker is **not** a macOS menu imitation. It is original, in the panel's own
  language: pure black surface, 12 pt corners, white-alpha fills (6 % rest / 11 % hover / 15 %
  pressed), accent for the selected list, 1 pt #3D3D3F stroke, anchored below the trigger.
- Location is the app's in-notch section (§5.3), so the recreation has no popover at all.

### 11.6 App moved to 0.5.3 (2026-10-28)
The app's `main` is `144d620` (0.5.3): Set Date and Location are sections appended below the
bottom bar (519 / 751 / 347 pt), the window never resizes for a section, the state machine
has `NotchSection` = none / schedule(controls | calendar) / location. The recreation follows
this code; §5.1 and §5.3 above are updated, and the plan's "contract deviations" table lists
every value that changed against the contracts.

One deliberate departure from the code (R-T46-1, plan deviation B-D7): in en-US the Set Date
hour chips ("9:00 AM" … "7:00 PM") are about 15 pt wider than the 522 pt row, and SwiftUI at
`144d620` squeezes them until two labels wrap mid-word. The recreation shrinks the chips' 10 pt
side pads instead (to about 8.2 pt in en-US) so every label stays on one line inside the row;
the Czech labels fit and keep the full pads. This keeps SPEC §1's "7:00 PM" legible and is a
decision, not a fidelity gap.

### 11.5 Visual references
See §9: code is the reference; existing 2× shots are a bonus; fresh captures optional.
