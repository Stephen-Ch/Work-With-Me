import { test, expect } from '@playwright/test';

/**
 * @human Smoke test: app loads via static dist server
 * @proves The Work With Me landing and setup flow renders in a static build
 * @lastTouched 2025-12-22
 */
const SHARED_OPENING =
  'Use these preferences when they are relevant. Answer normally when my request is already clear and specific.';
const SHARED_CLOSING =
  'My explicit request overrides these defaults. When key information is missing, state a reasonable assumption and continue. Ask one question only when the answer would materially change the result.';
const LIMITED_MODIFIER =
  'For this session, keep responses compact and practical. Give the smallest useful answer first, trim optional detail, and expand only if I ask.';
const VERY_LIMITED_MODIFIER =
  'For this session, use essentials-only responses. Give one actionable step at a time, avoid extra options by default, and add depth only if I request it.';

const MODULE_SENTENCES = {
  'starting-work': {
    A: 'Give one clear first step before any deeper explanation.',
    B: 'Break the work into a short ordered plan with concrete actions.',
    C: 'Give the broader picture first, then recommend where to start.',
  },
  'information-load': {
    A: 'Keep responses brief and focus on essentials unless I ask for more.',
    B: 'Start with a short summary, then add only the detail needed to act.',
    C: 'Provide fuller context in a clear, scannable structure.',
  },
  'decision-support': {
    A: 'Recommend one option and explain why it is the best fit.',
    B: 'Compare the main options and tradeoffs concisely before concluding.',
    C: 'Ask one question first only when missing information could materially change the recommendation.',
  },
  'side-topics': {
    A: 'Keep me on the current task and flag drift clearly.',
    B: 'Briefly park useful side topics, then return to the current task.',
    C: 'Follow useful side topics unless I ask to return to the main task.',
  },
  'interruption-recovery': {
    A: 'Continue from the last action with little or no recap.',
    B: 'Give a brief recap, then provide the next step.',
    C: 'Reconstruct key decisions, open questions, and the next step before continuing.',
  },
} as const;

const QUESTION_IDS = [
  'starting-work',
  'information-load',
  'decision-support',
  'side-topics',
  'interruption-recovery',
] as const;

async function chooseByKeyboard(page: import('@playwright/test').Page, target: 'A' | 'B' | 'C'): Promise<void> {
  const optionA = page.getByTestId('option-A');
  await optionA.focus();

  if (target === 'A') {
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowUp');
  }
  if (target === 'B') {
    await page.keyboard.press('ArrowDown');
  }
  if (target === 'C') {
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
  }

  await page.keyboard.press('Space');
  await expect(page.getByTestId(`option-${target}`)).toBeChecked();
}

async function activateByKeyboard(page: import('@playwright/test').Page, testId: string): Promise<void> {
  const button = page.getByTestId(testId);
  await expect(button).toBeEnabled();
  await button.focus();
  await page.keyboard.press('Enter');
}

test.describe('Work With Me smoke (dist server)', () => {
  test('td-rawls-001 landing has enabled Start and no age gate', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByTestId('view-intro')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('start-btn')).toBeEnabled();
    await expect(page.getByTestId('age-gate')).toHaveCount(0);
    await expect(page.getByText(/13 or older/i)).toHaveCount(0);
  });

  test('td-rawls-001 direct /result is guarded with no session', async ({ page }) => {
    await page.goto('/result');
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveURL(/\/setup$/, { timeout: 10_000 });
    await expect(page.getByTestId('view-setup')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('document-preview')).toHaveCount(0);
  });

  test('td-rawls-001 keyboard completion covers question 1-5 and reaches result', async ({ page }) => {
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
      await chooseByKeyboard(page, answers[index]);
      await activateByKeyboard(page, 'next-btn');
    }

    await expect(page).toHaveURL(/\/result$/, { timeout: 10_000 });
    await expect(page.getByTestId('document-preview')).toBeVisible({ timeout: 5_000 });
  });

  test('td-rawls-001 keyboard back and replacement persist in final prompt', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByTestId('start-btn').click();
    await expect(page).toHaveURL(/\/setup$/, { timeout: 10_000 });

    await expect(page.getByTestId('progress-counter')).toContainText('Question 1 of 5');
    await chooseByKeyboard(page, 'B');
    await activateByKeyboard(page, 'next-btn');

    await expect(page.getByTestId('progress-counter')).toContainText('Question 2 of 5');
    await activateByKeyboard(page, 'back-btn');
    await expect(page.getByTestId('progress-counter')).toContainText('Question 1 of 5');
    await expect(page.getByTestId('option-B')).toBeChecked();

    await chooseByKeyboard(page, 'C');
    await activateByKeyboard(page, 'next-btn');

    const remainingAnswers = ['A', 'B', 'C', 'A'] as const;
    for (let index = 0; index < remainingAnswers.length; index++) {
      await expect(page.getByTestId('progress-counter')).toContainText(`Question ${index + 2} of 5`);
      await chooseByKeyboard(page, remainingAnswers[index]);
      await activateByKeyboard(page, 'next-btn');
    }

    await expect(page).toHaveURL(/\/result$/, { timeout: 10_000 });
    const prompt = ((await page.getByTestId('document-preview').textContent()) ?? '').replace(/\r\n/g, '\n');
    expect(prompt).toContain(MODULE_SENTENCES['starting-work'].C);
    expect(prompt).not.toContain(MODULE_SENTENCES['starting-work'].B);
  });

  test('td-rawls-001 result prompt shape is deterministic and capacity starts unselected', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('start-btn').click();
    await expect(page).toHaveURL(/\/setup$/, { timeout: 10_000 });

    const answers = ['A', 'B', 'C', 'A', 'B'] as const;
    for (let index = 0; index < answers.length; index++) {
      await expect(page.getByTestId('progress-counter')).toContainText(`Question ${index + 1} of 5`);
      await chooseByKeyboard(page, answers[index]);
      await activateByKeyboard(page, 'next-btn');
    }

    await expect(page).toHaveURL(/\/result$/, { timeout: 10_000 });
    const preview = page.getByTestId('document-preview');
    await expect(preview).toBeVisible({ timeout: 5_000 });

    const promptText = ((await preview.textContent()) ?? '').replace(/\r\n/g, '\n').trim();
    expect(promptText.length).toBeGreaterThan(0);

    const lines = promptText.split('\n');
    expect(lines.length).toBe(3);
    expect(lines[0]).toBe(SHARED_OPENING);

    for (let index = 0; index < QUESTION_IDS.length; index++) {
      const questionId = QUESTION_IDS[index];
      const selectedCode = answers[index];
      expect(lines[1]).toContain(MODULE_SENTENCES[questionId][selectedCode]);
    }

    expect(lines[2]).toBe(SHARED_CLOSING);
    await expect(page.getByTestId('capacity-fieldset')).toContainText('How much bandwidth do you have right now?');
    await expect(page.getByTestId('capacity-modifier-preview')).toHaveCount(0);
    await expect(page.getByTestId('capacity-copy-btn')).toHaveCount(0);
  });

  test('td-rawls-001 capacity modifier flow is temporary, persistent, and independent', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('start-btn').click();
    await expect(page).toHaveURL(/\/setup$/, { timeout: 10_000 });

    const answers = ['A', 'B', 'C', 'A', 'B'] as const;
    for (let index = 0; index < answers.length; index++) {
      await expect(page.getByTestId('progress-counter')).toContainText(`Question ${index + 1} of 5`);
      await chooseByKeyboard(page, answers[index]);
      await activateByKeyboard(page, 'next-btn');
    }

    await expect(page).toHaveURL(/\/result$/, { timeout: 10_000 });
    const promptBefore = ((await page.getByTestId('document-preview').textContent()) ?? '').replace(/\r\n/g, '\n').trim();

    await expect(page.getByTestId('capacity-fieldset')).toContainText('How much bandwidth do you have right now?');

    await page.getByTestId('capacity-option-usual').focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('capacity-option-limited')).toBeChecked();

    const limitedModifier = page.getByTestId('capacity-modifier-preview');
    await expect(limitedModifier).toBeVisible();
    await expect(limitedModifier).toContainText(LIMITED_MODIFIER);

    const promptAfterLimited = ((await page.getByTestId('document-preview').textContent()) ?? '').replace(/\r\n/g, '\n').trim();
    expect(promptAfterLimited).toBe(promptBefore);

    await page.reload();
    await expect(page).toHaveURL(/\/result$/, { timeout: 10_000 });
    await expect(page.getByTestId('view-result')).toBeVisible({ timeout: 10_000 });

    await expect(page.getByTestId('capacity-option-limited')).toBeChecked();
    await expect(page.getByTestId('capacity-modifier-preview')).toContainText(LIMITED_MODIFIER);

    await page.getByTestId('capacity-option-limited').focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('capacity-option-very-limited')).toBeChecked();
    await expect(page.getByTestId('capacity-modifier-preview')).toContainText(VERY_LIMITED_MODIFIER);

    const promptAfterVeryLimited = ((await page.getByTestId('document-preview').textContent()) ?? '').replace(/\r\n/g, '\n').trim();
    expect(promptAfterVeryLimited).toBe(promptBefore);

    await page.getByTestId('capacity-option-very-limited').focus();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await expect(page.getByTestId('capacity-option-usual')).toBeChecked();
    await expect(page.getByTestId('capacity-modifier-preview')).toHaveCount(0);
    await expect(page.getByTestId('capacity-copy-btn')).toHaveCount(0);

    await page.getByTestId('start-over-btn').click();
    await expect(page).toHaveURL(/\/$/, { timeout: 10_000 });
    await expect(page.getByTestId('view-intro')).toBeVisible({ timeout: 10_000 });

    await page.goto('/result');
    await expect(page).toHaveURL(/\/setup$/, { timeout: 10_000 });
    await expect(page.getByTestId('view-setup')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('document-preview')).toHaveCount(0);
  });
});
