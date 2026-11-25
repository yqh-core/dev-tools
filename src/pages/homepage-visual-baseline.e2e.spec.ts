import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

test('captures the homepage first fold at mobile and desktop viewports', async ({ page }, testInfo) => {
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

    const metrics = await page.evaluate(() => {
      const selectors = [
        ['hero', '.home-hero'],
        ['title', '.home-hero-title'],
        ['search', '.hero-search'],
        ['quickSearch', '.hero-quick-search'],
        ['preview', '.home-hero-preview'],
        ['featuredTasks', '#home-featured'],
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

      return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        documentWidth: document.documentElement.scrollWidth,
        elements: Object.fromEntries(selectors.map(([name, selector]) => [name, rect(selector)])),
      };
    });

    expect(metrics.documentWidth).toBeLessThanOrEqual(viewport.width);
    expect(metrics.elements.quickSearch?.insideViewport).toBe(true);

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
