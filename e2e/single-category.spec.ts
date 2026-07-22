import { test, expect } from '@playwright/test';

/**
 * Work With Me smoke test.
 * Covers the active product flow from landing to result, copy, and start over.
 */
test('Work With Me flow completes and returns home on start over', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);

  await page.goto('/');
  await expect(page.getByTestId('view-intro')).toBeVisible();
  await expect(page.getByTestId('start-btn')).toBeDisabled();

  await page.getByTestId('age-gate').check();
  await page.getByTestId('start-btn').click();
  await page.waitForURL(/\/setup$/);

  const answers = ['A', 'B', 'C', 'A', 'B', 'C'] as const;

  for (let index = 0; index < answers.length; index++) {
    await expect(page.locator('body')).toContainText(`${index + 1} of 6`);
    await expect(page.getByTestId('option-A')).toBeVisible();
    await expect(page.getByTestId('option-B')).toBeVisible();
    await expect(page.getByTestId('option-C')).toBeVisible();

    await page.getByTestId(`option-${answers[index]}`).click();
    await page.getByTestId('next-btn').click();
  }

  await page.waitForURL(/\/result$/);
  await expect(page.getByTestId('usage-instructions')).toBeVisible();

  const previewText = await page.getByTestId('document-preview').textContent();
  await page.getByTestId('copy-btn').click();
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());

  const normalize = (value: string | null) => (value ?? '').replace(/\r\n/g, '\n').trim();
  expect(normalize(clipboardText)).toBe(normalize(previewText));

  await page.getByTestId('start-over-btn').click();
  await page.waitForURL(/\/$/);
  await expect(page.getByTestId('age-gate')).toBeVisible();
});
