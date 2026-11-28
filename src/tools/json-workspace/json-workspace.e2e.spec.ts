import { expect, test } from '@playwright/test';

test.describe('JSON Workspace first-use privacy and hierarchy', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/json-workspace');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('discloses local persistence and share-link contents before the action', async ({ page }) => {
    const persistence = page.getByTestId('persistence-disclosure');
    const shareWarning = page.getByTestId('share-link-disclosure');
    const shareButton = page.getByTestId('share-link');

    await expect(persistence).toContainText('localStorage');
    await expect(persistence).toContainText('not cloud-synced or encrypted');
    await expect(shareWarning).toContainText('exported state files include the current input');
    await expect(shareWarning).toContainText('Base64URL encoding, not encryption');
    await expect(shareWarning).toContainText('anyone with the link can read it');
    await expect(shareWarning).toContainText('8,192 characters');
    await expect(shareButton).toBeVisible();
    await shareButton.focus();
    await expect(shareButton).toBeFocused();

    const warningAppearsBeforeAction = await shareWarning.evaluate((element) => {
      const button = document.querySelector('[data-test-id="share-link"]');
      return button !== null
        && (element.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    });
    expect(warningAppearsBeforeAction).toBe(true);

    // Sharing is a secondary workflow action; adding a processing step remains primary.
    await expect(shareButton).not.toHaveClass(/n-button--primary-type/);
    await expect(page.getByTestId('step-0-next')).toHaveClass(/n-button--primary-type/);
  });

  test('keeps the workflow and disclosure readable at mobile and desktop sizes', async ({ page }, testInfo) => {
    const viewports = [
      { name: 'mobile', width: 390, height: 844 },
      { name: 'desktop', width: 1440, height: 900 },
    ] as const;

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/json-workspace');

      const disclosure = page.getByTestId('workflow-disclosure');
      await expect(disclosure).toBeVisible();
      const width = await page.evaluate(() => ({
        viewport: window.innerWidth,
        document: document.documentElement.scrollWidth,
      }));
      expect(width.document).toBeLessThanOrEqual(width.viewport);
      await page.screenshot({
        path: testInfo.outputPath(`json-workspace-${viewport.name}.png`),
        fullPage: true,
      });
    }
  });

  test('uses a wide desktop workbench for 5–20 KB nested JSON and keeps mobile stacked', async ({ page }, testInfo) => {
    await page.evaluate(() => localStorage.setItem('digdevbox.analytics-consent.v1', 'rejected'));
    await page.reload();

    const prefix = '{"meta":{"source":"fixture","version":1},"records":[{"id":"record-1","profile":{"active":true,"roles":["developer","reviewer"]},"payload":"';
    const suffix = '"}]}';
    const targets = [5 * 1024, 10 * 1024, 20 * 1024];
    const input = page.getByTestId('json-input');

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.reload();
    await page.getByTestId('step-0-next').click();
    await page.getByText('Query (JSONPath)', { exact: true }).click();
    await page.getByTestId('query-input').fill('$.records[*].profile.active');

    const desktopMeasurements = [];
    for (const targetBytes of targets) {
      const fixture = `${prefix}${'x'.repeat(targetBytes - prefix.length - suffix.length)}${suffix}`;
      expect(new TextEncoder().encode(fixture).byteLength).toBe(targetBytes);
      await input.fill(fixture);
      await expect(page.getByTestId('query-count')).toContainText('1 match');
      await expect(page.getByTestId('step-1-error')).toHaveCount(0);

      const geometry = await page.evaluate(() => {
        const widthOf = (selector: string) => document.querySelector(selector)?.getBoundingClientRect().width ?? 0;
        return {
          viewport: window.innerWidth,
          document: document.documentElement.scrollWidth,
          header: widthOf('.tool-layout'),
          workbench: widthOf('.tool-content'),
          input: widthOf('.input-zone'),
          step: widthOf('.step-card'),
        };
      });
      expect(geometry.header).toBeGreaterThanOrEqual(940);
      expect(geometry.workbench).toBeGreaterThanOrEqual(940);
      expect(geometry.input).toBeGreaterThanOrEqual(940);
      expect(geometry.step).toBeGreaterThanOrEqual(940);
      expect(geometry.document).toBeLessThanOrEqual(geometry.viewport);
      desktopMeasurements.push({ payloadBytes: targetBytes, ...geometry });
    }

    await page.screenshot({
      path: testInfo.outputPath('json-workspace-wide-desktop.png'),
      fullPage: true,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByTestId('query-count')).toContainText('1 match');
    const mobileGeometry = await page.evaluate(() => {
      const widthOf = (selector: string) => document.querySelector(selector)?.getBoundingClientRect().width ?? 0;
      return {
        viewport: window.innerWidth,
        document: document.documentElement.scrollWidth,
        header: widthOf('.tool-layout'),
        workbench: widthOf('.tool-content'),
        input: widthOf('.input-zone'),
        step: widthOf('.step-card'),
      };
    });
    expect(mobileGeometry.header).toBeLessThanOrEqual(390);
    expect(mobileGeometry.workbench).toBeLessThanOrEqual(390);
    expect(mobileGeometry.input).toBeLessThanOrEqual(390);
    expect(mobileGeometry.step).toBeLessThanOrEqual(390);
    expect(mobileGeometry.document).toBeLessThanOrEqual(390);
    await page.screenshot({
      path: testInfo.outputPath('json-workspace-wide-mobile.png'),
      fullPage: true,
    });

    await testInfo.attach('json-workspace-geometry.json', {
      body: JSON.stringify({ desktop: desktopMeasurements, mobile: mobileGeometry }, null, 2),
      contentType: 'application/json',
    });
  });

  test('restores the current input after reloading the page', async ({ page }) => {
    const input = page.getByTestId('json-input');
    await input.fill('{"user":"Ada","active":true}');
    await expect(input).toHaveValue('{"user":"Ada","active":true}');
    await expect.poll(async () => page.evaluate(() => {
      const raw = localStorage.getItem('json-workspace:pipeline-v1');
      return raw ? JSON.parse(raw)[0]?.inputOverride : null;
    })).toBe('{"user":"Ada","active":true}');

    await page.reload();

    await expect(page.getByTestId('json-input')).toHaveValue('{"user":"Ada","active":true}');
    await expect(page.getByTestId('persistence-disclosure')).toBeVisible();
  });
});

test('renders the Main violet-blue palette on the JSON tool surface in both themes', async ({ page }, testInfo) => {
  const cases = [
    { theme: 'light', dark: false, primary: '#7e45ef', action: 'rgb(129, 78, 232)' },
    { theme: 'dark', dark: true, primary: '#a78bfa', action: 'rgb(129, 78, 232)' },
  ] as const;
  const viewports = [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'desktop', width: 1440, height: 900 },
  ] as const;

  for (const themeCase of cases) {
    await page.goto('/');
    await page.evaluate((theme) => {
      localStorage.setItem('vueuse-color-scheme', theme);
    }, themeCase.theme);

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/json-workspace');

      await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('dark')))
        .toBe(themeCase.dark);
      await expect(page.getByTestId('json-input')).toBeVisible();
      const primaryAction = page.getByTestId('step-0-next');
      await expect(primaryAction).toBeVisible();
      await expect(primaryAction).toHaveClass(/n-button--primary-type/);

      const colors = await primaryAction.evaluate((element) => {
        const root = getComputedStyle(document.documentElement);
        const button = getComputedStyle(element);
        return {
          brand: root.getPropertyValue('--dd-primary').trim().toLowerCase(),
          background: button.backgroundColor,
          foreground: button.color,
        };
      });
      expect(colors.brand).toBe(themeCase.primary);
      expect(colors.background).toBe(themeCase.action);
      expect(colors.foreground).toBe('rgb(255, 255, 255)');

      const width = await page.evaluate(() => ({
        viewport: window.innerWidth,
        document: document.documentElement.scrollWidth,
      }));
      expect(width.document).toBeLessThanOrEqual(width.viewport);
      await page.screenshot({
        path: testInfo.outputPath(`json-workspace-${themeCase.theme}-${viewport.name}.png`),
        fullPage: true,
      });
    }
  }
});
