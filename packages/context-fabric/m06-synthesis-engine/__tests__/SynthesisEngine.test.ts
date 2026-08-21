/**
 * M06 Synthesis Engine — Unit Tests
 *
 * Covers PromptBuilder (determinism, token-budget, content) and
 * SynthesisService (disabled-module guard, LLM invocation, caching).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PromptBuilder } from '../PromptBuilder.js';
import { SynthesisService } from '../SynthesisService.js';
import { ModuleDisabledError } from '../../core/errors.js';
import { InMemoryCache } from '../../adapters/InMemoryCache.js';
import type { AssembledPackage, WeightedSignal } from '../../m05-context-assembler/ContextAssemblerService.js';

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeStubLlm(content = 'Test narrative output') {
  return {
    complete: vi.fn().mockResolvedValue({
      content,
      inputTokens:  100,
      outputTokens:  50,
      modelUsed:    'stub',
    }),
    defaultModel: () => 'stub',
    close: vi.fn(),
  };
}

function makeStubSignal(overrides: Partial<WeightedSignal> = {}): WeightedSignal {
  return {
    signalId:          `sig-${Math.random().toString(36).slice(2)}`,
    idempotencyKey:    'agent:topic:key',
    sourceAgentId:     'retail-agent',
    sourceDomain:      'RETAIL',
    entityId:          'e-1',
    layer:             'SIGNAL',
    propagationClass:  'STANDARD',
    decayClass:        'STANDARD_DECAY',
    scope:             'DOMAIN',
    topic:             'customer.activity',
    payload:           { amount: 100 },
    confidence:        0.9,
    schemaVersion:     '1.0.0',
    contractId:        'retail-agent@1.0.0',
    producedAt:        new Date('2026-01-01T11:00:00Z'),
    weight:            0.85,
    ageHours:          1.0,
    ...overrides,
  };
}

function makeStubPkg(overrides: Partial<AssembledPackage> = {}): AssembledPackage {
  return {
    entityId:          'e-1',
    requestingAgentId: 'retail-agent',
    signals:           [],
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
    assembledAt: new Date('2026-01-01T12:00:00Z'),
    cacheHit:    false,
    ...overrides,
  };
}

// ── PromptBuilder tests ───────────────────────────────────────────────────────

describe('PromptBuilder', () => {
  const builder = new PromptBuilder();

  describe('buildSystemPrompt', () => {
    it('contains a reference to LBG / Lloyds Banking Group', () => {
      const prompt = builder.buildSystemPrompt('retail-agent', 'RETAIL');
      expect(prompt).toMatch(/Lloyds Banking Group|LBG/i);
    });

    it('includes the domain name in the prompt', () => {
      const prompt = builder.buildSystemPrompt('retail-agent', 'RETAIL');
      // Either the domain label "RETAIL" or its descriptor word should appear
      expect(prompt).toMatch(/retail/i);
    });

    it('includes regulatory compliance language (FCA / PRA)', () => {
      const prompt = builder.buildSystemPrompt('compliance-agent', 'RISK');
      expect(prompt).toMatch(/FCA|PRA|regulatory/i);
    });

    it('includes a vulnerable customer reminder', () => {
      const prompt = builder.buildSystemPrompt('collections-agent', 'COLLECTIONS');
      expect(prompt).toMatch(/vulnerab/i);
    });

    it('instructs the model to be grounded in provided signals', () => {
      const prompt = builder.buildSystemPrompt('fraud-agent', 'FRAUD');
      expect(prompt).toMatch(/hallucinate|speculate|grounded|factual/i);
    });

    it('mentions the requesting agentId', () => {
      const agentId = 'my-special-agent-007';
      const prompt = builder.buildSystemPrompt(agentId, 'SHARED');
      expect(prompt).toContain(agentId);
    });

    it('returns a non-empty string for every known domain', () => {
      const domains = [
        'RETAIL', 'FRAUD', 'RISK', 'MORTGAGE',
        'OPERATIONS', 'COLLECTIONS', 'COMMERCIAL', 'SHARED',
      ] as const;
      for (const domain of domains) {
        const prompt = builder.buildSystemPrompt('agent', domain);
        expect(typeof prompt).toBe('string');
        expect(prompt.length).toBeGreaterThan(50);
      }
    });
  });

  describe('buildUserPrompt', () => {
    it('mentions the entityId in the output', () => {
      const pkg    = makeStubPkg({ entityId: 'cust-abc-999' });
      const prompt = builder.buildUserPrompt(pkg);
      expect(prompt).toContain('cust-abc-999');
    });

    it('includes the stats section even with 0 signals', () => {
      const pkg    = makeStubPkg();
      const prompt = builder.buildUserPrompt(pkg);
      expect(prompt).toMatch(/Total Signals\s*:\s*0/);
      expect(prompt).toContain('no signals available');
    });

    it('includes "no active inferences" when inferences is empty', () => {
      const prompt = builder.buildUserPrompt(makeStubPkg());
      expect(prompt).toContain('no active inferences');
    });

    it('includes "no recent decisions" when decisions is empty', () => {
      const prompt = builder.buildUserPrompt(makeStubPkg());
      expect(prompt).toContain('no recent decisions');
    });

    it('includes all 3 signal topics when pkg has 3 signals', () => {
      const signals = [
        makeStubSignal({ topic: 'fraud.alert.raised' }),
        makeStubSignal({ topic: 'customer.vulnerability.detected' }),
        makeStubSignal({ topic: 'risk.score.updated' }),
      ];
      const pkg    = makeStubPkg({ signals, stats: { ...makeStubPkg().stats, totalSignals: 3 } });
      const prompt = builder.buildUserPrompt(pkg);
      expect(prompt).toContain('fraud.alert.raised');
      expect(prompt).toContain('customer.vulnerability.detected');
      expect(prompt).toContain('risk.score.updated');
    });

    it('includes only 15 signals when pkg has 20 (default maxSignals=15)', () => {
      const signals = Array.from({ length: 20 }, (_, i) =>
        makeStubSignal({ topic: `topic.event.${i}`, weight: (20 - i) / 20 }),
      );
      const pkg    = makeStubPkg({ signals, stats: { ...makeStubPkg().stats, totalSignals: 20 } });
      const prompt = builder.buildUserPrompt(pkg);

      // Count how many numbered signal entries appear: lines like "[1] topic=..."
      const matches = prompt.match(/^\[\d+\] topic=/gm) ?? [];
      expect(matches).toHaveLength(15);
    });

    it('respects a custom maxSignals cap', () => {
      const signals = Array.from({ length: 10 }, (_, i) =>
        makeStubSignal({ topic: `topic.event.${i}` }),
      );
      const pkg    = makeStubPkg({ signals, stats: { ...makeStubPkg().stats, totalSignals: 10 } });
      const prompt = builder.buildUserPrompt(pkg, 5);

      const matches = prompt.match(/^\[\d+\] topic=/gm) ?? [];
      expect(matches).toHaveLength(5);
    });

    it('truncates long payloads at 200 characters', () => {
      const longValue = 'x'.repeat(300);
      const signal    = makeStubSignal({ payload: { data: longValue } });
      const pkg       = makeStubPkg({ signals: [signal], stats: { ...makeStubPkg().stats, totalSignals: 1 } });
      const prompt    = builder.buildUserPrompt(pkg);

      // The payload line should not contain all 300 x's
      expect(prompt).not.toContain(longValue);
      expect(prompt).toContain('...');
    });

    it('includes the synthesis request at the end', () => {
      const prompt = builder.buildUserPrompt(makeStubPkg());
      expect(prompt).toMatch(/provide a concise synthesis/i);
      expect(prompt).toMatch(/actionable right now/i);
    });

    it('shows inference type and summary when inferences present', () => {
      const inference = {
        inferenceId:   'inf-1',
        entityId:      'e-1',
        inferenceType: 'financial_difficulty',
        summary:       'Customer shows signs of financial stress.',
        confidence:    0.82,
        evidenceJson:  '[]',
        domain:        'RETAIL',
        isActive:      true,
        isRedacted:    false,
        derivedAt:     new Date(),
        expiresAt:     null,
        createdAt:     new Date(),
      };
      const pkg    = makeStubPkg({ inferences: [inference as never] });
      const prompt = builder.buildUserPrompt(pkg);
      expect(prompt).toContain('financial_difficulty');
      expect(prompt).toContain('Customer shows signs of financial stress.');
    });

    it('shows decision type and outcome when decisions present', () => {
      const decision = {
        decisionId:    'dec-1',
        entityId:      'e-1',
        sourceAgentId: 'collections-agent',
        domain:        'COLLECTIONS',
        decisionType:  'hardship_arrangement',
        outcome:       'APPROVED',
        rationale:     'Customer agreed to a 3-month payment plan.',
        evidenceJson:  '[]',
        contractId:    'collections-agent@1.0.0',
        correlationId: null,
        sessionId:     null,
        isRedacted:    false,
        decidedAt:     new Date(),
        expiresAt:     null,
        createdAt:     new Date(),
      };
      const pkg    = makeStubPkg({ decisions: [decision as never] });
      const prompt = builder.buildUserPrompt(pkg);
      expect(prompt).toContain('hardship_arrangement');
      expect(prompt).toContain('APPROVED');
    });

    it('truncates decision rationale at 150 characters', () => {
      const longRationale = 'R'.repeat(200);
      const decision = {
        decisionId:    'dec-2',
        entityId:      'e-1',
        sourceAgentId: 'risk-agent',
        domain:        'RISK',
        decisionType:  'credit_review',
        outcome:       'DECLINED',
        rationale:     longRationale,
        evidenceJson:  '[]',
        contractId:    'risk-agent@1.0.0',
        correlationId: null,
        sessionId:     null,
        isRedacted:    false,
        decidedAt:     new Date(),
        expiresAt:     null,
        createdAt:     new Date(),
      };
      const pkg    = makeStubPkg({ decisions: [decision as never] });
      const prompt = builder.buildUserPrompt(pkg);
      expect(prompt).not.toContain(longRationale);
      expect(prompt).toContain('...');
    });
  });
});

// ── SynthesisService tests ────────────────────────────────────────────────────

describe('SynthesisService', () => {
  let cache: InMemoryCache;

  beforeEach(() => {
    cache = new InMemoryCache();
  });

  afterEach(async () => {
    await cache.close();
  });

  it('returns ModuleDisabledError when disabled', async () => {
    const llm = makeStubLlm();
    const svc = new SynthesisService(llm as never, cache, false);
    const pkg = makeStubPkg();

    const result = await svc.synthesise(pkg);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ModuleDisabledError);
      expect(result.error.message).toMatch(/M06_SYNTHESIS_ENGINE/);
    }
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it('calls LLM with system prompt and user message on cache miss', async () => {
    const llm = makeStubLlm();
    const svc = new SynthesisService(llm as never, cache, true);
    const pkg = makeStubPkg();

    const result = await svc.synthesise(pkg);

    expect(result.ok).toBe(true);
    expect(llm.complete).toHaveBeenCalledOnce();

    const callArg = llm.complete.mock.calls[0][0] as {
      messages: Array<{ role: string; content: string }>;
      systemPrompt: string;
      maxTokens: number;
      temperature: number;
    };

    // System prompt should be populated
    expect(typeof callArg.systemPrompt).toBe('string');
    expect(callArg.systemPrompt!.length).toBeGreaterThan(0);

    // Messages should contain one user turn
    expect(callArg.messages).toHaveLength(1);
    expect(callArg.messages[0].role).toBe('user');
    expect(callArg.messages[0].content).toContain('e-1'); // entityId

    // Token budget and temperature
    expect(callArg.maxTokens).toBe(600);
    expect(callArg.temperature).toBe(0.1);
  });

  it('returns cacheHit=false on first call', async () => {
    const svc = new SynthesisService(makeStubLlm() as never, cache, true);
    const pkg = makeStubPkg();

    const result = await svc.synthesise(pkg);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.cacheHit).toBe(false);
    }
  });

  it('returns cacheHit=true on second call with the same package', async () => {
    const llm = makeStubLlm();
    const svc = new SynthesisService(llm as never, cache, true);
    const pkg = makeStubPkg();

    await svc.synthesise(pkg);          // first call — cache miss
    const second = await svc.synthesise(pkg); // second call — cache hit

    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.value.cacheHit).toBe(true);
    }

    // LLM should only have been called once
    expect(llm.complete).toHaveBeenCalledOnce();
  });

  it('returns a non-negative synthesisMs', async () => {
    const svc    = new SynthesisService(makeStubLlm() as never, cache, true);
    const result = await svc.synthesise(makeStubPkg());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.synthesisMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('returned narrative matches what the LLM stub returned', async () => {
    const narrative = 'The customer has shown consistent responsible behaviour over the past quarter.';
    const svc       = new SynthesisService(makeStubLlm(narrative) as never, cache, true);
    const result    = await svc.synthesise(makeStubPkg());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.narrative).toBe(narrative);
    }
  });

  it('populates entityId and requestingAgentId correctly', async () => {
    const svc = new SynthesisService(makeStubLlm() as never, cache, true);
    const pkg = makeStubPkg({ entityId: 'ent-xyz', requestingAgentId: 'fraud-agent' });

    const result = await svc.synthesise(pkg);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.entityId).toBe('ent-xyz');
      expect(result.value.requestingAgentId).toBe('fraud-agent');
    }
  });

  it('populates modelUsed, inputTokens, outputTokens from LLM response', async () => {
    const svc    = new SynthesisService(makeStubLlm() as never, cache, true);
    const result = await svc.synthesise(makeStubPkg());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.modelUsed).toBe('stub');
      expect(result.value.inputTokens).toBe(100);
      expect(result.value.outputTokens).toBe(50);
    }
  });

  it('different packages (different assembledAt) produce separate cache entries', async () => {
    const llm = makeStubLlm();
    const svc = new SynthesisService(llm as never, cache, true);

    const pkg1 = makeStubPkg({ assembledAt: new Date('2026-01-01T10:00:00Z') });
    const pkg2 = makeStubPkg({ assembledAt: new Date('2026-01-01T11:00:00Z') });

    await svc.synthesise(pkg1);
    await svc.synthesise(pkg2);

    // Both should be cache misses — two LLM calls
    expect(llm.complete).toHaveBeenCalledTimes(2);
  });

  it('invalidate() flushes the cache for the given entityId', async () => {
    const llm = makeStubLlm();
    const svc = new SynthesisService(llm as never, cache, true);
    const pkg = makeStubPkg({ entityId: 'e-flush' });

    await svc.synthesise(pkg);    // populates cache
    await svc.invalidate('e-flush');
    await svc.synthesise(pkg);    // should be a cache miss again

    expect(llm.complete).toHaveBeenCalledTimes(2);
  });

  it('synthesisedAt is a Date instance', async () => {
    const svc    = new SynthesisService(makeStubLlm() as never, cache, true);
    const result = await svc.synthesise(makeStubPkg());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.synthesisedAt).toBeInstanceOf(Date);
    }
  });

  it('synthesisedAt restored as Date on cache hit', async () => {
    const svc = new SynthesisService(makeStubLlm() as never, cache, true);
    const pkg = makeStubPkg();

    await svc.synthesise(pkg);          // prime the cache
    const second = await svc.synthesise(pkg);

    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.value.synthesisedAt).toBeInstanceOf(Date);
    }
  });

  it('accepts a custom PromptBuilder injection', async () => {
    const customBuilder = new PromptBuilder();
    const buildSpy      = vi.spyOn(customBuilder, 'buildUserPrompt');
    const llm           = makeStubLlm();
    const svc           = new SynthesisService(llm as never, cache, true, customBuilder);

    await svc.synthesise(makeStubPkg());

    expect(buildSpy).toHaveBeenCalledOnce();
  });
});
