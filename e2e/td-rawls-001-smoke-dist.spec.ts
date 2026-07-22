import { test, expect } from '@playwright/test';

/**
 * @human Smoke test: app loads via static dist server
 * @proves The Work With Me landing and setup flow renders in a static build
 * @lastTouched 2025-12-22
 */
test.describe('Work With Me smoke (dist server)', () => {
  test('app loads the landing screen', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByTestId('view-intro')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('start-btn')).toBeDisabled();
  });

  test('can navigate to /setup after age confirmation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByTestId('age-gate').check();
    const startBtn = page.getByTestId('start-btn');
    await expect(startBtn).toBeVisible({ timeout: 10_000 });
    await startBtn.click();

    await page.waitForURL(/\/setup$/, { timeout: 10_000 });
    await expect(page.getByTestId('view-setup')).toBeVisible({ timeout: 5_000 });
  });
});
