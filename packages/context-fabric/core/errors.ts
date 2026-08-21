/**
 * Context Fabric Platform — Domain Errors
 *
 * All errors carry a machine-readable `code` so API consumers can branch
 * on error type without parsing messages. HTTP status mapping lives in
 * the API layer, not here.
 */

export class ContextFabricError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ContextFabricError';
    // Restore prototype chain (required when extending built-ins in TS)
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ── Module availability ───────────────────────────────────────────────────────

export class ModuleDisabledError extends ContextFabricError {
  constructor(moduleCode: string) {
    super(
      `Module ${moduleCode} is disabled. Set MODULE_${moduleCode}_ENABLED=true to enable it.`,
      'MODULE_DISABLED',
      { moduleCode },
    );
  }
}

// ── Contract Registry (M18) ───────────────────────────────────────────────────

export class ContractNotFoundError extends ContextFabricError {
  constructor(agentId: string) {
    super(
      `No active contract found for agent '${agentId}'. ` +
        'Register the agent via the M18 Contract Registry before emitting signals.',
      'CONTRACT_NOT_FOUND',
      { agentId },
    );
  }
}

export class ContractAlreadyExistsError extends ContextFabricError {
  constructor(agentId: string, version: string) {
    super(
      `A contract for agent '${agentId}' at version '${version}' already exists. ` +
        'Increment the version to register a new revision.',
      'CONTRACT_ALREADY_EXISTS',
      { agentId, version },
    );
  }
}

export class ContractViolationError extends ContextFabricError {
  constructor(agentId: string, topic: string, reason: string) {
    super(
      `Contract violation for agent '${agentId}' on topic '${topic}': ${reason}`,
      'CONTRACT_VIOLATION',
      { agentId, topic, reason },
    );
  }
}

// ── Signal Ingestion (M01) ────────────────────────────────────────────────────

export class DuplicateSignalError extends ContextFabricError {
  constructor(idempotencyKey: string) {
    super(
      `Signal with idempotency key '${idempotencyKey}' was already processed ` +
        'within the deduplication window.',
      'DUPLICATE_SIGNAL',
      { idempotencyKey },
    );
  }
}

export class RateLimitError extends ContextFabricError {
  constructor(agentId: string, rateLimit: number) {
    super(
      `Agent '${agentId}' has exceeded its contract rate limit of ${rateLimit} signals/minute.`,
      'RATE_LIMIT_EXCEEDED',
      { agentId, rateLimit },
    );
  }
}

export class SignalValidationError extends ContextFabricError {
  constructor(message: string, public readonly field?: string) {
    super(message, 'SIGNAL_VALIDATION_ERROR', { field });
  }
}

// ── Entity Resolution (M02) ───────────────────────────────────────────────────

export class EntityResolutionError extends ContextFabricError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'ENTITY_RESOLUTION_ERROR', details);
  }
}

export class EntityNotFoundError extends ContextFabricError {
  constructor(entityId: string) {
    super(
      `Entity '${entityId}' not found.`,
      'ENTITY_NOT_FOUND',
      { entityId },
    );
  }
}

// ── Context Store (M03) ───────────────────────────────────────────────────────

export class SignalNotFoundError extends ContextFabricError {
  constructor(signalId: string) {
    super(`Signal '${signalId}' not found.`, 'SIGNAL_NOT_FOUND', { signalId });
  }
}

// ── Generic ───────────────────────────────────────────────────────────────────

export class ValidationError extends ContextFabricError {
  constructor(message: string, field?: string) {
    super(message, 'VALIDATION_ERROR', { field });
  }
}

export class InternalError extends ContextFabricError {
  constructor(message: string, cause?: Error) {
    super(message, 'INTERNAL_ERROR', { cause: cause?.message });
  }
}
