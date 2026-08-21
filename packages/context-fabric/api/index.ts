/**
 * Context Fabric Platform — API Mount Point
 *
 * Import and call mountContextFabricApi(app) in server/routes.ts
 * to register all Phase 1 + Phase 2 routes under /api/cf.
 */

import type { Express } from 'express';
import { contractsRouter } from './contracts.router.js';
import { signalsRouter }   from './signals.router.js';
import { entitiesRouter }  from './entities.router.js';
import { healthRouter }    from './health.router.js';
import { contextRouter }   from './context.router.js';
import { synthesisRouter } from './synthesis.router.js';
import { sessionsRouter }  from './sessions.router.js';

export function mountContextFabricApi(app: Express): void {
  // Health + readiness
  app.use('/api/cf', healthRouter());

  // ── Phase 1 ───────────────────────────────────────────────────────────────
  // M18 Contract Registry
  app.use('/api/cf/contracts', contractsRouter());

  // M01 Signal Ingestion + M03 Signal reads
  app.use('/api/cf/signals', signalsRouter());

  // M02 Entity Resolution + M03 Context assembly
  app.use('/api/cf/entities', entitiesRouter());

  // ── Phase 2 ───────────────────────────────────────────────────────────────
  // M05 Context Assembler + M07 Inference Engine
  app.use('/api/cf/context', contextRouter());

  // M06 Synthesis Engine
  app.use('/api/cf/synthesis', synthesisRouter());

  // M08 Context Sidecar (session lifecycle + turn-boundary delivery)
  app.use('/api/cf/sessions', sessionsRouter());
}

export { getContainer } from './container.js';
