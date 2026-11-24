import { Buffer } from 'node:buffer';
import { deflateSync } from 'node:zlib';

export const SOCIAL_IMAGE_WIDTH = 1200;
export const SOCIAL_IMAGE_HEIGHT = 630;
export const SOCIAL_IMAGE_VERSION = '1';

const FONT = {
  A: ['01110','10001','10001','11111','10001','10001','10001'],
  B: ['11110','10001','10001','11110','10001','10001','11110'],
  C: ['01111','10000','10000','10000','10000','10000','01111'],
  D: ['11110','10001','10001','10001','10001','10001','11110'],
  E: ['11111','10000','10000','11110','10000','10000','11111'],
  F: ['11111','10000','10000','11110','10000','10000','10000'],
  G: ['01111','10000','10000','10111','10001','10001','01110'],
  H: ['10001','10001','10001','11111','10001','10001','10001'],
  I: ['11111','00100','00100','00100','00100','00100','11111'],
  J: ['00111','00010','00010','00010','10010','10010','01100'],
  K: ['10001','10010','10100','11000','10100','10010','10001'],
  L: ['10000','10000','10000','10000','10000','10000','11111'],
  M: ['10001','11011','10101','10101','10001','10001','10001'],
  N: ['10001','11001','10101','10011','10001','10001','10001'],
  O: ['01110','10001','10001','10001','10001','10001','01110'],
  P: ['11110','10001','10001','11110','10000','10000','10000'],
  Q: ['01110','10001','10001','10001','10101','10010','01101'],
  R: ['11110','10001','10001','11110','10100','10010','10001'],
  S: ['01111','10000','10000','01110','00001','00001','11110'],
  T: ['11111','00100','00100','00100','00100','00100','00100'],
  U: ['10001','10001','10001','10001','10001','10001','01110'],
  V: ['10001','10001','10001','10001','10001','01010','00100'],
  W: ['10001','10001','10001','10101','10101','10101','01010'],
  X: ['10001','10001','01010','00100','01010','10001','10001'],
  Y: ['10001','10001','01010','00100','00100','00100','00100'],
  Z: ['11111','00001','00010','00100','01000','10000','11111'],
  '0': ['01110','10001','10011','10101','11001','10001','01110'],
  '1': ['00100','01100','00100','00100','00100','00100','01110'],
  '2': ['01110','10001','00001','00010','00100','01000','11111'],
  '3': ['11110','00001','00001','01110','00001','00001','11110'],
  '4': ['00010','00110','01010','10010','11111','00010','00010'],
  '5': ['11111','10000','10000','11110','00001','00001','11110'],
  '6': ['01110','10000','10000','11110','10001','10001','01110'],
  '7': ['11111','00001','00010','00100','01000','01000','01000'],
  '8': ['01110','10001','10001','01110','10001','10001','01110'],
  '9': ['01110','10001','10001','01111','00001','00001','01110'],
  '-': ['00000','00000','00000','11111','00000','00000','00000'],
  '_': ['00000','00000','00000','00000','00000','00000','11111'],
  '.': ['00000','00000','00000','00000','00000','01100','01100'],
  ',': ['00000','00000','00000','00000','00110','00110','00100'],
  ':': ['00000','01100','01100','00000','01100','01100','00000'],
  '/': ['00001','00010','00010','00100','01000','01000','10000'],
  '?': ['01110','10001','00001','00010','00100','00000','00100'],
  '!': ['00100','00100','00100','00100','00100','00000','00100'],
  '&': ['01100','10010','10100','01000','10101','10010','01101'],
  '+': ['00000','00100','00100','11111','00100','00100','00000'],
  '(': ['00010','00100','01000','01000','01000','00100','00010'],
  ')': ['01000','00100','00010','00010','00010','00100','01000'],
  "'": ['00100','00100','00010','00000','00000','00000','00000'],
  '%': ['11001','11010','00100','01000','10110','00110','00000'],
  '#': ['01010','11111','01010','01010','11111','01010','00000'],
  ' ': ['00000','00000','00000','00000','00000','00000','00000'],
};

function asAscii(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[—–]/g, '-')
    .replace(/[^\x20-\x7e]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export function socialImageSlug(path) {
  const normalized = !path || path === '/' ? '/' : (path.startsWith('/') ? path : '/' + path);
  if (normalized === '/') return 'home';
  return normalized.replace(/^\/+|\/+$/g, '').replace(/\//g, '--').replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
}

export function socialImagePath(path) {
  return '/og/' + socialImageSlug(path) + '.png';
}

function wrapText(text, maxChars, maxLines) {
  const words = asAscii(text).split(' ').filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    if (word.length > maxChars) {
      if (current) { lines.push(current); current = ''; }
      for (let offset = 0; offset < word.length; offset += maxChars) {
        lines.push(word.slice(offset, offset + maxChars));
      }
      continue;
    }
    if (!current) current = word;
    else if (current.length + 1 + word.length <= maxChars) current += ' ' + word;
    else { lines.push(current); current = word; }
  }
  if (current) lines.push(current);
  if (lines.length > maxLines) {
    const clipped = lines.slice(0, maxLines);
    clipped[maxLines - 1] = clipped[maxLines - 1].replace(/[. ]+$/g, '') + '...';
    return clipped;
  }
  return lines;
}

function rgb(hex) {
  const raw = hex.replace('#', '');
  return [Number.parseInt(raw.slice(0, 2), 16), Number.parseInt(raw.slice(2, 4), 16), Number.parseInt(raw.slice(4, 6), 16)];
}

function drawRect(pixels, x, y, width, height, color) {
  const [r, g, b] = color;
  const left = Math.max(0, Math.floor(x));
  const top = Math.max(0, Math.floor(y));
  const right = Math.min(SOCIAL_IMAGE_WIDTH, Math.ceil(x + width));
  const bottom = Math.min(SOCIAL_IMAGE_HEIGHT, Math.ceil(y + height));
  for (let py = top; py < bottom; py++) {
    let offset = (py * SOCIAL_IMAGE_WIDTH + left) * 4;
    for (let px = left; px < right; px++) {
      pixels[offset++] = r;
      pixels[offset++] = g;
      pixels[offset++] = b;
      pixels[offset++] = 255;
    }
  }
}

function blendPixel(pixels, x, y, color, alpha) {
  if (x < 0 || y < 0 || x >= SOCIAL_IMAGE_WIDTH || y >= SOCIAL_IMAGE_HEIGHT) return;
  const offset = (y * SOCIAL_IMAGE_WIDTH + x) * 4;
  const inverse = 1 - alpha;
  pixels[offset] = Math.round(pixels[offset] * inverse + color[0] * alpha);
  pixels[offset + 1] = Math.round(pixels[offset + 1] * inverse + color[1] * alpha);
  pixels[offset + 2] = Math.round(pixels[offset + 2] * inverse + color[2] * alpha);
}

function drawRing(pixels, centerX, centerY, radius, thickness, color, alpha) {
  const outer = radius + thickness / 2;
  const inner = radius - thickness / 2;
  const outer2 = outer * outer;
  const inner2 = inner * inner;
  for (let y = Math.max(0, centerY - outer); y <= Math.min(SOCIAL_IMAGE_HEIGHT - 1, centerY + outer); y++) {
    for (let x = Math.max(0, centerX - outer); x <= Math.min(SOCIAL_IMAGE_WIDTH - 1, centerX + outer); x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const distance2 = dx * dx + dy * dy;
      if (distance2 <= outer2 && distance2 >= inner2) blendPixel(pixels, x, y, color, alpha);
    }
  }
}

function drawText(pixels, text, x, y, scale, color, maxWidth) {
  const normalized = asAscii(text);
  const advance = 6 * scale;
  const maxChars = Math.max(0, Math.floor(maxWidth / advance));
  const clipped = normalized.slice(0, maxChars);
  let cursor = x;
  for (const character of clipped) {
    const glyph = FONT[character] ?? FONT[' '];
    for (let row = 0; row < 7; row++) {
      for (let column = 0; column < 5; column++) {
        if (glyph[row][column] === '1') {
          drawRect(pixels, cursor + column * scale, y + row * scale, Math.max(1, scale - 1), Math.max(1, scale - 1), color);
        }
      }
    }
    cursor += advance;
  }
  return cursor - x;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function encodePng(pixels) {
  const rowBytes = SOCIAL_IMAGE_WIDTH * 4;
  const raw = Buffer.alloc((rowBytes + 1) * SOCIAL_IMAGE_HEIGHT);
  for (let row = 0; row < SOCIAL_IMAGE_HEIGHT; row++) {
    const target = row * (rowBytes + 1);
    raw[target] = 0;
    Buffer.from(pixels.buffer, pixels.byteOffset + row * rowBytes, rowBytes).copy(raw, target + 1);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(SOCIAL_IMAGE_WIDTH, 0);
  header.writeUInt32BE(SOCIAL_IMAGE_HEIGHT, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

export function createSocialCardPng({ title, description, path, kind = 'tool' }) {
  const pixels = new Uint8Array(SOCIAL_IMAGE_WIDTH * SOCIAL_IMAGE_HEIGHT * 4);
  const top = [7, 23, 39];
  const bottom = [10, 18, 34];
  for (let y = 0; y < SOCIAL_IMAGE_HEIGHT; y++) {
    const ratio = y / (SOCIAL_IMAGE_HEIGHT - 1);
    const rowColor = top.map((value, index) => Math.round(value + (bottom[index] - value) * ratio));
    drawRect(pixels, 0, y, SOCIAL_IMAGE_WIDTH, 1, rowColor);
  }

  const teal = rgb('#14B8A6');
  const cyan = rgb('#67E8F9');
  const white = rgb('#F8FAFC');
  const muted = rgb('#A9BACB');
  const subtle = rgb('#20384F');
  drawRing(pixels, 1010, 320, 150, 3, teal, 0.13);
  drawRing(pixels, 1010, 320, 205, 2, cyan, 0.08);
  drawRing(pixels, 1010, 320, 260, 2, teal, 0.055);
  drawRect(pixels, 72, 78, 8, 470, teal);
  drawRect(pixels, 104, 78, 44, 44, teal);
  drawRect(pixels, 115, 89, 22, 22, [7, 23, 39]);
  drawRect(pixels, 122, 84, 8, 32, [7, 23, 39]);
  drawRect(pixels, 110, 96, 32, 8, [7, 23, 39]);
  drawText(pixels, 'DIGDEVBOX', 170, 91, 5, white, 370);

  const kindLabel = kind === 'guide' ? 'HOW-TO GUIDE' : kind === 'tool' ? 'ONLINE DEVELOPER TOOL' : 'DIGDEVBOX RESOURCE';
  const labelWidth = Math.min(420, kindLabel.length * 27 + 36);
  drawRect(pixels, 770, 82, labelWidth, 42, [20, 48, 65]);
  drawRect(pixels, 770, 82, 5, 42, teal);
  drawText(pixels, kindLabel, 790, 95, 3, cyan, labelWidth - 26);
  drawRect(pixels, 104, 156, 1000, 2, subtle);

  const titleLines = wrapText(title || 'DIGDEVBOX ONLINE TOOLS', 23, 3);
  titleLines.forEach((line, index) => drawText(pixels, line, 106, 205 + index * 68, 7, white, 1000));

  const descriptionLines = wrapText(description || 'FREE BROWSER-BASED TOOLS FOR DEVELOPERS AND IT PROFESSIONALS.', 41, 2);
  descriptionLines.forEach((line, index) => drawText(pixels, line, 108, 435 + index * 38, 4, muted, 980));

  drawRect(pixels, 104, 548, 1000, 2, subtle);
  drawText(pixels, asAscii(path || '/'), 108, 572, 3, cyan, 700);
  drawText(pixels, 'DIGDEVBOX.COM', 850, 572, 3, muted, 260);

  const png = encodePng(pixels);
  if (png.length > 5 * 1024 * 1024) {
    throw new Error('Generated Open Graph image exceeds 5 MB: ' + (path || '/'));
  }
  return png;
}
