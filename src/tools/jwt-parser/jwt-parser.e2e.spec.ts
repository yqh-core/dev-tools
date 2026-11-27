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

    // Probe the actual browser-global Vue I18n composer before the component
    // runs validation. This distinguishes missing locale resources from a
    // component-scoped composer/lookup issue.
    const translationProbe = await page.evaluate(() => {
      type Composer = {
        locale: { value: string }
        te: (key: string, locale?: string) => boolean
        t: (key: string) => string
        getLocaleMessage: (locale: string) => unknown
      };
      type VueApp = {
        config?: {
          globalProperties?: {
            $i18n?: Composer
            $t?: (key: string) => string
          }
        }
      };
      type VueMountElement = HTMLElement & { __vue_app__?: VueApp };
      const root = document.querySelector('#app') as VueMountElement | null;
      const globals = root?.__vue_app__?.config?.globalProperties;
      const composer = globals?.$i18n;
      const localeMessages = composer?.getLocaleMessage('en') as Record<string, unknown> | undefined;
      const tools = localeMessages?.tools as Record<string, unknown> | undefined;
      const jwt = tools?.['jwt-parser'] as Record<string, unknown> | undefined;
      const errors = jwt?.errors as Record<string, unknown> | undefined;
      return {
        hasVueApp: Boolean(root?.__vue_app__),
        locale: composer?.locale.value ?? null,
        hasEmptyKey: composer?.te('tools.jwt-parser.errors.empty', 'en') ?? null,
        composerTranslation: composer?.t('tools.jwt-parser.errors.empty') ?? null,
        globalTranslation: globals?.$t?.('tools.jwt-parser.errors.empty') ?? null,
        rawEmptyMessage: errors?.empty ?? null,
        rawErrorKeys: errors ? Object.keys(errors) : [],
      };
    });
    await testInfo.attach('jwt-i18n-runtime-probe.json', {
      body: JSON.stringify(translationProbe, null, 2),
      contentType: 'application/json',
    });
    expect(translationProbe.hasVueApp, 'Vue app must be mounted for the runtime probe').toBe(true);
    expect(translationProbe.hasEmptyKey, JSON.stringify(translationProbe)).toBe(true);
    expect(translationProbe.composerTranslation, JSON.stringify(translationProbe)).toBe('Enter a compact JWT.');

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
