import { test, expect, type Page } from '@playwright/test';

const NOW = '2026-10-23T10:00'; // Friday, Europe/Prague (playwright.config timezoneId)

const desktop = (page: Page) => page.getByRole('application', { name: 'QuickReminder demo desktop' });
const title = (page: Page) => page.getByRole('textbox', { name: 'New Reminder' });

async function clickNotch(page: Page) {
  const box = (await desktop(page).boundingBox())!;
  const pt = box.width / 1512;
  await page.mouse.click(box.x + box.width / 2, box.y + 19 * pt); // centre of the 221 × 38 pt notch
}

/** Clicks the notch and waits for the title to take the keyboard. Like the app, the recreation focuses
 *  the title only on the 0.12 s / 0.30 s retries (`PanelController.scheduleFocusRetries`), so keys typed
 *  before that land on the desktop, not in the field. */
async function openPanel(page: Page) {
  await clickNotch(page);
  await expect(title(page)).toBeFocused();
}

test.beforeEach(async ({ page }) => {
  await page.goto(`/?now=${NOW}`);
});

test('page loads with the desktop, the closed notch and the hint', async ({ page }) => {
  await expect(page).toHaveTitle('QuickReminder · A reminder, straight out of the notch');
  await expect(desktop(page)).toBeVisible();
  await expect(desktop(page)).toHaveAttribute('data-phase', 'closed');
  await expect(page.getByText('Click the notch to add a reminder')).toBeVisible();
});

test('clicking the notch opens the panel with the title focused', async ({ page }) => {
  await clickNotch(page);
  await expect(desktop(page)).toHaveAttribute('data-phase', 'open');
  await expect(title(page)).toBeFocused();
});

test('typing "tomorrow at 2pm" shows the chip and Tab applies it', async ({ page }) => {
  await openPanel(page);
  await page.keyboard.type('Call mum tomorrow at 2pm');
  await expect(page.getByRole('button', { name: 'Use suggested date' })).toContainText(/Tomorrow, 2:00\sPM/);
  await page.keyboard.press('Tab');
  await expect(title(page)).toHaveValue('Call mum');
  await expect(page.getByRole('button', { name: 'Change date' })).toContainText(/Tomorrow, 2:00\sPM/);
});

test('⌘↩ runs the saved choreography and the item lands in the window', async ({ page }) => {
  await openPanel(page);
  await page.keyboard.type('Call mum tomorrow at 2pm');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Meta+Enter');
  await expect(desktop(page)).toHaveAttribute('data-phase', 'saving');
  await expect(page.getByLabel('Saved')).toBeVisible();
  const win = page.getByRole('region', { name: 'Your reminders' });
  await expect(win).toBeVisible();
  await expect(win).toContainText('Call mum');
  await expect(win).toContainText(/Tomorrow, 2:00\sPM/);
  await expect(desktop(page)).toHaveAttribute('data-phase', 'closed', { timeout: 3000 });
});
