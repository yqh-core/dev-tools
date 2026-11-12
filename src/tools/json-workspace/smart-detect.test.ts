import { describe, expect, it } from 'vitest';
import { encodeBase64Url } from './workspace-link';
import { detectInput } from './smart-detect';

describe('smart detection (deterministic, no AI)', () => {
  it('detects JSON object and array', () => {
    expect(detectInput('{"a":1}').kind).toBe('json');
    expect(detectInput('[1,2,3]').action).toBe('chain');
  });

  it('detects a real JWT and routes to the JWT parser', () => {
    const jwt = `${encodeBase64Url('{"alg":"HS256","typ":"JWT"}')}.${encodeBase64Url('{"sub":"1"}')}.sig`;
    const d = detectInput(jwt);
    expect(d.kind).toBe('jwt');
    expect(d.action).toBe('route');
    expect(d.route).toBe('/jwt-parser');
  });

  it('does not fake-detect a JWT-shaped string with non-JSON header (negative control)', () => {
    expect(detectInput('aaa.bbb.ccc').kind).toBe('unknown');
  });

  it('detects cURL but honestly defers processing to Phase B', () => {
    const d = detectInput('curl -X POST https://x.test -d "{}"');
    expect(d.kind).toBe('curl');
    expect(d.action).toBe('none');
    expect(d.note).toContain('Phase B');
  });

  it('detects docker run and routes to the compose converter', () => {
    const d = detectInput('docker run -p 80:80 nginx');
    expect(d.kind).toBe('docker-run');
    expect(d.route).toBe('/docker-run-to-docker-compose-converter');
  });

  it('detects a valid 5-field cron expression', () => {
    const d = detectInput('0 9 * * 1');
    expect(d.kind).toBe('cron');
    expect(d.route).toBe('/crontab-generator');
  });

  it('five-word prose is NOT cron (negative control)', () => {
    expect(detectInput('the quick brown fox jumps').kind).toBe('unknown');
  });

  it('detects .env with and without export prefix', () => {
    const d = detectInput('A=1\nB=2');
    expect(d.kind).toBe('env');
    expect(d.action).toBe('chain');
    expect(d.source).toBe('env');
    expect(detectInput('export A=1').kind).toBe('env');
  });

  it('detects YAML mapping and offers a parse chain', () => {
    const d = detectInput('a: 1\nb:\n  - x');
    expect(d.kind).toBe('yaml');
    expect(d.source).toBe('yaml');
  });

  it('prose, empty, broken JSON and scalar YAML all fall to unknown (negative controls)', () => {
    expect(detectInput('the quick brown fox jumps over').kind).toBe('unknown');
    expect(detectInput('').kind).toBe('unknown');
    expect(detectInput('{a:').kind).toBe('unknown');
    expect(detectInput('hello').kind).toBe('unknown');
  });
});
