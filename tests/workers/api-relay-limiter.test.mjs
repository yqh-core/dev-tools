import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleRateLimitRequest } from '../../workers/api-relay-limiter/src/limiter.js';

class MemoryStorage {
  constructor() {
    this.values = new Map();
    this.activeValues = null;
    this.tail = Promise.resolve();
  }

  async get(key) {
    return (this.activeValues ?? this.values).get(key);
  }

  async put(key, value) {
    (this.activeValues ?? this.values).set(key, structuredClone(value));
  }

  async transaction(callback) {
    const run = async () => {
      const working = new Map(this.values);
      const previous = this.activeValues;
      this.activeValues = working;
      try {
        const result = await callback();
        this.values = working;
        return result;
      }
      finally {
        this.activeValues = previous;
      }
    };

    const pending = this.tail.then(run, run);
    this.tail = pending.then(() => undefined, () => undefined);
    return pending;
  }
}

function request(path, leaseId) {
  return new Request(`https://limiter.internal${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ leaseId }),
  });
}

let storage;
let limiter;
function createLimiter() {
  return { fetch: request => handleRateLimitRequest(storage, request) };
}
let sequence;

async function acquire() {
  sequence += 1;
  const leaseId = `lease_${String(sequence).padStart(20, '0')}`;
  const response = await limiter.fetch(request('/acquire', leaseId));
  return { leaseId, response, body: await response.json() };
}

async function release(leaseId) {
  return limiter.fetch(request('/release', leaseId));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-27T06:00:00.000Z'));
  storage = new MemoryStorage();
  limiter = createLimiter();
  sequence = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('API relay Durable Object rate limiter', () => {
  it('enforces a burst ceiling of 10 requests per 10 seconds', async () => {
    for (let index = 0; index < 10; index += 1) {
      const result = await acquire();
      expect(result.response.status).toBe(200);
      await release(result.leaseId);
    }

    const blocked = await acquire();
    expect(blocked.response.status).toBe(429);
    expect(blocked.body).toMatchObject({ allowed: false, reason: 'burst', retryAfterSeconds: 10 });

    await vi.advanceTimersByTimeAsync(10_000);
    const allowed = await acquire();
    expect(allowed.response.status).toBe(200);
  });

  it('enforces a rolling 30 requests per 60 seconds across burst windows', async () => {
    for (let batch = 0; batch < 3; batch += 1) {
      if (batch > 0) {
        await vi.advanceTimersByTimeAsync(10_000);
      }
      for (let index = 0; index < 10; index += 1) {
        const result = await acquire();
        expect(result.response.status).toBe(200);
        await release(result.leaseId);
      }
    }

    const blocked = await acquire();
    expect(blocked.response.status).toBe(429);
    expect(blocked.body).toMatchObject({ allowed: false, reason: 'window', retryAfterSeconds: 40 });

    await vi.advanceTimersByTimeAsync(40_000);
    const allowed = await acquire();
    expect(allowed.response.status).toBe(200);
  });

  it('limits a single IP to four in-flight leases and releases them idempotently', async () => {
    const leases = [];
    for (let index = 0; index < 4; index += 1) {
      const result = await acquire();
      expect(result.response.status).toBe(200);
      leases.push(result.leaseId);
    }

    const blocked = await acquire();
    expect(blocked.response.status).toBe(429);
    expect(blocked.body).toMatchObject({ allowed: false, reason: 'concurrency', retryAfterSeconds: 20 });

    await release(leases[0]);
    const allowed = await acquire();
    expect(allowed.response.status).toBe(200);

    const duplicateRelease = await release(leases[0]);
    expect(duplicateRelease.status).toBe(200);
    expect(await duplicateRelease.json()).toEqual({ released: true });
  });

  it('expires abandoned leases after 20 seconds', async () => {
    for (let index = 0; index < 4; index += 1) {
      const result = await acquire();
      expect(result.response.status).toBe(200);
    }

    const blocked = await acquire();
    expect(blocked.body.reason).toBe('concurrency');

    await vi.advanceTimersByTimeAsync(20_000);
    const allowed = await acquire();
    expect(allowed.response.status).toBe(200);
  });

  it('keeps counters when the Durable Object is reconstructed', async () => {
    for (let index = 0; index < 10; index += 1) {
      const result = await acquire();
      expect(result.response.status).toBe(200);
      await release(result.leaseId);
    }

    limiter = createLimiter();
    const blocked = await acquire();
    expect(blocked.response.status).toBe(429);
    expect(blocked.body.reason).toBe('burst');
  });

  it('serializes concurrent acquires for the same IP', async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => acquire()));
    expect(results.filter(result => result.response.status === 200)).toHaveLength(4);
    expect(results.filter(result => result.body.reason === 'concurrency')).toHaveLength(6);
  });

  it('rejects methods, routes, oversized and malformed internal messages', async () => {
    const get = await limiter.fetch(new Request('https://limiter.internal/acquire'));
    expect(get.status).toBe(405);

    const notFound = await limiter.fetch(request('/unknown', 'lease_00000000000000000000'));
    expect(notFound.status).toBe(404);

    const invalid = await limiter.fetch(new Request('https://limiter.internal/acquire', {
      method: 'POST',
      body: '{"leaseId":"bad","extra":"not-allowed"}',
    }));
    expect(invalid.status).toBe(400);

    const large = await limiter.fetch(new Request('https://limiter.internal/acquire', {
      method: 'POST',
      body: JSON.stringify({ leaseId: 'lease_00000000000000000000', padding: 'x'.repeat(300) }),
    }));
    expect(large.status).toBe(400);
  });
});
