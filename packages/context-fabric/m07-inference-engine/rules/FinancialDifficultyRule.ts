/**
 * M07 Inference Engine — FinancialDifficultyRule
 *
 * Fires when 2 or more signals with topics relating to financial distress are
 * present for an entity. Covers missed/late payments, hardship declarations,
 * arrears, and financial vulnerability flags.
 *
 * Banking context (LBG): used by Collections and Retail agents to trigger
 * proactive support conversations and appropriate treatment strategies.
 */

import type { InferenceInput, InferenceOutput, InferenceRule } from '../InferenceRule.js';
import type { SignalDomain } from '../../core/types.js';

/** Topic substrings that indicate financial difficulty. Case-sensitive. */
const DISTRESS_TOPICS: readonly string[] = [
  'payment.missed',
  'payment.late',
  'hardship',
  'arrears',
  'vulnerability.financial',
] as const;

/** Minimum number of matching signals required to fire the rule. */
const MIN_SIGNAL_COUNT = 2;

/** Minimum confidence floor — even weak evidence is noteworthy. */
const CONFIDENCE_FLOOR = 0.5;

/** Maximum confidence ceiling — we never assert certainty from signals alone. */
const CONFIDENCE_CEILING = 0.95;

/** If an existing inference has confidence at or above this value, do not re-derive. */
const REFIRE_SUPPRESSION_THRESHOLD = 0.7;

export class FinancialDifficultyRule implements InferenceRule {
  readonly ruleId   = 'financial_difficulty';
  readonly ruleName = 'Financial Difficulty Indicator';
  readonly domain: SignalDomain = 'COLLECTIONS';

  evaluate(input: InferenceInput): InferenceOutput | null {
    // Suppress re-derivation when a recent high-confidence inference already exists.
    const alreadyExists = input.existing.some(
      e =>
        e.inferenceType === 'financial_difficulty' &&
        e.confidence >= REFIRE_SUPPRESSION_THRESHOLD,
    );
    if (alreadyExists) return null;

    // Collect all signals whose topic contains at least one distress keyword.
    const matching = input.signals.filter(signal =>
      DISTRESS_TOPICS.some(keyword => signal.topic.includes(keyword)),
    );

    if (matching.length < MIN_SIGNAL_COUNT) return null;

    // Confidence = average decay-adjusted weight of matching signals, clamped.
    const avgWeight = matching.reduce((sum, s) => sum + s.weight, 0) / matching.length;
    const confidence = Math.min(CONFIDENCE_CEILING, Math.max(CONFIDENCE_FLOOR, avgWeight));

    const topicList = matching.map(s => s.topic).join(', ');

    return {
      inferenceType:     'financial_difficulty',
      summary:
        `Customer shows signs of financial difficulty based on ${matching.length} signal(s): ${topicList}.`,
      confidence,
      evidenceSignalIds: matching.map(s => s.signalId),
      domain:            this.domain,
      expiresInDays:     90,
    };
  }
}
