/**
 * M04 Signal Broker — Unit Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { EventEmitterBroker } from '../../adapters/EventEmitterBroker.js';
import { SignalBrokerService } from '../SignalBrokerService.js';
import { ModuleDisabledError } from '../../core/errors.js';
import type { Signal } from '../../core/types.js';
import { randomUUID } from 'crypto';

// ── Stubs ─────────────────────────────────────────────────────────────────────

const CONTRACT_STUB = {
  findByAgentId: vi.fn().mockResolvedValue({
    ok: true,
    value: {
      agentId: 'retail-agent',
      allowedTopicsSubscribe: ['customer.#', 'fraud.*'],
      maxSignalRatePerMinute: 100,
    },
  }),
  validatePublish: vi.fn().mockResolvedValue({ ok: true, value: {} }),
};

function makeSignal(topic = 'fraud.alert.raised'): Signal {
  return {
    signalId:        randomUUID(),
    idempotencyKey:  randomUUID(),
    sourceAgentId:   'fraud-agent',
    sourceDomain:    'FRAUD',
    entityId:        randomUUID(),
    layer:           'SIGNAL',
    propagationClass:'STANDARD',
    decayClass:      'STANDARD_DECAY',
    scope:           'DOMAIN',
    topic,
    payload:         {},
    confidence:      0.9,
    schemaVersion:   '1.0.0',
    contractId:      'fraud-agent@1.0.0',
    producedAt:      new Date(),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SignalBrokerService', () => {

  describe('publish()', () => {
    it('routes a STANDARD signal to matching subscribers', async () => {
      const broker   = new EventEmitterBroker();
      const svc      = new SignalBrokerService(broker, CONTRACT_STUB as never, true);

      const received: Signal[] = [];
      // fraud.* matches one segment: "fraud.alert" — use # for any depth
      await broker.subscribe('fraud.#', 'retail-agent', async s => { received.push(s); });

      const signal = makeSignal('fraud.alert.raised');
      const result = await svc.publish(signal);
      expect(result.ok).toBe(true);

      // STANDARD = fire-and-forget; give microtask queue a tick to flush handlers
      await new Promise(r => setTimeout(r, 10));
      expect(received.length).toBeGreaterThan(0);
      expect(received[0].topic).toBe('fraud.alert.raised');

      await broker.close();
    });

    it('silently drops SILENT signals without routing', async () => {
      const broker = new EventEmitterBroker();
      const svc    = new SignalBrokerService(broker, CONTRACT_STUB as never, true);

      const received: Signal[] = [];
      await broker.subscribe('fraud.#', 'retail-agent', async s => { received.push(s); });

      const signal = makeSignal('fraud.alert.raised');
      await svc.publish({ ...signal, propagationClass: 'SILENT' });

      await new Promise(r => setTimeout(r, 0));
      expect(received).toHaveLength(0);

      await broker.close();
    });

    it('returns ModuleDisabledError when disabled', async () => {
      const broker = new EventEmitterBroker();
      const svc    = new SignalBrokerService(broker, CONTRACT_STUB as never, false);

      const result = await svc.publish(makeSignal());
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.error).toBeInstanceOf(ModuleDisabledError);

      await broker.close();
    });
  });

  describe('subscribe()', () => {
    it('returns a subscriptionId on successful subscription', async () => {
      const broker = new EventEmitterBroker();
      const svc    = new SignalBrokerService(broker, CONTRACT_STUB as never, true);

      const result = await svc.subscribe({
        agentId:      'retail-agent',
        topicPattern: 'fraud.*',
        handler:      async () => {},
      });

      expect(result.ok).toBe(true);
      if (result.ok) expect(typeof result.value).toBe('string');

      await broker.close();
    });
  });

  describe('stats()', () => {
    it('returns broker statistics', async () => {
      const broker = new EventEmitterBroker();
      const svc    = new SignalBrokerService(broker, CONTRACT_STUB as never, true);

      const result = await svc.stats();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(typeof result.value.published).toBe('number');
        expect(typeof result.value.activeSubscriptions).toBe('number');
      }

      await broker.close();
    });
  });
});
