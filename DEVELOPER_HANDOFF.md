## API Studio — current developer handoff — 2026-11-28 12:43 UTC

- PR #279 merged at `f518533ccb81259164a8d1653692ed3b725ed5fd`; #278 closed. Exact-head CI #46145018949, Verify #46145019094 and shared Pages Preview #140978967074 passed. Artifact #15263352196 inspected (1440×900 and 390×844).
- Merge-SHA workflows now in progress: CI #46145737482, Verify #46145737448, Cloudflare Pages #140981280160; detect-site-changes, repository production-smoke and production-homepage-visual succeeded. This is not separate-host production acceptance.
- Active PR #282 / Issue #281: https://github.com/yqh-core/dev-tools/pull/282, branch `feat/main-api-studio-primary-flagship-20261128`, HEAD `ee005ddfa4f74a15ee4582ebd667584a87667a42`. API card primary route changed to `/api-studio/`, old API Debugger is secondary and localized en/zh; Hero CTA unchanged. E2E updates keyboard destination and checks legacy route. CI #46145884418, Verify #46145884392, Pages #140981680107 were in progress at checkpoint.
- Next Issue #280: safe local OpenAPI spec refresh/sync (provenance, preview diff, preserve local values by default, explicit conflicts, no silent removals or auto-sends). Source model and technical findings are in Issue #280.
- Product baseline and current competitor positioning stay as in the previous handoff: no-account useful core, team/server-side paid differentiation only after infrastructure/security/support exist.
- Separate product host remains unverified at `https://apistudio.digdevbox.com`; #214 is independent hosting gate, #221 Relay hardening, #219 name screening. Shared Pages preview is not independent host release.
- Do not parallelize more code PRs until #282 finishes; after #282 merges and post-merge checks pass, begin Issue #280 (unless a production gate is actively blocked).

---

## API Studio — latest handoff — 2026-11-28 12:42 UTC

- PR #279 `https://github.com/yqh-core/dev-tools/pull/279`, exact head `bd27a3c4672d60e2e8ac909cad60d55b6d724218`: Verify/Build #46145019094 SUCCESS; Cloudflare Pages #140978967074 SUCCESS (“Deployed successfully” for shared coderkit Pages preview). Main CI #46145018949 has all substantive tests through targeted Chromium E2E SUCCESS; workflow was still running non-blocking screenshot uploads at this checkpoint. Do not claim CI final success until its workflow conclusion is complete.
- Visual artifact #15263352196 inspected at desktop 1440×900 and mobile 390×844. Helper/privacy copy readable; main task CTA remains clear; no obvious mobile width issue.
- Main acquisition gap: five flagship card layout already exists, and Hero links to `/api-studio`, but API card primaryPath remains `/api-debugger`; Studio is currently a secondary API-card link. Issue #281 tracks promoting API Studio to primary API card action, retaining the old debugger deliberately as secondary.
- Next product slice Issue #280: local OpenAPI spec refresh with preview diff, preserve user edits, conflict resolution, no silent delete or auto-send.
- Existing merged baseline: Request/response editor; collections/folders; environments; assertions; runner/report; Postman v2.1 interchange; portable backup/restore; first-use journey; OpenAPI 3.x import (#275); private bounded request history (#277).
- Independent target host `https://apistudio.digdevbox.com` is not verified live. Issue #214, Relay production security #221, and descriptive name risk #219 are separate launch tracks. Shared coderkit Preview success does not satisfy independent-host production acceptance.
- Competitor evidence latest 2026-11-28: Hoppscotch v2026.11.0, Bruno v4.4.0 and Postman lifecycle/Git/CI/agent workflows are recorded in `docs/api-studio/COMPETITOR_REVIEW_2026-11-28.md`. User-value focus: no-account individual path first; charge only for real team/server-side value after implementation/security/support exist.
- After core flows and host acceptance, create a 45–60 second captioned product walkthrough, not a fake live demo. The current homepage preview uses deterministic fixtures and must say so; no autoplay/sound dependence.
- Automation audit remains as previously recorded: Product Execution actual run failed with a stale DigImg result mismatch; Weekday UX QA ran Main ETA Calculator #250, not API Studio; SEO Growth Review absent from live peek (existence unknown).

---

## API Studio — verification update — 2026-11-28 12:40 UTC

- PR #279 exact HEAD remains `bd27a3c4672d60e2e8ac909cad60d55b6d724218`.
- Verify run #46145019094 is **SUCCESS**. Types/build, independent `build:api-studio`, Chromium API Studio product E2E, product artifact validation and screenshot artifact upload all passed.
- Visual artifact #15263352196 was opened and checked: desktop 1440×900 and mobile 390×844 Request History/helper text is readable; first-request hierarchy remains clear and the mobile workspace does not show a visual horizontal squeeze. The PR's dedicated mobile overflow assertion is still in the main CI workflow.
- CI #46145018949 has passed Lint, Relay lint, Durable Object bundle, unit tests, typecheck and main build; it is currently at Chromium installation before the targeted E2E suite (which includes `src/tools/api-debugger/api-studio.e2e.ts`).
- Cloudflare Pages check #140978967074 remains IN_PROGRESS. No merge has been performed. Wait for exact-head CI and Pages to finish; recheck PR mergeability and branch HEAD immediately before merge.
- Next issue is #280 OpenAPI safe refresh/sync; source-code discovery is recorded in that issue's technical comment.

---

## API Studio — current handoff — 2026-11-28 12:35 UTC

- Current main at checkpoint: `1f25365ec334fa5586e8bc87a5589ad6172c0740` (documentation-only update after PR #277 merge).
- **PR #277 merged**: https://github.com/yqh-core/dev-tools/pull/277; merge SHA `d766acd2e7666f244cfaf658b8cc7ecced9e8fe3`. Merge-SHA CI #46142185638 SUCCESS, Verify/Build #46142185650 SUCCESS and shared coderkit Pages check #140971240637 SUCCESS. The Pages URL is `https://c103aba3.coderkit.pages.dev`; it does not establish that `apistudio.digdevbox.com` is live.
- **Current PR #279 / Issue #278**: https://github.com/yqh-core/dev-tools/pull/279. Branch `fix/api-studio-helper-readability-20261128`, exact HEAD `bd27a3c4672d60e2e8ac909cad60d55b6d724218`. Changed `src/pages/ApiStudio.page.vue` and `src/tools/api-debugger/api-studio.e2e.ts`; workspace helper hints now use theme-aware soft text at 12px and 1.5 line-height; Chromium test checks computed light theme style and 390px overflow. At checkpoint CI #46145018949 and Verify #46145019094 were not both terminal success; Pages #140978967074 was in progress. Wait for exact-head checks and inspect screenshots before merge.
- **Next queued Issue #280**: safe local OpenAPI spec refresh/sync for existing imported collections: preview added/changed/removed operations, preserve manual values and organization by default, explicit conflict decisions, no auto-send, backward-compatible import/export/backup.
- Product baseline already merged: request/response engine, collections/folders, environments, assertions, runner/reporting, Postman v2.1 interchange, portable backup/restore, guided first-use journey, OpenAPI 3.x import (#275), private bounded Request History (#277).
- Owner-approved product name/host: API Studio — by DigDevBox; `https://apistudio.digdevbox.com`; routes /, /app/, /docs/. Keep `https://www.digdevbox.com/api-studio/` fallback. Independent deployment remains issue #214; do not claim host is production until separate Pages project, DNS/TLS, canonical/robots/sitemap, deep-route, origin/storage migration, Relay and rollback/smoke acceptance pass.
- Relay issue #221 remains open: Production shared mode is not confirmed enabled. Do not activate before the account-side Worker/DO binding, HMAC secret, WAF, cross-isolate/restart and fail-closed verification are done. Name collision screen #219 remains preliminary; no legal clearance claim.
- Automation IDs/status: API Product Execution `6b07931a698c8191a5a948c912d627ba` enabled daily but Nov 27 actual run failed with stale DigImg result-ID mismatch; cause/output/delivery unknown. Weekday UX QA `6b07931b2678819186ee54e818945c69` completed Nov 27 Main ETA Calculator #250, not API Studio. SEO Growth Review absent from live peek; state unknown.
- Competitor sources current as of 2026-11-28: Hoppscotch v2026.11.0, Bruno v4.4.0 and Postman product/lifecycle; see `docs/api-studio/COMPETITOR_REVIEW_2026-11-28.md`.

---

## API Studio — current handoff — 2026-11-28 11:57 UTC

- Owner-approved product identity: **API Studio — by DigDevBox**, target `https://apistudio.digdevbox.com`, on the existing DigDevBox parent domain. Product routes: `/`, `/app/`, `/docs/`. A separate registrable domain is not required. Keep `https://www.digdevbox.com/api-studio/` as fallback until the independent-host acceptance gates pass.
- **PR #277 merged**: https://github.com/yqh-core/dev-tools/pull/277. Issue #276 is closed. Merge SHA: `d766acd2e7666f244cfaf658b8cc7ecced9e8fe3`; feature head `0d5e0a4f522a2dc858adcb646efb85bd823952b1`.
- Exact-head feature checks all passed: CI #46141634079, Verify/Build #46141634110, Cloudflare Preview SUCCESS. Verify included product build, browser acceptance, screenshots and artifact validation. Main CI included lint, Worker checks, unit tests, types/build and the main Chromium regression suite.
- **Post-merge checks still running at this checkpoint:** merge-SHA CI #46142185638, Verify/Build #46142185650 and Cloudflare Pages deployment check. Do not mark Production Verified until all merge-SHA checks and post-deploy Smoke/route/Relay checks finish.
- Request History: Studio-owned browser localStorage, max 50 entries, 30-day retention, newest first, single Send attempts only. Stores a sanitized request template, timestamp, upstream status if available and elapsed time. Removes credential-like headers, URL userinfo and sensitive query values, redacts current marked Secret values and preserves unresolved `{{variable}}` tokens. Does not store response bodies/headers, resolved Relay payload or raw Relay errors. Load as a new request; no auto-send. Remove/Clear all. LocalStorage is not encrypted; unmarked free-form secrets may remain; history is excluded from portable backup and Postman/OpenAPI interchange.
- Verified screenshots were inspected at 1440×900 and 390×844. Homepage CTA/first-fold and four-stage deterministic demo are good. Workspace helper text (including history privacy copy) needs a contrast/readability refinement. Visual QA and competitor/commercial strategy are recorded in design-system repo:
  - `strategy/SITE_PRODUCT_IMPROVEMENT_METHOD_v1.md`
  - `strategy/API_STUDIO_COMPETITOR_AND_COMMERCIAL_POSITIONING_2026-11-28.md`
  - `ops/visual-qa/API_STUDIO_VISUAL_QA_2026-11-28.md`
- Independent launch blockers: #214 host project/custom-domain/canonical/robots/sitemap/deep-link/Relay/origin-storage/redirect/rollback; #219 source-backed descriptive-name collision screening; #221 Production Relay Worker/DO/HMAC/WAF/cross-isolate/restart/fail-closed.
- Scheduled tasks: API Studio Product Execution ID `6b07931a698c8191a5a948c912d627ba` remains enabled daily flexible America/Chicago; actual Nov 27 run failed and surfaced output is stale Nov 26 DigImg material; failure cause/output/delivery UNKNOWN. Weekday Product UX QA ID `6b07931b2678819186ee54e818945c69` remains enabled weekdays flexible America/Chicago; latest matching Nov 27 run was Main ETA Calculator #250, not API Studio. Weekly SEO Growth Review did not surface; existence/deletion UNKNOWN. No automation was triggered or rescheduled.
- **Next action:** complete merge-SHA CI/Verify/Pages and post-deploy Smoke; then continue #214/#221 without bypassing account controls. Next product iteration: workspace helper-text contrast; then review API Studio homepage demo/recovery story separately from DigDevBox Main homepage PR #258. Preserve existing Main tool-recommendation backlog and its own sequence.

---

## API Studio — merged OpenAPI import handoff — 2026-11-28 10:08 UTC

- **Merged change:** PR [#275](https://github.com/yqh-core/dev-tools/pull/275) merged at 2026-11-28 10:02:33 UTC; issue [#274](https://github.com/yqh-core/dev-tools/issues/274) closed. Main and merge SHA: `0d525b1037a62aead7c145cf9ce62d126c4d9fdc`.
- **Pre-merge gates on exact feature SHA `d415ce04f0c99a9d1b54e5a62bfdbb8d04c45cdc`:** CI #46132511855 SUCCESS; independent Verify #46132511846 SUCCESS; Cloudflare PR Preview check #140940698696 SUCCESS at `https://3e55fd69.coderkit.pages.dev`.
- **Post-merge gates on exact main SHA `0d525b1`:** Verify #46133266604 SUCCESS. Push CI #46133266582 currently IN_PROGRESS at the final Main build step; Lint, relay/DO lint+bundle, all unit tests and typecheck have passed and no failed step is reported.
- **Main Pages deployment:** Cloudflare Pages `build` check #140942912415 was created at merge and initially reported Building. The final Cloudflare check-run result is not exposed through the available GitHub status interface at this checkpoint. Browser retrieval could not load `https://www.digdevbox.com/api-studio/`; therefore do not claim successful Main Pages deployment or Production smoke until separately verified.
- **Feature:** guided OpenAPI 3.x JSON/YAML import with local preview, global server selection, path/query/header/server variables, collection/folder destination, first 20 operations, explicit compatibility notes, 2 MB cap and skip/replace-all/append conflict policy. Import is local-only, makes no relay/send/network calls, does not fetch/resolve remote `$ref`, and persists once only after a complete successful draft. Postman v2.1 and backup formats unchanged.
- **Visual evidence:** exact feature artifact #15258052701 was manually inspected. Homepage first fold and desktop preview/folder import at 1440px; mobile OpenAPI action-state at 390×844 shows scroll-reachable server/destination, operation list, Cancel and Import. Replace-all test removed two duplicates and left one endpoint.
- **Commercial launch gates unchanged:** #219 final brand/domain and trademark/RDAP clearance; #214 separate Pages Production project/domain/canonical/SEO/migration/rollback; #221 Production shared Relay Worker/DO/HMAC/WAF/cross-isolate/restart/fail-closed. Keep `/api-studio/` fallback. No DNS/domain purchase, production secret, Worker/DO binding or relay mode setting changed.
- **Next action:** finish #46133266582; resolve Main Pages check/Production smoke with an authoritative reachable source. Only then progress the separate domain launch gates. Next useful feature candidate is Request History only after its Studio-owned retention, secret-redaction and backup-versioning model is defined.
- **Automation:** Product Execution ID `6b07931a698c8191a5a948c912d627ba` remains enabled daily flexible/America-Chicago; prompt updated, not run. Actual last run failed and surfaced prior-day DigImg result is stale. UX QA task unchanged; last completed run was unrelated ETA Calculator #250.

---
## LIVE API STUDIO HANDOFF — 2026-11-28 09:34 UTC

- **Current implementation repo/main:** [yqh-core/dev-tools](https://github.com/yqh-core/dev-tools), exact current main SHA c017c50209caa057e0445ecc23fe1a30d0ae2e36.
- **Most recent merged feature:** [PR #273](https://github.com/yqh-core/dev-tools/pull/273) verifies the Pages API relay path against the actual shared-limiter handler with burst 429/Retry-After, HMAC per-IP buckets/isolation and fail-closed 503-before-upstream behavior. Exact-head CI #46129940553 and Verify/Build #46129940559 passed; exact-head Preview https://1cb635d5.coderkit.pages.dev succeeded. This PR changes tests, not production configuration.
- **Release evidence boundary:** the merge commit has no recorded post-merge push workflow/status result in the available GitHub response (commit status returned pending with zero contexts). Do not infer a new Main Pages deployment or Production verification from green PR checks. PR #270's earlier visual feature and Main release gates did pass; the independent API Studio hostname has not launched.
- **Visual/product direction shipped:** #270/#269 replaced marketing/docs with a light-neutral canvas, readable dark typography and coordinated violet interaction states; the actual request/response workbench, code and product demo remain dark for developer readability. 1440×900 and 390×844 screenshots were reviewed, including no-overflow and fixture-label checks. #272 aligned documentation browser theme metadata.
- **Core workspace already delivered:** single-request editing/Send/response inspection, structured assertions, environment/collection/global variables, manual retry (no automatic replay), collection-run progress/cancel/per-request reports, Postman v2.1 import/export, validated portable backup/restore, first-use request journey, dedicated product homepage/docs/build output and responsive workspace. #213/#220/#222 are closed; do not reopen or rebuild these completed slices.
- **New next engineering slice:** [Issue #274 — guided OpenAPI 3.x import](https://github.com/yqh-core/dev-tools/issues/274). Reuse src/tools/api-debugger/openapi.ts and collection-tree helpers; add preview, destination/server choice, explicit conflict handling, compatibility warnings and desktop/mobile E2E. No network/relay calls during import. This is an issue/acceptance plan, not code shipped yet.
- **Commercial product positioning:** compete first on a focused, fast, no-signup browser workflow for individuals/small projects—not broad enterprise parity. Preserve browser-origin-local collections/environments, transparent first-party relay disclosure and user-controlled export. Defer accounts/team collaboration/cloud sync/monitoring/SSO/billing until independent launch, security and demand evidence justify them. Potential future paid value is collaboration, hosted sync, scheduled/CI runs and governance—not gating the current core workflow.
- **Independent launch gates:** #219 name/domain still unselected and uncleared; #221 shared limiter code/tests exist but Production still uses API_RELAY_RATE_LIMIT_MODE=local, and Worker/DO binding/HMAC/WAF/cross-isolate restart proof still require Cloudflare account-side setup; #214 second Production Pages project, selected registrable host, host-specific canonical/robots/sitemap, URL mapping and cutover/rollback remain open. #220 backup/restore and #222 collection-run UX are closed. Keep /api-studio/ as the reversible old-origin entry. No domain purchase, DNS, account secret, production binding or Production relay-mode change is authorized by code-level approval alone.
- **Automation prompt refresh (2026-11-28 09:36:51 UTC):** API Studio Product Execution prompt was aligned to Issue #274 and the current evidence-led workflow. The existing task ID, daily flexible America/Chicago schedule, and enabled state were preserved; no run was triggered.
- **Scheduled-task reconciliation:** API Studio Product Execution 6b07931a698c8191a5a948c912d627ba remains enabled, daily flexible, America/Chicago. Actual last run 41bb4e78-aabc-8324-bc7e-71e431dbbc0f (2026-11-27) is recorded FAILED. Surfaced result dc61c254-6270-8332-a315-da77675202f1 is stale 2026-11-26 DigImg output and must not be credited to that failed run; cause/output/delivery remain UNKNOWN. Weekday Product UX QA 6b07931b2678819186ee54e818945c69 remains enabled, Mon–Fri flexible; its matching completed run e7fcdae2-5814-8329-9901-01c6c9be6b2f covered ETA Calculator #250, not this API Studio release. Neither task was manually triggered; IDs, schedules and enabled states were not changed.
- **Reusable execution method:** source-backed competitor teardown → product/job positioning → inspect reusable implementation and data/security boundaries → one bounded issue with explicit non-goals → implementation reusing existing engines → exact-head lint/unit/type/build/E2E → keyboard/accessibility + 1440×900 and 390×844 screenshot review → Preview → merge only when every exact-head gate passes → merge-SHA checks → separately verified Production smoke → update this handoff, START_HERE, control board, product plan, competitor review and dated evidence log. Label OBSERVED / SOURCE-VERIFIED / MEASURED / INFERENCE / UNKNOWN separately.
- **Next action:** implement #274 on a fresh branch after rechecking live main/issue/PR/check state; do not start a competing PR. In parallel, progress public evidence for #219 without registering/selecting a domain. Do not represent Preview as Production.

---
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

### Latest PR #244 status — 2026-11-27 ~12:38 UTC

- Current exact branch head `7d431b414a8d92bb113eb455c600796533ec4a80`; PR #244 draft/open. CI #46000300303, Verify #46000300487 and Cloudflare Pages Preview are IN_PROGRESS. Latest CI Lint, relay/DO lint, worker dry-run and unit tests passed; typecheck in progress. Verify example coverage/crawler self-check passed; typecheck/build in progress. Do not merge until exact-head gates and final screenshots pass.
- Latest branch includes: mobile hero density/fully-visible preview CTA geometry test; inline homepage consent with SPA route transitions and preserved Reject/Accept behavior; privacy disclosure correction in EN/ZH differentiating local processing, API relay and external lookups. E2E checks privacy statements.
- PR #244 comment #7218518644 records the privacy copy correction.
- Long-term content/copy standard: `PRODUCT_UX_EXECUTION_PLAYBOOK.md` v1.6 (ten-product terminology/tutorial/blog voice); API Studio delivery roadmap reconciled and competitive review updated so shipped PR #223 Runner is not misrepresented as pending.
- Current homepage recommendations already comprise five task groups (API, JSON/Data, JWT/Auth, Calculate/Convert, Network). Next task after merge: audit these and the actual tool pages for technical accuracy, short useful instructions, examples and caveats; no duplicate recommendation section.
- PRs #223, #241, #243 merged; related #222/#240/#237 closed. #221/#214/#219 remain owner/production gates.

### Current PR #244 exact-head override — 2026-11-27 ~13:01 UTC

- Current head `09a229fdceba615ba1be5eaf6266a08d73d31a7f`. CI #46003470631: Lint + Relay/Worker lint/bundle PASS; unit tests running. Verify #46003470618: example and crawler checks PASS; typecheck/build running. Exact current-head Preview in progress at dashboard b947f587-18c6-420a-9ca1-fc4c0a8ec3f8. No merge until all exact-head checks pass and updated screenshots are reviewed.
- `3fbcafe` CI was blocked only by a single double-quoted `localStorage` string in `src/pages/home-task-discovery.e2e.spec.ts`; `09a229f` fixes the quote style.
- Current branch now also clarifies hero/speed claims around local vs network-backed tasks, and adds an explicit browser `localStorage` (not encrypted storage) disclosure for API Debugger history and API Studio collections/environment values. EN/ZH copy and Playwright assertions are updated.
- Predecessor head `ab141fa` CI/Verify/Preview were all successful; visual artifact #15198632896 inspected. Current head requires new exact-head tests and screenshots.

### Latest continuation state — 2026-11-27 ~13:31 UTC

- Main homepage PR #244 MERGED as `6e09284c776c5fc4092a4965208824c6f1054ed9`; #231 closed. Main CI #46006150244 and Verify #46006150115 PASS; post-deploy smoke #46006594441 PASS. Exact production homepage visual run #140534778835 still running; all-site crawl #46006594388 deployment wait passed, DigImg done, Main/IP crawling, lower-priority site crawls queued.
- Active PR #245 draft head `79249126892be5db4661dfa7cf465da28f32b6e1`. Verify/Build #46007145754 SUCCESS. CI #46007145620 Lint/Worker/unit tests/typecheck PASS; main build running. Unit test failures from previous head `3b30b26` have been fixed by updating Chinese wording assertion and replacing brittle hard-coded API guide step/FAQ counts with capability and EN/ZH parity checks. No merge until CI success.
- PR #245 guide corrects supported `pm.*` subset, CSV/JSON data file semantics, data sent through relay when used in requests, storage/secret limits and unsupported methods. No runtime feature changes.
- After #245: audit Main's five existing flagship groups and target pages, starting with JSON/structured data, then JWT, calculations, HTTP/network.
- Scheduler remains enabled; last actual run records still Nov26 at 13:26 live peek; no Nov27 execution claimed.
