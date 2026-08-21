/**
 * M02 Entity Resolution Engine — EntityResolutionService
 *
 * Resolves an inbound set of identifiers to a canonical entity record.
 * Called by M01 during signal ingestion to populate signal.entityId.
 *
 * Resolution algorithm:
 *   1. Hash all incoming identifier values (HMAC-SHA256 with CF_IDENTIFIER_HMAC_KEY)
 *   2. For each identifier type, look up matching stored entities via their hash
 *   3. Score all candidate entities against the incoming identifier set (EntityScorer)
 *   4. If best score ≥ merge threshold → auto-merge (absorb candidate into survivor)
 *   5. If 0.5 ≤ score < threshold → create new entity + flag for review (Phase 2)
 *   6. If no candidate or score < 0.5 → create new entity
 *
 * Merge semantics:
 *   - The entity with the earlier createdAt becomes the survivor
 *   - Absorbed entity's IDs become aliases on the survivor
 *   - Absorbed entity row is marked isMerged=true + mergedIntoId set
 *   - All subsequent signals route to the survivor's entityId
 *   - An audit row is written to cf_entity_merges
 *
 * PII protection:
 *   - Raw identifier values NEVER enter this service
 *   - Callers pre-hash values with hashIdentifier() before calling resolve()
 *   - The HMAC key is environment-controlled (CF_IDENTIFIER_HMAC_KEY)
 */

import { createHmac } from 'crypto';
import { eq, or } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { randomUUID } from 'crypto';

import type {
  Entity,
  EntityIdentifier,
  IdentifierType,
  SignalDomain,
  Result,
} from '../core/types.js';
import { ok, err } from '../core/types.js';
import {
  EntityResolutionError,
  EntityNotFoundError,
  ModuleDisabledError,
} from '../core/errors.js';
import type { ICache } from '../ports/ICache.js';
import { EntityScorer } from './EntityScorer.js';
import {
  cfEntities,
  cfEntityIdentifiers,
  cfEntityMerges,
  type NewEntity,
  type NewEntityIdentifier,
  type NewEntityMerge,
  type DbEntity,
  type DbEntityIdentifier,
} from './schema.js';

// ── Input types ───────────────────────────────────────────────────────────────

export interface RawIdentifier {
  type:       IdentifierType;
  /** Raw PII value — hashed internally, never stored. */
  rawValue:   string;
  confidence: number;
  domain:     SignalDomain;
}

export interface ResolveInput {
  identifiers: RawIdentifier[];
  /** The domain of the agent requesting resolution. */
  requestingDomain: SignalDomain;
  /** The agent ID requesting resolution (for audit). */
  requestingAgentId: string;
}

export interface ResolveResult {
  entityId:  string;
  isNew:     boolean;    // true if a new entity was created
  wasMerged: boolean;    // true if two entities were merged
  survivorId?: string;   // set when wasMerged=true
}

// ── Service ──────────────────────────────────────────────────────────────────

const CACHE_PREFIX = 'cf:entity:hash:';
const CACHE_TTL    = 600; // 10 minutes

export class EntityResolutionService {
  private readonly scorer: EntityScorer;
  private readonly hmacKey: string;

  constructor(
    private readonly db:      NodePgDatabase<Record<string, never>>,
    private readonly cache:   ICache,
    private readonly enabled: boolean,
    mergeThreshold: number = 0.75,
  ) {
    this.scorer  = new EntityScorer(mergeThreshold);
    this.hmacKey = process.env['CF_IDENTIFIER_HMAC_KEY'] ?? 'dev-only-hmac-key-change-in-production';
  }

  // ── Resolve ───────────────────────────────────────────────────────────────

  async resolve(input: ResolveInput): Promise<Result<ResolveResult>> {
    if (!this.enabled) return err(new ModuleDisabledError('M02_ENTITY_RESOLUTION'));
    if (!input.identifiers.length) {
      return err(new EntityResolutionError('At least one identifier is required to resolve an entity.'));
    }

    // Hash all incoming identifier values
    const hashed = input.identifiers.map(id => this._hashIdentifier(id));

    // Look up candidate entities by identifier hash
    const candidates = await this._findCandidates(hashed);

    // Score candidates
    const best = this.scorer.findBestMatch(hashed, candidates);

    if (!best) {
      // No match — create a new entity
      const entityId = await this._createEntity(hashed, input.requestingDomain);
      return ok({ entityId, isNew: true, wasMerged: false });
    }

    if (best.match.shouldMerge && candidates.length >= 2) {
      // Two strong candidates — merge the weaker into the stronger
      const survivor = candidates.reduce((a, b) =>
        new Date(a.createdAt ?? 0) <= new Date(b.createdAt ?? 0) ? a : b,
      );
      const absorbed = candidates.find(c => c.entityId !== survivor.entityId)!;

      await this._mergeEntities(survivor.entityId, absorbed.entityId, best.match.score, input.requestingAgentId);
      await this._invalidateEntityCache(survivor.entityId);
      await this._invalidateEntityCache(absorbed.entityId);

      return ok({ entityId: survivor.entityId, isNew: false, wasMerged: true, survivorId: survivor.entityId });
    }

    // Single best match — enrich existing entity with any new identifiers
    await this._enrichEntity(best.entityId, hashed, input.requestingDomain);
    await this._invalidateEntityCache(best.entityId);

    return ok({ entityId: best.entityId, isNew: false, wasMerged: false });
  }

  // ── Lookup ────────────────────────────────────────────────────────────────

  async findById(entityId: string): Promise<Result<Entity>> {
    if (!this.enabled) return err(new ModuleDisabledError('M02_ENTITY_RESOLUTION'));

    // Try cache
    const cacheKey = `cf:entity:${entityId}`;
    const cached   = await this.cache.get(cacheKey);
    if (cached) return ok(JSON.parse(cached) as Entity);

    const rows = await this.db
      .select()
      .from(cfEntities)
      .where(eq(cfEntities.entityId, entityId))
      .limit(1);

    if (!rows.length) return err(new EntityNotFoundError(entityId));

    const entity = await this._hydrateEntity(rows[0]);
    await this.cache.set(cacheKey, JSON.stringify(entity), CACHE_TTL);
    return ok(entity);
  }

  // ── Hash util (public so ingestion layer can pre-hash) ────────────────────

  hashRawValue(type: IdentifierType, rawValue: string): string {
    return createHmac('sha256', this.hmacKey)
      .update(`${type}:${rawValue.trim().toLowerCase()}`)
      .digest('hex');
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _hashIdentifier(raw: RawIdentifier): EntityIdentifier {
    return {
      type:       raw.type,
      valueHash:  this.hashRawValue(raw.type, raw.rawValue),
      confidence: raw.confidence,
      domain:     raw.domain,
      addedAt:    new Date(),
    };
  }

  private async _findCandidates(
    identifiers: EntityIdentifier[],
  ): Promise<Array<{ entityId: string; identifiers: EntityIdentifier[]; createdAt: Date }>> {
    if (!identifiers.length) return [];

    // Check cache first for each hash
    const cacheHits = new Map<string, string>(); // hash → entityId
    for (const id of identifiers) {
      const hit = await this.cache.get(`${CACHE_PREFIX}${id.type}:${id.valueHash}`);
      if (hit) cacheHits.set(`${id.type}:${id.valueHash}`, hit);
    }

    // Collect unique entity IDs from cache hits
    const cachedEntityIds = [...new Set(cacheHits.values())];

    // Find entity IDs from DB for cache-missed hashes
    const dbRows = await this.db
      .select()
      .from(cfEntityIdentifiers)
      .where(
        or(
          ...identifiers.map(id =>
            eq(cfEntityIdentifiers.valueHash, id.valueHash),
          ),
        ),
      );

    const dbEntityIds = [...new Set(dbRows.map(r => r.entityId))];
    const allEntityIds = [...new Set([...cachedEntityIds, ...dbEntityIds])];

    if (!allEntityIds.length) return [];

    // Load full entity identifier sets for each candidate
    const result: Array<{ entityId: string; identifiers: EntityIdentifier[]; createdAt: Date }> = [];

    for (const entityId of allEntityIds) {
      const idRows = await this.db
        .select()
        .from(cfEntityIdentifiers)
        .where(eq(cfEntityIdentifiers.entityId, entityId));

      const entityRows = await this.db
        .select()
        .from(cfEntities)
        .where(eq(cfEntities.entityId, entityId))
        .limit(1);

      if (!entityRows.length || entityRows[0].isMerged) continue;

      result.push({
        entityId,
        createdAt: entityRows[0].createdAt,
        identifiers: idRows.map(r => ({
          type:       r.type as IdentifierType,
          valueHash:  r.valueHash,
          confidence: r.confidence,
          domain:     r.domain as SignalDomain,
          addedAt:    r.addedAt,
        })),
      });
    }

    return result;
  }

  private async _createEntity(
    identifiers: EntityIdentifier[],
    domain:      SignalDomain,
  ): Promise<string> {
    const entityId = randomUUID();
    const now      = new Date();

    await this.db.transaction(async tx => {
      const newEntity: NewEntity = {
        entityId,
        aliasesJson:        '[]',
        domainPresenceJson: JSON.stringify([domain]),
        isMerged:           false,
        createdAt:          now,
        updatedAt:          now,
      };
      await tx.insert(cfEntities).values(newEntity);

      const idRows: NewEntityIdentifier[] = identifiers.map(id => ({
        identifierId: randomUUID(),
        entityId,
        type:         id.type as NewEntityIdentifier['type'],
        valueHash:    id.valueHash,
        confidence:   id.confidence,
        domain:       id.domain,
        addedAt:      now,
      }));

      if (idRows.length) await tx.insert(cfEntityIdentifiers).values(idRows);
    });

    // Cache the hash → entityId mapping for fast future lookups
    for (const id of identifiers) {
      await this.cache.set(`${CACHE_PREFIX}${id.type}:${id.valueHash}`, entityId, CACHE_TTL);
    }

    return entityId;
  }

  private async _enrichEntity(
    entityId:   string,
    identifiers: EntityIdentifier[],
    domain:      SignalDomain,
  ): Promise<void> {
    const now = new Date();

    // Load existing identifiers to avoid inserting duplicates
    const existing = await this.db
      .select()
      .from(cfEntityIdentifiers)
      .where(eq(cfEntityIdentifiers.entityId, entityId));

    const existingHashes = new Set(existing.map(e => `${e.type}:${e.valueHash}`));

    const newIds = identifiers.filter(
      id => !existingHashes.has(`${id.type}:${id.valueHash}`),
    );

    if (newIds.length) {
      await this.db.insert(cfEntityIdentifiers).values(
        newIds.map(id => ({
          identifierId: randomUUID(),
          entityId,
          type:         id.type as NewEntityIdentifier['type'],
          valueHash:    id.valueHash,
          confidence:   id.confidence,
          domain:       id.domain,
          addedAt:      now,
        })),
      );
    }

    // Update domain presence
    const entityRows = await this.db
      .select()
      .from(cfEntities)
      .where(eq(cfEntities.entityId, entityId))
      .limit(1);

    if (entityRows.length) {
      const currentDomains: SignalDomain[] = JSON.parse(entityRows[0].domainPresenceJson);
      if (!currentDomains.includes(domain)) {
        await this.db
          .update(cfEntities)
          .set({
            domainPresenceJson: JSON.stringify([...currentDomains, domain]),
            updatedAt:          now,
          })
          .where(eq(cfEntities.entityId, entityId));
      }
    }
  }

  private async _mergeEntities(
    survivorId:    string,
    absorbedId:    string,
    score:         number,
    triggeredBy:   string,
  ): Promise<void> {
    const now = new Date();

    await this.db.transaction(async tx => {
      // Mark absorbed entity as merged
      await tx
        .update(cfEntities)
        .set({ isMerged: true, mergedIntoId: survivorId, mergedAt: now, updatedAt: now })
        .where(eq(cfEntities.entityId, absorbedId));

      // Add absorbed ID to survivor's aliases
      const survivorRows = await tx
        .select()
        .from(cfEntities)
        .where(eq(cfEntities.entityId, survivorId))
        .limit(1);

      if (survivorRows.length) {
        const aliases: string[] = JSON.parse(survivorRows[0].aliasesJson);
        aliases.push(absorbedId);
        await tx
          .update(cfEntities)
          .set({ aliasesJson: JSON.stringify(aliases), updatedAt: now })
          .where(eq(cfEntities.entityId, survivorId));
      }

      // Re-parent absorbed entity's identifiers to the survivor
      await tx
        .update(cfEntityIdentifiers)
        .set({ entityId: survivorId })
        .where(eq(cfEntityIdentifiers.entityId, absorbedId));

      // Write audit record
      const mergeRow: NewEntityMerge = {
        mergeId:     randomUUID(),
        survivorId,
        absorbedId,
        score,
        triggeredBy,
        mergedAt:    now,
      };
      await tx.insert(cfEntityMerges).values(mergeRow);
    });
  }

  private async _invalidateEntityCache(entityId: string): Promise<void> {
    await this.cache.del(`cf:entity:${entityId}`);
    // Also flush all hash → entityId mappings for this entity
    await this.cache.flushPrefix(`${CACHE_PREFIX}`);
  }

  private async _hydrateEntity(row: DbEntity): Promise<Entity> {
    const idRows = await this.db
      .select()
      .from(cfEntityIdentifiers)
      .where(eq(cfEntityIdentifiers.entityId, row.entityId));

    return {
      entityId:       row.entityId,
      aliases:        JSON.parse(row.aliasesJson) as string[],
      identifiers:    idRows.map(r => ({
        type:       r.type as IdentifierType,
        valueHash:  r.valueHash,
        confidence: r.confidence,
        domain:     r.domain as SignalDomain,
        addedAt:    r.addedAt,
      })),
      domainPresence: JSON.parse(row.domainPresenceJson) as SignalDomain[],
      createdAt:      row.createdAt,
      updatedAt:      row.updatedAt,
      mergedAt:       row.mergedAt ?? undefined,
      mergedFromId:   row.mergedIntoId ?? undefined,
    };
  }
}
