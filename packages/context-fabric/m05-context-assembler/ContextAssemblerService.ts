/**
 * M05 Context Assembler — ContextAssemblerService
 *
 * Builds a structured, ranked, access-controlled context package for a
 * requesting agent. Sits between the raw Context Store (M03) and the
 * agent's sidecar (M08).
 *
 * Responsibilities:
 *   1. Query M03 for raw signals, inferences, decisions
 *   2. Filter by the requesting agent's contract (scope, layer, domain)
 *   3. Apply temporal decay weighting and rank by relevance
 *   4. Apply PII masking based on contract.piiHandlingLevel
 *   5. Return a typed AssembledPackage ready for delivery or synthesis
 *
 * The assembler does NOT call an LLM — that is M06 Synthesis Engine's job.
 * The assembler produces structured data; the synthesiser produces prose.
 *
 * Caching: assembled packages are cached per (entityId, agentId, cacheKey)
 * for 60 seconds. Cache is invalidated when a new signal arrives for the
 * entity (M04 notifies via broker subscription in M08 sidecar).
 */

import type { Signal, AgentContract, SignalLayer, ContextScope, SignalDomain, Result } from '../core/types.js';
import { ok, err } from '../core/types.js';
import { ModuleDisabledError } from '../core/errors.js';
import type { ContextStoreService, AssembledContext } from '../m03-context-store/ContextStoreService.js';
import type { ContractRegistryService } from '../m18-contract-registry/ContractRegistryService.js';
import type { ICache } from '../ports/ICache.js';
import type { DbInference, DbDecision } from '../m03-context-store/schema.js';
import { DecayWeightCalculator } from './DecayWeightCalculator.js';
import { PiiMasker } from './PiiMasker.js';

// ── Output types ──────────────────────────────────────────────────────────────

export interface WeightedSignal extends Signal {
  /** Relevance weight after decay calculation: (0, 1] */
  weight:   number;
  ageHours: number;
}

export interface AssembledPackage {
  entityId:    string;
  requestingAgentId: string;
  /** Signals ranked by relevance weight (highest first), PII-masked. */
  signals:     WeightedSignal[];
  /** Active inferences relevant to the requesting agent's domains. */
  inferences:  DbInference[];
  /** Recent decisions, PII-masked. */
  decisions:   DbDecision[];
  /** Summary stats for the synthesis prompt. */
  stats: {
    totalSignals:      number;
    domainsPresent:    string[];
    latestSignalAt:    Date | null;
    oldestSignalAt:    Date | null;
    avgConfidence:     number;
    topTopics:         string[];
  };
  assembledAt:  Date;
  cacheHit:     boolean;
}

// ── Service ──────────────────────────────────────────────────────────────────

export interface AssemblerQuery {
  entityId:          string;
  requestingAgentId: string;
  /** Override scope filter (defaults to agent's allowedScopes). */
  scopes?:           ContextScope[];
  /** Override layer filter (defaults to agent's allowedLayers). */
  layers?:           SignalLayer[];
  /** Override domain filter (defaults to all domains). */
  domains?:          SignalDomain[];
  sessionId?:        string;
  since?:            Date;
  maxSignals?:       number;
}

export class ContextAssemblerService {
  private readonly decayCalc = new DecayWeightCalculator();
  private readonly piiMasker = new PiiMasker();
  private readonly CACHE_TTL = 60;  // seconds
  private readonly CACHE_PREFIX = 'cf:assembled:';

  constructor(
    private readonly contextStore:      ContextStoreService,
    private readonly contractRegistry:  ContractRegistryService,
    private readonly cache:             ICache,
    private readonly enabled:           boolean,
  ) {}

  // ── Assemble ──────────────────────────────────────────────────────────────

  async assemble(query: AssemblerQuery): Promise<Result<AssembledPackage>> {
    if (!this.enabled) return err(new ModuleDisabledError('M05_CONTEXT_ASSEMBLER'));

    // Load the requesting agent's contract (for filtering + PII level)
    const contractResult = await this.contractRegistry.findByAgentId(query.requestingAgentId);
    if (!contractResult.ok) return err(contractResult.error);
    const contract = contractResult.value;

    // Check cache
    const cacheKey = this._cacheKey(query, contract);
    const cached   = await this.cache.get(cacheKey);
    if (cached) {
      const pkg = JSON.parse(cached) as AssembledPackage;
      return ok({ ...pkg, cacheHit: true });
    }

    // Query raw context from M03
    const contextResult = await this.contextStore.assemble({
      entityId:       query.entityId,
      scopes:         query.scopes  ?? contract.allowedScopes,
      layers:         query.layers  ?? contract.allowedLayers,
      domains:        query.domains,
      sessionId:      query.sessionId,
      since:          query.since,
      maxSignals:     query.maxSignals ?? 100,
      maxInferences:  50,
      maxDecisions:   20,
    });
    if (!contextResult.ok) return err(contextResult.error);
    const raw: AssembledContext = contextResult.value;

    const now = new Date();

    // Apply decay weighting
    const weightedSignals: WeightedSignal[] = raw.signals.map(sig => {
      const { weight, ageHours } = this.decayCalc.compute(
        sig.producedAt, sig.decayClass, sig.confidence, now,
      );
      return { ...sig, weight, ageHours };
    });

    // Rank by weight (most relevant first)
    const ranked = this.decayCalc.rank(weightedSignals);

    // Apply PII masking to signal payloads
    const masked = ranked.map(sig => ({
      ...sig,
      payload: this.piiMasker.mask(sig.payload, contract.piiHandlingLevel),
    }));

    // Compute stats
    const stats = this._computeStats(ranked);

    const pkg: AssembledPackage = {
      entityId:          query.entityId,
      requestingAgentId: query.requestingAgentId,
      signals:           masked,
      inferences:        raw.inferences,
      decisions:         raw.decisions,
      stats,
      assembledAt:       now,
      cacheHit:          false,
    };

    // Cache the result
    await this.cache.set(cacheKey, JSON.stringify(pkg), this.CACHE_TTL);

    return ok(pkg);
  }

  /**
   * Invalidate the assembled context cache for an entity.
   * Called when a new signal arrives for the entity (M04 subscription).
   */
  async invalidate(entityId: string): Promise<void> {
    await this.cache.flushPrefix(`${this.CACHE_PREFIX}${entityId}:`);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _cacheKey(query: AssemblerQuery, contract: AgentContract): string {
    const parts = [
      query.entityId,
      query.requestingAgentId,
      contract.version,
      query.sessionId ?? '',
      query.scopes?.join(',') ?? '',
      query.layers?.join(',') ?? '',
    ];
    return `${this.CACHE_PREFIX}${parts.join(':')}`;
  }

  private _computeStats(signals: WeightedSignal[]) {
    if (!signals.length) {
      return {
        totalSignals:    0,
        domainsPresent:  [] as string[],
        latestSignalAt:  null,
        oldestSignalAt:  null,
        avgConfidence:   0,
        topTopics:       [] as string[],
      };
    }

    const domains   = [...new Set(signals.map(s => s.sourceDomain))];
    const dates     = signals.map(s => s.producedAt.getTime());
    const avgConf   = signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length;

    // Count topic frequency
    const topicCount = new Map<string, number>();
    for (const s of signals) {
      topicCount.set(s.topic, (topicCount.get(s.topic) ?? 0) + 1);
    }
    const topTopics = [...topicCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t]) => t);

    return {
      totalSignals:    signals.length,
      domainsPresent:  domains,
      latestSignalAt:  new Date(Math.max(...dates)),
      oldestSignalAt:  new Date(Math.min(...dates)),
      avgConfidence:   Math.round(avgConf * 100) / 100,
      topTopics,
    };
  }
}
