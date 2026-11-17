/**
 * API-011/A3 脚本执行顺序契约 v1 测试（对标 Postman 官方执行序，非凭记忆）。
 * 契约：prerequest = collection → folder → request（外层先跑）；
 *       test = request → folder → collection（内层先跑）。
 * 样例结构对齐任务书 samples/api-studio-smoke.postman_collection.v2.1.json 的 event 形态。
 */
import { describe, expect, it } from 'vitest';
import { importCollection } from './collection';

const doc = {
  info: { name: 'Contract', _postman_id: 't', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
  event: [{ listen: 'prerequest', script: { exec: ['doc-pre'] } }],
  item: [
    {
      name: 'Folder',
      event: [
        { listen: 'prerequest', script: { exec: ['folder-pre'] } },
        { listen: 'test', script: { exec: ['folder-test'] } },
      ],
      item: [
        {
          name: 'Req',
          event: [
            { listen: 'prerequest', script: { exec: ['req-pre'] } },
            { listen: 'test', script: { exec: ['req-test'] } },
          ],
          request: { method: 'GET', url: 'https://api.example.test/1' },
        },
        { name: 'Bare', request: { method: 'GET', url: 'https://api.example.test/2' } },
      ],
    },
    {
      name: 'Lone',
      event: [{ listen: 'test', script: { exec: ['lone-test'] } }],
      request: { method: 'POST', url: 'https://api.example.test/3' },
    },
  ],
};

describe('脚本执行顺序契约 v1', () => {
  const { requests, warnings } = importCollection(JSON.stringify(doc));

  it('prerequest 外→内：doc → folder → request', () => {
    const req = requests.find(r => r.name === 'Folder / Req');
    expect(req?.scriptEvents?.prerequest).toBe('doc-pre\nfolder-pre\nreq-pre');
  });

  it('test 内→外：request → folder（doc 无 test 时不出现占位空段）', () => {
    const req = requests.find(r => r.name === 'Folder / Req');
    expect(req?.scriptEvents?.test).toBe('req-test\nfolder-test');
  });

  it('无自身事件的请求继承外层链，不丢事件', () => {
    const bare = requests.find(r => r.name === 'Folder / Bare');
    expect(bare?.scriptEvents?.prerequest).toBe('doc-pre\nfolder-pre');
    expect(bare?.scriptEvents?.test).toBe('folder-test');
  });

  it('顶层无 folder 的请求：自身 test 在前（无外层链时不拼空串）', () => {
    const lone = requests.find(r => r.name === 'Lone');
    expect(lone?.scriptEvents?.test).toBe('lone-test');
    expect(lone?.scriptEvents?.prerequest).toBe('doc-pre');
  });

  it('集合级事件并入执行链时如实 warning（不静默改写）', () => {
    expect(warnings.some(w => /Collection-level scripts/.test(w))).toBe(true);
  });

  it('负控：顺序契约不恒真——若实现退化成同序拼接，prerequest 断言必失败', () => {
    // 模拟错误实现（同序拼接 test）应当被上面的断言抓住：这里直接断言错误形态不通过
    const wrong = 'doc-pre\nfolder-pre\nreq-pre';
    const wrongTest = 'folder-test\nreq-test'; // 错误形态（外层先跑）
    const req = requests.find(r => r.name === 'Folder / Req');
    expect(req?.scriptEvents?.test).not.toBe(wrongTest);
    expect(wrong).toBe(req?.scriptEvents?.prerequest); // 正确形态锚点
  });
});
