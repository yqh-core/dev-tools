# DigDevBox Main Site — Developer handoff

**Site:** https://digdevbox.com  
**Repository:** https://github.com/yqh-core/dev-tools  
**Portfolio role:** Tier A — second growth entry alongside DigImg.

**API Studio product direction (owner-confirmed 2026-11-27):** API Studio is the tenth independent product line in addition to the original nine-site portfolio. It must gain a distinct final brand and its own separate registrable primary domain, dedicated product homepage, /app/ workspace, docs/tutorials and release/growth path. “by DigDevBox” may be used as parent endorsement. Earlier DigDevBox-subdomain proposals are superseded. This does not require an immediate repository split: reuse yqh-core/dev-tools initially. No final name/domain or production host has been selected. See [Issue #212](https://github.com/yqh-core/dev-tools/issues/212), [Issue #213](https://github.com/yqh-core/dev-tools/issues/213), [Issue #214](https://github.com/yqh-core/dev-tools/issues/214), and the [independent product plan](https://github.com/yqh-core/digdevbox-design-system/blob/main/strategy/API_STUDIO_INDEPENDENT_PRODUCT_PLAN_2026-11-27.md). See [Issue #212](https://github.com/yqh-core/dev-tools/issues/212), [Issue #213 — complete the workspace workflow](https://github.com/yqh-core/dev-tools/issues/213), [Issue #214 — dedicated Pages build target and homepage](https://github.com/yqh-core/dev-tools/issues/214), and the [independent product plan](https://github.com/yqh-core/digdevbox-design-system/blob/main/strategy/API_STUDIO_INDEPENDENT_PRODUCT_PLAN_2026-11-27.md).

## Product and architecture

The main site is a Vue/Vite developer-tools directory with task-oriented discovery, categories, tool detail routes and supporting content. The repository README is the product inventory and generated tool-list source. Most utilities process data locally in the browser; a limited number make network requests through first-party or upstream services. Never describe the entire site as local-only.

API Studio's current implementation lives in this repository at /api-studio/ and uses shared application modules. Its established scope includes collections, environments, request/response editing, Postman v2.1 import/export, scripts/tests and collection runner. The product is planned to move to its own independent registrable primary domain with a dedicated landing page and /app/ workspace while reusing this repository initially; do not treat that future host as already deployed.

Current implementation details:
- Workspace source: src/pages/ApiStudio.page.vue.
- Collection tree is stored under the origin-scoped localStorage key api-studio:tree.
- The environment selector reuses the API Debugger store key api-debugger:env.
- Outbound requests use the first-party Pages Function /api/apiproxy and shared target validation in functions/api/_ssrf.js. Do not claim the request path is entirely local.
- The independent registrable domain creates a new browser Origin. Existing local storage will not be readable there. Implement a user-controlled backup/restore and migration path before any forced host transition; never silently move secrets to a remote service.
- Preserve /api-studio/ on www.digdevbox.com until the new host, migration and rollback are fully verified.
- The final independent brand and separate registrable primary domain remain subject to naming/domain/trademark-conflict screening and explicit owner selection; no DNS or custom-domain configuration has been performed. The deployment recommendation is a second Cloudflare Pages project connected to this same repository, with a dedicated API Studio build command/output and its own independent primary domain. Earlier DigDevBox-subdomain candidates are superseded. The existing main Pages project must retain its own root homepage and SEO behavior. See the API Studio independent product plan.
- Do not add fabricated adoption or usage counters to the product landing page. Clearly label demo fixtures and only publish reproducible real metrics.

## API Studio delivery status — 2026-11-27

- The existing `/api-studio/` workspace remains the transitional implementation/discovery route in DigDevBox Main. The long-term target is the tenth independent product with its own brand and separate primary domain; the shared repository is an interim engineering choice, not a product-boundary decision.
- [PR #215](https://github.com/yqh-core/dev-tools/pull/215) merged as `455fa052`; exact CI/E2E (132 assertions), Verify/Build and Pages Preview passed.
- [PR #216](https://github.com/yqh-core/dev-tools/pull/216) merged as `e09522ae`; exact full CI/E2E, Verify/Build and Preview https://18c81e16.coderkit.pages.dev/ passed. Adds structured request assertions and per-rule PASS/FAIL.
- [PR #217](https://github.com/yqh-core/dev-tools/pull/217) merged as `d41c874722a875efe02e38f16bdad271c001dffe`; exact CI/E2E, Verify/Build and Preview https://e7eb264f.coderkit.pages.dev/ passed. It adds a Studio-native Environment / Collection / Global variable manager, environment CRUD, variable CRUD, secret masking/reveal, secret-safe export and clear localStorage/shared-relay disclosure.
- [PR #218](https://github.com/yqh-core/dev-tools/pull/218) merged as `3804421137f24efe21a41c48c64979e1cd8c1c94` from exact HEAD `02cd77b6d6076509344c07e80afa973d0a6eabbd`. Exact-head CI #45913352898, Verify/Build #45913352875 and Cloudflare Preview #140226641947 all succeeded. The 390×844 E2E covers no horizontal overflow and keyboard use of the environment manager. Post-merge mainline Verify/Build #45914284289 succeeded; mainline CI #45914284421 had reached the Chromium E2E step and was still in progress at the latest check. No production browser interaction is claimed.
- PR #218 stacks collections/editor at <=760px, exposes row actions for touch, compacts topbar at <=520px, and adds a 390×844 no-horizontal-overflow/keyboard E2E.
- Environment manager reuses `EnvStore`; values remain in origin-scoped `api-debugger:env` localStorage, shared with legacy API Debugger. Studio preserves legacy `active` by default. Secret masking/redaction is not encryption at rest; outbound requests still use `/api/apiproxy`.
- Issue #213 remains open. After #218, finish collection-run per-request details, cancellation/stop/retry and any remaining focus/accessibility items; then proceed to #214 dedicated build/landing page work.

## Environment and package manager

`package.json` pins `pnpm@9.11.0`; `pnpm-lock.yaml` is committed.

```bash
pnpm install
pnpm dev
```

## Build and quality checks

Current scripts are defined in `package.json`. The production build includes locale registry checks, design-token generation, legacy canonical/noindex processing, Vue typechecking, Vite build, SEO generation, canonical-link checks and README synchronization verification.

```bash
pnpm build
pnpm test
pnpm test:e2e
pnpm typecheck
pnpm lint
pnpm tokens:check
pnpm i18n:check
```

Run additional targeted audits when relevant, including keyword mapping, example coverage, copy bindings and notes front matter. Use `pnpm run` and `package.json` as the source of truth; do not assume a successful Vite build means browser E2E passed.

## Homepage and UX scope

The main DigDevBox homepage acceptance remains CLOSED. Do not reopen its broad redesign. API Studio's dedicated product landing page is a separate product deliverable tracked by Issue #212; it must preserve the main site's own identity and must not convert the general homepage into a second marketing microsite.

## Privacy and network behavior

The README describes most tools as local-first, with selected network-backed tools explicitly requiring a backend or upstream lookup. Before changing privacy copy, inspect the specific tool implementation and browser Network requests. Do not generalize one tool's privacy model to the entire site.

## Release workflow

- Check current issue/PR, branch, exact head SHA and WIP before coding.
- Run the relevant tests and inspect individual CI job steps; a parent workflow state is insufficient.
- Verify critical routes and tools in a browser at desktop and mobile sizes.
- Record exact commit, build/test results, Preview URL, production deployment SHA and live verification separately.
- Cloudflare production deployment, DNS and account settings remain owner-authorized operations.

## Scope guardrails

Keep the US/EU market and English-first direction. Improve existing tools, discovery and conversion rather than adding tools indiscriminately. Product changes should follow a complete user task from entry through successful result, including validation, error recovery, accessibility and mobile use. Historical production PASS does not automatically verify a new commit.

## API Studio implementation execution route

API Studio Issues #213 and #214 are active product work. This repository's own CI, Verify and E2E workflows run on GitHub-hosted Ubuntu runners, with Cloudflare Pages Preview for PRs; they must remain independent of the DigImg Windows self-hosted Runner. Do not change dev-tools workflows to use that Windows host. DigImg PR #41's identity/credential-isolation gate remains a separate requirement for DigImg work, not a blocker for dev-tools PRs.

## API Studio — authoritative product-boundary clarification

API Studio is an additional tenth independent product line, not one of the nine websites and not permanently a subpage of DigDevBox Main. It will have its own brand (final name after clearance), separate registrable primary domain, homepage, workspace, docs/tutorials, changelog and growth plan. The “by DigDevBox” endorsement may preserve the parent-brand relationship.

The old www.digdevbox.com/api-studio/ route is retained as a transition and fallback only. No new brand or domain is selected yet. Do not register a domain, configure DNS or force redirects before explicit owner selection. Do not force migration before complete user-controlled backup/restore and tested import on the new origin.

Current implementation remains in this repository initially. Dedicated product build/Pages project is the planned deployment separation; repository split is not an immediate prerequisite.
