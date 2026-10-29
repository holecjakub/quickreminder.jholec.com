# QuickReminder landing page

The landing page for [`holecjakub/QuickReminder`](https://github.com/holecjakub/QuickReminder), the macOS app.
It doesn't show the app; the visitor uses it. The hero is a full-screen imitation of a macOS desktop running an
interactive, animated web recreation of the app, 1:1 with the real thing. As you scroll, the desktop becomes a
MacBook on the page and the recreation moves to the state each feature section describes. The design spec is
`docs/superpowers/specs/2026-10-27-quickreminder-landing-design.md`.

**Stack:** Vite, React 18, TypeScript, `motion`, GSAP + ScrollTrigger, Phosphor icons, Vitest, Playwright.

## Develop

```sh
npm ci
npm run dev    # http://localhost:5173
```

URL flags:

- `?now=2026-10-23T10:00` fixes the clock (`AppClock`), so dates in the recreation are reproducible.
- `?debug=motion` slows every animation and timer 4x.

## Test

```sh
npm test            # Vitest (runs in the Pacific/Auckland time zone)
npm run e2e         # Playwright: smoke, choreography, responsive and a11y specs (chromium + webkit)
npm run build && npx vite preview --port 4173
npm run lighthouse  # against the preview server; performance >= 0.95, CLS <= 0.01
```

## Structure

```
src/
  app/          page shell: Stage, camera, scroll choreography, sections, nav, footer
  desktop/      the fake macOS desktop: wallpaper, menu bar, Reminders window, cursor
  recreation/   the 1:1 recreation of the app: core (parsing, dates), machine (notch state), ui, store
  tokens.css    design tokens as CSS variables (--jh-* page, --qr-* recreation)
```

## Fidelity

The Swift code and `SPEC.md` (sections 1, 3, 4) of the app repo are the reference. Where they disagree, the code
wins. Values are copied, never eyeballed.

## Deploy

Vercel static build (`vercel.json`). `main` deploys to production (`main deploys to production`); `develop` and
pull requests get preview URLs. The domain `quickreminder.jholec.com` is a GoDaddy CNAME `quickreminder` ->
`cname.vercel-dns.com`; the runbook is `~/Developer/jholec.com/GODADDY-DNS.md`.

## Trademarks

Not affiliated with, endorsed by or sponsored by Apple Inc. Apple, macOS, iOS, Xcode, SF Symbols and Reminders are trademarks of Apple Inc. QuickReminder is an independent, from-scratch implementation using only public Apple frameworks; it contains no Apple source code or assets and uses no private APIs. It reads and writes your reminders through the public EventKit framework.
