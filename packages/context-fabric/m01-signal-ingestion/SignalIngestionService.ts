/**
 * M01 Signal Ingestion Gateway — SignalIngestionService
 *
 * The entry point for all context signals entering the fabric.
 * Every signal passes through this service before anything else.
 *
 * Processing pipeline (in order):
 *   1. Module enabled guard
 *   2. Schema validation        (SignalValidator)
 *   3. Contract existence check (M18 ContractRegistryService)
 *   4. Topic permission check   (M18 validatePublish)
 *   5. Rate-limit check         (per-agent sliding window, ICache)
 *   6. Idempotency check        (ICache dedup window)
 *   7. Compute expiresAt from DecayClass
 *   8. Persist to cf_signals    (append-only)
 *   9. Record idempotency key
 *  10. Publish to broker        (M04 ISignalBroker)
 *
 * Atomicity: Steps 8–9 are wrapped in a DB transaction.
 * Step 10 (broker publish) fires after the transaction commits and
 * is best-effort for STANDARD/SLOW/SILENT signals.
 * For IMMEDIATE signals, broker publish errors are surfaced to the caller.
 */

import { eq, and, gt } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import type { Signal, Result } from '../core/types.js';
import { ok, err } from '../core/types.js';
import {
  ModuleDisabledError,
  DuplicateSignalError,
  RateLimitError,
  SignalValidationError,
} from '../core/errors.js';
import type { ICache } from '../ports/ICache.js';
import type { ISignalBroker } from '../ports/ISignalBroker.js';
import { SignalValidator } from './SignalValidator.js';
import type { ContractRegistryService } from '../m18-contract-registry/ContractRegistryService.js';
import { cfSignals, cfSignalIdempotency, type NewSignal } from './schema.js';

// ── Configuration injected per module ────────────────────────────────────────

export interface SignalIngestionConfig {
  enabled:              boolean;
  dedupWindowSeconds:   number;  // default 300 (5 min)
  defaultSignalTtlHours: number; // default 72 h
}

// ── Decay class → TTL mapping ─────────────────────────────────────────────────

function computeExpiresAt(signal: Signal, ttlHours: number): Date | null {
  const h = ttlHours;
  switch (signal.decayClass) {
    case 'IMMEDIATE_DECAY':  return hoursFromNow(h / 3);       // ~24 h if default 72
    case 'STANDARD_DECAY':   return hoursFromNow(h);            // 72 h
    case 'SLOW_DECAY':       return hoursFromNow(h * 10);       // 30 days
    case 'ETERNAL':          return null;
    case 'EVENT_TRIGGERED':  return null; // cleared by an external event, not time
    default:                 return hoursFromNow(h);
  }
}

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

// ── Service ──────────────────────────────────────────────────────────────────

export interface IngestResult {
  signalId:   string;
  entityId:   string;
  topic:      string;
  expiresAt:  Date | null;
  ingestedAt: Date;
}

export class SignalIngestionService {
  private readonly validator = new SignalValidator();
  private readonly RATE_KEY  = (agentId: string) => `cf:rate:${agentId}`;
  private readonly DEDUP_KEY = (key: string)      => `cf:dedup:${key}`;

  constructor(
    private readonly db:               NodePgDatabase<Record<string, never>>,
    private readonly cache:            ICache,
    private readonly broker:           ISignalBroker,
    private readonly contractRegistry: ContractRegistryService,
    private readonly config:           SignalIngestionConfig,
  ) {}

  // ── Ingest ────────────────────────────────────────────────────────────────

  async ingest(signal: Signal): Promise<Result<IngestResult>> {
    // ── 1. Module guard ─────────────────────────────────────────────────────
    if (!this.config.enabled) {
      return err(new ModuleDisabledError('M01_SIGNAL_INGESTION'));
    }

    // ── 2. Schema validation ────────────────────────────────────────────────
    const valResult = this.validator.validate(signal);
    if (!valResult.valid) {
      return err(valResult.errors[0]);
    }

    // ── 3+4. Contract check + topic permission ──────────────────────────────
    const contractResult = await this.contractRegistry.validatePublish(
      signal.sourceAgentId,
      signal.topic,
    );
    if (!contractResult.ok) {
      return err(contractResult.error);
    }
    const contract = contractResult.value;

    // ── 5. Rate limit (sliding window via cache) ────────────────────────────
    const rateKey = this.RATE_KEY(signal.sourceAgentId);
    const count   = await this.cache.incr(rateKey, 60); // 1-minute window
    if (count > contract.maxSignalRatePerMinute) {
      return err(new RateLimitError(signal.sourceAgentId, contract.maxSignalRatePerMinute));
    }

    // ── 6. Idempotency check ────────────────────────────────────────────────
    const dedupKey = this.DEDUP_KEY(signal.idempotencyKey);
    const isDup    = await this.cache.exists(dedupKey);
    if (isDup) {
      return err(new DuplicateSignalError(signal.idempotencyKey));
    }

    // ── 7. Compute expiry ───────────────────────────────────────────────────
    const expiresAt  = computeExpiresAt(signal, this.config.defaultSignalTtlHours);
    const ingestedAt = new Date();

    // ── 8+9. Persist (transactional) ────────────────────────────────────────
    const row: NewSignal = {
      signalId:         signal.signalId,
      idempotencyKey:   signal.idempotencyKey,
      sourceAgentId:    signal.sourceAgentId,
      sourceDomain:     signal.sourceDomain,
      entityId:         signal.entityId,
      layer:            signal.layer,
      propagationClass: signal.propagationClass,
      decayClass:       signal.decayClass,
      scope:            signal.scope,
      topic:            signal.topic,
      payloadJson:      JSON.stringify(signal.payload),
      confidence:       signal.confidence,
      schemaVersion:    signal.schemaVersion,
      contractId:       signal.contractId,
      correlationId:    signal.correlationId ?? null,
      sessionId:        signal.sessionId ?? null,
      taskId:           signal.taskId ?? null,
      producedAt:       signal.producedAt instanceof Date
                          ? signal.producedAt
                          : new Date(signal.producedAt),
      ingestedAt,
      expiresAt:        expiresAt ?? undefined,
      isRedacted:       false,
    };

    await this.db.transaction(async tx => {
      await tx.insert(cfSignals).values(row);
      await tx.insert(cfSignalIdempotency).values({
        idempotencyKey: signal.idempotencyKey,
        signalId:       signal.signalId,
        agentId:        signal.sourceAgentId,
      });
    });

    // Record dedup key in cache (TTL = dedup window)
    await this.cache.set(dedupKey, signal.signalId, this.config.dedupWindowSeconds);

    // ── 10. Broker publish ──────────────────────────────────────────────────
    const hydrated: Signal = { ...signal, expiresAt: expiresAt ?? undefined };

    if (signal.propagationClass === 'IMMEDIATE') {
      await this.broker.publish(hydrated); // propagate errors for critical signals
    } else if (signal.propagationClass !== 'SILENT') {
      // Fire and forget for STANDARD / SLOW
      this.broker.publish(hydrated).catch(() => {
        // Broker failures for non-critical signals are logged via observability
        // instrumentation (M17) — not surfaced to the caller.
      });
    }

    return ok({ signalId: signal.signalId, entityId: signal.entityId, topic: signal.topic, expiresAt, ingestedAt });
  }

  // ── Batch ingest ─────────────────────────────────────────────────────────

  async ingestBatch(signals: Signal[]): Promise<{ succeeded: IngestResult[]; failed: Array<{ signal: Signal; error: Error }> }> {
    const succeeded: IngestResult[] = [];
    const failed: Array<{ signal: Signal; error: Error }> = [];

    for (const signal of signals) {
      const result = await this.ingest(signal);
      if (result.ok) {
        succeeded.push(result.value);
      } else {
        failed.push({ signal, error: result.error });
      }
    }

    return { succeeded, failed };
  }
}
