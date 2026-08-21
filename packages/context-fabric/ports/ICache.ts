/**
 * Context Fabric Platform — ICache Port
 *
 * Abstracts a key-value cache used for:
 *   - Idempotency key tracking (M01)
 *   - Rate-limit counters (M01)
 *   - Hot entity resolution cache (M02)
 *
 * Default implementation: InMemoryCache (Map + TTL sweep)
 * Production implementations: RedisCacheAdapter, MemorystoreCacheAdapter
 */

export interface ICache {
  /**
   * Retrieve a cached value. Returns null if the key does not exist
   * or has expired.
   */
  get(key: string): Promise<string | null>;

  /**
   * Store a value.
   * @param key      Cache key.
   * @param value    String value (serialise complex objects before storing).
   * @param ttlSecs  Time-to-live in seconds. Omit for no expiry.
   */
  set(key: string, value: string, ttlSecs?: number): Promise<void>;

  /**
   * Delete a key. No-op if the key does not exist.
   */
  del(key: string): Promise<void>;

  /**
   * Returns true if the key exists and has not expired.
   */
  exists(key: string): Promise<boolean>;

  /**
   * Atomically increment a numeric counter and set a TTL if the key
   * did not previously exist. Returns the new value.
   * Used for rate-limit sliding window counters.
   */
  incr(key: string, ttlSecs?: number): Promise<number>;

  /**
   * Bulk delete keys matching a prefix.
   * Used for cache invalidation (e.g. flush entity cache on merge).
   */
  flushPrefix(prefix: string): Promise<number>; // returns count deleted

  /**
   * Release resources (connections, timers).
   */
  close(): Promise<void>;
}
