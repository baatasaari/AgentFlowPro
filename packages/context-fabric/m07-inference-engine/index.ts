/**
 * M07 Inference Engine — Public API
 *
 * External consumers import from this barrel file, not from internal paths.
 */

// ── Core interface and types ──────────────────────────────────────────────────

export type {
  InferenceRule,
  InferenceInput,
  InferenceOutput,
  ExistingInference,
} from './InferenceRule.js';

// ── Service ───────────────────────────────────────────────────────────────────

export { InferenceEngineService } from './InferenceEngineService.js';

// ── Built-in rules ────────────────────────────────────────────────────────────

export { FinancialDifficultyRule } from './rules/FinancialDifficultyRule.js';
export { VulnerabilityRule }        from './rules/VulnerabilityRule.js';
export { FraudRiskRule }            from './rules/FraudRiskRule.js';
