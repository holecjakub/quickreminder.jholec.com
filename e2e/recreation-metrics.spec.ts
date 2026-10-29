// Visual review of the recreation against the Swift layout (Task 46): the dev-only harness renders one
// `Recreation` at `--pt: 1`, drives it to a named state, and every box below is read back in canvas
// points and compared with the metric the Swift code (or its tests) fixes, ± 0.5 pt. Each state also
// leaves a 2× screenshot for the by-eye comparison with the app's captures.
//
// The harness is not part of the production build (`vite preview` cannot serve it), so this file
// starts its own Vite dev server per worker.
import { expect, test as base, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { createServer, type ViteDevServer } from 'vite';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
/** `NotchLayout.openCanvasSize` width: the canvas the boxes are measured in. */
const CANVAS_WIDTH = 648;
/** Friday 18 September 2026, 10:00 in the visitor's (the context's) zone. */
const NOW = '2026-09-18T10:00';
const TOLERANCE = 0.5;

const test = base.extend<object, { harnessOrigin: string }>({
  harnessOrigin: [
    // Playwright reads a fixture's dependencies from the destructuring pattern; this one has none.
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const server: ViteDevServer = await createServer({
        root: ROOT,
        configFile: `${ROOT}vite.config.ts`,
        logLevel: 'error',
        server: { port: 0, strictPort: false },
      });
      await server.listen();
      const url = server.resolvedUrls?.local[0];
      if (!url) throw new Error('the Vite dev server has no local URL');
      await use(url.replace(/\/$/, ''));
      await server.close();
    },
    { scope: 'worker' },
  ],
});

test.use({
  viewport: { width: 1512, height: 982 },
  deviceScaleFactor: 2,
  locale: 'en-US',
  timezoneId: 'Europe/Prague',
});

interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** The first element matching `sel` (or the `index`-th) as a rect in canvas points. */
async function box(page: Page, sel: string, index = 0): Promise<Box> {
  return page.evaluate(
    ({ sel, index, canvasWidth }) => {
      const canvas = document.querySelector('[data-qr-canvas]');
      const el = document.querySelectorAll(sel)[index];
      if (!canvas || !el) throw new Error(`no element for ${sel} [${index}]`);
      const c = canvas.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const k = c.width / canvasWidth;
      return { x: (r.left - c.left) / k, y: (r.top - c.top) / k, w: r.width / k, h: r.height / k };
    },
    { sel, index, canvasWidth: CANVAS_WIDTH },
  );
}

type Expected = Partial<Box>;

/** Every named field of `expected` within ± 0.5 pt of the measured box; retried while springs settle. */
async function expectBox(page: Page, sel: string, expected: Expected, index = 0): Promise<void> {
  await expect(async () => {
    const actual = await box(page, sel, index);
    for (const key of Object.keys(expected) as (keyof Box)[]) {
      const want = expected[key]!;
      expect(Math.abs(actual[key] - want), `${sel}[${index}].${key} = ${actual[key]}, want ${want}`)
        .toBeLessThanOrEqual(TOLERANCE);
    }
  }).toPass({ timeout: 3000 });
}

/** The centre of `sel` within ± 0.5 pt of (x, y). */
async function expectCentre(page: Page, sel: string, x: number, y: number): Promise<void> {
  await expect(async () => {
    const b = await box(page, sel);
    expect(Math.abs(b.x + b.w / 2 - x), `${sel} centre x = ${b.x + b.w / 2}, want ${x}`).toBeLessThanOrEqual(TOLERANCE);
    expect(Math.abs(b.y + b.h / 2 - y), `${sel} centre y = ${b.y + b.h / 2}, want ${y}`).toBeLessThanOrEqual(TOLERANCE);
  }).toPass({ timeout: 3000 });
}

async function open(page: Page, origin: string, state: string, extra = ''): Promise<void> {
  await page.goto(`${origin}/recreation-harness.html?state=${state}&now=${NOW}${extra}`);
  // Polled every frame: `saving` is captured 0.8 s into a 1.0 s hold, so a coarse poll would miss it.
  await page.waitForFunction(() => document.body.dataset.ready === 'true', null, { polling: 'raf', timeout: 10_000 });
}

async function shoot(page: Page, name: string, browser: string): Promise<void> {
  await page.locator('[data-qr-canvas]').screenshot({ path: `test-results/recreation/${browser}/${name}.png` });
}

const NOTCH = 'path[data-qr-target=notch]';
const SCHEDULE_FOOTER = '[data-qr-section=schedule] [data-qr-footer]';
const LOCATION_FOOTER = '[data-qr-section=location] [data-qr-footer]';
const PRESET = '[data-qr-target^="preset:"]';

test.describe('recreation metrics', () => {
  test('plain: open panel, header, input rows, chip slot, bottom bar', async ({ page, harnessOrigin }, info) => {
    await open(page, harnessOrigin, 'plain');
    await expectBox(page, NOTCH, { x: 24, y: 0, w: 600, h: 241 });
    await expectBox(page, '[data-qr-target=close]', { x: 549, y: 47, w: 36, h: 36 });
    await expectBox(page, '[data-qr-close-circle]', { x: 555, y: 53, w: 24, h: 24 });
    await expectBox(page, '[data-qr-dashed-circle]', { x: 63, y: 95, w: 21, h: 21 });
    await expectBox(page, '[data-qr-target=title]', { x: 94, y: 93, w: 491, h: 25 });
    await expectBox(page, '[data-qr-target=notes]', { x: 94, y: 119, w: 491, h: 20 });
    await expectBox(page, '[data-qr-chip-slot]', { y: 139, h: 26 });
    await expectBox(page, '[data-qr-pill]', { x: 63, y: 175, w: 170, h: 44 });
    await expectCentre(page, '[data-qr-target=calendarIcon]', 93, 197);
    await expectCentre(page, '[data-qr-target=locationIcon]', 148, 197);
    await expectCentre(page, '[data-qr-target=flagIcon]', 203, 197);
    await expectBox(page, '[data-qr-target=save]', { x: 537, y: 173, w: 48, h: 48 });
    await shoot(page, 'plain', info.project.name);
  });

  test('section: Set Date controls below the bottom bar', async ({ page, harnessOrigin }, info) => {
    await open(page, harnessOrigin, 'section');
    await expectBox(page, NOTCH, { h: 519 });
    await expectBox(page, '[data-qr-type-field]', { x: 63, y: 241, w: 522, h: 36 });
    await expectBox(page, '[data-qr-preview]', { y: 283, h: 18 });
    await expectBox(page, PRESET, { y: 311, w: 168.667, h: 44 }, 0);
    await expectBox(page, PRESET, { y: 363, w: 168.667, h: 44 }, 3);
    await expectBox(page, '[data-qr-day-time]', { y: 419, h: 30 });
    await expectBox(page, SCHEDULE_FOOTER, { y: 463, h: 36 });
    const lastChip = await box(page, '[data-qr-target="timeChip:19"]');
    expect(lastChip.x + lastChip.w).toBeLessThanOrEqual(585);
    await shoot(page, 'section', info.project.name);
  });

  test('calendar: the month grid between the day / time row and the footer', async ({ page, harnessOrigin }, info) => {
    await open(page, harnessOrigin, 'calendar');
    await expectBox(page, NOTCH, { h: 751 });
    await expectBox(page, '[data-qr-calendar]', { y: 459, h: 222 });
    await expectBox(page, SCHEDULE_FOOTER, { y: 695 });
    await shoot(page, 'calendar', info.project.name);
  });

  test('saving: the collapsed pill and the badge', async ({ page, harnessOrigin }, info) => {
    await open(page, harnessOrigin, 'saving');
    await expectBox(page, NOTCH, { x: 134.5, y: 0, w: 379, h: 39 });
    await expectBox(page, '[data-qr-badge-slot]', { x: 459.5, y: 7.5, w: 24, h: 24 });
    await shoot(page, 'saving', info.project.name);
  });

  test('hover: the swollen closed notch', async ({ page, harnessOrigin }, info) => {
    await open(page, harnessOrigin, 'hover');
    await expectBox(page, NOTCH, { x: 195.5, y: 0, w: 257, h: 44 });
    await shoot(page, 'hover', info.project.name);
  });

  test('lists: the list picker anchored under the header', async ({ page, harnessOrigin }, info) => {
    await open(page, harnessOrigin, 'lists');
    await expectBox(page, '[data-qr-popover=lists]', { x: 63, y: 91 });
    await shoot(page, 'lists', info.project.name);
  });

  test('location: the in-notch Location section', async ({ page, harnessOrigin }, info) => {
    await open(page, harnessOrigin, 'location');
    await expectBox(page, NOTCH, { h: 347 });
    await expectBox(page, '[data-qr-location-field]', { x: 63, y: 241, w: 522, h: 36 });
    await expectBox(page, LOCATION_FOOTER, { y: 291, h: 36 });
    // The brief's 11.92 × 11.50 was the @18 box × 12/18; SF `location` re-measured at 12 pt medium
    // (AppKit, symbol image rasterised at 8×, any coverage) is 11.50 × 11.50.
    await expectBox(page, '[data-sf="location@12"] path', { w: 11.5, h: 11.5 });
    await shoot(page, 'location', info.project.name);
  });

  for (const state of ['typed', 'suggestion', 'applied', 'flag'] as const) {
    test(`${state}: the open panel keeps its size`, async ({ page, harnessOrigin }, info) => {
      await open(page, harnessOrigin, state);
      await expectBox(page, NOTCH, { x: 24, y: 0, w: 600, h: 241 });
      await shoot(page, state, info.project.name);
    });
  }

  test('plain in the Work list (accent)', async ({ page, harnessOrigin }, info) => {
    await open(page, harnessOrigin, 'plain', '&list=work');
    await expectBox(page, NOTCH, { x: 24, y: 0, w: 600, h: 241 });
    await shoot(page, 'plain-work', info.project.name);
  });
});
