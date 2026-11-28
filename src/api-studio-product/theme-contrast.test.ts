import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { apiStudioLightOverrides } from '../themes/api-studio';

function relativeLuminance(hex: string) {
  const normalized = hex.replace('#', '');
  const channels = [0, 2, 4].map((offset) => {
    const value = Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(first: string, second: string) {
  const values = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

const css = readFileSync(new URL('../styles/api-studio-tokens.css', import.meta.url), 'utf8');
const lightCss = css.split('.api-studio-shell[data-api-theme="light"]')[1] || '';
function token(name: string) {
  const line = lightCss.split('\n').find(item => item.trim().startsWith(`${name}:`));
  if (!line) {
    throw new Error(`Missing light token: ${name}`);
  }
  return line.split(':').slice(1).join(':').trim().replace(';', '');
}

describe('API Studio light theme contrast', () => {
  test('keeps muted and placeholder text readable on every light surface', () => {
    const muted = token('--api-text-muted');
    const faint = token('--api-text-faint');
    const surfaces = ['--api-bg', '--api-surface', '--api-surface-2', '--api-surface-3', '--api-elevated'].map(token);
    expect(muted).not.toBe(faint);
    expect(apiStudioLightOverrides.common?.textColor3).toBe(muted);
    expect(apiStudioLightOverrides.common?.placeholderColor).toBe(faint);
    for (const foreground of [muted, faint]) {
      for (const background of surfaces) {
        expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  test('keeps form-control boundaries distinguishable from their input surface', () => {
    const borderColor = '#75839a';
    const inputSurface = token('--api-surface-3');
    expect(apiStudioLightOverrides.Input).toMatchObject({
      border: `1px solid ${borderColor}`,
      borderFocus: '1px solid #7655e8',
    });
    expect(contrastRatio(borderColor, inputSurface)).toBeGreaterThanOrEqual(3);
  });

  test('keeps the violet action color aligned across workspace CSS and Naive UI', () => {
    expect(token('--api-primary')).toBe('#7655e8');
    expect(apiStudioLightOverrides.common?.primaryColor).toBe(token('--api-primary'));
  });
});
