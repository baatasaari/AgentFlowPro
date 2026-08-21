/**
 * Context Fabric Platform — Core Domain Types
 *
 * These types form the shared language across all Phase 1 modules.
 * Every module imports from here; nothing imports from a sibling module's types.
 */

// ── ENUMERATIONS ─────────────────────────────────────────────────────────────

/** The five layers of context, ascending in abstraction. */
export enum SignalLayer {
  /** Raw events: balance change, call transcript, navigation event */
  SIGNAL    = 'SIGNAL',
  /** Behavioural patterns derived from multiple signals */
  PATTERN   = 'PATTERN',
  /** Reasoned inferences: "customer is likely in financial difficulty" */
  INFERENCE = 'INFERENCE',
  /** Actions taken: hardship arrangement agreed, account flagged */
  DECISION  = 'DECISION',
  /** Cross-domain narratives: full customer story synthesised across domains */
  NARRATIVE = 'NARRATIVE',
}

/**
 * Controls how urgently a signal is pushed to subscribers.
 * IMMEDIATE  → push within 200 ms (e.g. fraud alert, vulnerability flag)
 * STANDARD   → batch at turn boundary for conversational agents
 * SLOW       → nightly compressor run
 * SILENT     → write to store only, no pub/sub propagation
 */
export enum PropagationClass {
  IMMEDIATE = 'IMMEDIATE',
  STANDARD  = 'STANDARD',
  SLOW      = 'SLOW',
  SILENT    = 'SILENT',
}

/** Context visibility scope. Agents only receive signals at or above their scope. */
export enum ContextScope {
  ENTERPRISE = 'ENTERPRISE',
  DOMAIN     = 'DOMAIN',
  SESSION    = 'SESSION',
  TASK       = 'TASK',
  TURN       = 'TURN',
}

/**
 * Controls how quickly a signal's relevance decays.
 * IMMEDIATE_DECAY → half-life 24 h
 * STANDARD_DECAY  → half-life 72 h
 * SLOW_DECAY      → half-life 30 days
 * ETERNAL         → never expires (regulatory decisions, KYC)
 * EVENT_TRIGGERED → expires when a named domain event fires
 */
export enum DecayClass {
  IMMEDIATE_DECAY  = 'IMMEDIATE_DECAY',
  STANDARD_DECAY   = 'STANDARD_DECAY',
  SLOW_DECAY       = 'SLOW_DECAY',
  ETERNAL          = 'ETERNAL',
  EVENT_TRIGGERED  = 'EVENT_TRIGGERED',
}

/** Recognised banking domains within the enterprise. */
export type SignalDomain =
  | 'RETAIL'
  | 'FRAUD'
  | 'RISK'
  | 'MORTGAGE'
  | 'OPERATIONS'
  | 'COLLECTIONS'
  | 'COMMERCIAL'
  | 'SHARED';

/** PII sensitivity levels that govern masking and access control. */
export type PiiHandlingLevel = 'NONE' | 'MASKED' | 'FULL';

// ── SIGNAL ───────────────────────────────────────────────────────────────────

/**
 * The canonical unit of context. Signals are immutable once written.
 * Producers create signals; the fabric routes, stores, and decays them.
 */
export interface Signal {
  /** UUIDv7 — monotonically sortable, globally unique */
  signalId: string;

  /**
   * Producer-controlled deduplication key.
   * Duplicate submissions within the dedup window (default 5 min) are rejected.
   * Format: "<agentId>:<topic>:<natural-key>" e.g. "fraud-agent:alert.raised:TXN-001"
   */
  idempotencyKey: string;

  /** Registered agent ID from the Contract Registry (M18). */
  sourceAgentId: string;

  /** The domain the producing agent belongs to. */
  sourceDomain: SignalDomain;

  /** Canonical entity UUID assigned by the Entity Resolution Engine (M02). */
  entityId: string;

  layer: SignalLayer;
  propagationClass: PropagationClass;
  decayClass: DecayClass;
  scope: ContextScope;

  /**
   * Hierarchical topic, dot-separated.
   * Must match a topic in the agent's allowedTopicsPublish contract.
   * Examples: "customer.vulnerability.detected", "fraud.alert.raised", "risk.score.updated"
   */
  topic: string;

  /** Free-form structured payload. Schema validated against contractId version. */
  payload: Record<string, unknown>;

  /** Confidence score for inferred signals: 0.0 (uncertain) → 1.0 (certain). */
  confidence: number;

  /** Payload schema version in semver format: "1.0.0" */
  schemaVersion: string;

  /** References the producing contract version in M18. */
  contractId: string;

  /** Optional: link this signal to a parent flow or workflow run. */
  correlationId?: string;

  /** Optional: constrain visibility to a specific session. */
  sessionId?: string;

  /** Optional: constrain visibility to a specific task. */
  taskId?: string;

  /** Wall-clock time the signal was produced (set by producer). */
  producedAt: Date;

  /** Wall-clock time after which this signal should not be used. */
  expiresAt?: Date;
}

// ── ENTITY ───────────────────────────────────────────────────────────────────

/** Identifier types used to match and merge entities. */
export type IdentifierType =
  | 'DOB'
  | 'PHONE'
  | 'EMAIL'
  | 'FULL_NAME'
  | 'POSTCODE'
  | 'SORT_CODE_ACCOUNT'
  | 'NATIONAL_INSURANCE'
  | 'PASSPORT';

/**
 * Scoring weights used by the Entity Resolution Engine (M02).
 * Weights sum to 1.0; a combined score ≥ ENTITY_RESOLUTION_THRESHOLD triggers a merge.
 */
export const IDENTIFIER_WEIGHTS: Record<IdentifierType, number> = {
  DOB:                 0.45,
  PHONE:               0.30,
  EMAIL:               0.25,
  FULL_NAME:           0.15,
  POSTCODE:            0.10,
  SORT_CODE_ACCOUNT:   0.50,  // strong deterministic match
  NATIONAL_INSURANCE:  0.60,  // near-certain
  PASSPORT:            0.60,  // near-certain
};

export interface EntityIdentifier {
  type: IdentifierType;
  /** SHA-256 HMAC hash of the value; raw PII never stored in the entity record. */
  valueHash: string;
  confidence: number;
  domain: SignalDomain;
  addedAt: Date;
}

/** A resolved, canonical entity in the enterprise entity graph. */
export interface Entity {
  /** Canonical UUID — the authoritative identifier across all domains. */
  entityId: string;

  /** Previous entity IDs that were merged into this one. */
  aliases: string[];

  identifiers: EntityIdentifier[];

  /** Domains in which this entity has been observed. */
  domainPresence: SignalDomain[];

  createdAt: Date;
  updatedAt: Date;

  /** Populated when two entity records were merged. */
  mergedAt?: Date;
  mergedFromId?: string;
}

// ── AGENT CONTRACT ────────────────────────────────────────────────────────────

/**
 * An agent contract registered in M18.
 * Defines what an agent is allowed to publish and subscribe to.
 * The Contract Registry is the source of trust for all module interactions.
 */
export interface AgentContract {
  /** Globally unique contract ID. Format: "<agentId>@<version>" */
  contractId: string;

  /** Stable agent identifier. Matches sourceAgentId on signals. */
  agentId: string;

  agentName: string;
  domain: SignalDomain;

  /** Semver contract version. Signals reference the version in use at emission time. */
  version: string;

  /** Topics this agent may emit signals on. Supports wildcards: "fraud.*" */
  allowedTopicsPublish: string[];

  /** Topics this agent may receive signals for. */
  allowedTopicsSubscribe: string[];

  allowedScopes: ContextScope[];
  allowedLayers: SignalLayer[];

  /** Maximum signals per minute this agent may ingest. Enforced by M01. */
  maxSignalRatePerMinute: number;

  piiHandlingLevel: PiiHandlingLevel;

  isActive: boolean;
  registeredAt: Date;
  updatedAt: Date;
}

// ── RESULT TYPE ───────────────────────────────────────────────────────────────

/**
 * Discriminated union for operation results.
 * Prefer this over throwing for expected failure paths.
 */
export type Result<T, E extends Error = Error> =
  | { ok: true;  value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E extends Error>(error: E): Result<never, E> {
  return { ok: false, error };
}

// ── PAGINATION ────────────────────────────────────────────────────────────────

export interface Page<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
}

export interface PageRequest {
  offset?: number;
  limit?: number;
}
