// Pure request handler for the shared API relay Durable Object.
// Kept separate from the Cloudflare-only entry module so the policy can be
// exercised by Vitest without importing the Workers runtime scheme.

const STATE_KEY = 'rate-limit-state';
const WINDOW_MS = 60_000;
const WINDOW_LIMIT = 30;
const BURST_WINDOW_MS = 10_000;
const BURST_LIMIT = 10;
const MAX_IN_FLIGHT = 4;
const LEASE_TTL_MS = 20_000;
const MAX_REQUEST_BYTES = 256;
const LEASE_ID_RE = /^[A-Za-z0-9_-]{16,80}$/;

function json(data, status = 200, headers = {}) {
  return Response.json(data, {
    status,
    headers: {
      'cache-control': 'no-store',
      ...headers,
    },
  });
}

function retryAfter(seconds, reason) {
  const retryAfterSeconds = Math.max(1, Math.ceil(seconds));
  return {
    allowed: false,
    reason,
    retryAfterSeconds,
  };
}

async function ensureCleanupAlarm(storage, now) {
  const existing = await storage.getAlarm();
  if (existing === null || existing <= now) {
    await storage.setAlarm(now + WINDOW_MS);
  }
}

function readState(value) {
  if (value === undefined) {
    return { timestamps: [], leases: [] };
  }
  if (!value || !Array.isArray(value.timestamps) || !Array.isArray(value.leases)) {
    return null;
  }
  if (!value.timestamps.every(Number.isSafeInteger)) {
    return null;
  }
  if (!value.leases.every(lease =>
    lease
    && typeof lease.id === 'string'
    && Number.isSafeInteger(lease.expiresAt),
  )) {
    return null;
  }
  return {
    timestamps: value.timestamps,
    leases: value.leases,
  };
}

export async function handleRateLimitRequest(storage, request) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405, { allow: 'POST' });
  }

  const path = new URL(request.url).pathname;
  if (path !== '/acquire' && path !== '/release') {
    return json({ error: 'Not found.' }, 404);
  }

  const contentLength = request.headers.get('content-length');
  if (contentLength !== null && (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_REQUEST_BYTES)) {
    return json({ error: 'Invalid limiter request.' }, 400);
  }

  let raw;
  try {
    raw = await request.text();
  }
  catch {
    return json({ error: 'Invalid limiter request.' }, 400);
  }
  if (new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) {
    return json({ error: 'Invalid limiter request.' }, 400);
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  }
  catch {
    return json({ error: 'Invalid limiter request.' }, 400);
  }

  if (
    !payload
    || typeof payload !== 'object'
    || Array.isArray(payload)
    || Object.keys(payload).length !== 1
    || typeof payload.leaseId !== 'string'
    || !LEASE_ID_RE.test(payload.leaseId)
  ) {
    return json({ error: 'Invalid limiter request.' }, 400);
  }

  try {
    const decision = await storage.transaction(async () => {
      const stored = readState(await storage.get(STATE_KEY));
      if (!stored) {
        return { status: 503, body: { allowed: false, reason: 'state_unavailable' } };
      }

      const now = Date.now();
      const timestamps = stored.timestamps.filter(timestamp =>
        timestamp > now - WINDOW_MS && timestamp <= now,
      );
      const leases = stored.leases.filter(lease => lease.expiresAt > now);

      if (path === '/release') {
        const nextLeases = leases.filter(lease => lease.id !== payload.leaseId);
        if (timestamps.length !== stored.timestamps.length || nextLeases.length !== stored.leases.length) {
          await storage.put(STATE_KEY, { timestamps, leases: nextLeases });
        }
        return { status: 200, body: { released: true } };
      }

      if (leases.some(lease => lease.id === payload.leaseId)) {
        return { status: 200, body: { allowed: true } };
      }

      if (timestamps.length >= WINDOW_LIMIT) {
        const retry = (timestamps[0] + WINDOW_MS - now) / 1000;
        await storage.put(STATE_KEY, { timestamps, leases });
        await ensureCleanupAlarm(storage, now);
        return { status: 429, body: retryAfter(retry, 'window') };
      }

      const burstTimestamps = timestamps.filter(timestamp => timestamp > now - BURST_WINDOW_MS);
      if (burstTimestamps.length >= BURST_LIMIT) {
        const retry = (burstTimestamps[0] + BURST_WINDOW_MS - now) / 1000;
        await txn.put(STATE_KEY, { timestamps, leases });
        return { status: 429, body: retryAfter(retry, 'burst') };
      }

      timestamps.push(now);

      if (leases.length >= MAX_IN_FLIGHT) {
        const earliestExpiry = Math.min(...leases.map(lease => lease.expiresAt));
        await txn.put(STATE_KEY, { timestamps, leases });
        return {
          status: 429,
          body: retryAfter((earliestExpiry - now) / 1000, 'concurrency'),
        };
      }

      leases.push({ id: payload.leaseId, expiresAt: now + LEASE_TTL_MS });
      await txn.put(STATE_KEY, { timestamps, leases });
      return { status: 200, body: { allowed: true } };
    });

    return json(decision.body, decision.status, decision.body.retryAfterSeconds
      ? { 'retry-after': String(decision.body.retryAfterSeconds) }
      : {});
  }
  catch {
    return json({ allowed: false, reason: 'limiter_unavailable' }, 503);
  }
}

/**
 * Remove dormant per-IP state once its rate window and all concurrency leases
 * have expired. One alarm is armed when a DO first becomes active and then
 * rescheduled only by alarm execution, not by each incoming request.
 */
export async function cleanupRateLimitState(storage) {
  await storage.transaction(async () => {
    const stored = readState(await storage.get(STATE_KEY));
    const now = Date.now();

    if (!stored) {
      await storage.setAlarm(now + WINDOW_MS);
      return;
    }

    const timestamps = stored.timestamps.filter(timestamp =>
      timestamp > now - WINDOW_MS && timestamp <= now,
    );
    const leases = stored.leases.filter(lease => lease.expiresAt > now);

    if (timestamps.length === 0 && leases.length === 0) {
      await storage.deleteAll();
      return;
    }

    await storage.put(STATE_KEY, { timestamps, leases });
    const expirations = [
      ...timestamps.map(timestamp => timestamp + WINDOW_MS),
      ...leases.map(lease => lease.expiresAt),
    ];
    await storage.setAlarm(Math.max(now + 1_000, ...expirations));
  });
}
