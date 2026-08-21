/**
 * M02 Entity Resolution + M03 Context Store — Express Router
 * Base path: /api/cf/entities
 */

import { Router, type Request, type Response } from 'express';
import { getContainer } from './container.js';
import {
  EntityNotFoundError,
  EntityResolutionError,
  ModuleDisabledError,
} from '../core/errors.js';
import type { RawIdentifier } from '../m02-entity-resolution/EntityResolutionService.js';
import type { ContextQuery } from '../m03-context-store/ContextStoreService.js';

export function entitiesRouter(): Router {
  const router = Router();

  // POST /api/cf/entities/resolve — resolve identifiers to a canonical entity
  router.post('/resolve', async (req: Request, res: Response) => {
    const { entityResolution } = await getContainer();

    const { identifiers, requestingDomain, requestingAgentId } =
      req.body as {
        identifiers: RawIdentifier[];
        requestingDomain: string;
        requestingAgentId: string;
      };

    if (!Array.isArray(identifiers) || !identifiers.length) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: "'identifiers' must be a non-empty array." } });
    }

    const result = await entityResolution.resolve({
      identifiers,
      requestingDomain: requestingDomain as RawIdentifier['domain'],
      requestingAgentId,
    });

    if (!result.ok) {
      return res.status(mapErrorStatus(result.error)).json({
        error: { code: result.error.code, message: result.error.message },
      });
    }

    return res.status(200).json({ data: result.value });
  });

  // GET /api/cf/entities/:entityId — look up a resolved entity
  router.get('/:entityId', async (req: Request, res: Response) => {
    const { entityResolution } = await getContainer();

    const result = await entityResolution.findById(req.params.entityId);

    if (!result.ok) {
      return res.status(mapErrorStatus(result.error)).json({
        error: { code: result.error.code, message: result.error.message },
      });
    }

    return res.json({ data: result.value });
  });

  // GET /api/cf/entities/:entityId/context — assemble full context for an entity
  router.get('/:entityId/context', async (req: Request, res: Response) => {
    const { contextStore } = await getContainer();

    const query: ContextQuery = {
      entityId:        req.params.entityId,
      maxSignals:      Math.min(parseInt(req.query['maxSignals']  as string ?? '50', 10), 200),
      maxInferences:   Math.min(parseInt(req.query['maxInferences'] as string ?? '20', 10), 100),
      maxDecisions:    Math.min(parseInt(req.query['maxDecisions']  as string ?? '10', 10), 50),
      sessionId:       req.query['sessionId'] as string | undefined,
      since:           req.query['since'] ? new Date(req.query['since'] as string) : undefined,
      includeExpired:  req.query['includeExpired'] === 'true',
    };

    const result = await contextStore.assemble(query);

    if (!result.ok) {
      return res.status(mapErrorStatus(result.error)).json({
        error: { code: result.error.code, message: result.error.message },
      });
    }

    return res.json({ data: result.value });
  });

  // POST /api/cf/entities/:entityId/snapshot — take a frozen context snapshot
  router.post('/:entityId/snapshot', async (req: Request, res: Response) => {
    const { contextStore } = await getContainer();

    const { workflowId, orchestratorId, ttlHours } =
      req.body as { workflowId: string; orchestratorId: string; ttlHours?: number };

    if (!workflowId || !orchestratorId) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: "'workflowId' and 'orchestratorId' are required." } });
    }

    const query: ContextQuery = { entityId: req.params.entityId };
    const result = await contextStore.takeSnapshot(
      req.params.entityId,
      workflowId,
      orchestratorId,
      query,
      ttlHours ?? 24,
    );

    if (!result.ok) {
      return res.status(mapErrorStatus(result.error)).json({
        error: { code: result.error.code, message: result.error.message },
      });
    }

    return res.status(201).json({ data: { snapshotId: result.value } });
  });

  // GET /api/cf/entities/snapshot/:snapshotId — retrieve a frozen snapshot
  router.get('/snapshot/:snapshotId', async (req: Request, res: Response) => {
    const { contextStore } = await getContainer();

    const result = await contextStore.getSnapshot(req.params.snapshotId);

    if (!result.ok) {
      return res.status(mapErrorStatus(result.error)).json({
        error: { code: result.error.code, message: result.error.message },
      });
    }

    return res.json({ data: result.value });
  });

  return router;
}

function mapErrorStatus(error: Error): number {
  if (error instanceof ModuleDisabledError)   return 503;
  if (error instanceof EntityNotFoundError)   return 404;
  if (error instanceof EntityResolutionError) return 422;
  return 500;
}
