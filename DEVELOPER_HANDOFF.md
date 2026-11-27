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

- Main SHA at this refresh: `1442de94ee9a72437855512f0921eae91791edf4`.
- PR #236 MERGED; Issue #235 CLOSED. Merge SHA `34f1b424fddf934397e43dee9a15a4a9bb33ecf7`; exact-head CI #45960165602, Verify #45960165612 and Preview #140375840120 passed. Environment selector readability was improved; Preview is not Production.
- **Current WIP: PR #239 / Issue #238 — manual Retry.** PR https://github.com/yqh-core/dev-tools/pull/239; branch `feat/api-studio-single-request-retry-20261127`; exact head `0943ce275626122718880b101a7e20687274c619`. PR remains OPEN and unmerged; GitHub reports mergeable=true. Branch comparison at this refresh: 22 commits ahead / 6 behind main, merge base `34f1b424fddf934397e43dee9a15a4a9bb33ecf7`; the six changed files are limited to CI workflow, first-request guide, standalone site E2E, API Studio shell, workspace page and API Studio E2E.
- Retry behavior: manual-only recovery for relay/network transport failures and wrapped upstream 408/425/429/5xx. Missing local variables and non-transient upstream 4xx do not offer Retry. No automatic replay; retry repeats the current request only after an explicit click/keyboard action. The guide warns users to consider side effects before repeating write operations.
- **Real relay contract:** `functions/api/apiproxy.js` returns outer HTTP 200 for a successfully relayed upstream response, with the upstream HTTP status in the JSON `status` field. The implementation checks transport failures and the wrapped upstream response status. The tests model the actual relay envelope rather than a synthetic outer 503.
- Earlier mobile visual review exposed a real defect: at 390×844 the legacy `/api-studio` editor collapsed despite an earlier overflow/focus check. The final flex-height chain explicitly propagates through shell body → slotted `#main-content` → workspace. Current E2E checks shell/main/workspace height, editor >300px, bottom alignment, visible/in-viewport Retry, pointer hit-test and keyboard Enter recovery.
- Historical failing evidence (not current-head state): head `4f1c7f3` failed 1/141 Chromium checks because the mobile editor was 20px; the first height fix was insufficient. Corrective commits `9180636d5a8f3c26ba24c98f206fa8b92bf81852` and `0b85b853a0e72ef135d7bf26ff3056a84e64feaa` added the flex chain and geometry checks. Later head `28c6b09` Verify failed a selector mismatch and a mobile mount-state timing assertion; current head `0943ce2` fixes the test selector/wait.
- **Exact-head Verify/Build #45971234199: SUCCESS.** Dedicated API Studio product build, site E2E (14 cases), output validation and product screenshot upload passed. Exact-head Cloudflare Pages Preview is deployed at https://dc8f803b.coderkit.pages.dev/ (Preview, not Production). Its homepage/workspace visual artifact #15185342229 was downloaded and reviewed: 1440×900 / 390×844 homepage/workspace, Data tools collapsed/expanded and environment selector. This artifact is not the legacy Retry-state screenshot.
- **Exact-head broad CI #45971234026 / job #140411902911: IN_PROGRESS at last check.** Lint, relay/Worker lint and dry-run bundle, unit tests, typecheck, main build and Chromium installation passed. The one-worker Chromium E2E step runs 16 spec files / 145 test cases and remained active; dedicated legacy Retry desktop/mobile screenshot upload was pending. No current-head E2E pass/failure or Retry screenshot visual review is claimed yet. Previous exact-head #45968522508 took ~26 minutes in the same broad browser step and ended 140/141, so do not infer a hang or pass from duration alone.
- Merge rule: re-fetch the PR exact head and mergeability; require #45971234026 completed success; inspect the uploaded legacy Retry screenshots at desktop 1440×900 and mobile 390×844; confirm the mobile editor and Retry are genuinely visible and pointer-reachable. Then merge only with expected head SHA `0943ce275626122718880b101a7e20687274c619`. Verify post-merge mainline CI/Verify/Pages separately; Preview is never Production.
- Product homepage and standalone empty workspace already passed desktop/mobile review. Preserve API Studio navy/mint identity; do not speculate on a broad visual redesign.

### Next engineering task: Issue #240

[Issue #240 — audit and verify the complete first-request journey](https://github.com/yqh-core/dev-tools/issues/240) is next after #239 merges. Existing standalone `src/api-studio-product/site.e2e.spec.ts` covers 14 product homepage, empty workspace, guides, first-request CTA, mobile, disclosure and environment-selector cases. Legacy seeded E2E separately covers request send, assertions, environment variables and collection runner. The remaining gap is one continuous first-use Playwright task on a clean standalone `/app/` origin:
1. Create a blank request through the first-use CTA; prove no relay traffic before Send.
2. Configure method, URL, query and header through visible controls; Send through a mocked first-party relay only.
3. Inspect upstream status, elapsed time, response headers and body.
4. Add and run status-code plus JSON-field assertions; inspect per-rule outcomes.
5. Reload and confirm request persistence; identify the selected environment and collection runner, then run saved work.
6. Exercise a recoverable relay/upstream failure with manual recovery; never auto-replay and never expose secrets/body in logs or screenshots.
7. Cover desktop 1440×900 and mobile 390×844, keyboard/touch/focus, target size and no horizontal overflow.

Do not reuse a seeded tree for the continuous journey or duplicate component-level tests. Do not send live third-party requests; mock the first-party relay boundary. Preserve the actual privacy boundary: browser localStorage is origin-scoped, URL/headers/body pass through the first-party relay, and masking is not encryption. The standalone site's product-level competitor sequence is **first response → inspect → validate → save/reuse → automate**.

### Then Main-site Issue #237

[Issue #237](https://github.com/yqh-core/dev-tools/issues/237) is queued after #240. A read-only source diagnosis and implementation notes were added to the issue on 2026-11-27 (comment ID `7214799882`):
- `src/components/CollapsibleToolMenu.vue` uses persisted key `menu-tool-option:collapsed-categories`; undefined state plus `show="!isCollapsed"` makes fresh-profile groups expanded.
- Category headings are click-only `div` elements, without native keyboard activation, `aria-expanded` or `aria-controls`.
- The active route is passed to the inner menu, but the wrapper does not reveal the containing category when all groups are collapsed.
- Target implementation: default only unset categories to collapsed, preserve explicit saved choices, use a semantic button with disclosure ARIA/focus, reveal only the active tool category on direct navigation, retain DigDevBox's own tokens. Test desktop/mobile, pointer/touch/Enter/Space, direct navigation, search, task entry points and no overflow.
- Cookie/consent and Settings visual restyle stay out of this bounded issue; broad Main homepage redesign remains CLOSED.

### Latest portfolio methods and cross-session memory

- Competitor review update: `research/API_STUDIO_COMPETITOR_AND_VISUAL_SYSTEM_REVIEW_2026-11-27.md`, commit `9be231fac855d054a1d667554fa3b150b6019ac9`. Adds current official Hoppscotch release/features, Postman v12 task/account/response guides, Primer foundations and the historically scoped JetBrains reference. The chosen direction is to finish #239 then #240, not add Spotlight/collaboration/protocol parity or unmeasured response-size features.
- Professional copy/terminology requirement added to `strategy/NINE_SITE_HOME_AND_TOOL_UX_ACCEPTANCE_STANDARD_2026-11-27.md`, commit `87b54fd7005368667197740bb6efaa03b187bb85`: keep standard technical terminology; define unfamiliar terms once; consistent labels across tools/docs/tutorials/blog; tutorial structure = task → steps → expected result → relevant caveats; blog content separates source-backed facts from analysis.
- Universal product UX playbook is v1.5 (content commit `0ccd6ae36f22e34e34f4078572776e079c7f2deb`, version commit `36528f99a5567d6ef608f12263a9be9ed444b3ca`). It applies to nine original sites plus API Studio but preserves ten distinct art directions.
- Latest manual continuation record: https://github.com/yqh-core/digdevbox-design-system/blob/main/ops/automation-runs/2026-11-27-api-studio-manual-continuation.md. The compact current WIP board remains https://github.com/yqh-core/digdevbox-design-system/blob/main/strategy/DIGDEVBOX_EXECUTION_CONTROL_BOARD.md.

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
