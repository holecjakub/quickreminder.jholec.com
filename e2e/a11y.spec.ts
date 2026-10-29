// Accessibility checks of the built page (landing §9): axe on the page and on the desktop, keyboard entry points.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('page has no serious or critical axe violations outside the recreation', async ({ page }) => {
  await page.goto('/?now=2026-10-23T10:00');
  const r = await new AxeBuilder({ page }).exclude('[role="application"]').analyze();
  expect(r.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
});

test('the desktop has names for every control (contrast is the app’s own palette, landing §5.2)', async ({ page }) => {
  await page.goto('/?now=2026-10-23T10:00');
  const r = await new AxeBuilder({ page }).include('[role="application"]').disableRules(['color-contrast']).analyze();
  expect(r.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
});

test('Tab reaches the nav first and shows a visible focus ring', async ({ page, browserName }) => {
  await page.goto('/');
  // Safari (and Playwright's WebKit on macOS) moves focus to links with ⌥Tab unless "Press Tab to highlight each item" is on.
  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
  const link = page.getByRole('link', { name: 'GitHub', exact: true });
  await expect(link).toBeFocused();
  expect(await link.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
});

test('the hint button opens the panel from the keyboard', async ({ page }) => {
  await page.goto('/?now=2026-10-23T10:00');
  await page.getByRole('button', { name: 'Click the notch to add a reminder' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('application', { name: 'QuickReminder demo desktop' })).toHaveAttribute('data-phase', 'open');
  await expect(page.getByRole('textbox', { name: 'New Reminder' })).toBeFocused();
});
