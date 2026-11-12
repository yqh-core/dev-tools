import { afterEach, describe, expect, it, vi } from 'vitest';
import { guardTarget, isBlockedAddress, parseTarget } from './_ssrf.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('parseTarget input layer', () => {
  it('rejects empty, overlong, control chars, bad scheme, embedded credentials', () => {
    expect(parseTarget('').error).toBeTruthy();
    expect(parseTarget('x'.repeat(2049)).error).toBeTruthy();
    expect(parseTarget('http://a.com/\n').error).toBeTruthy();
    expect(parseTarget('ftp://a.com').error).toBeTruthy();
    expect(parseTarget('http://u:p@a.com').error).toBeTruthy();
    expect(parseTarget('not a url').error).toBeTruthy();
  });

  it('accepts bare domain (https prepended) and full https URL', () => {
    expect(parseTarget('example.com').url).toBe('https://example.com/');
    expect(parseTarget('https://example.com/x').url).toBe('https://example.com/x');
  });
});

describe('guardTarget literal IP matrix (negative controls)', () => {
  const blockedV4 = [
    '127.0.0.1', '127.1', '2130706433', '0x7f.1', '0177.0.0.1',
    '10.0.0.1', '169.254.169.254', '192.168.1.1', '172.16.0.1', '100.64.0.1',
    '0.0.0.0', '224.0.0.1', '240.0.0.1', '192.0.2.1', '198.51.100.1', '203.0.113.1', '198.18.0.1',
  ];
  const blockedV6 = [
    '::1', '::', '::ffff:127.0.0.1', '::ffff:169.254.169.254',
    '64:ff9b::7f00:1', '2002:7f00:1::', 'fc00::1', 'fe80::1', 'ff02::1', '2001:db8::1',
  ];
  const publicIp = ['1.1.1.1', '8.8.8.8', '93.184.216.34', '2606:4700::1111', '2001:4860:4860::8888'];

  it.each(blockedV4)('blocks IPv4 %s', async (ip) => {
    const r = await guardTarget(`http://${ip}/`);
    expect(r.error, ip).toBeTruthy();
  });

  it.each(blockedV6)('blocks IPv6 %s', async (ip) => {
    const r = await guardTarget(`http://[${ip}]/`);
    expect(r.error, ip).toBeTruthy();
  });

  it.each(publicIp)('allows public IP %s without DNS', async (ip) => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    const host = ip.includes(':') ? `[${ip}]` : ip;
    const r = await guardTarget(`http://${host}/`);
    expect(r.ok, ip).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });

  it('blocks policy hostnames without DNS', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    for (const h of ['localhost', 'metadata.google.internal', 'foo.local', 'intranet', 'x.internal']) {
      const r = await guardTarget(`http://${h}/`);
      expect(r.error, h).toBeTruthy();
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it('unknown address forms are treated as unsafe', () => {
    expect(isBlockedAddress('garbage')).toBe(true);
  });
});

describe('guardTarget DoH pre-resolution', () => {
  const dohResponse = (data) => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ Answer: data ? [{ type: 1, data }] : [] })));
  };

  it('rejects domain resolving to private IP', async () => {
    dohResponse('127.0.0.1');
    const r = await guardTarget('http://evil.example.com/');
    expect(r.error).toContain('127.0.0.1');
  });

  it('allows domain resolving to public IP', async () => {
    dohResponse('93.184.216.34');
    const r = await guardTarget('http://good.example.com/');
    expect(r.ok).toBe(true);
  });

  it('rejects domain with no answers', async () => {
    dohResponse(null);
    const r = await guardTarget('http://empty.example.com/');
    expect(r.error).toBeTruthy();
  });

  it('reports resolver failure when both providers fail', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network down');
    }));
    const r = await guardTarget('http://down.example.com/');
    expect(r.error).toBeTruthy();
  });
});