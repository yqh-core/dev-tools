import { readFileSync } from 'node:fs';
import { runInContext } from 'node:vm';
import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const CONSENT_KEY = 'digdevbox.analytics-consent.v1';
const SCRIPT = readFileSync(new URL('../public/analytics-consent.js', import.meta.url), 'utf8');

let dom: JSDOM;

function boot(path = '/test-page?private=value') {
  dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
    url: `https://www.digdevbox.com${path}`,
    runScripts: 'outside-only',
  });
  dom.window.document.title = 'Test page';
  runInContext(SCRIPT, dom.getInternalVMContext());
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
}

function clickButton(label: string) {
  const button = Array.from(dom.window.document.querySelectorAll('button')).find(
    item => item.textContent === label,
  );
  if (!button) {
    throw new Error(`Missing button: ${label}`);
  }
  button.click();
}

function calls(): unknown[][] {
  const dataLayer = (dom.window as unknown as { dataLayer?: IArguments[] }).dataLayer ?? [];
  return dataLayer.map(args => Array.from(args));
}

function pageViews() {
  return calls().filter(([kind, name]) => kind === 'event' && name === 'page_view');
}

function nextTask() {
  return new Promise<void>(resolve => dom.window.setTimeout(resolve, 0));
}

describe('shared GA4 consent gate', () => {
  beforeEach(() => {
    boot();
  });

  afterEach(() => {
    dom.window.close();
  });

  it('shows a visible fixed consent prompt before loading Google Analytics', () => {
    const prompt = dom.window.document.getElementById('digdevbox-analytics-consent');
    expect(prompt).not.toBeNull();
    expect(prompt?.style.position).toBe('fixed');
    expect(prompt?.style.bottom).toBe('16px');
    expect(dom.window.document.querySelector('script[src*="googletagmanager.com"]')).toBeNull();
    expect((dom.window as unknown as { dataLayer?: unknown }).dataLayer).toBeUndefined();
  });

  it('uses a compact mobile prompt while keeping both choices comfortably tappable', () => {
    clickButton('Accept analytics');
    Object.defineProperty(dom.window, 'matchMedia', {
      configurable: true,
      value: (query: string) => ({
        matches: query === '(max-width: 600px)',
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });

    clickButton('Privacy choices');
    const prompt = dom.window.document.getElementById('digdevbox-analytics-consent');
    expect(prompt?.style.padding).toBe('10px 12px');
    expect(prompt?.style.left).toBe('10px');
    expect(prompt?.style.right).toBe('10px');

    const choices = Array.from(prompt?.querySelectorAll('button') ?? [])
      .filter(button => button.textContent !== 'Privacy choices');
    expect(choices).toHaveLength(2);
    expect(choices.map(button => button.textContent)).toEqual(['Accept analytics', 'Reject analytics']);
    choices.forEach(button => expect(button.style.minHeight).toBe('44px'));
    expect(prompt?.textContent).toContain('Tool inputs, files and form contents are never sent.');
  });

  it('does not load GA4 or emit page views when analytics is rejected', async () => {
    clickButton('Reject analytics');

    expect(dom.window.localStorage.getItem(CONSENT_KEY)).toBe('rejected');
    expect(dom.window.document.querySelector('script[src*="googletagmanager.com"]')).toBeNull();
    expect((dom.window as unknown as { dataLayer?: unknown }).dataLayer).toBeUndefined();

    dom.window.history.pushState({}, '', '/another-page?secret=should-not-be-sent');
    await nextTask();

    expect(dom.window.document.querySelector('script[src*="googletagmanager.com"]')).toBeNull();
    expect((dom.window as unknown as { dataLayer?: unknown }).dataLayer).toBeUndefined();
  });

  it('loads GA4 only after acceptance and sends a path-only page view', () => {
    clickButton('Accept analytics');

    const script = dom.window.document.querySelector<HTMLScriptElement>('script[src*="googletagmanager.com"]');
    expect(script).not.toBeNull();
    expect(dom.window.localStorage.getItem(CONSENT_KEY)).toBe('accepted');
    expect(pageViews()).toHaveLength(0);

    script?.dispatchEvent(new dom.window.Event('load'));

    const views = pageViews();
    expect(views).toHaveLength(1);
    expect(views[0][2]).toMatchObject({
      page_location: `${dom.window.location.origin}/test-page`,
      page_title: 'Test page',
    });
    expect(String((views[0][2] as { page_location: string }).page_location)).not.toContain('private');
    expect(String((views[0][2] as { page_referrer: string }).page_referrer)).not.toContain('?');
  });

  it('stops sending SPA page views after a user revokes consent', async () => {
    clickButton('Accept analytics');
    const script = dom.window.document.querySelector<HTMLScriptElement>('script[src*="googletagmanager.com"]');
    script?.dispatchEvent(new dom.window.Event('load'));
    const initialViews = pageViews().length;
    expect(initialViews).toBe(1);

    clickButton('Privacy choices');
    clickButton('Reject analytics');
    dom.window.history.pushState({}, '', '/after-revocation?secret=not-for-analytics');
    await nextTask();

    expect(dom.window.localStorage.getItem(CONSENT_KEY)).toBe('rejected');
    expect(pageViews()).toHaveLength(initialViews);
  });
});
