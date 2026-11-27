# API Studio Product Site

This directory is the independent product-site build entry for API Studio. The source and shared request engine remain in this repository so the transitional DigDevBox route and the independent build do not fork request or security logic.

## Routes

- / — public product homepage, indexable.
- /app/ — the real API Studio workspace, noindex.
- /docs/ — guide index and task-specific guides.

## Build and verify

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm run build:api-studio
pnpm run test:e2e:api-studio
```

The build writes only to dist-api-studio/. It does not replace or write DigDevBox Main's normal dist/ output. The API Studio product build disables the parent site's PWA manifest/service worker identity, but it reuses the existing API Studio page, stores, theme tokens, and first-party /api/apiproxy Pages Function.

## Independent Cloudflare Pages project

After a separate product brand and registrable domain have been selected:
1. Create a second Pages project connected to this repository, with repository root as the project root.
2. Set the build command to pnpm run build:api-studio.
3. Set the output directory to dist-api-studio.
4. Keep the existing functions/ directory available to the build so /api/apiproxy and its shared SSRF checks are deployed with the product.
5. Set API_STUDIO_SITE_URL to the approved HTTPS origin for the production build. The SEO post-build step then emits route-specific canonical URLs, og:url, a sitemap.xml containing public routes only, and a robots.txt Sitemap directive. /app/ remains noindex and excluded from the sitemap.
6. Keep the parent DigDevBox Pages project, its root homepage and /api-studio/ transition route unchanged until the separate product has been accepted and a deliberate migration/cutover is scheduled.

Do not set API_STUDIO_SITE_URL to a temporary Preview URL or guessed domain. With the variable absent, the build intentionally omits canonical URLs and sitemap.xml instead of publishing false canonical signals. The public pages still receive route-specific titles, descriptions, OpenGraph/Twitter tags and JSON-LD.

## Data and trust boundaries

Collections and environment values remain in origin-scoped browser storage. API requests pass through the existing first-party relay. Secret masking is not encryption at rest. See /docs/privacy/ for user-facing explanations.

The working product name is API Studio. Final brand and primary domain remain pending owner selection; the product folder and build target do not authorize DNS or production-domain changes.
