# DigDevBox Main Site — Developer handoff

**Site:** https://digdevbox.com  
**Repository:** https://github.com/yqh-core/dev-tools  
**Portfolio role:** Tier A — second growth entry alongside DigImg.

**API Studio product direction (owner-confirmed 2026-11-27):** API Studio is the tenth independent product line in addition to the original nine-site portfolio. It must gain a distinct final brand and its own separate registrable primary domain, dedicated product homepage, /app/ workspace, docs/tutorials and release/growth path. “by DigDevBox” may be used as parent endorsement. Earlier DigDevBox-subdomain proposals are superseded. This does not require an immediate repository split: reuse yqh-core/dev-tools initially. No final name/domain or production host has been selected. See [Issue #212](https://github.com/yqh-core/dev-tools/issues/212), [Issue #213](https://github.com/yqh-core/dev-tools/issues/213), [Issue #214](https://github.com/yqh-core/dev-tools/issues/214), and the [independent product plan](https://github.com/yqh-core/digdevbox-design-system/blob/main/strategy/API_STUDIO_INDEPENDENT_PRODUCT_PLAN_2026-11-27.md). See [Issue #212](https://github.com/yqh-core/dev-tools/issues/212), [Issue #213 — complete the workspace workflow](https://github.com/yqh-core/dev-tools/issues/213), [Issue #214 — dedicated Pages build target and homepage](https://github.com/yqh-core/dev-tools/issues/214), and the [independent product plan](https://github.com/yqh-core/digdevbox-design-system/blob/main/strategy/API_STUDIO_INDEPENDENT_PRODUCT_PLAN_2026-11-27.md).

## Product and architecture

The main site is a Vue/Vite developer-tools directory with task-oriented discovery, categories, tool detail routes and supporting content. The repository README is the product inventory and generated tool-list source. Most utilities process data locally in the browser; a limited number make network requests through first-party or upstream services. Never describe the entire site as local-only.

The existing DigDevBox route `/api-studio/` remains a transitional discovery and fallback entry. This repository also contains the independent API Studio product build: its own product homepage at `/`, actual `/app/` workspace, `/docs/` index and task-specific guides, built separately through `pnpm run build:api-studio`. Exact-head Cloudflare branch Previews and dedicated product-site browser checks have passed for the current product shell, but there is not yet a second Production Pages project, approved custom host or final independent domain. Keep product code in this repository initially; an immediate repository split is not required.

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

### Current mainline and active API Studio UX work

- Main SHA at this handoff refresh: `201e7780f09cb3b751c7806d23cc2496c37acfd4`. Main-only handoff documentation commits do not overlap PR #239 source files.
- PR #236 MERGED; Issue #235 CLOSED. Merge SHA `34f1b424fddf934397e43dee9a15a4a9bb33ecf7`; exact-head CI #45960165602, Verify #45960165612 and Preview #140375840120 passed.
- **Current WIP: PR #239 / Issue #238 — manual Retry and legacy workbench shell repair.** PR https://github.com/yqh-core/dev-tools/pull/239; branch `feat/api-studio-single-request-retry-20261127`; exact head `df06d899ff7f1d7e72b6f3c7c631d8a9441d6149`. PR remains OPEN and unmerged. Latest compare: 24 ahead / 8 behind; merge base `34f1b424fddf934397e43dee9a15a4a9bb33ecf7`; six changed files are CI workflow, first-request guide, standalone product-site E2E, API Studio shell, workspace page and legacy API Studio E2E.
- Retry behavior: manual-only recovery for relay/network transport failures and wrapped upstream 408/425/429/5xx. Missing local variables and non-transient upstream 4xx do not offer Retry. No automatic replay; retry repeats the current request only after explicit user action. The guide warns about side effects before repeating write operations.
- **Real relay contract:** `functions/api/apiproxy.js` returns outer HTTP 200 for a successfully relayed upstream response, with the upstream HTTP status in the JSON `status` field. The implementation checks transport failures and wrapped upstream status.
- Prior mobile work discovered the legacy editor could collapse to 20px at 390×844. Earlier corrective commits propagated a flex-height chain through shell body → slotted `#main-content` → workspace and added geometry, visible Retry, pointer and keyboard assertions.
- **Failure on previous exact head 0943ce2:** Main CI [#45971234026](https://github.com/yqh-core/dev-tools/actions/runs/45971234026) completed FAILURE with 126/142 Chromium tests passing. Main lint, relay/Worker lint + dry-run bundle, unit tests, typecheck and production build passed. Fifteen legacy-workbench cases timed out because real clicks were intercepted by `.api-topbar` / the shell; one mobile homepage→workspace journey found Collections hidden. Retry screenshot upload logged no desktop/mobile PNGs found; no Retry screenshot exists from this run. Homepage visual artifact #15186717487 was uploaded and inspected.
- **Confirmed root cause:** repo pins Naive UI 2.35.0. Its nested `NConfigProvider` renders a wrapper `div` unless `abstract` is enabled. The API Studio full-height shell expected the header and body to be direct flex children, but the provider inserted an intermediate wrapper. Pinned upstream implementation: https://github.com/tusen-ai/naive-ui/blob/v2.35.0/src/config-provider/src/ConfigProvider.ts.
- **Corrective commits:** `f66082be5dd72537591969cf6bb742bfdaf2a82d` adds `abstract` to the nested API Studio theme provider, retaining theme context without an extra DOM element. Latest test commit / exact head `df06d899ff7f1d7e72b6f3c7c631d8a9441d6149` asserts the topbar and shell body are direct children of the flex root and that the body receives real viewport height on desktop 1440×900 and mobile 390×844. Existing user interactions remain real Playwright pointer actions; do not add force clicks or weaken visibility checks.
- **Current exact-head verification:** Main CI [#45976047037](https://github.com/yqh-core/dev-tools/actions/runs/45976047037), Verify/Build [#45976047178](https://github.com/yqh-core/dev-tools/actions/runs/45976047178), and Cloudflare Pages Preview are IN_PROGRESS at the latest observation (2026-11-27 09:45 UTC). CI had reached Lint; Verify had passed example/SEO self-checks and was running typecheck/build. The 0943 Verify pass and its Preview https://dc8f803b.coderkit.pages.dev/ apply only to 0943, not df06d89.
- PR discussion comment #7215024983 records the exact failure diagnosis and fix. Merge only after exact-head CI + Verify/Build pass, Pages Preview corresponds to df06d89, and legacy Retry desktop 1440×900 + mobile 390×844 screenshots are present and visually reviewed. Re-fetch the exact PR head/mergeability before merge. Post-merge mainline CI/Verify/Pages must be checked separately; Preview is never Production.

### Next engineering task: Issue #240

[Issue #240 — audit and verify the complete first-request journey](https://github.com/yqh-core/dev-tools/issues/240) is next after #239 merges. Existing standalone `src/api-studio-product/site.e2e.spec.ts` covers 14 product homepage, empty workspace, guides, CTA, mobile, disclosure and environment-selector cases. Legacy seeded E2E separately covers request send, assertions, environments and Collection Runner. Remaining gap is one continuous first-use Playwright journey on a clean standalone `/app/` origin:
1. Create a blank request through the first-use CTA; prove no relay traffic before Send.
2. Configure method, URL, query and header through visible controls; Send through a mocked first-party relay.
3. Inspect upstream status, elapsed time, response headers and body.
4. Add/run status-code and JSON-field assertions; inspect per-rule outcomes.
5. Reload and confirm request persistence; identify the selected environment and Collection Runner, then reuse saved work.
6. Exercise recoverable relay/upstream failure with manual recovery; no auto-retry and no secrets/body in logs or screenshots.
7. Cover desktop 1440×900 and mobile 390×844, keyboard/touch/focus, target size and no horizontal overflow.

Do not seed a request tree for the continuous journey or duplicate component tests. Do not send live third-party requests; mock only the first-party relay boundary. Browser localStorage is origin-scoped, URL/headers/body pass through the first-party relay, and masking is not encryption. Competitor sequence: **first response → inspect → validate → save/reuse → automate**.

### Then Main-site Issue #237

[Issue #237](https://github.com/yqh-core/dev-tools/issues/237) is queued after #240. Source diagnosis and bounded implementation notes are recorded in issue comment #7214799882:
- Existing persisted key: `menu-tool-option:collapsed-categories`; undefined values make fresh-profile categories expanded.
- Category headers are click-only divs, lacking native keyboard activation, `aria-expanded` and `aria-controls`.
- Preserve explicit saved choices; only unset categories default collapsed. Use native button disclosure semantics/focus; reveal only the active category for direct navigation; preserve DigDevBox tokens.
- Test pointer/touch/Enter/Space, direct links/back, search/task entry points, 1440×900 and 390×844, no overflow.
- Cookie/consent and Settings redesign remain later/separate; broad Main homepage redesign remains CLOSED.

### Latest portfolio methods and cross-session memory

- Competitor review: `research/API_STUDIO_COMPETITOR_AND_VISUAL_SYSTEM_REVIEW_2026-11-27.md`, commit `9be231fac855d054a1d667554fa3b150b6019ac9`; current Hoppscotch, Postman v12, Primer and historically scoped JetBrains evidence.
- Professional terminology/copy standard: `strategy/NINE_SITE_HOME_AND_TOOL_UX_ACCEPTANCE_STANDARD_2026-11-27.md`, commit `87b54fd7005368667197740bb6efaa03b187bb85`. Retain correct technical terminology, briefly define unfamiliar terms at first use; tutorials follow task → steps → expected result → caveats; blog separates source-backed facts from analysis.
- Product UX Playbook v1.5: content commit `0ccd6ae36f22e34e34f4078572776e079c7f2deb`, version commit `36528f99a5567d6ef608f12263a9be9ed444b3ca`. Ten products retain different art directions.
- Current compact control board: https://github.com/yqh-core/digdevbox-design-system/blob/main/strategy/DIGDEVBOX_EXECUTION_CONTROL_BOARD.md. Current dated continuation log: https://github.com/yqh-core/digdevbox-design-system/blob/main/ops/automation-runs/2026-11-27-api-studio-manual-continuation.md.

### Remaining launch gates

- **Issue #221 OPEN — shared relay limiter Production rollout.** Production still uses `API_RELAY_RATE_LIMIT_MODE=local`. The separate Worker at `workers/api-relay-limiter/wrangler.toml` has not been deployed and bound to Production. Required: `API_RELAY_LIMITER` binding to `IpRateLimiter`, `API_RELAY_RATE_LIMIT_HMAC_KEY` (32+ characters), account plan/spend/WAF review, Pages redeploy, and deployed cross-isolate, restart-persistence, 429/Retry-After and fail-closed verification. Do not claim shared enforcement or broadly promote the relay before this gate.
- **Issue #214 OPEN — independent product Production launch.** The product homepage/build/docs and branch Preview code are merged, but no second Production Cloudflare Pages project, approved primary host, canonical/sitemap production configuration, old/new URL map or migration/rollback acceptance exists. Keep `https://www.digdevbox.com/api-studio/` as a transition/fallback. The second Pages project must use `pnpm run build:api-studio`, output `dist-api-studio`, and retain the Pages Functions needed by `/api/apiproxy`.
- **Issue #219 OPEN — brand/domain selection.** “API Studio” is a working name only. Complete sourced collision/domain screening and obtain the owner's explicit final selection. No domain purchase, DNS, custom-host binding, canonical change or redirect before that decision.
- **Issue #213 is CLOSED / completed** after reconciliation of core workspace PRs #215–#218, #223 and child issues #220/#222. Request-history/data-file iteration remains a separate evidence-led product decision.
- **PR #234 MERGED** as `0548651af960119ed50aaf7882bbbac2669dfc2c`; Issue #233 CLOSED. The Data tools disclosure keeps Request / Folder / Run / Environment primary and groups lower-frequency Backup / Restore / Postman transfer under a keyboard-accessible collapsed disclosure. Hidden file inputs remain mounted; mobile targets are 44px and expanded collection root stays visible. Exact-head CI/Verify/Preview passed and desktop/mobile screenshots were inspected.

- **PR #236 MERGED** as `34f1b424fddf934397e43dee9a15a4a9bb33ecf7`; Issue #235 CLOSED. It fixes the desktop Environment selector truncation by reclaiming width from the redundant caption, retaining full tooltip/accessibility name and preserving Manage/count. Common value Default is readable at 1440×900; long value Staging-West-2-Production remains visible at 390×844 with Manage/count and no horizontal overflow. Product Verify/Build #45960165612, generic CI #45960165602 and exact-head Cloudflare Preview #140375840120 all passed on tested head `f29b597b415705252a9f4f8d74234abe69b903b7`. Preview https://470b5b66.coderkit.pages.dev/ is Preview, not Production. One test-role mismatch with Naive UI was corrected in the test locator only; product behavior did not change.

- **Post-merge mainline gates** are separate: merged SHA `34f1b424fddf934397e43dee9a15a4a9bb33ecf7` has CI #45960958458 and Verify/Build #45960958401 still running at latest poll; Cloudflare Pages #140378387490 succeeded at https://0874d945.coderkit.pages.dev/. This does not prove the separate API Studio Production hostname is live.

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

The broad DigDevBox Main homepage redesign remains CLOSED. Do not reopen it. A bounded navigation follow-up, [Issue #237](https://github.com/yqh-core/dev-tools/issues/237), tracks collapsing tool-category groups by default for fresh homepage visits while keeping search/task entry points, keyboard/touch operation and direct tool navigation discoverable. Cookie/Settings visual restyling is a separate later task; Issue #231 is the distinct mobile hero/consent overlap fix. API Studio's dedicated product landing page remains separate and must preserve the Main site's own identity.

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
