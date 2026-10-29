import { test, expect, type Page } from '@playwright/test';

const NOW = '2026-10-23T10:00'; // Friday, Europe/Prague (playwright.config timezoneId)

const desktop = (page: Page) => page.getByRole('application', { name: 'QuickReminder demo desktop' });
const title = (page: Page) => page.getByRole('textbox', { name: 'New Reminder' });

/** Scrolls feature section `n` ('01'…'06') to the top of the viewport, then nudges the wheel so
 *  ScrollTrigger sees a scroll event and fires the section's `top center` trigger. */
async function toSection(page: Page, n: string) {
  await page.locator(`#feature-${n}`).evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.mouse.wheel(0, 1);
}

test.beforeEach(async ({ page }) => {
  await page.goto(`/?now=${NOW}`);
});

test('(01) opens the panel without taking focus', async ({ page }) => {
  await toSection(page, '01');
  await expect(desktop(page)).toHaveAttribute('data-phase', 'open');
  await expect(title(page)).not.toBeFocused();
});

test('(02) types the demo title and applies the chip', async ({ page }) => {
  await toSection(page, '02');
  await expect(title(page)).toHaveValue('Call mum', { timeout: 6000 });
  await expect(page.getByRole('button', { name: 'Change date' })).toContainText(/Tomorrow, 2:00\sPM/);
});

test('(03) grows Set Date and opens the calendar', async ({ page }) => {
  await toSection(page, '03');
  await expect(desktop(page)).toHaveAttribute('data-section', 'calendar', { timeout: 6000 });
});

test('(04) ends on the Work list', async ({ page }) => {
  await toSection(page, '04');
  await expect(page.getByRole('button', { name: 'Choose list' })).toContainText('Work', { timeout: 6000 });
});

test('jumping straight to (06) fills the reminder and saves it', async ({ page }) => {
  await page.goto(`/?now=${NOW}`);
  await toSection(page, '06');
  const win = page.getByRole('region', { name: 'Your reminders' });
  await expect(win).toContainText('Call mum', { timeout: 8000 });
  await expect(win).toContainText(/Tomorrow, 2:00\sPM/);
  await expect(win).toContainText('📍 Office');
  await expect(win.getByLabel('Flagged')).toBeVisible();
});

test('visitor edits win: (03) opens Set Date on the visitor title', async ({ page }) => {
  await toSection(page, '01');
  await title(page).click();
  await page.keyboard.type('Buy milk');
  await toSection(page, '03');
  await expect(desktop(page)).toHaveAttribute('data-section', 'calendar', { timeout: 6000 });
  await expect(title(page)).toHaveValue('Buy milk');
});

test('scrolling back to the top closes the panel', async ({ page }) => {
  await toSection(page, '01');
  await expect(desktop(page)).toHaveAttribute('data-phase', 'open');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.mouse.wheel(0, -1);
  await expect(desktop(page)).toHaveAttribute('data-phase', 'closed', { timeout: 3000 });
});

test('the recreation stays clickable while pinned', async ({ page }) => {
  await toSection(page, '04');
  await title(page).click();
  await expect(title(page)).toBeFocused();
});

test('reduced motion: (02) sets the title at once', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await toSection(page, '02');
  await expect(title(page)).toHaveValue('Call mum', { timeout: 1500 });
});

test('features pin the stage on the left 58 %', async ({ page }) => {
  await toSection(page, '03');
  expect(await page.locator('[data-stage]').evaluate((el) => getComputedStyle(el).position)).toBe('sticky');
  const col = (await page.locator('[data-features-column]').boundingBox())!;
  expect(Math.round(col.x)).toBe(Math.round(1440 * 0.58));
});
