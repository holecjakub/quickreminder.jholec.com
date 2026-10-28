# quickreminder.jholec.com

The landing page for the macOS app QuickReminder. It doesn't show the app; the visitor uses it.
The hero is a full-screen imitation of a macOS desktop running an interactive, animated web
recreation of the app, 1:1 with the real thing. As you scroll, the desktop becomes a MacBook on
the page, and the recreation inside it moves to the state each feature section describes.

**Stack:** Vite, React 18, TypeScript, Tailwind CSS (tokens as CSS variables), `motion`, GSAP +
ScrollTrigger, Phosphor icons, Vitest, Playwright. One static page, deployed to Vercel.

## Commands

```sh
npm run dev     # local dev server
npm run test    # Vitest (runs in the Pacific/Auckland time zone)
npm run e2e     # Playwright smoke suite (chromium + webkit)
npm run lint    # ESLint, including the src/ import boundaries
npm run build   # typecheck + production build
```

Source of truth: the app repo `holecjakub/QuickReminder` (SPEC.md and the Swift sources).

QuickReminder is an independent app and is not affiliated with Apple Inc.
