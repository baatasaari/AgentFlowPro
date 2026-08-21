/**
 * M05 Context Assembler — DecayWeightCalculator
 *
 * Computes a relevance weight for a signal based on its age and decay class.
 * Signals with higher weights are ranked first in the assembled context.
 *
 * Decay functions (exponential half-life):
 *   IMMEDIATE_DECAY  → half-life 24 h  — very fresh signals only
 *   STANDARD_DECAY   → half-life 72 h  — week-old signals still relevant
 *   SLOW_DECAY       → half-life 30 d  — relevant for months
 *   ETERNAL          → weight = 1.0    — never decays (regulatory decisions)
 *   EVENT_TRIGGERED  → weight = 1.0    — decays on event, not time
 *
 * The formula: weight = confidence × exp(−λ × ageHours)
 *   where λ = ln(2) / halfLifeHours
 *
 * Weights are in (0, 1] and are used for ranking, not filtering.
 * The assembler still includes low-weight signals — it's up to the
 * requesting agent to decide whether to use them.
 */

import type { DecayClass } from '../core/types.js';

const LN2 = Math.LN2;

const HALF_LIFE_HOURS: Record<DecayClass, number | null> = {
  IMMEDIATE_DECAY: 24,
  STANDARD_DECAY:  72,
  SLOW_DECAY:      30 * 24, // 720 h
  ETERNAL:         null,    // no decay
  EVENT_TRIGGERED: null,    // time-independent
};

export interface WeightedSignal {
  signalId:    string;
  topic:       string;
  producedAt:  Date;
  decayClass:  DecayClass;
  confidence:  number;
  /** Computed relevance weight in (0, 1]. Higher = more relevant. */
  weight:      number;
  /** Age of the signal in hours at the time of assembly. */
  ageHours:    number;
}

export class DecayWeightCalculator {
  /**
   * Compute the relevance weight for a signal.
   * @param producedAt  When the signal was produced.
   * @param decayClass  The signal's decay class.
   * @param confidence  Original confidence score.
   * @param asOf        Reference time (default: now). Used for deterministic testing.
   */
  compute(
    producedAt:  Date,
    decayClass:  DecayClass,
    confidence:  number,
    asOf:        Date = new Date(),
  ): { weight: number; ageHours: number } {
    const ageHours    = (asOf.getTime() - producedAt.getTime()) / (1000 * 60 * 60);
    const halfLife    = HALF_LIFE_HOURS[decayClass];

    if (halfLife === null) {
      // ETERNAL or EVENT_TRIGGERED: weight = raw confidence
      return { weight: confidence, ageHours };
    }

    // Exponential decay: weight = confidence × 2^(−ageHours / halfLife)
    const decayFactor = Math.pow(2, -ageHours / halfLife);
    const weight      = Math.max(0, confidence * decayFactor);

    return { weight, ageHours };
  }

  /**
   * Sort signals by descending weight (most relevant first).
   */
  rank<T extends { weight: number }>(signals: T[]): T[] {
    return [...signals].sort((a, b) => b.weight - a.weight);
  }
}
