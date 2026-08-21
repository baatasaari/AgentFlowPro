/**
 * M03 Context Store — ContextStoreService
 *
 * Provides queryable access to the assembled context for an entity.
 * This is the read side (CQRS) of the context fabric — the write side
 * is handled by M01 (signal ingestion) and the Inference Engine (M07).
 *
 * What "context" means here:
 *   - Recent signals (filtered by scope, layer, expiry)
 *   - Active inferences (non-expired, non-redacted)
 *   - Relevant decisions (last N, ordered by decidedAt desc)
 *
 * Assembly is done at query time; there is no materialised view (Phase 1).
 * The Context Assembler (M05, Phase 2) will add a pre-assembled layer.
 *
 * All queries respect entity resolution — if an entity has been merged,
 * queries are automatically forwarded to the survivor entity.
 */

import { eq, and, gte, lte, desc, isNull, or, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import type { Signal, SignalLayer, ContextScope, SignalDomain, Result } from '../core/types.js';
import { ok, err } from '../core/types.js';
import { ModuleDisabledError, EntityNotFoundError } from '../core/errors.js';
import { cfSignals } from '../m01-signal-ingestion/schema.js';
import { cfEntities } from '../m02-entity-resolution/schema.js';
import { cfInferences, cfDecisions, cfContextSnapshots, type NewContextSnapshot } from './schema.js';
import type { DbSignal } from '../m01-signal-ingestion/schema.js';
import type { DbInference, DbDecision } from './schema.js';
import { randomUUID } from 'crypto';

// ── Query options ─────────────────────────────────────────────────────────────

export interface ContextQuery {
  entityId:       string;
  scopes?:        ContextScope[];
  layers?:        SignalLayer[];
  domains?:       SignalDomain[];
  topic?:         string;          // optional topic filter
  sessionId?:     string;
  since?:         Date;
  maxSignals?:    number;          // default 50
  maxInferences?: number;         // default 20
  maxDecisions?:  number;         // default 10
  includeExpired?: boolean;        // default false
}

export interface AssembledContext {
  entityId:    string;
  signals:     Signal[];
  inferences:  DbInference[];
  decisions:   DbDecision[];
  assembledAt: Date;
}

// ── Service ──────────────────────────────────────────────────────────────────

export class ContextStoreService {
  constructor(
    private readonly db:      NodePgDatabase<Record<string, never>>,
    private readonly enabled: boolean,
  ) {}

  // ── Assemble context ──────────────────────────────────────────────────────

  async assemble(query: ContextQuery): Promise<Result<AssembledContext>> {
    if (!this.enabled) return err(new ModuleDisabledError('M03_CONTEXT_STORE'));

    // Resolve merged entities — always query the canonical entity
    const canonicalId = await this._resolveCanonicalEntity(query.entityId);

    const now           = new Date();
    const maxSignals    = query.maxSignals    ?? 50;
    const maxInferences = query.maxInferences ?? 20;
    const maxDecisions  = query.maxDecisions  ?? 10;

    // ── Signals ─────────────────────────────────────────────────────────────
    let signalQuery = this.db
      .select()
      .from(cfSignals)
      .where(
        and(
          eq(cfSignals.entityId, canonicalId),
          eq(cfSignals.isRedacted, false),
          query.includeExpired ? undefined : or(isNull(cfSignals.expiresAt), gte(cfSignals.expiresAt, now)),
          query.domains?.length ? inArray(cfSignals.sourceDomain, query.domains) : undefined,
          query.layers?.length  ? inArray(cfSignals.layer,        query.layers)  : undefined,
          query.scopes?.length  ? inArray(cfSignals.scope,        query.scopes)  : undefined,
          query.topic  ? eq(cfSignals.topic, query.topic) : undefined,
          query.sessionId ? eq(cfSignals.sessionId, query.sessionId) : undefined,
          query.since   ? gte(cfSignals.ingestedAt, query.since) : undefined,
        ),
      )
      .orderBy(desc(cfSignals.ingestedAt))
      .limit(maxSignals);

    // Note: filter(Boolean) removes undefined conditions above; Drizzle ignores undefined in and()
    const signalRows: DbSignal[] = await signalQuery;
    const signals: Signal[] = signalRows.map(row => this._hydrateSignal(row));

    // ── Inferences ───────────────────────────────────────────────────────────
    const inferenceRows: DbInference[] = await this.db
      .select()
      .from(cfInferences)
      .where(
        and(
          eq(cfInferences.entityId, canonicalId),
          eq(cfInferences.isActive, true),
          eq(cfInferences.isRedacted, false),
          query.includeExpired ? undefined : or(isNull(cfInferences.expiresAt), gte(cfInferences.expiresAt, now)),
          query.domains?.length ? inArray(cfInferences.domain, query.domains) : undefined,
        ),
      )
      .orderBy(desc(cfInferences.derivedAt))
      .limit(maxInferences);

    // ── Decisions ─────────────────────────────────────────────────────────────
    const decisionRows: DbDecision[] = await this.db
      .select()
      .from(cfDecisions)
      .where(
        and(
          eq(cfDecisions.entityId, canonicalId),
          eq(cfDecisions.isRedacted, false),
          query.domains?.length ? inArray(cfDecisions.domain, query.domains) : undefined,
          query.sessionId ? eq(cfDecisions.sessionId, query.sessionId) : undefined,
        ),
      )
      .orderBy(desc(cfDecisions.decidedAt))
      .limit(maxDecisions);

    return ok({
      entityId:    canonicalId,
      signals,
      inferences:  inferenceRows,
      decisions:   decisionRows,
      assembledAt: now,
    });
  }

  // ── Snapshot (for WorkflowOrchestrators) ─────────────────────────────────

  async takeSnapshot(
    entityId:      string,
    workflowId:    string,
    orchestratorId: string,
    query:         ContextQuery,
    ttlHours:      number = 24,
  ): Promise<Result<string>> { // returns snapshotId
    if (!this.enabled) return err(new ModuleDisabledError('M03_CONTEXT_STORE'));

    const contextResult = await this.assemble(query);
    if (!contextResult.ok) return err(contextResult.error);

    const snapshotId = randomUUID();
    const expiresAt  = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    await this.db.insert(cfContextSnapshots).values({
      snapshotId,
      entityId,
      workflowId,
      orchestratorId,
      contextJson: JSON.stringify(contextResult.value),
      expiresAt,
    } satisfies NewContextSnapshot);

    return ok(snapshotId);
  }

  async getSnapshot(snapshotId: string): Promise<Result<AssembledContext>> {
    if (!this.enabled) return err(new ModuleDisabledError('M03_CONTEXT_STORE'));

    const rows = await this.db
      .select()
      .from(cfContextSnapshots)
      .where(eq(cfContextSnapshots.snapshotId, snapshotId))
      .limit(1);

    if (!rows.length) return err(new EntityNotFoundError(snapshotId));

    return ok(JSON.parse(rows[0].contextJson) as AssembledContext);
  }

  // ── Signal read (single entity, latest signals) ───────────────────────────

  async getSignals(
    entityId:  string,
    options: { limit?: number; since?: Date; topic?: string } = {},
  ): Promise<Result<Signal[]>> {
    if (!this.enabled) return err(new ModuleDisabledError('M03_CONTEXT_STORE'));

    const canonicalId = await this._resolveCanonicalEntity(entityId);
    const now = new Date();

    const rows = await this.db
      .select()
      .from(cfSignals)
      .where(
        and(
          eq(cfSignals.entityId, canonicalId),
          eq(cfSignals.isRedacted, false),
          or(isNull(cfSignals.expiresAt), gte(cfSignals.expiresAt, now)),
          options.topic ? eq(cfSignals.topic, options.topic) : undefined,
          options.since ? gte(cfSignals.ingestedAt, options.since) : undefined,
        ),
      )
      .orderBy(desc(cfSignals.ingestedAt))
      .limit(options.limit ?? 50);

    return ok(rows.map(r => this._hydrateSignal(r)));
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async _resolveCanonicalEntity(entityId: string): Promise<string> {
    const rows = await this.db
      .select()
      .from(cfEntities)
      .where(eq(cfEntities.entityId, entityId))
      .limit(1);

    if (!rows.length || !rows[0].isMerged || !rows[0].mergedIntoId) {
      return entityId;
    }

    // Recursively resolve (handles multi-hop merges, e.g. A→B→C)
    return this._resolveCanonicalEntity(rows[0].mergedIntoId);
  }

  private _hydrateSignal(row: DbSignal): Signal {
    return {
      signalId:         row.signalId,
      idempotencyKey:   row.idempotencyKey,
      sourceAgentId:    row.sourceAgentId,
      sourceDomain:     row.sourceDomain as Signal['sourceDomain'],
      entityId:         row.entityId,
      layer:            row.layer as Signal['layer'],
      propagationClass: row.propagationClass as Signal['propagationClass'],
      decayClass:       row.decayClass as Signal['decayClass'],
      scope:            row.scope as Signal['scope'],
      topic:            row.topic,
      payload:          JSON.parse(row.payloadJson) as Record<string, unknown>,
      confidence:       row.confidence,
      schemaVersion:    row.schemaVersion,
      contractId:       row.contractId,
      correlationId:    row.correlationId ?? undefined,
      sessionId:        row.sessionId ?? undefined,
      taskId:           row.taskId ?? undefined,
      producedAt:       row.producedAt,
      expiresAt:        row.expiresAt ?? undefined,
    };
  }
}
