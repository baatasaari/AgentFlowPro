/**
 * M01 Signal Ingestion — Express Router
 * Base path: /api/cf/signals
 */

import { Router, type Request, type Response } from 'express';
import { getContainer } from './container.js';
import {
  DuplicateSignalError,
  RateLimitError,
  SignalValidationError,
  ContractNotFoundError,
  ContractViolationError,
  ModuleDisabledError,
} from '../core/errors.js';
import type { Signal } from '../core/types.js';

export function signalsRouter(): Router {
  const router = Router();

  // POST /api/cf/signals — ingest a single signal
  router.post('/', async (req: Request, res: Response) => {
    const { signalIngestion } = await getContainer();

    const signal = req.body as Signal;
    if (signal.producedAt) {
      signal.producedAt = new Date(signal.producedAt);
    }

    const result = await signalIngestion.ingest(signal);

    if (!result.ok) {
      return res.status(mapErrorStatus(result.error)).json({
        error: { code: result.error.code, message: result.error.message },
      });
    }

    return res.status(202).json({ data: result.value });
  });

  // POST /api/cf/signals/batch — ingest multiple signals
  router.post('/batch', async (req: Request, res: Response) => {
    const { signalIngestion } = await getContainer();

    const { signals } = req.body as { signals: Signal[] };
    if (!Array.isArray(signals) || signals.length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: "'signals' must be a non-empty array." } });
    }
    if (signals.length > 100) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Batch size must not exceed 100 signals.' } });
    }

    const hydrated = signals.map(s => ({
      ...s,
      producedAt: new Date(s.producedAt),
    }));

    const { succeeded, failed } = await signalIngestion.ingestBatch(hydrated);

    return res.status(207).json({
      data: {
        succeeded: succeeded.length,
        failed:    failed.length,
        results:   succeeded,
        errors:    failed.map(f => ({
          idempotencyKey: f.signal.idempotencyKey,
          error: { code: (f.error as Error & { code?: string }).code ?? 'UNKNOWN', message: f.error.message },
        })),
      },
    });
  });

  // GET /api/cf/signals/entity/:entityId — list recent signals for an entity
  router.get('/entity/:entityId', async (req: Request, res: Response) => {
    const { contextStore } = await getContainer();

    const limit = Math.min(parseInt(req.query['limit'] as string ?? '50', 10), 200);
    const since = req.query['since'] ? new Date(req.query['since'] as string) : undefined;
    const topic = req.query['topic'] as string | undefined;

    const result = await contextStore.getSignals(req.params.entityId, { limit, since, topic });

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
  if (error instanceof DuplicateSignalError)  return 409;
  if (error instanceof RateLimitError)        return 429;
  if (error instanceof SignalValidationError) return 422;
  if (error instanceof ContractNotFoundError) return 403;
  if (error instanceof ContractViolationError)return 403;
  return 500;
}
