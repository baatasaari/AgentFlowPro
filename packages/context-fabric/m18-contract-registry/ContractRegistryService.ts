/**
 * M18 Contract Registry — ContractRegistryService
 *
 * The source of trust for all module interactions. Before any signal is
 * accepted (M01), the producing agent's contract must be registered here.
 *
 * Responsibilities:
 *   - Register new agent contracts
 *   - Activate / deactivate contracts
 *   - Validate that a (agentId, topic) pair is permitted
 *   - Cache hot lookups to avoid DB round-trips on every signal
 *
 * Topic matching supports AMQP-style wildcards:
 *   "fraud.*"   → matches "fraud.alert.raised"
 *   "customer.#" → matches any depth under "customer."
 */

import { eq, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { randomUUID } from 'crypto';

import type { AgentContract, ContextScope, SignalLayer, SignalDomain, PiiHandlingLevel } from '../core/types.js';
import {
  ContractNotFoundError,
  ContractAlreadyExistsError,
  ContractViolationError,
  ModuleDisabledError,
  ValidationError,
} from '../core/errors.js';
import type { ICache } from '../ports/ICache.js';
import { ok, err, type Result } from '../core/types.js';
import {
  cfAgentContracts,
  cfContractTopics,
  type NewAgentContract,
  type NewContractTopic,
} from './schema.js';

// ── Input DTOs ────────────────────────────────────────────────────────────────

export interface RegisterContractInput {
  agentId:                string;
  agentName:              string;
  domain:                 SignalDomain;
  version:                string;
  allowedTopicsPublish:   string[];
  allowedTopicsSubscribe: string[];
  allowedScopes?:         ContextScope[];
  allowedLayers?:         SignalLayer[];
  maxSignalRatePerMinute?: number;
  piiHandlingLevel?:      PiiHandlingLevel;
}

// ── Service ──────────────────────────────────────────────────────────────────

export class ContractRegistryService {
  private readonly MODULE = 'M18_CONTRACT_REGISTRY';
  private readonly CACHE_TTL = 300; // 5 min
  private readonly CACHE_PREFIX = 'cf:contract:';

  constructor(
    private readonly db: NodePgDatabase<Record<string, never>>,
    private readonly cache: ICache,
    private readonly enabled: boolean,
  ) {}

  // ── Register ─────────────────────────────────────────────────────────────

  async register(
    input: RegisterContractInput,
  ): Promise<Result<AgentContract>> {
    if (!this.enabled) return err(new ModuleDisabledError(this.MODULE));

    // Validate input
    if (!input.agentId || !input.agentName || !input.version) {
      return err(new ValidationError('agentId, agentName and version are required'));
    }
    if (!input.allowedTopicsPublish?.length && !input.allowedTopicsSubscribe?.length) {
      return err(new ValidationError('At least one topic (publish or subscribe) must be declared'));
    }

    const contractId = `${input.agentId}@${input.version}`;

    // Idempotent: return existing if already registered with same version
    const existing = await this.db
      .select()
      .from(cfAgentContracts)
      .where(eq(cfAgentContracts.contractId, contractId))
      .limit(1);

    if (existing.length > 0) {
      return err(new ContractAlreadyExistsError(input.agentId, input.version));
    }

    const defaultScopes: ContextScope[] = ['ENTERPRISE', 'DOMAIN', 'SESSION', 'TASK', 'TURN'];
    const defaultLayers: SignalLayer[]   = ['SIGNAL', 'PATTERN', 'INFERENCE', 'DECISION', 'NARRATIVE'];

    const newContract: NewAgentContract = {
      contractId,
      agentId:                input.agentId,
      agentName:              input.agentName,
      domain:                 input.domain,
      version:                input.version,
      maxSignalRatePerMinute: input.maxSignalRatePerMinute ?? 100,
      piiHandlingLevel:       input.piiHandlingLevel ?? 'MASKED',
      isActive:               true,
      allowedScopesJson:      JSON.stringify(input.allowedScopes ?? defaultScopes),
      allowedLayersJson:      JSON.stringify(input.allowedLayers ?? defaultLayers),
    };

    // Write contract + topics in a transaction
    await this.db.transaction(async tx => {
      await tx.insert(cfAgentContracts).values(newContract);

      const topicRows: NewContractTopic[] = [
        ...input.allowedTopicsPublish.map(t => ({
          contractId, direction: 'PUBLISH' as const, topic: t,
        })),
        ...input.allowedTopicsSubscribe.map(t => ({
          contractId, direction: 'SUBSCRIBE' as const, topic: t,
        })),
      ];

      if (topicRows.length > 0) {
        await tx.insert(cfContractTopics).values(topicRows);
      }
    });

    const contract = await this._load(contractId);
    if (!contract) return err(new ContractNotFoundError(input.agentId));

    // Warm the cache
    await this._cacheSet(contract);

    return ok(contract);
  }

  // ── Lookup ────────────────────────────────────────────────────────────────

  async findByAgentId(agentId: string): Promise<Result<AgentContract>> {
    if (!this.enabled) return err(new ModuleDisabledError(this.MODULE));

    // Try cache first (keyed by agentId → latest active contract)
    const cacheKey = `${this.CACHE_PREFIX}agent:${agentId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return ok(JSON.parse(cached) as AgentContract);

    // Find the most recently registered active contract for this agent
    const rows = await this.db
      .select()
      .from(cfAgentContracts)
      .where(
        and(
          eq(cfAgentContracts.agentId, agentId),
          eq(cfAgentContracts.isActive, true),
        ),
      )
      .orderBy(cfAgentContracts.registeredAt)
      .limit(1);

    if (!rows.length) return err(new ContractNotFoundError(agentId));

    const contract = await this._hydrate(rows[0].contractId);
    if (!contract) return err(new ContractNotFoundError(agentId));

    await this.cache.set(cacheKey, JSON.stringify(contract), this.CACHE_TTL);
    return ok(contract);
  }

  async findById(contractId: string): Promise<Result<AgentContract>> {
    if (!this.enabled) return err(new ModuleDisabledError(this.MODULE));

    const cacheKey = `${this.CACHE_PREFIX}${contractId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return ok(JSON.parse(cached) as AgentContract);

    const contract = await this._hydrate(contractId);
    if (!contract) return err(new ContractNotFoundError(contractId));

    await this._cacheSet(contract);
    return ok(contract);
  }

  // ── Validation ────────────────────────────────────────────────────────────

  /**
   * Check that an agent is permitted to publish on the given topic.
   * Called by M01 on every inbound signal.
   */
  async validatePublish(
    agentId: string,
    topic: string,
  ): Promise<Result<AgentContract>> {
    const contractResult = await this.findByAgentId(agentId);
    if (!contractResult.ok) return contractResult;

    const contract = contractResult.value;
    const permitted = contract.allowedTopicsPublish.some(p => topicMatches(p, topic));

    if (!permitted) {
      return err(
        new ContractViolationError(
          agentId,
          topic,
          `Topic '${topic}' is not in the agent's allowedTopicsPublish list. ` +
            `Permitted: [${contract.allowedTopicsPublish.join(', ')}]`,
        ),
      );
    }

    return ok(contract);
  }

  // ── Deactivate ────────────────────────────────────────────────────────────

  async deactivate(contractId: string): Promise<Result<void>> {
    if (!this.enabled) return err(new ModuleDisabledError(this.MODULE));

    await this.db
      .update(cfAgentContracts)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(cfAgentContracts.contractId, contractId));

    // Invalidate cache
    await this.cache.del(`${this.CACHE_PREFIX}${contractId}`);

    return ok(undefined);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async _load(contractId: string) {
    const rows = await this.db
      .select()
      .from(cfAgentContracts)
      .where(eq(cfAgentContracts.contractId, contractId))
      .limit(1);
    return rows[0] ?? null;
  }

  private async _hydrate(contractId: string): Promise<AgentContract | null> {
    const row = await this._load(contractId);
    if (!row) return null;

    const topicRows = await this.db
      .select()
      .from(cfContractTopics)
      .where(eq(cfContractTopics.contractId, contractId));

    return {
      contractId:             row.contractId,
      agentId:                row.agentId,
      agentName:              row.agentName,
      domain:                 row.domain as AgentContract['domain'],
      version:                row.version,
      allowedTopicsPublish:   topicRows.filter(t => t.direction === 'PUBLISH').map(t => t.topic),
      allowedTopicsSubscribe: topicRows.filter(t => t.direction === 'SUBSCRIBE').map(t => t.topic),
      allowedScopes:          JSON.parse(row.allowedScopesJson) as ContextScope[],
      allowedLayers:          JSON.parse(row.allowedLayersJson) as SignalLayer[],
      maxSignalRatePerMinute: row.maxSignalRatePerMinute,
      piiHandlingLevel:       row.piiHandlingLevel as PiiHandlingLevel,
      isActive:               row.isActive,
      registeredAt:           row.registeredAt,
      updatedAt:              row.updatedAt,
    };
  }

  private async _cacheSet(contract: AgentContract): Promise<void> {
    const key = `${this.CACHE_PREFIX}${contract.contractId}`;
    await this.cache.set(key, JSON.stringify(contract), this.CACHE_TTL);
  }
}

// ── Topic pattern matching ────────────────────────────────────────────────────

/**
 * Returns true if `topic` matches `pattern`.
 * Pattern rules:
 *   *  matches one segment
 *   #  matches zero or more segments
 */
export function topicMatches(pattern: string, topic: string): boolean {
  const pParts = pattern.split('.');
  const tParts = topic.split('.');

  return _match(pParts, 0, tParts, 0);
}

function _match(p: string[], pi: number, t: string[], ti: number): boolean {
  if (pi === p.length && ti === t.length) return true;
  if (pi === p.length) return false;

  if (p[pi] === '#') {
    // # matches zero or more segments
    for (let skip = 0; skip <= t.length - ti; skip++) {
      if (_match(p, pi + 1, t, ti + skip)) return true;
    }
    return false;
  }

  if (ti === t.length) return false;

  if (p[pi] === '*' || p[pi] === t[ti]) {
    return _match(p, pi + 1, t, ti + 1);
  }

  return false;
}
