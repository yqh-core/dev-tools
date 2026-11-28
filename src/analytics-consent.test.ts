import { readFileSync } from 'node:fs';
import { runInContext } from 'node:vm';
import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const CONSENT_KEY = 'digdevbox.analytics-consent.v1';
const SCRIPT = readFileSync(new URL('../public/analytics-consent.js', import.meta.url), 'utf8');
const DEFAULT_MARKUP = `
  <div class="tool-layout">
    <div class="tool-header"><h1>Sample tool</h1></div>
    <div class="tool-content"><label for="sample">Input</label><input id="sample"></div>
  </div>
  <footer><button type="button" data-privacy-settings aria-haspopup="dialog">Privacy settings</button></footer>
`;

let dom: JSDOM;

function boot(path = '/test-page?private=value', lang = 'en', markup = DEFAULT_MARKUP) {
  dom = new JSDOM(`<!doctype html><html lang="${lang}"><head></head><body>${markup}</body></html>`, {
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
  if (!button) throw new Error(`Missing button: ${label}`);
  button.click();
  return button;
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

  it('keeps first-use consent in normal flow before the tool workspace', () => {
    const prompt = dom.window.document.getElementById('digdevbox-analytics-consent');
    const content = dom.window.document.querySelector('.tool-content');
    expect(prompt).not.toBeNull();
    expect(prompt?.dataset.placement).toBe('tool-inline');
    expect(prompt?.nextElementSibling).toBe(content);
    expect(prompt?.style.position).not.toBe('fixed');
    expect(dom.window.document.querySelector('script[src*="googletagmanager.com"]')).toBeNull();
    expect((dom.window as unknown as { dataLayer?: unknown }).dataLayer).toBeUndefined();

    const message = prompt?.textContent ?? '';
    expect(message).toContain('Optional analytics records page views only—not tool inputs, files or form values.');
    expect(message).toContain('Some tools send requests to DigDevBox Relay or external services when used;');
    expect(message).not.toContain('Tool inputs, files and form contents are never sent.');
    const choices = Array.from(prompt?.querySelectorAll('button') ?? []);
    expect(choices.map(button => button.textContent)).toEqual(['Accept analytics', 'Reject analytics']);
    choices.forEach(button => expect(button.className).toContain('dd-consent__button'));
  });

  it('places homepage consent immediately after the hero instead of over content', () => {
    const markup = `
      <header class="home-hero"><h1>Developer tools</h1></header>
      <main><section id="featured">Featured tasks</section></main>
      <footer><button data-privacy-settings>Privacy settings</button></footer>
    `;
    dom.window.close();
    boot('/', 'en', markup);

    const hero = dom.window.document.querySelector('.home-hero');
    const prompt = dom.window.document.getElementById('digdevbox-analytics-consent');
    expect(prompt?.dataset.placement).toBe('home-inline');
    expect(prompt?.previousElementSibling).toBe(hero);
    expect(prompt?.style.position).not.toBe('fixed');
  });

  it('localizes consent and settings for Chinese pages', () => {
    dom.window.close();
    boot('/percentage-calculator', 'zh-CN');
    const prompt = dom.window.document.getElementById('digdevbox-analytics-consent');
    expect(prompt?.getAttribute('aria-label')).toBe('分析与隐私选项');
    expect(prompt?.textContent).toContain('可选分析服务仅记录页面访问');
    expect(prompt?.textContent).toContain('DigDevBox Relay 或外部服务');
    expect(Array.from(prompt?.querySelectorAll('button') ?? []).map(button => button.textContent))
      .toEqual(['接受分析', '拒绝分析']);

    const trigger = dom.window.document.querySelector<HTMLButtonElement>('[data-privacy-settings]');
    trigger?.click();
    const dialog = dom.window.document.getElementById('digdevbox-privacy-settings');
    expect(dialog?.getAttribute('aria-labelledby')).toBe('digdevbox-privacy-settings-title');
    expect(dialog?.textContent).toContain('隐私设置');
    expect(dialog?.textContent).toContain('当前尚未作出选择。');
  });

  it('offers a persistent footer settings entry and an accessible Escape close path', () => {
    const trigger = dom.window.document.querySelector<HTMLButtonElement>('[data-privacy-settings]');
    expect(trigger).not.toBeNull();
    trigger?.focus();
    trigger?.click();

    const dialog = dom.window.document.getElementById('digdevbox-privacy-settings');
    expect(dialog).not.toBeNull();
    expect(dialog?.hasAttribute('open')).toBe(true);
    expect(dialog?.getAttribute('aria-describedby')).toBe('digdevbox-privacy-settings-description');
    expect(dom.window.document.querySelector('[data-settings-choice="accept"]')?.textContent).toBe('Accept analytics');
    expect(dom.window.document.querySelector('[data-settings-choice="reject"]')?.textContent).toBe('Reject analytics');
    expect(dom.window.document.querySelector('[data-settings-close]')?.textContent).toBe('Close');

    dialog?.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(dialog?.hasAttribute('open')).toBe(false);
    expect(dom.window.document.activeElement).toBe(trigger);
  });

  it('does not load GA4 or emit page views when analytics is rejected', async () => {
    clickButton('Reject analytics');

    expect(dom.window.localStorage.getItem(CONSENT_KEY)).toBe('rejected');
    expect(dom.window.document.getElementById('digdevbox-analytics-consent')).toBeNull();
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
    const defaults = calls().find(([kind, command]) => kind === 'consent' && command === 'default');
    expect(defaults?.[2]).toMatchObject({ analytics_storage: 'denied', ad_storage: 'denied' });
  });

  it('shows the saved decision when preferences are reopened', () => {
    clickButton('Reject analytics');
    const trigger = dom.window.document.querySelector<HTMLButtonElement>('[data-privacy-settings]');
    trigger?.click();
    const dialog = dom.window.document.getElementById('digdevbox-privacy-settings');
    expect(dialog?.textContent).toContain('Current choice: optional analytics is disabled.');
  });

  it('stops sending SPA page views and clears GA cookies after consent is revoked', async () => {
    clickButton('Accept analytics');
    const script = dom.window.document.querySelector<HTMLScriptElement>('script[src*="googletagmanager.com"]');
    script?.dispatchEvent(new dom.window.Event('load'));
    const initialViews = pageViews().length;
    expect(initialViews).toBe(1);

    dom.window.document.cookie = '_ga=GA1.2.123.456; path=/; Secure';
    const trigger = dom.window.document.querySelector<HTMLButtonElement>('[data-privacy-settings]');
    trigger?.click();
    const dialog = dom.window.document.getElementById('digdevbox-privacy-settings');
    dialog?.querySelector<HTMLButtonElement>('[data-settings-choice="reject"]')?.click();
    dom.window.history.pushState({}, '', '/after-revocation?secret=not-for-analytics');
    await nextTask();

    expect(dom.window.localStorage.getItem(CONSENT_KEY)).toBe('rejected');
    expect(dom.window.document.cookie).not.toContain('_ga=');
    expect(pageViews()).toHaveLength(initialViews);
    expect(calls().filter(([kind, command, details]) =>
      kind === 'consent' && command === 'update' && (details as { analytics_storage?: string })?.analytics_storage === 'denied',
    ).length).toBeGreaterThan(0);
  });
});
