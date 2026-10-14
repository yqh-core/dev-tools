/**
 * @vitest-environment node
 *
 * 为什么这个文件必须跑在 node 环境（而不是 package.json test:unit 全局指定的 jsdom）：
 *   jsdom 提供的是**另一个 realm 的 ArrayBuffer**。makePdf() 交给服务的字节是
 *   jsdom-realm 的 ArrayBuffer，而 pdf-lib 内部用 instanceof ArrayBuffer / isView 分流；
 *   跨 realm 判定全部落空后，它的报错助手把类型名算成 NaN ——
 *   于是 13 条用例齐报「`pdf` must be of type string or Uint8Array or ArrayBuffer,
 *   but was actually of type NaN」。
 *   真实浏览器只有一个 realm，该问题不存在；这是纯测试宿主问题，不是产品缺陷。
 *   本文件只测服务逻辑（merge/split/watermark/compress/pageCount），不碰任何 DOM，
 *   所以用 node 环境既正确又更快。
 *
 * 反过来说：如果有人把它改回 jsdom 而不去解决 realm 问题，这 13 条会立刻变红 ——
 * 这是有意的，不是脆弱。
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  compressPdf,
  imagesToPdf,
  loadPdf,
  mergePdfs,
  pageCount,
  splitPdf,
  watermarkPdf,
} from './pdf-lib.service';
import type { ImageRecompressor, PdfImageInput } from './pdf-lib.service';
import { PDFDocument, PDFName, PDFRawStream } from '@/lib/pdf-lib.esm.min.js';

/** 造一个 N 页测试 PDF */
async function makePdf(pages: number): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    const p = doc.addPage([300, 200]);
    p.drawText(`Page ${i + 1}`, { x: 100, y: 100, size: 16 });
  }
  const bytes = await doc.save();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe('pdf-lib shared service', () => {
  it('mergePdfs concatenates in order', async () => {
    const a = await makePdf(2);
    const b = await makePdf(1);
    const merged = await mergePdfs([a, b]);
    const doc = await loadPdf(merged.buffer.slice(0) as ArrayBuffer);
    expect(doc.getPageCount()).toBe(3);
  });

  it('mergePdfs with empty array still produces a valid pdf (pdf-lib create() seeds one blank page)', async () => {
    const merged = await mergePdfs([]);
    const doc = await loadPdf(merged.buffer.slice(0) as ArrayBuffer);
    // pdf-lib 行为：create() 的空文档含 1 张空白页（非 0）——锁定该行为防意外变化
    expect(doc.getPageCount()).toBe(1);
  });

  it('splitPdf each-page mode returns one pdf per page', async () => {
    const src = await makePdf(3);
    const parts = await splitPdf(src, 'each');
    expect(parts).toHaveLength(3);
    expect(parts[0].name).toBe('page-1.pdf');
    for (const p of parts) {
      const doc = await loadPdf(p.bytes.buffer.slice(0) as ArrayBuffer);
      expect(doc.getPageCount()).toBe(1);
    }
  });

  it('splitPdf range mode extracts inclusive page window', async () => {
    const src = await makePdf(5);
    const parts = await splitPdf(src, 'range', { from: 2, to: 4 });
    expect(parts).toHaveLength(1);
    expect(parts[0].name).toBe('pages-2-4.pdf');
    const doc = await loadPdf(parts[0].bytes.buffer.slice(0) as ArrayBuffer);
    expect(doc.getPageCount()).toBe(3);
  });

  it('splitPdf clamps out-of-bounds range', async () => {
    const src = await makePdf(3);
    const parts = await splitPdf(src, 'range', { from: 2, to: 99 });
    const doc = await loadPdf(parts[0].bytes.buffer.slice(0) as ArrayBuffer);
    expect(doc.getPageCount()).toBe(2); // 2..3
  });

  it('watermarkPdf preserves page count and returns valid pdf', async () => {
    const src = await makePdf(2);
    const out = await watermarkPdf(src, { text: 'DRAFT', tile: true });
    const doc = await loadPdf(out.buffer.slice(0) as ArrayBuffer);
    expect(doc.getPageCount()).toBe(2);
  });

  it('watermarkPdf single-line mode works with custom options', async () => {
    const src = await makePdf(1);
    const out = await watermarkPdf(src, { text: 'CONFIDENTIAL', fontSize: 32, opacity: 0.4, angle: 30 });
    expect(out.length).toBeGreaterThan(500);
  });

  it('pageCount reports correctly', async () => {
    expect(await pageCount(await makePdf(4))).toBe(4);
  });
});

/* ============================ compress ============================ */

/** 造一个含真 JPEG 图像（og-image.jpg, DCTDecode）的 1 页 PDF */
async function makeImagePdf(): Promise<ArrayBuffer> {
  const jpg = new Uint8Array(readFileSync(new URL('../../../public/og-image.jpg', import.meta.url)));
  const doc = await PDFDocument.create();
  const img = await doc.embedJpg(jpg);
  const p = doc.addPage([300, 300]);
  p.drawImage(img, { x: 0, y: 0, width: 300, height: 300 });
  const bytes = await doc.save();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** 列出文档里所有图像流（Subtype=/Image） */
async function imageStreams(buf: ArrayBuffer) {
  const doc = await loadPdf(buf);
  const out: { contents: Uint8Array; width: string }[] = [];
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFRawStream && obj.dict.get(PDFName.of('Subtype'))?.toString() === '/Image') {
      out.push({
        contents: obj.contents,
        width: obj.dict.get(PDFName.of('Width'))?.toString() ?? '?',
      });
    }
  }
  return out;
}

const halfSized: ImageRecompressor = async jpeg => ({
  bytes: jpeg.slice(0, Math.floor(jpeg.length / 2)),
  width: 600,
  height: 400,
});

const bigger: ImageRecompressor = async jpeg => ({
  bytes: new Uint8Array(jpeg.length + 1024),
  width: 10,
  height: 10,
});

describe('compressPdf', () => {
  it('text-only pdf: no images scanned, output stays valid and never larger', async () => {
    const src = await makePdf(2);
    const r = await compressPdf(src, 'balanced');
    expect(r.imagesScanned).toBe(0);
    expect(r.imagesOptimized).toBe(0);
    expect(r.compressedSize).toBeLessThanOrEqual(r.originalSize);
    const doc = await loadPdf(r.bytes.buffer.slice(r.bytes.byteOffset, r.bytes.byteOffset + r.bytes.byteLength) as ArrayBuffer);
    expect(doc.getPageCount()).toBe(2);
  });

  it('image pdf: default (node) recompressor degrades to structural pass, scans the jpeg', async () => {
    const src = await makeImagePdf();
    const r = await compressPdf(src, 'balanced');
    expect(r.imagesScanned).toBe(1);
    expect(r.imagesOptimized).toBe(0); // node 无 createImageBitmap → 注入点返回 null
    expect(r.compressedSize).toBeLessThanOrEqual(r.originalSize);
  });

  it('injected recompressor replaces stream bytes, updates dims, and Length is recomputed on save', async () => {
    const src = await makeImagePdf();
    const before = (await imageStreams(src))[0];
    const r = await compressPdf(src, 'balanced', halfSized);
    expect(r.imagesOptimized).toBe(1);
    const outBuf = r.bytes.buffer.slice(r.bytes.byteOffset, r.bytes.byteOffset + r.bytes.byteLength) as ArrayBuffer;
    const after = (await imageStreams(outBuf))[0];
    expect(after.contents.byteLength).toBe(Math.floor(before.contents.byteLength / 2));
    expect(after.width).toBe('600');
  });

  it('replacement is rejected when the "optimized" image is not smaller', async () => {
    const src = await makeImagePdf();
    const r = await compressPdf(src, 'strong', bigger);
    expect(r.imagesScanned).toBe(1);
    expect(r.imagesOptimized).toBe(0);
  });

  it('second pass over an already-optimized file reports alreadyOptimal with equal sizes', async () => {
    const src = await makeImagePdf();
    const first = await compressPdf(src, 'balanced');
    const second = await compressPdf(
      first.bytes.buffer.slice(first.bytes.byteOffset, first.bytes.byteOffset + first.bytes.byteLength) as ArrayBuffer,
      'balanced',
    );
    if (second.alreadyOptimal) {
      expect(second.compressedSize).toBe(second.originalSize);
    }
    // 底线断言：无论哪个分支，都不会比输入大
    expect(second.compressedSize).toBeLessThanOrEqual(second.originalSize);
  });

  it('garbage input rejects with an error (caller shows it in the alert)', async () => {
    const junk = new Uint8Array([1, 2, 3, 4, 5]).buffer as ArrayBuffer;
    await expect(compressPdf(junk, 'balanced')).rejects.toThrow();
  });
});

/* ============================ imagesToPdf（/image-to-pdf 的后端） ============================ *
 *
 * 这组用例覆盖的是本工具对外的三句话，每句话各一条断言：
 *   ① N 张图 → N 页；② 页尺寸 = 图像尺寸 + 2×边距；③ JPEG/PNG 逐字节嵌入、不二次编码。
 * 断言方式是「把产出的 PDF 再用 pdf-lib 读回来量」，不是量字符串长相 —— 读回链路本身
 * 由上面 merge/split 那批用例负责，这里复用 pageCount / imageStreams 两个既有工具。
 *
 * 声明尺寸（width/height）由调用方给出；真实组件永远传 createImageBitmap 的实际像素，
 * 这里传什么数值只影响几何断言的期望值，与「是否逐字节」无关，因此用显式数字即可。
 */

/** 1×1 带 alpha 的 PNG —— 刻意选带 alpha 的，pdf-lib 会拆成 图像+SMask 两个 XObject，
 *  用来钉死「数 XObject 不等于数页数」这个实测坑不被后来人踩回去。 */
const PNG_1PX = Uint8Array.from(atob(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
), c => c.charCodeAt(0));

function toAb(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** 逐字节比较，返回第一个不相等的下标（-1 = 完全相同，长度不同则返回较短长度）。
 *  不用 Buffer：仓库 lint 规则 n/prefer-global/buffer 禁止全局 Buffer，且失败时报的是下标而不是 75KB 数组 diff。 */
function firstDiff(a: Uint8Array, b: Uint8Array): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) {
      return i;
    }
  }
  return a.length === b.length ? -1 : n;
}

describe('imagesToPdf', () => {
  const jpg = new Uint8Array(readFileSync(new URL('../../../public/og-image.jpg', import.meta.url)));

  const twoImages: PdfImageInput[] = [
    { bytes: jpg, mime: 'image/jpeg', width: 1200, height: 630 },
    { bytes: PNG_1PX, mime: 'image/png', width: 200, height: 100 },
  ];

  it('produces a real PDF with exactly one page per image', async () => {
    const out = await imagesToPdf(twoImages, 0);
    expect(String.fromCharCode(...out.slice(0, 5))).toBe('%PDF-');
    expect(await pageCount(toAb(out))).toBe(2);
  });

  it('page geometry follows each image size, and margin adds on both sides', async () => {
    const bare = await imagesToPdf(twoImages, 0);
    const doc0 = await loadPdf(toAb(bare));
    const a = doc0.getPage(0).getSize();
    const b = doc0.getPage(1).getSize();
    // 逐页不同尺寸是这个工具的明确契约（扫描件/截图不该被拉平），不是缺陷
    expect([a.width, a.height]).toEqual([1200, 630]);
    expect([b.width, b.height]).toEqual([200, 100]);

    const padded = await imagesToPdf(twoImages, 36);
    const doc1 = await loadPdf(toAb(padded));
    expect([doc1.getPage(0).getSize().width, doc1.getPage(1).getSize().height]).toEqual([1200 + 72, 100 + 72]);
  });

  it('embeds the JPEG stream byte-for-byte (no second generation of loss)', async () => {
    const out = await imagesToPdf([twoImages[0]], 0);
    const streams = await imageStreams(toAb(out));
    // JPEG 没有 alpha，不该被拆出 SMask；多一个流就是行为变了
    expect(streams.length).toBe(1);
    // 真判据：读回来的图像流字节与原文件逐字节相等（firstDiff 给下标，不给 75KB diff）
    expect(streams[0].contents.length).toBe(jpg.length);
    expect(firstDiff(streams[0].contents, jpg)).toBe(-1);
  });

  it('rejects a mime pdf-lib cannot embed directly instead of silently producing a blank page', async () => {
    await expect(imagesToPdf(
      [{ bytes: jpg, mime: 'image/webp', width: 10, height: 10 }],
      0,
    )).rejects.toThrow(/unsupported image mime/);
  });

  it('rejects an empty list (caller guards, but the service must not emit a 0-page PDF)', async () => {
    await expect(imagesToPdf([], 0)).rejects.toThrow(/no images/);
  });
});
