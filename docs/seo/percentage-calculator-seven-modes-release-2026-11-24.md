# Percentage Calculator — seven-mode release

Date: 2026-11-24  
Repository: yqh-core/dev-tools  
PR: https://github.com/yqh-core/dev-tools/pull/110  
Merge commit: bb0e8fe2d74e0ea308415a5d5306af113f15057b

## Released scope

The existing canonical `/percentage-calculator/` page now supports seven tasks without adding duplicate SEO landing pages:

1. Find X% of Y.
2. Find what percentage one value is of another.
3. Calculate directional percentage change.
4. Apply an increase or decrease rate.
5. Reverse an increase or discount to recover the original value.
6. Compare two values with symmetric percentage difference.
7. Measure percentage-point changes separately from relative percent change.

The update also clarifies the denominator/base for each operation, adds reverse-discount and percentage-point examples, updates English and Chinese copy, and links the guide to the existing percentage-change vs percentage-point explainer.

## Verification evidence

- Exact PR head: `c24ebcd138b78ca8b56745a385c8016aef43d2cd`.
- GitHub CI: PASS — Lint, unit tests, TypeScript, production build, Chromium install and targeted Playwright E2E all passed.
- Independent Verify: PASS — example coverage, SEO crawl-gate self-test, typecheck/build, artifact validation and artifact upload passed.
- Cloudflare preview and main deployment: PASS.
- Production crawler fetch: `https://www.digdevbox.com/percentage-calculator/` returned the seven-mode English title/description, H1, content and self-canonical URL.
- The first post-deploy smoke failed only because its expected description still asserted the former “Four free calculators” copy. The two stale assertions in `.github/workflows/post-deploy-seo-smoke.yml` were updated to the exact seven-mode description. Corrected post-deploy production SEO smoke then passed on main commit `014d4ee883746e315e4d17a1fed8bdbc070ae995` (run #45285125917). A second smoke run is also in progress; it is not needed to establish the successful first rerun.

## Search measurement baseline

Latest available GSC connector snapshot for `sc-domain:digdevbox.com`, last 28 days vs previous 28 days:

- 1 click, 23 impressions, 4.35% CTR, average position 22.65.
- Previous period: 3 clicks, 371 impressions.
- US segment: 0 clicks, 18 impressions.

This release is a product/intent coverage improvement, not evidence of traffic growth. Re-measure GSC after a meaningful observation window; do not infer lift from a deployment.

## Competitor-driven next step

Tracked in issue #111: optional batch rows, formula/result copy and local calculation history. Keep the current simple single-case flow as default and retain the existing canonical tool URL. Do not expose entered values to analytics.

Regex Tester parity work is tracked separately in issue #112 (multi-case positive/negative suites and match/capture inspection).
