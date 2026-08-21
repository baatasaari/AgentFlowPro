/**
 * M02 Entity Resolution — Drizzle Schema
 *
 * cf_entities             : Canonical entity records (one row per resolved entity).
 * cf_entity_identifiers   : Hashed identifiers linked to an entity.
 * cf_entity_merges        : Immutable audit trail of all entity merge operations.
 */

import {
  pgTable,
  text,
  real,
  timestamp,
  boolean,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';

export const identifierTypeEnum = pgEnum('cf_identifier_type', [
  'DOB', 'PHONE', 'EMAIL', 'FULL_NAME', 'POSTCODE',
  'SORT_CODE_ACCOUNT', 'NATIONAL_INSURANCE', 'PASSPORT',
]);

/**
 * One row per canonical entity.
 * aliasesJson: JSON array of previous entity IDs merged into this record.
 * domainPresenceJson: JSON array of SignalDomain values.
 */
export const cfEntities = pgTable(
  'cf_entities',
  {
    entityId:           text('entity_id').primaryKey(),
    aliasesJson:        text('aliases_json').notNull().default('[]'),
    domainPresenceJson: text('domain_presence_json').notNull().default('[]'),
    isMerged:           boolean('is_merged').notNull().default(false),
    mergedIntoId:       text('merged_into_id'),   // if this entity was merged into another
    mergedAt:           timestamp('merged_at',   { withTimezone: true }),
    createdAt:          timestamp('created_at',  { withTimezone: true }).notNull().defaultNow(),
    updatedAt:          timestamp('updated_at',  { withTimezone: true }).notNull().defaultNow(),
  },
  t => ({
    mergedIntoIdx: index('idx_cf_entities_merged_into').on(t.mergedIntoId),
  }),
);

/**
 * Identifier → Entity linkage.
 * valueHash: HMAC-SHA256 of the raw identifier value.
 * Raw PII is never stored; only the hash.
 *
 * Multiple domains may contribute the same identifier type for the same entity
 * (composite PK on entityId + type + domain).
 */
export const cfEntityIdentifiers = pgTable(
  'cf_entity_identifiers',
  {
    identifierId: text('identifier_id').primaryKey(),         // UUID
    entityId:     text('entity_id')
                    .notNull()
                    .references(() => cfEntities.entityId, { onDelete: 'cascade' }),
    type:         identifierTypeEnum('type').notNull(),
    valueHash:    text('value_hash').notNull(),
    confidence:   real('confidence').notNull(),
    domain:       text('domain').notNull(),
    addedAt:      timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => ({
    entityIdx:    index('idx_cf_identifiers_entity').on(t.entityId),
    hashIdx:      index('idx_cf_identifiers_hash').on(t.type, t.valueHash),
  }),
);

/**
 * Append-only record of every entity merge.
 * Used by M14 (Right-to-Erasure) and for audit / debugging.
 */
export const cfEntityMerges = pgTable(
  'cf_entity_merges',
  {
    mergeId:      text('merge_id').primaryKey(),
    survivorId:   text('survivor_id').notNull(),  // the entity that persists
    absorbedId:   text('absorbed_id').notNull(),  // the entity that was merged in
    score:        real('score').notNull(),         // combined resolution score at merge time
    mergedAt:     timestamp('merged_at', { withTimezone: true }).notNull().defaultNow(),
    triggeredBy:  text('triggered_by').notNull(),  // sourceAgentId that triggered the merge
  },
  t => ({
    survivorIdx:  index('idx_cf_merges_survivor').on(t.survivorId),
    absorbedIdx:  index('idx_cf_merges_absorbed').on(t.absorbedId),
  }),
);

export type DbEntity            = typeof cfEntities.$inferSelect;
export type NewEntity           = typeof cfEntities.$inferInsert;
export type DbEntityIdentifier  = typeof cfEntityIdentifiers.$inferSelect;
export type NewEntityIdentifier = typeof cfEntityIdentifiers.$inferInsert;
export type DbEntityMerge       = typeof cfEntityMerges.$inferSelect;
export type NewEntityMerge      = typeof cfEntityMerges.$inferInsert;
