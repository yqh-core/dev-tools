import { describe, expect, it } from 'vitest';

import type { SignatureInfo } from './pdf-signature-checker.types';
import {
  classifyCheck,
  hasPdfMagicBytes,
  signatureAxes,
  summarizeSignatures,
} from './pdf-signature-checker.service';

function sig(over: Partial<SignatureInfo> = {}): SignatureInfo {
  return {
    verified: true,
    authenticity: true,
    integrity: true,
    expired: false,
    meta: {
      certs: [],
      signatureMeta: { reason: null, contactInfo: null, location: null, name: null },
    },
    ...over,
  };
}

describe('pdf signature classifier', () => {
  it('flags a non-PDF file before ever talking about signatures', () => {
    // 即便库后续会抛「找不到 subfilter」，头部不像 PDF 就必须先判 not-a-pdf —— 这正是老实现把损坏文件说成「无签名」的根因。
    const outcome = classifyCheck({
      hasPdfHeader: false,
      thrown: { type: 'TYPE_PARSE', message: 'cannot find subfilter' },
    });
    expect(outcome.kind).toBe('not-a-pdf');
  });

  it('reads the %PDF- magic within the first kilobyte, not only at offset 0', () => {
    const enc = (s: string) => Uint8Array.from([...s].map(c => c.charCodeAt(0)));
    expect(hasPdfMagicBytes(enc('%PDF-1.7\nhello'))).toBe(true);
    // 允许头部前 ≤1024 字节的二进制注释
    const header = enc('%PDF-1.7');
    const withPrelude = new Uint8Array(300 + header.length);
    withPrelude.set(header, 300);
    expect(hasPdfMagicBytes(withPrelude)).toBe(true);
    expect(hasPdfMagicBytes(enc('PK\x03\x04zip!'))).toBe(false);
    expect(hasPdfMagicBytes(new Uint8Array([0x25, 0x50, 0x44]))).toBe(false); // 太短
  });

  it('classifies a clean PDF without any /SubFilter as unsigned', () => {
    const outcome = classifyCheck({
      hasPdfHeader: true,
      hasEofMarker: true,
      thrown: { type: 'TYPE_PARSE', message: 'cannot find subfilter' },
    });
    expect(outcome.kind).toBe('unsigned');
  });

  it('downgrades a header-only, EOF-less file from "unsigned" to "unreadable"', () => {
    // %PDF 头但缺 %%EOF 结束标记 → 更像截断/损坏，不能谎称「这是一份未签名的完整 PDF」。
    const outcome = classifyCheck({
      hasPdfHeader: true,
      hasEofMarker: false,
      thrown: { type: 'TYPE_PARSE', message: 'cannot find subfilter' },
    });
    expect(outcome.kind).toBe('unreadable');
  });

  it('still reports unsupported-signature even when the EOF marker is missing', () => {
    // 子类型检查发生在解析之前，与是否截断无关。
    const outcome = classifyCheck({
      hasPdfHeader: true,
      hasEofMarker: false,
      thrown: { type: 'UNSUPPORTED_SUBFILTER', message: 'subFilter foo not supported' },
    });
    expect(outcome.kind).toBe('unsupported-signature');
  });

  it('separates "signature present but format unsupported" from "unsigned"', () => {
    const outcome = classifyCheck({
      hasPdfHeader: true,
      thrown: { type: 'UNSUPPORTED_SUBFILTER', message: 'subFilter adbe.pkcs7.sha1 not supported' },
    });
    expect(outcome.kind).toBe('unsupported-signature');
    expect(outcome.subFilter).toBe('adbe.pkcs7.sha1');
  });

  it('returns the parsed signatures only when the library produced a signatures array', () => {
    const outcome = classifyCheck({
      hasPdfHeader: true,
      result: { verified: true, authenticity: true, integrity: true, expired: false, signatures: [sig()] },
    });
    expect(outcome.kind).toBe('signed');
    expect(outcome.signatureCount).toBe(1);
    expect(outcome.signatures).toHaveLength(1);
  });

  it('maps a VERIFY_SIGNATURE failure to signature-invalid (never to signed)', () => {
    const outcome = classifyCheck({
      hasPdfHeader: true,
      result: { verified: false, message: 'Wrong authenticated attributes.', error: { type: 'VERIFY_SIGNATURE', message: 'Wrong authenticated attributes.' } },
    });
    expect(outcome.kind).toBe('signature-invalid');
    expect(outcome.signatures).toBeUndefined();
  });

  it('catches a byte-range mismatch via message, because the library emits an undefined error type', () => {
    // VerifyPDFError.VERIFY_BYTE_RANGE 未定义 → error.type 实为 undefined；判据不能绑死常量，否则篡改样本会被误判成 unreadable/unknown。
    const outcome = classifyCheck({
      hasPdfHeader: true,
      result: { verified: false, message: 'Failed byte range verification.', error: { message: 'Failed byte range verification.' } },
    });
    expect(outcome.kind).toBe('byte-range-mismatch');
  });

  it('classifies a missing ByteRange as unreadable, not as unsigned', () => {
    const outcome = classifyCheck({
      hasPdfHeader: true,
      result: { verified: false, message: 'Failed to locate ByteRange.', error: { type: 'TYPE_PARSE', message: 'Failed to locate ByteRange.' } },
    });
    expect(outcome.kind).toBe('unreadable');
  });

  it('treats an empty signatures array as unsigned rather than signed', () => {
    const outcome = classifyCheck({ hasPdfHeader: true, result: { verified: true, signatures: [] } });
    expect(outcome.kind).toBe('unsigned');
  });

  it('never fabricates a pass: an unrecognized shape falls back to unknown', () => {
    expect(classifyCheck({ hasPdfHeader: true, result: { verified: false } }).kind).toBe('unknown');
    expect(classifyCheck({ hasPdfHeader: true }).kind).toBe('unknown');
  });
});

describe('signature axis semantics (presence / integrity / trust / expiry stay distinct)', () => {
  it('splits a "not trusted" signature into integrity=pass, trust=fail', () => {
    const axes = signatureAxes(sig({ verified: false, authenticity: false, integrity: true, expired: false }));
    expect(axes.integrity).toBe('pass');
    expect(axes.trust).toBe('fail');
    expect(axes.validity).toBe('pass');
    expect(axes.verified).toBe('fail');
  });

  it('splits a "tampered" signature into integrity=fail while trust may still pass', () => {
    const axes = signatureAxes(sig({ verified: false, authenticity: true, integrity: false, expired: false }));
    expect(axes.integrity).toBe('fail');
    expect(axes.trust).toBe('pass');
  });

  it('reports an expired chain as a warn on validity, not a fail on integrity', () => {
    const axes = signatureAxes(sig({ verified: false, authenticity: true, integrity: true, expired: true }));
    expect(axes.validity).toBe('warn');
    expect(axes.integrity).toBe('pass');
  });

  it('returns unknown axes for a missing signature instead of inventing state', () => {
    expect(signatureAxes(null)).toEqual({ integrity: 'unknown', trust: 'unknown', validity: 'unknown', verified: 'unknown' });
  });

  it('summarizes multiple signatures with independent axes', () => {
    const summary = summarizeSignatures([
      sig({ integrity: true, authenticity: true, expired: false }),
      sig({ integrity: true, authenticity: false, expired: false }),
      sig({ integrity: true, authenticity: true, expired: true, verified: false }),
    ]);
    expect(summary.signatureCount).toBe(3);
    expect(summary.allIntegrityPass).toBe(true);
    expect(summary.allTrustPass).toBe(false); // 第二枚不被信任
    expect(summary.anyExpired).toBe(true); // 第三枚过期
    expect(summary.allVerified).toBe(false);
  });
});
