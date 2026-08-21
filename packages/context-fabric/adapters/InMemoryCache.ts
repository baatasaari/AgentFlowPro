/**
 * Context Fabric Platform — InMemoryCache Adapter
 *
 * Default ICache implementation using a plain Map with TTL management.
 * Suitable for development and single-process deployments.
 *
 * Replace with RedisCacheAdapter in production:
 *   CF_CACHE_ADAPTER=redis CF_REDIS_URL=redis://... node server/index.ts
 *
 * Thread safety: Node.js is single-threaded; no locking required.
 */

import type { ICache } from '../ports/ICache.js';

interface CacheEntry {
  value: string;
  expiresAt: number | null; // Date.now() ms, null = no expiry
}

export class InMemoryCache implements ICache {
  private readonly store = new Map<string, CacheEntry>();
  private sweepInterval: ReturnType<typeof setInterval> | null = null;

  constructor(sweepIntervalMs = 60_000) {
    // Periodically evict expired keys so memory doesn't grow unbounded.
    this.sweepInterval = setInterval(() => this._sweep(), sweepIntervalMs);
    // Don't block process exit for this timer.
    this.sweepInterval.unref?.();
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSecs?: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: ttlSecs !== undefined ? Date.now() + ttlSecs * 1000 : null,
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.get(key)) !== null;
  }

  async incr(key: string, ttlSecs?: number): Promise<number> {
    const current = await this.get(key);
    const next = current === null ? 1 : parseInt(current, 10) + 1;
    await this.set(key, String(next), ttlSecs);
    return next;
  }

  async flushPrefix(prefix: string): Promise<number> {
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  async close(): Promise<void> {
    if (this.sweepInterval) {
      clearInterval(this.sweepInterval);
      this.sweepInterval = null;
    }
    this.store.clear();
  }

  /** Size of the cache (including possibly-expired entries not yet swept). */
  get size(): number {
    return this.store.size;
  }

  private _sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt !== null && now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }
}
