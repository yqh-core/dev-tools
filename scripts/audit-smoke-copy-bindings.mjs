#!/usr/bin/env node
/**
 * audit-smoke-copy-bindings.mjs —— 检查 smoke 用例里「绑界面文案」的选择器是否还存在。
 *
 * 为什么要有这个门（不是预防性洁癖，是刚付过的学费）
 *   2026-10-17 一次性暴露 8 条红用例：界面文案英文化（99c7d22 / 08c723d / 699e226 三个已提交批次）
 *   把按钮和标签改成了英文，而用例里还写着「查询 WHOIS」「检测状态码」「全角 → 半角」「用户名：」。
 *   构建、typecheck、vitest、两个既有 audit **全都不会红** —— 因为用例文件不在它们的判据面上。
 *   也就是说：改文案的人看不见这个耦合，只有下一次全站 smoke 跑起来才知道，而那时已经隔了两天。
 *
 * 判据
 *   只读**四类界面文案选择器**：steps 里的 click / clickExact / fillLabel.label / waitText.text，
 *   把它们当字面量在 src/ + functions/ + locales/ 全文里找。找不到 = 用例引用了一个界面上
 *   已经不存在的文案 = 下一次跑到必红。
 *   两档判据：click / clickExact / fillLabel.label 找不到即 exit 1（今晚 8 条红全在这一档）；
 *   waitText.text 找不到只警告。
 *   刻意**不检查** expect.text / out / regex 里的期望值：那里大半是算出来的产物
 *   （md5、UUID、罗马数字、进制串），本来就不可能出现在源码语料里 ——
 *   第一版把它们一起判成死断言，256 条全红，就是这个道理。
 *   也不检查 not / outNot：被禁止出现的文案本来就该「不存在」。
 *   刻意用「结构化读取 + 子串搜索」而不是正则切文本：上一版扫描器用 \n 边界切块，
 *   114 条只切出 87 条，那种「0 命中」是扫描面不足造成的假干净。这里先数覆盖率，不足直接 exit 2。
 *
 * 用法
 *   node scripts/audit-smoke-copy-bindings.mjs --check
 *   node scripts/audit-smoke-copy-bindings.mjs --falsify   # 自检：注入一条必然不存在的选择器，必须被抓到
 *
 * 局限（写在脸上，免得被当成万能门）
 *   1) 子串命中不代表语义正确 —— 文案搬到了另一个组件时这里仍然绿，真正判定要靠用例本身跑；
 *   2) 拼出来的文案（`A {{ n }} B` 这类）只能靠**前缀**命中，改中间的插值不会红；
 *   3) 它管不了 expect.text/out 里那些**故意写中文**的载荷断言（例如 whois 依赖
 *      functions/api/whois.js 输出的「注册商」行标签）—— 那类耦合要等函数侧英文化时才会暴露。
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// 上一版用 url.pathname 推仓库根，在 Windows 上拿到 '/D:/work/...'，
// 于是语料一个文件都没读进来，把 256 条断言全判成「不存在」——
// 一个只会误报的门比没有门更糟。用 fileURLToPath 才跨平台。
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const FALSIFY = process.argv.includes('--falsify');

const CORPUS_DIRS = ['src', 'functions', 'locales'];
const CORPUS_EXT = new Set(['.vue', '.ts', '.js', '.mjs', '.cjs', '.yml', '.yaml', '.json', '.md', '.css', '.html']);
const SKIP_DIR = new Set(['node_modules', 'dist', '.git', '.smoke-out', 'generated']);

function collectCorpus() {
  const files = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    }
    catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!SKIP_DIR.has(e.name)) {
          walk(full);
        }
        continue;
      }
      if (CORPUS_EXT.has(path.extname(e.name).toLowerCase())) {
        files.push(full);
      }
    }
  };
  for (const d of CORPUS_DIRS) {
    walk(path.join(REPO, d));
  }
  const blobs = files.map(f => ({ f, text: fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n') }));
  return { files: blobs.length, joined: blobs.map(b => b.text).join('\n') };
}

/** 从一条用例里抽出所有「绑界面文案」的字符串（只取结构化字段，不解析源码文本） */
function copyBindingsOf(c) {
  const out = [];
  for (const s of c.steps || []) {
    if (typeof s.click === 'string') {
      out.push(['steps.click', s.click]);
    }
    if (typeof s.clickExact === 'string') {
      out.push(['steps.clickExact', s.clickExact]);
    }
    if (s.fillLabel && typeof s.fillLabel.label === 'string') {
      out.push(['steps.fillLabel.label', s.fillLabel.label]);
    }
    if (s.waitText && typeof s.waitText.text === 'string') {
      // 第二档：只警告不判红。理由见文件头「局限」——等的是**结果文案**，
      // 常常是插值拼出来的（`${n} files selected`）或接口/数据侧的值（MAC 厂商名），
      // 这些本来就不该在源码语料里出现。硬判会让门天天红，红久了就没人看，等于没有门。
      out.push(['~steps.waitText.text', s.waitText.text]);
    }
  }
  return out;
}

const { SMOKE_CASES } = await import('./smoke-cases.mjs');
const cases = SMOKE_CASES.filter(c => c && c.path);
const corpus = collectCorpus();

let scanned = 0;
let withBindings = 0;
const dead = [];
const soft = [];
const totalBindings = [];

for (const c of cases) {
  const pairs = FALSIFY && c.path === '/base-converter'
    ? [...copyBindingsOf(c), ['steps.click', '【必然不存在的选择器 FALSIFY-ONLY-9d1c】']]
    : copyBindingsOf(c);
  scanned++;
  if (pairs.length) {
    withBindings++;
  }
  for (const [where, text] of pairs) {
    totalBindings.push(`${c.path} ${where}`);
    if (corpus.joined.includes(text)) {
      continue;
    }
    (where.startsWith('~') ? soft : dead).push({ path: c.path, where: where.slice(1), text, sample: text.slice(0, 46) });
  }
}

console.log(`[copy-bindings] 用例 ${scanned} 条（有文案选择器 ${withBindings} 条），字面量 ${totalBindings.length} 个，语料 ${corpus.files} 个文件（${CORPUS_DIRS.join(', ')}）`);

if (scanned !== cases.length || scanned < 100) {
  console.log(`[copy-bindings] ✗ 覆盖率异常：只扫到 ${scanned} 条，不报「干净」`);
  process.exit(2);
}

if (FALSIFY) {
  const caught = dead.filter(d => d.text.includes('FALSIFY-ONLY-9d1c'));
  console.log(`[copy-bindings] 自检：注入 1 条假选择器，抓到 ${caught.length} 条 ${caught.length === 1 ? '✅' : '❌（门是摆设）'}`);
  process.exit(caught.length === 1 ? 0 : 1);
}

if (soft.length) {
  console.log(`[copy-bindings] ℹ ${soft.length} 条 waitText 等待的文案不在源码语料里（插值/数据值，不判红）：`);
  for (const d of soft) {
    console.log(`    ${d.path}  ${d.where}  ${JSON.stringify(d.sample)}`);
  }
}

if (dead.length) {
  console.log(`[copy-bindings] ✗ ${dead.length} 个断言字面量在 src/functions/locales 里都找不到：`);
  for (const d of dead) {
    console.log(`    ${d.path}  ${d.where}  ${JSON.stringify(d.sample)}`);
  }
  console.log('    → 要么界面文案已经改了（用例过期，必须同步），要么这条断言本来就在引用不存在的值。');
  process.exit(1);
}

console.log('[copy-bindings] 校验通过：所有绑界面文案的选择器与期望值都能在语料里找到对应字面量');
process.exit(0);
