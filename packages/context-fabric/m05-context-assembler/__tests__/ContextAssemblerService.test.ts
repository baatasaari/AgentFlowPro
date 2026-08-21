/**
 * M05 Context Assembler — Unit Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { DecayWeightCalculator } from '../DecayWeightCalculator.js';
import { PiiMasker } from '../PiiMasker.js';
import { ContextAssemblerService } from '../ContextAssemblerService.js';
import { ModuleDisabledError } from '../../core/errors.js';
import { InMemoryCache } from '../../adapters/InMemoryCache.js';
import type { AssemblerQuery } from '../ContextAssemblerService.js';

// ── DecayWeightCalculator tests ───────────────────────────────────────────────

describe('DecayWeightCalculator', () => {
  const calc = new DecayWeightCalculator();
  const ref  = new Date('2026-01-01T12:00:00Z');

  it('ETERNAL signals always return confidence as weight regardless of age', () => {
    const old = new Date('2024-01-01T00:00:00Z');
    const { weight } = calc.compute(old, 'ETERNAL', 0.9, ref);
    expect(weight).toBe(0.9);
  });

  it('EVENT_TRIGGERED signals always return confidence as weight', () => {
    const { weight } = calc.compute(new Date('2025-06-01'), 'EVENT_TRIGGERED', 0.75, ref);
    expect(weight).toBe(0.75);
  });

  it('IMMEDIATE_DECAY at 24 h returns half the confidence (one half-life)', () => {
    const producedAt = new Date(ref.getTime() - 24 * 60 * 60 * 1000); // 24 h ago
    const { weight } = calc.compute(producedAt, 'IMMEDIATE_DECAY', 1.0, ref);
    expect(weight).toBeCloseTo(0.5, 2);
  });

  it('STANDARD_DECAY at 72 h returns half the confidence (one half-life)', () => {
    const producedAt = new Date(ref.getTime() - 72 * 60 * 60 * 1000);
    const { weight } = calc.compute(producedAt, 'STANDARD_DECAY', 1.0, ref);
    expect(weight).toBeCloseTo(0.5, 2);
  });

  it('Very fresh signals retain nearly full confidence', () => {
    const producedAt = new Date(ref.getTime() - 5 * 60 * 1000); // 5 min ago
    const { weight } = calc.compute(producedAt, 'STANDARD_DECAY', 0.9, ref);
    expect(weight).toBeGreaterThan(0.89);
  });

  it('rank() orders signals by descending weight', () => {
    const signals = [
      { signalId: 'a', weight: 0.3 },
      { signalId: 'b', weight: 0.9 },
      { signalId: 'c', weight: 0.6 },
    ];
    const ranked = calc.rank(signals);
    expect(ranked[0].signalId).toBe('b');
    expect(ranked[1].signalId).toBe('c');
    expect(ranked[2].signalId).toBe('a');
  });

  it('ageHours reflects time elapsed since producedAt', () => {
    const producedAt = new Date(ref.getTime() - 3 * 60 * 60 * 1000); // 3 h ago
    const { ageHours } = calc.compute(producedAt, 'STANDARD_DECAY', 1.0, ref);
    expect(ageHours).toBeCloseTo(3, 1);
  });
});

// ── PiiMasker tests ───────────────────────────────────────────────────────────

describe('PiiMasker', () => {
  const masker = new PiiMasker();

  it('FULL level returns payload unchanged', () => {
    const payload = { phone: '07700900000', risk: 0.9 };
    expect(masker.mask(payload, 'FULL')).toEqual(payload);
  });

  it('NONE level strips all PII fields', () => {
    const payload = { phone: '07700900000', risk: 0.9, email: 'x@y.com', transactionId: 'TXN-1' };
    const result  = masker.mask(payload, 'NONE');
    expect(result).not.toHaveProperty('phone');
    expect(result).not.toHaveProperty('email');
    expect(result).toHaveProperty('risk', 0.9);
    expect(result).toHaveProperty('transactionId', 'TXN-1');
  });

  it('MASKED level partially redacts PII values', () => {
    const payload = { phone: '07700900000', risk: 0.9 };
    const result  = masker.mask(payload, 'MASKED');
    expect(result['phone']).not.toBe('07700900000');
    expect(typeof result['phone']).toBe('string');
    expect((result['phone'] as string).includes('*')).toBe(true);
    expect(result).toHaveProperty('risk', 0.9);
  });

  it('MASKED preserves first 2 and last 2 characters', () => {
    const result = masker.mask({ phone: '07712345678' }, 'MASKED');
    const masked = result['phone'] as string;
    expect(masked.startsWith('07')).toBe(true);
    expect(masked.endsWith('78')).toBe(true);
  });

  it('does not mask non-PII fields at any level', () => {
    const payload = { transactionId: 'TXN-001', riskScore: 0.87, fraudFlag: true };
    expect(masker.mask(payload, 'NONE')).toEqual(payload);
    expect(masker.mask(payload, 'MASKED')).toEqual(payload);
  });

  it('recursively masks nested PII objects', () => {
    const payload = { customer: { name: 'John Doe', accountId: 'ACC-1' }, amount: 100 };
    const result  = masker.mask(payload, 'NONE');
    expect((result['customer'] as Record<string, unknown>)).not.toHaveProperty('name');
    expect((result['customer'] as Record<string, unknown>)).toHaveProperty('accountId');
  });
});

// ── ContextAssemblerService tests ─────────────────────────────────────────────

describe('ContextAssemblerService', () => {
  function makeContractStub() {
    return {
      findByAgentId: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          agentId:               'retail-agent',
          version:               '1.0.0',
          allowedScopes:         ['ENTERPRISE', 'DOMAIN', 'SESSION'],
          allowedLayers:         ['SIGNAL', 'INFERENCE'],
          piiHandlingLevel:      'MASKED',
          maxSignalRatePerMinute: 100,
        },
      }),
    };
  }

  function makeContextStoreStub(signals = [], inferences = [], decisions = []) {
    return {
      assemble: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          entityId:    'e-1',
          signals,
          inferences,
          decisions,
          assembledAt: new Date(),
        },
      }),
    };
  }

  it('returns ModuleDisabledError when disabled', async () => {
    const svc = new ContextAssemblerService(
      makeContextStoreStub() as never,
      makeContractStub() as never,
      new InMemoryCache(),
      false,
    );
    const result = await svc.assemble({ entityId: 'e-1', requestingAgentId: 'retail-agent' });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toBeInstanceOf(ModuleDisabledError);
  });

  it('assembles an empty package when entity has no signals', async () => {
    const cache = new InMemoryCache();
    const svc = new ContextAssemblerService(
      makeContextStoreStub() as never,
      makeContractStub() as never,
      cache,
      true,
    );
    const result = await svc.assemble({ entityId: 'e-1', requestingAgentId: 'retail-agent' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.signals).toHaveLength(0);
      expect(result.value.stats.totalSignals).toBe(0);
      expect(result.value.cacheHit).toBe(false);
    }
    await cache.close();
  });

  it('returns cacheHit=true on second assembly with same query', async () => {
    const cache = new InMemoryCache();
    const svc = new ContextAssemblerService(
      makeContextStoreStub() as never,
      makeContractStub() as never,
      cache,
      true,
    );
    const query: AssemblerQuery = { entityId: 'e-1', requestingAgentId: 'retail-agent' };
    await svc.assemble(query);        // first call — cache miss
    const second = await svc.assemble(query); // second call — cache hit
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.value.cacheHit).toBe(true);
    await cache.close();
  });

  it('ranks signals by decay weight (freshest first)', async () => {
    const now   = new Date();
    const old   = new Date(now.getTime() - 60 * 60 * 1000); // 1 h ago
    const fresh = new Date(now.getTime() - 5 * 60 * 1000);  // 5 min ago

    const signals = [
      { signalId: 'old',   producedAt: old,   decayClass: 'STANDARD_DECAY', confidence: 0.9, topic: 't', payload: {}, sourceDomain: 'RETAIL', layer: 'SIGNAL', propagationClass: 'STANDARD', decayClass: 'STANDARD_DECAY', scope: 'DOMAIN', schemaVersion: '1.0.0', contractId: 'c', idempotencyKey: 'k1', sourceAgentId: 'a', entityId: 'e-1' },
      { signalId: 'fresh', producedAt: fresh, decayClass: 'STANDARD_DECAY', confidence: 0.9, topic: 't', payload: {}, sourceDomain: 'RETAIL', layer: 'SIGNAL', propagationClass: 'STANDARD', decayClass: 'STANDARD_DECAY', scope: 'DOMAIN', schemaVersion: '1.0.0', contractId: 'c', idempotencyKey: 'k2', sourceAgentId: 'a', entityId: 'e-1' },
    ];

    const cache = new InMemoryCache();
    const svc = new ContextAssemblerService(
      makeContextStoreStub(signals as never) as never,
      makeContractStub() as never,
      cache,
      true,
    );

    const result = await svc.assemble({ entityId: 'e-1', requestingAgentId: 'retail-agent' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.signals[0].signalId).toBe('fresh');
      expect(result.value.signals[1].signalId).toBe('old');
    }
    await cache.close();
  });
});
