import { describe, expect, it } from 'vitest';
import type { ApiRequestState } from './engine';
import {
  HISTORY_CAP,
  type HistoryEntry,
  NAME_MAX,
  SAVED_CAP,
  type SavedRequest,
  exportSavedRequest,
  isValidName,
  parseHistory,
  parseSaved,
  pushHistory,
  removeHistory,
  removeSaved,
  renameSaved,
  saveRequest,
} from './store';

const req: ApiRequestState = { method: 'GET', url: 'https://api.x.test/v1', headers: [{ name: 'Accept', value: 'application/json' }], body: '' };

function entry(id: string, at: number): HistoryEntry {
  return { id, at, request: req, status: 200, elapsedMs: 12 };
}

describe('pushHistory (ring buffer, newest first)', () => {
  it('prepends entries without mutating the input', () => {
    const base = [entry('a', 1)];
    const next = pushHistory(base, entry('b', 2));
    expect(next.map(e => e.id)).toEqual(['b', 'a']);
    expect(base.map(e => e.id)).toEqual(['a']);
  });

  it('enforces the cap by dropping the oldest (negative control: cap must actually truncate)', () => {
    let list: HistoryEntry[] = [];
    for (let i = 0; i < HISTORY_CAP + 10; i++) {
      list = pushHistory(list, entry(`id-${i}`, i));
    }
    expect(list).toHaveLength(HISTORY_CAP);
    expect(list[0].id).toBe(`id-${HISTORY_CAP + 9}`);
    expect(list.some(e => e.id === 'id-0')).toBe(false);
  });

  it('cap=0 keeps nothing', () => {
    expect(pushHistory([entry('a', 1)], entry('b', 2), 0)).toEqual([]);
  });
});

describe('removeHistory', () => {
  it('removes only the matching id', () => {
    const list = [entry('a', 1), entry('b', 2)];
    expect(removeHistory(list, 'a').map(e => e.id)).toEqual(['b']);
    expect(removeHistory(list, 'missing')).toHaveLength(2);
  });
});

describe('saveRequest (collection v1)', () => {
  it('saves a new request with trimmed name', () => {
    const r = saveRequest([], '  Login  ', req, 100, 'new-id');
    expect(r.error).toBeUndefined();
    expect(r.saved?.name).toBe('Login');
    expect(r.list).toHaveLength(1);
  });

  it('rejects empty / whitespace / overlong names (negative control)', () => {
    for (const bad of ['', '   ', 'x'.repeat(NAME_MAX + 1)]) {
      const r = saveRequest([], bad, req, 1, 'id');
      expect(r.saved).toBeNull();
      expect(r.error).toBeTruthy();
      expect(r.list).toHaveLength(0);
    }
    expect(isValidName('x'.repeat(NAME_MAX))).toBe(true);
  });

  it('same name (case-insensitive) updates in place, keeps id and createdAt', () => {
    const first = saveRequest([], 'Login', req, 100, 'id-1');
    const updatedReq = { ...req, url: 'https://api.x.test/v2' };
    const second = saveRequest(first.list, 'login', updatedReq, 200, 'id-2');
    expect(second.list).toHaveLength(1);
    expect(second.saved?.id).toBe('id-1');
    expect(second.saved?.createdAt).toBe(100);
    expect(second.saved?.updatedAt).toBe(200);
    expect(second.saved?.request.url).toBe('https://api.x.test/v2');
  });

  it('refuses to exceed the cap for NEW names (negative control)', () => {
    let list: SavedRequest[] = [];
    for (let i = 0; i < SAVED_CAP; i++) {
      list = saveRequest(list, `req-${i}`, req, i, `id-${i}`).list;
    }
    const overflow = saveRequest(list, 'one-too-many', req, 999, 'id-x');
    expect(overflow.saved).toBeNull();
    expect(overflow.error).toContain('full');
    expect(overflow.list).toHaveLength(SAVED_CAP);
    // 同名更新不受 cap 限制
    const update = saveRequest(list, 'req-0', req, 1000, 'id-y');
    expect(update.saved?.id).toBe('id-0');
  });

  it('追加语义：集合顺序=插入顺序（导入循环与手动保存同序；Runner 按此序执行）', () => {
    let list: SavedRequest[] = [];
    list = saveRequest(list, '01 - first', req, 1, 'id-1').list;
    list = saveRequest(list, '02 - second', req, 2, 'id-2').list;
    list = saveRequest(list, '03 - third', req, 3, 'id-3').list;
    expect(list.map(s => s.name)).toEqual(['01 - first', '02 - second', '03 - third']);
  });

  it('同名更新不改变位置（插入序稳定，Runner 顺序不漂移）', () => {
    let list = saveRequest([], 'A', req, 1, 'id-a').list;
    list = saveRequest(list, 'B', req, 2, 'id-b').list;
    const updated = saveRequest(list, 'A', req, 3, 'id-x'); // 精确同名更新
    expect(updated.error).toBeUndefined();
    expect(updated.list.map(s => s.name)).toEqual(['A', 'B']);
    expect(updated.list[0].id).toBe('id-a'); // 原地更新，不是头插新条目
    // 大小写变体同名更新保留位置（名字取新 trim 值——既有语义）
    const casing = saveRequest(updated.list, 'a', req, 4, 'id-y');
    expect(casing.list.map(s => s.name)).toEqual(['a', 'B']);
    expect(casing.list[0].id).toBe('id-a');
  });

  it('snapshots the request: editing the original after save does NOT mutate the saved entry (negative control)', () => {
    const live: ApiRequestState = { method: 'POST', url: 'https://api.x.test/login', headers: [{ name: 'Authorization', value: 'Bearer T1' }], body: '{"p":1}' };
    const r = saveRequest([], 'Login', live, 100, 'id-1');
    const savedReq = r.saved!.request;
    // 快照必须切断引用共享（审查发现：原实现直接存活引用，后续编辑会污染集合）
    expect(savedReq).not.toBe(live);
    expect(savedReq.headers).not.toBe(live.headers);
    // 模拟 UI 原地编辑头值（upsertHeader）/追加头/改 URL 与 body
    live.headers[0].value = 'Bearer T2-EDITED';
    live.headers.push({ name: 'X-Added', value: 'later' });
    live.url = 'https://api.x.test/changed';
    live.body = '{"p":2}';
    expect(savedReq.headers).toEqual([{ name: 'Authorization', value: 'Bearer T1' }]);
    expect(savedReq.url).toBe('https://api.x.test/login');
    expect(savedReq.body).toBe('{"p":1}');
    expect(r.list[0].request.headers).toEqual([{ name: 'Authorization', value: 'Bearer T1' }]);
  });

  it('overwrite path also snapshots (same-name update decoupled from later edits)', () => {
    const first = saveRequest([], 'Login', req, 100, 'id-1');
    const live: ApiRequestState = { ...req, url: 'https://api.x.test/v2', headers: [{ name: 'Accept', value: 'application/json' }] };
    const second = saveRequest(first.list, 'login', live, 200, 'id-2');
    live.headers[0].value = 'text/plain-EDITED';
    expect(second.saved?.request.headers).toEqual([{ name: 'Accept', value: 'application/json' }]);
    expect(second.list[0].request.headers).toEqual([{ name: 'Accept', value: 'application/json' }]);
  });
});

describe('renameSaved', () => {
  it('renames and rejects clashes with other entries (negative control)', () => {
    let list = saveRequest([], 'A', req, 1, 'id-a').list;
    list = saveRequest(list, 'B', req, 2, 'id-b').list;
    const ok = renameSaved(list, 'id-a', 'C', 3);
    expect(ok.error).toBeUndefined();
    expect(ok.list.find(s => s.id === 'id-a')?.name).toBe('C');
    const clash = renameSaved(list, 'id-a', 'b', 4);
    expect(clash.error).toBeTruthy();
    expect(clash.list).toEqual(list);
    // 改成自己原来的名字（大小写变化）允许
    const self = renameSaved(list, 'id-a', 'a', 5);
    expect(self.error).toBeUndefined();
  });
});

describe('removeSaved', () => {
  it('removes by id only', () => {
    let list = saveRequest([], 'A', req, 1, 'id-a').list;
    list = saveRequest(list, 'B', req, 2, 'id-b').list;
    expect(removeSaved(list, 'id-a').map(s => s.id)).toEqual(['id-b']);
  });
});

describe('exportSavedRequest (credentials never leave via export)', () => {
  it('strips auth headers and URL credentials, keeps the rest', () => {
    const saved: SavedRequest = {
      id: 's1',
      name: 'With auth',
      request: {
        method: 'POST',
        url: 'https://user:[REDACTED]@api.x.test/login',
        headers: [
          { name: 'Authorization', value: 'Bearer [REDACTED]' },
          { name: 'Content-Type', value: 'application/json' },
        ],
        body: '{"u":"a"}',
      },
      createdAt: 1,
      updatedAt: 1,
    };
    const out = exportSavedRequest(saved);
    expect(out.headers).toEqual([{ name: 'Content-Type', value: 'application/json' }]);
    expect(out.url).toBe('https://api.x.test/login');
    expect(out.body).toBe('{"u":"a"}');
    // 原始集合条目不被修改（导出是副本策略）
    expect(saved.request.headers).toHaveLength(2);
  });
});

describe('parseHistory / parseSaved (corrupt storage recovery)', () => {
  it('returns [] for non-array / null / undefined input', () => {
    for (const bad of [null, undefined, {}, 'x', 42]) {
      expect(parseHistory(bad)).toEqual([]);
      expect(parseSaved(bad)).toEqual([]);
    }
  });

  it('drops malformed entries but keeps valid ones (negative control: bad shape must not pass)', () => {
    const good = entry('ok', 1);
    const raw = [
      good,
      { id: 'bad1', at: 'not-a-number', request: req, status: 200, elapsedMs: 1 },
      { id: 'bad2', at: 2, request: { method: 'GET', url: 'x', headers: 'nope', body: '' }, status: 200, elapsedMs: 1 },
      { id: 'bad3', at: 3, request: req, status: '200', elapsedMs: 1 },
      null,
    ];
    const parsed = parseHistory(raw);
    expect(parsed.map(e => e.id)).toEqual(['ok']);
  });

  it('parseSaved dedupes ids and enforces cap', () => {
    const s: SavedRequest = { id: 'dup', name: 'A', request: req, createdAt: 1, updatedAt: 1 };
    const raw = [s, { ...s, name: 'B' }, { ...s, id: 'other' }];
    const parsed = parseSaved(raw);
    expect(parsed.map(x => x.id)).toEqual(['dup', 'other']);
    const many = Array.from({ length: SAVED_CAP + 5 }, (_, i) => ({ ...s, id: `id-${i}` }));
    expect(parseSaved(many)).toHaveLength(SAVED_CAP);
  });

  it('round-trips a real save through JSON', () => {
    const list = saveRequest([], 'Login', req, 100, 'id-1').list;
    const restored = parseSaved(JSON.parse(JSON.stringify(list)));
    expect(restored).toEqual(list);
  });
});
