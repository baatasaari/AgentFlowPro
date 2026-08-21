/**
 * M01 Signal Ingestion — SignalValidator
 *
 * Validates a raw inbound signal before it is persisted or routed.
 * Validation is pure (no I/O) — it can be called synchronously.
 *
 * Checks performed:
 *   1. Required fields present
 *   2. Enum values valid
 *   3. Confidence in range [0, 1]
 *   4. schemaVersion is valid semver
 *   5. topic is non-empty and dot-separated
 *   6. producedAt is not in the future (with 30 s tolerance for clock skew)
 *   7. Payload is a plain object (not null/array/string)
 */

import { SignalValidationError } from '../core/errors.js';
import {
  SignalLayer,
  PropagationClass,
  DecayClass,
  ContextScope,
} from '../core/types.js';
import type { Signal } from '../core/types.js';

const VALID_LAYERS       = new Set(Object.values(SignalLayer));
const VALID_PROPAGATIONS = new Set(Object.values(PropagationClass));
const VALID_DECAYS       = new Set(Object.values(DecayClass));
const VALID_SCOPES       = new Set(Object.values(ContextScope));
const SEMVER_RE          = /^\d+\.\d+\.\d+$/;
const TOPIC_RE           = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9*#]*)*$/;
const UUID_RE            = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLOCK_SKEW_MS      = 30_000; // 30 seconds

export type ValidationResult =
  | { valid: true }
  | { valid: false; errors: SignalValidationError[] };

export class SignalValidator {
  validate(signal: Partial<Signal>): ValidationResult {
    const errors: SignalValidationError[] = [];

    // ── Required string fields ──────────────────────────────────────────────
    for (const field of [
      'signalId', 'idempotencyKey', 'sourceAgentId', 'sourceDomain',
      'entityId', 'contractId', 'topic', 'schemaVersion',
    ] as const) {
      if (!signal[field] || typeof signal[field] !== 'string') {
        errors.push(new SignalValidationError(`Field '${field}' is required and must be a non-empty string.`, field));
      }
    }

    // ── UUIDs ───────────────────────────────────────────────────────────────
    if (signal.signalId && !UUID_RE.test(signal.signalId)) {
      errors.push(new SignalValidationError(`'signalId' must be a valid UUID v4/v7 (got '${signal.signalId}').`, 'signalId'));
    }
    if (signal.entityId && !UUID_RE.test(signal.entityId)) {
      errors.push(new SignalValidationError(`'entityId' must be a valid UUID (got '${signal.entityId}').`, 'entityId'));
    }

    // ── Enum fields ─────────────────────────────────────────────────────────
    if (signal.layer !== undefined && !VALID_LAYERS.has(signal.layer)) {
      errors.push(new SignalValidationError(
        `'layer' must be one of [${[...VALID_LAYERS].join(', ')}], got '${signal.layer}'.`, 'layer',
      ));
    }
    if (signal.propagationClass !== undefined && !VALID_PROPAGATIONS.has(signal.propagationClass)) {
      errors.push(new SignalValidationError(
        `'propagationClass' must be one of [${[...VALID_PROPAGATIONS].join(', ')}].`, 'propagationClass',
      ));
    }
    if (signal.decayClass !== undefined && !VALID_DECAYS.has(signal.decayClass)) {
      errors.push(new SignalValidationError(
        `'decayClass' must be one of [${[...VALID_DECAYS].join(', ')}].`, 'decayClass',
      ));
    }
    if (signal.scope !== undefined && !VALID_SCOPES.has(signal.scope)) {
      errors.push(new SignalValidationError(
        `'scope' must be one of [${[...VALID_SCOPES].join(', ')}].`, 'scope',
      ));
    }

    // ── Confidence ──────────────────────────────────────────────────────────
    if (signal.confidence !== undefined) {
      if (typeof signal.confidence !== 'number' || signal.confidence < 0 || signal.confidence > 1) {
        errors.push(new SignalValidationError(`'confidence' must be a number between 0.0 and 1.0.`, 'confidence'));
      }
    }

    // ── Schema version ──────────────────────────────────────────────────────
    if (signal.schemaVersion && !SEMVER_RE.test(signal.schemaVersion)) {
      errors.push(new SignalValidationError(
        `'schemaVersion' must be valid semver (e.g. "1.0.0"), got '${signal.schemaVersion}'.`, 'schemaVersion',
      ));
    }

    // ── Topic ───────────────────────────────────────────────────────────────
    if (signal.topic && !TOPIC_RE.test(signal.topic)) {
      errors.push(new SignalValidationError(
        `'topic' must be dot-separated lowercase alphanumeric segments (e.g. "fraud.alert.raised"), got '${signal.topic}'.`,
        'topic',
      ));
    }

    // ── Timestamp ───────────────────────────────────────────────────────────
    if (signal.producedAt !== undefined) {
      if (!(signal.producedAt instanceof Date) && typeof signal.producedAt !== 'string') {
        errors.push(new SignalValidationError(`'producedAt' must be a Date or ISO 8601 string.`, 'producedAt'));
      } else {
        const ts = new Date(signal.producedAt as Date | string).getTime();
        if (Number.isNaN(ts)) {
          errors.push(new SignalValidationError(`'producedAt' is not a valid date.`, 'producedAt'));
        } else if (ts > Date.now() + CLOCK_SKEW_MS) {
          errors.push(new SignalValidationError(
            `'producedAt' is more than ${CLOCK_SKEW_MS / 1000}s in the future — check producer clock.`, 'producedAt',
          ));
        }
      }
    } else {
      errors.push(new SignalValidationError(`'producedAt' is required.`, 'producedAt'));
    }

    // ── Payload ─────────────────────────────────────────────────────────────
    if (signal.payload !== undefined) {
      if (
        typeof signal.payload !== 'object' ||
        signal.payload === null ||
        Array.isArray(signal.payload)
      ) {
        errors.push(new SignalValidationError(`'payload' must be a plain JSON object.`, 'payload'));
      }
    } else {
      errors.push(new SignalValidationError(`'payload' is required (may be an empty object {}).`, 'payload'));
    }

    return errors.length === 0 ? { valid: true } : { valid: false, errors };
  }

  /**
   * Throws the first validation error if the signal is invalid.
   * Convenience wrapper for callers that prefer exceptions over the
   * ValidationResult discriminated union.
   */
  assertValid(signal: Partial<Signal>): void {
    const result = this.validate(signal);
    if (!result.valid) throw result.errors[0];
  }
}
