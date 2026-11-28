import { expect, test } from '@playwright/test';

const CONSENT_KEY = 'digdevbox.analytics-consent.v1';

test.describe('DigDevBox Main consent and privacy settings', () => {
  test('keeps first-use choices in the document flow on homepage and tool routes', async ({ page }, testInfo) => {
    const cases = [
      { path: '/', name: 'homepage', placement: 'home-inline', anchor: '.home-hero', relation: 'after' },
      { path: '/json-workspace', name: 'json-workspace', placement: 'tool-inline', anchor: '.tool-content', relation: 'before' },
      { path: '/percentage-calculator', name: 'percentage-calculator', placement: 'tool-inline', anchor: '.tool-content', relation: 'before' },
    ] as const;

    for (const viewport of [
      { name: 'mobile', width: 390, height: 844 },
      { name: 'desktop', width: 1440, height: 900 },
    ] as const) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      for (const item of cases) {
        const analyticsRequests: string[] = [];
        const listener = (request: import('@playwright/test').Request) => {
          if (/googletagmanager\.com|google-analytics\.com/i.test(request.url())) {
            analyticsRequests.push(request.url());
          }
        };
        page.on('request', listener);
        await page.goto(item.path);
        const prompt = page.locator('#digdevbox-analytics-consent');
        await expect(prompt).toBeVisible();
        await expect(prompt).toHaveAttribute('data-placement', item.placement);
        await expect(prompt).not.toHaveCSS('position', 'fixed');
        await expect(prompt.getByRole('button', { name: 'Accept analytics' })).toBeVisible();
        await expect(prompt.getByRole('button', { name: 'Reject analytics' })).toBeVisible();

        const metrics = await page.evaluate(({ anchor, relation }) => {
          const promptElement = document.querySelector<HTMLElement>('#digdevbox-analytics-consent');
          const anchorElement = document.querySelector<HTMLElement>(anchor);
          const promptBox = promptElement?.getBoundingClientRect();
          const anchorBox = anchorElement?.getBoundingClientRect();
          const buttons = Array.from(promptElement?.querySelectorAll('button') ?? []);
          return {
            viewportWidth: document.documentElement.clientWidth,
            documentWidth: document.documentElement.scrollWidth,
            promptHeight: promptBox?.height ?? 0,
            promptBottom: promptBox?.bottom ?? 0,
            anchorTop: anchorBox?.top ?? 0,
            relationValid: Boolean(promptElement && anchorElement && (
              relation === 'after'
                ? promptElement.previousElementSibling === anchorElement
                : promptElement.nextElementSibling === anchorElement
            )),
            choiceHeights: buttons.map(button => button.getBoundingClientRect().height),
            settingsHeight: document.querySelector<HTMLElement>('[data-privacy-settings]')?.getBoundingClientRect().height ?? 0,
            promptPosition: promptElement ? getComputedStyle(promptElement).position : '',
          };
        }, { anchor: item.anchor, relation: item.relation });

        expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth);
        expect(metrics.relationValid).toBe(true);
        expect(metrics.promptPosition).toBe('relative');
        expect(metrics.choiceHeights).toHaveLength(2);
        metrics.choiceHeights.forEach(height => expect(height).toBeGreaterThanOrEqual(44));
        expect(metrics.settingsHeight).toBeGreaterThanOrEqual(44);
        expect(analyticsRequests).toEqual([]);
        expect(await page.evaluate(key => localStorage.getItem(key), CONSENT_KEY)).toBeNull();

        if (item.relation === 'before') {
          expect(metrics.promptBottom).toBeLessThanOrEqual(metrics.anchorTop);
          const firstInput = page.locator('.tool-content input:visible, .tool-content textarea:visible').first();
          await expect(firstInput).toBeVisible();
          const promptBox = await prompt.boundingBox();
          const inputBox = await firstInput.boundingBox();
          expect((promptBox?.y ?? 0) + (promptBox?.height ?? 0)).toBeLessThanOrEqual(inputBox?.y ?? 0);
        }

        await prompt.scrollIntoViewIfNeeded();
        await page.screenshot({
          path: testInfo.outputPath(`privacy-consent-${item.name}-${viewport.name}.png`),
          fullPage: false,
        });
        page.off('request', listener);
      }
    }
  });

  test('Reject leaves tools usable; preferences can be reopened, accepted and revoked', async ({ page }) => {
    const analyticsRequests: string[] = [];
    page.on('request', (request) => {
      if (/googletagmanager\.com|google-analytics\.com/i.test(request.url())) {
        analyticsRequests.push(request.url());
      }
    });
    await page.route('https://www.googletagmanager.com/**', route => route.abort());
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/percentage-calculator');

    const prompt = page.locator('#digdevbox-analytics-consent');
    await prompt.getByRole('button', { name: 'Reject analytics' }).click();
    await expect.poll(() => page.evaluate(key => localStorage.getItem(key), CONSENT_KEY)).toBe('rejected');
    await expect(page.locator('#digdevbox-analytics-consent')).toHaveCount(0);
    await expect(page.locator('script[src*="googletagmanager.com"]')).toHaveCount(0);
    expect(analyticsRequests).toEqual([]);

    await page.getByTestId('percentage-example-percent-of').click();
    await expect(page.getByTestId('percentageResult').locator('input')).toHaveValue('12');

    const settingsButton = page.getByRole('button', { name: 'Privacy settings' });
    await expect(settingsButton).toBeVisible();
    await settingsButton.focus();
    await settingsButton.click();
    const dialog = page.getByRole('dialog', { name: 'Privacy settings' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Current choice: optional analytics is disabled.');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(settingsButton).toBeFocused();

    await settingsButton.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Accept analytics' }).click();
    await expect.poll(() => page.evaluate(key => localStorage.getItem(key), CONSENT_KEY)).toBe('accepted');
    await expect(dialog).toBeHidden();
    await expect.poll(() => analyticsRequests.length).toBeGreaterThan(0);

    await settingsButton.click();
    await expect(dialog).toContainText('Current choice: optional analytics is enabled.');
    await dialog.getByRole('button', { name: 'Reject analytics' }).click();
    await expect.poll(() => page.evaluate(key => localStorage.getItem(key), CONSENT_KEY)).toBe('rejected');

    analyticsRequests.length = 0;
    await page.reload();
    await expect(page.locator('#digdevbox-analytics-consent')).toHaveCount(0);
    await expect(page.locator('script[src*="googletagmanager.com"]')).toHaveCount(0);
    expect(analyticsRequests).toEqual([]);
    await expect(page.getByRole('button', { name: 'Privacy settings' })).toBeVisible();
  });

  test('uses the Chinese text in both the inline choice and reopened settings', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'languages', {
        configurable: true,
        value: ['zh-CN'],
      });
    });
    await page.goto('/json-workspace');
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
    const prompt = page.locator('#digdevbox-analytics-consent');
    await expect(prompt).toContainText('隐私与分析选择');
    await expect(prompt).toContainText('可选分析服务仅记录页面访问');
    await expect(prompt.getByRole('button', { name: '接受分析' })).toBeVisible();
    await expect(prompt.getByRole('button', { name: '拒绝分析' })).toBeVisible();

    await page.locator('[data-privacy-settings]').click();
    const dialog = page.getByRole('dialog', { name: '隐私设置' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('当前尚未作出选择。');
    await expect(dialog.getByRole('button', { name: '接受分析' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: '拒绝分析' })).toBeVisible();
  });
});
