import { describe, expect, it } from 'vitest';
import {
  loadPdf,
  mergePdfs,
  pageCount,
  splitPdf,
  watermarkPdf,
} from './pdf-lib.service';
import { PDFDocument } from '@/lib/pdf-lib.esm.min.js';

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
