/* DigDevBox Main-only GA4 consent gate.
 * Loads GA4 only after explicit analytics opt-in. Sends page views only;
 * never reads form values, tool inputs, file names, query strings, or DOM text.
 * Consent is scoped to this site origin. Rejecting analytics prevents GA requests.
 */
(function () {
  'use strict';
  var MEASUREMENT_ID = 'G-HWETLYBV6T';
  var CONSENT_KEY = 'digdevbox.analytics-consent.v1';
  var PROMPT_ID = 'digdevbox-analytics-consent';
  var DIALOG_ID = 'digdevbox-privacy-settings';
  var loaded = false;
  var lastPage = '';
  var settingsTrigger = null;

  function copyForLanguage() {
    var isChinese = /^zh(?:[-_]|$)/i.test(document.documentElement.lang || '');
    return isChinese
      ? {
          ariaLabel: '分析与隐私选项',
          title: '隐私与分析选择',
          message: '可选分析服务仅记录页面访问，不读取工具输入、文件内容或表单值。使用部分工具时仍会向 DigDevBox Relay 或外部服务发送请求，详见工具隐私说明。拒绝分析不影响使用。',
          accept: '接受分析',
          reject: '拒绝分析',
          settingsTitle: '隐私设置',
          settingsMessage: '你可以随时更改分析选择。分析服务仅记录页面访问；不会读取工具输入、文件内容或表单值。部分工具在运行时仍可能向 DigDevBox Relay 或外部服务发送请求。',
          accepted: '当前选择：已允许可选分析。',
          rejected: '当前选择：已拒绝可选分析。',
          unset: '当前尚未作出选择。',
          close: '关闭'
        }
      : {
          ariaLabel: 'Analytics privacy choices',
          title: 'Your privacy choices',
          message: "Optional analytics records page views only—not tool inputs, files or form values. Some tools send requests to DigDevBox Relay or external services when used; see each tool's privacy note. Rejecting analytics does not affect site use.",
          accept: 'Accept analytics',
          reject: 'Reject analytics',
          settingsTitle: 'Privacy settings',
          settingsMessage: 'You can change your analytics choice at any time. Analytics records page views only; it does not read tool inputs, files or form values. Some tools may still send requests to DigDevBox Relay or external services while running.',
          accepted: 'Current choice: optional analytics is enabled.',
          rejected: 'Current choice: optional analytics is disabled.',
          unset: 'No choice has been saved yet.',
          close: 'Close'
        };
  }

  function readConsent() {
    try { return localStorage.getItem(CONSENT_KEY); } catch (_) { return null; }
  }

  function pagePath() { return location.origin + location.pathname; }

  function isNoindexPage() {
    var meta = document.querySelector('meta[name="robots"]');
    return !!meta && /\\bnoindex\\b/i.test(meta.getAttribute('content') || '');
  }

  function pageView() {
    if (!loaded || !window.gtag || readConsent() !== 'accepted' || isNoindexPage()) return;
    var path = pagePath();
    if (path === lastPage) return;
    lastPage = path;
    window.gtag('event', 'page_view', {
      page_location: path,
      page_title: document.title,
      page_referrer: document.referrer ? (new URL(document.referrer)).origin : ''
    });
  }

  function clearAnalyticsCookies() {
    document.cookie.split(';').forEach(function (part) {
      var name = part.split('=')[0].trim();
      if (!/^_ga(?:_|$)/.test(name)) return;
      document.cookie = name + '=; Max-Age=0; path=/; SameSite=Lax; Secure';
      var labels = location.hostname.split('.');
      if (labels.length > 2) {
        document.cookie = name + '=; Max-Age=0; path=/; domain=.' + labels.slice(-2).join('.') + '; SameSite=Lax; Secure';
      }
    });
  }

  function loadAnalytics() {
    if (loaded) {
      if (window.gtag) {
        window.gtag('consent', 'update', { analytics_storage: 'granted' });
        pageView();
      }
      return;
    }
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', {
      analytics_storage: 'denied', ad_storage: 'denied',
      ad_user_data: 'denied', ad_personalization: 'denied',
      functionality_storage: 'granted', security_storage: 'granted'
    });
    window.gtag('consent', 'update', { analytics_storage: 'granted' });
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + MEASUREMENT_ID;
    script.onload = function () {
      window.gtag('js', new Date());
      window.gtag('config', MEASUREMENT_ID, {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        linker: { domains: ['digdevbox.com'] }
      });
      pageView();
    };
    document.head.appendChild(script);
  }

  function saveConsent(value) {
    try { localStorage.setItem(CONSENT_KEY, value); } catch (_) {}
    if (value === 'accepted') {
      loadAnalytics();
    }
    else {
      if (window.gtag) window.gtag('consent', 'update', { analytics_storage: 'denied' });
      clearAnalyticsCookies();
    }
    var prompt = document.getElementById(PROMPT_ID);
    if (prompt) prompt.remove();
    updateSettingsStatus();
  }

  function addButton(parent, label, className, onClick) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.addEventListener('click', onClick);
    parent.appendChild(button);
    return button;
  }

  function getPlacement() {
    var toolContent = document.querySelector('.tool-content');
    if (toolContent && toolContent.parentElement) return { kind: 'tool', target: toolContent };
    var homeHero = document.querySelector('.home-hero');
    if (homeHero && homeHero.parentElement) return { kind: 'home', target: homeHero };
    var main = document.querySelector('main, [role="main"]');
    if (main) return { kind: 'main', target: main };
    return { kind: 'body', target: document.body };
  }

  function placePrompt(root, placement) {
    if (!root || !placement.target) return;
    if (placement.kind === 'tool') {
      if (root.parentElement !== placement.target.parentElement || root.nextElementSibling !== placement.target) {
        placement.target.parentElement.insertBefore(root, placement.target);
      }
      root.dataset.placement = 'tool-inline';
      return;
    }
    if (placement.kind === 'home') {
      if (root.parentElement !== placement.target.parentElement || root.previousElementSibling !== placement.target) {
        placement.target.insertAdjacentElement('afterend', root);
      }
      root.dataset.placement = 'home-inline';
      return;
    }
    if (placement.kind === 'main') {
      if (root.parentElement !== placement.target || root !== placement.target.firstElementChild) {
        placement.target.insertBefore(root, placement.target.firstChild);
      }
      root.dataset.placement = 'main-inline';
      return;
    }
    if (root.parentElement !== document.body || root !== document.body.firstElementChild) {
      document.body.insertBefore(root, document.body.firstChild);
    }
    root.dataset.placement = 'body-inline';
  }

  function renderPrompt() {
    var root = document.getElementById(PROMPT_ID);
    if (!root) {
      root = document.createElement('section');
      root.id = PROMPT_ID;
      root.className = 'dd-consent';
      root.setAttribute('role', 'region');
    }
    var copy = copyForLanguage();
    root.setAttribute('aria-label', copy.ariaLabel);
    root.replaceChildren();

    var heading = document.createElement('h2');
    heading.className = 'dd-consent__title';
    heading.textContent = copy.title;
    var message = document.createElement('p');
    message.className = 'dd-consent__message';
    message.textContent = copy.message;
    var actions = document.createElement('div');
    actions.className = 'dd-consent__actions';
    addButton(actions, copy.accept, 'dd-consent__button dd-consent__button--accept', function () {
      saveConsent('accepted');
    });
    addButton(actions, copy.reject, 'dd-consent__button dd-consent__button--reject', function () {
      saveConsent('rejected');
    });
    root.appendChild(heading);
    root.appendChild(message);
    root.appendChild(actions);
    placePrompt(root, getPlacement());
  }

  function ensureDialog() {
    var dialog = document.getElementById(DIALOG_ID);
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = DIALOG_ID;
    dialog.className = 'dd-consent-dialog';
    dialog.setAttribute('aria-labelledby', 'digdevbox-privacy-settings-title');
    dialog.setAttribute('aria-describedby', 'digdevbox-privacy-settings-description');

    var panel = document.createElement('div');
    panel.className = 'dd-consent-dialog__panel';
    var heading = document.createElement('h2');
    heading.id = 'digdevbox-privacy-settings-title';
    heading.className = 'dd-consent-dialog__title';
    var description = document.createElement('p');
    description.id = 'digdevbox-privacy-settings-description';
    description.className = 'dd-consent-dialog__message';
    var status = document.createElement('p');
    status.id = 'digdevbox-privacy-settings-status';
    status.className = 'dd-consent-dialog__status';
    var actions = document.createElement('div');
    actions.className = 'dd-consent-dialog__actions';

    var accept = addButton(actions, '', 'dd-consent__button dd-consent__button--accept', function () {
      saveConsent('accepted');
      closeDialog(dialog);
    });
    accept.setAttribute('data-settings-choice', 'accept');
    var reject = addButton(actions, '', 'dd-consent__button dd-consent__button--reject', function () {
      saveConsent('rejected');
      closeDialog(dialog);
    });
    reject.setAttribute('data-settings-choice', 'reject');
    var close = addButton(actions, '', 'dd-consent-dialog__close', function () {
      closeDialog(dialog);
    });
    close.setAttribute('data-settings-close', 'true');

    panel.appendChild(heading);
    panel.appendChild(description);
    panel.appendChild(status);
    panel.appendChild(actions);
    dialog.appendChild(panel);
    dialog.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeDialog(dialog);
    });
    document.body.appendChild(dialog);
    return dialog;
  }

  function updateSettingsStatus() {
    var dialog = document.getElementById(DIALOG_ID);
    if (!dialog) return;
    var copy = copyForLanguage();
    var state = readConsent();
    var title = dialog.querySelector('#digdevbox-privacy-settings-title');
    var description = dialog.querySelector('#digdevbox-privacy-settings-description');
    var status = dialog.querySelector('#digdevbox-privacy-settings-status');
    var accept = dialog.querySelector('[data-settings-choice="accept"]');
    var reject = dialog.querySelector('[data-settings-choice="reject"]');
    var close = dialog.querySelector('[data-settings-close]');
    if (title) title.textContent = copy.settingsTitle;
    if (description) description.textContent = copy.settingsMessage;
    if (status) status.textContent = state === 'accepted' ? copy.accepted : state === 'rejected' ? copy.rejected : copy.unset;
    if (accept) accept.textContent = copy.accept;
    if (reject) reject.textContent = copy.reject;
    if (close) close.textContent = copy.close;
  }

  function closeDialog(dialog) {
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
    if (settingsTrigger && settingsTrigger.isConnected && typeof settingsTrigger.focus === 'function') {
      settingsTrigger.focus();
    }
  }

  function openSettings(trigger) {
    settingsTrigger = trigger || document.activeElement;
    var dialog = ensureDialog();
    updateSettingsStatus();
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    }
    else {
      dialog.setAttribute('open', '');
      dialog.setAttribute('aria-modal', 'true');
    }
    var close = dialog.querySelector('[data-settings-close]');
    if (close && typeof close.focus === 'function') close.focus();
  }

  document.addEventListener('click', function (event) {
    var target = event.target && event.target.closest ? event.target.closest('[data-privacy-settings]') : null;
    if (!target) return;
    event.preventDefault();
    openSettings(target);
  });

  function ensurePromptPlacement() {
    var current = readConsent();
    var root = document.getElementById(PROMPT_ID);
    if (current === 'accepted' || current === 'rejected') {
      if (root) root.remove();
      return;
    }
    var placement = getPlacement();
    if (!root) {
      renderPrompt();
      return;
    }
    placePrompt(root, placement);
  }

  function observePlacement() {
    if (typeof window.MutationObserver === 'undefined' || !document.body) return;
    var activeWindow = window;
    var activeDocument = document;
    var observer = new activeWindow.MutationObserver(function () {
      if (!activeDocument.defaultView
        || typeof document === 'undefined'
        || document !== activeDocument
        || typeof window === 'undefined'
        || window !== activeWindow) {
        observer.disconnect();
        return;
      }
      ensurePromptPlacement();
    });
    observer.observe(activeDocument.body, { childList: true, subtree: true });
  }

  function trackRoute() {
    window.setTimeout(function () {
      pageView();
      ensurePromptPlacement();
    }, 0);
  }

  ['pushState', 'replaceState'].forEach(function (method) {
    var original = history[method];
    history[method] = function () {
      var result = original.apply(this, arguments);
      trackRoute();
      return result;
    };
  });
  window.addEventListener('popstate', trackRoute);
  window.addEventListener('hashchange', trackRoute);

  function init() {
    if (readConsent() === 'accepted') loadAnalytics();
    ensurePromptPlacement();
    observePlacement();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  }
  else {
    init();
  }
})();
