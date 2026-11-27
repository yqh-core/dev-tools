# API Studio Product Site

This directory is the independent product-site build entry for API Studio. The source and shared request engine remain in this repository so the transitional DigDevBox route and the independent build do not fork request or security logic.

## Routes

- / — public product homepage, indexable on the approved product origin.
- /app/ — the real API Studio workspace, noindex.
- /docs/ — guide index and task-specific guides.

## Build and verify

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm run build:api-studio
pnpm run test:e2e:api-studio
```

The dedicated build writes only to dist-api-studio/. It does not replace or write DigDevBox Main's normal dist/ output. The API Studio product build disables the parent site's PWA manifest/service-worker identity, but reuses the existing API Studio page, stores, theme tokens and first-party /api/apiproxy Pages Function.

## Cloudflare branch Preview

The Git-connected Cloudflare project uses the regular `pnpm run build` command. On the exact branch `feat/api-studio-independent-site-20261127` only, Cloudflare's documented `CF_PAGES=1` and `CF_PAGES_BRANCH` environment variables route that command to the API Studio product build and write its static output to the existing Preview output directory `dist/`. This allows the existing Pages Preview to render the actual independent product output and reuse the first-party Pages Functions for manual smoke testing.

All routes on this branch Preview are forced to `noindex,nofollow`; robots.txt disallows the whole Preview; no production canonical URLs or sitemap are emitted. When the branch is merged, `CF_PAGES_BRANCH=main` selects the original DigDevBox Main build, so the Main production output stays unchanged.

This branch Preview is a rendered product preview only. It does not create the final separate Pages project, choose the registrable domain or change production DNS.

## Independent Cloudflare Pages project

After a separate product brand and registrable domain have been selected:
1. Create a second Pages project connected to this repository, with repository root as the project root.
2. Set the build command to `pnpm run build:api-studio`.
3. Set the output directory to `dist-api-studio`.
4. Keep the existing `functions/` directory available so `/api/apiproxy` and its shared SSRF checks deploy with the product.
5. Set `API_STUDIO_SITE_URL` to the approved HTTPS origin for production. The SEO post-build step then emits route-specific canonical URLs, og:url, a sitemap containing public routes only and a robots.txt Sitemap directive. /app/ remains noindex and is excluded from the sitemap.
6. Keep the parent DigDevBox Pages project, its root homepage and /api-studio/ transition route unchanged until the independent product has been accepted and a deliberate migration/cutover is scheduled.

Do not set `API_STUDIO_SITE_URL` to a temporary Preview URL or guessed domain. With the variable absent, the build intentionally omits canonical URLs and sitemap.xml instead of publishing false canonical signals. Public pages still receive route-specific titles, descriptions, OpenGraph/Twitter tags and JSON-LD.

## Data and trust boundaries

Collections and environment values remain in origin-scoped browser storage. API requests pass through the existing first-party relay. Secret masking is not encryption at rest. See /docs/privacy/ for user-facing explanations.

The working product name is API Studio. Final brand and primary domain remain pending owner selection; the product folder and build target do not authorize DNS or production-domain changes.
