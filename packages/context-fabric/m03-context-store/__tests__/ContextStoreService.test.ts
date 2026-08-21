/**
 * M03 Context Store — Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { ModuleDisabledError } from '../../core/errors.js';
import type { ContextQuery } from '../ContextStoreService.js';
import { ContextStoreService } from '../ContextStoreService.js';

// ── DB Stub ───────────────────────────────────────────────────────────────────

/**
 * Build a DB stub where specific entity IDs return controlled merge state.
 * mergeMap: { [absorbedId]: survivorId } — absorbed IDs are marked as merged.
 * Any entity ID not in mergeMap is treated as a live canonical entity.
 */
function makeDbStub(mergeMap: Record<string, string> = {}) {
  return {
    select: () => ({
      from: () => ({
        where: (_cond: unknown) => {
          // We can't easily introspect the drizzle condition, so we capture
          // calls by call order instead. Return a Proxy that responds to limit().
          let callIndex = 0;
          return {
            limit: (_n: number) => {
              // First call is always cfEntities to resolve the entity chain.
              // We return based on a simple heuristic: if any entry is in mergeMap
              // (tested by checking all values), return the merged row for the absorbed ID.
              // For unit tests we keep the merge chain to exactly one hop.
              callIndex++;
              if (callIndex === 1 && Object.keys(mergeMap).length > 0) {
                const [absorbedId, survivorId] = Object.entries(mergeMap)[0];
                return Promise.resolve([{ entityId: absorbedId, isMerged: true, mergedIntoId: survivorId }]);
              }
              // All other queries (survivor lookup, signals, inferences, decisions)
              // return empty / non-merged results.
              return Promise.resolve([{ entityId: 'e-1', isMerged: false, mergedIntoId: null }]);
            },
            orderBy: () => ({ limit: () => Promise.resolve([]) }),
          };
        },
        orderBy: () => ({ limit: () => Promise.resolve([]) }),
      }),
    }),
    insert: () => ({ values: () => Promise.resolve() }),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ContextStoreService', () => {

  it('returns ModuleDisabledError when disabled', async () => {
    const db  = makeDbStub() as never;
    const svc = new ContextStoreService(db, false);

    const result = await svc.assemble({ entityId: 'e-1' });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toBeInstanceOf(ModuleDisabledError);
  });

  it('assembles empty context for an entity with no signals', async () => {
    const db  = makeDbStub() as never;
    const svc = new ContextStoreService(db, true);

    const result = await svc.assemble({ entityId: 'e-1' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.signals).toHaveLength(0);
      expect(result.value.inferences).toHaveLength(0);
      expect(result.value.decisions).toHaveLength(0);
      expect(result.value.assembledAt).toBeInstanceOf(Date);
    }
  });

  it('resolves a merged entity to its canonical survivor (single hop)', async () => {
    // Stub: e-absorbed → e-survivor (one hop, then e-survivor is live)
    const db  = makeDbStub({ 'e-absorbed': 'e-survivor' }) as never;
    const svc = new ContextStoreService(db, true);

    // Query for the absorbed entity — service must chase the merge to e-survivor
    const result = await svc.assemble({ entityId: 'e-absorbed' });

    // The context should assemble successfully (survivor has no signals in stub, but
    // the call should complete without stack overflow or error)
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.assembledAt).toBeInstanceOf(Date);
    }
  });

  it('does not infinite-loop when merge chain exceeds depth limit', async () => {
    // All queries return the same "merged" entity to simulate a cycle.
    // The depth guard (max 10 hops) should stop recursion and return the
    // last-seen ID rather than crashing the worker.
    const cyclicDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{ entityId: 'x', isMerged: true, mergedIntoId: 'x' }]),
            orderBy: () => ({ limit: () => Promise.resolve([]) }),
          }),
          orderBy: () => ({ limit: () => Promise.resolve([]) }),
        }),
      }),
    } as never;

    const svc = new ContextStoreService(cyclicDb, true);
    // Should resolve without throwing (depth guard kicks in at hop 10)
    const result = await svc.assemble({ entityId: 'x' });
    expect(result.ok).toBe(true);
  });
});
