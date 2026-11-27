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

### Current mainline and active API Studio UX work — refreshed 2026-11-27 10:47 UTC

- **Current `main`:** `f9d3456fa3f9d91541e3e03d6591a58f380a73f6` (last live ref; this is a handoff documentation commit after feature code base `8f980e5`).
- **PR #239 / Issue #238 — MERGED / CLOSED.** Manual Retry only for Relay/network transport and wrapped upstream 408/425/429/5xx; no auto-replay; local validation/missing vars and ordinary 4xx do not retry. Real upstream status is `payload.status` inside outer HTTP 200. Exact PR CI #45978435773, Verify #45978435709, Preview https://1f83a9fb.coderkit.pages.dev/, main Verify #45980074643, Pages #140442816028, Production smoke #140443283568 and full Chromium CI #45980074381 passed. Retry screenshot artifact #15188229020 inspected 1440×900 and 390×844.

#### P0 — API Studio Issue #240 / PR #241

- [PR #241](https://github.com/yqh-core/dev-tools/pull/241) OPEN; branch `test/api-studio-first-request-journey-20261127`; current exact HEAD `464eab30057d7460942378ae49aecd1d066c3f9c`.
- Product change `src/pages/ApiStudio.page.vue`: persists API Studio's selected environment in `api-studio:selected-environment`. On reload, restores QA if the environment still exists; legacy `api-debugger:env.active` stays Default. This preserves `{{apiVersion}}` variable substitution across reload without mutating API Debugger defaults.
- Continuous E2E `src/api-studio-product/site.e2e.spec.ts`: clean standalone noindex `/app/`, no seeded request/environment, zero Relay calls before explicit Send, UI-based request and QA variable creation, POST/query/header/body, status + JSON assertion, mock Relay 503 then manual Retry to 200, inspect status/body/timing/assertions, reload persistence, Collection Runner and QA variable reuse.
- Retry button 44px minimum with mobile tap/bounding-box/keyboard Enter; guide uses real empty-state CTA and subsequent `+ Request`. The independent app HTML does not load Main consent/GA bootstrap; test asserts no Main consent key/UI and no GA/Tag Manager/Plausible network request.
- Previous head `b7937f` journey failed because the JSON assertion's default operator is `exists`, which correctly hides the Expected field. Current head `5b3002` explicitly changes operator to `equals` before filling `$.id = 42`; product assertion logic was correct. The earlier 1e6abea run passed the continuous journey on retry, but its first attempt sampled document width 1132px immediately after switching to 390px. Current head 5b3002 polls until clientWidth=390 and scrollWidth<=390 (5s) before the final no-overflow assertion; persistent overflow still fails.
- Exact-current-head CI [#45986376590](https://github.com/yqh-core/dev-tools/actions/runs/45986376590), Verify/Build [#45986376634](https://github.com/yqh-core/dev-tools/actions/runs/45986376634), Pages check #latest PR #241 Preview status must be refreshed were IN_PROGRESS at 10:47 UTC (Preview only). Earlier CI #45983612029 on b793 passed but Verify failed; don't use superseded head evidence. Require all same-head checks, complete browser journey and inspect desktop/mobile artifacts before merge.

#### Parallel bounded Main tool-category navigation — Issue #237 / PR #243

- [PR #243](https://github.com/yqh-core/dev-tools/pull/243) OPEN; branch `fix/main-tool-category-first-visit-20261127`; exact current HEAD `3ca77bf82eff9486674fc83b5c5461453fd73f8a`.
- New visitors start with all tool categories collapsed; existing `menu-tool-option:collapsed-categories` preferences remain unchanged; unknown/new category keys default collapsed. Direct tool URL temporarily reveals only its active category, without persisting the route override.
- Native button category control with `aria-expanded`, `aria-controls`, labelled region, visible keyboard focus and 44px min touch target. Main's existing visual style, homepage search, cards and task navigation are preserved.
- `src/components/CollapsibleToolMenu.e2e.spec.ts` covers fresh desktop, ARIA relation, pointer + Enter/Space, saved preference after reload, direct JSON/JWT deep links and home reset, 390×844 touch + no overflow, and captures collapsed/expanded desktop + expanded mobile screenshots.
- **CI coverage correction:** PR #243 CI #45983829533 passed 142 existing tests, but the workflow used an explicit test-file list and did not include the new sidebar spec. Current PR head adds `src/components/CollapsibleToolMenu.e2e.spec.ts` to `.github/workflows/ci.yml` and uploads its `test-results/**/tool-category-*.png` screenshots. The previous 142-pass run is not evidence for #237; only current-head run can validate it.
- Exact current-head CI [#45986226735](https://github.com/yqh-core/dev-tools/actions/runs/45986226735), Verify/Build [#45986226704](https://github.com/yqh-core/dev-tools/actions/runs/45986226704), Pages #latest PR #243 Preview status must be refreshed were IN_PROGRESS at 10:47 UTC (Preview only). Older Verify #45983829639 is superseded by changed workflow; wait for current CI and inspect sidebar screenshots.

#### Homepage / next priorities / safeguards

- Main homepage Issue #231: production artifact #15189740788 inspected. Desktop hero y112–575; cards y627; consent panel y757–884 (720×127) overlaps first row. Mobile hero y120–1196 (1076px), preview y721–1169, consent panel y711–834 (370×123) covers preview; CTA remains visible, no overflow. Evidence https://github.com/yqh-core/dev-tools/issues/231#issuecomment-7215705387. Bounded placement/readability only; preserve Accept/Reject policy, no broad redesign.
- Priority: #241 current-head gates/artifacts first, then #243 current-head E2E/visual artifacts, then #231. Cookie/Settings restyle later. Don't spend time on low-sample GSC/AdSense loops.
- Existing Product Execution `6b07931a698c8191a5a948c912d627ba` and Weekday Product UX QA `6b07931b2678819186ee54e818945c69` remain enabled with original schedules and America/Chicago timezone. Prompt bodies refreshed to #241 head 1e6abea and #243 head c8d269c, exact check IDs above. Latest actual scheduled runs Nov 26; prompt updates are not executions, delivery unknown.
- #221 shared limiter Production deployment/binding/HMAC/WAF/restart/429 evidence OPEN; #214 independent API Studio Production Pages host/canonical/sitemap/robots/migration/rollback OPEN; #219 final brand/domain owner choice OPEN. No DNS/domain/Production changes without approval. Keep `/api-studio/` transition. Browser storage origin-scoped; secret masking is not encryption; request URL/headers/body pass through first-party Relay. DigImg #41 Windows Runner credential isolation remains unresolved; no arbitrary PR code on Administrator runner.
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

The broad DigDevBox Main homepage redesign remains CLOSED. Do not reopen it. Navigation follow-up [PR #243](https://github.com/yqh-core/dev-tools/pull/243) merged at `a739a1dee9613391eec8d4156202a0bc97127929`; Issue #237 is CLOSED. Fresh visitors now see tool-category groups collapsed, while saved preferences, direct-tool navigation, keyboard operation and mobile controls remain supported. The bounded homepage first-fold/consent overlap remains open as [Issue #231](https://github.com/yqh-core/dev-tools/issues/231); this is not a broad redesign. Cookie/Settings visual restyling is a separate later task. API Studio's dedicated product landing page remains separate and must preserve the Main site's own identity.

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


### Exact-head recheck note — 2026-11-27 (current continuation)

- **Main navigation PR #243 / Issue #237:** MERGED as `a739a1dee9613391eec8d4156202a0bc97127929`. Exact pre-merge CI #45991147054 and Verify/Build #45991146995 succeeded on PR head `1a8df6fb7c2b32c154a2a28a127be7fb489fe390`; Preview https://474ee973.coderkit.pages.dev/. Screenshot artifact #15194530585 was reviewed at desktop and 390px mobile. Main post-merge Verify #45992244063 succeeded; main CI #45992243976 and deployment-linked smoke/crawl were still being checked at the latest recorded status. Issue #237 is CLOSED.
- **API Studio PR #241 / Issue #240:** OPEN; branch `test/api-studio-first-request-journey-20261127`; current head `0c46f69107560eacfda7bae4972e11dd3065227f`. The earlier `49ebc33` head passed Lint, unit tests and typecheck but Verify's first-use journey failed only at the mobile Retry hit-test. The Playwright trace showed the test had already received a 200 response, passed 2/2 assertions, reloaded the saved request/environment and completed a Collection Runner run. The failing hit-test mixed the locator's frame-relative bounding box with `elementFromPoint()` viewport coordinates after scrolling. Commit `0c46f69` now derives the hit point directly from the button's DOM `getBoundingClientRect()`; the 44px mobile target and hit-test remain mandatory.
- **Current exact-head gates for #241:** CI [#45992743233](https://github.com/yqh-core/dev-tools/actions/runs/45992743233) and Verify/Build [#45992743375](https://github.com/yqh-core/dev-tools/actions/runs/45992743375) were IN_PROGRESS at the latest poll. Cloudflare Pages Preview for `0c46f69` was BUILD IN PROGRESS. No merge or production claim until those exact-head gates and screenshot review pass.
- **Main merge follow-up:** Verify #45992244063 PASS on `a739a1d`; CI #45992243976 was still in the Chromium E2E step. Production crawl #45992511562 PASS; post-deploy smoke #45992581663 and a second crawl #45992581732 were still IN_PROGRESS. Refresh those runs before marking production verification complete.
- **Next homepage task:** Issue #231 is queued after #241. The current baseline has a 1,076px mobile hero at 390×844; consent overlaps the preview on mobile and the first card row on desktop. Keep this change tightly scoped to hero/consent first-fold placement. The broad homepage redesign remains closed.
- **Long-term portfolio/UX method:** use `NINE_SITE_HOME_AND_TOOL_UX_ACCEPTANCE_STANDARD_2026-11-27.md` v1.1 and the execution board. Each original site keeps its own art direction. API Studio is the tenth independent product; its selected brand/domain (#219), separate Production Pages/host/migration (#214) and shared relay enforcement (#221) remain separate gates. The previously explored subdomain option is superseded by the owner decision requiring a separate registrable primary domain.

### Exact-head continuation update — 2026-11-27 11:56 UTC

- PR #241 current head 2284f401d8498dea049b801bd0c1b65143ec2483. Verify/Build #45994003220 SUCCESS (separate product build, Chromium journey, output checks, visual artifacts). CI #45994003286 still IN_PROGRESS at production build; earlier lint, relay/DO lint, Worker dry-run, unit tests and typecheck passed. Pages Preview still BUILD IN PROGRESS. Do not merge before every gate.
- Product defect: .api-mini-action defaulted to 28px, Retry inherited the undersized target. PR sets .api-error-retry min-height 44px on mobile while leaving utility controls compact. Current browser journey passes 503 → manual Retry → 200 OK, 2/2 assertions, persisted request/environment, Collection Runner and keyboard send. Artifact #15195511539 inspected.
- PR #240 comment #7217653167 records exact evidence. Issue #231 comment #7217588490 records measured Main geometry and bounded UX plan.
- Main PR #243 merged; #237 closed. Follow-up doc commit 247fa78 Verify passed; current main CI and deploy smoke/crawl still need refreshed status.

### Current continuation override — 2026-11-27 ~12:07 UTC

Older #241 failure/IN_PROGRESS notes above are historical and superseded by this update.

- API Studio PR #241 MERGED as `91cadeac03f6a10556a823927c20b8b60e928575`; Issue #240 auto-closed. Exact-head CI #45994003286, Verify/Build #45994003220 and Cloudflare Preview all PASS. Merge-SHA Verify #45995130660 PASS, main Pages deployment check PASS, smoke #45995248568 PASS. Main CI #45995130686 was still running targeted E2E; smoke #45995642782 and crawl #45995248793 still in progress/queued.
- API Studio mobile Retry product defect was 28px inherited minimum; fixed to 44px for `.api-error-retry` only. Screenshot artifact #15195511539 reviewed: 503, retry to 200 OK, 2/2 assertions, keyboard path.
- Next active bounded Main task: Issue #231 / draft PR #244, branch `feat/homepage-first-fold-consent-20261127`, exact head `707534f17a6273d3148f6ebb3733713abdfed53f`. Current CI #45995824554, Verify #45995824340 IN_PROGRESS at ~12:07 UTC. PR Preview/visual evidence pending.
- PR #244 changes mobile hero spacing and preview density; only undecided Main homepage consent is in-flow after hero. Other routes keep fixed consent. Accept/Reject, `digdevbox.analytics-consent.v1`, default-denied GA behavior and Privacy choices reopening remain. No relay/Worker/Cloudflare account changes.
- Issue #231 comment #7217588490 has measurements and scope; comment #7217856270 has implementation detail. Do not merge until exact-head CI/Verify/Preview and visual screenshot acceptance all pass.
- Issue #221 remains OPEN; shared production limiter not enabled. API Studio brand/domain #219 and separate Pages host/migration #214 remain separate gates.
### Current Main homepage PR — 2026-11-27 (latest exact head)

- Draft PR #244 / Issue #231 current head `6553b4160a5ed8e9236d44a82c5c097b4dd5ae45`.
- Earlier head `110745c` reached browser E2E; one test measured the mobile inline consent panel at 157px vs the ≤150px acceptance cap. The rest of that browser suite passed. Unit tests also reported queued observer callbacks against disposed jsdom state.
- Current head reduces inline mobile consent copy size, padding, gaps and margins while keeping both buttons at 44px; observer now disconnects when its captured document/window is disposed/replaced. It also adds a SPA navigation home→tools placement test.
- CI #45998083617 and Verify/Build #45998083508 are pending/in progress; exact-head Preview pending. Earlier SHA preview/status must not be substituted. Do not merge until exact-head browser tests, all workflows, preview, and screenshots pass.
- API Studio PR #241 and Main nav PR #243 remain merged and verified as recorded above.
