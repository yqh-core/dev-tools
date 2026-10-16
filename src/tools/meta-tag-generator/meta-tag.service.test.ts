import { describe, expect, it } from 'vitest';
import { generateMeta } from '@it-tools/oggen';
import { toValidMetaMarkup } from './meta-tag.service';

describe('meta-tag service', () => {
  it('把 oggen 的 value= 改成合法的 content=', () => {
    expect(toValidMetaMarkup('<meta property="og:title" value="T" />'))
      .toBe('<meta property="og:title" content="T" />');
  });

  it('对真实 oggen 输出生效（不靠自己造的字符串自证）', () => {
    const raw = generateMeta(
      { type: 'website', title: 'T', description: 'D', url: 'https://x/y' } as never,
      { generateTwitterCompatibleMeta: true },
    );
    expect(raw).toContain('value='); // 先证明上游确实产出 value=
    const fixed = toValidMetaMarkup(raw);
    expect(fixed).not.toMatch(/\bvalue=/); // 修完一个都不剩
    expect(fixed).toContain('content="T"');
    expect(fixed).toContain('content="D"');
  });

  it('twitter 与 og 两种前缀都覆盖', () => {
    expect(toValidMetaMarkup('<meta name="twitter:card" value="summary" />'))
      .toBe('<meta name="twitter:card" content="summary" />');
  });

  // 证伪组：挡住「顺手把所有 value= 都 replace 掉」这种省事写法。
  it('content 值里真的含 "value=" 时不被二次替换', () => {
    const one = '<meta property="og:description" value="see config value=1 for details" />';
    const out = toValidMetaMarkup(one);
    expect(out).toBe('<meta property="og:description" content="see config value=1 for details" />');
    expect(out.match(/content=/g)?.length).toBe(1);
  });

  it('非 meta 标签的 value 属性不动（input 的 value 必须留着）', () => {
    const html = '<input type="text" value="keep" /><meta name="x" value="fix" />';
    expect(toValidMetaMarkup(html)).toBe('<input type="text" value="keep" /><meta name="x" content="fix" />');
  });

  it('多条标签逐个替换，且大小写不敏感', () => {
    const raw = '<meta property="a" value="1" />\n<META PROPERTY="b" VALUE="2" />';
    const out = toValidMetaMarkup(raw);
    expect(out).toContain('content="1"');
    expect(out).toContain('content="2"');
    expect(out).not.toMatch(/value="1"|VALUE="2"/);
  });
});
