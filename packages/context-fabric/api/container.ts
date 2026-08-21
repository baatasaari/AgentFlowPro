/**
 * Context Fabric Platform — Service Container
 *
 * Constructs and wires all Phase 1 services.
 * Uses the "composition root" pattern: all dependencies are resolved here,
 * not inside individual services (no service locator, no global singletons).
 *
 * Adapters are selected from environment variables, allowing cloud-provider
 * swaps without code changes:
 *   CF_CACHE_ADAPTER=memory  (default)  → InMemoryCache
 *   CF_CACHE_ADAPTER=redis               → RedisCacheAdapter (Phase 2)
 *   CF_BROKER_ADAPTER=memory (default)  → EventEmitterBroker
 *   CF_BROKER_ADAPTER=pubsub             → PubSubBroker (Phase 2)
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import { loadConfig } from '../core/config.js';
import { InMemoryCache } from '../adapters/InMemoryCache.js';
import { EventEmitterBroker } from '../adapters/EventEmitterBroker.js';
import { ContractRegistryService } from '../m18-contract-registry/ContractRegistryService.js';
import { SignalIngestionService } from '../m01-signal-ingestion/SignalIngestionService.js';
import { EntityResolutionService } from '../m02-entity-resolution/EntityResolutionService.js';
import { ContextStoreService } from '../m03-context-store/ContextStoreService.js';
import { SignalBrokerService } from '../m04-signal-broker/SignalBrokerService.js';

export interface ContextFabricContainer {
  contractRegistry:  ContractRegistryService;
  signalIngestion:   SignalIngestionService;
  entityResolution:  EntityResolutionService;
  contextStore:      ContextStoreService;
  signalBroker:      SignalBrokerService;
  shutdown():        Promise<void>;
}

let _container: ContextFabricContainer | null = null;

export async function getContainer(): Promise<ContextFabricContainer> {
  if (_container) return _container;

  const config = loadConfig();

  // ── Database ─────────────────────────────────────────────────────────────
  const pool = new pg.Pool({ connectionString: config.DATABASE_URL });
  const db   = drizzle(pool) as ReturnType<typeof drizzle>;

  // ── Adapters (swap here for different cloud providers) ────────────────────
  const cache  = new InMemoryCache();
  const broker = new EventEmitterBroker();

  // ── Services (dependency order: M18 first) ────────────────────────────────
  const contractRegistry = new ContractRegistryService(
    db as never,
    cache,
    config.M18_CONTRACT_REGISTRY_ENABLED,
  );

  const signalBroker = new SignalBrokerService(
    broker,
    contractRegistry,
    config.M04_SIGNAL_BROKER_ENABLED,
  );

  const entityResolution = new EntityResolutionService(
    db as never,
    cache,
    config.M02_ENTITY_RESOLUTION_ENABLED,
    config.ENTITY_RESOLUTION_THRESHOLD,
  );

  const signalIngestion = new SignalIngestionService(
    db as never,
    cache,
    broker,
    contractRegistry,
    {
      enabled:               config.M01_SIGNAL_INGESTION_ENABLED,
      dedupWindowSeconds:    config.SIGNAL_DEDUP_WINDOW_SECONDS,
      defaultSignalTtlHours: config.DEFAULT_SIGNAL_TTL_HOURS,
    },
  );

  const contextStore = new ContextStoreService(
    db as never,
    config.M03_CONTEXT_STORE_ENABLED,
  );

  _container = {
    contractRegistry,
    signalIngestion,
    entityResolution,
    contextStore,
    signalBroker,
    async shutdown() {
      await broker.close();
      await cache.close();
      await pool.end();
    },
  };

  return _container;
}

/** Reset the container (for tests only). */
export function _resetContainer(): void {
  _container = null;
}
