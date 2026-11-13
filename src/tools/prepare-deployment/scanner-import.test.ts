import { describe, expect, it } from 'vitest';
import { detectFormat, importScannerResults, looksLikeActionlint } from './scanner-import';
import { assessProject } from './prepare-deployment.service';

const TRIVY = JSON.stringify({
  SchemaVersion: 2,
  Results: [
    {
      Target: 'app:latest',
      Vulnerabilities: [
        { VulnerabilityID: 'CVE-2024-0001', PkgName: 'openssl', Severity: 'CRITICAL', Title: 'RCE in openssl', FixedVersion: '3.0.13' },
        { VulnerabilityID: 'CVE-2024-0002', PkgName: 'zlib', Severity: 'MEDIUM', Title: 'DoS' },
        { VulnerabilityID: 'CVE-2024-0003', PkgName: 'curl', Severity: 'LOW', Title: 'Minor' },
      ],
      Secrets: [{ RuleID: 'aws-access-key', Title: 'AWS Key', Match: 'AKIA...' }],
      Misconfigurations: [{ ID: 'DS002', Title: 'Root user', Message: 'Image runs as root', Resolution: 'Add USER' }],
    },
  ],
});
const CHECKOV = JSON.stringify({
  check_type: 'dockerfile',
  results: { failed_checks: [{ check_id: 'CKV_DOCKER_3', check_name: 'Ensure USER', resource: 'Dockerfile', file_path: '/Dockerfile', guideline: 'Add a USER directive' }] },
  summary: { failed: 1 },
});
const HADOLINT = JSON.stringify([
  { line: 1, code: 'DL3007', level: 'error', message: 'Using latest is prone to errors', file: 'Dockerfile' },
  { line: 5, code: 'DL3018', level: 'info', message: 'Pin versions in apk add', file: 'Dockerfile' },
]);

const HEALTHY = {
  packageJson: JSON.stringify({ name: 'x', version: '1.0.0', engines: { node: '>=20' }, scripts: { build: 'b' } }),
  lockfile: '{}',
  dockerfile: 'FROM node:20.11.1-alpine\nUSER node\nHEALTHCHECK CMD true\n',
  ciYaml: 'jobs:\n  t:\n    steps:\n      - run: npm test\n',
};

describe('format detection (by structure, not filename)', () => {
  it('detects trivy / checkov / hadolint', () => {
    expect(detectFormat(JSON.parse(TRIVY))).toBe('trivy');
    expect(detectFormat(JSON.parse(CHECKOV))).toBe('checkov');
    expect(detectFormat(JSON.parse(HADOLINT))).toBe('hadolint');
  });
  it('unknown for unrelated shapes (paired negative)', () => {
    expect(detectFormat({ hello: 'world' })).toBe('unknown');
    expect(detectFormat([1, 2, 3])).toBe('unknown');
    expect(detectFormat({ Results: 'not-an-array' })).toBe('unknown');
  });
});

describe('Trivy severity mapping (paired)', () => {
  const r = importScannerResults(TRIVY);
  it('CRITICAL → blocked, MEDIUM → warning, LOW → info', () => {
    const bySev = Object.fromEntries(r.issues.filter(i => i.id.startsWith('TRIVY-CVE')).map(i => [i.id, i.severity]));
    expect(bySev['TRIVY-CVE-2024-0001-openssl']).toBe('blocked');
    expect(bySev['TRIVY-CVE-2024-0002-zlib']).toBe('warning');
    expect(bySev['TRIVY-CVE-2024-0003-curl']).toBe('info');
  });
  it('secret → blocked, misconfig → warning', () => {
    expect(r.issues.find(i => i.id.startsWith('TRIVY-SECRET'))?.severity).toBe('blocked');
    expect(r.issues.find(i => i.id.startsWith('TRIVY-MIS'))?.severity).toBe('warning');
  });
  it('fixed version lands in the suggestion (actionable)', () => {
    expect(r.issues.find(i => i.id.includes('openssl'))?.suggestion).toContain('3.0.13');
  });
});

describe('Checkov / Hadolint mapping', () => {
  it('checkov failed check → warning with guideline', () => {
    const r = importScannerResults(CHECKOV);
    expect(r.format).toBe('checkov');
    expect(r.issues[0].severity).toBe('warning');
    expect(r.issues[0].id).toBe('CHECKOV-CKV_DOCKER_3');
  });
  it('hadolint error → warning, info → info (paired)', () => {
    const r = importScannerResults(HADOLINT);
    expect(r.issues.find(i => i.id.includes('DL3007'))?.severity).toBe('warning');
    expect(r.issues.find(i => i.id.includes('DL3018'))?.severity).toBe('info');
  });
});

describe('robustness negative controls (never crash, never silent)', () => {
  it('malformed JSON → visible warning, not exception', () => {
    const r = importScannerResults('{not json');
    expect(r.issues.some(i => i.id === 'SCN-PARSE-001' && i.severity === 'warning')).toBe(true);
  });
  it('unknown but valid JSON → info, not guessed', () => {
    const r = importScannerResults('{"foo":1}');
    expect(r.issues.some(i => i.id === 'SCN-FORMAT-001' && i.severity === 'info')).toBe(true);
    expect(r.parsedCount).toBe(0);
  });
  it('empty / whitespace → no issues, no input claimed', () => {
    expect(importScannerResults('').issues).toHaveLength(0);
    expect(importScannerResults('   ').issues).toHaveLength(0);
  });
  it('truncates above 200 findings and leaves a trace', () => {
    const many = JSON.stringify([{ code: 'DL3007', level: 'error', message: 'x', line: 1, file: 'D' }].concat(
      Array.from({ length: 250 }, (_, i) => ({ code: `DL${i}`, level: 'info', message: 'm', line: i, file: 'D' })),
    ));
    const r = importScannerResults(many);
    expect(r.parsedCount).toBe(251);
    expect(r.issues.filter(i => i.id.startsWith('HADOLINT'))).toHaveLength(200);
    expect(r.issues.some(i => i.id === 'SCN-TRUNC-001')).toBe(true);
  });
  it('dedupes repeated CVE ids (unique keys for data-test-id)', () => {
    const dup = JSON.stringify({
      Results: [{
        Target: 'a',
        Vulnerabilities: [
          { VulnerabilityID: 'CVE-X', PkgName: 'p', Severity: 'HIGH' },
          { VulnerabilityID: 'CVE-X', PkgName: 'p', Severity: 'HIGH' },
        ],
      }],
    });
    const ids = importScannerResults(dup).issues.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('gate integration (paired: same healthy base, scanner flips verdict)', () => {
  it('healthy project alone → READY', () => {
    expect(assessProject(HEALTHY).gate).toBe('READY');
  });
  it('healthy + Trivy CRITICAL → BLOCKED (real scanner evidence dominates)', () => {
    const r = assessProject({ ...HEALTHY, scannerResults: TRIVY });
    expect(r.gate).toBe('BLOCKED');
    expect(r.assessedFiles.some(f => f.includes('trivy'))).toBe(true);
  });
  it('healthy + Trivy LOW only → READY (info does not block)', () => {
    const low = JSON.stringify({ Results: [{ Vulnerabilities: [{ VulnerabilityID: 'CVE-L', PkgName: 'p', Severity: 'LOW' }] }] });
    expect(assessProject({ ...HEALTHY, scannerResults: low }).gate).toBe('READY');
  });
  it('healthy + Checkov failure → READY_WITH_WARNINGS', () => {
    expect(assessProject({ ...HEALTHY, scannerResults: CHECKOV }).gate).toBe('READY_WITH_WARNINGS');
  });
  it('scanner-only input is still assessed (not NOT_ASSESSED)', () => {
    expect(assessProject({ scannerResults: HADOLINT }).gate).toBe('READY_WITH_WARNINGS');
  });
});

const SARIF = JSON.stringify({
  version: '2.1.0',
  runs: [
    {
      tool: { driver: { name: 'actionlint' } },
      results: [
        { ruleId: 'shellcheck', level: 'error', message: { text: 'SC2086: Double quote to prevent globbing' }, locations: [{ physicalLocation: { artifactLocation: { uri: '.github/workflows/ci.yml' }, region: { startLine: 12 } } }] },
        { ruleId: 'expr-syntax', level: 'note', message: { text: 'Optional style suggestion' }, locations: [{ physicalLocation: { artifactLocation: { uri: '.github/workflows/ci.yml' }, region: { startLine: 30 } } }] },
      ],
    },
  ],
});
const ACTIONLINT_TEXT = '.github/workflows/ci.yml:12:5: SC2086: Double quote to prevent globbing [shellcheck]\n.github/workflows/ci.yml:20:3: property "runs-on" is required [runs-on]\n';

describe('SARIF 2.1.0 (third slice)', () => {
  it('detects SARIF by version+runs (paired negative)', () => {
    expect(detectFormat(JSON.parse(SARIF))).toBe('sarif');
    expect(detectFormat({ version: '2.1.0' })).toBe('unknown');
    expect(detectFormat({ runs: [] })).toBe('unknown');
  });
  it('error/warning → warning, note → info (advisory, paired)', () => {
    const r = importScannerResults(SARIF);
    expect(r.format).toBe('sarif');
    expect(r.issues.find(i => i.id.includes('shellcheck'))?.severity).toBe('warning');
    expect(r.issues.find(i => i.id.includes('expr-syntax'))?.severity).toBe('info');
  });
  it('location lands in evidence (actionable)', () => {
    const r = importScannerResults(SARIF);
    expect(r.issues[0].evidence).toContain('ci.yml:12');
  });
  it('empty runs → no issues, no crash', () => {
    const r = importScannerResults(JSON.stringify({ version: '2.1.0', runs: [] }));
    expect(r.issues).toHaveLength(0);
    expect(r.parsedCount).toBe(0);
  });
  it('healthy + SARIF error → READY_WITH_WARNINGS (advisory does not block)', () => {
    expect(assessProject({ ...HEALTHY, scannerResults: SARIF }).gate).toBe('READY_WITH_WARNINGS');
  });
});

describe('actionlint text (third slice)', () => {
  it('recognizes line format (paired negative)', () => {
    expect(looksLikeActionlint(ACTIONLINT_TEXT)).toBe(true);
    expect(looksLikeActionlint('just some random text')).toBe(false);
    expect(looksLikeActionlint('')).toBe(false);
  });
  it('parses file:line:col + rule into warning issues', () => {
    const r = importScannerResults(ACTIONLINT_TEXT);
    expect(r.format).toBe('actionlint');
    expect(r.parsedCount).toBe(2);
    expect(r.issues.every(i => i.severity === 'warning' && i.dimension === 'ci')).toBe(true);
    expect(r.issues[0].evidence).toContain('ci.yml:12:5');
    expect(r.issues[0].id).toContain('shellcheck');
  });
  it('non-JSON non-actionlint → parse warning (not silent)', () => {
    const r = importScannerResults('hello world without colons');
    expect(r.issues.some(i => i.id === 'SCN-PARSE-001')).toBe(true);
  });
  it('healthy + actionlint → READY_WITH_WARNINGS', () => {
    expect(assessProject({ ...HEALTHY, scannerResults: ACTIONLINT_TEXT }).gate).toBe('READY_WITH_WARNINGS');
  });
});
