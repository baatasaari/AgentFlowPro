/**
 * Context Fabric Platform — Service Container
 *
 * Constructs and wires all Phase 1 + Phase 2 services.
 * Uses the "composition root" pattern: all dependencies are resolved here,
 * not inside individual services (no service locator, no global singletons).
 *
 * Adapters are selected from environment variables, allowing cloud-provider
 * swaps without code changes:
 *   CF_CACHE_ADAPTER=memory  (default)  → InMemoryCache
 *   CF_CACHE_ADAPTER=redis               → RedisCacheAdapter (future)
 *   CF_BROKER_ADAPTER=memory (default)  → EventEmitterBroker
 *   CF_BROKER_ADAPTER=pubsub             → PubSubBroker (future)
 *   CF_ANTHROPIC_API_KEY=<key>           → AnthropicAdapter (M06 synthesis)
 *                                          (absent → StubLanguageModel)
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import { loadConfig } from '../core/config.js';
import { InMemoryCache } from '../adapters/InMemoryCache.js';
import { EventEmitterBroker } from '../adapters/EventEmitterBroker.js';
import { AnthropicAdapter } from '../adapters/AnthropicAdapter.js';
import { StubLanguageModel } from '../adapters/StubLanguageModel.js';
import { ContractRegistryService } from '../m18-contract-registry/ContractRegistryService.js';
import { SignalIngestionService } from '../m01-signal-ingestion/SignalIngestionService.js';
import { EntityResolutionService } from '../m02-entity-resolution/EntityResolutionService.js';
import { ContextStoreService } from '../m03-context-store/ContextStoreService.js';
import { SignalBrokerService } from '../m04-signal-broker/SignalBrokerService.js';
import { ContextAssemblerService } from '../m05-context-assembler/ContextAssemblerService.js';
import { SynthesisService } from '../m06-synthesis-engine/SynthesisService.js';
import { InferenceEngineService } from '../m07-inference-engine/InferenceEngineService.js';
import {
  FinancialDifficultyRule,
  VulnerabilityRule,
  FraudRiskRule,
} from '../m07-inference-engine/index.js';
import { SidecarService } from '../m08-context-sidecar/SidecarService.js';
import { SessionRegistry } from '../m08-context-sidecar/SessionRegistry.js';

export interface ContextFabricContainer {
  // Phase 1
  contractRegistry:  ContractRegistryService;
  signalIngestion:   SignalIngestionService;
  entityResolution:  EntityResolutionService;
  contextStore:      ContextStoreService;
  signalBroker:      SignalBrokerService;
  // Phase 2
  contextAssembler:  ContextAssemblerService;
  synthesisEngine:   SynthesisService;
  inferenceEngine:   InferenceEngineService;
  sidecar:           SidecarService;
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

  // LLM adapter: use Anthropic when an API key is configured; stub otherwise
  const llm = config.ANTHROPIC_API_KEY
    ? new AnthropicAdapter(
        config.ANTHROPIC_API_KEY,
        config.ANTHROPIC_MODEL,
        config.ANTHROPIC_BASE_URL,
      )
    : new StubLanguageModel();

  // ── Phase 1 services (dependency order: M18 first) ───────────────────────
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

  // ── Phase 2 services ─────────────────────────────────────────────────────

  const contextAssembler = new ContextAssemblerService(
    contextStore,
    contractRegistry,
    cache,
    config.M05_CONTEXT_ASSEMBLER_ENABLED,
  );

  const synthesisEngine = new SynthesisService(
    llm,
    cache,
    config.M06_SYNTHESIS_ENGINE_ENABLED,
  );

  const inferenceEngine = new InferenceEngineService(
    db as never,
    [
      new FinancialDifficultyRule(),
      new VulnerabilityRule(),
      new FraudRiskRule(),
    ],
    config.M07_INFERENCE_ENGINE_ENABLED,
  );

  const sessionRegistry = new SessionRegistry(config.SIDECAR_SESSION_IDLE_MS);

  const sidecar = new SidecarService(
    contextAssembler,
    synthesisEngine,
    sessionRegistry,
    config.M08_CONTEXT_SIDECAR_ENABLED,
  );

  _container = {
    contractRegistry,
    signalIngestion,
    entityResolution,
    contextStore,
    signalBroker,
    contextAssembler,
    synthesisEngine,
    inferenceEngine,
    sidecar,
    async shutdown() {
      await llm.close();
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
