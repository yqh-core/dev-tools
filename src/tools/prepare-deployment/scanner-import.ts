/**
 * WP-003 C 第二刀 · 外部扫描结果导入。
 *
 * 浏览器跑不了 Trivy/Checkov/Hadolint 这些 CLI，但用户在 CI 里跑完后可以把
 * JSON 结果贴进来，闸门据此聚合**真实扫描器输出**，而不只是静态启发式。
 * 这是对标 Vercel/Netlify 预检的关键商业规格：预检结论要能落到真实证据。
 *
 * 支持五种事实上的标准形态（按结构自动识别）：
 *   · Trivy   —— { Results: [{ Vulnerabilities / Misconfigurations / Secrets }] }
 *   · Checkov —— { results: { failed_checks: [...] } }
 *   · Hadolint—— [ { code, message, level, line } ]
 *   · SARIF 2.1.0 —— { version, runs: [{ tool, results }] }（GitHub code scanning 等）
 *   · actionlint —— 默认文本 file:line:col: message [rule]
 *
 * 严重度映射（公开、可审计，不夸大）：
 *   · Trivy 漏洞 CRITICAL/HIGH → blocked；MEDIUM → warning；LOW/UNKNOWN → info
 *   · Trivy 密钥 → blocked；Trivy 配置错误 → warning
 *   · Checkov 失败检查 → warning（IaC 策略，标准输出无严重度字段）
 *   · Hadolint error → warning；其余 → info
 *   · SARIF level 语义因工具而异，一律建议级（error/warning→warning，note/none→info）；
 *     严重度精确闸门用原生 Trivy/Checkov JSON
 *   · actionlint → warning（CI 正确性）
 *
 * 设计边界：纯函数、无副作用；非法 JSON 不崩溃，转为一条 warning 问题；
 * 未知格式转 info；单次导入上限 200 条，超出截断并留 info 痕迹（防报告洪泛）。
 */
import type { Issue } from './prepare-deployment.service';

export type ScannerFormat = 'trivy' | 'checkov' | 'hadolint' | 'sarif' | 'actionlint' | 'unknown';

export interface ScannerImportResult {
  format: ScannerFormat
  issues: Issue[]
  parsedCount: number
}

const MAX_FINDINGS = 200;

function issue(id: string, dimension: Issue['dimension'], severity: Issue['severity'], title: string, evidence: string, suggestion: string): Issue {
  return { id, dimension, severity, title, evidence, suggestion };
}

/** 按 JSON 结构识别格式；不靠文件名（用户贴的是内容）。 */
export function detectFormat(parsed: unknown): ScannerFormat {
  if (Array.isArray(parsed)) {
    if (parsed.length > 0 && parsed.every(x => x && typeof x === 'object' && 'code' in x && 'message' in x)) {
      return 'hadolint';
    }
    return 'unknown';
  }
  if (parsed && typeof parsed === 'object') {
    const o = parsed as Record<string, unknown>;
    if (Array.isArray(o.Results)) {
      return 'trivy';
    }
    const results = o.results as Record<string, unknown> | undefined;
    if (results && Array.isArray(results.failed_checks)) {
      return 'checkov';
    }
    if (Array.isArray(o.runs) && typeof o.version === 'string' && o.version.startsWith('2.1')) {
      return 'sarif';
    }
  }
  return 'unknown';
}

/** actionlint 默认文本输出：`file:line:col: message [rule]`（可无 rule 后缀）。 */
const ACTIONLINT_LINE = /^(.+?):(\d+):(\d+):\s+(.+?)(?:\s+\[([a-z][a-z0-9-]*)\])?\s*$/;

export function looksLikeActionlint(text: string): boolean {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    return false;
  }
  // 多数行命中才认（避免把任意含冒号的文本误判）；首行可能是 "..." 汇总，允许少量不命中。
  const hits = lines.filter(l => ACTIONLINT_LINE.test(l)).length;
  return hits >= Math.max(1, Math.ceil(lines.length * 0.6));
}

function trivySeverity(sev: unknown): Issue['severity'] {
  const s = String(sev ?? '').toUpperCase();
  if (s === 'CRITICAL' || s === 'HIGH') {
    return 'blocked';
  }
  if (s === 'MEDIUM') {
    return 'warning';
  }
  return 'info';
}

function fromTrivy(parsed: Record<string, any>, push: (i: Issue) => void): number {
  let n = 0;
  const seen = new Set<string>();
  const uniq = (base: string) => {
    let id = base;
    let k = 2;
    while (seen.has(id)) {
      id = `${base}-${k++}`;
    }
    seen.add(id);
    return id;
  };
  for (const result of parsed.Results ?? []) {
    const target = String(result?.Target ?? 'artifact');
    for (const v of result?.Vulnerabilities ?? []) {
      const sev = trivySeverity(v?.Severity);
      const cve = String(v?.VulnerabilityID ?? 'UNKNOWN');
      const pkg = String(v?.PkgName ?? '?');
      push(issue(uniq(`TRIVY-${cve}-${pkg}`.replace(/[^\w.-]/g, '_')), 'dependencies', sev,
        `${cve} in ${pkg} (${String(v?.Severity ?? 'UNKNOWN')})`,
        `${target}: ${String(v?.Title ?? v?.Description ?? '').slice(0, 160)}`,
        `Upgrade ${pkg} to a fixed version${v?.FixedVersion ? ` (>= ${v.FixedVersion})` : ''}; see ${cve}.`));
      n++;
    }
    for (const s of result?.Secrets ?? []) {
      push(issue(uniq(`TRIVY-SECRET-${String(s?.RuleID ?? 'rule')}`), 'secrets', 'blocked',
        `Secret detected: ${String(s?.Title ?? s?.RuleID ?? 'credential')}`,
        `${target}: ${String(s?.Match ?? '').slice(0, 120)}`,
        'Remove the secret from the artifact and rotate it; load it from a secret manager at runtime.'));
      n++;
    }
    for (const m of result?.Misconfigurations ?? []) {
      push(issue(uniq(`TRIVY-MIS-${String(m?.ID ?? 'mis')}`), 'config', 'warning',
        `Misconfiguration: ${String(m?.Title ?? m?.ID ?? 'policy')}`,
        `${target}: ${String(m?.Message ?? '').slice(0, 160)}`,
        String(m?.Resolution ?? 'Fix the misconfiguration before deploy.')));
      n++;
    }
  }
  return n;
}

function fromCheckov(parsed: Record<string, any>, push: (i: Issue) => void): number {
  let n = 0;
  const seen = new Set<string>();
  for (const c of parsed?.results?.failed_checks ?? []) {
    const checkId = String(c?.check_id ?? 'CHECK');
    let id = `CHECKOV-${checkId}`.replace(/[^\w.-]/g, '_');
    let k = 2;
    while (seen.has(id)) {
      id = `CHECKOV-${checkId}-${k++}`.replace(/[^\w.-]/g, '_');
    }
    seen.add(id);
    push(issue(id, 'config', 'warning',
      `Checkov ${checkId}: ${String(c?.check_name ?? 'policy failed')}`,
      `${String(c?.file_path ?? '?')}:${String(c?.resource ?? '?')}`,
      String(c?.guideline ?? 'Remediate the failed policy before deploy.')));
    n++;
  }
  return n;
}

function fromHadolint(parsed: any[], push: (i: Issue) => void): number {
  let n = 0;
  const seen = new Set<string>();
  for (const h of parsed) {
    const code = String(h?.code ?? 'DL????');
    const line = String(h?.line ?? '?');
    let id = `HADOLINT-${code}-L${line}`;
    let k = 2;
    while (seen.has(id)) {
      id = `HADOLINT-${code}-L${line}-${k++}`;
    }
    seen.add(id);
    const sev: Issue['severity'] = String(h?.level ?? '').toLowerCase() === 'error' ? 'warning' : 'info';
    push(issue(id, 'docker', sev,
      `Hadolint ${code}: ${String(h?.message ?? '').slice(0, 120)}`,
      `${String(h?.file ?? 'Dockerfile')}:${line}`,
      'See the Hadolint rule wiki for the recommended fix.'));
    n++;
  }
  return n;
}

/** SARIF 2.1.0：通用静态分析容器（GitHub code scanning / Trivy / Checkov / actionlint 均可产）。
 *  level 语义因工具而异，故一律按建议处理（error/warning→warning，note/none→info）；
 *  需要严重度精确闸门时用原生 Trivy/Checkov JSON（见 guide）。 */
function fromSarif(parsed: Record<string, any>, push: (i: Issue) => void): number {
  let n = 0;
  const seen = new Set<string>();
  for (const run of parsed.runs ?? []) {
    const tool = String(run?.tool?.driver?.name ?? 'scanner');
    for (const r of run?.results ?? []) {
      const rule = String(r?.ruleId ?? 'rule');
      const level = String(r?.level ?? 'warning').toLowerCase();
      const sev: Issue['severity'] = (level === 'note' || level === 'none') ? 'info' : 'warning';
      const loc = r?.locations?.[0]?.physicalLocation;
      const uri = String(loc?.artifactLocation?.uri ?? '?');
      const line = String(loc?.region?.startLine ?? '?');
      let id = `SARIF-${tool}-${rule}-${uri}-${line}`.replace(/[^\w.-]/g, '_');
      let k = 2;
      while (seen.has(id)) {
        id = `SARIF-${tool}-${rule}-${uri}-${line}-${k++}`.replace(/[^\w.-]/g, '_');
      }
      seen.add(id);
      push(issue(id, 'ci', sev,
        `${tool} ${rule}: ${String(r?.message?.text ?? '').slice(0, 120)}`,
        `${uri}:${line} (SARIF level: ${level})`,
        'Review the finding in the source tool; SARIF levels are advisory — use native Trivy/Checkov JSON for severity-precise gating.'));
      n++;
    }
  }
  return n;
}

/** actionlint 文本：GitHub Actions 工作流静态检查（CI 正确性，归 warning）。 */
function fromActionlint(text: string, push: (i: Issue) => void): number {
  let n = 0;
  const seen = new Set<string>();
  for (const raw of text.split('\n')) {
    const m = ACTIONLINT_LINE.exec(raw.trim());
    if (!m) {
      continue;
    }
    const [, file, line, col, message, rule] = m;
    let id = `ACTIONLINT-${rule ?? 'msg'}-${file}-${line}`.replace(/[^\w.-]/g, '_');
    let k = 2;
    while (seen.has(id)) {
      id = `ACTIONLINT-${rule ?? 'msg'}-${file}-${line}-${k++}`.replace(/[^\w.-]/g, '_');
    }
    seen.add(id);
    push(issue(id, 'ci', 'warning',
      `actionlint${rule ? ` [${rule}]` : ''}: ${message.slice(0, 120)}`,
      `${file}:${line}:${col}`,
      'Fix the workflow issue; see https://github.com/rhysd/actionlint rule docs.'));
    n++;
  }
  return n;
}

/** 导入扫描结果文本 → 问题清单。非法/未知格式不崩溃，转为可见问题。 */
export function importScannerResults(text: string): ScannerImportResult {
  const trimmed = (text ?? '').trim();
  if (!trimmed) {
    return { format: 'unknown', issues: [], parsedCount: 0 };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  }
  catch (e) {
    // 非 JSON：先试 actionlint 文本（它的默认输出不是 JSON），再判解析失败。
    if (looksLikeActionlint(trimmed)) {
      const collected: Issue[] = [];
      let total = 0;
      const push = (i: Issue) => {
        if (collected.length < MAX_FINDINGS) {
          collected.push(i);
        }
        total++;
      };
      fromActionlint(trimmed, push);
      if (total > MAX_FINDINGS) {
        collected.push(issue('SCN-TRUNC-001', 'config', 'info', `Scanner output truncated to ${MAX_FINDINGS} findings`, `${total} findings total, ${MAX_FINDINGS} shown`, 'Fix the highest-severity findings first; re-run the scanner after remediation.'));
      }
      return { format: 'actionlint', issues: collected, parsedCount: total };
    }
    return {
      format: 'unknown',
      parsedCount: 0,
      issues: [issue('SCN-PARSE-001', 'config', 'warning', 'Scanner results are not valid JSON or actionlint text', String(e).slice(0, 120), 'Paste the raw JSON output of Trivy / Checkov / Hadolint / SARIF, or actionlint text output.')],
    };
  }
  const format = detectFormat(parsed);
  if (format === 'unknown') {
    return {
      format,
      parsedCount: 0,
      issues: [issue('SCN-FORMAT-001', 'config', 'info', 'Scanner format not recognized', 'expected Trivy {Results:[…]}, Checkov {results:{failed_checks:[…]}}, Hadolint [{code,message,…}], SARIF {version,runs:[…]}, or actionlint text', 'Export JSON / SARIF from one of the supported scanners; other formats are ignored rather than guessed.')],
    };
  }
  const collected: Issue[] = [];
  let total = 0;
  const push = (i: Issue) => {
    if (collected.length < MAX_FINDINGS) {
      collected.push(i);
    }
    total++;
  };
  if (format === 'trivy') {
    fromTrivy(parsed as Record<string, any>, push);
  }
  else if (format === 'checkov') {
    fromCheckov(parsed as Record<string, any>, push);
  }
  else if (format === 'sarif') {
    fromSarif(parsed as Record<string, any>, push);
  }
  else {
    fromHadolint(parsed as any[], push);
  }
  if (total > MAX_FINDINGS) {
    collected.push(issue('SCN-TRUNC-001', 'config', 'info', `Scanner output truncated to ${MAX_FINDINGS} findings`, `${total} findings total, ${MAX_FINDINGS} shown`, 'Fix the highest-severity findings first; re-run the scanner after remediation.'));
  }
  return { format, issues: collected, parsedCount: total };
}
