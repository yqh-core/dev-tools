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

### Current mainline and active API Studio UX work — refreshed 2026-11-27 10:40 UTC

- **Main current ref at last reconciliation:** `e8edaf51009f719633c6a05f55b460a6a151dfbd`; changes since code main `8f980e5` are control/handoff documentation updates. Recheck live refs, PR heads and diffs before merge.
- **PR #239 / Issue #238 — MERGED / CLOSED.** PR #239 merged at `8f980e5`; Issue #238 closed after main generic CI #45980074381 SUCCESS. Retry is explicit-only for Relay/network transport and wrapped upstream 408/425/429/5xx. No auto replay; local validation/missing vars and ordinary 4xx do not retry. Real upstream status is `payload.status` in the outer HTTP 200 relay wrapper.
- **PR #239 gates:** CI #45978435773 SUCCESS; Verify #45978435709 SUCCESS; branch Preview https://1f83a9fb.coderkit.pages.dev/ SUCCESS (Preview only); Retry artifact #15188229020 reviewed at desktop 1440×900 and mobile 390×844. Main Verify #45980074643, Pages #140442816028, Production smoke #140443283568 and generic Chromium CI #45980074381 all SUCCESS.
- **Main homepage / Issue #231:** production artifact #15189740788 reviewed; evidence https://github.com/yqh-core/dev-tools/issues/231#issuecomment-7215705387. Desktop hero y112–575, cards y627, consent overlay y757–884 (720×127) covers first task row. Mobile hero y120–1196 (1,076px), preview y721–1169, consent overlay y711–834 (370×123); CTA stays visible, no horizontal overflow. Bounded consent placement/first-fold improvement only; preserve Accept/Reject and policy.

#### P0 — API Studio Issue #240 / PR #241

- [PR #241](https://github.com/yqh-core/dev-tools/pull/241) OPEN, branch `test/api-studio-first-request-journey-20261127`, current exact head `b7937fbe72fe3b21f095756c4279fd0c3d73733d`; GitHub reports mergeable.
- Product fix in `src/pages/ApiStudio.page.vue`: API Studio persists its selected environment separately at `api-studio:selected-environment`. It restores QA after reload while preserving the legacy shared `api-debugger:env.active = Default`, so `{{apiVersion}}` context no longer silently changes on refresh.
- Continuous journey in `src/api-studio-product/site.e2e.spec.ts`: fresh standalone noindex `/app/`, empty collection/environment; proves zero Relay call until explicit Send; creates request and QA variable through UI; configures POST/query/header/body; status + JSON-field assertion; mocks first-party Relay (503 then explicit keyboard Retry to 200); inspects response/assertions; reload persistence; Collection Runner reuses QA variable.
- Extra UX corrections: Retry target minimum 44px with actual mobile bounding-box/pointer hit-test/keyboard Enter checks; guide empty state says **Create your first request** and subsequent request action **+ Request**. Standalone app does not load Main consent/GA bootstrap; test verifies absence of Main consent key/UI and GA/Tag Manager/Plausible requests without fabricating a Reject button.
- Latest exact-head checks at 10:39 UTC: CI [#45983612029](https://github.com/yqh-core/dev-tools/actions/runs/45983612029) IN_PROGRESS; Verify/Build [#45983611989](https://github.com/yqh-core/dev-tools/actions/runs/45983611989) IN_PROGRESS; Cloudflare Pages #140453425164 IN_PROGRESS (Preview). CI lint, Relay/Worker lint+bundle, unit tests and typecheck passed, app build running. Verify install/example coverage/SEO crawler self-test passed; product build/browser E2E running. Trace-based test corrections use ArrowDown+Enter for POST on the actual Naive UI selector and the rendered `.n-base-select-option` for JSON-field. Do not merge until all same-head checks pass and desktop/mobile artifacts are reviewed.

#### Parallel bounded Main navigation — Issue #237 / PR #243

- [PR #243](https://github.com/yqh-core/dev-tools/pull/243) OPEN, branch `fix/main-tool-category-first-visit-20261127`, exact head `258bbdbae6ee4a95133c3365bb97c480b2b7bd99`.
- First visit: tool category groups default collapsed; existing `menu-tool-option:collapsed-categories` choices are retained; new/unknown categories default collapsed. Deep-linked tool route reveals only its active category with a temporary route override, without silently overwriting saved preference.
- Category heading is native button with `aria-expanded`, `aria-controls`, labelled region, visible focus and 44px minimum target. Main's existing visual identity is preserved. No Cookie/Settings redesign or homepage hero change.
- Dedicated `src/components/CollapsibleToolMenu.e2e.spec.ts` covers fresh 1440×900 state and search/featured links, ARIA relationships, mouse click, Enter/Space, reload preference, JSON/JWT deep links and return-home state, 390×844 touch target/no overflow.
- Exact-head CI [#45983829533](https://github.com/yqh-core/dev-tools/actions/runs/45983829533), Verify/Build [#45983829639](https://github.com/yqh-core/dev-tools/actions/runs/45983829639), Cloudflare Pages #140454189946 were IN_PROGRESS at last poll. Verify same-head results and browser artifacts before merge. #241 remains P0; #243 is parallel but lower priority.

#### Priority and safety

- Priority after both #241 and #243 are verified: bounded Main Issue #231 (consent placement/first-fold readability only), then later Cookie/Settings styling. Broad homepage redesign stays CLOSED.
- Automation Product Execution `6b07931a698c8191a5a948c912d627ba` and Weekday Product UX QA `6b07931b2678819186ee54c912d627ba` remain enabled with original schedules/IDs and America/Chicago timezone; prompts refreshed to current #241 and #243 heads/checks. Actual last scheduled runs remain Nov 26; prompt updates are not executions; delivery unknown.
- #221 shared limiter Production deployment/binding/HMAC/WAF/restart/429 proof OPEN; #214 independent API Studio Production Pages host/canonical/sitemap/robots/migration/rollback OPEN; #219 final brand/domain clearance/owner selection OPEN. No DNS, custom host or Production account change without owner approval. Keep `https://www.digdevbox.com/api-studio/` transition.
- Browser storage is origin-scoped; masking is not encryption; URL/headers/body pass through first-party Relay. DigImg #41 Windows Runner identity/credential isolation unresolved; never execute arbitrary PR code on Administrator runner. Stop low-sample GSC/AdSense polling; retain technical release gates only.
### Latest portfolio methods and cross-session memory

- Competitor review: `research/API_STUDIO_COMPETITOR_AND_VISUAL_SYSTEM_REVIEW_2026-11-27.md`, commit `9be231fac855d054a1d667554fa3b150b6019ac9`; current Hoppscotch, Postman v12, Primer and historically scoped JetBrains evidence.
- Professional terminology/copy standard: `strategy/NINE_SITE_HOME_AND_TOOL_UX_ACCEPTANCE_STANDARD_2026-11-27.md`, commit `87b54fd7005368667197740bb6efaa03b187bb85`. Retain correct technical terminology, briefly define unfamiliar terms at first use; tutorials follow task → steps → expected result → caveats; blog separates sourced facts from analysis.
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
