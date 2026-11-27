import { expect, test } from '@playwright/test';

test.describe('Tool - Percentage calculator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/percentage-calculator');
  });

  test('Has the intended search title, description and H1', async ({ page }) => {
    const response = await page.goto('/percentage-calculator/');
    expect(response).not.toBeNull();
    const prerenderedHtml = await response!.text();
    expect(prerenderedHtml).toContain('<title>Percentage Calculator — 7 Modes - DigDevBox</title>');
    expect(prerenderedHtml).toContain('Percentage Calculator — 7 Modes');
    expect(prerenderedHtml).not.toContain('Percentage Calculator — Percent of, Change & Difference');

    await expect(page).toHaveTitle('Percentage Calculator — 7 Modes - DigDevBox');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      'Calculate percentages, discounts, percentage change, reverse percentages and percentage points. Seven modes plus batch CSV/TSV export and worked formulas.',
    );
    await expect(page.locator('h1')).toHaveText('Percentage Calculator');
  });

  test('loads common worked examples from the first-screen shortcuts', async ({ page }) => {
    await page.getByTestId('percentage-example-percent-of').click();
    await expect(page.getByTestId('percentageX').locator('input')).toHaveValue('15');
    await expect(page.getByTestId('percentageY').locator('input')).toHaveValue('80');
    await expect(page.getByTestId('percentageResult').locator('input')).toHaveValue('12');
    await expect(page.getByTestId('percentage-details-percent-of')).toContainText('15% of 80 is 12.');

    await page.getByTestId('percentage-example-part-to-whole').click();
    await expect(page.getByTestId('numberX').locator('input')).toHaveValue('30');
    await expect(page.getByTestId('numberY').locator('input')).toHaveValue('120');
    await expect(page.getByTestId('numberResult').locator('input')).toHaveValue('25');
    await expect(page.getByTestId('percentage-details-part-to-whole')).toContainText('30 is 25% of 120.');

    await page.getByTestId('percentage-example-percentage-change').click();
    await expect(page.getByTestId('numberFrom').locator('input')).toHaveValue('80');
    await expect(page.getByTestId('numberTo').locator('input')).toHaveValue('92');
    await expect(page.getByTestId('percentageIncreaseDecrease').locator('input')).toHaveValue('15');

    await page.getByTestId('percentage-example-adjustment').click();
    await expect(page.getByTestId('adjustmentValue').locator('input')).toHaveValue('80');
    await expect(page.getByTestId('adjustmentPercent').locator('input')).toHaveValue('15');
    await expect(page.getByTestId('increasedValue').locator('input')).toHaveValue('92');
    await expect(page.getByTestId('decreasedValue').locator('input')).toHaveValue('68');
  });

  test('shows one focused task at a time and switches between all seven workflows', async ({ page }) => {
    const modeButtons = page.locator('.percentage-mode-button');
    await expect(modeButtons).toHaveCount(7);
    await expect(page.getByTestId('percentageX')).toBeVisible();
    await expect(page.getByTestId('numberX')).toBeHidden();

    await page.getByRole('button', { name: 'Part as a percentage of a whole', exact: true }).click();
    await expect(page.getByTestId('numberX')).toBeVisible();
    await expect(page.getByTestId('percentageX')).toBeHidden();

    await page.getByRole('button', { name: 'Percentage change from old to new', exact: true }).click();
    await expect(page.getByTestId('numberFrom')).toBeVisible();
    await expect(page.getByTestId('numberX')).toBeHidden();

    await page.getByRole('button', { name: 'Increase or decrease a value', exact: true }).click();
    await expect(page.getByTestId('adjustmentValue')).toBeVisible();

    await page.getByRole('button', { name: 'Find the value before a percentage change', exact: true }).click();
    await expect(page.getByTestId('reverseFinalValue')).toBeVisible();

    await page.getByRole('button', { name: 'Symmetric percentage difference', exact: true }).click();
    await expect(page.getByTestId('differenceA')).toBeVisible();

    await page.getByRole('button', { name: 'Percentage-point change', exact: true }).click();
    await expect(page.getByTestId('rateFrom')).toBeVisible();
    await expect(page.getByTestId('percentageX')).toBeHidden();

    await expect(page.getByRole('button', { name: 'Percentage-point change', exact: true })).toHaveAttribute('aria-pressed', 'true');
  });

  test('labels primary workflows with explicit input roles and denominator guidance', async ({ page }) => {
    await expect(page.getByRole('group', { name: 'Choose a percentage calculation' })).toBeVisible();
    await expect(page.locator('.percentage-mode-button')).toHaveCount(7);

    await page.getByRole('button', { name: 'Percentage change from old to new', exact: true }).click();
    const change = page.getByTestId('percentage-mode-percentage-change');
    await expect(change).toContainText('Old value (baseline)');
    await expect(change).toContainText('New value');
    await expect(page.getByTestId('percentage-hint-change')).toContainText('baseline (denominator)');
    await page.getByTestId('numberFrom').locator('input').fill('80');
    await page.getByTestId('numberTo').locator('input').fill('92');
    await expect(page.getByTestId('percentage-details-change')).toContainText('(92 − 80) ÷ 80 × 100 = 15%');

    await page.getByRole('button', { name: 'Symmetric percentage difference', exact: true }).click();
    await expect(page.getByTestId('percentage-mode-difference-card')).toBeVisible();
    await expect(page.getByTestId('percentage-hint-difference')).toContainText('neither value is treated as the baseline');
    await page.getByTestId('differenceA').locator('input').fill('100');
    await page.getByTestId('differenceB').locator('input').fill('150');
    await expect(page.getByTestId('percentageDifference').locator('input')).toHaveValue('40');

    await page.getByRole('button', { name: 'Percentage-point change', exact: true }).click();
    await page.getByTestId('rateFrom').locator('input').fill('4');
    await page.getByTestId('rateTo').locator('input').fill('6');
    await expect(page.getByTestId('percentage-hint-points')).toContainText('+2 percentage points');
    await expect(page.getByTestId('percentage-hint-points')).toContainText('+50% relative to the old rate');
  });

  test('Explains all seven supported percentage tasks with correct formulas', async ({ page }) => {
    const guide = page.getByTestId('percentage-calculator-guide');
    await expect(guide).toContainText('seven common percentage problems');
    await expect(guide).toContainText('15% of 80 is 12');
    await expect(guide).toContainText('30 is 25% of 120');
    await expect(guide).toContainText('a 15% increase');
    await expect(guide).toContainText('reducing 80 by 15% gives 68');
    await expect(guide).toContainText('120 after a 20% increase came from 120 ÷ 1.20 = 100');
    await expect(guide).toContainText('the symmetric difference is 40%');
    await expect(guide).toContainText('5% to 7% is +2 percentage points');
    await expect(guide).toContainText('An original value of zero makes percentage change undefined');
  });

  test('shows live in-words explanations and substituted formulas for all seven operations', async ({ page }) => {
    await page.getByTestId('percentageX').locator('input').fill('15');
    await page.getByTestId('percentageY').locator('input').fill('80');
    await expect(page.getByTestId('percentage-details-percent-of')).toContainText('15% of 80 is 12.');
    await expect(page.getByTestId('percentage-details-percent-of')).toContainText('(15 ÷ 100) × 80 = 12');

    await page.getByRole('button', { name: 'Part as a percentage of a whole', exact: true }).click();
    await page.getByTestId('numberX').locator('input').fill('30');
    await page.getByTestId('numberY').locator('input').fill('120');
    await expect(page.getByTestId('percentage-details-part-to-whole')).toContainText('30 is 25% of 120.');
    await expect(page.getByTestId('percentage-details-part-to-whole')).toContainText('(30 ÷ 120) × 100 = 25%');

    await page.getByRole('button', { name: 'Percentage change from old to new', exact: true }).click();
    await page.getByTestId('numberFrom').locator('input').fill('80');
    await page.getByTestId('numberTo').locator('input').fill('92');
    await expect(page.getByTestId('percentage-details-change')).toContainText('The percentage change from 80 to 92 is 15%.');
    await expect(page.getByTestId('percentage-details-change')).toContainText('(92 − 80) ÷ 80 × 100 = 15%');

    await page.getByRole('button', { name: 'Increase or decrease a value', exact: true }).click();
    await page.getByTestId('adjustmentValue').locator('input').fill('80');
    await page.getByTestId('adjustmentPercent').locator('input').fill('15');
    await expect(page.getByTestId('percentage-details-adjustment')).toContainText('Increasing 80 by 15% gives 92.');
    await expect(page.getByTestId('percentage-details-adjustment')).toContainText('Decreasing 80 by 15% gives 68.');

    await page.getByRole('button', { name: 'Find the value before a percentage change', exact: true }).click();
    await page.getByTestId('reverseFinalValue').locator('input').fill('120');
    await page.getByTestId('reversePercent').locator('input').fill('20');
    await expect(page.getByTestId('percentage-details-reverse')).toContainText('Before a 20% increase, 120 was 100.');
    await expect(page.getByTestId('percentage-details-reverse')).toContainText('Before a 20% decrease, 120 was 150.');

    await page.getByRole('button', { name: 'Symmetric percentage difference', exact: true }).click();
    await page.getByTestId('differenceA').locator('input').fill('100');
    await page.getByTestId('differenceB').locator('input').fill('150');
    await expect(page.getByTestId('percentage-details-difference')).toContainText('The symmetric percentage difference between 100 and 150 is 40%.');

    await page.getByRole('button', { name: 'Percentage-point change', exact: true }).click();
    await page.getByTestId('rateFrom').locator('input').fill('5');
    await page.getByTestId('rateTo').locator('input').fill('7');
    await expect(page.getByTestId('percentage-details-points')).toContainText('The change from 5% to 7% is 2 percentage points.');
  });

  test.describe('Chinese result explanations', () => {
    test('shows localized explanation labels and formula for a percentage result', async ({ page }) => {
      // Simulate a first visit from a Chinese-language browser deterministically.
      // Reset the persisted choice before the app bootstraps on the next navigation.
      await page.addInitScript(() => {
        localStorage.removeItem('locale');
        Object.defineProperty(navigator, 'languages', {
          configurable: true,
          get: () => ['zh-CN', 'zh'],
        });
      });
      await page.reload();
      await page.getByTestId('percentageX').locator('input').fill('15');
      await page.getByTestId('percentageY').locator('input').fill('80');
      const details = page.getByTestId('percentage-details-percent-of');
      await expect(details).toContainText('结果说明');
      await expect(details).toContainText('80 的 15% 是 12。');
      await expect(details).toContainText('计算公式');
    });
  });
  test('Answers common percentage questions with supported formulas', async ({ page }) => {
    const guide = page.getByTestId('percentage-calculator-guide');
    await expect(guide).toContainText('How do I calculate a percentage of a number?');
    await expect(guide).toContainText('18% of 250 is');
    await expect(guide).toContainText('How do I find what percentage one number is of another?');
    await expect(guide).toContainText('The total cannot be zero');
    await expect(guide).toContainText('How do I calculate percentage increase or decrease?');
    await expect(guide).toContainText('An original value of zero makes percentage change undefined');
    await expect(guide).toContainText('How do I find the original value before a discount or increase?');
    await expect(guide).toContainText('What is the difference between percentage change and percentage difference?');
    await expect(guide).toContainText('What is a percentage-point change?');
    await expect(guide).toContainText('How do I calculate a discount or add sales tax?');
    await expect(guide).toContainText('actual tax rules depend on the product and location');
  });

  test('Correctly works out all seven percentage calculations', async ({ page }) => {
    await page.getByTestId('percentageX').locator('input').fill('123');
    await page.getByTestId('percentageY').locator('input').fill('456');
    await expect(page.getByTestId('percentageResult').locator('input')).toHaveValue('560.88');

    await page.getByRole('button', { name: 'Part as a percentage of a whole', exact: true }).click();
    await page.getByTestId('numberX').locator('input').fill('123');
    await page.getByTestId('numberY').locator('input').fill('456');
    await expect(page.getByTestId('numberResult').locator('input')).toHaveValue('26.973684210526315');

    await page.getByRole('button', { name: 'Percentage change from old to new', exact: true }).click();
    await page.getByTestId('numberFrom').locator('input').fill('123');
    await page.getByTestId('numberTo').locator('input').fill('456');
    await expect(page.getByTestId('percentageIncreaseDecrease').locator('input')).toHaveValue('270.7317073170732');

    await page.getByRole('button', { name: 'Increase or decrease a value', exact: true }).click();
    await page.getByTestId('adjustmentValue').locator('input').fill('80');
    await page.getByTestId('adjustmentPercent').locator('input').fill('15');
    await expect(page.getByTestId('increasedValue').locator('input')).toHaveValue('92');
    await expect(page.getByTestId('decreasedValue').locator('input')).toHaveValue('68');

    await page.getByRole('button', { name: 'Find the value before a percentage change', exact: true }).click();
    await page.getByTestId('reverseFinalValue').locator('input').fill('120');
    await page.getByTestId('reversePercent').locator('input').fill('20');
    await expect(page.getByTestId('originalBeforeIncrease').locator('input')).toHaveValue('100');
    await expect(page.getByTestId('originalBeforeDecrease').locator('input')).toHaveValue('150');

    await page.getByTestId('reverseFinalValue').locator('input').fill('80');
    await expect(page.getByTestId('originalBeforeDecrease').locator('input')).toHaveValue('100');

    await page.getByRole('button', { name: 'Symmetric percentage difference', exact: true }).click();
    await page.getByTestId('differenceA').locator('input').fill('100');
    await page.getByTestId('differenceB').locator('input').fill('150');
    await expect(page.getByTestId('percentageDifference').locator('input')).toHaveValue('40');

    await page.getByTestId('differenceA').locator('input').fill('150');
    await page.getByTestId('differenceB').locator('input').fill('100');
    await expect(page.getByTestId('percentageDifference').locator('input')).toHaveValue('40');

    await page.getByRole('button', { name: 'Percentage-point change', exact: true }).click();
    await page.getByTestId('rateFrom').locator('input').fill('5');
    await page.getByTestId('rateTo').locator('input').fill('7');
    await expect(page.getByTestId('percentagePointChange').locator('input')).toHaveValue('2');
    await page.getByTestId('rateFrom').locator('input').fill('7');
    await page.getByTestId('rateTo').locator('input').fill('5');
    await expect(page.getByTestId('percentagePointChange').locator('input')).toHaveValue('-2');
  });

  test('Handles incomplete input and mathematically undefined cases safely', async ({ page }) => {
    await page.getByTestId('percentageX').locator('input').fill('123');
    await expect(page.getByTestId('percentageResult').locator('input')).toHaveValue('');

    await page.getByRole('button', { name: 'Part as a percentage of a whole', exact: true }).click();
    await page.getByTestId('numberX').locator('input').fill('45');
    await page.getByTestId('numberY').locator('input').fill('0');
    await expect(page.getByTestId('numberResult').locator('input')).toHaveValue('');

    await page.getByRole('button', { name: 'Percentage change from old to new', exact: true }).click();
    await page.getByTestId('numberFrom').locator('input').fill('0');
    await page.getByTestId('numberTo').locator('input').fill('100');
    await expect(page.getByTestId('percentageIncreaseDecrease').locator('input')).toHaveValue('');

    await page.getByRole('button', { name: 'Find the value before a percentage change', exact: true }).click();
    await page.getByTestId('reverseFinalValue').locator('input').fill('120');
    await page.getByTestId('reversePercent').locator('input').fill('-100');
    await expect(page.getByTestId('originalBeforeIncrease').locator('input')).toHaveValue('');

    await page.getByTestId('reverseFinalValue').locator('input').fill('80');
    await page.getByTestId('reversePercent').locator('input').fill('100');
    await expect(page.getByTestId('originalBeforeDecrease').locator('input')).toHaveValue('');

    await page.getByRole('button', { name: 'Symmetric percentage difference', exact: true }).click();
    await page.getByTestId('differenceA').locator('input').fill('0');
    await page.getByTestId('differenceB').locator('input').fill('0');
    await expect(page.getByTestId('percentageDifference').locator('input')).toHaveValue('');

    await page.getByRole('button', { name: 'Percentage-point change', exact: true }).click();
    await page.getByTestId('rateFrom').locator('input').fill('5');
    await expect(page.getByTestId('percentagePointChange').locator('input')).toHaveValue('');
  });

  test('calculates labelled batch rows, copies formulas and CSV, and clears local history', async ({ page }) => {
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            document.documentElement.setAttribute('data-test-clipboard', text);
          },
        },
      });
    });

    await page.getByTestId('percentage-batch-panel').locator('summary').click();
    await page.getByTestId('percentage-batch-mode').selectOption('percent-of');
    await page.getByTestId('percentage-batch-input').fill('Groceries\t20\t150\nTaxi\t10\t40');
    await page.getByTestId('percentage-batch-run').click();

    const groceries = page.getByTestId('percentage-batch-result-1');
    const taxi = page.getByTestId('percentage-batch-result-2');
    await expect(groceries).toContainText('Groceries');
    await expect(groceries).toContainText('(20 ÷ 100) × 150 = 30');
    await expect(groceries).toContainText('30');
    await expect(taxi).toContainText('4');
    await expect(page.getByTestId('percentage-batch-history-item')).toHaveCount(1);

    await groceries.getByRole('button', { name: 'Copy row' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-test-clipboard', /Groceries/);
    await expect(page.locator('html')).toHaveAttribute('data-test-clipboard', /30/);

    await page.getByTestId('percentage-batch-copy-csv').click();
    await expect(page.locator('html')).toHaveAttribute('data-test-clipboard', /"Groceries","20","150"/);
    await expect(page.locator('html')).toHaveAttribute('data-test-clipboard', /"Taxi","10","40"/);

    await page.getByTestId('percentage-batch-copy-tsv').click();
    await expect(page.locator('html')).toHaveAttribute('data-test-clipboard', /Input A\tInput B/);
    await expect(page.locator('html')).toHaveAttribute('data-test-clipboard', /Groceries\t20\t150/);

    await page.getByTestId('percentage-batch-history-item').getByRole('button', { name: 'Restore' }).click();
    await expect(page.getByTestId('percentage-batch-input')).toHaveValue('Groceries\t20\t150\nTaxi\t10\t40');

    await page.getByTestId('percentage-batch-clear-history').click();
    await expect(page.getByTestId('percentage-batch-history-item')).toHaveCount(0);
    await expect(page.getByTestId('percentage-batch-status')).toContainText('Local history cleared');
  });

  test('isolates invalid rows and keeps valid batch results available', async ({ page }) => {
    await page.getByTestId('percentage-batch-panel').locator('summary').click();
    await page.getByTestId('percentage-batch-mode').selectOption('part-to-whole');
    await page.getByTestId('percentage-batch-input').fill('Invalid\t30\t0\nValid\t30\t120');
    await page.getByTestId('percentage-batch-run').click();

    await expect(page.getByTestId('percentage-batch-result-1')).toContainText('whole value cannot be zero');
    await expect(page.getByTestId('percentage-batch-result-2')).toContainText('25%');
    await expect(page.getByTestId('percentage-batch-status')).toContainText('1 of 2 rows calculated');
  });

  test('downloads CSV and TSV files from the batch results', async ({ page }) => {
    await page.getByTestId('percentage-batch-panel').locator('summary').click();
    await page.getByTestId('percentage-batch-input').fill('Groceries\t20\t150\nTaxi\t10\t40');
    await page.getByTestId('percentage-batch-run').click();

    const csvPromise = page.waitForEvent('download');
    await page.getByTestId('percentage-batch-download-csv').click();
    expect((await csvPromise).suggestedFilename()).toBe('percentage-calculations.csv');

    const tsvPromise = page.waitForEvent('download');
    await page.getByTestId('percentage-batch-download-tsv').click();
    expect((await tsvPromise).suggestedFilename()).toBe('percentage-calculations.tsv');
  });
  test('calculates stacked discounts step by step, reorders steps, and copies the summary', async ({ page }) => {
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            document.documentElement.setAttribute('data-test-clipboard', text);
          },
        },
      });
    });

    const panel = page.getByTestId('percentage-sequential-panel');
    await panel.locator('summary').click();
    await expect(panel).toContainText('Sequential percentage adjustments');
    await expect(page.getByTestId('percentage-sequential-result-1')).toContainText('100 → 80');
    await expect(page.getByTestId('percentage-sequential-result-2')).toContainText('80 → 72');
    await expect(page.getByTestId('percentage-sequential-final')).toHaveText('72');
    await expect(page.getByTestId('percentage-sequential-effective-change')).toHaveText('-28%');
    await expect(panel).toContainText('100 × 0.8 × 0.9 = 72');
    await expect(panel).toContainText('28% off overall, not 30%');

    await page.getByTestId('percentage-sequential-up-2').click();
    await expect(page.getByTestId('percentage-sequential-result-1')).toContainText('100 → 90');
    await expect(page.getByTestId('percentage-sequential-result-2')).toContainText('90 → 72');
    await expect(page.getByTestId('percentage-sequential-final')).toHaveText('72');

    await page.getByTestId('percentage-sequential-add').click();
    await expect(page.getByTestId('percentage-sequential-step-3')).toBeVisible();
    await expect(page.getByTestId('percentage-sequential-final')).toHaveText('64.8');
    await page.getByTestId('percentage-sequential-remove-3').click();
    await expect(page.getByTestId('percentage-sequential-step-3')).toHaveCount(0);
    await expect(page.getByTestId('percentage-sequential-final')).toHaveText('72');

    await page.getByTestId('percentage-sequential-rate-1').locator('input').fill('101');
    await expect(page.getByTestId('percentage-sequential-error')).toContainText('A decrease cannot exceed 100%');
    await page.getByTestId('percentage-sequential-example').click();
    await page.getByTestId('percentage-sequential-copy').click();
    await expect(page.locator('html')).toHaveAttribute('data-test-clipboard', /Starting amount: 100/);
    await expect(page.locator('html')).toHaveAttribute('data-test-clipboard', /Final amount: 72/);
    await expect(page.locator('html')).toHaveAttribute('data-test-clipboard', /-28%/);
  });
});

test.describe('Percentage calculator primary UI Chinese localization', () => {
  test.use({ locale: 'zh-CN' });

  test('localizes task selection, baseline labels and rate-change guidance', async ({ page }) => {
    await page.goto('/percentage-calculator');
    await expect(page.getByRole('group', { name: '选择百分比计算方式' })).toBeVisible();
    await expect(page.locator('.percentage-mode-button')).toHaveCount(7);

    await page.getByRole('button', { name: '计算从原始值到新值的百分比变化', exact: true }).click();
    const change = page.getByTestId('percentage-mode-percentage-change');
    await expect(change).toContainText('原始值（基数）');
    await expect(change).toContainText('新值');
    await expect(page.getByTestId('percentage-hint-change')).toContainText('分母');
    await page.getByTestId('numberFrom').locator('input').fill('80');
    await page.getByTestId('numberTo').locator('input').fill('92');
    await expect(page.getByTestId('percentage-details-change')).toContainText('百分比变化为 15%');

    await page.getByRole('button', { name: '对称百分比差异', exact: true }).click();
    await expect(page.getByTestId('percentage-hint-difference')).toContainText('两个数值都不作为起始基数');

    await page.getByRole('button', { name: '比率的百分点变化', exact: true }).click();
    await expect(page.getByTestId('percentage-points-card')).toContainText('旧比率 (%)');
    await expect(page.getByTestId('percentage-points-card')).toContainText('新比率 (%)');
    await page.getByTestId('rateFrom').locator('input').fill('4');
    await page.getByTestId('rateTo').locator('input').fill('6');
    await expect(page.getByTestId('percentage-hint-points')).toContainText('增加了 2 个百分点');
    await expect(page.getByTestId('percentage-hint-points')).toContainText('增长率为 50%');
  });
});

test.describe('Percentage calculator batch Chinese localization', () => {
  test.use({ locale: 'zh-CN' });

  test('renders batch controls and validation in Chinese when browser language is Chinese', async ({ page }) => {
    await page.goto('/percentage-calculator');
    const panel = page.getByTestId('percentage-batch-panel');
    await panel.locator('summary').click();
    await expect(panel).toContainText('\u767E\u5206\u6BD4\u6279\u91CF\u8BA1\u7B97\u5668');
    await expect(panel).toContainText('\u8BA1\u7B97\u7C7B\u578B');
    await expect(panel).toContainText('\u4E24\u5217\uFF1A\u767E\u5206\u6BD4\u3001\u6570\u503C');
    await page.getByTestId('percentage-batch-mode').selectOption('part-to-whole');
    await page.getByTestId('percentage-batch-input').fill('\u65E0\u6548\t30\t0');
    await page.getByTestId('percentage-batch-run').click();
    await expect(page.getByTestId('percentage-batch-result-1')).toContainText('\u6574\u4F53\u6570\u503C\u4E0D\u80FD\u4E3A\u96F6');
  });
  test('renders the sequential adjustment workflow in Chinese', async ({ page }) => {
    await page.goto('/percentage-calculator');
    const panel = page.getByTestId('percentage-sequential-panel');
    await panel.locator('summary').click();
    await expect(panel).toContainText('\u8FDE\u7EED\u767E\u5206\u6BD4\u8C03\u6574');
    await expect(panel).toContainText('\u9010\u6B65\u8BA1\u7B97\u7ED3\u679C');
    await expect(page.getByTestId('percentage-sequential-final')).toHaveText('72');
    await expect(page.getByTestId('percentage-sequential-effective-change')).toContainText('-28%');
    await expect(panel).toContainText('\u603B\u6298\u6263\u662F 28%');
  });
});
