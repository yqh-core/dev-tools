import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { mainPalette } from './main-palette';

function relativeLuminance(hex: string) {
  const normalized = hex.replace('#', '');
  const channels = [0, 2, 4].map((offset) => {
    const value = Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(first: string, second: string) {
  const luminances = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (luminances[0] + 0.05) / (luminances[1] + 0.05);
}

const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('DigDevBox Main violet palette', () => {
  test('keeps normal text and primary controls above WCAG AA contrast', () => {
    const lightSurface = '#FFFFFF';
    const darkSurface = '#131C2B';

    for (const linkState of [mainPalette.light.link, mainPalette.light.linkHover, mainPalette.light.linkPressed]) {
      expect(contrastRatio(linkState, lightSurface)).toBeGreaterThanOrEqual(4.5);
    }
    for (const actionState of [mainPalette.light.action, mainPalette.light.actionHover, mainPalette.light.actionPressed]) {
      expect(contrastRatio(actionState, mainPalette.light.onAction)).toBeGreaterThanOrEqual(4.5);
    }
    for (const infoState of [mainPalette.light.info, mainPalette.light.infoHover, mainPalette.light.infoPressed]) {
      expect(contrastRatio(infoState, lightSurface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(infoState, mainPalette.light.infoSoft)).toBeGreaterThanOrEqual(4.5);
    }

    for (const linkState of [mainPalette.dark.link, mainPalette.dark.linkHover, mainPalette.dark.linkPressed]) {
      expect(contrastRatio(linkState, darkSurface)).toBeGreaterThanOrEqual(4.5);
    }
    for (const actionState of [mainPalette.dark.action, mainPalette.dark.actionHover, mainPalette.dark.actionPressed]) {
      expect(contrastRatio(actionState, mainPalette.dark.onAction)).toBeGreaterThanOrEqual(4.5);
    }
    for (const infoState of [mainPalette.dark.info, mainPalette.dark.infoHover, mainPalette.dark.infoPressed]) {
      expect(contrastRatio(infoState, darkSurface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(infoState, mainPalette.dark.infoSoft)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastRatio(mainPalette.light.onLinkSolid, mainPalette.light.link)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(mainPalette.dark.onLinkSolid, mainPalette.dark.link)).toBeGreaterThanOrEqual(4.5);
  });

  test('keeps Main CSS variables aligned with the typed semantic palette', () => {
    const css = readSource('../public/css/main-palette.css');

    expect(css).toContain(`--dd-primary: ${mainPalette.light.link};`);
    expect(css).toContain(`--dd-primary-hover: ${mainPalette.light.linkHover};`);
    expect(css).toContain(`--dd-primary-active: ${mainPalette.light.linkPressed};`);
    expect(css).toContain(`--dd-primary-soft: ${mainPalette.light.linkSoft};`);
    expect(css).toContain(`--dd-on-primary: ${mainPalette.light.onLinkSolid};`);
    expect(css).toContain(`--main-action: ${mainPalette.light.action};`);
    expect(css).toContain(`--main-action-hover: ${mainPalette.light.actionHover};`);
    expect(css).toContain(`--main-action-pressed: ${mainPalette.light.actionPressed};`);
    expect(css).toContain(`--main-info: ${mainPalette.light.info};`);
    expect(css).toContain(`--main-info-hover: ${mainPalette.light.infoHover};`);
    expect(css).toContain(`--main-info-pressed: ${mainPalette.light.infoPressed};`);
    expect(css).toContain(`--main-info-soft: ${mainPalette.light.infoSoft};`);

    expect(css).toContain(`--dd-primary: ${mainPalette.dark.link};`);
    expect(css).toContain(`--dd-primary-hover: ${mainPalette.dark.linkHover};`);
    expect(css).toContain(`--dd-primary-active: ${mainPalette.dark.linkPressed};`);
    expect(css).toContain(`--dd-primary-soft: ${mainPalette.dark.linkSoft};`);
    expect(css).toContain(`--dd-on-primary: ${mainPalette.dark.onLinkSolid};`);
    expect(css).toContain(`--main-action: ${mainPalette.dark.action};`);
    expect(css).toContain(`--main-action-hover: ${mainPalette.dark.actionHover};`);
    expect(css).toContain(`--main-action-pressed: ${mainPalette.dark.actionPressed};`);
    expect(css).toContain(`--main-info: ${mainPalette.dark.info};`);
    expect(css).toContain(`--main-info-hover: ${mainPalette.dark.infoHover};`);
    expect(css).toContain(`--main-info-pressed: ${mainPalette.dark.infoPressed};`);
    expect(css).toContain(`--main-info-soft: ${mainPalette.dark.infoSoft};`);
  });

  test('loads the Main palette after family shell tokens and keeps API Studio separate', () => {
    const mainIndex = readSource('../index.html');
    const apiStudioIndex = readSource('../product-api-studio/index.html');
    const sharedTokensIndex = mainIndex.indexOf('href="/css/dd-tokens.css"');
    const sharedShellIndex = mainIndex.indexOf('href="/css/dd-shell.css"');
    const mainPaletteIndex = mainIndex.indexOf('href="/css/main-palette.css"');

    expect(sharedTokensIndex).toBeGreaterThanOrEqual(0);
    expect(sharedShellIndex).toBeGreaterThan(sharedTokensIndex);
    expect(mainPaletteIndex).toBeGreaterThan(sharedShellIndex);
    expect(apiStudioIndex).not.toContain('main-palette.css');
    expect(mainIndex).toContain('<meta name="theme-color" content="#814EE8"');
  });

  test('uses Main-local colors in Vue component and Naive UI themes', () => {
    const naiveTheme = readSource('./themes.ts');
    const componentTheme = readSource('./ui/theme/themes.ts');

    expect(naiveTheme).toContain('mainPalette.light.action');
    expect(naiveTheme).toContain('mainPalette.dark.action');
    expect(naiveTheme).toContain('mainPalette.light.info');
    expect(naiveTheme).toContain('mainPalette.dark.info');
    expect(naiveTheme).toContain('textColorPrimary: mainPalette.light.onAction');
    expect(naiveTheme).toContain('textColorPrimary: mainPalette.dark.onAction');
    expect(componentTheme).toContain('mainPalette.light.link');
    expect(componentTheme).toContain('mainPalette.dark.link');
  });

  test('uses the new brand color in the Main PWA manifest', () => {
    const viteConfig = readSource('../vite.config.ts');
    expect(viteConfig).toMatch(/theme_color: '#814EE8'/);
  });
});
