/**
 * 环境文件解析单测：Postman environment v2.1 + 扁平表双形态，异常 fail-closed。
 */
import { describe, expect, it } from 'vitest';
import { parseEnvironmentFile } from './env-file';

describe('parseEnvironmentFile', () => {
  it('Postman environment v2.1（enabled false 排除，secret 条目照常进）', () => {
    const r = parseEnvironmentFile(JSON.stringify({
      name: 'staging',
      values: [
        { key: 'baseUrl', value: 'https://staging.example.test', enabled: true },
        { key: 'token', value: 'T-1', enabled: true, secret: true },
        { key: 'disabled', value: 'x', enabled: false },
      ],
    }), 'staging.json');
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.name).toBe('staging');
    expect(r.env).toEqual({ baseUrl: 'https://staging.example.test', token: 'T-1' });
  });

  it('扁平键值表（API Studio 导出/手写形态）', () => {
    const r = parseEnvironmentFile(JSON.stringify({ baseUrl: 'https://x.example.test', n: 42 }), 'flat.json');
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.env).toEqual({ baseUrl: 'https://x.example.test', n: '42' });
  });

  it('空 values 数组 → 空环境（合法）', () => {
    const r = parseEnvironmentFile(JSON.stringify({ values: [] }), 'e.json');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.env).toEqual({});
    }
  });

  it('E3 secret 标记收集（Postman values secret:true → secretNames；扁平表无标记机制=空集合）', () => {
    const r = parseEnvironmentFile(JSON.stringify({ values: [{ key: 'token', value: 'T', enabled: true, secret: true }, { key: 'plain', value: 'P', enabled: true }] }), 'e.json');
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.secretNames).toEqual(['token']);
    const flat = parseEnvironmentFile('{"a":"1"}', 'f.json');
    if (flat.ok) {
      expect(flat.secretNames).toEqual([]);
    }
  });

  it.each([
    ['非法 JSON', 'not-json'],
    ['顶层数组', '[1,2]'],
    ['嵌套值', '{"a":{"b":1}}'],
    ['values 条目非对象', '{"values":[42]}'],
    ['key 为空', '{"values":[{"key":"","value":"x"}]}'],
  ])('fail-closed：%s', (_label, text) => {
    const r = parseEnvironmentFile(text, 'e.json');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.length).toBeGreaterThan(0);
    }
  });
});
