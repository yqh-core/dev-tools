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

## API Studio delivery status — reconciled 2026-11-27

API Studio is the tenth independent DigDevBox product line, in addition to the original nine-site portfolio. The working product name is not yet cleared as the final brand. The target is a separate registrable primary domain; “by DigDevBox” may be used as parent endorsement. Continue using this repository initially; independent product identity/deployment does not require an immediate repository split.

### Implemented and merged

- **Single-request workflow, response inspection and request editor:** PR #215 merged.
- **Structured response assertions:** PR #216 merged.
- **Studio-native environments and scoped variables:** PR #217 merged. Environment / Collection / Global scope, secret markers and masking are in the shared origin-scoped store; secret masking is not encryption.
- **Responsive workspace:** PR #218 merged. Desktop and 390×844 mobile behavior received exact-head E2E/Preview acceptance.
- **Collection runner:** PR #223 merged as `d0855a11eee3d1e69f16acc189245adaaaa40e9f`. Live current-request/progress events, cancellation before scheduling the next request, expandable PASS/FAIL/NOT SENT outcomes, assertion/script details, safe rerun and redacted report copy/download. An in-flight request is allowed to finish or time out; cancellation is not represented as immediate network abort. Child #222 is CLOSED.
- **Portable backup / restore:** PR #224 merged as `1cd5058c5b6dab67ff2c5d228e5f24fcca734327`; child #220 CLOSED. Versioned archive, strict validation, content preview and explicit replace/merge restore. Default redaction is best effort and cannot identify every unmarked credential in arbitrary payloads.
- **Independent product site:** PR #226 merged as `30760f03a3c5c208e09c18562fafe7c33708a3b5`. Product homepage, actual `/app/` workspace, `/docs/` index plus four task guides, isolated `pnpm run build:api-studio` → `dist-api-studio/`, route metadata and guarded branch Preview output. This is a product build/Preview path, not a second Production Pages project.
- **First-request onboarding:** PR #228 merged; empty workspace shows a user-triggered blank-request action and does not auto-send.
- **Relay hardening:** PR #225 merged (2 MiB inbound JSON envelope cap); PR #229 merged (SQLite-backed Durable Object shared limiter implementation); PR #230 merged (8 KiB UTF-8 header, response-header count and upstream-timeout regression tests).

### Current mainline and active homepage work

- Current mainline snapshot when reconciled: `de02191e35e87c584bc4c949f73417ea206afe72`; the preceding relay test merge is `187ca67d0175e7fd3154457ba25398a2bb68ed9f`.
- **PR #232 is MERGED**: https://github.com/yqh-core/dev-tools/pull/232 — exact tested head `63b7bf9481129d956187322b758e87f06de4359d`, squash merge commit `016a78f328a3ffd91f10927934646e6f6adc0e54` on 2026-11-27. Adds a four-step Request → Response → Assertions → Collection run explanation, keyboard-operable buttons, `aria-live` detail, responsive two-column mobile steps and desktop/mobile E2E. The walkthrough is labelled as illustrative and sends no network call; do not call it a live demo.
- Prior exact-head failures were isolated and fixed: `cbd0ea1` had one extra blank line (fixed in `7d4d887`); Verify on `7d4d887` found a duplicated sample-label locator in the existing homepage E2E (fixed by the `ILLUSTRATIVE · NO LIVE REQUEST` badge and no-fetch/XHR assertion in `a9b9fa6`); CI on `a9b9fa6` required braces/newline around the fetch/XHR test conditional (fixed in `63b7bf9`). The exact-head CI #45953724854 / job #140355265600 completed **SUCCESS (18/18)**, Verify/Build #45953724793 / job #140355265429 completed **SUCCESS (19/19)** and Cloudflare Preview deployed successfully at https://78e99909.coderkit.pages.dev/. Latest 1440×900 and 390×844 homepage/workspace screenshots were inspected. PR #232 was then squash-merged as `016a78f328a3ffd91f10927934646e6f6adc0e54`. The Preview is not a Production deployment; post-merge Actions/Production evidence for `016a78f` has not yet been confirmed.
- Mainline merge commit `187ca67d0175e7fd3154457ba25398a2bb68ed9f` now has CI #45952236229 and Verify/Build #45952236277 both **SUCCESS**; Verify includes the independent API Studio product build and product-site Chromium E2E. PR #230 Preview head `3f237bf` deployed successfully at https://a90a1c3f.coderkit.pages.dev/ (Preview only). These are not PR #232 checks. A Production deployment of `187ca67` was not confirmed.

### Remaining launch gates

- **Issue #221 OPEN — shared relay limiter Production rollout.** Production still uses `API_RELAY_RATE_LIMIT_MODE=local`. The separate Worker at `workers/api-relay-limiter/wrangler.toml` has not been deployed and bound to Production. Required: `API_RELAY_LIMITER` binding to `IpRateLimiter`, `API_RELAY_RATE_LIMIT_HMAC_KEY` (32+ characters), account plan/spend/WAF review, Pages redeploy, and deployed cross-isolate, restart-persistence, 429/Retry-After and fail-closed verification. Do not claim shared enforcement or broadly promote the relay before this gate.
- **Issue #214 OPEN — independent product Production launch.** The product homepage/build/docs and branch Preview code are merged, but no second Production Cloudflare Pages project, approved primary host, canonical/sitemap production configuration, old/new URL map or migration/rollback acceptance exists. Keep `https://www.digdevbox.com/api-studio/` as a transition/fallback. The second Pages project must use `pnpm run build:api-studio`, output `dist-api-studio`, and retain the Pages Functions needed by `/api/apiproxy`.
- **Issue #219 OPEN — brand/domain selection.** “API Studio” is a working name only. Complete sourced collision/domain screening and obtain the owner's explicit final selection. No domain purchase, DNS, custom-host binding, canonical change or redirect before that decision.
- **Issue #213 is CLOSED / completed** after reconciliation of core workspace PRs #215–#218, #223 and child issues #220/#222. Request-history/data-file iteration remains a separate evidence-led product decision.
- **Issue #233 is implemented by open PR #234:** https://github.com/yqh-core/dev-tools/pull/234 — branch `feat/api-studio-workspace-data-disclosure-20261127`, latest recorded head `9bdcfdd96b595b11d0eca32e12acd73e2eae1bdf`. The change groups backup/restore/Postman import/export under a native keyboard-accessible disclosure while keeping Request / Folder / Run / Environment visible; it preserves hidden file-input wiring and data semantics. Previous Verify on `2c4cf1f` measured the expanded mobile sidebar at 401px (cap 400px); fixed by setting height/max-height to 399px on `9bdcfdd`. Exact-head CI #45956763747 and Verify/Build #45956763707 were in progress at the last recorded poll (8 CI steps and 7 Verify steps passed; no failure reported), and the latest-head Preview was pending. Fresh collapsed/expanded screenshots from `9bdcfdd` are still required. Do not merge until exact-head CI, Verify, Preview and screenshot review pass. **Issue #231** remains a separate DigDevBox Main mobile/consent overlay refinement and does not reopen the closed broad redesign.

### Current evidence and product truth

- The last verified historical API Studio product-site Preview from PR #226 was https://62809fd5.coderkit.pages.dev/ for the old exact head `50755caa`. Do not call that the latest PR #232 Preview. The new PR #232 exact-head Preview was still building at the latest recorded check.
- The standalone product build intentionally omits production canonical URLs and sitemap until an approved HTTPS origin is configured. `/app/` stays noindex and out of the public sitemap.
- Collections/environment values persist in this browser's origin-scoped storage. Outbound request URL, headers and body pass through the first-party relay. Secret masking is not encryption at rest. Do not claim that requests are fully local or never leave the browser.
- No final brand/domain, second Production Pages project, DNS, production canonical, redirect or independent-origin user migration has been completed.

Details for cross-conversation continuation: [API Studio guided walkthrough work log in the design-system control repository](https://github.com/yqh-core/digdevbox-design-system/blob/main/ops/automation-runs/2026-11-27-api-studio-guided-walkthrough.md), [Issue #214](https://github.com/yqh-core/dev-tools/issues/214), [Issue #221](https://github.com/yqh-core/dev-tools/issues/221), [Issue #219](https://github.com/yqh-core/dev-tools/issues/219).

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

API Studio Issue #213 is CLOSED / completed; Issue #214 remains active for the independent product-site launch. This repository's own CI, Verify and E2E workflows run on GitHub-hosted Ubuntu runners, with Cloudflare Pages Preview for PRs; they must remain independent of the DigImg Windows self-hosted Runner. Do not change dev-tools workflows to use that Windows host. DigImg PR #41's identity/credential-isolation gate remains a separate requirement for DigImg work, not a blocker for dev-tools PRs.

## API Studio — authoritative product-boundary clarification

API Studio is an additional tenth independent product line, not one of the nine websites and not permanently a subpage of DigDevBox Main. It will have its own brand (final name after clearance), separate registrable primary domain, homepage, workspace, docs/tutorials, changelog and growth plan. The “by DigDevBox” endorsement may preserve the parent-brand relationship.

The old www.digdevbox.com/api-studio/ route is retained as a transition and fallback only. No new brand or domain is selected yet. Do not register a domain, configure DNS or force redirects before explicit owner selection. Do not force migration before complete user-controlled backup/restore and tested import on the new origin.

Current implementation remains in this repository initially. Dedicated product build/Pages project is the planned deployment separation; repository split is not an immediate prerequisite.
