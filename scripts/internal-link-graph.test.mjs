import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeInternalLinkGraph } from './internal-link-graph.mjs';

const origin = 'https://www.example.com';

describe('analyzeInternalLinkGraph', () => {
  it('counts crawlable anchors from other sitemap pages, not canonical tags or self-links', () => {
    const pages = [
      {
        file: 'index.html',
        html: '<link rel="canonical" href="https://www.example.com/"><a href="/tools/">Tools</a><a href="/tools/">Tools again</a>',
      },
      {
        file: 'tools/index.html',
        html: '<link rel="canonical" href="https://www.example.com/tools/"><a href="/tools/">Self</a><a href="/about/">About</a>',
      },
      {
        file: 'about/index.html',
        html: '<link rel="canonical" href="https://www.example.com/about/"><a href="/tools/">Tools</a>',
      },
    ];
    const sitemap = [
      'https://www.example.com/',
      'https://www.example.com/tools/',
      'https://www.example.com/about/',
    ];

    const result = analyzeInternalLinkGraph(pages, sitemap, origin);
    expect(result.counts).toEqual([
      { route: '/about/', inlinks: 1 },
      { route: '/tools/', inlinks: 3 },
      { route: '/', inlinks: 0 },
    ].sort((a, b) => a.inlinks - b.inlinks || a.route.localeCompare(b.route)));
    expect(result.orphans).toEqual(['/']);
  });

  it('ignores external links, non-sitemap paths and malformed href values', () => {
    const pages = [{
      file: 'index.html',
      html: '<link rel="canonical" href="https://www.example.com/"><a href="https://external.example/page/">External</a><a href="/not-in-sitemap/">Not indexed</a><a href="http://[bad">Malformed</a>',
    }];
    const result = analyzeInternalLinkGraph(pages, ['https://www.example.com/target/'], origin);
    expect(result.counts).toEqual([{ route: '/target/', inlinks: 0 }]);
  });

  it('resolves relative anchors against the source canonical URL', () => {
    const pages = [
      { file: 'guide/index.html', html: '<link rel="canonical" href="https://www.example.com/guide/"><a href="../tools/">Tool</a>' },
    ];
    const result = analyzeInternalLinkGraph(pages, ['https://www.example.com/guide/', 'https://www.example.com/tools/'], origin);
    expect(result.counts).toEqual([
      { route: '/guide/', inlinks: 0 },
      { route: '/tools/', inlinks: 1 },
    ]);
    expect(result.orphans).toEqual(['/guide/']);
  });

  it("reports the course's 7+ diagnostic bands without enforcing them as a build failure", () => {
    const pages = [{ file: 'index.html', html: '<link rel="canonical" href="https://www.example.com/">' + Array.from({ length: 7 }, () => '<a href="/target/">Target</a>').join('') }];
    const result = analyzeInternalLinkGraph(pages, ['https://www.example.com/', 'https://www.example.com/target/'], origin);
    expect(result.distribution).toEqual({ zero: 1, oneToTwo: 0, threeToSix: 0, sevenPlus: 1 });
    expect(result.belowSeven.map(item => item.route)).toEqual(['/']);
    expect(result.orphans).toEqual(['/']);
  });
});


describe('legacy HTTP method navigation', () => {
  it('links archive navigation directly to the canonical HTTP methods section', () => {
    const archivePages = [
      readFileSync(resolve('public/legacy/index.html'), 'utf8'),
      readFileSync(resolve('public/legacy/index/index.html'), 'utf8'),
    ];
    const canonicalTarget = 'href="/http-headers/#request-methods-reference"';

    for (const html of archivePages) {
      expect(html).toContain(canonicalTarget);
      expect(html).not.toContain('href="/legacy/requestmethod/"');
    }

    const httpHeadersPage = readFileSync(resolve('src/tools/http-headers/http-headers.vue'), 'utf8');
    expect(httpHeadersPage).toContain('id="request-methods-reference"');
  });
});
