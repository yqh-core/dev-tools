import { describe, expect, it, vi } from 'vitest';
import { onRequest } from '../functions/_middleware';

describe('canonical host middleware', () => {
  it('redirects the HTTPS apex host to HTTPS www and preserves path and query', async () => {
    const next = vi.fn(async () => new Response('next'));
    const response = await onRequest({
      request: new Request('https://digdevbox.com/percentage-calculator?source=gsc'),
      next,
    });

    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe('https://www.digdevbox.com/percentage-calculator?source=gsc');
    expect(next).not.toHaveBeenCalled();
  });

  it('redirects HTTP apex directly to HTTPS www in one hop', async () => {
    const next = vi.fn(async () => new Response('next'));
    const response = await onRequest({
      request: new Request('http://digdevbox.com/legacy/example/?q=1'),
      next,
    });

    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe('https://www.digdevbox.com/legacy/example/?q=1');
    expect(next).not.toHaveBeenCalled();
  });

  it('upgrades HTTP www to HTTPS without changing the host or path', async () => {
    const next = vi.fn(async () => new Response('next'));
    const response = await onRequest({
      request: new Request('http://www.digdevbox.com/tools/?q=1'),
      next,
    });

    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe('https://www.digdevbox.com/tools/?q=1');
    expect(next).not.toHaveBeenCalled();
  });

  it('passes the canonical HTTPS www host through unchanged', async () => {
    const next = vi.fn(async () => new Response('ok', { status: 200 }));
    const response = await onRequest({
      request: new Request('https://www.digdevbox.com/percentage-calculator/'),
      next,
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('ok');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not redirect unrelated hostnames', async () => {
    const next = vi.fn(async () => new Response('other host', { status: 200 }));
    const response = await onRequest({
      request: new Request('https://example.com/path'),
      next,
    });

    expect(response.status).toBe(200);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
