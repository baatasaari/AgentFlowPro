/**
 * M18 Contract Registry — Unit Tests
 *
 * Uses in-memory stubs for DB and cache so tests run without a real database.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContractRegistryService, topicMatches } from '../ContractRegistryService.js';
import type { RegisterContractInput } from '../ContractRegistryService.js';
import { InMemoryCache } from '../../adapters/InMemoryCache.js';
import {
  ContractNotFoundError,
  ContractAlreadyExistsError,
  ContractViolationError,
  ModuleDisabledError,
} from '../../core/errors.js';

// ── DB Stub ───────────────────────────────────────────────────────────────────

function makeMockDb() {
  const contracts: Map<string, Record<string, unknown>> = new Map();
  const topics:    Array<Record<string, unknown>>       = [];

  return {
    contracts,
    topics,
    // Drizzle-like fluent interface stub
    select: () => ({
      from: () => ({
        where: (_cond: unknown) => ({
          limit: () => Promise.resolve([...contracts.values()].slice(0, 1)),
          orderBy: () => ({ limit: () => Promise.resolve([...contracts.values()].slice(0, 1)) }),
        }),
        orderBy: () => ({ limit: () => Promise.resolve([]) }),
      }),
    }),
    insert: (table: unknown) => ({
      values: (vals: Record<string, unknown> | Record<string, unknown>[]) => {
        const rows = Array.isArray(vals) ? vals : [vals];
        for (const row of rows) {
          if ((table as { tableName?: string }).tableName === 'cf_contract_topics') {
            topics.push(row);
          } else {
            contracts.set(row['contract_id'] as string ?? row['contractId'] as string, row);
          }
        }
        return Promise.resolve();
      },
    }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    transaction: async (fn: (tx: unknown) => Promise<void>) => {
      const collected_contracts: Record<string, unknown>[] = [];
      const collected_topics:    Record<string, unknown>[] = [];
      const tx = {
        insert: (table: { tableName?: string }) => ({
          values: (vals: Record<string, unknown> | Record<string, unknown>[]) => {
            const rows = Array.isArray(vals) ? vals : [vals];
            if (table.tableName === 'cf_contract_topics') {
              collected_topics.push(...rows);
            } else {
              collected_contracts.push(...rows);
            }
            return Promise.resolve();
          },
        }),
      };
      await fn(tx);
      for (const c of collected_contracts) {
        const id = (c['contractId'] ?? c['contract_id']) as string;
        contracts.set(id, c);
      }
      topics.push(...collected_topics);
    },
  };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FRAUD_INPUT: RegisterContractInput = {
  agentId:                'fraud-agent',
  agentName:              'Fraud Detection Agent',
  domain:                 'FRAUD',
  version:                '1.0.0',
  allowedTopicsPublish:   ['fraud.alert.raised', 'fraud.alert.cleared', 'fraud.*'],
  allowedTopicsSubscribe: ['customer.#', 'transaction.created'],
  maxSignalRatePerMinute: 500,
  piiHandlingLevel:       'MASKED',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeService(enabled = true) {
  const db    = makeMockDb() as unknown as Parameters<typeof ContractRegistryService>[0];
  const cache = new InMemoryCache();
  return { service: new ContractRegistryService(db, cache, enabled), db, cache };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ContractRegistryService', () => {

  describe('register()', () => {
    it('returns ModuleDisabledError when module is off', async () => {
      const { service } = makeService(false);
      const result = await service.register(FRAUD_INPUT);
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.error).toBeInstanceOf(ModuleDisabledError);
    });

    it('returns ContractAlreadyExistsError on duplicate registration', async () => {
      const { service, db } = makeService();
      // Pre-populate to simulate existing contract
      db.contracts.set('fraud-agent@1.0.0', { contractId: 'fraud-agent@1.0.0' });

      const result = await service.register(FRAUD_INPUT);
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.error).toBeInstanceOf(ContractAlreadyExistsError);
    });

    it('returns ValidationError when no topics declared', async () => {
      const { service } = makeService();
      const result = await service.register({
        ...FRAUD_INPUT,
        allowedTopicsPublish:   [],
        allowedTopicsSubscribe: [],
      });
      expect(result.ok).toBe(false);
    });

    it('returns ValidationError when required fields missing', async () => {
      const { service } = makeService();
      const result = await service.register({
        ...FRAUD_INPUT,
        agentId: '',
      });
      expect(result.ok).toBe(false);
    });
  });

  describe('findByAgentId()', () => {
    it('returns ContractNotFoundError for unknown agent', async () => {
      const { service } = makeService();
      const result = await service.findByAgentId('unknown-agent');
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.error).toBeInstanceOf(ContractNotFoundError);
    });
  });

  describe('validatePublish()', () => {
    it('returns ContractViolationError for disallowed topic', async () => {
      const { service } = makeService();
      // Seed a valid contract into the cache to avoid full DB round-trip
      const contract = {
        contractId:             'fraud-agent@1.0.0',
        agentId:                'fraud-agent',
        agentName:              'Fraud Detection Agent',
        domain:                 'FRAUD',
        version:                '1.0.0',
        allowedTopicsPublish:   ['fraud.alert.raised'],
        allowedTopicsSubscribe: ['customer.#'],
        allowedScopes:          ['ENTERPRISE', 'DOMAIN'],
        allowedLayers:          ['SIGNAL', 'INFERENCE'],
        maxSignalRatePerMinute: 500,
        piiHandlingLevel:       'MASKED',
        isActive:               true,
        registeredAt:           new Date(),
        updatedAt:              new Date(),
      };
      // @ts-expect-error – accessing private cache for test seeding
      await service['cache'].set(
        'cf:contract:agent:fraud-agent',
        JSON.stringify(contract),
        300,
      );

      const result = await service.validatePublish('fraud-agent', 'customer.created');
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.error).toBeInstanceOf(ContractViolationError);
    });

    it('allows a topic covered by a single-segment wildcard pattern', async () => {
      const { service } = makeService();
      const contract = {
        contractId:             'fraud-agent@1.0.0',
        agentId:                'fraud-agent',
        agentName:              'Fraud Detection Agent',
        domain:                 'FRAUD',
        version:                '1.0.0',
        allowedTopicsPublish:   ['fraud.*'],
        allowedTopicsSubscribe: [],
        allowedScopes:          ['ENTERPRISE'],
        allowedLayers:          ['SIGNAL'],
        maxSignalRatePerMinute: 100,
        piiHandlingLevel:       'MASKED',
        isActive:               true,
        registeredAt:           new Date(),
        updatedAt:              new Date(),
      };
      // @ts-expect-error – private cache access
      await service['cache'].set('cf:contract:agent:fraud-agent', JSON.stringify(contract), 300);

      // fraud.* matches exactly one segment: "fraud.alert" ✓, not "fraud.alert.raised" ✗
      const singleSegment = await service.validatePublish('fraud-agent', 'fraud.alert');
      expect(singleSegment.ok).toBe(true);

      // fraud.alert.raised has two segments after "fraud" — needs fraud.# or fraud.alert.*
      const twoSegment = await service.validatePublish('fraud-agent', 'fraud.alert.raised');
      expect(twoSegment.ok).toBe(false);
    });

    it('allows a topic covered by a multi-segment wildcard pattern', async () => {
      const { service } = makeService();
      const contract = {
        contractId:             'fraud-agent@1.0.0',
        agentId:                'fraud-agent',
        agentName:              'Fraud Detection Agent',
        domain:                 'FRAUD',
        version:                '1.0.0',
        allowedTopicsPublish:   ['fraud.#'],  // # = any depth
        allowedTopicsSubscribe: [],
        allowedScopes:          ['ENTERPRISE'],
        allowedLayers:          ['SIGNAL'],
        maxSignalRatePerMinute: 100,
        piiHandlingLevel:       'MASKED',
        isActive:               true,
        registeredAt:           new Date(),
        updatedAt:              new Date(),
      };
      // @ts-expect-error – private cache access
      await service['cache'].set('cf:contract:agent:fraud-agent', JSON.stringify(contract), 300);

      const result = await service.validatePublish('fraud-agent', 'fraud.alert.raised');
      expect(result.ok).toBe(true);
    });
  });
});

// ── topicMatches helper ───────────────────────────────────────────────────────

describe('topicMatches()', () => {
  it('matches exact topics', () => {
    expect(topicMatches('fraud.alert.raised', 'fraud.alert.raised')).toBe(true);
    expect(topicMatches('fraud.alert.raised', 'fraud.alert.cleared')).toBe(false);
  });

  it('matches single-segment wildcard *', () => {
    expect(topicMatches('fraud.*', 'fraud.alert')).toBe(true);
    expect(topicMatches('fraud.*', 'fraud.alert.raised')).toBe(false);
    expect(topicMatches('fraud.*', 'other.alert')).toBe(false);
  });

  it('matches multi-segment wildcard #', () => {
    expect(topicMatches('customer.#', 'customer.vulnerability.detected')).toBe(true);
    expect(topicMatches('customer.#', 'customer.created')).toBe(true);
    expect(topicMatches('customer.#', 'customer')).toBe(true); // zero segments
    expect(topicMatches('customer.#', 'fraud.alert')).toBe(false);
  });

  it('handles mixed wildcards', () => {
    expect(topicMatches('*.alert.#', 'fraud.alert.raised.critical')).toBe(true);
    expect(topicMatches('*.alert.#', 'fraud.score.raised')).toBe(false);
  });
});
