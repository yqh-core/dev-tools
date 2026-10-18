// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildDownloadFilename, downloadTextFile, mimeForLanguage } from './downloadText';

describe('downloadText', () => {
  describe('mimeForLanguage', () => {
    it('maps the known format-cluster languages', () => {
      expect(mimeForLanguage('json')).toBe('application/json');
      expect(mimeForLanguage('csv')).toBe('text/csv');
      expect(mimeForLanguage('xml')).toBe('application/xml');
      expect(mimeForLanguage('yaml')).toBe('text/yaml');
      expect(mimeForLanguage('toml')).toBe('application/toml');
    });

    it('is case-insensitive and falls back to text/plain', () => {
      expect(mimeForLanguage('CSV')).toBe('text/csv');
      expect(mimeForLanguage('Json')).toBe('application/json');
      expect(mimeForLanguage('python')).toBe('text/plain');
      expect(mimeForLanguage(undefined)).toBe('text/plain');
      expect(mimeForLanguage('')).toBe('text/plain');
    });
  });

  describe('buildDownloadFilename', () => {
    it('appends the extension when the name has none', () => {
      expect(buildDownloadFilename('data', 'csv')).toBe('data.csv');
      expect(buildDownloadFilename('report', '.json')).toBe('report.json');
    });

    it('does not duplicate an extension already present (case-insensitive)', () => {
      expect(buildDownloadFilename('data.csv', 'csv')).toBe('data.csv');
      expect(buildDownloadFilename('data.CSV', 'csv')).toBe('data.CSV');
    });

    it('falls back to the default name for empty or whitespace input', () => {
      expect(buildDownloadFilename('', 'txt')).toBe('download.txt');
      expect(buildDownloadFilename('   ', 'json')).toBe('download.json');
      expect(buildDownloadFilename(undefined, 'txt', 'converted')).toBe('converted.txt');
    });

    it('strips path separators and illegal filename characters (no traversal, no illegal chars)', () => {
      // 点号是合法文件名字符，所以 "../../" 会塌成前导点串；真正要保证的是
      // 分隔符与非法字符被清掉 —— 否则 `a/b` 会被浏览器当成子路径或非法名。
      const traversal = buildDownloadFilename('../../etc/passwd', 'txt');
      expect(traversal).toBe('....etcpasswd.txt');
      expect(traversal).not.toMatch(/[\\/]/);
      expect(buildDownloadFilename('a/b:c*d?.txt', 'txt')).toBe('abcd.txt');
      expect(buildDownloadFilename('bad\u0000name', 'txt')).toBe('badname.txt');
    });
  });

  describe('downloadTextFile', () => {
    let createSpy: ReturnType<typeof vi.fn>;
    let revokeSpy: ReturnType<typeof vi.fn>;
    let clickedAnchor: HTMLAnchorElement | null;

    beforeEach(() => {
      createSpy = vi.fn(() => 'blob:mock-url');
      revokeSpy = vi.fn();
      URL.createObjectURL = createSpy as unknown as typeof URL.createObjectURL;
      URL.revokeObjectURL = revokeSpy as unknown as typeof URL.revokeObjectURL;
      clickedAnchor = null;
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement,
      ) {
        clickedAnchor = this;
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('returns false and touches nothing when the content is empty', () => {
      const ok = downloadTextFile({ content: '', filename: 'x.csv', mimeType: 'text/csv' });

      expect(ok).toBe(false);
      expect(createSpy).not.toHaveBeenCalled();
      expect(revokeSpy).not.toHaveBeenCalled();
      expect(clickedAnchor).toBeNull();
    });

    it('streams the exact text as a typed blob and revokes the object URL afterwards', () => {
      const content = 'a,b\n1,2';
      const ok = downloadTextFile({ content, filename: 'out.csv', mimeType: 'text/csv' });

      expect(ok).toBe(true);
      expect(createSpy).toHaveBeenCalledTimes(1);

      const blob = createSpy.mock.calls[0][0] as Blob;
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('text/csv;charset=utf-8');

      expect(clickedAnchor).not.toBeNull();
      expect(clickedAnchor!.download).toBe('out.csv');
      expect(clickedAnchor!.href).toContain('blob:mock-url');

      // 关键：用完必须 revoke，否则每次点下载都会漏一个 Blob 引用
      expect(revokeSpy).toHaveBeenCalledTimes(1);
      expect(revokeSpy).toHaveBeenCalledWith('blob:mock-url');
    });

    it('leaves the anchor out of the DOM after clicking', () => {
      downloadTextFile({ content: 'hello', filename: 'a.txt' });

      expect(document.querySelector('a[download="a.txt"]')).toBeNull();
    });
  });
});
