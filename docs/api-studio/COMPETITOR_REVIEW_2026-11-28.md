# API Studio competitor review — 2026-11-28

## Scope and evidence

Focused workflow review, not a feature-count contest. Public product documentation and release notes checked on 2026-11-28:

- [Hoppscotch feature overview](https://hoppscotch.com/features): presents History alongside Collections & Folders, Environment Variables, pre-request scripts and post-request tests. The broader product also highlights collaboration, workspaces and self-hosting.
- [Postman request basics (current v12 docs)](https://learning.postman.com/latest-v-12/docs/use/send-requests/create-requests/request-basics): explicitly places previously sent requests in History and supports sending them again; requests can also be saved and organized in collections.
- [Postman navigation and History](https://learning.postman.com/docs/getting-started/basics/navigating-postman): History is a sidebar surface; opening an entry restores it in a new tab. The docs distinguish individual request history from summarized collection-run history, and document removing a row and clearing all history. Signed-in Postman history can sync across devices; that is not a default to copy into a no-account browser tool.
- [Bruno changelog](https://www.usebruno.com/changelog) and [v4.4.0 release](https://github.com/usebruno/bruno/releases/tag/v4.4.0), dated 2026-11-24: current work includes stronger secret-field handling and warnings, external secret-manager support, OpenAPI collection sync, and Runner improvements.

## What matters for API Studio

| Competitor pattern | User value | API Studio decision |
|---|---|---|
| History is reachable next to request work (Hoppscotch/Postman) | Recover a prior request without rebuilding it | Add a compact recent-history surface inside the workspace |
| A prior request can be opened and sent again (Postman) | Iterate on a request configuration | Load as a **new** collection request; never auto-send or silently overwrite the current request |
| Request history is separate from collection-run summaries (Postman) | Individual requests and batch-run reports answer different questions | Keep history limited to explicit single-request Send attempts |
| History can be cleared or individual entries deleted (Postman) | User control and cleanup | Provide Remove per row and Clear all |
| Secret warnings, secret stores and OpenAPI sync are actively developed (Bruno) | Security and spec drift are important developer workflows | Keep OpenAPI import local/preview-first and treat secret redaction as a first-class history rule |
| History syncs across devices in a signed-in Postman account | Convenience across devices | Do not introduce accounts, remote history or telemetry in this product slice |

## Implemented product slice

- Browser-origin storage only; maximum 50 rows and 30-day retention.
- Request template, timestamp, upstream HTTP status when available and elapsed time only.
- Remove credential-like headers, URL userinfo and credential-looking query values before persistence.
- Replace current values of variables marked Secret in URL, remaining headers and body while preserving unresolved variable placeholders.
- Never store response bodies, response headers, raw relay errors or the resolved relay payload.
- Load as a new collection request. The sanitized template is not automatically sent; users re-add stripped credentials and review it.
- Remove and Clear all.
- History is not included in portable backups or Postman/OpenAPI exports. Browser localStorage is not encrypted; unmarked secrets in free-form content may remain.

## Product positioning

Do not chase Postman feature parity or reproduce Bruno's Git-first desktop model. API Studio should win first on a short browser journey: define a request → send → inspect the response → add assertions → save it in a collection → reuse a safe recent request. Keep the light-first/violet product shell and a readable dark request workbench. Keep the actual workspace as the proof point on the product homepage; use task-led storytelling rather than a static feature catalogue. Do not fabricate customer, usage or uptime metrics.
