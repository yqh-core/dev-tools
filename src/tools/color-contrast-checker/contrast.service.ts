export { parseColor, toHex, relativeLuminance, contrastRatio, formatRatio, evaluatePair, WCAG_THRESHOLDS };

/**
 * WCAG 2.x 对比度计算（纯前端、零依赖）。
 *
 * 为什么这个工具值得存在
 * ------------------------------------------------------------------
 * 对比度不是「看起来够不够黑」：它由 sRGB 相对亮度按固定公式得出，
 * 差 0.02 就是从通过变成不通过（#767676 = 4.54 通过 AA，#777777 = 4.48 不通过）。
 * 设计评审里这类边界判断靠眼睛是不成立的，所以给一个可核对的计算器，
 * 并把判定门限按 WCAG 原文写死在这里。
 *
 * 判定用的是「比值 ≥ 门限」，且**用未取整的原始比值**比较 ——
 * 拿显示用的两位小数去比会引入假边界（3.998 显示成 4.00 却并不满足 4.5，
 * 但 4.4996 显示成 4.50 就会被误判成满足）。
 */

interface Rgb {
  r: number
  g: number
  b: number
}

interface Verdict {
  ratio: number
  aaNormal: boolean
  aaLarge: boolean
  aaaNormal: boolean
  aaaLarge: boolean
}

const WCAG_THRESHOLDS = {
  aaNormal: 4.5,
  aaLarge: 3,
  aaaNormal: 7,
  aaaLarge: 4.5,
} as const;

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGB_RE = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(?:0|1|0?\.\d+|1\.0+)\s*)?\)$/i;

/** 支持 #rgb / #rrggbb / rgb() / rgba()（alpha 被忽略：对比度算的是不透明前景）。 */
function parseColor(input: string): Rgb | null {
  const raw = (input ?? '').trim();
  if (!raw) {
    return null;
  }

  const hex = HEX_RE.exec(raw);
  if (hex) {
    const body = hex[1];
    const expanded = body.length === 3
      ? body.split('').map(ch => ch + ch).join('')
      : body;
    return {
      r: Number.parseInt(expanded.slice(0, 2), 16),
      g: Number.parseInt(expanded.slice(2, 4), 16),
      b: Number.parseInt(expanded.slice(4, 6), 16),
    };
  }

  const rgb = RGB_RE.exec(raw);
  if (rgb) {
    const parts = [rgb[1], rgb[2], rgb[3]].map(Number);
    if (parts.some(v => v > 255)) {
      return null;
    }
    const [r, g, b] = parts;
    return { r, g, b };
  }

  return null;
}

function toHex({ r, g, b }: Rgb): string {
  const hex = (v: number) => v.toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`.toUpperCase();
}

function channelLuminance(byte: number): number {
  const s = byte / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(color: Rgb): number {
  return 0.2126 * channelLuminance(color.r)
    + 0.7152 * channelLuminance(color.g)
    + 0.0722 * channelLuminance(color.b);
}

function contrastRatio(foreground: Rgb, background: Rgb): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function formatRatio(ratio: number): string {
  // 21 与 4.5 这类整数比值不需要拖上「.00」；其它保留两位。
  const rounded = Math.round(ratio * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function evaluatePair(foreground: Rgb | null, background: Rgb | null): (Verdict & { ratioText: string }) | null {
  if (!foreground || !background) {
    return null;
  }
  const ratio = contrastRatio(foreground, background);
  return {
    ratio,
    ratioText: formatRatio(ratio),
    aaNormal: ratio >= WCAG_THRESHOLDS.aaNormal,
    aaLarge: ratio >= WCAG_THRESHOLDS.aaLarge,
    aaaNormal: ratio >= WCAG_THRESHOLDS.aaaNormal,
    aaaLarge: ratio >= WCAG_THRESHOLDS.aaaLarge,
  };
}
