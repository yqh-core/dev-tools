/* DigDevBox shared GA4 consent gate.
 * Loads GA4 only after explicit analytics opt-in. Sends page views only;
 * never reads form values, tool inputs, file names, query strings, or DOM text.
 * Consent is scoped to this site origin. Rejecting analytics prevents GA requests.
 */
(function () {
  'use strict';
  var MEASUREMENT_ID = 'G-HWETLYBV6T';
  var CONSENT_KEY = 'digdevbox.analytics-consent.v1';
  var loaded = false;
  var lastPage = '';

  function readConsent() {
    try { return localStorage.getItem(CONSENT_KEY); } catch (_) { return null; }
  }
  function pagePath() { return location.origin + location.pathname; }
  function isNoindexPage() {
    var meta = document.querySelector('meta[name="robots"]');
    return !!meta && /\bnoindex\b/i.test(meta.getAttribute('content') || '');
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
    if (value === 'accepted') loadAnalytics();
    else {
      if (window.gtag) window.gtag('consent', 'update', { analytics_storage: 'denied' });
      clearAnalyticsCookies();
    }
    render();
  }
  function render() {
    var old = document.getElementById('digdevbox-analytics-consent');
    if (old) old.remove();
    var current = readConsent();
    var root = document.createElement('section');
    root.id = 'digdevbox-analytics-consent';
    root.setAttribute('aria-label', 'Analytics privacy choices');
    if (current === 'accepted' || current === 'rejected') {
      var manage = document.createElement('button');
      manage.type = 'button';
      manage.textContent = 'Privacy choices';
      manage.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:2147482999;border:1px solid #4b7773;border-radius:999px;padding:8px 12px;background:#102a2a;color:#fff;font:12px system-ui,sans-serif;cursor:pointer';
      manage.addEventListener('click', function () { renderPrompt(root, true); });
      root.appendChild(manage);
      document.body.appendChild(root);
      return;
    }
    renderPrompt(root, false);
  }
  function renderPrompt(existing, forceOverlay) {
    var root = existing || document.getElementById('digdevbox-analytics-consent');
    if (!root) {
      root = document.createElement('section');
      root.id = 'digdevbox-analytics-consent';
      root.setAttribute('aria-label', 'Analytics privacy choices');
    }
    var compact = !!(window.matchMedia && window.matchMedia('(max-width: 600px)').matches);
    var homeHero = forceOverlay ? null : document.querySelector('.home-hero');
    var inlineHome = !!homeHero;
    root.dataset.placement = inlineHome ? 'home-inline' : 'fixed-overlay';
    root.style.cssText = inlineHome
      ? 'position:relative;z-index:1;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 16px;width:100%;max-width:720px;margin:16px auto 28px;padding:12px 16px;box-sizing:border-box;background:#102a2a;color:#fff;border:1px solid #4b7773;border-radius:12px;box-shadow:none;font:13px/1.45 system-ui,sans-serif'
      : compact
        ? 'position:fixed;z-index:2147483000;left:10px;right:10px;bottom:10px;max-width:720px;margin:0 auto;padding:10px 12px;box-sizing:border-box;background:#102a2a;color:#fff;border:1px solid #4b7773;border-radius:10px;box-shadow:0 8px 28px #0004;font:12px/1.35 system-ui,sans-serif'
        : 'position:fixed;z-index:2147483000;left:16px;right:16px;bottom:16px;max-width:720px;margin:0 auto;padding:16px 18px;box-sizing:border-box;background:#102a2a;color:#fff;border:1px solid #4b7773;border-radius:12px;box-shadow:0 8px 32px #0004;font:14px/1.5 system-ui,sans-serif';
    if (inlineHome && homeHero) {
      homeHero.insertAdjacentElement('afterend', root);
    } else if (!root.isConnected || root.parentElement !== document.body) {
      document.body.appendChild(root);
    }
    root.replaceChildren();
    var message = document.createElement('p');
    message.textContent = 'Optional analytics measures visits and page usage. Tool inputs, files and form contents are never sent. You can reject and keep using the site.';
    message.style.cssText = inlineHome
      ? (compact ? 'flex:1 1 100%;max-width:none;margin:0' : 'flex:1 1 280px;max-width:72ch;margin:0')
      : (compact ? 'margin:0 0 8px' : 'margin:0 0 12px');
    var actions = document.createElement('div');
    actions.style.cssText = inlineHome
      ? (compact ? 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));width:100%;gap:8px' : 'display:flex;flex:0 0 auto;align-items:center;gap:8px;flex-wrap:wrap')
      : 'display:flex;gap:8px;flex-wrap:wrap';
    [['Accept analytics','accepted'],['Reject analytics','rejected']].forEach(function (item) {
      var button = document.createElement('button');
      button.type = 'button';
      button.textContent = item[0];
      button.style.cssText = inlineHome
        ? 'min-height:44px;border:1px solid #9bc5bf;border-radius:7px;padding:8px 12px;background:transparent;color:#fff;font:600 12px/1.3 system-ui,sans-serif;cursor:pointer'
        : (compact ? 'min-height:44px;border:1px solid #9bc5bf;border-radius:7px;padding:6px 10px;background:transparent;color:#fff;font:12px/1.3 system-ui,sans-serif;cursor:pointer' : 'min-height:44px;border:1px solid #9bc5bf;border-radius:7px;padding:8px 12px;background:transparent;color:#fff;font:inherit;cursor:pointer');
      button.addEventListener('click', function () { saveConsent(item[1]); });
      actions.appendChild(button);
    });
    root.appendChild(message);
    root.appendChild(actions);
  }
  function observeHomePlacement() {
    if (typeof MutationObserver === 'undefined' || !document.body) return;
    var observer = new MutationObserver(function () {
      var current = readConsent();
      if (current === 'accepted' || current === 'rejected') return;
      var root = document.getElementById('digdevbox-analytics-consent');
      if (!root) return;
      var homeHero = document.querySelector('.home-hero');
      if (homeHero) {
        if (root.dataset.placement !== 'home-inline' || root.previousElementSibling !== homeHero) {
          renderPrompt(root, false);
        }
        return;
      }
      if (root.dataset.placement !== 'fixed-overlay' || root.parentElement !== document.body) {
        renderPrompt(root, false);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  function trackRoute() { window.setTimeout(function () { pageView(); render(); }, 0); }
  ['pushState', 'replaceState'].forEach(function (method) {
    var original = history[method];
    history[method] = function () { var result = original.apply(this, arguments); trackRoute(); return result; };
  });
  window.addEventListener('popstate', trackRoute);
  window.addEventListener('hashchange', trackRoute);
  function init() {
    if (readConsent() === 'accepted') loadAnalytics();
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
  if (document.body) observeHomePlacement();
  else document.addEventListener('DOMContentLoaded', observeHomePlacement, { once: true });
})();
