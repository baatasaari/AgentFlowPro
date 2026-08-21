/**
 * M01 Signal Ingestion — Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomUUID } from 'crypto';
import { SignalIngestionService } from '../SignalIngestionService.js';
import { SignalValidator } from '../SignalValidator.js';
import { InMemoryCache } from '../../adapters/InMemoryCache.js';
import { EventEmitterBroker } from '../../adapters/EventEmitterBroker.js';
import {
  DuplicateSignalError,
  RateLimitError,
  ContractViolationError,
  ModuleDisabledError,
} from '../../core/errors.js';
import type { Signal } from '../../core/types.js';
import type { SignalIngestionConfig } from '../SignalIngestionService.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ENTITY_ID   = '550e8400-e29b-41d4-a716-446655440000';
const CONTRACT_ID = 'fraud-agent@1.0.0';

function makeSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    signalId:        randomUUID(),
    idempotencyKey:  `fraud-agent:fraud.alert.raised:${randomUUID()}`,
    sourceAgentId:   'fraud-agent',
    sourceDomain:    'FRAUD',
    entityId:        ENTITY_ID,
    layer:           'SIGNAL' as const,
    propagationClass:'STANDARD' as const,
    decayClass:      'STANDARD_DECAY' as const,
    scope:           'DOMAIN' as const,
    topic:           'fraud.alert.raised',
    payload:         { transactionId: 'TXN-001', risk: 0.92 },
    confidence:      0.95,
    schemaVersion:   '1.0.0',
    contractId:      CONTRACT_ID,
    producedAt:      new Date(),
    ...overrides,
  };
}

// ── Stubs ─────────────────────────────────────────────────────────────────────

function makeDbStub() {
  const signals:      Map<string, unknown> = new Map();
  const idempotency:  Map<string, unknown> = new Map();

  return {
    signals,
    idempotency,
    insert: () => ({
      values: (row: { signalId?: string; idempotencyKey?: string }) => Promise.resolve(row),
    }),
    transaction: async (fn: (tx: unknown) => Promise<void>) => {
      const rows: { signalId?: string; idempotencyKey?: string }[] = [];
      const tx = {
        insert: () => ({
          values: (row: { signalId?: string; idempotencyKey?: string }) => {
            rows.push(row);
            return Promise.resolve();
          },
        }),
      };
      await fn(tx);
      for (const r of rows) {
        if (r.signalId) signals.set(r.signalId, r);
        if (r.idempotencyKey) idempotency.set(r.idempotencyKey, r);
      }
    },
  };
}

function makeContractRegistryStub(
  allowed: boolean = true,
  rateLimit: number = 100,
) {
  return {
    validatePublish: vi.fn().mockResolvedValue(
      allowed
        ? { ok: true,  value: { maxSignalRatePerMinute: rateLimit, allowedTopicsPublish: ['fraud.*', 'fraud.alert.raised'] } }
        : { ok: false, error: new ContractViolationError('fraud-agent', 'fraud.alert.raised', 'not permitted') },
    ),
    findByAgentId: vi.fn().mockResolvedValue(
      { ok: true, value: { maxSignalRatePerMinute: rateLimit } },
    ),
  };
}

function makeConfig(overrides: Partial<SignalIngestionConfig> = {}): SignalIngestionConfig {
  return {
    enabled:               true,
    dedupWindowSeconds:    300,
    defaultSignalTtlHours: 72,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SignalIngestionService', () => {

  describe('ingest() — happy path', () => {
    it('ingests a valid signal and returns ok result', async () => {
      const db       = makeDbStub() as unknown as Parameters<typeof SignalIngestionService>[0];
      const cache    = new InMemoryCache();
      const broker   = new EventEmitterBroker();
      const registry = makeContractRegistryStub() as unknown as Parameters<typeof SignalIngestionService>[3];
      const svc      = new SignalIngestionService(db, cache, broker, registry, makeConfig());

      const signal = makeSignal();
      const result = await svc.ingest(signal);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.signalId).toBe(signal.signalId);
        expect(result.value.entityId).toBe(ENTITY_ID);
      }

      await cache.close();
      await broker.close();
    });

    it('publishes IMMEDIATE signals synchronously', async () => {
      const db       = makeDbStub() as unknown as Parameters<typeof SignalIngestionService>[0];
      const cache    = new InMemoryCache();
      const broker   = new EventEmitterBroker();
      const registry = makeContractRegistryStub() as unknown as Parameters<typeof SignalIngestionService>[3];
      const svc      = new SignalIngestionService(db, cache, broker, registry, makeConfig());

      const received: Signal[] = [];
      await broker.subscribe('fraud.alert.raised', 'test-subscriber', async s => { received.push(s); });

      const signal = makeSignal({ propagationClass: 'IMMEDIATE' });
      await svc.ingest(signal);

      expect(received).toHaveLength(1);
      expect(received[0].signalId).toBe(signal.signalId);

      await cache.close();
      await broker.close();
    });
  });

  describe('ingest() — module disabled', () => {
    it('returns ModuleDisabledError when disabled', async () => {
      const db       = makeDbStub() as unknown as Parameters<typeof SignalIngestionService>[0];
      const cache    = new InMemoryCache();
      const broker   = new EventEmitterBroker();
      const registry = makeContractRegistryStub() as unknown as Parameters<typeof SignalIngestionService>[3];
      const svc      = new SignalIngestionService(db, cache, broker, registry, makeConfig({ enabled: false }));

      const result = await svc.ingest(makeSignal());
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.error).toBeInstanceOf(ModuleDisabledError);

      await cache.close();
    });
  });

  describe('ingest() — duplicate detection', () => {
    it('rejects a duplicate idempotency key within the dedup window', async () => {
      const db       = makeDbStub() as unknown as Parameters<typeof SignalIngestionService>[0];
      const cache    = new InMemoryCache();
      const broker   = new EventEmitterBroker();
      const registry = makeContractRegistryStub() as unknown as Parameters<typeof SignalIngestionService>[3];
      const svc      = new SignalIngestionService(db, cache, broker, registry, makeConfig());

      const signal = makeSignal();
      const first  = await svc.ingest(signal);
      expect(first.ok).toBe(true);

      // Submit the same signal again
      const second = await svc.ingest({ ...signal, signalId: randomUUID() });
      expect(second.ok).toBe(false);
      expect(second.ok === false && second.error).toBeInstanceOf(DuplicateSignalError);

      await cache.close();
      await broker.close();
    });
  });

  describe('ingest() — rate limiting', () => {
    it('rejects signals beyond the contract rate limit', async () => {
      const db       = makeDbStub() as unknown as Parameters<typeof SignalIngestionService>[0];
      const cache    = new InMemoryCache();
      const broker   = new EventEmitterBroker();
      // Low rate limit: 2 signals/minute
      const registry = makeContractRegistryStub(true, 2) as unknown as Parameters<typeof SignalIngestionService>[3];
      const svc      = new SignalIngestionService(db, cache, broker, registry, makeConfig());

      // First two succeed
      await svc.ingest(makeSignal());
      await svc.ingest(makeSignal());

      // Third should be rate-limited
      const third = await svc.ingest(makeSignal());
      expect(third.ok).toBe(false);
      expect(third.ok === false && third.error).toBeInstanceOf(RateLimitError);

      await cache.close();
      await broker.close();
    });
  });

  describe('ingest() — contract violation', () => {
    it('rejects a signal from an agent without a matching contract', async () => {
      const db       = makeDbStub() as unknown as Parameters<typeof SignalIngestionService>[0];
      const cache    = new InMemoryCache();
      const broker   = new EventEmitterBroker();
      const registry = makeContractRegistryStub(false) as unknown as Parameters<typeof SignalIngestionService>[3];
      const svc      = new SignalIngestionService(db, cache, broker, registry, makeConfig());

      const result = await svc.ingest(makeSignal());
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.error).toBeInstanceOf(ContractViolationError);

      await cache.close();
    });
  });

  describe('SignalValidator', () => {
    const validator = new SignalValidator();

    it('passes a valid signal', () => {
      const result = validator.validate(makeSignal());
      expect(result.valid).toBe(true);
    });

    it('fails when signalId is missing', () => {
      const result = validator.validate({ ...makeSignal(), signalId: '' });
      expect(result.valid).toBe(false);
    });

    it('fails when confidence is out of range', () => {
      const result = validator.validate({ ...makeSignal(), confidence: 1.5 });
      expect(result.valid).toBe(false);
    });

    it('fails when producedAt is in the future beyond skew tolerance', () => {
      const future = new Date(Date.now() + 60_000); // 60 s in the future
      const result = validator.validate({ ...makeSignal(), producedAt: future });
      expect(result.valid).toBe(false);
    });

    it('fails when topic has uppercase letters', () => {
      const result = validator.validate({ ...makeSignal(), topic: 'Fraud.Alert' });
      expect(result.valid).toBe(false);
    });

    it('fails when schemaVersion is not semver', () => {
      const result = validator.validate({ ...makeSignal(), schemaVersion: 'v1' });
      expect(result.valid).toBe(false);
    });

    it('fails when payload is null', () => {
      const result = validator.validate({ ...makeSignal(), payload: null as never });
      expect(result.valid).toBe(false);
    });
  });
});
