# API relay shared rate limiting

Status: implementation is merged into main; production enforcement is **not enabled**. The existing Pages app has been redeployed with the compatibility default `API_RELAY_RATE_LIMIT_MODE=local`. The separate Worker, Production Pages binding and HMAC secret have not yet been provisioned.

## Verified implementation state — 2026-11-27

- PR [#229](https://github.com/yqh-core/dev-tools/pull/229) merged as `520b0c590e4db63644e46c58c4048059bfb17ddc`; exact tested PR head `4196d4539689420aad09a9bf5c4f9137235a4e7`.
- Exact-head CI #45949337463, Verify/Build #45949337404 and Cloudflare Pages Preview #140344298121 passed. The Verify/Build run includes the API Studio browser suite (8/8).
- Post-merge Verify/Build #45951010154, Pages Production deployment #140347925376, production smoke #45951299616/job #140347565639 and production homepage visual #140348009009 passed. Mainline CI #45951010048 also completed success. This verifies the existing Pages product deployment path; it does **not** verify or activate the separate Durable Object Worker.
- Production remains in local limiter mode. No Worker deployment, Durable Object binding, HMAC secret, WAF rule, or shared-mode activation is recorded.
- PR [#230](https://github.com/yqh-core/dev-tools/pull/230) merged at 06:29:59 UTC as `187ca67d0175e7fd3154457ba25398a2bb68ed9f` after exact-head CI #45951488033, Verify/Build #45951488099 and Preview #140350024502 all passed. It adds explicit tests for UTF-8 request-header value limits, returned response-header count and the 12-second timeout abort. Post-merge CI #45952236229, Verify/Build #45952236277 and Pages #140350536078 were still in progress at 06:30 UTC; refresh them on the merge commit.

## Exact limits in shared mode

The shared Durable Object enforces limits independently for each visitor IP:

- **30 requests in a rolling 60-second window**.
- **10 requests in any rolling 10-second burst window**.
- **4 in-flight relay requests per IP**.
- Each in-flight lease expires after **20 seconds** if the Pages Function cannot release it. The relay's upstream timeout is 12 seconds.
- Rejected requests return HTTP 429 with a \`Retry-After\` header. Limiter backend or configuration errors return HTTP 503; no upstream request is sent.

This is a per-IP policy, not a global account-wide request cap. Each HMAC-derived IP identity is routed to its own deterministic Durable Object, avoiding one global hot object.

## Data boundary

The Pages Function reads Cloudflare's \`cf-connecting-ip\` header and derives a deterministic HMAC-SHA-256 identity using the secret \`API_RELAY_RATE_LIMIT_HMAC_KEY\`. The raw IP is not sent to the Durable Object or persisted. The DO receives only a random lease ID and the acquire/release operation.

The Durable Object stores only recent timestamps and short-lived lease IDs. It never receives or stores target URLs, request/response bodies, authorization headers, environment values or upstream response data. The existing SSRF validation and body/header/timeout/redirect limits remain in the Pages Function and are not bypassed by the limiter.

## Rollout sequence

The current Pages project is Git-integrated and its existing \`wrangler.toml\` is intentionally not the source of truth for the Pages build output. Do not add a Pages output directory just to configure this binding.

1. Deploy the independent Worker from this directory:

   \`\`\`sh
   pnpm dlx wrangler@4.168.0 deploy --config workers/api-relay-limiter/wrangler.toml
   \`\`\`

2. In Cloudflare Pages > the existing \`coderkit\` project > Settings > Bindings, add a Durable Object binding:
   - Variable name: \`API_RELAY_LIMITER\`
   - Class: \`IpRateLimiter\`
   - Script: \`digdevbox-api-relay-limiter\`

   Pages cannot create/deploy the DO class itself. The Worker must exist before the Pages binding can be saved. Redeploy Pages after adding the binding.

3. Set \`API_RELAY_RATE_LIMIT_HMAC_KEY\` as a Pages secret (at least 32 characters from a cryptographically secure random generator). Do not commit it or put it in a \`vars\` block.

4. Set \`API_RELAY_RATE_LIMIT_MODE=shared\` in the **Production** Pages environment only after the binding and secret are present and verified. The default remains \`local\` for backward-compatible rollout. Shared mode fails closed with HTTP 503 if either dependency is missing or unavailable.

5. Keep Preview in local mode unless a separate Preview Worker/namespace and Preview secret are explicitly configured. Do not share the production IP counters with arbitrary PR previews.

6. Verify the binding with a synthetic non-sensitive request, test 429 and Retry-After, prove two separate Pages isolates using the same test IP share the same counter, and confirm a Worker restart preserves the window/leases. Only then mark the production shared limiter as active.

## Worker bundle validation

CI runs a pinned Wrangler 4.168.0 `deploy --dry-run` against this Worker config. It bundles the Worker and validates the Durable Object class/migration without authenticating or deploying to Cloudflare. This build check is distinct from an actual deploy.

## Local development

Run the Worker and Pages dev server separately:

\`\`\`sh
npx wrangler dev --config workers/api-relay-limiter/wrangler.toml
npx wrangler pages dev dist --do API_RELAY_LIMITER=IpRateLimiter@digdevbox-api-relay-limiter
\`\`\`

For tests, \`tests/workers/api-relay-limiter.test.mjs\` uses a transactional storage fake to verify burst, rolling-window, concurrency, lease-expiry and reconstruction behavior. The Pages Function tests use a fake Durable Object namespace to check HMAC identity, payload separation, fail-closed behavior and release handling.

## Operational limits and cost

- Cloudflare Durable Objects are available on Workers Free and Paid plans; new Free namespaces require SQLite-backed classes. The Free plan includes 100,000 DO requests/day and 100,000 SQLite row writes/day. The relay uses one acquire plus one release DO call per admitted request: a continuously active IP at 30/minute is about 86,400 calls/day before other IPs are counted. State cleanup uses at most one scheduled alarm at a time per IP object (earliest lease/window expiry), adding alarm invocations and writes; estimate actual load from observed active IPs and request patterns before enabling. This is a stress ceiling for one IP, not a traffic forecast.
- Paid pricing and included allocations differ. DO alarms and SQLite row writes count toward usage; storage is persisted until cleanup removes it. Review the current account plan, existing DO usage and spending limits before enabling the production binding. Do not infer the account's current plan or bill from source code. Rotating `API_RELAY_RATE_LIMIT_HMAC_KEY` changes per-IP object IDs and starts a new limiter epoch; old object state remains until its cleanup alarm runs.
- A Cloudflare WAF Rate Limiting Rule on \`/api/apiproxy\` is recommended as an outer cost shield. The Free plan supports one rule, counts by IP, and has a 10-second period; confirm that the zone has an available rule slot. WAF counters are not global across Cloudflare data centres, so this is supplementary protection, not a substitute for the per-IP Durable Object.
- DO per-object throughput is a soft limit, not guaranteed capacity. Per-IP sharding avoids one global bottleneck, but expected peak traffic still needs load testing.

## Release gate

Keep Issue #221 OPEN until:
- the Worker is deployed and the Pages Production binding/secret/mode are verified;
- failure tests prove the relay fails closed before any outbound target fetch;
- cross-isolate, restart, concurrent, burst and rolling-window tests pass on the deployed Worker;
- the WAF outer rule and account spend/usage boundary are reviewed;
- exact-head CI, Verify/Build and Pages Preview checks pass.

No deployment, binding, secret or production mode change is implied by merging code alone.
