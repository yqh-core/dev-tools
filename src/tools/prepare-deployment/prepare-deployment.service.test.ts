import { describe, expect, it } from 'vitest';
import { assess, assessProject, deriveGate, hasAnyInput, toMarkdown } from './prepare-deployment.service';

const HEALTHY_PKG = JSON.stringify({
  name: 'demo',
  version: '1.0.0',
  engines: { node: '>=20' },
  scripts: { build: 'vite build', test: 'vitest run' },
});
const HEALTHY_LOCK = '{"lockfileVersion":3,"packages":{}}';
const HEALTHY_DOCKER = 'FROM node:20.11.1-alpine\nUSER node\nHEALTHCHECK CMD wget -qO- http://localhost:3000/ || exit 1\nCMD ["node","server.js"]\n';
const HEALTHY_CI = 'name: ci\non: [push]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n';

const healthy = { packageJson: HEALTHY_PKG, lockfile: HEALTHY_LOCK, dockerfile: HEALTHY_DOCKER, ciYaml: HEALTHY_CI };

describe('gate derivation (fail-closed, independent)', () => {
  it('healthy project → READY', () => {
    const r = assessProject(healthy);
    expect(r.gate).toBe('READY');
    expect(r.summary.blocked).toBe(0);
  });

  it('no input → NOT_ASSESSED (never READY on empty)', () => {
    const r = assessProject({});
    expect(r.gate).toBe('NOT_ASSESSED');
    expect(r.issues).toHaveLength(0);
    expect(hasAnyInput({})).toBe(false);
  });

  it('whitespace-only input → NOT_ASSESSED', () => {
    expect(assessProject({ packageJson: '   ', dockerfile: '\n' }).gate).toBe('NOT_ASSESSED');
  });

  it('blocked dominates warning (paired: same warning set, add one blocked → gate flips)', () => {
    const warnOnly = { packageJson: JSON.stringify({ name: 'x', version: '1.0.0', scripts: { build: 'b' } }), lockfile: HEALTHY_LOCK };
    const r1 = assessProject(warnOnly);
    expect(r1.gate).toBe('READY_WITH_WARNINGS'); // engines missing
    const r2 = assessProject({ ...warnOnly, lockfile: '' });
    expect(r2.gate).toBe('BLOCKED'); // PD-DEP-002 added
  });

  it('warning dominates ready', () => {
    const issues = assess({ packageJson: JSON.stringify({ name: 'x', version: '1.0.0', scripts: { build: 'b' } }), lockfile: HEALTHY_LOCK });
    expect(deriveGate(issues, true)).toBe('READY_WITH_WARNINGS');
  });
});

describe('PD-DEP-002 lockfile (paired negative control)', () => {
  it('fires when package.json present without lockfile', () => {
    const issues = assess({ packageJson: HEALTHY_PKG });
    expect(issues.some(i => i.id === 'PD-DEP-002' && i.severity === 'blocked')).toBe(true);
  });
  it('does NOT fire when lockfile present', () => {
    const issues = assess({ packageJson: HEALTHY_PKG, lockfile: HEALTHY_LOCK });
    expect(issues.some(i => i.id === 'PD-DEP-002')).toBe(false);
  });
});

describe('PD-DEP-001 malformed manifest (fail-closed, no crash)', () => {
  it('invalid JSON → blocked, gate BLOCKED', () => {
    const r = assessProject({ packageJson: '{not json', lockfile: HEALTHY_LOCK });
    expect(r.gate).toBe('BLOCKED');
    expect(r.issues.some(i => i.id === 'PD-DEP-001')).toBe(true);
  });
});

describe('PD-SEC-001 hardcoded credentials (paired per source)', () => {
  it('fires on AWS key in CI', () => {
    const issues = assess({ ciYaml: 'env:\n  AWS: AKIAIOSFODNN7EXAMPLE\n' });
    expect(issues.some(i => i.id === 'PD-SEC-001' && i.severity === 'blocked')).toBe(true);
  });
  it('fires on password assignment in package.json', () => {
    const issues = assess({ packageJson: '{"password":"hunter2secret"}', lockfile: 'x' });
    expect(issues.some(i => i.id === 'PD-SEC-001')).toBe(true);
  });
  it('does NOT fire on placeholder values (exemption)', () => {
    const issues = assess({ ciYaml: 'env:\n  TOKEN: your_token_here\n' });
    expect(issues.some(i => i.id === 'PD-SEC-001')).toBe(false);
  });
  it('does NOT fire on healthy project', () => {
    expect(assess(healthy).some(i => i.id === 'PD-SEC-001')).toBe(false);
  });
});

describe('PD-CI-001 pull_request_target injection (paired)', () => {
  const bad = 'on: pull_request_target\njobs:\n  x:\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: refs/pull/1/head\n';
  it('fires on pull_request_target + PR head checkout', () => {
    const issues = assess({ ciYaml: bad });
    expect(issues.some(i => i.id === 'PD-CI-001' && i.severity === 'blocked')).toBe(true);
  });
  it('does NOT fire on plain pull_request', () => {
    const issues = assess({ ciYaml: bad.replace('pull_request_target', 'pull_request') });
    expect(issues.some(i => i.id === 'PD-CI-001')).toBe(false);
  });
  it('does NOT fire on pull_request_target without PR head checkout', () => {
    const issues = assess({ ciYaml: 'on: pull_request_target\njobs:\n  x:\n    steps:\n      - run: echo hi\n' });
    expect(issues.some(i => i.id === 'PD-CI-001')).toBe(false);
  });
});

describe('Dockerfile rules (paired)', () => {
  it('PD-DOC-001 fires without FROM', () => {
    expect(assess({ dockerfile: 'RUN echo hi\n' }).some(i => i.id === 'PD-DOC-001' && i.severity === 'blocked')).toBe(true);
  });
  it('PD-DOC-002 fires on :latest, not on pinned digest', () => {
    expect(assess({ dockerfile: 'FROM node:latest\nUSER node\n' }).some(i => i.id === 'PD-DOC-002')).toBe(true);
    expect(assess({ dockerfile: 'FROM node@sha256:abc123\nUSER node\n' }).some(i => i.id === 'PD-DOC-002')).toBe(false);
    expect(assess({ dockerfile: HEALTHY_DOCKER }).some(i => i.id === 'PD-DOC-002')).toBe(false);
  });
  it('PD-DOC-003 fires without USER, not with USER', () => {
    expect(assess({ dockerfile: 'FROM node:20\n' }).some(i => i.id === 'PD-DOC-003')).toBe(true);
    expect(assess({ dockerfile: HEALTHY_DOCKER }).some(i => i.id === 'PD-DOC-003')).toBe(false);
  });
  it('PD-DOC-004 info without HEALTHCHECK', () => {
    expect(assess({ dockerfile: 'FROM node:20\nUSER node\n' }).some(i => i.id === 'PD-DOC-004' && i.severity === 'info')).toBe(true);
  });
});

describe('report export', () => {
  it('markdown contains gate and issue IDs', () => {
    const md = toMarkdown(assessProject({ packageJson: HEALTHY_PKG }));
    expect(md).toContain('Gate: BLOCKED');
    expect(md).toContain('PD-DEP-002');
  });
  it('markdown escapes pipes in evidence (no table break)', () => {
    const md = toMarkdown(assessProject({ dockerfile: 'FROM a|b:latest\n' }));
    expect(md).toContain('\\|');
  });
  it('NOT_ASSESSED markdown says no files', () => {
    expect(toMarkdown(assessProject({}))).toContain('No project files provided');
  });
  it('assessedFiles lists only provided inputs', () => {
    const r = assessProject({ packageJson: HEALTHY_PKG, lockfile: HEALTHY_LOCK, lockfileName: 'pnpm-lock.yaml' });
    expect(r.assessedFiles).toEqual(['package.json', 'pnpm-lock.yaml']);
  });
});
