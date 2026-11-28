import { describe, expect, it } from 'vitest';
import {
  type CollectionNode,
  type ScriptEvents,
  addFolder,
  addRequest,
  ancestorFolders,
  appendTreeItems,
  chainSources,
  cleanScriptEvents,
  countRequests,
  emptyCollection,
  executablesFromTree,
  findNode,
  findRequestNode,
  firstRequestNode,
  folderMoveOptions,
  loadCollectionTree,
  mergeImportedTree,
  mergeScriptEvents,
  migrateLegacyCollection,
  parseCollectionTree,
  removeNode,
  renameNode,
  reorderNode,
  reparentNode,
  requestPathLabel,
  scriptChain,
  serializeCollectionTree,
  uniqueNodeId,
  updateFolderScripts,
  updateRequestNode,
} from './collection-tree';
import { exportCollectionTree, importCollectionTree } from './collection';
import type { ApiRequestState } from './engine';
import type { SavedRequest } from './store';

const req = (url = 'https://x.test/a', method = 'GET'): ApiRequestState => ({ method, url, headers: [], body: '' });

/** 造一棵：root → [folderA(pre=FOLDER_PRE){ reqA1, reqA2 }, reqTop, folderEmpty]。 */
function sampleTree(): CollectionNode {
  let t = emptyCollection('Root');
  const fa = addFolder(t, null, 'A', 'fA');
  t = fa.tree!;
  const a1 = addRequest(t, 'fA', { id: 'rA1', name: 'a1', request: req('https://x.test/a1') });
  t = a1.tree!;
  const a2 = addRequest(t, 'fA', { id: 'rA2', name: 'a2', request: req('https://x.test/a2') });
  t = a2.tree!;
  const rt = addRequest(t, null, { id: 'rTop', name: 'top', request: req('https://x.test/top') });
  t = rt.tree!;
  const fe = addFolder(t, null, 'Empty', 'fEmpty');
  t = fe.tree!;
  return t;
}

describe('查询', () => {
  it('findNode / findRequestNode / ancestorFolders / pathNames', () => {
    const t = sampleTree();
    expect(findNode(t, 'rA1')?.node.name).toBe('a1');
    expect(findRequestNode(t, 'fA')).toBeNull(); // folder 不是请求
    expect(ancestorFolders(t, 'rA1').map(f => f.name)).toEqual(['A']);
    expect(ancestorFolders(t, 'rTop')).toEqual([]);
  });

  it('requestPathLabel 拼祖先路径名（A / a1；顶层=top）', () => {
    const t = sampleTree();
    expect(requestPathLabel(t, 'rA1')).toBe('A / a1');
    expect(requestPathLabel(t, 'rTop')).toBe('top');
  });

  it('countRequests 忽略 folder 只数叶子；firstRequestNode 文档序', () => {
    const t = sampleTree();
    expect(countRequests(t)).toBe(3);
    expect(firstRequestNode(t)?.id).toBe('rA1');
  });

  it('folderMoveOptions 排除自身与后代（防环）', () => {
    const t = sampleTree();
    const opts = folderMoveOptions(t, 'fA').map(o => o.value);
    expect(opts).not.toContain('fA'); // 自身
    expect(opts).toContain('fEmpty'); // 兄弟 folder 可选
  });
});

describe('脚本链（契约 v1.1：pre 外→内 / test 内→外）', () => {
  it('三层：collection → folder → request 顺序拼接', () => {
    let t = sampleTree();
    t = updateFolderScripts(t, 'fA', { prerequest: 'F-pre', test: 'F-test' }).tree;
    t = { ...t, scripts: { prerequest: 'C-pre', test: 'C-test' } }; // 根集合级
    const a1 = addRequest(t, 'fA', { id: 'rDeep', name: 'deep', request: req(), scripts: { prerequest: 'R-pre', test: 'R-test' } }).tree!;
    // rA1 无自身脚本：pre 继承 collection+folder；test folder(内)→collection(外)
    expect(scriptChain(a1, 'rA1')).toEqual({ pre: 'C-pre\nF-pre', test: 'F-test\nC-test' });
    const c = scriptChain(a1, 'rDeep');
    expect(c.pre).toBe('C-pre\nF-pre\nR-pre');
    expect(c.test).toBe('R-test\nF-test\nC-test');
  });

  it('兄弟隔离：folder A 的脚本不影响 folder B 的后代', () => {
    let t = emptyCollection('R');
    t = addFolder(t, null, 'A', 'fA').tree!;
    t = addFolder(t, null, 'B', 'fB').tree!;
    t = addRequest(t, 'fA', { id: 'ra', name: 'ra', request: req() }).tree!;
    t = addRequest(t, 'fB', { id: 'rb', name: 'rb', request: req() }).tree!;
    t = updateFolderScripts(t, 'fA', { prerequest: 'ONLY-A' }).tree;
    expect(scriptChain(t, 'rb').pre).toBe('');
    expect(scriptChain(t, 'ra').pre).toBe('ONLY-A');
  });

  it('空 folder 不贡献执行单元', () => {
    const ex = executablesFromTree(sampleTree());
    expect(ex.map(e => e.id)).toEqual(['rA1', 'rA2', 'rTop']); // fEmpty 无单元
  });

  it('chainSources 层级标注（collection/folder/request）', () => {
    const t = sampleTree();
    const cs = chainSources(t, 'rA1')!;
    expect(cs.pre.map(s => s.level)).toEqual(['collection', 'folder', 'request']);
    expect(cs.test.map(s => s.level)).toEqual(['request', 'folder', 'collection']);
  });
});

describe('变更（纯函数，返回新树）', () => {
  it('addFolder/addRequest 名称校验与 cap', () => {
    let t = emptyCollection('R');
    expect(addFolder(t, null, '   ').error).toMatch(/1-80/);
    t = addRequest(t, null, { name: 'a', request: req() }).tree!;
    const full = addRequest(t, null, { name: 'b', request: req() }, 1);
    expect(full.error).toMatch(/full/);
  });

  it('removeNode：folder 级联删除其全部后代；root 不可删', () => {
    const t = sampleTree();
    const r = removeNode(t, 'fA');
    expect(r.removedRequests).toBe(2);
    expect(countRequests(r.tree)).toBe(1);
    const rootDel = removeNode(t, t.id);
    expect(rootDel.removed).toBeNull();
    expect(rootDel.tree).toBe(t);
  });

  it('reorderNode：同父内交换，越界 no-op', () => {
    let t = emptyCollection('R');
    t = addRequest(t, null, { id: 'x', name: 'x', request: req() }).tree!;
    t = addRequest(t, null, { id: 'y', name: 'y', request: req() }).tree!;
    expect(t.items.map(i => i.id)).toEqual(['x', 'y']);
    expect(reorderNode(t, 'y', -1).tree.items.map(i => i.id)).toEqual(['y', 'x']);
    expect(reorderNode(t, 'x', -1).tree.items.map(i => i.id)).toEqual(['x', 'y']); // 越界
  });

  it('reparentNode：禁止移入自身/自身子folder（环防呆）', () => {
    let t = emptyCollection('R');
    t = addFolder(t, null, 'A', 'fA').tree!;
    t = addFolder(t, 'fA', 'Inner', 'fInner').tree!;
    expect(reparentNode(t, 'fA', 'fA').error).toMatch(/itself/);
    expect(reparentNode(t, 'fA', 'fInner').error).toMatch(/subfolder/);
    // 合法：把 rTop 移进 fA
    const t2 = addRequest(t, null, { id: 'rTop', name: 'top', request: req() }).tree!;
    const moved = reparentNode(t2, 'rTop', 'fA');
    expect(moved.error).toBeUndefined();
    expect(ancestorFolders(moved.tree, 'rTop').map(f => f.id)).toEqual(['fA']);
  });

  it('renameNode / updateRequestNode 快照解耦', () => {
    let t = sampleTree();
    t = renameNode(t, 'rA1', 'renamed').tree;
    expect(findRequestNode(t, 'rA1')!.name).toBe('renamed');
    const live = req('https://x.test/live');
    const u = updateRequestNode(t, 'rA1', { request: live });
    live.url = 'https://x.test/MUTATED';
    expect(u.node!.request.url).toBe('https://x.test/live'); // 深拷贝切断引用
  });

  it('updateFolderScripts：空段不落盘（脏字段清除）', () => {
    let t = sampleTree();
    t = updateFolderScripts(t, 'fA', { prerequest: '  ', test: '   ' }).tree;
    expect(findNode(t, 'fA')!.node.scripts).toBeUndefined();
  });
});

describe('合并与迁移', () => {
  it('migrateLegacyCollection：flat → root 级请求节点；集合脚本 → root.scripts', () => {
    const saved: SavedRequest[] = [
      { id: 's1', name: 'one', request: req('https://x.test/1'), createdAt: 1, updatedAt: 1, scriptEvents: { prerequest: 'p1' } },
      { id: 's2', name: 'two', request: req('https://x.test/2'), createdAt: 1, updatedAt: 1 },
    ];
    const t = migrateLegacyCollection(saved, { prerequest: 'COLL' });
    expect(countRequests(t)).toBe(2);
    expect(t.scripts).toEqual({ prerequest: 'COLL' });
    expect(findRequestNode(t, 's1')!.scripts).toEqual({ prerequest: 'p1' });
  });

  it('mergeImportedTree BLOCKER 修复：现有手动集合脚本 ⊕ 导入 doc 事件，双侧文本都保留（现有在前）', () => {
    let existing = emptyCollection('R');
    existing = { ...existing, scripts: { prerequest: 'MANUAL' } };
    let imported = emptyCollection('I');
    imported = { ...imported, scripts: { prerequest: 'DOC' } };
    const m = mergeImportedTree(existing, imported);
    expect(m.tree.scripts?.prerequest).toBe('MANUAL\nDOC');
    expect(m.scriptsMerged).toBe(true);
  });

  it('mergeImportedTree：同 id 任意深度原位替换（保留位置），新 id 唯一化追加', () => {
    let existing = emptyCollection('R');
    existing = addFolder(existing, null, 'A', 'fA').tree!;
    existing = addRequest(existing, 'fA', { id: 'rA1', name: 'a1-old', request: req('https://x.test/old') }).tree!;
    let imported = emptyCollection('I');
    imported = addFolder(imported, null, 'A2', 'fA').tree!; // 同 folder id → 原位替换
    imported = addRequest(imported, 'fA', { id: 'rA1', name: 'a1-new', request: req('https://x.test/new') }).tree!;
    imported = addRequest(imported, null, { id: 'rNew', name: 'new', request: req() }).tree!;
    const m = mergeImportedTree(existing, imported);
    expect(findRequestNode(m.tree, 'rA1')!.name).toBe('a1-new');
    expect(m.replaced).toBeGreaterThanOrEqual(1);
    expect(ancestorFolders(m.tree, 'rA1').map(f => f.id)).toEqual(['fA']); // 仍在 folder 内（原位）
  });

  it('appendTreeItems：目录 concat，added=请求数，撞 id 唯一化', () => {
    let existing = emptyCollection('R');
    existing = addRequest(existing, null, { id: 'dup', name: 'a', request: req() }).tree!;
    let imported = emptyCollection('I');
    imported = addRequest(imported, null, { id: 'dup', name: 'b', request: req() }).tree!;
    imported = addRequest(imported, null, { id: 'uniq', name: 'c', request: req() }).tree!;
    const r = appendTreeItems(existing, imported);
    expect(r.added).toBe(2);
    expect(countRequests(r.tree)).toBe(3);
    expect(findNode(r.tree, 'dup-2')).not.toBeNull(); // 撞 id 唯一化
  });
});

describe('脚本合并 helper', () => {
  it('mergeScriptEvents：双侧非空段按换行拼接；空段不进', () => {
    const m = mergeScriptEvents({ prerequest: 'A' }, { prerequest: 'B', test: 'T' });
    expect(m).toEqual({ prerequest: 'A\nB', test: 'T' });
    expect(mergeScriptEvents(undefined, undefined)).toBeUndefined();
  });
  it('cleanScriptEvents：仅空白 → undefined', () => {
    expect(cleanScriptEvents({ prerequest: '  ', test: '' } as ScriptEvents)).toBeUndefined();
  });
  it('uniqueNodeId：冲突追加 -2', () => {
    const t = addRequest(emptyCollection('R'), null, { id: 'k', name: 'a', request: req() }).tree!;
    expect(uniqueNodeId(t, 'k')).toBe('k-2');
    expect(uniqueNodeId(t, 'fresh')).toBe('fresh');
  });
});

describe('树互操作 round-trip（importCollectionTree ↔ exportCollectionTree）', () => {
  const nestedDoc = JSON.stringify({
    info: { name: 'MyAPI', _postman_id: 'coll-1' },
    event: [{ listen: 'prerequest', script: { exec: ['COLL-PRE'] } }],
    item: [
      {
        name: 'Auth',
        _postman_id: 'folder-auth',
        event: [{ listen: 'test', script: { exec: ['FOLDER-TEST'] } }],
        item: [
          { name: 'login', _postman_id: 'req-login', request: { method: 'POST', url: 'https://x.test/login', header: [{ key: 'X', value: '1' }], body: { mode: 'raw', raw: '{}' } } },
        ],
      },
      { name: 'ping', _postman_id: 'req-ping', request: { method: 'GET', url: 'https://x.test/ping' } },
    ],
  });

  it('导入保树：folder 结构化节点、事件留各节点、doc 事件=根 scripts', () => {
    const { tree, requestCount } = importCollectionTree(nestedDoc);
    expect(countRequests(tree)).toBe(2);
    expect(requestCount).toBe(2);
    const auth = findNode(tree, 'folder-auth');
    expect(auth && 'items' in auth.node).toBe(true);
    expect(tree.scripts).toEqual({ prerequest: 'COLL-PRE' });
    expect(findNode(tree, 'folder-auth')!.node.scripts).toEqual({ test: 'FOLDER-TEST' });
  });

  it('Postman v2.1 export deliberately excludes private OpenAPI source metadata', () => {
    const source = {
      ...sampleTree(),
      openApiSync: {
        version: 1 as const,
        fileName: 'users.yaml',
        title: 'Users API',
        openApiVersion: '3.1.0',
        lastSyncedAt: '2026-11-28T12:00:00.000Z',
        specFingerprint: `sha256-${'a'.repeat(64)}`,
        operations: [{
          key: 'operationId:getUser',
          requestId: 'rA1',
          baseNameFingerprint: `sha256-${'b'.repeat(64)}`,
          baseRequestFingerprint: `sha256-${'c'.repeat(64)}`,
        }],
      },
    };
    const exported = exportCollectionTree(source, false);
    expect(JSON.stringify(exported)).not.toContain('openApiSync');
    expect(JSON.stringify(exported)).not.toContain('specFingerprint');
    expect((exported.info as Record<string, unknown>)._postman_id).toBe(source.id);
  });

  it('round-trips per-request auth profiles through Postman v2.1 tree import/export', () => {
    const postman = JSON.stringify({
      info: { name: 'Auth API' },
      item: [{
        name: 'Search',
        request: {
          method: 'GET',
          url: 'https://api.example.test/search',
          auth: { type: 'apikey', apikey: [
            { key: 'key', value: 'X-CLIENT-ID' },
            { key: 'value', value: '{{CLIENT_ID}}' },
            { key: 'in', value: 'header' },
          ] },
        },
      }],
    });
    const imported = importCollectionTree(postman);
    const request = imported.tree.items[0];
    if (!('request' in request)) throw new Error('request node missing');
    expect(request.request.auth).toEqual({ type: 'api-key-header', key: 'X-CLIENT-ID', value: '{{CLIENT_ID}}' });
    const full = exportCollectionTree(imported.tree, false);
    const roundTrip = importCollectionTree(JSON.stringify(full)).tree.items[0];
    if (!('request' in roundTrip)) throw new Error('round-trip request node missing');
    expect(roundTrip.request.auth).toEqual(request.request.auth);

    const safe = exportCollectionTree(imported.tree, true);
    expect(JSON.stringify(safe)).not.toContain('CLIENT_ID');
    const safeRequest = importCollectionTree(JSON.stringify(safe)).tree.items[0];
    if (!('request' in safeRequest)) throw new Error('safe request node missing');
    expect(safeRequest.request.auth).toBeUndefined();
  });
  it('导出保形 + 再导入：嵌套结构与节点 ID round-trip 一致', () => {
    const first = importCollectionTree(nestedDoc).tree;
    const exported = JSON.stringify(exportCollectionTree(first, false));
    const second = importCollectionTree(exported).tree;
    expect(findNode(second, 'folder-auth')).not.toBeNull();
    expect(findNode(second, 'req-login')).not.toBeNull();
    expect(exportCollectionTree(second, false)).toEqual(exportCollectionTree(first, false));
  });

  it('执行链运行期计算：login 继承 collection+folder（pre 外→内）', () => {
    const { tree } = importCollectionTree(nestedDoc);
    expect(scriptChain(tree, 'req-login').pre).toBe('COLL-PRE');
    expect(scriptChain(tree, 'req-login').test).toBe('FOLDER-TEST');
  });
});

describe('持久化（serializeCollectionTree / loadCollectionTree）', () => {
  it('tree round-trip：序列化后读回等价，不迁移', () => {
    const t = sampleTree();
    const { tree, migrated } = loadCollectionTree(serializeCollectionTree(t), null, null);
    expect(migrated).toBe(false);
    expect(countRequests(tree)).toBe(3);
    expect(findNode(tree, 'rA1')?.node.name).toBe('a1');
  });

  it('无 tree 键但有旧 flat saved → 升树（migrated=true），集合脚本入根', () => {
    const savedJson = JSON.stringify([
      { id: 'one', name: 'one', request: req('https://x.test/1'), createdAt: 1, updatedAt: 1, scriptEvents: { prerequest: 'p1' } },
      { id: 'two', name: 'two', request: req('https://x.test/2'), createdAt: 1, updatedAt: 1 },
    ]);
    const { tree, migrated } = loadCollectionTree(null, savedJson, JSON.stringify({ prerequest: 'COLL', test: '' }));
    expect(migrated).toBe(true);
    expect(countRequests(tree)).toBe(2);
    expect(tree.scripts).toEqual({ prerequest: 'COLL' });
    expect(findRequestNode(tree, 'one')!.scripts).toEqual({ prerequest: 'p1' });
  });

  it('tree 键有效时优先于旧 flat（即便 saved 也在）不迁移', () => {
    const treeJson = serializeCollectionTree(sampleTree());
    const savedJson = JSON.stringify([{ id: 'x', name: 'x', request: req(), createdAt: 1, updatedAt: 1 }]);
    const { migrated } = loadCollectionTree(treeJson, savedJson, null);
    expect(migrated).toBe(false);
  });

  it('collection root OpenAPI provenance survives localStorage round-trip and rejects malformed fingerprints', () => {
    const openApiSync = {
      version: 1 as const,
      fileName: 'users.yaml',
      title: 'Users API',
      openApiVersion: '3.1.0',
      lastSyncedAt: '2026-11-28T12:00:00.000Z',
      specFingerprint: `sha256-${'a'.repeat(64)}`,
      operations: [{
        key: 'operationId:getUser',
        requestId: 'rA1',
        baseNameFingerprint: `sha256-${'b'.repeat(64)}`,
        baseRequestFingerprint: `sha256-${'c'.repeat(64)}`,
      }],
    };
    const source = { ...sampleTree(), openApiSync };
    const loaded = loadCollectionTree(serializeCollectionTree(source), null, null);
    expect(loaded.migrated).toBe(false);
    expect(loaded.tree.openApiSync).toEqual(openApiSync);
    expect(parseCollectionTree({ ...source, openApiSync: { ...openApiSync, specFingerprint: 'plain-text' } })).toBeNull();
  });

  it('脏 tree JSON + 无 saved → 空集合，不抛不静默接受脏数据', () => {
    const { tree, migrated } = loadCollectionTree('{bad json', null, null);
    expect(migrated).toBe(false);
    expect(countRequests(tree)).toBe(0);
    const { tree: t2 } = loadCollectionTree(JSON.stringify({ nope: 1 }), null, null);
    expect(countRequests(t2)).toBe(0);
  });
});
