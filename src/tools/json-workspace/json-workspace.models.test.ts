import { describe, expect, it } from 'vitest';
import { JsonPathError, jsonPath, parsePath } from './jsonpath';
import { inferSchema, inferSchemaDocument } from './schema';

const sample = {
  store: {
    book: [
      { category: 'reference', author: 'Nigel Rees', title: 'Sayings of the Century', price: 8.95 },
      { category: 'fiction', author: 'Evelyn Waugh', title: 'Sword of Honour', price: 12.99 },
      { category: 'fiction', author: 'Herman Melville', title: 'Moby Dick', isbn: '0-553-21311-3', price: 8.99 },
      { category: 'fiction', author: 'J. R. R. Tolkien', title: 'The Lord of the Rings', isbn: '0-395-19395-8', price: 22.99 },
    ],
    bicycle: { color: 'red', price: 19.95 },
  },
  expensive: 10,
};

describe('jsonPath', () => {
  it('根与子节点', () => {
    expect(jsonPath(sample, '$.expensive')).toEqual([10]);
    expect(jsonPath(sample, '$.store.bicycle.color')).toEqual(['red']);
    expect(jsonPath(sample, '$[\'store\'][\'bicycle\'][\'color\']')).toEqual(['red']);
  });

  it('数组下标与负下标', () => {
    expect(jsonPath(sample, '$.store.book[0].title')).toEqual(['Sayings of the Century']);
    expect(jsonPath(sample, '$.store.book[-1].title')).toEqual(['The Lord of the Rings']);
    expect(jsonPath(sample, '$.store.book[99]')).toEqual([]);
  });

  it('通配符', () => {
    expect(jsonPath(sample, '$.store.book[*].author').length).toBe(4);
    expect(jsonPath(sample, '$.store.*').length).toBe(2);
  });

  it('切片', () => {
    expect(jsonPath(sample, '$.store.book[0:2].title')).toEqual(['Sayings of the Century', 'Sword of Honour']);
    expect(jsonPath(sample, '$.store.book[::2].title')).toEqual(['Sayings of the Century', 'Moby Dick']);
    expect(jsonPath(sample, '$.store.book[-2:].title')).toEqual(['Moby Dick', 'The Lord of the Rings']);
  });

  it('递归下降', () => {
    expect(jsonPath(sample, '$..price').length).toBe(5);
    expect(jsonPath(sample, '$..author').length).toBe(4);
    expect(jsonPath(sample, '$..book[0].title')).toEqual(['Sayings of the Century']);
  });

  it('空匹配返回空数组（合法）', () => {
    expect(jsonPath(sample, '$.store.nonexistent')).toEqual([]);
    expect(jsonPath(sample, '$.store.book[0].nonexistent')).toEqual([]);
  });

  it('不支持的过滤表达式明确抛错（不静默返回空冒充无匹配）', () => {
    expect(() => jsonPath(sample, '$.store.book[?(@.price)]')).toThrow(JsonPathError);
  });

  it('负对照：非法路径抛错（不静默返回空）', () => {
    expect(() => parsePath('store.book')).toThrow(JsonPathError);
    expect(() => parsePath('$.store.book[')).toThrow(JsonPathError);
    expect(() => parsePath('$.store.book[abc]')).toThrow(JsonPathError);
    expect(() => parsePath('$..')).toThrow(JsonPathError);
    expect(() => parsePath('$.store.book[1:2:0]')).toThrow(JsonPathError);
  });
});

describe('inferSchema', () => {
  it('标量与对象', () => {
    expect(inferSchema('x')).toEqual({ type: 'string' });
    expect(inferSchema(1)).toEqual({ type: 'integer' });
    expect(inferSchema(1.5)).toEqual({ type: 'number' });
    expect(inferSchema(true)).toEqual({ type: 'boolean' });
    expect(inferSchema(null)).toEqual({ type: 'null' });
    expect(inferSchema({ a: 1, b: 'x' })).toEqual({
      type: 'object',
      properties: { a: { type: 'integer' }, b: { type: 'string' } },
      required: ['a', 'b'],
    });
  });

  it('数组同构合并', () => {
    expect(inferSchema([{ a: 1 }, { a: 2 }])).toEqual({
      type: 'array',
      items: { type: 'object', properties: { a: { type: 'integer' } }, required: ['a'] },
    });
  });

  it('数组异构→anyOf；integer+number→number', () => {
    const s = inferSchema([1, 'x']);
    expect(s.type).toBe('array');
    expect(s.items?.anyOf?.length).toBe(2);
    expect(inferSchema([1, 2.5]).items).toEqual({ type: 'number' });
  });

  it('可选字段（部分对象缺键）required 取交集', () => {
    const s = inferSchema([{ a: 1, b: 2 }, { a: 3 }]);
    expect(s.items?.required).toEqual(['a']);
  });

  it('完整文档含 $schema', () => {
    const doc = inferSchemaDocument({ a: 1 }, 'T');
    expect(doc.$schema).toBe('http://json-schema.org/draft-07/schema#');
    expect(doc.title).toBe('T');
    expect(doc.type).toBe('object');
  });

  it('负对照：空数组 items 为空对象（不谎报元素类型）', () => {
    expect(inferSchema([])).toEqual({ type: 'array', items: {} });
  });
});
