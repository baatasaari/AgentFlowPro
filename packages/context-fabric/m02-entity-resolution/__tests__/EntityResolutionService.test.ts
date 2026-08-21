/**
 * M02 Entity Resolution — Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EntityScorer } from '../EntityScorer.js';
import type { EntityIdentifier } from '../../core/types.js';

// ── EntityScorer tests ────────────────────────────────────────────────────────

describe('EntityScorer', () => {
  const scorer = new EntityScorer(0.75);

  function makeId(
    type: EntityIdentifier['type'],
    hash: string,
    confidence = 1.0,
  ): EntityIdentifier {
    return { type, valueHash: hash, confidence, domain: 'RETAIL', addedAt: new Date() };
  }

  describe('score()', () => {
    it('returns 0 when no identifiers match', () => {
      const existing  = [makeId('DOB', 'hash-dob-1')];
      const incoming  = [makeId('DOB', 'hash-dob-DIFFERENT')];
      const { score } = scorer.score(existing, incoming);
      expect(score).toBe(0);
    });

    it('scores DOB match at 0.45 with full confidence', () => {
      const id = makeId('DOB', 'hash-dob-1');
      const { score, matchedOn } = scorer.score([id], [id]);
      expect(score).toBeCloseTo(0.45);
      expect(matchedOn).toContain('DOB');
    });

    it('scores DOB + PHONE match above 0.75 (auto-merge threshold)', () => {
      const dob   = makeId('DOB',   'hash-dob-1');
      const phone = makeId('PHONE', 'hash-phone-1');
      const { score, shouldMerge } = scorer.score([dob, phone], [dob, phone]);
      expect(score).toBeGreaterThanOrEqual(0.75);
      expect(shouldMerge).toBe(true);
    });

    it('scores NATIONAL_INSURANCE match above threshold alone (0.60)', () => {
      // NI alone is 0.60, below 0.75 threshold — should not auto-merge
      const ni = makeId('NATIONAL_INSURANCE', 'hash-ni-1');
      const { score, shouldMerge } = scorer.score([ni], [ni]);
      expect(score).toBeCloseTo(0.60);
      expect(shouldMerge).toBe(false);
    });

    it('flags for review when score is between 0.5 and threshold', () => {
      const ni = makeId('NATIONAL_INSURANCE', 'hash-ni-1');
      const { needsReview, shouldMerge } = scorer.score([ni], [ni]);
      expect(needsReview).toBe(true);
      expect(shouldMerge).toBe(false);
    });

    it('confidence < 1.0 reduces the effective weight', () => {
      const id = makeId('DOB', 'hash-dob-1', 0.5);
      const { score } = scorer.score([id], [id]);
      // weight 0.45 × min(0.5, 0.5) = 0.225
      expect(score).toBeCloseTo(0.225);
    });

    it('SORT_CODE_ACCOUNT alone is not enough to auto-merge (0.50 < 0.75)', () => {
      const id = makeId('SORT_CODE_ACCOUNT', 'hash-sc-1');
      const { shouldMerge } = scorer.score([id], [id]);
      expect(shouldMerge).toBe(false);
    });

    it('DOB + SORT_CODE_ACCOUNT combined triggers auto-merge (0.45+0.50 ≥ 0.75)', () => {
      const dob = makeId('DOB',              'hash-dob-1');
      const sc  = makeId('SORT_CODE_ACCOUNT','hash-sc-1');
      const { score, shouldMerge } = scorer.score([dob, sc], [dob, sc]);
      expect(score).toBeGreaterThanOrEqual(0.75);
      expect(shouldMerge).toBe(true);
    });
  });

  describe('findBestMatch()', () => {
    it('returns null when no candidate exceeds 0.5', () => {
      const incoming  = [makeId('FULL_NAME', 'hash-name-1')];
      const candidates = [{ entityId: 'e-1', identifiers: [makeId('FULL_NAME', 'hash-name-DIFFERENT')] }];
      const result = scorer.findBestMatch(incoming, candidates);
      expect(result).toBeNull();
    });

    it('returns the highest-scoring candidate', () => {
      const dob     = makeId('DOB',   'hash-dob-1');
      const phone   = makeId('PHONE', 'hash-phone-1');
      const name    = makeId('FULL_NAME', 'hash-name-1');

      const incoming = [dob, phone];

      const candidates = [
        { entityId: 'e-1', identifiers: [name] },                // score < 0.5
        { entityId: 'e-2', identifiers: [dob] },                 // score 0.45
        { entityId: 'e-3', identifiers: [dob, phone] },          // score 0.75
      ];

      const result = scorer.findBestMatch(incoming, candidates);
      expect(result).not.toBeNull();
      expect(result?.entityId).toBe('e-3');
      expect(result?.match.shouldMerge).toBe(true);
    });
  });
});
