import { DurableObject } from 'cloudflare:workers';
import { cleanupRateLimitState, handleRateLimitRequest } from './limiter.js';

export class IpRateLimiter extends DurableObject {
  async fetch(request) {
    return handleRateLimitRequest(this.ctx.storage, request);
  }

  async alarm() {
    return cleanupRateLimitState(this.ctx.storage);
  }
}

export default {
  async fetch() {
    return Response.json(
      { error: 'Not found.' },
      { status: 404, headers: { 'cache-control': 'no-store' } },
    );
  },
};
