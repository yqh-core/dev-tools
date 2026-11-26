/**
 * E2E JSON 计数口径工具（独立终审 §6：自动从 JSON 计算通过/总数，禁止手工填数）。
 * 用法：node scripts/count-e2e-records.mjs <e2e.json> [...]
 * 输出：每文件 records/ok/allPass/when + 汇总行（results 数组长度=唯一事实源）。
 */
import fs from 'node:fs';

let total = 0, totalOk = 0;
for (const f of process.argv.slice(2)) {
  let d;
  try {
    d = JSON.parse(fs.readFileSync(f, 'utf8'));
  }
  catch (e) {
    console.log(`${f}: READ-FAIL ${e instanceof Error ? e.message : String(e)}`);
    continue;
  }
  const res = Array.isArray(d.results) ? d.results : [];
  const ok = res.filter(r => r && r.ok === true).length;
  total += res.length; totalOk += ok;
  console.log(`${f}: records=${res.length} ok=${ok} allPass=${String(d.allPass)} when=${d.when ?? '?'}`);
}
console.log(`TOTAL: records=${total} ok=${totalOk}`);
