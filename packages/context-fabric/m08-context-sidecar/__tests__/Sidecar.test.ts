/**
 * M08 Context Sidecar — Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  Signal,
  SignalLayer,
  PropagationClass,
  DecayClass,
  ContextScope,
} from '../../core/types.js';
import { ModuleDisabledError } from '../../core/errors.js';
import { DeltaQueue } from '../DeltaQueue.js';
import { SessionRegistry } from '../SessionRegistry.js';
import { SidecarService } from '../SidecarService.js';

// ── Stub factories ────────────────────────────────────────────────────────────

function makeStubAssembler(signals: Signal[] = []) {
  return {
    assemble: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        entityId:          'e-1',
        requestingAgentId: 'retail-agent',
        signals,
        inferences:        [],
        decisions:         [],
        stats: {
          totalSignals:   0,
          domainsPresent: [],
          latestSignalAt: null,
          oldestSignalAt: null,
          avgConfidence:  0,
          topTopics:      [],
        },
        assembledAt: new Date(),
        cacheHit:    false,
      },
    }),
    invalidate: vi.fn(),
  };
}

function makeStubSynthesis() {
  return {
    synthesise: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        entityId:          'e-1',
        requestingAgentId: 'retail-agent',
        narrative:         'Test narrative',
        modelUsed:         'stub',
        inputTokens:       10,
        outputTokens:      20,
        synthesisMs:       50,
        cacheHit:          false,
        synthesisedAt:     new Date(),
      },
    }),
    invalidate: vi.fn(),
  };
}

function makeSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    signalId:        'sig-1',
    idempotencyKey:  'k1',
    sourceAgentId:   'retail-agent',
    sourceDomain:    'RETAIL',
    entityId:        'e-1',
    layer:           SignalLayer.SIGNAL,
    propagationClass: PropagationClass.STANDARD,
    decayClass:      DecayClass.STANDARD_DECAY,
    scope:           ContextScope.DOMAIN,
    topic:           'customer.event',
    payload:         {},
    confidence:      0.9,
    schemaVersion:   '1.0.0',
    contractId:      'c-1',
    producedAt:      new Date(),
    ...overrides,
  } as Signal;
}

// ── DeltaQueue tests ──────────────────────────────────────────────────────────

describe('DeltaQueue', () => {
  it('push() and drain() cycle: push 3 signals, drain returns all 3', () => {
    const q  = new DeltaQueue('session-1');
    const s1 = makeSignal({ signalId: 'sig-1' });
    const s2 = makeSignal({ signalId: 'sig-2' });
    const s3 = makeSignal({ signalId: 'sig-3' });

    q.push(s1);
    q.push(s2);
    q.push(s3);

    const drained = q.drain();
    expect(drained).toHaveLength(3);
    expect(drained.map(s => s.signalId)).toEqual(['sig-1', 'sig-2', 'sig-3']);
  });

  it('subsequent drain after empty returns []', () => {
    const q = new DeltaQueue('session-1');
    q.push(makeSignal());
    q.drain();               // first drain empties the queue
    expect(q.drain()).toEqual([]);
  });

  it('peek() returns current contents without clearing the queue', () => {
    const q = new DeltaQueue('session-1');
    q.push(makeSignal({ signalId: 'sig-a' }));
    q.push(makeSignal({ signalId: 'sig-b' }));

    const peeked = q.peek();
    expect(peeked).toHaveLength(2);

    // Queue must still be intact after peek
    expect(q.size()).toBe(2);
    expect(q.drain()).toHaveLength(2);
  });

  it('size() reflects current queue length', () => {
    const q = new DeltaQueue('session-1');
    expect(q.size()).toBe(0);
    q.push(makeSignal());
    expect(q.size()).toBe(1);
    q.push(makeSignal());
    expect(q.size()).toBe(2);
    q.drain();
    expect(q.size()).toBe(0);
  });

  it('buffer cap: push maxSize+1 signals, size() === maxSize (oldest dropped)', () => {
    const MAX  = 5;
    const q    = new DeltaQueue('session-cap', MAX);

    for (let i = 0; i < MAX + 1; i++) {
      q.push(makeSignal({ signalId: `sig-${i}` }));
    }

    expect(q.size()).toBe(MAX);

    // The oldest signal (sig-0) should have been evicted; newest wins
    const contents = q.peek();
    const ids      = contents.map(s => s.signalId);
    expect(ids).not.toContain('sig-0');
    expect(ids).toContain(`sig-${MAX}`);
  });
});

// ── SessionRegistry tests ─────────────────────────────────────────────────────

describe('SessionRegistry', () => {
  let registry: SessionRegistry;

  beforeEach(() => {
    registry = new SessionRegistry();
  });

  it('register() creates a session with all expected fields', () => {
    const entry = registry.register('sess-1', 'agent-x', 'entity-1', 'CONVERSATIONAL');

    expect(entry.sessionId).toBe('sess-1');
    expect(entry.agentId).toBe('agent-x');
    expect(entry.entityId).toBe('entity-1');
    expect(entry.sessionType).toBe('CONVERSATIONAL');
    expect(entry.startedAt).toBeInstanceOf(Date);
    expect(entry.lastActiveAt).toBeInstanceOf(Date);
    expect(entry.queue).toBeInstanceOf(DeltaQueue);
  });

  it('register() throws if sessionId already registered', () => {
    registry.register('sess-dup', 'agent-x', 'entity-1', 'CONVERSATIONAL');
    expect(() => registry.register('sess-dup', 'agent-x', 'entity-1', 'CONVERSATIONAL'))
      .toThrow(/already registered/);
  });

  it('get() returns the registered entry', () => {
    registry.register('sess-2', 'agent-y', 'entity-2', 'WORKFLOW');
    const found = registry.get('sess-2');
    expect(found).toBeDefined();
    expect(found!.agentId).toBe('agent-y');
  });

  it('get() returns undefined for unknown sessionId', () => {
    expect(registry.get('no-such-session')).toBeUndefined();
  });

  it('touch() updates lastActiveAt', async () => {
    registry.register('sess-3', 'agent-z', 'entity-3', 'CONVERSATIONAL');
    const before = registry.get('sess-3')!.lastActiveAt;

    // Ensure a measurable tick passes
    await new Promise(r => setTimeout(r, 5));
    registry.touch('sess-3');

    const after = registry.get('sess-3')!.lastActiveAt;
    expect(after.getTime()).toBeGreaterThan(before.getTime());
  });

  it('unregister() removes the session; get() returns undefined after', () => {
    registry.register('sess-4', 'agent-a', 'entity-4', 'CONVERSATIONAL');
    registry.unregister('sess-4');
    expect(registry.get('sess-4')).toBeUndefined();
    expect(registry.size()).toBe(0);
  });

  it('purgeExpired() removes sessions past idle timeout', async () => {
    // Create a registry with a very short idle timeout (1 ms)
    const shortRegistry = new SessionRegistry(1);
    shortRegistry.register('sess-old', 'agent-b', 'entity-5', 'CONVERSATIONAL');

    // Wait for the session to expire
    await new Promise(r => setTimeout(r, 10));

    const removed = shortRegistry.purgeExpired();
    expect(removed).toBe(1);
    expect(shortRegistry.size()).toBe(0);
  });

  it('purgeExpired() leaves active sessions untouched', async () => {
    const shortRegistry = new SessionRegistry(50);
    shortRegistry.register('sess-live', 'agent-c', 'entity-6', 'CONVERSATIONAL');

    // Purge immediately — session is still fresh
    const removed = shortRegistry.purgeExpired();
    expect(removed).toBe(0);
    expect(shortRegistry.size()).toBe(1);
  });
});

// ── SidecarService tests ──────────────────────────────────────────────────────

describe('SidecarService', () => {
  const SESSION_ID = 'test-session-1';
  const AGENT_ID   = 'retail-agent';
  const ENTITY_ID  = 'e-1';

  function makeSidecar(
    enabled = true,
    synthesisService: ReturnType<typeof makeStubSynthesis> | null = null,
  ) {
    const assembler = makeStubAssembler();
    const registry  = new SessionRegistry();
    const svc       = new SidecarService(
      assembler as unknown as Parameters<typeof SidecarService>[0],
      synthesisService as unknown as Parameters<typeof SidecarService>[1],
      registry,
      enabled,
    );
    return { svc, assembler, registry };
  }

  it('startSession() returns ModuleDisabledError when disabled', () => {
    const { svc } = makeSidecar(false);
    const result  = svc.startSession({ sessionId: SESSION_ID, agentId: AGENT_ID, entityId: ENTITY_ID, sessionType: 'CONVERSATIONAL' });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toBeInstanceOf(ModuleDisabledError);
  });

  it('startSession() registers a session and returns ok(entry)', () => {
    const { svc } = makeSidecar();
    const result  = svc.startSession({ sessionId: SESSION_ID, agentId: AGENT_ID, entityId: ENTITY_ID, sessionType: 'CONVERSATIONAL' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.sessionId).toBe(SESSION_ID);
      expect(result.value.agentId).toBe(AGENT_ID);
      expect(result.value.entityId).toBe(ENTITY_ID);
    }
  });

  it('pushSignal() drops silently for unknown sessionId (no throw)', () => {
    const { svc } = makeSidecar();
    expect(() => svc.pushSignal('unknown-session', makeSignal())).not.toThrow();
  });

  it('pushSignal() adds the signal to the session queue', () => {
    const { svc, registry } = makeSidecar();
    svc.startSession({ sessionId: SESSION_ID, agentId: AGENT_ID, entityId: ENTITY_ID, sessionType: 'CONVERSATIONAL' });

    svc.pushSignal(SESSION_ID, makeSignal({ signalId: 'pushed-sig' }));

    const entry = registry.get(SESSION_ID)!;
    expect(entry.queue.size()).toBe(1);
    expect(entry.queue.peek()[0].signalId).toBe('pushed-sig');
  });

  it('getContext() drains queue and calls assembler.assemble()', async () => {
    const { svc, assembler } = makeSidecar();
    svc.startSession({ sessionId: SESSION_ID, agentId: AGENT_ID, entityId: ENTITY_ID, sessionType: 'CONVERSATIONAL' });

    svc.pushSignal(SESSION_ID, makeSignal({ signalId: 'q-sig-1' }));
    svc.pushSignal(SESSION_ID, makeSignal({ signalId: 'q-sig-2' }));

    const result = await svc.getContext(SESSION_ID);

    expect(result.ok).toBe(true);
    expect(assembler.assemble).toHaveBeenCalledOnce();
    expect(assembler.assemble).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: ENTITY_ID, requestingAgentId: AGENT_ID }),
    );
  });

  it('getContext() returns deltaSignals equal to the drained signals', async () => {
    const { svc } = makeSidecar();
    svc.startSession({ sessionId: SESSION_ID, agentId: AGENT_ID, entityId: ENTITY_ID, sessionType: 'CONVERSATIONAL' });

    const sig1 = makeSignal({ signalId: 'delta-sig-1' });
    const sig2 = makeSignal({ signalId: 'delta-sig-2' });
    svc.pushSignal(SESSION_ID, sig1);
    svc.pushSignal(SESSION_ID, sig2);

    const result = await svc.getContext(SESSION_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.deltaSignals).toHaveLength(2);
      expect(result.value.deltaSignals.map(s => s.signalId)).toEqual(['delta-sig-1', 'delta-sig-2']);
    }
  });

  it('getContext() calls synthesis service when provided', async () => {
    const synthesis = makeStubSynthesis();
    const { svc }   = makeSidecar(true, synthesis);
    svc.startSession({ sessionId: SESSION_ID, agentId: AGENT_ID, entityId: ENTITY_ID, sessionType: 'CONVERSATIONAL' });

    const result = await svc.getContext(SESSION_ID);

    expect(result.ok).toBe(true);
    expect(synthesis.synthesise).toHaveBeenCalledOnce();
    if (result.ok) {
      expect(result.value.synthesis).toBeDefined();
      expect(result.value.synthesis!.narrative).toBe('Test narrative');
    }
  });

  it('getContext() skips synthesis when no synthesis service provided', async () => {
    const { svc } = makeSidecar(true, null);
    svc.startSession({ sessionId: SESSION_ID, agentId: AGENT_ID, entityId: ENTITY_ID, sessionType: 'CONVERSATIONAL' });

    const result = await svc.getContext(SESSION_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.synthesis).toBeUndefined();
    }
  });

  it('getContext() returns error for unknown sessionId', async () => {
    const { svc } = makeSidecar();
    const result  = await svc.getContext('no-such-session');

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error.message).toMatch(/Session not found/);
  });

  it('getContext() returns ModuleDisabledError when disabled', async () => {
    const { svc } = makeSidecar(false);
    const result  = await svc.getContext(SESSION_ID);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toBeInstanceOf(ModuleDisabledError);
  });

  it('queue is empty after getContext() drains it', async () => {
    const { svc, registry } = makeSidecar();
    svc.startSession({ sessionId: SESSION_ID, agentId: AGENT_ID, entityId: ENTITY_ID, sessionType: 'CONVERSATIONAL' });

    svc.pushSignal(SESSION_ID, makeSignal());
    await svc.getContext(SESSION_ID);

    const entry = registry.get(SESSION_ID)!;
    expect(entry.queue.size()).toBe(0);
  });

  it('purgeExpiredSessions() delegates to registry.purgeExpired()', async () => {
    const { svc } = makeSidecar();
    // Registry has a 30-min timeout by default; nothing to purge immediately
    const count = svc.purgeExpiredSessions();
    expect(count).toBe(0);
  });
});
