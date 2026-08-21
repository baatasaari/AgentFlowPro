/**
 * M01 Signal Ingestion — Drizzle Schema
 *
 * cf_signals            : Append-only signal store. Never updated; only inserted.
 * cf_signal_idempotency : Short-lived dedup keys (TTL-managed in application layer).
 * cf_agent_rate_buckets : Sliding-window rate-limit counters per agent.
 */

import {
  pgTable,
  text,
  real,
  timestamp,
  boolean,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';

export const propagationClassEnum = pgEnum('cf_propagation_class', [
  'IMMEDIATE', 'STANDARD', 'SLOW', 'SILENT',
]);

export const decayClassEnum = pgEnum('cf_decay_class', [
  'IMMEDIATE_DECAY', 'STANDARD_DECAY', 'SLOW_DECAY', 'ETERNAL', 'EVENT_TRIGGERED',
]);

/**
 * The canonical append-only signal table.
 * Signals are never updated or deleted (except by the GDPR erasure module M14).
 * Physical deletes are replaced by a "redacted" flag + payload zeroing.
 */
export const cfSignals = pgTable(
  'cf_signals',
  {
    signalId:          text('signal_id').primaryKey(),           // UUIDv7
    idempotencyKey:    text('idempotency_key').notNull(),
    sourceAgentId:     text('source_agent_id').notNull(),
    sourceDomain:      text('source_domain').notNull(),
    entityId:          text('entity_id').notNull(),
    layer:             text('layer').notNull(),
    propagationClass:  propagationClassEnum('propagation_class').notNull(),
    decayClass:        decayClassEnum('decay_class').notNull(),
    scope:             text('scope').notNull(),
    topic:             text('topic').notNull(),
    payloadJson:       text('payload_json').notNull(),
    confidence:        real('confidence').notNull(),
    schemaVersion:     text('schema_version').notNull(),
    contractId:        text('contract_id').notNull(),
    correlationId:     text('correlation_id'),
    sessionId:         text('session_id'),
    taskId:            text('task_id'),
    producedAt:        timestamp('produced_at',  { withTimezone: true }).notNull(),
    ingestedAt:        timestamp('ingested_at',  { withTimezone: true }).notNull().defaultNow(),
    expiresAt:         timestamp('expires_at',   { withTimezone: true }),
    isRedacted:        boolean('is_redacted').notNull().default(false),
  },
  t => ({
    entityIdx:        index('idx_cf_signals_entity').on(t.entityId),
    agentIdx:         index('idx_cf_signals_agent').on(t.sourceAgentId),
    topicIdx:         index('idx_cf_signals_topic').on(t.topic),
    domainTopicIdx:   index('idx_cf_signals_domain_topic').on(t.sourceDomain, t.topic),
    ingestedAtIdx:    index('idx_cf_signals_ingested_at').on(t.ingestedAt),
    expiresAtIdx:     index('idx_cf_signals_expires_at').on(t.expiresAt),
    correlationIdx:   index('idx_cf_signals_correlation').on(t.correlationId),
    sessionIdx:       index('idx_cf_signals_session').on(t.sessionId),
  }),
);

/**
 * Short-lived idempotency records.
 * The application layer manages TTL by checking ingestedAt + window.
 * Rows older than the dedup window can be purged by a nightly job.
 */
export const cfSignalIdempotency = pgTable(
  'cf_signal_idempotency',
  {
    idempotencyKey: text('idempotency_key').primaryKey(),
    signalId:       text('signal_id').notNull(),
    agentId:        text('agent_id').notNull(),
    ingestedAt:     timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => ({
    agentIdx:    index('idx_cf_idempotency_agent').on(t.agentId),
    ingestedIdx: index('idx_cf_idempotency_ingested').on(t.ingestedAt),
  }),
);

export type DbSignal         = typeof cfSignals.$inferSelect;
export type NewSignal        = typeof cfSignals.$inferInsert;
export type DbIdempotency    = typeof cfSignalIdempotency.$inferSelect;
export type NewIdempotency   = typeof cfSignalIdempotency.$inferInsert;
