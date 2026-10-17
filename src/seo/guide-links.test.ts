/**
 * scanGuideCrossLinks 的单测 —— 重点是**证伪**：
 * 一条只会返回空数组的判据，和一个真有判别力的判据，在绿灯报表里长得一模一样。
 * 所以除了「干净输入判干净」，必须有一条「喂进悬空链接它得报出来」的对照组。
 */
import { describe, expect, it } from 'vitest';

import { scanGuideCrossLinks } from './guide-links';

const PAGES = [{ path: '/guides/csv-to-json' }, { path: '/guides/json-prettify' }];

function htmlWith(targets: string[]) {
  return `<article>${targets.map(t => `<a href="${t}">x</a>`).join('')}</article>`;
}

describe('scanGuideCrossLinks', () => {
  it('全部命中已生成文章时判干净，且真的扫到了链接（不是空转）', () => {
    const map = new Map<string, string>([
      ['/guides/csv-to-json', htmlWith(['/guides/json-prettify', '/guides/csv-to-json'])],
      ['/guides/json-prettify', htmlWith(['/guides/csv-to-json'])],
    ]);
    const r = scanGuideCrossLinks(PAGES, p => map.get(p) ?? '');
    expect(r.dangling).toEqual([]);
    expect(r.checked).toBe(3);
    expect(Object.values(r.perPage).reduce((a, b) => a + b, 0)).toBe(r.checked);
  });

  it('对照组：混进一条未生成的 slug 必须被点名（证明这条判据不是摆设）', () => {
    const map = new Map<string, string>([
      ['/guides/csv-to-json', htmlWith(['/guides/json-prettify', '/guides/never-built'])],
      ['/guides/json-prettify', htmlWith(['/guides/csv-to-json'])],
    ]);
    const r = scanGuideCrossLinks(PAGES, p => map.get(p) ?? '');
    expect(r.checked).toBe(3);
    expect(r.dangling).toEqual(['/guides/csv-to-json -> /guides/never-built']);
  });

  it('带尾斜杠的写法一样要扫到，否则正则一失效整条判据就静默空转', () => {
    const map = new Map<string, string>([
      ['/guides/csv-to-json', htmlWith(['/guides/never-built/'])],
      ['/guides/json-prettify', htmlWith([])],
    ]);
    const r = scanGuideCrossLinks(PAGES, p => map.get(p) ?? '');
    expect(r.checked).toBe(1);
    expect(r.dangling).toEqual(['/guides/csv-to-json -> /guides/never-built']);
  });

  it('页面 HTML 缺失时按 0 条计，checked 会掉下来 —— 调用方靠它识别判据失效', () => {
    const r = scanGuideCrossLinks(PAGES, () => '');
    expect(r.checked).toBe(0);
    expect(r.dangling).toEqual([]);
  });

  it('不把站外绝对 URL 算进来（canonical 由别的判据管）', () => {
    const map = new Map<string, string>([
      ['/guides/csv-to-json', '<link rel="canonical" href="https://digdevbox.com/guides/csv-to-json/">'],
      ['/guides/json-prettify', ''],
    ]);
    const r = scanGuideCrossLinks(PAGES, p => map.get(p) ?? '');
    expect(r.checked).toBe(0);
  });
});
