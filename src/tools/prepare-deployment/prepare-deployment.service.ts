/**
 * WP-003 C · Prepare Deployment — 部署准备评估引擎（第一刀）。
 *
 * 产品参照：Vercel / Netlify 的发布前检查；规则族借鉴 actionlint（CI 注入）、
 * Hadolint（Dockerfile）、Trivy（密钥）的公开检查思路，全部为原创浏览器端实现，
 * 不嵌入任何 GPL 代码。浏览器不能跑这些 CLI，故先做导入文本的静态评估；
 * 后续版本支持导入其 SARIF/JSON 扫描结果（见 CHANGELOG 路线）。
 *
 * 设计边界：
 *  · 纯函数，无副作用，全部逻辑可单测（含负控与成对断言）；
 *  · 闸门四态 fail-closed：BLOCKED > READY_WITH_WARNINGS > READY；无输入 = NOT_ASSESSED；
 *  · 每条问题带稳定 ID / 维度 / 严重度 / 证据 / 修复建议，可导出 JSON 与 Markdown。
 */

export type Gate = 'READY' | 'READY_WITH_WARNINGS' | 'BLOCKED' | 'NOT_ASSESSED';
export type Severity = 'blocked' | 'warning' | 'info';
export type Dimension = 'dependencies' | 'docker' | 'ci' | 'secrets' | 'config';

export interface ProjectFiles {
  packageJson?: string
  lockfile?: string
  lockfileName?: string
  dockerfile?: string
  ciYaml?: string
}

export interface Issue {
  id: string
  dimension: Dimension
  severity: Severity
  title: string
  evidence: string
  suggestion: string
}

export interface DeploymentReport {
  gate: Gate
  issues: Issue[]
  summary: { blocked: number; warning: number; info: number }
  assessedFiles: string[]
}

const SECRET = /["']?(api[_-]?key|secret|passwd|password|token|access[_-]?key)["']?\s*[:=]\s*["']?[A-Za-z0-9_\-]{8,}/i;
const AWS_KEY = /AKIA[0-9A-Z]{16}/;
const PRIV_KEY = /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/;
const PLACEHOLDER = /(REDACTED|<[^>]*>|\{\{[^}]*\}\}|example|placeholder|TBD|your[_-])/i;

function hasSecret(text: string): string | null {
  // 结构化密钥格式（AWS/私钥）一律命中，不适用占位符豁免——
  // 文档示例键 AKIA…EXAMPLE 本身就不该出现在代码里。
  for (const rx of [AWS_KEY, PRIV_KEY]) {
    const m = rx.exec(text);
    if (m) {
      return (text.split('\n').find(l => rx.test(l)) ?? m[0]).trim().slice(0, 120);
    }
  }
  // 通用赋值模式：占位符豁免仅作用于这一族（password: example 之类文档写法）。
  const m = SECRET.exec(text);
  if (m) {
    const line = text.split('\n').find(l => SECRET.test(l)) ?? m[0];
    if (!PLACEHOLDER.test(line)) {
      return line.trim().slice(0, 120);
    }
  }
  return null;
}

function issue(id: string, dimension: Dimension, severity: Severity, title: string, evidence: string, suggestion: string): Issue {
  return { id, dimension, severity, title, evidence, suggestion };
}

/** 从 package.json / lockfile / Dockerfile / CI YAML 文本推导问题清单。 */
export function assess(files: ProjectFiles): Issue[] {
  const issues: Issue[] = [];
  const pkgText = files.packageJson?.trim() ?? '';
  const lockText = files.lockfile?.trim() ?? '';
  const dockerText = files.dockerfile?.trim() ?? '';
  const ciText = files.ciYaml?.trim() ?? '';

  // ── dependencies / config ──
  let pkg: Record<string, any> | null = null;
  if (pkgText) {
    try {
      pkg = JSON.parse(pkgText);
    }
    catch (e) {
      issues.push(issue('PD-DEP-001', 'dependencies', 'blocked', 'package.json is not valid JSON', String(e).slice(0, 120), 'Fix the JSON syntax; a malformed manifest cannot be built reproducibly.'));
    }
    if (pkg && !lockText) {
      issues.push(issue('PD-DEP-002', 'dependencies', 'blocked', 'No lockfile provided', 'package.json present, lockfile absent', 'Commit a lockfile (package-lock.json / pnpm-lock.yaml / yarn.lock) so installs are reproducible.'));
    }
    if (pkg) {
      if (!pkg.engines || typeof pkg.engines !== 'object' || Object.keys(pkg.engines).length === 0) {
        issues.push(issue('PD-DEP-003', 'dependencies', 'warning', 'No engines field', 'package.json engines missing', 'Pin node/npm engines to avoid build drift between environments.'));
      }
      if (!pkg.scripts || typeof pkg.scripts.build !== 'string' || !pkg.scripts.build.trim()) {
        issues.push(issue('PD-DEP-004', 'dependencies', 'warning', 'No build script', 'package.json scripts.build missing', 'Define scripts.build so the deploy pipeline has a deterministic entry point.'));
      }
      if (!pkg.name || !pkg.version) {
        issues.push(issue('PD-CFG-001', 'config', 'warning', 'Missing name or version', `name=${pkg.name ?? '(none)'} version=${pkg.version ?? '(none)'}`, 'Set name and version for release identity and artifact binding.'));
      }
    }
  }

  // ── docker（规则族借鉴 Hadolint，原创实现）──
  if (dockerText) {
    const lines = dockerText.split('\n');
    const fromLine = lines.find(l => /^\s*FROM\s+/i.test(l));
    if (!fromLine) {
      issues.push(issue('PD-DOC-001', 'docker', 'blocked', 'Dockerfile has no FROM', 'no FROM directive found', 'Every Dockerfile must declare a base image.'));
    }
    else {
      const image = fromLine.replace(/^\s*FROM\s+/i, '').split(/\s+/)[0];
      if (/:latest$/i.test(image) || (!image.includes(':') && !image.includes('@'))) {
        issues.push(issue('PD-DOC-002', 'docker', 'warning', 'Base image not pinned', fromLine.trim(), 'Pin a digest or explicit version tag; :latest breaks reproducibility.'));
      }
    }
    if (!/^\s*USER\s+/im.test(dockerText)) {
      issues.push(issue('PD-DOC-003', 'docker', 'warning', 'No USER directive (runs as root)', 'USER absent', 'Create and switch to a non-root user before the entrypoint.'));
    }
    if (!/^\s*HEALTHCHECK\s+/im.test(dockerText)) {
      issues.push(issue('PD-DOC-004', 'docker', 'info', 'No HEALTHCHECK', 'HEALTHCHECK absent', 'Add a HEALTHCHECK so orchestrators can detect unhealthy containers.'));
    }
  }

  // ── ci（规则族借鉴 actionlint，原创实现）──
  if (ciText) {
    if (/pull_request_target/i.test(ciText) && /refs\/pull|github\.event\.pull_request\.head/i.test(ciText)) {
      issues.push(issue('PD-CI-001', 'ci', 'blocked', 'pull_request_target checks out PR head (script injection)', 'pull_request_target + PR head checkout detected', 'Use pull_request instead, or never check out untrusted PR code with write permissions.'));
    }
    if (!/(npm|yarn|pnpm|bun)\s+(run\s+)?test|vitest|jest|pytest|go\s+test|cargo\s+test|mvn\s+test|gradle\s+test/i.test(ciText)) {
      issues.push(issue('PD-CI-002', 'ci', 'warning', 'No test step detected', 'no test runner invocation found', 'Run the test suite in CI before deploy; untested releases are the top rollback cause.'));
    }
    if (/permissions:\s*write-all/i.test(ciText)) {
      issues.push(issue('PD-CI-003', 'ci', 'warning', 'Workflow grants write-all permissions', 'permissions: write-all', 'Scope permissions to the minimum needed (least privilege).'));
    }
  }

  // ── secrets（规则族借鉴 Trivy/gitleaks，原创实现）──
  const provided: [string, string][] = [
    ['package.json', pkgText], ['lockfile', lockText], ['Dockerfile', dockerText], ['CI workflow', ciText],
  ];
  for (const [label, text] of provided) {
    if (!text) {
      continue;
    }
    const hit = hasSecret(text);
    if (hit) {
      issues.push(issue('PD-SEC-001', 'secrets', 'blocked', `Hardcoded credential in ${label}`, hit, 'Move the value to a secret manager / CI secrets; never commit credentials.'));
    }
  }

  return issues;
}

/** 闸门独立推导：不信任任何自报状态，只看问题清单。 */
export function deriveGate(issues: Issue[], hasInput: boolean): Gate {
  if (!hasInput) {
    return 'NOT_ASSESSED';
  }
  if (issues.some(i => i.severity === 'blocked')) {
    return 'BLOCKED';
  }
  if (issues.some(i => i.severity === 'warning')) {
    return 'READY_WITH_WARNINGS';
  }
  return 'READY';
}

export function hasAnyInput(files: ProjectFiles): boolean {
  return Boolean(files.packageJson?.trim() || files.lockfile?.trim() || files.dockerfile?.trim() || files.ciYaml?.trim());
}

export function assessProject(files: ProjectFiles): DeploymentReport {
  const issues = assess(files);
  const assessedFiles = [
    files.packageJson?.trim() ? 'package.json' : null,
    files.lockfile?.trim() ? (files.lockfileName?.trim() || 'lockfile') : null,
    files.dockerfile?.trim() ? 'Dockerfile' : null,
    files.ciYaml?.trim() ? 'CI workflow' : null,
  ].filter((x): x is string => x !== null);
  return {
    gate: deriveGate(issues, hasAnyInput(files)),
    issues,
    summary: {
      blocked: issues.filter(i => i.severity === 'blocked').length,
      warning: issues.filter(i => i.severity === 'warning').length,
      info: issues.filter(i => i.severity === 'info').length,
    },
    assessedFiles,
  };
}

/** 导出 Markdown 发布报告（含闸门、问题清单、证据与建议）。 */
export function toMarkdown(report: DeploymentReport): string {
  const lines = [
    '# Prepare Deployment Report',
    '',
    `**Gate: ${report.gate}**`,
    '',
    `Assessed: ${report.assessedFiles.join(', ') || '(none)'}`,
    `Blocked: ${report.summary.blocked} · Warnings: ${report.summary.warning} · Info: ${report.summary.info}`,
    '',
  ];
  if (report.issues.length === 0) {
    lines.push(report.gate === 'NOT_ASSESSED' ? 'No project files provided.' : 'No issues found.');
    return lines.join('\n');
  }
  lines.push('| ID | Dimension | Severity | Issue | Evidence | Suggestion |', '|---|---|---|---|---|---|');
  for (const i of report.issues) {
    const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
    lines.push(`| ${i.id} | ${i.dimension} | ${i.severity} | ${esc(i.title)} | ${esc(i.evidence)} | ${esc(i.suggestion)} |`);
  }
  return lines.join('\n');
}
