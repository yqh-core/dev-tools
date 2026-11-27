import { expect, test } from '@playwright/test';

const sampleToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
const signatureSegment = 'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

test.describe('JWT Parser decode-only workflow', () => {
  test('separates decoded Header/Payload from the opaque unverified Signature segment', async ({ page }) => {
    await page.goto('/jwt-parser');

    await expect(page.getByTestId('jwt-unverified')).toContainText('signature is not verified');
    await expect(page.getByText('JOSE Header', { exact: true })).toBeVisible();
    await expect(page.getByText('Claims Set Payload', { exact: true })).toBeVisible();
    await expect(page.getByTestId('jwt-signature')).toContainText('Encoded Signature Segment');
    await expect(page.getByTestId('jwt-signature')).toContainText('Not verified');
    await expect(page.getByTestId('jwt-signature-value')).toHaveText(signatureSegment);
    await expect(page.getByTestId('jwt-copy-signature')).toBeEnabled();
  });

  test('shows a specific recovery message for malformed compact input', async ({ page }, testInfo) => {
    // This case asserts the English copy. The separate Chinese case below verifies
    // first-visit language detection from navigator.languages.
    await page.addInitScript(() => {
      localStorage.setItem('locale', 'en');
    });
    await page.goto('/jwt-parser');
    const input = page.getByTestId('jwt-input');

    await input.fill('');
    await expect(input).toHaveValue('');
    const feedback = page.locator('.c-input-text .feedback');
    await page.screenshot({
      path: testInfo.outputPath('jwt-parser-empty-validation.png'),
      fullPage: true,
    });
    await expect(feedback).toContainText(/Enter a compact JWT\./);

    await input.fill('one.two');
    await expect(page.getByText(/Expected a three-part compact JWT\/JWS/)).toBeVisible();

    await input.fill('one.two.three.four');
    await expect(page.getByText(/Expected a three-part compact JWT\/JWS/)).toBeVisible();

    await input.fill('one.two.three\n');
    await expect(page.getByText(/Remove spaces or line breaks/)).toBeVisible();
  });

  test('keeps the tool usable at mobile and desktop widths', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/jwt-parser');
    await expect(page.getByTestId('jwt-signature')).toBeVisible();
    const mobile = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
    }));
    expect(mobile.document).toBeLessThanOrEqual(mobile.viewport);
    await page.screenshot({
      path: testInfo.outputPath('jwt-parser-mobile.png'),
      fullPage: true,
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    const desktop = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
    }));
    expect(desktop.document).toBeLessThanOrEqual(desktop.viewport);
    await page.screenshot({
      path: testInfo.outputPath('jwt-parser-desktop.png'),
      fullPage: true,
    });
  });

  test('localizes the interactive surface in Chinese', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('locale');
      Object.defineProperty(navigator, 'languages', {
        get: () => ['zh-CN', 'zh'],
      });
    });
    await page.goto('/jwt-parser');

    await expect(page.getByTestId('jwt-input')).toBeVisible();
    await expect(page.getByLabel('紧凑 JWT / JWS')).toBeVisible();
    await expect(page.getByTestId('jwt-unverified')).toContainText('不会验证签名');
    await expect(page.getByText('JOSE Header（头部）', { exact: true })).toBeVisible();
    await expect(page.getByTestId('jwt-signature')).toContainText('未验证');
    await expect(page.getByTestId('jwt-signature-value')).toHaveText(signatureSegment);
  });

  test('does not send the pasted token in a request URL or request body', async ({ page }) => {
    const observedRequests: string[] = [];
    page.on('request', (request) => {
      const candidate = `${request.url()}\n${request.postData() ?? ''}`;
      if (candidate.includes(sampleToken)) {
        observedRequests.push(candidate);
      }
    });

    await page.goto('/jwt-parser');
    await page.getByTestId('jwt-input').fill(sampleToken);
    await expect(page.getByTestId('jwt-signature-value')).toHaveText(signatureSegment);
    expect(observedRequests).toEqual([]);
  });
});
