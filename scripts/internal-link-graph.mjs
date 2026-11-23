function readAttribute(tag, name) {
  const match = tag.match(new RegExp("\\b" + name + "\\s*=\\s*([\"\'])(.*?)\\1", "i"));
  return match?.[2] ?? null;
}

function canonicalPathFromHtml(html, origin) {
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = readAttribute(tag, 'rel');
    if (!rel?.toLowerCase().split(/\s+/).includes('canonical')) continue;

    const href = readAttribute(tag, 'href');
    if (!href) continue;

    try {
      const url = new URL(href, origin + '/');
      if (url.origin === origin) return url.pathname;
    }
    catch {
      // A malformed canonical must not prevent the rest of the audit.
    }
  }

  return null;
}

function fallbackPathFromFile(file) {
  const normalized = file.split('\\').join('/');
  if (normalized === 'index.html') return '/';
  if (normalized.endsWith('/index.html')) return '/' + normalized.slice(0, -'index.html'.length);
  if (normalized.endsWith('.html')) return '/' + normalized.slice(0, -'.html'.length) + '/';
  return null;
}

/**
 * Count real crawlable anchor links between canonical routes in the generated sitemap.
 * The course's 7–8 inbound-link target is reported as a diagnostic, not a hard ranking rule.
 * Only true zero-inbound sitemap routes fail the build as orphan pages.
 */
export function analyzeInternalLinkGraph(pages, sitemapUrls, origin) {
  const canonicalOrigin = new URL(origin).origin;
  const routePaths = new Set(
    sitemapUrls
      .map(value => {
        try {
          const url = new URL(value, canonicalOrigin + '/');
          return url.origin === canonicalOrigin ? url.pathname : null;
        }
        catch {
          return null;
        }
      })
      .filter(Boolean),
  );
  const inbound = new Map([...routePaths].map(route => [route, 0]));

  for (const page of pages) {
    const sourcePath = canonicalPathFromHtml(page.html, canonicalOrigin)
      ?? fallbackPathFromFile(page.file);
    if (!sourcePath || !routePaths.has(sourcePath)) continue;

    const sourceUrl = new URL(sourcePath, canonicalOrigin + '/');
    for (const match of page.html.matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1/gi)) {
      const raw = match[2].trim();
      if (!raw || raw.startsWith('#') || raw.startsWith('?')) continue;

      let target;
      try {
        target = new URL(raw, sourceUrl);
      }
      catch {
        continue;
      }

      if (target.origin !== canonicalOrigin || target.pathname === sourcePath) continue;
      if (!inbound.has(target.pathname)) continue;
      inbound.set(target.pathname, inbound.get(target.pathname) + 1);
    }
  }

  const counts = [...inbound.entries()]
    .map(([route, inlinks]) => ({ route, inlinks }))
    .sort((a, b) => a.inlinks - b.inlinks || a.route.localeCompare(b.route));

  return {
    counts,
    orphans: counts.filter(item => item.inlinks === 0).map(item => item.route),
    distribution: {
      zero: counts.filter(item => item.inlinks === 0).length,
      oneToTwo: counts.filter(item => item.inlinks >= 1 && item.inlinks <= 2).length,
      threeToSix: counts.filter(item => item.inlinks >= 3 && item.inlinks <= 6).length,
      sevenPlus: counts.filter(item => item.inlinks >= 7).length,
    },
    belowSeven: counts.filter(item => item.inlinks < 7),
  };
}
