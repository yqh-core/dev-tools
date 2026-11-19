import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const CONSENT_KEY = 'digdevbox.analytics-consent.v1';
const SCRIPT = readFileSync(resolve(process.cwd(), 'public/analytics-consent.js'), 'utf8');

function boot(path = '/test-page?private=value') {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  localStorage.clear();
  history.replaceState({}, '', path);
  document.title = 'Test page';
  window.eval(SCRIPT);
  document.dispatchEvent(new Event('DOMContentLoaded'));
}

function clickButton(label: string) {
  const button = Array.from(document.querySelectorAll('button')).find(
    item => item.textContent === label,
  );
  if (!button) throw new Error(`Missing button: ${label}`);
  button.click();
}

function calls() {
  return Array.from(((window as any).dataLayer ?? []) as IArguments[])
    .map(args => Array.from(args));
}

function pageViews() {
  return calls().filter(([kind, name]) => kind === 'event' && name === 'page_view');
}

describe('shared GA4 consent gate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    boot();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('shows a visible fixed consent prompt before loading Google Analytics', () => {
    const prompt = document.getElementById('digdevbox-analytics-consent');
    expect(prompt).not.toBeNull();
    expect(prompt?.style.position).toBe('fixed');
    expect(prompt?.style.bottom).toBe('16px');
    expect(document.querySelector('script[src*="googletagmanager.com"]')).toBeNull();
    expect((window as any).dataLayer).toBeUndefined();
  });

  it('does not load GA4 or emit page views when analytics is rejected', () => {
    clickButton('Reject analytics');

    expect(localStorage.getItem(CONSENT_KEY)).toBe('rejected');
    expect(document.querySelector('script[src*="googletagmanager.com"]')).toBeNull();
    expect((window as any).dataLayer).toBeUndefined();

    history.pushState({}, '', '/another-page?secret=should-not-be-sent');
    vi.runAllTimers();

    expect(document.querySelector('script[src*="googletagmanager.com"]')).toBeNull();
    expect((window as any).dataLayer).toBeUndefined();
  });

  it('loads GA4 only after acceptance and sends a path-only page view', () => {
    clickButton('Accept analytics');

    const script = document.querySelector<HTMLScriptElement>('script[src*="googletagmanager.com"]');
    expect(script).not.toBeNull();
    expect(localStorage.getItem(CONSENT_KEY)).toBe('accepted');
    expect(pageViews()).toHaveLength(0);

    script?.dispatchEvent(new Event('load'));

    const views = pageViews();
    expect(views).toHaveLength(1);
    expect(views[0][2]).toMatchObject({
      page_location: 'http://localhost/test-page',
      page_title: 'Test page',
    });
    expect(String(views[0][2].page_location)).not.toContain('private');
    expect(String(views[0][2].page_referrer)).not.toContain('?');
  });

  it('stops sending SPA page views after a user revokes consent', () => {
    clickButton('Accept analytics');
    const script = document.querySelector<HTMLScriptElement>('script[src*="googletagmanager.com"]');
    script?.dispatchEvent(new Event('load'));
    const initialViews = pageViews().length;
    expect(initialViews).toBe(1);

    clickButton('Privacy choices');
    clickButton('Reject analytics');
    history.pushState({}, '', '/after-revocation?secret=not-for-analytics');
    vi.runAllTimers();

    expect(localStorage.getItem(CONSENT_KEY)).toBe('rejected');
    expect(pageViews()).toHaveLength(initialViews);
  });
});
