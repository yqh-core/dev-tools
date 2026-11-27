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
    const disclosure = page.getByTestId('workflow-disclosure');

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(disclosure).toBeVisible();
    const mobileWidth = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
    }));
    expect(mobileWidth.document).toBeLessThanOrEqual(mobileWidth.viewport);
    await page.screenshot({
      path: testInfo.outputPath('json-workspace-mobile.png'),
      fullPage: true,
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(disclosure).toBeVisible();
    const desktopWidth = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
    }));
    expect(desktopWidth.document).toBeLessThanOrEqual(desktopWidth.viewport);
    await page.screenshot({
      path: testInfo.outputPath('json-workspace-desktop.png'),
      fullPage: true,
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
