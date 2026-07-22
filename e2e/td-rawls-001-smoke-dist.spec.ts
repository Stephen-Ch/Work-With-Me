import { test, expect } from '@playwright/test';

/**
 * @human Smoke test: app loads via static dist server
 * @proves The Work With Me landing and setup flow renders in a static build
 * @lastTouched 2025-12-22
 */
test.describe('Work With Me smoke (dist server)', () => {
  test('landing loads and Start is enabled', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByTestId('view-intro')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('start-btn')).toBeEnabled();
  });

  test('completes five-question permanent flow and supports start over', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const startBtn = page.getByTestId('start-btn');
    await expect(startBtn).toBeVisible({ timeout: 10_000 });
    await startBtn.click();

    await expect(page).toHaveURL(/\/setup$/, { timeout: 10_000 });
    await expect(page.getByTestId('view-setup')).toBeVisible({ timeout: 5_000 });

    const answers = ['A', 'B', 'C', 'A', 'B'] as const;
    for (let index = 0; index < answers.length; index++) {
      await expect(page.getByTestId('progress-counter')).toContainText(`Question ${index + 1} of 5`);

      await page.getByTestId(`option-${answers[index]}`).click();

      const nextBtn = page.getByTestId('next-btn');
      await expect(nextBtn).toBeEnabled();
      await nextBtn.click();
    }

    await expect(page).toHaveURL(/\/result$/, { timeout: 10_000 });
    const preview = page.getByTestId('document-preview');
    await expect(preview).toBeVisible({ timeout: 5_000 });

    const promptText = ((await preview.textContent()) ?? '').replace(/\r\n/g, '\n').trim();
    expect(promptText.length).toBeGreaterThan(0);

    await page.getByTestId('start-over-btn').click();
    await expect(page).toHaveURL(/\/$/, { timeout: 10_000 });
    await expect(page.getByTestId('view-intro')).toBeVisible({ timeout: 10_000 });
  });
});
