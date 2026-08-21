/**
 * Context Fabric — M08 Context Sidecar Router
 *
 * POST /api/cf/sessions
 *   Register a new agent session.
 *
 * DELETE /api/cf/sessions/:sessionId
 *   End an agent session.
 *
 * POST /api/cf/sessions/:sessionId/signal
 *   Push a signal into a session's delta queue.
 *
 * GET /api/cf/sessions/:sessionId/context
 *   Drain delta queue, assemble context, optionally synthesise.
 */

import { Router, type Request, type Response } from 'express';
import { getContainer } from './container.js';
import type { SessionType } from '../m08-context-sidecar/SessionRegistry.js';
import type { Signal } from '../core/types.js';

export function sessionsRouter(): Router {
  const router = Router();

  // ── POST / — start session ────────────────────────────────────────────────
  router.post('/', async (req: Request, res: Response) => {
    const { sessionId, agentId, entityId, sessionType } = req.body as Record<string, unknown>;

    if (!sessionId || !agentId || !entityId || !sessionType) {
      res.status(400).json({
        error: 'sessionId, agentId, entityId, and sessionType are required',
      });
      return;
    }

    const validTypes: SessionType[] = ['CONVERSATIONAL', 'WORKFLOW'];
    if (!validTypes.includes(sessionType as SessionType)) {
      res.status(400).json({ error: `sessionType must be one of: ${validTypes.join(', ')}` });
      return;
    }

    const container = await getContainer();
    const result = container.sidecar.startSession({
      sessionId:   String(sessionId),
      agentId:     String(agentId),
      entityId:    String(entityId),
      sessionType: sessionType as SessionType,
    });

    if (!result.ok) {
      const status = result.error.message.includes('disabled') ? 503 : 409;
      res.status(status).json({ error: result.error.message });
      return;
    }

    res.status(201).json({
      sessionId: result.value.sessionId,
      agentId:   result.value.agentId,
      entityId:  result.value.entityId,
      sessionType: result.value.sessionType,
      startedAt: result.value.startedAt,
    });
  });

  // ── DELETE /:sessionId — end session ──────────────────────────────────────
  router.delete('/:sessionId', async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const container = await getContainer();
    container.sidecar.endSession(sessionId);
    res.json({ ended: true, sessionId });
  });

  // ── POST /:sessionId/signal — push a signal ───────────────────────────────
  router.post('/:sessionId/signal', async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const signal = req.body as Signal;

    if (!signal?.signalId) {
      res.status(400).json({ error: 'Request body must be a valid Signal' });
      return;
    }

    if (typeof signal.producedAt === 'string') {
      (signal as never as { producedAt: Date }).producedAt = new Date(signal.producedAt);
    }

    const container = await getContainer();
    container.sidecar.pushSignal(sessionId, signal);
    res.json({ queued: true, sessionId, signalId: signal.signalId });
  });

  // ── GET /:sessionId/context — drain + assemble ────────────────────────────
  router.get('/:sessionId/context', async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const container = await getContainer();
    const result = await container.sidecar.getContext(sessionId);

    if (!result.ok) {
      const status = result.error.message.includes('not found')   ? 404
                   : result.error.message.includes('disabled') ? 503
                   : 500;
      res.status(status).json({ error: result.error.message });
      return;
    }

    res.json(result.value);
  });

  return router;
}
