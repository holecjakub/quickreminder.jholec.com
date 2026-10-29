import { test, expect, type Page } from '@playwright/test';

const NOW = '2026-10-23T10:00'; // Friday, Europe/Prague (playwright.config timezoneId)

// Reference values at 390 × 844 (plan Global Constraints, landing spec §7 Mobile / §11.1).
const BAND_HEIGHT = 472.64; // 0.56 × 844
const HERO_PT = 0.210588;
const HERO_Y = 111.46;
const NOTCH_PT = 0.570759;
const NOTCH_Y = 28;

const desktop = (page: Page) => page.getByRole('application', { name: 'QuickReminder demo desktop' });

function expectNear(actual: number, expected: number, tolerance: number): void {
  expect(Math.abs(actual - expected), `${actual} ≈ ${expected} (±${tolerance})`).toBeLessThanOrEqual(tolerance);
}

async function scrollToFeature02(page: Page): Promise<void> {
  await page.locator('#feature-02').evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.mouse.wheel(0, 1);
  await expect(page.getByRole('textbox', { name: 'New Reminder' })).toHaveValue('Call mum', { timeout: 6000 });
}

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test.beforeEach(({ browserName }) => {
  test.skip(browserName !== 'chromium', 'phone emulation (isMobile) runs in chromium only');
});

test('phones pin a 56svh band and never scroll sideways', async ({ page }) => {
  await page.goto(`/?now=${NOW}`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  const stage = page.locator('[data-stage]');
  expect(await stage.evaluate((el) => getComputedStyle(el).position)).toBe('sticky');
  expectNear((await stage.boundingBox())!.height, BAND_HEIGHT, 1);
});

test('the hero shows the whole MacBook under the nav with the title in the band', async ({ page }) => {
  await page.goto(`/?now=${NOW}`);
  const box = (await desktop(page).boundingBox())!;
  expectNear(box.width, 1512 * HERO_PT, 1);
  expect(box.width / box.height).toBeCloseTo(1512 / 982, 2);
  expectNear(box.y, HERO_Y, 1);
  await expect(page.getByText('Tap the notch to add a reminder')).toBeVisible();
  const title = page.locator('[data-stage]').getByRole('heading', { name: 'A reminder, straight out of the notch.' });
  await expect(title).toBeVisible();
});

// Phones show the title only (2-line h3, ~55 px), which fits the 96 px reserve with the 16 px bottom offset.
for (const viewport of [
  { width: 390, height: 844 },
  { width: 390, height: 667 },
]) {
  test.describe(`${viewport.width} × ${viewport.height}`, () => {
    test.use({ viewport });

    test('the hero title block sits below the MacBook deck', async ({ page }) => {
      await page.goto(`/?now=${NOW}`);
      const deckBox = (await page.locator('[data-deck]').boundingBox())!;
      const titleBlockBox = (await page.locator('[data-hero-title-block]').boundingBox())!;
      expect(titleBlockBox.y).toBeGreaterThanOrEqual(deckBox.y + deckBox.height - 1);
    });
  });
}

test('tapping the notch opens the panel; ⓧ closes it', async ({ page }) => {
  await page.goto(`/?now=${NOW}`);
  const box = (await desktop(page).boundingBox())!;
  const pt = box.width / 1512;
  await page.touchscreen.tap(box.x + box.width / 2, box.y + 19 * pt);
  await expect(desktop(page)).toHaveAttribute('data-phase', 'open');
  await page.getByRole('button', { name: 'Close' }).tap();
  await expect(desktop(page)).toHaveAttribute('data-phase', 'closed', { timeout: 3000 });
});

test('scrolling zooms to the notch and sections drive the state', async ({ page }) => {
  await page.goto(`/?now=${NOW}`);
  await scrollToFeature02(page);
  const box = (await desktop(page).boundingBox())!;
  expectNear(box.width, 1512 * NOTCH_PT, 2);
  expectNear(box.y, NOTCH_Y, 1);
  // The band still covers the top of the viewport.
  expect((await page.locator('[data-stage]').boundingBox())!.y).toBe(0);
});

test('the pinned panel stays tappable', async ({ page }) => {
  await page.goto(`/?now=${NOW}`);
  await scrollToFeature02(page);
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.getByRole('button', { name: 'Close' }).tap();
  await expect(desktop(page)).toHaveAttribute('data-phase', 'closed', { timeout: 3000 });
  expectNear(await page.evaluate(() => window.scrollY), scrollBefore, 1);
});
