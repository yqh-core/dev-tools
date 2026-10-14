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
  loadPdf,
  mergePdfs,
  pageCount,
  splitPdf,
  watermarkPdf,
} from './pdf-lib.service';
import type { ImageRecompressor } from './pdf-lib.service';
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
