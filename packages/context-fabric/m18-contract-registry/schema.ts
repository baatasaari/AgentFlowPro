/**
 * M18 Contract Registry — Drizzle Schema
 *
 * cf_agent_contracts  : one row per agent+version. Immutable once registered;
 *                       new versions create new rows.
 * cf_contract_topics  : normalised allowed topics per contract (publish/subscribe).
 */

import {
  pgTable,
  text,
  boolean,
  timestamp,
  integer,
  pgEnum,
  primaryKey,
  index,
} from 'drizzle-orm/pg-core';

// ── Enums (mirrored from core/types.ts for the DB layer) ─────────────────────

export const signalLayerEnum = pgEnum('cf_signal_layer', [
  'SIGNAL', 'PATTERN', 'INFERENCE', 'DECISION', 'NARRATIVE',
]);

export const contextScopeEnum = pgEnum('cf_context_scope', [
  'ENTERPRISE', 'DOMAIN', 'SESSION', 'TASK', 'TURN',
]);

export const piiLevelEnum = pgEnum('cf_pii_level', ['NONE', 'MASKED', 'FULL']);

export const signalDomainEnum = pgEnum('cf_signal_domain', [
  'RETAIL', 'FRAUD', 'RISK', 'MORTGAGE',
  'OPERATIONS', 'COLLECTIONS', 'COMMERCIAL', 'SHARED',
]);

// ── Tables ───────────────────────────────────────────────────────────────────

/**
 * Each row represents one registered contract version.
 * The composite (agentId, version) must be unique.
 * contractId = agentId + "@" + version (e.g. "fraud-agent@1.2.0").
 */
export const cfAgentContracts = pgTable(
  'cf_agent_contracts',
  {
    contractId:              text('contract_id').primaryKey(),
    agentId:                 text('agent_id').notNull(),
    agentName:               text('agent_name').notNull(),
    domain:                  signalDomainEnum('domain').notNull(),
    version:                 text('version').notNull(),
    maxSignalRatePerMinute:  integer('max_signal_rate_per_minute').notNull().default(100),
    piiHandlingLevel:        piiLevelEnum('pii_handling_level').notNull().default('MASKED'),
    isActive:                boolean('is_active').notNull().default(true),
    registeredAt:            timestamp('registered_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:               timestamp('updated_at',   { withTimezone: true }).notNull().defaultNow(),
    // Stored as JSONB-ish comma-separated lists for simplicity in Phase 1.
    // Phase 2 normalises into cf_contract_topics.
    allowedScopesJson:       text('allowed_scopes_json').notNull().default('["ENTERPRISE","DOMAIN","SESSION","TASK","TURN"]'),
    allowedLayersJson:       text('allowed_layers_json').notNull().default('["SIGNAL","PATTERN","INFERENCE","DECISION","NARRATIVE"]'),
  },
  t => ({
    agentVersionIdx: index('idx_cf_contracts_agent_version').on(t.agentId, t.version),
    agentActiveIdx:  index('idx_cf_contracts_agent_active').on(t.agentId, t.isActive),
  }),
);

/**
 * Normalised topic permissions per contract.
 * direction: 'PUBLISH' | 'SUBSCRIBE'
 */
export const cfContractTopics = pgTable(
  'cf_contract_topics',
  {
    contractId: text('contract_id')
      .notNull()
      .references(() => cfAgentContracts.contractId, { onDelete: 'cascade' }),
    direction:  text('direction').notNull(), // 'PUBLISH' | 'SUBSCRIBE'
    topic:      text('topic').notNull(),     // may contain wildcards: "fraud.*"
  },
  t => ({
    pk:          primaryKey({ columns: [t.contractId, t.direction, t.topic] }),
    contractIdx: index('idx_cf_contract_topics_contract').on(t.contractId),
  }),
);

// ── Inferred types ────────────────────────────────────────────────────────────

export type DbAgentContract  = typeof cfAgentContracts.$inferSelect;
export type NewAgentContract = typeof cfAgentContracts.$inferInsert;
export type DbContractTopic  = typeof cfContractTopics.$inferSelect;
export type NewContractTopic = typeof cfContractTopics.$inferInsert;
