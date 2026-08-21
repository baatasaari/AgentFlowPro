/**
 * M07 Inference Engine — FraudRiskRule
 *
 * Fires when signals indicate elevated fraud risk for an entity.
 * Two firing paths:
 *
 *   IMMEDIATE  — any single signal with topic containing "fraud.confirmed" or
 *                "fraud.block" is sufficient. These are deterministic outcomes
 *                from upstream fraud systems and need no corroboration.
 *
 *   CORROBORATED — two or more signals containing "fraud", "suspicious",
 *                  "anomaly", or "risk.elevated" must be present. Isolated
 *                  anomalies are common; corroboration reduces false positives.
 *
 * Banking context (LBG): output triggers the Fraud Operations overlay and
 * may result in a PropagationClass.IMMEDIATE signal being re-emitted to
 * block transactions and alert the customer.
 *
 * Short TTL (30 days) reflects that fraud situations resolve quickly —
 * either confirmed and actioned, or cleared by the fraud team.
 */

import type { InferenceInput, InferenceOutput, InferenceRule } from '../InferenceRule.js';
import type { SignalDomain } from '../../core/types.js';

/**
 * Topics that alone are sufficient to fire the rule.
 * These come from authoritative fraud systems, not heuristic detection.
 */
const IMMEDIATE_TOPICS: readonly string[] = [
  'fraud.confirmed',
  'fraud.block',
] as const;

/**
 * Topics that contribute to the corroborated path (requires 2 or more).
 * Note: 'fraud' is intentionally broad — it also matches 'fraud.confirmed'
 * and 'fraud.block', so the Set deduplication in allMatching handles overlap.
 */
const GENERAL_TOPICS: readonly string[] = [
  'fraud',
  'suspicious',
  'anomaly',
  'risk.elevated',
] as const;

/** Minimum number of general-topic signals required when no immediate signal. */
const MIN_GENERAL_SIGNALS = 2;

/** Confidence = highest signal weight × this factor. Fraud is serious but never certain. */
const WEIGHT_SCALE_FACTOR = 0.9;

const CONFIDENCE_FLOOR   = 0.5;
const CONFIDENCE_CEILING = 0.99;

/**
 * Suppress re-derivation when an existing fraud_risk inference already has
 * high confidence — downstream fraud teams will have already been alerted.
 */
const REFIRE_SUPPRESSION_THRESHOLD = 0.85;

export class FraudRiskRule implements InferenceRule {
  readonly ruleId   = 'fraud_risk';
  readonly ruleName = 'Fraud Risk Indicator';
  readonly domain: SignalDomain = 'FRAUD';

  evaluate(input: InferenceInput): InferenceOutput | null {
    // Suppress if a recent, high-confidence fraud inference already exists.
    const alreadyExists = input.existing.some(
      e =>
        e.inferenceType === 'fraud_risk' &&
        e.confidence >= REFIRE_SUPPRESSION_THRESHOLD,
    );
    if (alreadyExists) return null;

    // Immediate path: single authoritative fraud signal.
    const immediateMatches = input.signals.filter(signal =>
      IMMEDIATE_TOPICS.some(keyword => signal.topic.includes(keyword)),
    );

    // Corroborated path: two or more general risk indicators.
    const generalMatches = input.signals.filter(signal =>
      GENERAL_TOPICS.some(keyword => signal.topic.includes(keyword)),
    );

    const shouldFire =
      immediateMatches.length >= 1 || generalMatches.length >= MIN_GENERAL_SIGNALS;

    if (!shouldFire) return null;

    // Combine both sets, deduplicating by signalId.
    const seenIds  = new Set<string>();
    const allMatching = [...immediateMatches, ...generalMatches].filter(s => {
      if (seenIds.has(s.signalId)) return false;
      seenIds.add(s.signalId);
      return true;
    });

    // Confidence driven by the highest-weight signal, scaled down slightly.
    const highestWeight = Math.max(...allMatching.map(s => s.weight));
    const confidence    = Math.min(
      CONFIDENCE_CEILING,
      Math.max(CONFIDENCE_FLOOR, highestWeight * WEIGHT_SCALE_FACTOR),
    );

    const topicList = allMatching.map(s => s.topic).join(', ');

    return {
      inferenceType:     'fraud_risk',
      summary:
        `Fraud risk detected for entity based on ${allMatching.length} signal(s): ${topicList}.`,
      confidence,
      evidenceSignalIds: allMatching.map(s => s.signalId),
      domain:            this.domain,
      expiresInDays:     30,
    };
  }
}
