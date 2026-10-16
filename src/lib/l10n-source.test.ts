/**
 * 英文站的「界面里不许有中文」源码门禁（棘轮式）。
 *
 * 为什么放在源码层而不是浏览器层
 *   浏览器层我试过了：headless + CDP 逐页读 innerText 才是"用户真看到什么"的最硬判据，
 *   但那套脚本在本机对 113 页全部报 UNDECIDED（同一个 Chrome 用最小探针却能正常打开同一页）。
 *   **一个只会报"未决"的门禁比没有门禁更坏** —— 长期红灯会让人学会忽略它，真回归就藏在里面。
 *   所以这里退回确定性可跑的源码层：不需要浏览器、CI 直接能判，
 *   代价是看不见"拼出来的字符串"，但对 unit-converter 那种「中文写进数据键名」的原始病灶是够的。
 *
 * 为什么是棘轮而不是直接断言全绿
 *   代码库里已有历史残留（这次就是被 unit-converter 撞出来的）。若直接断言"零中文"，
 *   门禁一上来就是红的，等于没有；若只断言"新增的不许超基线"，基线会悄悄烂掉。
 *   所以两个方向都判：
 *     ① 出现基线之外的新违规 → 红（拦住回归）
 *     ② 基线里的文件已经修好了 → 也红（要求把基线缩小，防止它变成永久豁免清单）
 *
 * 注释里的中文是允许的（本仓约定注释写中文），所以先剥注释再判定。
 * 剥法是文本级：先全文剥成对的块注释与模板注释，再逐行剥行注释。
 * 注意别在注释里写斜杠星或 HTML 注释那几个字面量 —— 打包器会把它们当
 * 真标记处理，本文件第一版就因此被报"未终结的正则表达式"。
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..', '..');
const TOOLS = path.join(ROOT, 'src', 'tools');
const BASELINE = path.join(ROOT, 'scripts', 'l10n-cjk-baseline.json');
// 用转义写区间，不放生僻字符面量：源码里出现私用区/全角字符容易被编辑器与打包器咬坏。
// 区间含义：扩展A区 + CJK基本区 + 兼容表意 + 中日韩符号标点 + 全角形式。
const CJK = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u3000-\u303F\uFF00-\uFFEF]/;

function stripComments(src: string): string {
  // 先对**全文**剥块注释（跨行），再逐行处理行注释与纯注释行。
  // 上一版想用状态机逐行处理，结果写出了一条自相矛盾的分支，还容易漏模板里的 <!-- -->。
  const blocked = src
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
  return blocked
    .split('\n')
    // 整行注释直接丢；行尾注释只在「引号里没有 //」时才剥，避免伤到 URL/字符串内容
    .filter(l => !/^\s*(\/\/|\*|#)/.test(l))
    .map(l => (/[ "'`)]\/\/[^"'`]*$/.test(l) && !/["'`][^"'`]*\/\//.test(l) ? l.replace(/\/\/[^"'`]*$/, '') : l))
    .join('\n');
}

function toolFiles(): string[] {
  const files: string[] = [];
  for (const name of readdirSync(TOOLS)) {
    const dir = path.join(TOOLS, name);
    if (!statSync(dir).isDirectory()) {
      continue;
    }
    for (const f of readdirSync(dir)) {
      if (f.endsWith('.vue') || (f.endsWith('.ts') && !f.endsWith('.test.ts'))) {
        files.push(path.join(dir, f));
      }
    }
  }
  return files;
}

function offenders(): Record<string, string[]> {
  const res: Record<string, string[]> = {};
  for (const f of toolFiles()) {
    const hits = stripComments(readFileSync(f, 'utf8'))
      .split('\n')
      .map((l, i) => ({ l, i }))
      .filter(x => CJK.test(x.l))
      .map(x => `${x.i + 1}: ${x.l.trim().slice(0, 70)}`);
    if (hits.length) {
      // 不用 replaceAll：CI 的类型检查走 tsconfig.vitest.json，那份 lib 不含 es2021，
      // `String.prototype.replaceAll` 会被判 TS2550（本地跑 tsconfig.app.json 则看不出问题）。
      res[path.relative(ROOT, f).split('\\').join('/')] = hits;
    }
  }
  return res;
}

describe('英文站界面语言门禁（棘轮）', () => {
  const found = offenders();
  const baseline: Record<string, string[]> = existsSync(BASELINE)
    ? JSON.parse(readFileSync(BASELINE, 'utf8'))
    : {};

  it('探测器本身不是摆设：已知中文串必须被数到', () => {
    expect(CJK.test('根字号')).toBe(true);
    expect(CJK.test('Root font size')).toBe(false);
    // 反过来自证：如果连这个都判不出来，上面所有"干净"结论都不成立
    expect(stripComments('<span>根字号</span>')).not.toBe('');
    expect(CJK.test(stripComments('  // 根字号是基准\n<span>根字号</span>'))).toBe(true);
    expect(CJK.test(stripComments('  // 这一整行是中文注释，不该被算成违规'))).toBe(false);
  });

  it('不允许出现基线之外的新中文（挡住回归）', () => {
    const fresh = Object.keys(found).filter(f => !(f in baseline));
    expect(fresh, `这些文件把中文写进了界面文案：\n${fresh.map(f => `  ${f}\n    ${found[f][0]}`).join('\n')}`)
      .toEqual([]);
  });

  it('基线里的文件修好了就必须从基线删掉（防它变成永久豁免清单）', () => {
    const stale = Object.keys(baseline).filter(f => !(f in found));
    expect(stale, `这些文件已经没有中文了，请把它们从 scripts/l10n-cjk-baseline.json 里删掉：\n  ${stale.join('\n  ')}`)
      .toEqual([]);
  });

  it('基线自身必须与磁盘一致（行数变了也要重生成，不许只增不减地漂）', () => {
    for (const f of Object.keys(baseline)) {
      if (f in found) {
        expect(found[f], `${f} 的中文行与基线不符，请重生成基线`).toEqual(baseline[f]);
      }
    }
  });
});
