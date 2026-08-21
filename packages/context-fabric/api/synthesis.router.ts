/**
 * Context Fabric — M06 Synthesis Engine Router
 *
 * POST /api/cf/synthesis
 *   Synthesise a narrative for an assembled context package.
 *   Accepts a pre-assembled package in the request body.
 *
 * DELETE /api/cf/synthesis/:entityId
 *   Invalidate the synthesis cache for an entity.
 */

import { Router, type Request, type Response } from 'express';
import { getContainer } from './container.js';
import type { AssembledPackage } from '../m05-context-assembler/ContextAssemblerService.js';

export function synthesisRouter(): Router {
  const router = Router();

  // ── POST / ─────────────────────────────────────────────────────────────────
  router.post('/', async (req: Request, res: Response) => {
    const pkg = req.body as AssembledPackage;

    if (!pkg?.entityId || !pkg?.requestingAgentId) {
      res.status(400).json({
        error: 'Request body must be a valid AssembledPackage with entityId and requestingAgentId',
      });
      return;
    }

    // Restore Date objects that arrive as strings over the wire
    if (typeof pkg.assembledAt === 'string') {
      pkg.assembledAt = new Date(pkg.assembledAt);
    }
    for (const sig of pkg.signals ?? []) {
      if (typeof sig.producedAt === 'string') {
        sig.producedAt = new Date(sig.producedAt);
      }
    }

    const container = await getContainer();
    const result = await container.synthesisEngine.synthesise(pkg);

    if (!result.ok) {
      const status = result.error.message.includes('disabled') ? 503 : 500;
      res.status(status).json({ error: result.error.message });
      return;
    }

    res.json(result.value);
  });

  // ── DELETE /:entityId ──────────────────────────────────────────────────────
  router.delete('/:entityId', async (req: Request, res: Response) => {
    const { entityId } = req.params;
    const container = await getContainer();
    await container.synthesisEngine.invalidate(entityId);
    res.json({ invalidated: true, entityId });
  });

  return router;
}
