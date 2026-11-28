import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const CONSENT_KEY = 'digdevbox.analytics-consent.v1';

test('captures a non-blocking homepage first fold at mobile and desktop viewports', async ({ page }, testInfo) => {
  const cases = [
    { name: 'mobile-390x844', width: 390, height: 844 },
    { name: 'desktop-1440x900', width: 1440, height: 900 },
  ] as const;

  const outputDirectory = resolve('artifacts/homepage-visual');
  await mkdir(outputDirectory, { recursive: true });

  for (const viewport of cases) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    await expect(page.locator('.home-hero')).toBeVisible();
    await expect(page.getByRole('searchbox')).toBeVisible();
    const quickSearch = page.getByRole('group', { name: 'Quick task searches' });
    await expect(quickSearch).toBeVisible();
    const consent = page.locator('#digdevbox-analytics-consent');
    await expect(consent).toBeVisible();
    await expect(consent).toHaveAttribute('data-placement', 'home-inline');
    await expect(consent.getByRole('button', { name: 'Accept analytics' })).toBeVisible();
    await expect(consent.getByRole('button', { name: 'Reject analytics' })).toBeVisible();
    await expect(page.locator('#home-featured .featured-task-card').first()).toBeVisible();

    const metrics = await page.evaluate(() => {
      const selectors = [
        ['hero', '.home-hero'],
        ['title', '.home-hero-title'],
        ['search', '.hero-search'],
        ['quickSearch', '.hero-quick-search'],
        ['preview', '.home-hero-preview'],
        ['previewCta', '.hero-preview-link'],
        ['featuredTasks', '#home-featured'],
        ['firstFeaturedCard', '#home-featured .featured-task-card'],
        ['consent', '#digdevbox-analytics-consent'],
      ] as const;

      const rect = (selector: string) => {
        const element = document.querySelector(selector);
        if (!element) {
          return null;
        }
        const box = element.getBoundingClientRect();
        return {
          top: Math.round(box.top),
          bottom: Math.round(box.bottom),
          left: Math.round(box.left),
          right: Math.round(box.right),
          width: Math.round(box.width),
          height: Math.round(box.height),
          insideViewport: box.top >= 0 && box.bottom <= window.innerHeight,
        };
      };
      const overlaps = (first: ReturnType<typeof rect>, second: ReturnType<typeof rect>) => {
        if (!first || !second) {
          return false;
        }
        return first.left < second.right
          && first.right > second.left
          && first.top < second.bottom
          && first.bottom > second.top;
      };

      const elements = Object.fromEntries(selectors.map(([name, selector]) => [name, rect(selector)]));
      const consentElement = document.querySelector('#digdevbox-analytics-consent');
      const acceptButton = consentElement?.querySelector('button');
      const rejectButton = consentElement?.querySelectorAll('button')[1];
      const hero = elements.hero;
      const consentRect = elements.consent;
      const previewRect = elements.preview;
      const firstCardRect = elements.firstFeaturedCard;

      return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        documentWidth: document.documentElement.scrollWidth,
        consentPlacement: consentElement?.getAttribute('data-placement') ?? null,
        consentPosition: consentElement ? getComputedStyle(consentElement).position : null,
        consentAcceptHeight: acceptButton ? Math.round(acceptButton.getBoundingClientRect().height) : 0,
        consentRejectHeight: rejectButton ? Math.round(rejectButton.getBoundingClientRect().height) : 0,
        consentOverlapsPreview: overlaps(consentRect, previewRect),
        consentOverlapsFirstFeaturedCard: overlaps(consentRect, firstCardRect),
        consentFollowsHero: Boolean(hero && consentRect && consentRect.top >= hero.bottom),
        elements,
      };
    });

    expect(metrics.documentWidth).toBeLessThanOrEqual(viewport.width);
    expect(metrics.elements.quickSearch?.insideViewport).toBe(true);
    expect(metrics.consentPlacement).toBe('home-inline');
    expect(metrics.consentPosition).toBe('relative');
    expect(metrics.consentFollowsHero).toBe(true);
    expect(metrics.consentAcceptHeight).toBeGreaterThanOrEqual(44);
    expect(metrics.consentRejectHeight).toBeGreaterThanOrEqual(44);
    expect(metrics.consentOverlapsPreview).toBe(false);
    expect(metrics.consentOverlapsFirstFeaturedCard).toBe(false);

    if (viewport.width <= 600) {
      expect(metrics.elements.preview).not.toBeNull();
      expect(metrics.elements.preview!.top).toBeLessThanOrEqual(720);
      expect(metrics.elements.preview!.top).toBeLessThan(viewport.height);
      expect(metrics.elements.previewCta).not.toBeNull();
      expect(metrics.elements.previewCta!.top).toBeGreaterThanOrEqual(0);
      expect(metrics.elements.previewCta!.bottom).toBeLessThanOrEqual(viewport.height);
    }

    const screenshot = await page.screenshot({
      animations: 'disabled',
      fullPage: false,
      type: 'png',
    });
    const screenshotPath = resolve(outputDirectory, `homepage-${viewport.name}.png`);
    await writeFile(screenshotPath, screenshot);
    await writeFile(
      resolve(outputDirectory, `homepage-${viewport.name}.json`),
      JSON.stringify(metrics, null, 2),
    );
    await testInfo.attach(`homepage-${viewport.name}`, {
      body: screenshot,
      contentType: 'image/png',
    });
    await testInfo.attach(`homepage-${viewport.name}-layout-metrics`, {
      body: JSON.stringify(metrics, null, 2),
      contentType: 'application/json',
    });
  }
});

test('keeps analytics denied after Reject and allows users to reopen privacy choices', async ({ page }) => {
  const analyticsRequests: string[] = [];
  page.on('request', (request) => {
    if (/googletagmanager\.com|google-analytics\.com/i.test(request.url())) {
      analyticsRequests.push(request.url());
    }
  });
  await page.route('https://www.googletagmanager.com/**', route => route.abort());

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const consent = page.locator('#digdevbox-analytics-consent');
  await expect(consent).toHaveAttribute('data-placement', 'home-inline');
  await consent.getByRole('button', { name: 'Reject analytics' }).click();

  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), CONSENT_KEY)).toBe('rejected');
  await expect(consent.getByRole('button', { name: 'Privacy choices' })).toBeVisible();
  await page.reload();

  const savedChoices = page.locator('#digdevbox-analytics-consent');
  await expect(savedChoices.getByRole('button', { name: 'Privacy choices' })).toBeVisible();
  await savedChoices.getByRole('button', { name: 'Privacy choices' }).click();
  await expect(savedChoices).toHaveAttribute('data-placement', 'fixed-overlay');
  await expect(savedChoices).toHaveCSS('position', 'fixed');
  await expect(savedChoices.getByRole('button', { name: 'Accept analytics' })).toBeVisible();
  await expect(savedChoices.getByRole('button', { name: 'Reject analytics' })).toBeVisible();
  expect(analyticsRequests).toEqual([]);
});

test('loads analytics only after explicit Accept and persists the choice', async ({ page }) => {
  const analyticsRequests: string[] = [];
  page.on('request', (request) => {
    if (/googletagmanager\.com|google-analytics\.com/i.test(request.url())) {
      analyticsRequests.push(request.url());
    }
  });
  await page.route('https://www.googletagmanager.com/**', route => route.abort());

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const consent = page.locator('#digdevbox-analytics-consent');
  await expect(consent).toHaveAttribute('data-placement', 'home-inline');
  await consent.getByRole('button', { name: 'Accept analytics' }).click();

  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), CONSENT_KEY)).toBe('accepted');
  await expect.poll(() => page.locator('script[src*="googletagmanager.com/gtag/js"]').count()).toBe(1);
  await expect.poll(() => analyticsRequests.length).toBeGreaterThan(0);

  await page.reload();
  const savedChoices = page.locator('#digdevbox-analytics-consent');
  await expect(savedChoices.getByRole('button', { name: 'Privacy choices' })).toBeVisible();
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), CONSENT_KEY)).toBe('accepted');
});

test('keeps the undecided consent prompt fixed on non-home tool routes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/tools');
  await expect(page.locator('.home-hero')).toHaveCount(0);

  const consent = page.locator('#digdevbox-analytics-consent');
  await expect(consent).toBeVisible();
  await expect(consent).toHaveAttribute('data-placement', 'fixed-overlay');
  await expect(consent).toHaveCSS('position', 'fixed');
  await expect(consent.getByRole('button', { name: 'Accept analytics' })).toBeVisible();
  await expect(consent.getByRole('button', { name: 'Reject analytics' })).toBeVisible();
});

test('moves the undecided consent prompt back to a fixed overlay during SPA navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const consent = page.locator('#digdevbox-analytics-consent');
  await expect(consent).toHaveAttribute('data-placement', 'home-inline');
  await page.locator('#home-tasks > a.home-blog-more[href="/tools/"]').click();
  await expect(page).toHaveURL(/\/tools\/?$/);
  await expect(page.locator('.home-hero')).toHaveCount(0);
  await expect(consent).toHaveAttribute('data-placement', 'fixed-overlay');
  await expect(consent).toHaveCSS('position', 'fixed');
});

test('captures the violet palette in light and dark modes', async ({ page }, testInfo) => {
  const cases = [
    { theme: 'light', dark: false, primary: 'rgb(126, 69, 239)', onPrimary: 'rgb(255, 255, 255)', info: 'rgb(104, 66, 194)' },
    { theme: 'dark', dark: true, primary: 'rgb(167, 139, 250)', onPrimary: 'rgb(32, 19, 56)', info: 'rgb(185, 163, 255)' },
  ] as const;
  const viewports = [
    { name: 'mobile-390x844', width: 390, height: 844 },
    { name: 'desktop-1440x900', width: 1440, height: 900 },
  ] as const;

  const outputDirectory = resolve('artifacts/homepage-visual');
  await mkdir(outputDirectory, { recursive: true });

  for (const themeCase of cases) {
    await page.goto('/');
    await page.evaluate((theme) => {
      localStorage.setItem('vueuse-color-scheme', theme);
    }, themeCase.theme);

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');
      await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('dark')))
        .toBe(themeCase.dark);

      const previewCta = page.locator('.hero-preview-link');
      const secondaryCta = page.locator('.hero-cta:not(.hero-cta-workspace)');
      await expect(previewCta).toBeVisible();
      await expect(secondaryCta).toBeVisible();

      const palette = await page.evaluate(() => {
        const root = getComputedStyle(document.documentElement);
        const preview = document.querySelector('.hero-preview-link');
        const secondary = document.querySelector('.hero-cta:not(.hero-cta-workspace)');
        if (!preview || !secondary) {
          throw new Error('Expected homepage primary and secondary actions to render');
        }
        return {
          primary: root.getPropertyValue('--dd-primary').trim(),
          onPrimary: root.getPropertyValue('--dd-on-primary').trim(),
          action: root.getPropertyValue('--main-action').trim(),
          info: root.getPropertyValue('--main-info').trim(),
          previewBackground: getComputedStyle(preview).backgroundColor,
          previewColor: getComputedStyle(preview).color,
          secondaryColor: getComputedStyle(secondary).color,
          documentWidth: document.documentElement.scrollWidth,
        };
      });

      expect(palette.primary.toLowerCase()).toBe(themeCase.dark ? '#a78bfa' : '#7e45ef');
      expect(palette.onPrimary.toLowerCase()).toBe(themeCase.dark ? '#201338' : '#ffffff');
      expect(palette.action.toLowerCase()).toBe('#814ee8');
      expect(palette.info).toBe(themeCase.dark ? '#B9A3FF' : '#6842C2');
      expect(palette.previewBackground).toBe(themeCase.primary);
      expect(palette.previewColor).toBe(themeCase.onPrimary);
      expect(palette.secondaryColor).toBe(themeCase.dark ? 'rgb(185, 163, 255)' : 'rgb(104, 66, 194)');
      expect(palette.documentWidth).toBeLessThanOrEqual(viewport.width);

      await expect(page.locator('.home-hero')).toBeVisible();
      const screenshot = await page.screenshot({
        animations: 'disabled',
        fullPage: false,
        type: 'png',
      });
      await testInfo.attach(`homepage-${themeCase.theme}-${viewport.name}`, {
        body: screenshot,
        contentType: 'image/png',
      });
      await writeFile(
        resolve(outputDirectory, `homepage-${themeCase.theme}-${viewport.name}.png`),
        screenshot,
      );
    }
  }
});
