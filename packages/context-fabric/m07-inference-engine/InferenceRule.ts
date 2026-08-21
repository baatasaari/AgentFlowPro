/**
 * M07 Inference Engine — InferenceRule interface
 *
 * An inference rule inspects a collection of weighted signals for an entity
 * and decides whether to emit an inference.
 *
 * Rules are stateless: all inputs are passed in; output is either an inference
 * record or null (no inference to emit this run).
 */

import type { WeightedSignal } from '../m05-context-assembler/ContextAssemblerService.js';
import type { SignalDomain } from '../core/types.js';

export interface InferenceInput {
  entityId:  string;
  signals:   WeightedSignal[];
  /** Existing active inferences — rules can check if one already exists. */
  existing:  ExistingInference[];
  asOf:      Date;
}

export interface ExistingInference {
  inferenceId:   string;
  inferenceType: string;
  confidence:    number;
  derivedAt:     Date;
}

export interface InferenceOutput {
  inferenceType: string;
  summary:       string;
  /** 0–1. The rule derives this from signal weights and counts. */
  confidence:    number;
  /** signalIds that drove this inference. */
  evidenceSignalIds: string[];
  domain:        SignalDomain;
  /** ISO 8601 expiry. Defaults to 90 days from now. */
  expiresInDays?: number;
}

export interface InferenceRule {
  /** Machine-readable rule identifier, e.g. "financial_difficulty" */
  readonly ruleId: string;
  /** Human-readable name for logging. */
  readonly ruleName: string;
  /** Domain this rule primarily concerns. */
  readonly domain: SignalDomain;

  /**
   * Evaluate the rule for the given entity context.
   * @returns InferenceOutput if the rule fires, null otherwise.
   */
  evaluate(input: InferenceInput): InferenceOutput | null;
}
