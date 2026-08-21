/**
 * M07 Inference Engine — Unit Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { FinancialDifficultyRule } from '../rules/FinancialDifficultyRule.js';
import { VulnerabilityRule } from '../rules/VulnerabilityRule.js';
import { FraudRiskRule } from '../rules/FraudRiskRule.js';
import { InferenceEngineService } from '../InferenceEngineService.js';
import { ModuleDisabledError } from '../../core/errors.js';
import type { InferenceInput, ExistingInference } from '../InferenceRule.js';
import type { WeightedSignal } from '../../m05-context-assembler/ContextAssemblerService.js';
import { SignalLayer, PropagationClass, DecayClass, ContextScope } from '../../core/types.js';

// ── Test helpers ─────────────────────────────────────────────────────────────

function makeSignal(topic: string, weight = 0.8, signalId = `sig-${topic}`): WeightedSignal {
  return {
    signalId,
    idempotencyKey:   `k-${signalId}`,
    sourceAgentId:    'test-agent',
    sourceDomain:     'RETAIL',
    entityId:         'e-1',
    layer:            SignalLayer.SIGNAL,
    propagationClass: PropagationClass.STANDARD,
    decayClass:       DecayClass.STANDARD_DECAY,
    scope:            ContextScope.DOMAIN,
    topic,
    payload:          {},
    confidence:       0.9,
    schemaVersion:    '1.0.0',
    contractId:       'c-1',
    producedAt:       new Date(),
    weight,
    ageHours:         1,
  };
}

function makeInput(
  signals: WeightedSignal[],
  existing: ExistingInference[] = [],
): InferenceInput {
  return {
    entityId: 'e-1',
    signals,
    existing,
    asOf: new Date(),
  };
}

function makeDbStub() {
  return {
    select: vi.fn().mockReturnThis(),
    from:   vi.fn().mockReturnThis(),
    where:  vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined),
  };
}

// ── FinancialDifficultyRule ───────────────────────────────────────────────────

describe('FinancialDifficultyRule', () => {
  const rule = new FinancialDifficultyRule();

  it('ruleId is financial_difficulty', () => {
    expect(rule.ruleId).toBe('financial_difficulty');
  });

  it('does not fire when fewer than 2 matching signals', () => {
    const input = makeInput([makeSignal('payment.missed')]);
    expect(rule.evaluate(input)).toBeNull();
  });

  it('fires when 2 or more matching signals are present', () => {
    const input = makeInput([
      makeSignal('payment.missed', 0.8, 'sig-1'),
      makeSignal('payment.late',   0.7, 'sig-2'),
    ]);
    const output = rule.evaluate(input);
    expect(output).not.toBeNull();
    expect(output?.inferenceType).toBe('financial_difficulty');
    expect(output?.evidenceSignalIds).toContain('sig-1');
    expect(output?.evidenceSignalIds).toContain('sig-2');
  });

  it('fires on hardship and arrears topics', () => {
    const input = makeInput([
      makeSignal('customer.hardship.declared', 0.9, 's1'),
      makeSignal('account.arrears.updated',    0.8, 's2'),
    ]);
    expect(rule.evaluate(input)).not.toBeNull();
  });

  it('confidence is clamped to [0.5, 0.95]', () => {
    const input = makeInput([
      makeSignal('payment.missed', 0.99, 's1'),
      makeSignal('payment.late',   0.99, 's2'),
    ]);
    const output = rule.evaluate(input);
    expect(output!.confidence).toBeLessThanOrEqual(0.95);
    expect(output!.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('does not fire when existing inference has confidence >= 0.7', () => {
    const input = makeInput(
      [makeSignal('payment.missed', 0.8, 's1'), makeSignal('payment.late', 0.7, 's2')],
      [{ inferenceId: 'i-1', inferenceType: 'financial_difficulty', confidence: 0.75, derivedAt: new Date() }],
    );
    expect(rule.evaluate(input)).toBeNull();
  });

  it('fires when existing inference has confidence < 0.7 (below suppression threshold)', () => {
    const input = makeInput(
      [makeSignal('payment.missed', 0.8, 's1'), makeSignal('payment.late', 0.7, 's2')],
      [{ inferenceId: 'i-1', inferenceType: 'financial_difficulty', confidence: 0.5, derivedAt: new Date() }],
    );
    expect(rule.evaluate(input)).not.toBeNull();
  });

  it('ignores non-matching signals', () => {
    const input = makeInput([
      makeSignal('payment.missed', 0.8, 's1'),
      makeSignal('account.balance.changed', 0.9, 's2'), // not a distress topic
    ]);
    // Only 1 matching signal — should not fire
    expect(rule.evaluate(input)).toBeNull();
  });

  it('expiresInDays is 90', () => {
    const input = makeInput([
      makeSignal('payment.missed', 0.8, 's1'),
      makeSignal('arrears.escalated', 0.8, 's2'),
    ]);
    expect(rule.evaluate(input)?.expiresInDays).toBe(90);
  });
});

// ── VulnerabilityRule ─────────────────────────────────────────────────────────

describe('VulnerabilityRule', () => {
  const rule = new VulnerabilityRule();

  it('ruleId is customer_vulnerability', () => {
    expect(rule.ruleId).toBe('customer_vulnerability');
  });

  it('fires on a single vulnerability signal', () => {
    const input = makeInput([makeSignal('customer.vulnerability.detected', 0.85)]);
    const output = rule.evaluate(input);
    expect(output).not.toBeNull();
    expect(output?.inferenceType).toBe('customer_vulnerability');
  });

  it('fires on mental.health topic', () => {
    const input = makeInput([makeSignal('customer.mental.health.concern', 0.7)]);
    expect(rule.evaluate(input)).not.toBeNull();
  });

  it('fires on bereavement topic', () => {
    const input = makeInput([makeSignal('life.bereavement.reported', 0.8)]);
    expect(rule.evaluate(input)).not.toBeNull();
  });

  it('does not fire with no matching signals', () => {
    const input = makeInput([makeSignal('account.balance.changed', 0.9)]);
    expect(rule.evaluate(input)).toBeNull();
  });

  it('confidence is clamped to [0.6, 0.95]', () => {
    const input = makeInput([makeSignal('customer.vulnerability.detected', 0.01)]);
    expect(rule.evaluate(input)!.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it('uses max weight of matching signals for confidence', () => {
    const input = makeInput([
      makeSignal('customer.vulnerability.detected', 0.7,  's1'),
      makeSignal('customer.mental.health.concern',  0.85, 's2'),
    ]);
    // max weight = 0.85, clamped to 0.85
    expect(rule.evaluate(input)!.confidence).toBeCloseTo(0.85, 2);
  });

  it('does not fire when existing inference has confidence >= 0.8', () => {
    const input = makeInput(
      [makeSignal('customer.vulnerability.detected', 0.9)],
      [{ inferenceId: 'i-1', inferenceType: 'customer_vulnerability', confidence: 0.85, derivedAt: new Date() }],
    );
    expect(rule.evaluate(input)).toBeNull();
  });

  it('expiresInDays is 180', () => {
    const input = makeInput([makeSignal('customer.vulnerability.detected', 0.8)]);
    expect(rule.evaluate(input)?.expiresInDays).toBe(180);
  });
});

// ── FraudRiskRule ─────────────────────────────────────────────────────────────

describe('FraudRiskRule', () => {
  const rule = new FraudRiskRule();

  it('ruleId is fraud_risk', () => {
    expect(rule.ruleId).toBe('fraud_risk');
  });

  it('fires on a single fraud.confirmed signal (immediate path)', () => {
    const input = makeInput([makeSignal('fraud.confirmed', 0.99)]);
    const output = rule.evaluate(input);
    expect(output).not.toBeNull();
    expect(output?.inferenceType).toBe('fraud_risk');
  });

  it('fires on a single fraud.block signal', () => {
    const input = makeInput([makeSignal('fraud.block.applied', 0.95)]);
    expect(rule.evaluate(input)).not.toBeNull();
  });

  it('fires on 2 general fraud signals (corroborated path)', () => {
    const input = makeInput([
      makeSignal('transaction.suspicious.detected', 0.7, 's1'),
      makeSignal('device.anomaly.detected',         0.6, 's2'),
    ]);
    expect(rule.evaluate(input)).not.toBeNull();
  });

  it('does not fire on single general signal (requires 2)', () => {
    const input = makeInput([makeSignal('transaction.suspicious.detected', 0.9)]);
    expect(rule.evaluate(input)).toBeNull();
  });

  it('does not fire with no relevant signals', () => {
    const input = makeInput([makeSignal('account.balance.changed', 0.9)]);
    expect(rule.evaluate(input)).toBeNull();
  });

  it('confidence is highest weight × 0.9, clamped to [0.5, 0.99]', () => {
    const input = makeInput([makeSignal('fraud.confirmed', 0.9)]);
    const output = rule.evaluate(input);
    expect(output!.confidence).toBeCloseTo(0.9 * 0.9, 2);
  });

  it('does not fire when existing inference has confidence >= 0.85', () => {
    const input = makeInput(
      [makeSignal('fraud.confirmed', 0.99)],
      [{ inferenceId: 'i-1', inferenceType: 'fraud_risk', confidence: 0.9, derivedAt: new Date() }],
    );
    expect(rule.evaluate(input)).toBeNull();
  });

  it('expiresInDays is 30', () => {
    const input = makeInput([makeSignal('fraud.confirmed', 0.9)]);
    expect(rule.evaluate(input)?.expiresInDays).toBe(30);
  });
});

// ── InferenceEngineService ────────────────────────────────────────────────────

describe('InferenceEngineService', () => {
  it('returns ModuleDisabledError when disabled', async () => {
    const svc = new InferenceEngineService(makeDbStub() as never, [], false);
    const result = await svc.evaluate('e-1', []);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toBeInstanceOf(ModuleDisabledError);
  });

  it('getActiveInferences returns ModuleDisabledError when disabled', async () => {
    const svc = new InferenceEngineService(makeDbStub() as never, [], false);
    const result = await svc.getActiveInferences('e-1');
    expect(result.ok).toBe(false);
  });

  it('returns empty array when no rules fire', async () => {
    const db = makeDbStub();
    const svc = new InferenceEngineService(db as never, [new FinancialDifficultyRule()], true);
    // Only 1 payment signal → FinancialDifficultyRule needs 2 → no fire
    const result = await svc.evaluate('e-1', [makeSignal('payment.missed', 0.8)]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toHaveLength(0);
  });

  it('persists inference when a rule fires', async () => {
    const db = makeDbStub();
    const svc = new InferenceEngineService(
      db as never,
      [new FinancialDifficultyRule()],
      true,
    );
    const signals = [
      makeSignal('payment.missed', 0.8, 's1'),
      makeSignal('payment.late',   0.7, 's2'),
    ];
    const result = await svc.evaluate('e-1', signals);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0].inferenceType).toBe('financial_difficulty');
    }
    // DB insert should have been called
    expect(db.insert).toHaveBeenCalledWith(expect.anything());
  });

  it('skips persisting when existing inference has equal or higher confidence', async () => {
    // DB returns an existing high-confidence inference
    const existingRow = {
      inferenceId:   'i-existing',
      entityId:      'e-1',
      inferenceType: 'financial_difficulty',
      summary:       'Existing inference',
      confidence:    0.85, // higher than what the rule would derive
      evidenceJson:  '[]',
      domain:        'COLLECTIONS',
      isActive:      true,
      isRedacted:    false,
      derivedAt:     new Date(),
      expiresAt:     null,
      createdAt:     new Date(),
    };
    const db = {
      ...makeDbStub(),
      where: vi.fn().mockResolvedValue([existingRow]),
    };

    const svc = new InferenceEngineService(
      db as never,
      [new FinancialDifficultyRule()],
      true,
    );
    const signals = [
      makeSignal('payment.missed', 0.75, 's1'), // avg weight 0.75 < 0.85 existing
      makeSignal('payment.late',   0.75, 's2'),
    ];
    const result = await svc.evaluate('e-1', signals);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toHaveLength(0);
    // insert should NOT have been called
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('runs multiple rules and persists all that fire', async () => {
    const db = makeDbStub();
    const svc = new InferenceEngineService(
      db as never,
      [new FinancialDifficultyRule(), new VulnerabilityRule(), new FraudRiskRule()],
      true,
    );
    const signals = [
      makeSignal('payment.missed',               0.8, 's1'),
      makeSignal('payment.late',                 0.8, 's2'),
      makeSignal('customer.vulnerability.detected', 0.9, 's3'),
      makeSignal('fraud.confirmed',              0.99, 's4'),
    ];
    const result = await svc.evaluate('e-1', signals);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // All three rules should fire
      expect(result.value.length).toBe(3);
      const types = result.value.map(r => r.inferenceType);
      expect(types).toContain('financial_difficulty');
      expect(types).toContain('customer_vulnerability');
      expect(types).toContain('fraud_risk');
    }
  });
});
