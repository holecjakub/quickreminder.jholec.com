import { test, expect, type Page } from '@playwright/test';

const NOW = '2026-10-23T10:00'; // Friday, Europe/Prague (playwright.config timezoneId)

const desktop = (page: Page) => page.getByRole('application', { name: 'QuickReminder demo desktop' });

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test.beforeEach(({ browserName }) => {
  test.skip(browserName !== 'chromium', 'phone emulation (isMobile) runs in chromium only');
});

test('no horizontal scroll and no pinning on phones', async ({ page }) => {
  await page.goto(`/?now=${NOW}`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  expect(await page.locator('[data-stage]').evaluate((el) => getComputedStyle(el).position)).not.toBe('sticky');
});

test('the desktop keeps 16:10 inside the width and the hint says Tap', async ({ page }) => {
  await page.goto(`/?now=${NOW}`);
  const box = (await desktop(page).boundingBox())!;
  expect(box.width).toBeCloseTo(1512 * (358 / 1548), 0);
  expect(box.width / box.height).toBeCloseTo(1512 / 982, 2);
  await expect(page.getByText('Tap the notch to add a reminder')).toBeVisible();
});

test('tapping the notch opens the panel; ⓧ closes it', async ({ page }) => {
  await page.goto(`/?now=${NOW}`);
  const box = (await desktop(page).boundingBox())!;
  const pt = box.width / 1512;
  await page.touchscreen.tap(box.x + box.width / 2, box.y + 19 * pt);
  await expect(desktop(page)).toHaveAttribute('data-phase', 'open');
  await page.getByRole('button', { name: 'Close' }).tap();
  await expect(desktop(page)).toHaveAttribute('data-phase', 'closed', { timeout: 3000 });
});

test('sections below still drive the state', async ({ page }) => {
  await page.goto(`/?now=${NOW}`);
  await page.locator('#feature-02').evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.mouse.wheel(0, 1);
  await expect(page.getByRole('textbox', { name: 'New Reminder' })).toHaveValue('Call mum', { timeout: 6000 });
});
