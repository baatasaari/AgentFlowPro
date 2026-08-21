-- Context Fabric Platform — Phase 1 Foundation Schema Migration
-- Run via: psql $DATABASE_URL -f packages/context-fabric/migrations/001_phase1_foundation.sql
-- Or via Drizzle: drizzle-kit push (after wiring all CF schemas into drizzle.config.ts)
--
-- All Context Fabric tables use the cf_ prefix to avoid collisions with
-- existing application tables.

-- ── Enums ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE cf_signal_layer AS ENUM ('SIGNAL','PATTERN','INFERENCE','DECISION','NARRATIVE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE cf_context_scope AS ENUM ('ENTERPRISE','DOMAIN','SESSION','TASK','TURN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE cf_propagation_class AS ENUM ('IMMEDIATE','STANDARD','SLOW','SILENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE cf_decay_class AS ENUM ('IMMEDIATE_DECAY','STANDARD_DECAY','SLOW_DECAY','ETERNAL','EVENT_TRIGGERED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE cf_pii_level AS ENUM ('NONE','MASKED','FULL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE cf_signal_domain AS ENUM ('RETAIL','FRAUD','RISK','MORTGAGE','OPERATIONS','COLLECTIONS','COMMERCIAL','SHARED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE cf_identifier_type AS ENUM ('DOB','PHONE','EMAIL','FULL_NAME','POSTCODE','SORT_CODE_ACCOUNT','NATIONAL_INSURANCE','PASSPORT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── M18: Contract Registry ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cf_agent_contracts (
  contract_id               TEXT PRIMARY KEY,
  agent_id                  TEXT NOT NULL,
  agent_name                TEXT NOT NULL,
  domain                    cf_signal_domain NOT NULL,
  version                   TEXT NOT NULL,
  max_signal_rate_per_minute INTEGER NOT NULL DEFAULT 100,
  pii_handling_level        cf_pii_level NOT NULL DEFAULT 'MASKED',
  is_active                 BOOLEAN NOT NULL DEFAULT TRUE,
  allowed_scopes_json       TEXT NOT NULL DEFAULT '["ENTERPRISE","DOMAIN","SESSION","TASK","TURN"]',
  allowed_layers_json       TEXT NOT NULL DEFAULT '["SIGNAL","PATTERN","INFERENCE","DECISION","NARRATIVE"]',
  registered_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cf_contracts_agent_version ON cf_agent_contracts (agent_id, version);
CREATE INDEX IF NOT EXISTS idx_cf_contracts_agent_active  ON cf_agent_contracts (agent_id, is_active);

CREATE TABLE IF NOT EXISTS cf_contract_topics (
  contract_id TEXT NOT NULL REFERENCES cf_agent_contracts(contract_id) ON DELETE CASCADE,
  direction   TEXT NOT NULL,  -- 'PUBLISH' | 'SUBSCRIBE'
  topic       TEXT NOT NULL,
  PRIMARY KEY (contract_id, direction, topic)
);
CREATE INDEX IF NOT EXISTS idx_cf_contract_topics_contract ON cf_contract_topics (contract_id);

-- ── M01: Signal Ingestion ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cf_signals (
  signal_id         TEXT PRIMARY KEY,
  idempotency_key   TEXT NOT NULL,
  source_agent_id   TEXT NOT NULL,
  source_domain     TEXT NOT NULL,
  entity_id         TEXT NOT NULL,
  layer             TEXT NOT NULL,
  propagation_class cf_propagation_class NOT NULL,
  decay_class       cf_decay_class NOT NULL,
  scope             TEXT NOT NULL,
  topic             TEXT NOT NULL,
  payload_json      TEXT NOT NULL,
  confidence        REAL NOT NULL,
  schema_version    TEXT NOT NULL,
  contract_id       TEXT NOT NULL,
  correlation_id    TEXT,
  session_id        TEXT,
  task_id           TEXT,
  produced_at       TIMESTAMPTZ NOT NULL,
  ingested_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at        TIMESTAMPTZ,
  is_redacted       BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_cf_signals_entity       ON cf_signals (entity_id);
CREATE INDEX IF NOT EXISTS idx_cf_signals_agent        ON cf_signals (source_agent_id);
CREATE INDEX IF NOT EXISTS idx_cf_signals_topic        ON cf_signals (topic);
CREATE INDEX IF NOT EXISTS idx_cf_signals_domain_topic ON cf_signals (source_domain, topic);
CREATE INDEX IF NOT EXISTS idx_cf_signals_ingested_at  ON cf_signals (ingested_at);
CREATE INDEX IF NOT EXISTS idx_cf_signals_expires_at   ON cf_signals (expires_at);
CREATE INDEX IF NOT EXISTS idx_cf_signals_correlation  ON cf_signals (correlation_id);
CREATE INDEX IF NOT EXISTS idx_cf_signals_session      ON cf_signals (session_id);

CREATE TABLE IF NOT EXISTS cf_signal_idempotency (
  idempotency_key TEXT PRIMARY KEY,
  signal_id       TEXT NOT NULL,
  agent_id        TEXT NOT NULL,
  ingested_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cf_idempotency_agent    ON cf_signal_idempotency (agent_id);
CREATE INDEX IF NOT EXISTS idx_cf_idempotency_ingested ON cf_signal_idempotency (ingested_at);

-- ── M02: Entity Resolution ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cf_entities (
  entity_id           TEXT PRIMARY KEY,
  aliases_json        TEXT NOT NULL DEFAULT '[]',
  domain_presence_json TEXT NOT NULL DEFAULT '[]',
  is_merged           BOOLEAN NOT NULL DEFAULT FALSE,
  merged_into_id      TEXT,
  merged_at           TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cf_entities_merged_into ON cf_entities (merged_into_id);

CREATE TABLE IF NOT EXISTS cf_entity_identifiers (
  identifier_id TEXT PRIMARY KEY,
  entity_id     TEXT NOT NULL REFERENCES cf_entities(entity_id) ON DELETE CASCADE,
  type          cf_identifier_type NOT NULL,
  value_hash    TEXT NOT NULL,
  confidence    REAL NOT NULL,
  domain        TEXT NOT NULL,
  added_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cf_identifiers_entity ON cf_entity_identifiers (entity_id);
CREATE INDEX IF NOT EXISTS idx_cf_identifiers_hash   ON cf_entity_identifiers (type, value_hash);

CREATE TABLE IF NOT EXISTS cf_entity_merges (
  merge_id      TEXT PRIMARY KEY,
  survivor_id   TEXT NOT NULL,
  absorbed_id   TEXT NOT NULL,
  score         REAL NOT NULL,
  merged_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  triggered_by  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cf_merges_survivor ON cf_entity_merges (survivor_id);
CREATE INDEX IF NOT EXISTS idx_cf_merges_absorbed ON cf_entity_merges (absorbed_id);

-- ── M03: Context Store ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cf_inferences (
  inference_id   TEXT PRIMARY KEY,
  entity_id      TEXT NOT NULL,
  inference_type TEXT NOT NULL,
  summary        TEXT NOT NULL,
  confidence     REAL NOT NULL,
  evidence_json  TEXT NOT NULL,
  domain         TEXT NOT NULL,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  is_redacted    BOOLEAN NOT NULL DEFAULT FALSE,
  derived_at     TIMESTAMPTZ NOT NULL,
  expires_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cf_inferences_entity  ON cf_inferences (entity_id);
CREATE INDEX IF NOT EXISTS idx_cf_inferences_domain  ON cf_inferences (domain, inference_type);
CREATE INDEX IF NOT EXISTS idx_cf_inferences_active  ON cf_inferences (entity_id, is_active);
CREATE INDEX IF NOT EXISTS idx_cf_inferences_expires ON cf_inferences (expires_at);

CREATE TABLE IF NOT EXISTS cf_decisions (
  decision_id    TEXT PRIMARY KEY,
  entity_id      TEXT,
  source_agent_id TEXT NOT NULL,
  domain         TEXT NOT NULL,
  decision_type  TEXT NOT NULL,
  outcome        TEXT NOT NULL,
  rationale      TEXT NOT NULL,
  evidence_json  TEXT NOT NULL,
  contract_id    TEXT NOT NULL,
  correlation_id TEXT,
  session_id     TEXT,
  is_redacted    BOOLEAN NOT NULL DEFAULT FALSE,
  decided_at     TIMESTAMPTZ NOT NULL,
  expires_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cf_decisions_entity  ON cf_decisions (entity_id);
CREATE INDEX IF NOT EXISTS idx_cf_decisions_agent   ON cf_decisions (source_agent_id);
CREATE INDEX IF NOT EXISTS idx_cf_decisions_domain  ON cf_decisions (domain);
CREATE INDEX IF NOT EXISTS idx_cf_decisions_session ON cf_decisions (session_id);

CREATE TABLE IF NOT EXISTS cf_context_snapshots (
  snapshot_id      TEXT PRIMARY KEY,
  entity_id        TEXT NOT NULL,
  workflow_id      TEXT NOT NULL,
  orchestrator_id  TEXT NOT NULL,
  context_json     TEXT NOT NULL,
  snapshot_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_cf_snapshots_entity   ON cf_context_snapshots (entity_id);
CREATE INDEX IF NOT EXISTS idx_cf_snapshots_workflow ON cf_context_snapshots (workflow_id);
