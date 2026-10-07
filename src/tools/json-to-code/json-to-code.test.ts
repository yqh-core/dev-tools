import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import JsonToCode from './json-to-code.vue';

/**
 * 这个组件的 infer / buildModel / mergeModel 三者互递归。
 * 它们曾因 const 箭头函数不提升（TDZ）触发 no-use-before-define，
 * 修复方式是改成会被提升的 function 声明 —— 本测试用于锁死「改完仍然真的能跑」。
 */
describe('json-to-code', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  /** 挂载并返回组件生成的代码文本 */
  function generate(json: string, rootName = 'Root', lang = 'ts') {
    // TextareaCopyable 内部用 useMessage()，必须挂在 n-message-provider 下。
    // 它只是「复制到剪贴板」的展示外壳，与被测的类型生成逻辑无关 —— 直接 stub 掉，
    // 让断言聚焦在 infer/buildModel/mergeModel 的递归行为上。
    const options = {
      global: {
        stubs: { TextareaCopyable: true },
      },
    };

    localStorage.setItem('json-to-code:input', json);
    localStorage.setItem('json-to-code:rootName', rootName);
    localStorage.setItem('json-to-code:lang', lang);

    const wrapper = mount(JsonToCode, options);
    const vm = wrapper.vm as unknown as { code: string; parseError: string };
    return { wrapper, code: vm.code, parseError: vm.parseError };
  }

  it('generates a TS interface for a flat object', () => {
    const { code } = generate('{"id":1,"name":"a"}');

    expect(code).toContain('export interface Root {');
    expect(code).toContain('id: number');
    expect(code).toContain('name: string');
  });

  it('generates a nested interface (buildModel → infer recursion)', () => {
    const { code } = generate('{"user":{"id":1,"tags":["a"]}}');

    expect(code).toContain('export interface Root {');
    expect(code).toContain('user: RootUser');
    expect(code).toContain('export interface RootUser {');
    expect(code).toContain('id: number');
  });

  it('merges array-of-object keys (mergeModel → infer recursion)', () => {
    // 两个元素键不同：nickname 只在第一个元素里出现 → 应标记为可选
    const { code } = generate('[{"id":1,"nickname":"x"},{"id":2}]', 'Item');

    expect(code).toContain('export interface Item {');
    expect(code).toContain('id: number');
    expect(code).toContain('nickname?: string');
  });

  it('handles deeply nested arrays of objects without TDZ crash', () => {
    const { code } = generate('{"groups":[{"members":[{"id":1}]}]}');

    expect(code).toContain('export interface RootGroups {');
    expect(code).toContain('export interface RootGroupsMembers {');
    expect(code).toContain('members: RootGroupsMembers[]');
  });

  it('marks null fields as optional', () => {
    const { code } = generate('{"a":null,"b":1}');

    expect(code).toContain('a?: any');
    expect(code).toContain('b: number');
  });

  it('reports a parse error for invalid JSON', () => {
    const { parseError } = generate('{invalid json}');

    expect(parseError).toContain('JSON 解析失败');
  });

  it('emits Java output when language is switched', () => {
    // lang 是普通 ref（不走 useStorage），只能通过组件实例切换
    localStorage.setItem('json-to-code:input', '{"id":1}');
    localStorage.setItem('json-to-code:rootName', 'Root');

    const wrapper = mount(JsonToCode, {
      global: { stubs: { TextareaCopyable: true } },
    });
    (wrapper.vm as unknown as { lang: string }).lang = 'java';
    const code = (wrapper.vm as unknown as { code: string }).code;

    expect(code).toContain('import java.util.List;');
    expect(code).toContain('public class Root {');
    expect(code).toContain('private Double id');
  });

  it('emits Go output with slice types', () => {
    localStorage.setItem('json-to-code:input', '{"tags":["a"]}');
    localStorage.setItem('json-to-code:rootName', 'Root');

    const wrapper = mount(JsonToCode, {
      global: { stubs: { TextareaCopyable: true } },
    });
    (wrapper.vm as unknown as { lang: string }).lang = 'go';
    const code = (wrapper.vm as unknown as { code: string }).code;

    expect(code).toContain('type Root struct {');
    expect(code).toContain('Tags []string');
  });
});
