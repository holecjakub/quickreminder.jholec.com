import { expect, test } from '@playwright/test';
test('the page boots', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'A reminder, straight out of the notch.' })).toBeVisible();
  await expect(page).toHaveTitle('QuickReminder · A reminder, straight out of the notch');
});
