/**
 * Context Fabric Platform — Runtime Configuration
 *
 * All configuration is read from environment variables at startup.
 * Every module checks its own feature flag before performing any operation.
 *
 * Feature flags follow the convention: MODULE_<CODE>_ENABLED=true|false
 * Default: all modules enabled. Set to "false" or "0" to disable.
 */

export interface ContextFabricConfig {
  // ── Module feature flags ──────────────────────────────────────────────────
  M01_SIGNAL_INGESTION_ENABLED:  boolean;
  M02_ENTITY_RESOLUTION_ENABLED: boolean;
  M03_CONTEXT_STORE_ENABLED:     boolean;
  M04_SIGNAL_BROKER_ENABLED:     boolean;
  M18_CONTRACT_REGISTRY_ENABLED: boolean;

  // ── Database ──────────────────────────────────────────────────────────────
  DATABASE_URL: string;

  // ── Signal Ingestion (M01) ────────────────────────────────────────────────
  /**
   * How long (seconds) an idempotency key is remembered.
   * Signals with the same key within this window are rejected as duplicates.
   * Default: 300 s (5 minutes).
   */
  SIGNAL_DEDUP_WINDOW_SECONDS: number;

  // ── Entity Resolution (M02) ───────────────────────────────────────────────
  /**
   * Minimum combined identifier score to auto-merge two entity candidates.
   * Default: 0.75. Candidates below this score are flagged for manual review.
   */
  ENTITY_RESOLUTION_THRESHOLD: number;

  // ── Context Store (M03) ───────────────────────────────────────────────────
  /**
   * Default signal TTL in hours for STANDARD_DECAY signals.
   * IMMEDIATE_DECAY = 1 × this value (24 h if default),
   * SLOW_DECAY      = 10 × this value (30 days if default).
   */
  DEFAULT_SIGNAL_TTL_HOURS: number;

  // ── Signal Broker (M04) ───────────────────────────────────────────────────
  /**
   * Maximum in-flight signals the broker will buffer before applying
   * back-pressure. Only relevant for the in-memory default adapter.
   */
  BROKER_MAX_BUFFER: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) {
    throw new Error(
      `Required environment variable '${key}' is not set. ` +
        'Check your .env file or deployment configuration.',
    );
  }
  return val;
}

function boolEnv(key: string, defaultVal: boolean): boolean {
  const val = process.env[key];
  if (val === undefined || val === '') return defaultVal;
  return val.toLowerCase() !== 'false' && val !== '0';
}

function numEnv(key: string, defaultVal: number): number {
  const val = process.env[key];
  if (val === undefined || val === '') return defaultVal;
  const n = Number(val);
  if (Number.isNaN(n)) {
    throw new Error(`Environment variable '${key}' must be a number, got '${val}'.`);
  }
  return n;
}

// ── Singleton ─────────────────────────────────────────────────────────────────

let _config: ContextFabricConfig | null = null;

/**
 * Load configuration from environment variables.
 * Call once at startup; subsequent calls return the cached instance.
 */
export function loadConfig(): ContextFabricConfig {
  if (_config) return _config;

  _config = {
    M01_SIGNAL_INGESTION_ENABLED:  boolEnv('MODULE_M01_ENABLED', true),
    M02_ENTITY_RESOLUTION_ENABLED: boolEnv('MODULE_M02_ENABLED', true),
    M03_CONTEXT_STORE_ENABLED:     boolEnv('MODULE_M03_ENABLED', true),
    M04_SIGNAL_BROKER_ENABLED:     boolEnv('MODULE_M04_ENABLED', true),
    M18_CONTRACT_REGISTRY_ENABLED: boolEnv('MODULE_M18_ENABLED', true),

    DATABASE_URL: requireEnv('DATABASE_URL'),

    SIGNAL_DEDUP_WINDOW_SECONDS: numEnv('CF_DEDUP_WINDOW_SEC', 300),

    ENTITY_RESOLUTION_THRESHOLD: numEnv('CF_ENTITY_THRESHOLD_PCT', 75) / 100,

    DEFAULT_SIGNAL_TTL_HOURS: numEnv('CF_SIGNAL_TTL_HOURS', 72),

    BROKER_MAX_BUFFER: numEnv('CF_BROKER_MAX_BUFFER', 10_000),
  };

  return _config;
}

/** Reset the cached config (for tests only). */
export function _resetConfig(): void {
  _config = null;
}
