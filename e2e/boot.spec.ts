import { expect, test } from '@playwright/test';
test('the page boots', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'QuickReminder' })).toBeVisible();
  await expect(page).toHaveTitle('QuickReminder — a reminder, straight out of the notch');
});
