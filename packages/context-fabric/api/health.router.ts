/**
 * Context Fabric Platform — Health + Readiness Router
 * Base path: /api/cf
 */

import { Router, type Request, type Response } from 'express';
import { getContainer } from './container.js';
import { loadConfig } from '../core/config.js';

export function healthRouter(): Router {
  const router = Router();

  // GET /api/cf/health — liveness probe
  router.get('/health', (_req: Request, res: Response) => {
    return res.json({
      status:    'ok',
      timestamp: new Date().toISOString(),
      service:   'context-fabric',
      version:   '1.0.0',
    });
  });

  // GET /api/cf/ready — readiness probe (checks DB + broker)
  router.get('/ready', async (_req: Request, res: Response) => {
    try {
      const { signalBroker } = await getContainer();
      const statsResult = await signalBroker.stats();

      return res.json({
        status:  'ready',
        modules: moduleStatus(),
        broker:  statsResult.ok ? statsResult.value : { error: 'broker unavailable' },
      });
    } catch (err) {
      return res.status(503).json({
        status:  'not_ready',
        message: err instanceof Error ? err.message : 'unknown error',
      });
    }
  });

  return router;
}

function moduleStatus() {
  const config = loadConfig();
  return {
    M01_SIGNAL_INGESTION:    config.M01_SIGNAL_INGESTION_ENABLED,
    M02_ENTITY_RESOLUTION:   config.M02_ENTITY_RESOLUTION_ENABLED,
    M03_CONTEXT_STORE:       config.M03_CONTEXT_STORE_ENABLED,
    M04_SIGNAL_BROKER:       config.M04_SIGNAL_BROKER_ENABLED,
    M18_CONTRACT_REGISTRY:   config.M18_CONTRACT_REGISTRY_ENABLED,
  };
}
