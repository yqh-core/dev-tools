import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { signatureAxes, summarizeSignatures } from './pdf-signature-checker.service';
import { inspectPdf } from './pdf-signature-checker.check';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(__dirname, '__fixtures__');

function load(name: string): ArrayBuffer {
  const buf = fs.readFileSync(path.join(fixtureDir, name));
  // 拷成独立 ArrayBuffer，避免 Node Buffer 的 byteOffset 让 verifyPDF 读偏。
  const out = new ArrayBuffer(buf.length);
  new Uint8Array(out).set(buf);
  return out;
}

describe('pdf signature checker — real PDF fixtures (runs the actual pdf-signature-reader)', () => {
  it('reports a valid, complete, unsigned PDF as "unsigned"', () => {
    expect(inspectPdf(load('unsigned.pdf')).kind).toBe('unsigned');
  });

  it('reports a signature in an unsupported format as "unsupported-signature" (not "unsigned")', () => {
    const outcome = inspectPdf(load('unsupported-signature.pdf'));
    expect(outcome.kind).toBe('unsupported-signature');
    expect(outcome.subFilter).toBe('adbe.pkcs7.sha1');
  });

  it('reports a truncated PDF as "unreadable" rather than falsely claiming it is simply unsigned', () => {
    // 有 %PDF 头但没有 %%EOF：底层库和「无签名」给出同一句 "cannot find subfilter"，
    // 靠 EOF 标记启发把它降级为「不可读 / 疑似损坏」—— 这正是老实现漏掉的一类失败反馈。
    expect(inspectPdf(load('corrupt-truncated.pdf')).kind).toBe('unreadable');
  });

  it('reports a non-PDF file as "not-a-pdf"', () => {
    expect(inspectPdf(load('not-a-pdf.pdf')).kind).toBe('not-a-pdf');
  });

  it('keeps the four failure samples as four DISTINCT outcomes (the core anti-conflation guarantee)', () => {
    const kinds = new Set([
      inspectPdf(load('unsigned.pdf')).kind,
      inspectPdf(load('unsupported-signature.pdf')).kind,
      inspectPdf(load('corrupt-truncated.pdf')).kind,
      inspectPdf(load('not-a-pdf.pdf')).kind,
    ]);
    // 无签名 / 不支持 / 损坏 / 非 PDF 必须各自独立，不能被折叠成一句 "No signatures found"。
    expect(kinds).toEqual(new Set(['unsigned', 'unsupported-signature', 'unreadable', 'not-a-pdf']));
  });

  it('on a genuinely signed (self-signed) PDF, separates integrity=PASS from trust=FAIL', () => {
    const outcome = inspectPdf(load('signed-intact-untrusted.pdf'));
    expect(outcome.kind).toBe('signed');
    expect(outcome.signatures).toHaveLength(1);

    const axes = signatureAxes(outcome.signatures![0]);
    expect(axes.integrity).toBe('pass'); // 密码学完整性：被签名内容没被动过
    expect(axes.trust).toBe('fail'); // 证书链：自签证书不在本工具受信根集合内
    expect(axes.validity).toBe('pass');
    // 关键：完整性通过 ≠ 整体验证通过，两者绝不等号划等号。
    expect(axes.verified).toBe('fail');

    const summary = summarizeSignatures(outcome.signatures!);
    expect(summary.allIntegrityPass).toBe(true);
    expect(summary.allTrustPass).toBe(false);
    expect(summary.allVerified).toBe(false);
  });

  it('detects post-signing tampering via the integrity axis (integrity=FAIL)', () => {
    const outcome = inspectPdf(load('signed-tampered.pdf'));
    // 篡改发生在被签名的字节范围内 -> 摘要不再吻合；库仍能解析出签名，故 kind 仍是 signed，但 integrity 轴必须翻红。
    expect(outcome.kind).toBe('signed');
    const axes = signatureAxes(outcome.signatures![0]);
    expect(axes.integrity).toBe('fail');
    expect(axes.verified).toBe('fail');
  });
});
