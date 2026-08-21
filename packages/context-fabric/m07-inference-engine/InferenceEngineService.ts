/**
 * M07 Inference Engine — InferenceEngineService
 *
 * Evaluates registered inference rules against an entity's assembled signals.
 * Persists new inferences to cf_inferences via Drizzle.
 *
 * Design:
 *  - Stateless: one evaluate() call per entity per trigger
 *  - Rules are evaluated in registration order (priority enforced by order)
 *  - An existing active inference of the same type with equal or higher
 *    confidence blocks re-derivation (prevents churn)
 *  - New inferences are written with a default 90-day TTL, overridable per rule
 *  - ModuleDisabledError returned when enabled=false
 *
 * Dependency topology:
 *  - M07 takes WeightedSignal[] as input (caller-provided, typically M08 sidecar
 *    or a scheduled job), avoiding a direct dependency on M05 ContextAssembler.
 *  - M07 writes to the cf_inferences table owned by M03 ContextStore.
 *    M03 then serves these inferences back to M05 for context assembly.
 *
 * Call sequence:
 *   1. Caller fetches assembled signals via M05 (or loads from M08 cache)
 *   2. Caller invokes InferenceEngineService.evaluate(entityId, signals)
 *   3. Service loads existing inferences, runs rules, persists new ones
 *   4. Service returns the list of newly written InferenceOutputs
 */

import { randomUUID } from 'crypto';
import { eq, and, or, isNull, gte } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import type { WeightedSignal } from '../m05-context-assembler/ContextAssemblerService.js';
import type { Result } from '../core/types.js';
import { ok, err } from '../core/types.js';
import { ModuleDisabledError } from '../core/errors.js';
import { cfInferences } from '../m03-context-store/schema.js';
import type { DbInference, NewInference } from '../m03-context-store/schema.js';
import type {
  InferenceRule,
  InferenceInput,
  InferenceOutput,
  ExistingInference,
} from './InferenceRule.js';

/** Default TTL applied when a rule does not specify expiresInDays. */
const DEFAULT_EXPIRES_DAYS = 90;

export class InferenceEngineService {
  constructor(
    private readonly db:      NodePgDatabase<Record<string, never>>,
    private readonly rules:   InferenceRule[],
    private readonly enabled: boolean,
  ) {}

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Run all registered inference rules against the provided signals.
   *
   * For each rule that fires:
   *  - Skip if an existing active inference of the same type already has
   *    confidence >= the newly derived confidence (no regression writing).
   *  - Otherwise write a new row to cf_inferences.
   *
   * @param entityId  Canonical entity UUID (M02).
   * @param signals   Decay-weighted signals to evaluate — caller is responsible
   *                  for fetching and weighting these (typically via M05/M08).
   * @returns         The list of InferenceOutputs that were newly persisted.
   */
  async evaluate(
    entityId: string,
    signals:  WeightedSignal[],
  ): Promise<Result<InferenceOutput[]>> {
    if (!this.enabled) return err(new ModuleDisabledError('M07_INFERENCE_ENGINE'));

    // Load the entity's current active inferences so rules can check for
    // existing ones and so we can suppress low-confidence re-derivations.
    const activeResult = await this.getActiveInferences(entityId);
    if (!activeResult.ok) return err(activeResult.error);
    const activeInferences = activeResult.value;

    // Build the lightweight ExistingInference view passed to each rule.
    const existing: ExistingInference[] = activeInferences.map(inf => ({
      inferenceId:   inf.inferenceId,
      inferenceType: inf.inferenceType,
      confidence:    inf.confidence,
      derivedAt:     inf.derivedAt,
    }));

    const input: InferenceInput = {
      entityId,
      signals,
      existing,
      asOf: new Date(),
    };

    const newlyPersisted: InferenceOutput[] = [];

    for (const rule of this.rules) {
      const output = rule.evaluate(input);
      if (output === null) continue;

      // Skip if an existing active inference of the same type already carries
      // equal or higher confidence — writing a lower-confidence record would
      // regress the entity's context state.
      const existingHigher = activeInferences.find(
        inf =>
          inf.inferenceType === output.inferenceType &&
          inf.confidence    >= output.confidence,
      );
      if (existingHigher) continue;

      await this._persist(entityId, output);
      newlyPersisted.push(output);
    }

    return ok(newlyPersisted);
  }

  /**
   * Return all active, non-expired, non-redacted inferences for an entity.
   * Used by callers that need the current inference state without triggering
   * a full rule evaluation.
   */
  async getActiveInferences(entityId: string): Promise<Result<DbInference[]>> {
    if (!this.enabled) return err(new ModuleDisabledError('M07_INFERENCE_ENGINE'));

    const now = new Date();

    const rows: DbInference[] = await this.db
      .select()
      .from(cfInferences)
      .where(
        and(
          eq(cfInferences.entityId,   entityId),
          eq(cfInferences.isActive,   true),
          eq(cfInferences.isRedacted, false),
          or(isNull(cfInferences.expiresAt), gte(cfInferences.expiresAt, now)),
        ),
      );

    return ok(rows);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async _persist(entityId: string, output: InferenceOutput): Promise<void> {
    const inferenceId = randomUUID();
    const derivedAt   = new Date();
    const expiresInDays = output.expiresInDays ?? DEFAULT_EXPIRES_DAYS;
    const expiresAt   = new Date(derivedAt.getTime() + expiresInDays * 24 * 60 * 60 * 1000);

    const record: NewInference = {
      inferenceId,
      entityId,
      inferenceType: output.inferenceType,
      summary:       output.summary,
      confidence:    output.confidence,
      evidenceJson:  JSON.stringify(output.evidenceSignalIds),
      domain:        output.domain,
      isActive:      true,
      isRedacted:    false,
      derivedAt,
      expiresAt,
    };

    await this.db.insert(cfInferences).values(record);
  }
}
