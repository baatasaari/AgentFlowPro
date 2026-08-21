/**
 * M18 Contract Registry — Express Router
 * Base path: /api/cf/contracts
 */

import { Router, type Request, type Response } from 'express';
import { getContainer } from './container.js';
import {
  ContractNotFoundError,
  ContractAlreadyExistsError,
  ContractViolationError,
  ModuleDisabledError,
  ValidationError,
} from '../core/errors.js';

export function contractsRouter(): Router {
  const router = Router();

  // POST /api/cf/contracts — register a new agent contract
  router.post('/', async (req: Request, res: Response) => {
    const { contractRegistry } = await getContainer();
    const result = await contractRegistry.register(req.body);

    if (!result.ok) {
      return res.status(mapErrorStatus(result.error)).json({
        error: { code: result.error.code, message: result.error.message },
      });
    }

    return res.status(201).json({ data: result.value });
  });

  // GET /api/cf/contracts/:agentId — get the active contract for an agent
  router.get('/:agentId', async (req: Request, res: Response) => {
    const { contractRegistry } = await getContainer();
    const result = await contractRegistry.findByAgentId(req.params.agentId);

    if (!result.ok) {
      return res.status(mapErrorStatus(result.error)).json({
        error: { code: result.error.code, message: result.error.message },
      });
    }

    return res.json({ data: result.value });
  });

  // DELETE /api/cf/contracts/:contractId — deactivate a contract version
  router.delete('/:contractId', async (req: Request, res: Response) => {
    const { contractRegistry } = await getContainer();
    const result = await contractRegistry.deactivate(req.params.contractId);

    if (!result.ok) {
      return res.status(mapErrorStatus(result.error)).json({
        error: { code: result.error.code, message: result.error.message },
      });
    }

    return res.status(204).send();
  });

  // POST /api/cf/contracts/:agentId/validate — check a topic is permitted
  router.post('/:agentId/validate', async (req: Request, res: Response) => {
    const { contractRegistry } = await getContainer();
    const { topic } = req.body as { topic?: string };

    if (!topic) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: "'topic' is required in request body." } });
    }

    const result = await contractRegistry.validatePublish(req.params.agentId, topic);

    if (!result.ok) {
      return res.status(mapErrorStatus(result.error)).json({
        error: { code: result.error.code, message: result.error.message },
      });
    }

    return res.json({ data: { permitted: true, contractId: result.value.contractId } });
  });

  return router;
}

function mapErrorStatus(error: Error): number {
  if (error instanceof ModuleDisabledError)      return 503;
  if (error instanceof ContractNotFoundError)    return 404;
  if (error instanceof ContractAlreadyExistsError) return 409;
  if (error instanceof ContractViolationError)   return 403;
  if (error instanceof ValidationError)          return 400;
  return 500;
}
