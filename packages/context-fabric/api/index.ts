/**
 * Context Fabric Platform — API Mount Point
 *
 * Import and call mountContextFabricApi(app) in server/routes.ts
 * to register all Phase 1 routes under /api/cf.
 */

import type { Express } from 'express';
import { contractsRouter } from './contracts.router.js';
import { signalsRouter }   from './signals.router.js';
import { entitiesRouter }  from './entities.router.js';
import { healthRouter }    from './health.router.js';

export function mountContextFabricApi(app: Express): void {
  // Health + readiness
  app.use('/api/cf', healthRouter());

  // M18 Contract Registry
  app.use('/api/cf/contracts', contractsRouter());

  // M01 Signal Ingestion + M03 Signal reads
  app.use('/api/cf/signals', signalsRouter());

  // M02 Entity Resolution + M03 Context assembly
  app.use('/api/cf/entities', entitiesRouter());
}

export { getContainer } from './container.js';
