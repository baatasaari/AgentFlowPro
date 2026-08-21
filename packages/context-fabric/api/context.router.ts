/**
 * Context Fabric — M05 Context Assembler Router
 *
 * POST /api/cf/context/assemble
 *   Assemble the full context package for an entity + requesting agent.
 *
 * DELETE /api/cf/context/:entityId
 *   Invalidate the assembled context cache for an entity.
 *
 * POST /api/cf/context/infer
 *   Run inference rules against an entity's assembled signals (M07).
 */

import { Router, type Request, type Response } from 'express';
import { getContainer } from './container.js';

export function contextRouter(): Router {
  const router = Router();

  // ── POST /assemble ─────────────────────────────────────────────────────────
  router.post('/assemble', async (req: Request, res: Response) => {
    const { entityId, requestingAgentId, scopes, layers, domains, sessionId, since, maxSignals } =
      req.body as Record<string, unknown>;

    if (!entityId || !requestingAgentId) {
      res.status(400).json({ error: 'entityId and requestingAgentId are required' });
      return;
    }

    const container = await getContainer();
    const result = await container.contextAssembler.assemble({
      entityId:          String(entityId),
      requestingAgentId: String(requestingAgentId),
      scopes:            scopes  as never,
      layers:            layers  as never,
      domains:           domains as never,
      sessionId:         sessionId ? String(sessionId) : undefined,
      since:             since     ? new Date(String(since)) : undefined,
      maxSignals:        maxSignals ? Number(maxSignals) : undefined,
    });

    if (!result.ok) {
      const status = result.error.message.includes('disabled') ? 503 : 500;
      res.status(status).json({ error: result.error.message });
      return;
    }

    res.json(result.value);
  });

  // ── DELETE /:entityId (cache invalidation) ─────────────────────────────────
  router.delete('/:entityId', async (req: Request, res: Response) => {
    const { entityId } = req.params;
    const container = await getContainer();
    await container.contextAssembler.invalidate(entityId);
    res.json({ invalidated: true, entityId });
  });

  // ── POST /infer ────────────────────────────────────────────────────────────
  // Runs M07 inference rules against signals supplied in the body.
  // In production this is called by the M08 sidecar or a scheduled job.
  router.post('/infer', async (req: Request, res: Response) => {
    const { entityId, signals } = req.body as Record<string, unknown>;

    if (!entityId || !Array.isArray(signals)) {
      res.status(400).json({ error: 'entityId and signals[] are required' });
      return;
    }

    const container = await getContainer();
    const result = await container.inferenceEngine.evaluate(
      String(entityId),
      signals as never,
    );

    if (!result.ok) {
      const status = result.error.message.includes('disabled') ? 503 : 500;
      res.status(status).json({ error: result.error.message });
      return;
    }

    res.json({ inferred: result.value });
  });

  return router;
}
