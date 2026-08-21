/**
 * M02 Entity Resolution — EntityScorer
 *
 * Computes a combined match score between two sets of entity identifiers.
 * The score drives the merge decision in EntityResolutionService.
 *
 * Scoring model (weights from architecture spec):
 *   NATIONAL_INSURANCE  0.60  ← near-certain
 *   PASSPORT            0.60  ← near-certain
 *   SORT_CODE_ACCOUNT   0.50  ← strong deterministic
 *   DOB                 0.45  ← strong, common
 *   PHONE               0.30  ← medium (numbers change)
 *   EMAIL               0.25  ← medium (addresses change)
 *   FULL_NAME           0.15  ← weak (name changes, common names)
 *   POSTCODE            0.10  ← very weak alone
 *
 * Combined score = sum of weights for each matching identifier type.
 * A combined score ≥ threshold (default 0.75) triggers an auto-merge.
 * Scores between 0.5 and 0.75 are flagged for manual review (future M-x).
 *
 * Hash comparison: identifiers are compared by valueHash (HMAC-SHA256).
 * This means hashing must be consistent; the hashing key is the
 * CF_IDENTIFIER_HMAC_KEY env var, applied by EntityResolutionService.
 */

import { IDENTIFIER_WEIGHTS, type IdentifierType } from '../core/types.js';
import type { EntityIdentifier } from '../core/types.js';

export interface ScoredMatch {
  /** Combined match score: 0.0 → 1.0+ (can exceed 1.0 if multiple near-certain IDs match) */
  score:              number;
  /** Identifier types that contributed to the score */
  matchedOn:          IdentifierType[];
  /** Recommend auto-merge? (score ≥ threshold) */
  shouldMerge:        boolean;
  /** Flag for manual review? (0.5 ≤ score < threshold) */
  needsReview:        boolean;
}

export class EntityScorer {
  constructor(private readonly mergeThreshold: number = 0.75) {}

  /**
   * Score two sets of entity identifiers against each other.
   * @param existingIdentifiers  Identifiers already stored for the candidate entity.
   * @param incomingIdentifiers  Identifiers received with the new signal.
   */
  score(
    existingIdentifiers: EntityIdentifier[],
    incomingIdentifiers: EntityIdentifier[],
  ): ScoredMatch {
    let combinedScore = 0;
    const matchedOn:  IdentifierType[] = [];

    for (const incoming of incomingIdentifiers) {
      const match = existingIdentifiers.find(
        e => e.type === incoming.type && e.valueHash === incoming.valueHash,
      );
      if (match) {
        const weight = IDENTIFIER_WEIGHTS[incoming.type] ?? 0;
        // Apply both identifiers' confidence as a joint probability modifier
        const adjustedWeight = weight * Math.min(match.confidence, incoming.confidence);
        combinedScore += adjustedWeight;
        matchedOn.push(incoming.type);
      }
    }

    return {
      score:       combinedScore,
      matchedOn,
      shouldMerge: combinedScore >= this.mergeThreshold,
      needsReview: combinedScore >= 0.50 && combinedScore < this.mergeThreshold,
    };
  }

  /**
   * Find the best-matching entity candidate from a list of candidates.
   * Returns null if no candidate meets the review threshold (< 0.5).
   */
  findBestMatch(
    incomingIdentifiers: EntityIdentifier[],
    candidates: Array<{ entityId: string; identifiers: EntityIdentifier[] }>,
  ): { entityId: string; match: ScoredMatch } | null {
    let best: { entityId: string; match: ScoredMatch } | null = null;

    for (const candidate of candidates) {
      const match = this.score(candidate.identifiers, incomingIdentifiers);
      if (match.score < 0.50) continue;
      if (!best || match.score > best.match.score) {
        best = { entityId: candidate.entityId, match };
      }
    }

    return best;
  }
}
