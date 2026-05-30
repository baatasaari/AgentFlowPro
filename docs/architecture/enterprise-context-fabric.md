# Enterprise Context Fabric: Implementation Architecture

> **For LBG AI Platform Teams**  
> This document defines every component of the Context Fabric to implementation depth.  
> A team reading this should be able to start building on Monday morning.

---

## The Problem, Precisely Stated

Every domain agent — Retail, Fraud, Risk, Mortgage, Collections, Operations — has built
its own understanding of the customer. These agents do good work. The problem is not that
any one of them is wrong. The problem is that none of them knows what the others know.

When a customer calls Retail about an overdraft and Fraud flagged that same customer's
account 18 hours ago, Retail handles it as a routine query. The signal existed. It just
never became context.

**Data sharing** means making data accessible. **Context Engineering** means making meaning
transferable — getting the right signal to the right agent in the right form at the right
moment so it changes what the agent does.

This document defines the system that does that.

---

## Architecture: Four Planes

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ PLANE 1: AGENT REASONING                                                            │
│                                                                                     │
│  Retail Agent    Fraud Agent    Risk Agent    Mortgage Agent    Operations Agent    │
│       │               │              │               │                 │            │
│  [Context Sidecar] [Context Sidecar] [Context Sidecar] ...                         │
└───────────────────────────────────┬─────────────────────────────────────────────────┘
                                    │ gRPC (localhost)
┌───────────────────────────────────▼─────────────────────────────────────────────────┐
│ PLANE 2: CONTEXT MEDIATION                                                          │
│                                                                                     │
│   Context Assembler      Synthesis Engine      Conflict Arbiter                     │
│   (assembles context     (signals → inferences  (resolves competing                 │
│   windows on demand      → narratives, async    claims, applies                     │
│   and predictively)      continuous loop)       authority model)                    │
└───────────────────────────────────┬─────────────────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼─────────────────────────────────────────────────┐
│ PLANE 3: CONTEXT FABRIC                                                             │
│                                                                                     │
│   Entity Identity Graph       Signal Bus            Contract Registry               │
│   (canonical entity IDs,      (propagation,         (schema ownership,              │
│   cross-domain resolution,    routing by contract,  produces/consumes,              │
│   relationship traversal)     ordered, durable)     enforcement)                    │
└───────────────────────────────────┬─────────────────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼─────────────────────────────────────────────────┐
│ PLANE 4: CONTEXT STORE                                                              │
│                                                                                     │
│   Signal Store        Inference Store      Decision Store       Context Snapshots   │
│   (append-only,       (versioned,          (immutable,          (point-in-time,     │
│   temporal decay)     confidence-scored)   audit-complete)      regulatory)         │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

Each plane has a single job. The planes communicate only through defined interfaces.
No agent talks directly to any store. No store holds business logic.

---

## Component 1: Entity Identity Graph

### What It Does

Resolves that `ACC-12345678` (Retail), `CRM-9823-B` (CRM), `RISK-44412` (Fraud), and
`MORT-2024-003` (Mortgage) are all the same person — and maintains that mapping as the
canonical foundation every other component depends on.

Without this, context sharing is impossible. You cannot share context about "the customer"
if each domain means a different thing by that word.

### Data Model

```sql
-- Canonical entity table
CREATE TABLE entities (
  entity_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type      VARCHAR(32) NOT NULL,  -- CUSTOMER | EMPLOYEE | BUSINESS | ACCOUNT | CASE
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolution_conf  DECIMAL(4,3) NOT NULL, -- 0.000 to 1.000
  is_active        BOOLEAN NOT NULL DEFAULT TRUE
);

-- Domain ID mappings — every local ID maps to one canonical entity
CREATE TABLE entity_domain_ids (
  domain_id_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id        UUID NOT NULL REFERENCES entities(entity_id),
  domain           VARCHAR(64) NOT NULL,  -- 'retail_banking', 'crm', 'fraud', etc.
  local_id         VARCHAR(256) NOT NULL,
  match_confidence DECIMAL(4,3) NOT NULL,
  verified_at      TIMESTAMPTZ,           -- NULL = probabilistic, NOT NULL = confirmed
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(domain, local_id)
);
CREATE INDEX idx_entity_domain ON entity_domain_ids(entity_id);

-- Relationship edges — this is the graph
CREATE TABLE entity_relationships (
  rel_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_entity_id UUID NOT NULL REFERENCES entities(entity_id),
  target_entity_id UUID NOT NULL REFERENCES entities(entity_id),
  rel_type         VARCHAR(64) NOT NULL,  -- JOINT_ACCOUNT_HOLDER | DIRECTOR | AUTH_SIGNATORY | SAME_ADDRESS
  strength         DECIMAL(4,3) NOT NULL DEFAULT 1.000,
  valid_from       DATE NOT NULL,
  valid_until      DATE,                  -- NULL = still active
  source_domain    VARCHAR(64) NOT NULL,  -- who asserted this relationship
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_rel_source ON entity_relationships(source_entity_id, rel_type);
CREATE INDEX idx_rel_target ON entity_relationships(target_entity_id, rel_type);

-- Stable attributes used for resolution (minimised PII — hashed or coarsened)
CREATE TABLE entity_stable_attributes (
  entity_id        UUID NOT NULL REFERENCES entities(entity_id),
  attr_name        VARCHAR(64) NOT NULL,
  attr_value       VARCHAR(512) NOT NULL,  -- hashed or coarsened value
  attr_type        VARCHAR(32) NOT NULL,   -- DOB_HASH | POSTCODE | NAME_TOKEN | PHONE_HASH
  PRIMARY KEY (entity_id, attr_name)
);
```

### Resolution Algorithm

```python
class EntityResolver:
    
    MATCH_THRESHOLD = 0.80   # minimum score to link to existing entity
    CREATE_THRESHOLD = 0.60  # below this: new entity. Between: review queue.

    def resolve(self, domain: str, local_id: str, attributes: dict) -> ResolveResult:
        """
        Called every time a domain agent presents a local ID.
        Returns the canonical entity_id (creating one if needed).
        """

        # Step 1: Fast path — exact match in domain_ids table
        existing = self.db.query(
            "SELECT entity_id FROM entity_domain_ids WHERE domain=$1 AND local_id=$2",
            domain, local_id
        )
        if existing:
            return ResolveResult(entity_id=existing.entity_id, is_new=False, confidence=1.0)

        # Step 2: Extract stable attributes for fuzzy matching
        candidate_attrs = self._normalise_attributes(attributes)
        # e.g., DOB → sha256(YYYYMMDD), name → metaphone+soundex tokens,
        #       postcode → first half only, phone → sha256(E164_normalised)

        # Step 3: Candidate search — find entities with overlapping attributes
        candidates = self.db.query("""
            SELECT e.entity_id, array_agg(sa.attr_value) as matched_attrs
            FROM entities e
            JOIN entity_stable_attributes sa ON e.entity_id = sa.entity_id
            WHERE sa.attr_name = ANY($1) AND sa.attr_value = ANY($2)
            GROUP BY e.entity_id
            HAVING count(*) >= 2
        """, list(candidate_attrs.keys()), list(candidate_attrs.values()))

        # Step 4: Score candidates
        best_match = None
        best_score = 0.0
        for candidate in candidates:
            score = self._score_match(candidate_attrs, candidate.matched_attrs)
            if score > best_score:
                best_score = score
                best_match = candidate

        # Step 5: Resolution decision
        if best_score >= self.MATCH_THRESHOLD:
            # Link this domain ID to the existing canonical entity
            self.db.insert("entity_domain_ids",
                entity_id=best_match.entity_id, domain=domain,
                local_id=local_id, match_confidence=best_score
            )
            self.signal_bus.publish("entity.domain_id_linked", {
                "entity_id": best_match.entity_id, "domain": domain, "local_id": local_id
            })
            return ResolveResult(entity_id=best_match.entity_id, is_new=False, confidence=best_score)

        elif best_score >= self.CREATE_THRESHOLD:
            # Ambiguous — route to human review queue, return provisional entity
            provisional_entity_id = self._create_entity(attributes, confidence=best_score)
            self._queue_for_review(provisional_entity_id, best_match.entity_id, best_score)
            return ResolveResult(entity_id=provisional_entity_id, is_new=True,
                                confidence=best_score, is_provisional=True)

        else:
            # Confident this is a new entity
            new_entity_id = self._create_entity(attributes, confidence=0.99)
            self.db.insert("entity_domain_ids",
                entity_id=new_entity_id, domain=domain,
                local_id=local_id, match_confidence=1.0
            )
            return ResolveResult(entity_id=new_entity_id, is_new=True, confidence=0.99)

    def _score_match(self, candidate_attrs: dict, matched_attrs: list) -> float:
        """
        Weighted attribute scoring:
        - DOB hash match: 0.45 weight
        - Phone hash match: 0.30 weight
        - Name token match: 0.15 weight
        - Postcode match: 0.10 weight
        Scores are additive. Perfect match = 1.0
        """
        weights = {"DOB_HASH": 0.45, "PHONE_HASH": 0.30, "NAME_TOKEN": 0.15, "POSTCODE": 0.10}
        score = 0.0
        for attr_name, attr_value in candidate_attrs.items():
            if attr_value in matched_attrs:
                score += weights.get(attr_name, 0.05)
        return min(score, 1.0)
```

### Graph Traversal

When the Assembler needs context for entity X, it traverses the graph to pull in
related entities whose context is relevant:

```python
def get_entity_cluster(entity_id: str, depth: int = 1,
                        rel_types: list = None) -> list[str]:
    """
    Returns entity_id plus all related entity IDs up to depth hops.
    rel_types=None means all relationship types.
    """
    # Use recursive CTE for graph traversal
    result = db.query("""
        WITH RECURSIVE cluster AS (
            SELECT $1::uuid AS entity_id, 0 AS depth, ARRAY[$1::uuid] AS path
            UNION ALL
            SELECT
                CASE WHEN er.source_entity_id = c.entity_id
                     THEN er.target_entity_id
                     ELSE er.source_entity_id END,
                c.depth + 1,
                c.path || CASE WHEN er.source_entity_id = c.entity_id
                               THEN er.target_entity_id
                               ELSE er.source_entity_id END
            FROM entity_relationships er
            JOIN cluster c ON (er.source_entity_id = c.entity_id
                                OR er.target_entity_id = c.entity_id)
            WHERE c.depth < $2
              AND (er.valid_until IS NULL OR er.valid_until > CURRENT_DATE)
              AND ($3::text[] IS NULL OR er.rel_type = ANY($3))
              AND NOT (CASE WHEN er.source_entity_id = c.entity_id
                            THEN er.target_entity_id
                            ELSE er.source_entity_id END = ANY(c.path))
        )
        SELECT DISTINCT entity_id FROM cluster
    """, entity_id, depth, rel_types)

    return [row.entity_id for row in result]
```

**Why relationships matter**: If Fraud flags entity A, and entity A is a `JOINT_ACCOUNT_HOLDER`
with entity B, then entity B's Retail Agent interaction should receive that flag — appropriately
weighted by relationship strength and inheritance rules. The graph makes this automatic.

---

## Component 2: Signal Bus

### What It Does

The Signal Bus is the propagation channel for all context signals. It differs from a
generic message broker in one critical way: routing is driven by the Contract Registry,
not by consumer subscriptions. Agents declare what they care about once (in their contract)
and the bus handles delivery — agents don't build routing logic.

### Signal Schema (the canonical contract all agents sign up to)

```typescript
interface Signal {
  // Identity
  signal_id: string;           // UUID, generated by sidecar
  schema_version: string;      // "1.2" — must match schema in Contract Registry
  signal_type: string;         // "risk.transaction_flagged", "retail.sentiment_detected"
                               // Format: {domain}.{event_name}

  // Scope
  entity_id: string;           // canonical entity ID from Identity Graph
  session_id?: string;         // if within an active conversation
  process_id?: string;         // if within a named process (e.g., "mortgage_application")

  // Producer attribution (set by sidecar, not agent)
  producer: {
    agent_type: string;        // "fraud_agent"
    agent_instance_id: string; // "fraud-agent-pod-7b8d9f" — for debugging
    domain: string;            // "fraud"
  };

  // Content — domain-specific, validated against registered schema
  content: Record<string, unknown>;

  // Metadata
  metadata: {
    confidence: number;          // 0.0–1.0
    evidence_refs: string[];     // IDs of raw data that support this signal
    sensitivity_class: "PUBLIC" | "INTERNAL" | "RESTRICTED" | "CONFIDENTIAL";
    pii_classes: Array<"FINANCIAL" | "IDENTITY" | "BEHAVIOURAL" | "HEALTH">;
    ttl_seconds: number;         // how long this signal remains valid
    propagation_class: "IMMEDIATE" | "STANDARD" | "BATCH";
    // IMMEDIATE: push synchronously to real-time consumers, SLA <100ms
    // STANDARD:  push asynchronously to all consumers, SLA <30s
    // BATCH:     accumulate and deliver in batch runs, SLA <4h
  };

  timestamp: string;             // ISO 8601
  schema_uri: string;            // "registry://signals/risk.transaction_flagged/v1.2"
}
```

### Signal Type Registry (examples — teams define their own)

```yaml
# Each domain team owns their signal types.
# These are examples, not a complete list.

signal_types:
  risk.transaction_flagged:
    owner: fraud
    content_schema:
      transaction_id: string (required)
      flag_reason: enum[unusual_geography, velocity, pattern_mismatch, mule_network]
      rule_ids: string[] (required)
      risk_score: number (0.0-1.0, required)
    default_ttl: 72h
    default_propagation: IMMEDIATE

  risk.account_takeover_suspected:
    owner: fraud
    content_schema:
      indicators: string[] (required)
      action_recommended: enum[block, step_up_auth, monitor]
      risk_score: number
    default_ttl: 24h
    default_propagation: IMMEDIATE

  retail.sentiment_detected:
    owner: retail
    content_schema:
      sentiment: enum[positive, neutral, negative, distressed]
      channel: enum[voice, chat, branch, digital]
      trigger_phrases: string[]  # anonymised — no verbatim quotes
    default_ttl: 48h
    default_propagation: STANDARD

  retail.churn_risk_signal:
    owner: retail
    content_schema:
      risk_level: enum[low, medium, high, critical]
      contributing_factors: string[]
      recommended_intervention: string
    default_ttl: 14d
    default_propagation: STANDARD

  operations.complaint_raised:
    owner: operations
    content_schema:
      complaint_id: string
      complaint_category: enum[service, product, fraud, other]
      severity: enum[low, medium, high]
      assigned_to_domain: string
    default_ttl: 90d
    default_propagation: STANDARD

  operations.complaint_resolved:
    owner: operations
    content_schema:
      complaint_id: string
      resolution_type: enum[upheld, partially_upheld, not_upheld]
      resolution_summary: string  # anonymised
      customer_satisfaction_score: number  # 1-5, if collected
    default_ttl: 180d
    default_propagation: STANDARD

  mortgage.application_state_changed:
    owner: mortgage
    content_schema:
      application_id: string
      previous_state: string
      new_state: string
      blocking_reason: string  # if state is BLOCKED
    default_ttl: 180d
    default_propagation: STANDARD
```

### Routing Logic

```python
class SignalBus:

    def publish(self, signal: Signal) -> PublishResult:
        
        # Step 1: Validate schema against Contract Registry
        schema = self.registry.get_schema(signal.signal_type, signal.schema_version)
        validation_errors = schema.validate(signal.content)
        if validation_errors:
            raise SignalValidationError(signal.signal_type, validation_errors)

        # Step 2: Check producer is authorised to write this signal type
        if not self.registry.can_produce(signal.producer.agent_type, signal.signal_type):
            raise UnauthorisedProducerError(signal.producer.agent_type, signal.signal_type)

        # Step 3: Write to Signal Store (append-only, always succeeds first)
        self.signal_store.append(signal)

        # Step 4: Determine consumers from Contract Registry
        consumers = self.registry.get_consumers(
            signal_type=signal.signal_type,
            sensitivity_class=signal.metadata.sensitivity_class,
            confidence=signal.metadata.confidence
        )
        # consumers is a list of:
        # { agent_type, propagation_priority, min_confidence, relevance_weights }

        # Step 5: Route by propagation class
        immediate_consumers = [c for c in consumers if c.propagation_priority == "IMMEDIATE"]
        standard_consumers  = [c for c in consumers if c.propagation_priority == "STANDARD"]
        batch_consumers     = [c for c in consumers if c.propagation_priority == "BATCH"]

        if signal.metadata.propagation_class == "IMMEDIATE":
            # Push synchronously to IMMEDIATE consumers via their sidecar endpoints
            self._push_immediate(signal, immediate_consumers)
            # Queue the rest
            self._queue_async(signal, standard_consumers)
            self._queue_batch(signal, batch_consumers)

        elif signal.metadata.propagation_class == "STANDARD":
            # All async
            self._queue_async(signal, immediate_consumers + standard_consumers)
            self._queue_batch(signal, batch_consumers)

        else:  # BATCH
            self._queue_batch(signal, consumers)

        # Step 6: Invalidate narrative caches for affected entities
        self.narrative_cache.invalidate(signal.entity_id)

        # Step 7: Trigger proactive synthesis if high-value signal
        if signal.metadata.confidence > 0.75:
            self.synthesis_engine.queue_update(signal.entity_id, trigger_signal=signal)

        return PublishResult(
            signal_id=signal.signal_id,
            consumers_notified=len(consumers),
            immediate_consumers=len(immediate_consumers)
        )
```

---

## Component 3: Context Sidecar

### What It Does

The sidecar is the interface every agent uses to interact with the Context Fabric.
It lives alongside the agent process (same pod in GKE, sidecar container in Cloud Run)
and communicates over localhost gRPC — zero network latency.

The agent never talks directly to any store, bus, or registry. Only to the sidecar.
This is what makes the fabric enforceable.

### gRPC Interface

```protobuf
syntax = "proto3";
package lbg.context.sidecar.v1;

service ContextSidecar {

  // Get assembled context for an entity, ready to inject into agent prompt
  rpc GetContext (GetContextRequest) returns (ContextWindow);

  // Write a signal produced by this agent
  rpc WriteSignal (WriteSignalRequest) returns (WriteSignalResponse);

  // Stream real-time context updates during an active session
  // Agent opens this at session start and receives deltas as signals arrive
  rpc SubscribeContextUpdates (SubscribeRequest) returns (stream ContextDelta);

  // Declare what this agent is currently doing (affects assembly weights)
  rpc DeclareIntent (IntentDeclaration) returns (IntentAck);

  // Translate a domain-local entity ID to canonical entity_id
  rpc ResolveEntityId (ResolveEntityRequest) returns (ResolveEntityResponse);
}

message GetContextRequest {
  string entity_id        = 1;  // canonical entity ID (use ResolveEntityId first)
  string agent_intent     = 2;  // e.g., "OVERDRAFT_ENQUIRY", "FRAUD_REVIEW"
  string session_id       = 3;
  bool   include_graph    = 4;  // traverse entity graph for related context
  int32  max_signals      = 5;  // cap on raw signals returned (default: 20)
  int32  max_age_days     = 6;  // only include signals this recent (default: 90)
}

message ContextWindow {
  string    entity_id            = 1;
  string    narrative            = 2;  // synthesised text, inject directly into prompt
  StanceHint stance              = 3;  // EMPATHY_FIRST | STANDARD | CAUTION | ESCALATE | VERIFY_IDENTITY
  repeated Signal       signals  = 4;  // raw signals, sorted by relevance × recency
  repeated Inference inferences  = 5;  // active inferences about this entity
  repeated CriticalFlag flags    = 6;  // things agent must do or not do
  float     assembly_confidence  = 7;  // 0.0–1.0
  string    assembled_at         = 8;  // ISO 8601
  string    valid_until          = 9;  // cache expiry
  bool      is_cached            = 10; // true if served from warm cache
  bool      has_critical_alerts  = 11; // true if any HIGH/CRITICAL severity signals exist
  repeated Entity related_entities = 12;
}

message WriteSignalRequest {
  string signal_type    = 1;   // must match a type in this agent's produces contract
  string entity_id      = 2;
  string session_id     = 3;
  bytes  content        = 4;   // JSON, validated against registered schema
  float  confidence     = 5;
  repeated string evidence_refs = 6;
  string sensitivity_class = 7;
  int32  ttl_seconds    = 8;   // 0 = use schema default
  string propagation_class = 9;
}

message ContextDelta {
  string entity_id  = 1;
  Signal new_signal = 2;       // the signal that triggered this delta
  string narrative  = 3;       // updated narrative incorporating the new signal
  bool   is_critical = 4;      // true if agent should interrupt current flow to act on this
}

enum StanceHint {
  STANDARD         = 0;
  EMPATHY_FIRST    = 1;
  CAUTION          = 2;
  ESCALATE         = 3;
  VERIFY_IDENTITY  = 4;
}
```

### Sidecar Internals

```python
class ContextSidecar:
    """
    Deployed as a container alongside each agent.
    Configured at startup with the agent's registered contract.
    """

    def __init__(self, agent_type: str, config: SidecarConfig):
        self.agent_type = agent_type
        self.contract = ContractRegistry.load(agent_type)
        self.assembler = AssemblerClient(config.assembler_endpoint)
        self.bus = SignalBusClient(config.bus_endpoint)
        self.identity = IdentityGraphClient(config.identity_endpoint)
        self.narrative_cache = LocalCache(ttl_seconds=config.cache_ttl)
        self.pii_classifier = PIIClassifier()

    def GetContext(self, request: GetContextRequest) -> ContextWindow:

        # Check warm cache first
        cache_key = f"{request.entity_id}:{self.agent_type}:{request.agent_intent}"
        cached = self.narrative_cache.get(cache_key)
        if cached and not cached.is_expired():
            cached.is_cached = True
            return cached

        # Verify this agent is allowed to read context for this intent
        if not self.contract.allows_consumption_for_intent(request.agent_intent):
            raise IntentNotAuthorisedError(self.agent_type, request.agent_intent)

        # Request assembly
        window = self.assembler.assemble(
            entity_id=request.entity_id,
            agent_type=self.agent_type,
            intent=request.agent_intent,
            session_id=request.session_id,
            include_graph=request.include_graph,
            sensitivity_clearance=self.contract.sensitivity_clearance,
            max_signals=request.max_signals or 20
        )

        # Log the read for audit (non-blocking)
        self._log_context_read_async(
            entity_id=request.entity_id,
            agent_type=self.agent_type,
            intent=request.agent_intent,
            session_id=request.session_id,
            window_id=window.snapshot_id
        )

        # Warm cache
        self.narrative_cache.set(cache_key, window)
        return window

    def WriteSignal(self, request: WriteSignalRequest) -> WriteSignalResponse:

        # Verify this agent is allowed to produce this signal type
        if not self.contract.can_produce(request.signal_type):
            raise UnauthorisedSignalTypeError(self.agent_type, request.signal_type)

        # Validate content against schema
        schema = ContractRegistry.get_schema(request.signal_type)
        schema.validate(request.content)  # raises on error

        # PII classification — classify the signal content
        pii_found = self.pii_classifier.classify(request.content)
        required_sensitivity = self._minimum_sensitivity_for_pii(pii_found)

        # Never write below required sensitivity
        effective_sensitivity = max_sensitivity(
            request.sensitivity_class, required_sensitivity
        )

        # Build the full signal with sidecar-attached provenance
        signal = Signal(
            signal_id=uuid4(),
            schema_version=schema.version,
            signal_type=request.signal_type,
            entity_id=request.entity_id,
            session_id=request.session_id,
            producer=Producer(
                agent_type=self.agent_type,
                agent_instance_id=self.instance_id,
                domain=self.contract.domain
            ),
            content=request.content,
            metadata=SignalMetadata(
                confidence=request.confidence,
                evidence_refs=request.evidence_refs,
                sensitivity_class=effective_sensitivity,
                pii_classes=pii_found,
                ttl_seconds=request.ttl_seconds or schema.default_ttl_seconds,
                propagation_class=request.propagation_class or schema.default_propagation
            ),
            timestamp=now_iso8601(),
            schema_uri=schema.uri
        )

        return self.bus.publish(signal)

    def SubscribeContextUpdates(self, request: SubscribeRequest):
        """Streaming — agent receives deltas as new signals arrive for entity"""
        for signal in self.bus.subscribe(
            entity_id=request.entity_id,
            sensitivity_clearance=self.contract.sensitivity_clearance,
            agent_type=self.agent_type
        ):
            # Re-synthesise narrative with the new signal incorporated
            updated_narrative = self.assembler.synthesise_delta(
                entity_id=request.entity_id,
                agent_type=self.agent_type,
                intent=request.current_intent,
                new_signal=signal
            )

            yield ContextDelta(
                entity_id=request.entity_id,
                new_signal=signal,
                narrative=updated_narrative,
                is_critical=(signal.metadata.confidence > 0.85 and
                             signal.metadata.propagation_class == "IMMEDIATE")
            )
```

### Deployment

**GKE** (most agents):
```yaml
# kubernetes pod spec — sidecar pattern
spec:
  containers:
  - name: retail-agent
    image: lbg/retail-agent:2.4.1
    env:
    - name: CONTEXT_SIDECAR_ENDPOINT
      value: "localhost:9090"

  - name: context-sidecar
    image: lbg/context-sidecar:1.3.0
    ports:
    - containerPort: 9090
    env:
    - name: AGENT_TYPE
      value: "retail_agent"
    - name: ASSEMBLER_ENDPOINT
      valueFrom:
        secretKeyRef:
          name: context-fabric-config
          key: assembler_endpoint
    - name: BUS_ENDPOINT
      valueFrom:
        secretKeyRef:
          name: context-fabric-config
          key: bus_endpoint
    resources:
      requests:
        cpu: 100m
        memory: 128Mi
      limits:
        cpu: 250m
        memory: 256Mi
```

**Agent Engine**: Deploy sidecar as a Cloud Run service in the same VPC, called over
private service connect. Slightly higher latency (~15ms vs ~1ms) but same interface.

---

## Component 4: Context Assembler

### What It Does

The Assembler constructs a `ContextWindow` — the agent-ready, synthesised view of
everything relevant about an entity for a specific agent and intent. It is the most
computationally intensive component and the one that delivers most of the value.

### Assembly Algorithm

```python
class ContextAssembler:

    def assemble(self, entity_id: str, agent_type: str, intent: str,
                  session_id: str, sensitivity_clearance: list,
                  include_graph: bool = True, max_signals: int = 20) -> ContextWindow:

        # Step 1: Load assembly weights for this (agent_type × intent) pair
        # These come from the Contract Registry consumption declarations
        weights = self.registry.get_assembly_weights(agent_type, intent)
        # weights = {
        #   "risk.*": {"weight": 0.90, "max_age_days": 14},
        #   "retail.*": {"weight": 0.60, "max_age_days": 30},
        #   "operations.complaint_raised": {"weight": 0.85, "max_age_days": 90},
        #   "operations.complaint_resolved": {"weight": 0.50, "max_age_days": 90},
        #   "_default": {"weight": 0.30, "max_age_days": 7}
        # }

        # Step 2: Entity graph expansion (if enabled)
        if include_graph:
            entity_cluster = self.identity.get_entity_cluster(entity_id, depth=1)
        else:
            entity_cluster = [entity_id]
        # entity_cluster might be [entity_id, joint_holder_id, authorized_signatory_id]

        # Step 3: Collect raw signals across the entity cluster
        raw_signals = self.signal_store.query(
            entity_ids=entity_cluster,
            signal_types=list(weights.keys()),  # only types this agent consumes
            sensitivity_classes=sensitivity_clearance,
            max_age_days=max(w["max_age_days"] for w in weights.values())
        )

        # Step 4: Apply temporal decay and relevance weighting
        scored_signals = []
        for signal in raw_signals:
            base_weight = self._get_base_weight(signal.signal_type, weights)
            decay = self._temporal_decay(signal.signal_type, signal.timestamp)
            graph_discount = 1.0 if signal.entity_id == entity_id else 0.6
            # signals about related entities (not the primary) get 40% discount

            effective_score = base_weight * decay * signal.metadata.confidence * graph_discount
            scored_signals.append(ScoredSignal(signal=signal, score=effective_score))

        # Sort by effective score descending
        scored_signals.sort(key=lambda s: s.score, reverse=True)

        # Step 5: Load active inferences
        inferences = self.inference_store.get_active(entity_id)

        # Step 6: Take snapshot for audit (before synthesis)
        snapshot_id = self._write_context_snapshot(
            entity_id, agent_type, intent,
            signal_ids=[s.signal.signal_id for s in scored_signals[:max_signals]],
            inference_ids=[i.inference_id for i in inferences]
        )

        # Step 7: Synthesise narrative
        top_signals = scored_signals[:20]  # cap synthesis input
        narrative_result = self.synthesis_engine.synthesise(
            top_signals=top_signals,
            inferences=inferences,
            agent_type=agent_type,
            intent=intent,
            entity_meta=self.identity.get_entity_meta(entity_id)
        )

        # Step 8: Determine validity (expires when earliest TTL-bearing signal expires)
        valid_until = min(
            s.signal.expires_at for s in top_signals
            if s.signal.metadata.ttl_seconds > 0
        ) if top_signals else (now() + timedelta(hours=24))

        return ContextWindow(
            entity_id=entity_id,
            snapshot_id=snapshot_id,
            narrative=narrative_result.narrative,
            stance=narrative_result.stance,
            signals=[s.signal for s in scored_signals[:max_signals]],
            inferences=inferences,
            flags=narrative_result.critical_flags,
            assembly_confidence=narrative_result.confidence,
            assembled_at=now_iso8601(),
            valid_until=valid_until.isoformat(),
            is_cached=False,
            has_critical_alerts=any(
                s.signal.metadata.confidence > 0.80 and
                self._is_critical_type(s.signal.signal_type)
                for s in scored_signals[:5]
            ),
            related_entities=[
                self.identity.get_entity(eid)
                for eid in entity_cluster
                if eid != entity_id
            ]
        )
```

### Temporal Decay Functions

Context decays at different rates depending on what it represents.
These decay multipliers are applied to the base relevance weight.

```python
DECAY_PROFILES = {
    # Risk signals: fast decay — yesterday's fraud flag is less relevant today
    "risk.*": lambda age_hours: 0.5 ** (age_hours / 24),

    # Sentiment signals: medium decay — frustration from 3 days ago still matters
    "retail.sentiment_detected": lambda age_hours: 0.5 ** (age_hours / 72),

    # Complaints: slow decay — complaint experience lingers for months
    "operations.complaint_raised": lambda age_hours: 0.5 ** (age_hours / 720),
    "operations.complaint_resolved": lambda age_hours: 0.5 ** (age_hours / 2160),

    # Application state: event-driven — valid until state changes (no time decay)
    "mortgage.application_state_changed": lambda age_hours: 1.0,

    # Churn risk: medium-slow decay — meaningful for weeks
    "retail.churn_risk_signal": lambda age_hours: 0.5 ** (age_hours / 336),  # 14-day half-life

    # Relationship facts: no decay
    "_tenure_signal": lambda age_hours: 1.0,

    # Default for unspecified types
    "_default": lambda age_hours: 0.5 ** (age_hours / 48)
}
```

### Predictive Pre-Assembly

The Assembler warms the cache for entities likely to be contacted soon.
This is what makes real-time latency achievable — you pay the assembly cost before it's needed.

```python
class PredictivePreAssembler:
    """
    Runs as a background job, triggered by:
    1. Inbound routing events (customer dialling in)
    2. Scheduled callbacks (agent will call at 14:00)
    3. Open cases nearing SLA breach
    4. High-priority signal published (IMMEDIATE propagation class)
    """

    def on_inbound_routing_event(self, entity_id: str, target_agent_type: str):
        # Customer is on hold, about to reach agent — pre-assemble now
        # Likely intents for this agent type based on routing reason
        likely_intents = self.intent_predictor.predict(entity_id, target_agent_type)
        # likely_intents = ["GENERAL_ENQUIRY", "OVERDRAFT_ENQUIRY"] with probabilities

        for intent, probability in likely_intents[:3]:
            if probability > 0.2:
                self.assembler.assemble_and_cache(entity_id, target_agent_type, intent)

    def on_high_priority_signal(self, signal: Signal):
        # A critical signal arrived — refresh context for all agents that consume it
        consumers = self.registry.get_consumers(signal.signal_type)
        for consumer in consumers:
            if consumer.propagation_priority == "IMMEDIATE":
                # Refresh their cached context for this entity
                active_intents = self.session_tracker.get_active_intent(
                    entity_id=signal.entity_id, agent_type=consumer.agent_type
                )
                if active_intents:
                    self.assembler.assemble_and_cache(
                        signal.entity_id, consumer.agent_type, active_intents[0]
                    )
```

---

## Component 5: Contract Registry

### What It Does

Every agent that participates in the Context Fabric registers a contract. The contract
declares what the agent produces, what it consumes, and under what conditions. The registry
enforces these declarations at runtime — not just as documentation.

### Contract Schema

```yaml
# Example: Fraud Agent contract
# File: contracts/fraud_agent.v2.3.yaml
# Owned by: fraud-engineering team
# Approved by: Context Stewardship Council on 2026-04-15

agent_contract:
  agent_type: "fraud_agent"
  version: "2.3"
  domain: "fraud"
  owner_team: "fraud-engineering"
  owner_contact: "fraud-platform@lbg.com"
  approved_at: "2026-04-15"
  approved_by: "context-stewardship-council"

  produces:
    - signal_type: "risk.transaction_flagged"
      schema_ref: "signals/risk.transaction_flagged/v1.2"
      propagation_default: "IMMEDIATE"
      ttl_default: "72h"

    - signal_type: "risk.account_takeover_suspected"
      schema_ref: "signals/risk.account_takeover_suspected/v1.0"
      propagation_default: "IMMEDIATE"
      ttl_default: "24h"

    - signal_type: "risk.investigation_closed"
      schema_ref: "signals/risk.investigation_closed/v1.0"
      propagation_default: "STANDARD"
      ttl_default: "180d"

  consumes:
    - signal_pattern: "retail.*"
      purpose: "Enriches fraud pattern detection with customer interaction context"
      min_confidence: 0.60
      max_age: "30d"
      sensitivity_classes: ["INTERNAL", "RESTRICTED"]
      relevance_weights:
        FRAUD_REVIEW: 0.80
        TRANSACTION_REVIEW: 0.65
        ACCOUNT_VERIFICATION: 0.70

    - signal_pattern: "operations.complaint_raised"
      purpose: "Complaints may indicate genuine customer contacting us about takeover"
      min_confidence: 0.70
      max_age: "14d"
      sensitivity_classes: ["INTERNAL", "RESTRICTED"]
      relevance_weights:
        ACCOUNT_TAKEOVER_REVIEW: 0.90
        FRAUD_REVIEW: 0.75

    - signal_pattern: "operations.complaint_resolved"
      purpose: "Resolution pattern helps distinguish fraud from service failures"
      min_confidence: 0.60
      max_age: "90d"
      sensitivity_classes: ["INTERNAL"]
      relevance_weights:
        FRAUD_REVIEW: 0.40

  # For these intents, this agent's signals take authority precedence
  intent_authority:
    - intent: "TRANSACTION_AUTHORISATION"
      rank: 1   # highest authority
    - intent: "ACCOUNT_VERIFICATION"
      rank: 1
    - intent: "FRAUD_REVIEW"
      rank: 1
    - intent: "OVERDRAFT_ENQUIRY"
      rank: 2   # retail has rank 1 for this intent
    - intent: "MORTGAGE_REVIEW"
      rank: 3

  # What sensitivity classes this agent's processes are cleared for
  sensitivity_clearance:
    - "INTERNAL"
    - "RESTRICTED"
    # Not CONFIDENTIAL — fraud agent does not access full personal profiles

  # Vocabulary mappings — what this domain's terms mean in universal concepts
  vocabulary_mappings:
    "high_risk_customer": "entity.risk_assessment.elevated"
    "mule_network_member": "entity.risk_assessment.critical"
    "unusual_behaviour": "entity.behaviour.anomaly_detected"
```

### Schema Evolution Rules

The registry enforces these rules on all schema changes. Breaking changes require
a version bump and a migration window:

```python
ALLOWED_WITHOUT_VERSION_BUMP = [
    "add_optional_field",         # new optional field in content
    "widen_enum",                 # add new value to an enum (existing values kept)
    "extend_string_max_length",   # make string field accept longer values
    "decrease_min_confidence",    # make signal more permissive to consumers
]

REQUIRES_VERSION_BUMP = [
    "remove_field",               # even if optional — consumers may depend on it
    "rename_field",               # treat as remove + add
    "change_field_type",          # e.g., string → number
    "narrow_enum",                # remove an enum value
    "add_required_field",         # existing producers will fail validation
    "change_signal_type_name",    # never do this — create a new type instead
]

BLOCKED_ENTIRELY = [
    "delete_signal_type",         # deprecate instead, keep for 6 months minimum
    "change_signal_type_namespace", # too breaking — create new domain namespace
]
```

---

## Component 6: Context Store

### Store 1: Signal Store (append-only)

```sql
CREATE TABLE signals (
  signal_id          UUID         PRIMARY KEY,
  signal_type        VARCHAR(128) NOT NULL,
  schema_version     VARCHAR(16)  NOT NULL,
  entity_id          UUID         NOT NULL,
  session_id         UUID,
  process_id         UUID,
  producer_type      VARCHAR(64)  NOT NULL,
  producer_instance  VARCHAR(128) NOT NULL,
  producer_domain    VARCHAR(64)  NOT NULL,
  content            JSONB        NOT NULL,
  confidence         DECIMAL(4,3) NOT NULL,
  evidence_refs      TEXT[]       DEFAULT '{}',
  sensitivity_class  VARCHAR(16)  NOT NULL,
  pii_classes        TEXT[]       DEFAULT '{}',
  ttl_seconds        INTEGER      NOT NULL,
  expires_at         TIMESTAMPTZ  NOT NULL GENERATED ALWAYS AS
                     (created_at + (ttl_seconds * INTERVAL '1 second')) STORED,
  propagation_class  VARCHAR(16)  NOT NULL,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  is_disputed        BOOLEAN      NOT NULL DEFAULT FALSE
);

-- Primary access patterns
CREATE INDEX idx_signals_entity_time     ON signals(entity_id, created_at DESC);
CREATE INDEX idx_signals_entity_type     ON signals(entity_id, signal_type, created_at DESC);
CREATE INDEX idx_signals_expiry          ON signals(expires_at) WHERE expires_at > NOW();
CREATE INDEX idx_signals_session         ON signals(session_id, created_at DESC);
CREATE INDEX idx_signals_sensitivity     ON signals(sensitivity_class, entity_id);

-- Disputes table (referenced from signals)
CREATE TABLE signal_disputes (
  dispute_id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id            UUID        NOT NULL REFERENCES signals(signal_id),
  disputed_by_agent    VARCHAR(64) NOT NULL,
  dispute_reason       TEXT        NOT NULL,
  dispute_confidence   DECIMAL(4,3) NOT NULL,
  raised_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at          TIMESTAMPTZ,
  resolution           VARCHAR(32) -- UPHELD | OVERTURNED | INCONCLUSIVE
);
```

### Store 2: Inference Store (versioned)

```sql
CREATE TABLE inferences (
  inference_id        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id           UUID         NOT NULL,
  inference_type      VARCHAR(128) NOT NULL,  -- 'churn_risk' | 'financial_stress' | 'fraud_victim'
  inference_value     JSONB        NOT NULL,  -- type-specific payload
  confidence          DECIMAL(4,3) NOT NULL,
  source_signal_ids   UUID[]       NOT NULL,  -- provenance: which signals drove this
  generated_by        VARCHAR(128) NOT NULL,  -- synthesis engine version + template
  generated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at          TIMESTAMPTZ  NOT NULL,
  superseded_by       UUID         REFERENCES inferences(inference_id),
  is_contested        BOOLEAN      NOT NULL DEFAULT FALSE  -- conflicting signals exist
);

-- Only one active inference per entity per type
CREATE UNIQUE INDEX idx_active_inference
  ON inferences(entity_id, inference_type)
  WHERE superseded_by IS NULL;

CREATE INDEX idx_inferences_entity ON inferences(entity_id, inference_type);
```

### Store 3: Decision Store (immutable, regulatory)

```sql
CREATE TABLE decisions (
  decision_id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id             UUID        NOT NULL,
  agent_type            VARCHAR(64) NOT NULL,
  agent_instance        VARCHAR(128) NOT NULL,
  session_id            UUID        NOT NULL,
  decision_type         VARCHAR(128) NOT NULL,  -- 'OVERDRAFT_APPROVED' | 'TRANSACTION_DECLINED'
  decision_value        JSONB       NOT NULL,   -- the actual decision detail
  context_snapshot_id   UUID        NOT NULL,   -- FK to context_snapshots
  rationale             TEXT        NOT NULL,   -- LLM-generated rationale, based on snapshot
  regulatory_basis      TEXT,                   -- FCA/PRA rule reference if applicable
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Outcome filled in later
  outcome               JSONB,
  outcome_at            TIMESTAMPTZ,
  outcome_source        VARCHAR(64)             -- which agent/system reported the outcome
  -- NO DELETE, NO UPDATE (except outcome columns) — enforced via row security policy
);

CREATE TABLE context_snapshots (
  snapshot_id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id         UUID        NOT NULL,
  agent_type        VARCHAR(64) NOT NULL,
  intent            VARCHAR(64) NOT NULL,
  narrative         TEXT        NOT NULL,
  signal_ids        UUID[]      NOT NULL,
  inference_ids     UUID[]      NOT NULL,
  assembly_confidence DECIMAL(4,3) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Immutable. Never updated.
);
```

### Retention Policy

```python
RETENTION_POLICIES = {
    # Operational context (subject to GDPR right-to-erasure)
    "signals": {
        "retention": "ttl_expires_at",    # erased when TTL expires
        "gdpr_erasure": "full_delete",    # delete on DSAR
    },
    # Inferences (subject to GDPR)
    "inferences": {
        "retention": "expires_at",
        "gdpr_erasure": "full_delete",
    },
    # Decision records (regulatory retention — 7 years)
    "decisions": {
        "retention": "7_years",
        "gdpr_erasure": "redact_linkage",
        # On DSAR: remove entity_id foreign key, replace with pseudonymous token
        # Preserves "a decision was made" without retaining personal data linkage
    },
    # Context snapshots (regulatory — must match decision retention)
    "context_snapshots": {
        "retention": "7_years",
        "gdpr_erasure": "redact_linkage",
    },
}
```

This is how you satisfy both GDPR (erase operational data) and FCA (retain decision audit)
simultaneously: they are in separate stores with separate erasure rules.

---

## Component 7: Synthesis Engine

### What It Does

The Synthesis Engine converts raw signals and inferences into two outputs:

1. **Narratives** — ready-to-inject text for agent prompts (reactive, on-demand)
2. **Inferences** — derived conclusions about entities, written back to the Inference Store
   (proactive, continuous background loop)

### Reactive Narrative Synthesis

```python
class SynthesisEngine:

    MODEL = "gemini-2.0-flash"  # fast, cheap, accurate for structured synthesis

    SYSTEM_PROMPT_TEMPLATE = """
You are a context synthesis engine for LBG (Lloyds Banking Group).
You receive signals from multiple banking domains about a customer entity.
Your job is to synthesise these signals into a clear, actionable narrative
for a {agent_type} agent about to handle an interaction with intent: {intent}.

Your output must be a JSON object with exactly these fields:
{{
  "narrative": "2-4 sentences. What the agent needs to know right now to handle this interaction well. Factual, specific, no fluff.",
  "stance": one of ["STANDARD", "EMPATHY_FIRST", "CAUTION", "ESCALATE", "VERIFY_IDENTITY"],
  "critical_flags": ["list", "of", "must-do-or-avoid items"],
  "confidence": float between 0.0 and 1.0,
  "signal_basis": ["signal_id_1", "signal_id_2"]  // up to 5 IDs that most shaped this narrative
}}

Stance guide:
- STANDARD: no elevated concerns, proceed normally
- EMPATHY_FIRST: customer has had a difficult experience (complaint, fraud victim, financial stress)
- CAUTION: risk signals present but unconfirmed — handle carefully, don't alarm customer
- ESCALATE: active critical issue — this agent should escalate immediately
- VERIFY_IDENTITY: fraud or account takeover signals present — verify identity rigorously before any account discussion

Rules:
- Only include what is relevant to {intent} for a {agent_type}
- Signals with confidence < 0.6 must be presented as uncertain ("signals suggest..." not "the customer is...")
- If signals from different domains conflict, state the conflict explicitly in the narrative
- Never include raw PII (names, account numbers, addresses) — behavioural and relational facts only
- If the context is genuinely thin (< 3 relevant signals), say so rather than padding
- The narrative is read by a {agent_type} who has roughly 5 seconds to absorb it before engaging the customer
"""

    def synthesise(self, top_signals: list[ScoredSignal], inferences: list[Inference],
                   agent_type: str, intent: str, entity_meta: EntityMeta) -> NarrativeResult:

        user_content = self._build_user_content(
            top_signals, inferences, agent_type, intent, entity_meta
        )

        response = self.vertex_ai.generate(
            model=self.MODEL,
            system_prompt=self.SYSTEM_PROMPT_TEMPLATE.format(
                agent_type=agent_type, intent=intent
            ),
            user_content=user_content,
            response_mime_type="application/json",
            max_tokens=512,
            temperature=0.1  # low temp — we want consistent, factual outputs
        )

        result = json.loads(response.text)
        return NarrativeResult(
            narrative=result["narrative"],
            stance=StanceHint[result["stance"]],
            critical_flags=result["critical_flags"],
            confidence=result["confidence"],
            signal_basis=result["signal_basis"]
        )

    def _build_user_content(self, signals, inferences, agent_type, intent, entity_meta):
        signal_descriptions = []
        for i, scored in enumerate(signals[:20]):
            s = scored.signal
            age_hours = (now() - s.created_at).total_seconds() / 3600
            signal_descriptions.append(
                f"[{i+1}] signal_id={s.signal_id}\n"
                f"    type={s.signal_type} | domain={s.producer.domain}\n"
                f"    confidence={s.metadata.confidence:.2f} | age={age_hours:.0f}h\n"
                f"    relevance_score={scored.score:.3f}\n"
                f"    content={json.dumps(s.content, indent=4)}\n"
            )

        inference_descriptions = [
            f"- {inf.inference_type}: {json.dumps(inf.inference_value)} "
            f"(confidence={inf.confidence:.2f}, "
            f"{'CONTESTED' if inf.is_contested else 'active'})"
            for inf in inferences
        ]

        return f"""
Entity tenure: {entity_meta.tenure_years:.1f} years with LBG

Active inferences (derived conclusions already held about this entity):
{chr(10).join(inference_descriptions) if inference_descriptions else '  none'}

Signals (ranked by relevance × recency, highest relevance first):
{chr(10).join(signal_descriptions)}

Synthesise context for a {agent_type} handling intent: {intent}
"""
```

### Proactive Inference Generation (background loop)

```python
class ProactiveInferenceEngine:
    """
    Runs continuously, triggered by Signal Bus events.
    Detects patterns and writes inferences to the Inference Store.
    """

    # Inference templates — owned by domain stewards, versioned in Contract Registry
    INFERENCE_TEMPLATES = {
        "financial_stress": {
            "owner": "risk",
            "signals_required": [
                {"type": "retail.payment_missed",    "weight": 0.40, "min_count": 2, "window": "30d"},
                {"type": "operations.hardship_mentioned", "weight": 0.50, "min_count": 1, "window": "14d"},
                {"type": "retail.overdraft_requested",   "weight": 0.30, "min_count": 1, "window": "7d"},
                {"type": "retail.balance_enquiry_freq",  "weight": 0.20, "min_count": 3, "window": "7d"},
            ],
            "min_pattern_score": 0.60,
            "confidence_formula": "weighted_sum * max(signal_confidences)",
            "ttl": "30d"
        },
        "churn_risk": {
            "owner": "retail",
            "signals_required": [
                {"type": "retail.sentiment_detected",    "weight": 0.45,
                 "filter": "sentiment in [negative, distressed]", "min_count": 2, "window": "14d"},
                {"type": "retail.churn_risk_signal",     "weight": 0.55, "min_count": 1, "window": "30d"},
                {"type": "operations.complaint_raised",  "weight": 0.35, "min_count": 1, "window": "30d"},
            ],
            "min_pattern_score": 0.55,
            "confidence_formula": "weighted_sum * mean(signal_confidences)",
            "ttl": "14d"
        },
        "fraud_victim": {
            "owner": "fraud",
            "signals_required": [
                {"type": "risk.transaction_flagged",        "weight": 0.60, "min_count": 1, "window": "7d"},
                {"type": "retail.sentiment_detected",       "weight": 0.30,
                 "filter": "sentiment == distressed", "min_count": 1, "window": "7d"},
                {"type": "operations.complaint_raised",     "weight": 0.40,
                 "filter": "category == fraud", "min_count": 1, "window": "7d"},
            ],
            "min_pattern_score": 0.65,
            "confidence_formula": "weighted_sum",
            "ttl": "72h"
        }
    }

    def on_signal_published(self, signal: Signal):
        # Determine which inference templates might be triggered by this signal type
        relevant_templates = [
            (name, template)
            for name, template in self.INFERENCE_TEMPLATES.items()
            if any(req["type"] == signal.signal_type for req in template["signals_required"])
        ]

        for inference_type, template in relevant_templates:
            self._evaluate_template(signal.entity_id, inference_type, template)

    def _evaluate_template(self, entity_id: str, inference_type: str, template: dict):
        window_days = max(req["window"] for req in template["signals_required"])
        recent_signals = self.signal_store.query(
            entity_ids=[entity_id],
            max_age_days=int(window_days.replace("d", "")),
            sensitivity_classes=["INTERNAL", "RESTRICTED"]
        )

        # Score the pattern match
        pattern_score = 0.0
        matched_signal_ids = []
        for req in template["signals_required"]:
            matching = [
                s for s in recent_signals
                if s.signal_type == req["type"]
                and self._matches_filter(s, req.get("filter"))
            ]
            if len(matching) >= req.get("min_count", 1):
                best_signal = max(matching, key=lambda s: s.metadata.confidence)
                pattern_score += req["weight"]
                matched_signal_ids.append(best_signal.signal_id)

        if pattern_score >= template["min_pattern_score"]:
            confidence = self._calculate_confidence(
                template["confidence_formula"], pattern_score, recent_signals
            )

            # Write inference — supersedes any existing inference of same type for entity
            existing = self.inference_store.get_active_inference(entity_id, inference_type)
            new_inference = Inference(
                entity_id=entity_id,
                inference_type=inference_type,
                inference_value={"pattern_score": pattern_score, "level": self._level(confidence)},
                confidence=confidence,
                source_signal_ids=matched_signal_ids,
                generated_by=f"ProactiveEngine/template/{inference_type}/v1",
                expires_at=now() + parse_ttl(template["ttl"])
            )

            if existing:
                existing.superseded_by = new_inference.inference_id
                self.inference_store.update(existing)

            self.inference_store.insert(new_inference)

            # Propagate inference as a signal so other agents can react
            self.signal_bus.publish(Signal(
                signal_type=f"inference.{inference_type}_detected",
                entity_id=entity_id,
                content=new_inference.inference_value,
                metadata=SignalMetadata(
                    confidence=confidence,
                    propagation_class="STANDARD",
                    ttl_seconds=parse_ttl_seconds(template["ttl"])
                )
            ))
```

---

## Component 8: Conflict Arbiter

### What It Does

When two agents produce conflicting inferences about the same entity (e.g., Retail says
"customer satisfied" while Operations says "customer dissatisfied"), the Arbiter resolves
which inference stands using a combination of intent-conditional authority and confidence scoring.

### Intent-Conditional Authority Table

This table is owned by the Context Stewardship Council. Lower number = higher authority.

```python
INTENT_AUTHORITY = {
    #                        fraud  risk  retail  mortgage  operations  collections  commercial
    "TRANSACTION_AUTH":    [   1,    2,     4,       5,          3,          6,           7   ],
    "ACCOUNT_VERIFICATION":[   1,    2,     3,       5,          4,          6,           7   ],
    "FRAUD_REVIEW":        [   1,    2,     4,       6,          3,          5,           7   ],
    "OVERDRAFT_ENQUIRY":   [   2,    3,     1,       5,          4,          6,           7   ],
    "MORTGAGE_REVIEW":     [   3,    2,     4,       1,          5,          6,           7   ],
    "COMPLAINT_RESOLUTION":[   4,    3,     2,       5,          1,          6,           7   ],
    "COLLECTIONS_CONTACT": [   3,    2,     4,       5,          3,          1,           7   ],
    "COMMERCIAL_LENDING":  [   2,    1,     5,       6,          4,          7,           3   ],
    "_default":            [   2,    1,     3,       5,          4,          6,           7   ],
}

DOMAIN_INDEX = {
    "fraud": 0, "risk": 1, "retail": 2, "mortgage": 3,
    "operations": 4, "collections": 5, "commercial": 6
}
```

### Resolution Algorithm

```python
class ConflictArbiter:

    CONFIDENCE_THRESHOLD = 0.15  # new inference must beat existing by this margin to supersede

    def resolve(self, existing: Inference, challenger: Inference,
                active_intent: str) -> ConflictResolution:

        # Step 1: Are they actually conflicting?
        if not self._are_conflicting(existing, challenger):
            return ConflictResolution.BOTH_VALID

        # Step 2: Get authority ranks for active intent
        intent_ranks = INTENT_AUTHORITY.get(active_intent, INTENT_AUTHORITY["_default"])
        existing_rank = intent_ranks[DOMAIN_INDEX[existing.produced_by_domain]]
        challenger_rank = intent_ranks[DOMAIN_INDEX[challenger.produced_by_domain]]

        # Step 3: Clear authority winner
        if challenger_rank < existing_rank:   # lower = higher authority
            # Challenger domain has higher authority — supersede
            return ConflictResolution.SUPERSEDE(existing, challenger,
                reason=f"{challenger.produced_by_domain} outranks {existing.produced_by_domain} "
                       f"for intent {active_intent}")

        if existing_rank < challenger_rank:
            # Existing domain has higher authority — reject challenger
            return ConflictResolution.REJECT(challenger,
                reason=f"{existing.produced_by_domain} outranks {challenger.produced_by_domain} "
                       f"for intent {active_intent}")

        # Step 4: Same authority rank — confidence decides
        confidence_gap = challenger.confidence - existing.confidence

        if confidence_gap > self.CONFIDENCE_THRESHOLD:
            return ConflictResolution.SUPERSEDE(existing, challenger,
                reason=f"Higher confidence: {challenger.confidence:.2f} vs {existing.confidence:.2f}")

        if confidence_gap < -self.CONFIDENCE_THRESHOLD:
            return ConflictResolution.REJECT(challenger,
                reason=f"Lower confidence: {challenger.confidence:.2f} vs {existing.confidence:.2f}")

        # Step 5: Too close to call — flag both as contested
        # Contested inferences appear in the context window with explicit uncertainty
        # "Context is conflicted on this point — treat with caution"
        existing.is_contested = True
        challenger.is_contested = True
        return ConflictResolution.CONTEST(existing, challenger,
            reason="Equal authority, similar confidence — human review or accept uncertainty")

    def _are_conflicting(self, a: Inference, b: Inference) -> bool:
        """Two inferences conflict if they assert contradictory values of the same type."""
        if a.inference_type != b.inference_type:
            return False
        # Type-specific conflict detection
        conflict_detectors = {
            "customer_sentiment": lambda x, y: x["sentiment"] != y["sentiment"],
            "churn_risk": lambda x, y: abs(x.get("level", 0) - y.get("level", 0)) > 1,
            "financial_stress": lambda x, y: x.get("level") != y.get("level"),
        }
        detector = conflict_detectors.get(a.inference_type,
                                           lambda x, y: x != y)  # default: any difference
        return detector(a.inference_value, b.inference_value)
```

---

## Component 9: Governance Operating Model

### The Three Roles

The technology works only if three human roles exist and are funded. These are not
optional governance overhead — they are load-bearing architectural components.

**Context Steward** (one per domain, part-time):
- Owns the signal schemas for their domain
- Reviews and approves contract changes
- Defines inference templates for their domain
- Monitors signal quality dashboard
- Attends fortnightly Stewardship Council

**Context Platform Engineer** (2-3 people, central):
- Operates the Context Fabric infrastructure
- Manages schema registry and version lifecycle
- Runs the agent onboarding checklist process
- Builds and maintains the governance dashboard
- Handles escalated conflict arbiter failures

**Context Quality Analyst** (1-2 people, central):
- Measures narrative relevance and agent outcome correlation
- Identifies signals with low predictive value (candidates for deprecation)
- Investigates context poisoning incidents
- Reports to Stewardship Council on context health

### Agent Onboarding Process

A new agent cannot participate in the Context Fabric without completing this checklist.
No exceptions — the Contract Registry enforces it at runtime.

```
Phase 1: Contract Definition (2-4 days)
□ Agent team drafts contract YAML (produces, consumes, vocabulary_mappings)
□ Define signal schemas for all produced signal types
□ Submit to Contract Registry for validation (automated schema check)
□ Context Steward for domain reviews and approves
□ Stewardship Council approves consumption declarations (privacy review)

Phase 2: Integration (3-5 days)
□ Deploy context sidecar alongside agent in non-production
□ Entity ID translation working: confirm domain local IDs resolve to entity_ids
□ Signal write test: write test signal, confirm appears in Signal Store
□ Signal routing test: confirm test signal reaches declared consumers
□ Context read test: request ContextWindow for test entity, confirm narrative returned
□ Streaming test: confirm ContextDelta received when new signal published for entity

Phase 3: Quality Gate (1 week in staging)
□ Signal quality: confidence scores in declared range (spot check 50 signals)
□ PII check: confirm no raw PII in signal content fields
□ Sensitivity class: confirm signals classified at correct level
□ Latency: GetContext P99 < 150ms in staging load test
□ Cache behaviour: confirm warm cache hit on repeated GetContext for same entity

Phase 4: Production Approval
□ Stewardship Council sign-off
□ Runbook for: signal schema rollback, sidecar restart, context read failure
□ Alerting: signal volume drop, confidence average drop, latency spike
□ Go-live with shadow mode (agent reads context but doesn't act on it for 1 week)
□ Shadow mode exit: compare decisions with/without context guidance, confirm uplift
```

### Context Health Dashboard

Metrics the platform team monitors in real-time:

```python
HEALTH_METRICS = {
    # Signal health
    "signal_volume_per_domain_per_hour":  "alert if drops > 30% vs 7d avg",
    "signal_confidence_p25":              "alert if drops below 0.60",
    "signal_validation_failure_rate":     "alert if > 1% of published signals fail schema",
    "signal_dispute_rate":                "alert if > 5% of signals disputed within 24h",

    # Assembly health
    "context_assembly_latency_p50_ms":    "target < 80ms",
    "context_assembly_latency_p99_ms":    "alert if > 200ms",
    "narrative_cache_hit_rate":           "target > 60% — if lower, pre-assembly needs tuning",
    "assembly_confidence_p25":            "alert if drops below 0.65",

    # Inference health
    "inference_generation_rate":          "inferences generated per 1000 signals",
    "inference_contest_rate":             "% of inferences that are contested — alert if > 10%",
    "inference_supersede_latency_hours":  "how quickly stale inferences get replaced",

    # Entity graph health
    "entity_resolution_confidence_p10":   "alert if drops below 0.80",
    "provisional_entity_queue_depth":     "alert if > 500 unresolved provisionals",

    # Outcome correlation (weekly batch)
    "signal_to_outcome_lift":             "% improvement in decision outcomes vs no-context baseline",
}
```

---

## Implementation Sequence

Build in this order. Each phase is independently valuable.

```
PHASE 1 — Foundation (6 weeks)
  Week 1-2: Entity Identity Graph
    - Entity and entity_domain_ids tables
    - Resolution service with probabilistic matching
    - ResolveEntityId API
    - Integration with two pilot domains (e.g., Retail + Fraud)

  Week 3-4: Signal Bus + Signal Store
    - Signal schema definition
    - Signal Store (append-only write, query by entity)
    - Bus publish/subscribe skeleton (start with Pub/Sub)
    - Two test signal types, two producers, two consumers

  Week 5-6: Context Sidecar v1
    - GetContext (reads from Signal Store directly, no Assembler yet)
    - WriteSignal (validates schema, writes to store, publishes to bus)
    - Deploy alongside Retail Agent and Fraud Agent in non-production

PHASE 2 — Intelligence (6 weeks)
  Week 7-8: Contract Registry
    - Contract schema definition
    - Retail Agent and Fraud Agent register contracts
    - Runtime enforcement on sidecar
    - Schema validation pipeline

  Week 9-10: Context Assembler
    - Assembly algorithm with temporal decay
    - Relevance weighting from contracts
    - Warm cache
    - Replace Phase 1's direct Signal Store reads

  Week 11-12: Synthesis Engine (reactive)
    - Narrative generation prompt
    - Integration with Vertex AI
    - Narrative quality evaluation with domain SMEs

PHASE 3 — Full Context Engineering (8 weeks)
  Week 13-14: Inference Store + Proactive Synthesis
    - Inference templates (financial_stress, churn_risk, fraud_victim)
    - Background inference generation loop
    - Inference visible in ContextWindow

  Week 15-16: Conflict Arbiter
    - Intent authority table (Stewardship Council workshop to define ranks)
    - Arbiter deployed, resolving live conflicts in staging

  Week 17-18: Decision Store + Audit Trail
    - Decisions table, context snapshots
    - Every agent decision linked to snapshot
    - GDPR erasure logic for operational stores

  Week 19-20: Governance Tooling
    - Health dashboard
    - Stewardship Council tooling (schema review, signal quality reports)
    - Full agent onboarding process documented and tested with third domain
```

---

## The Three Things Most Teams Get Wrong

**1. Starting with the technology, not the identity graph.**
Without entity resolution, context sharing is contextless data sharing. The first
six weeks must produce a working identity graph. Everything else depends on it.

**2. Treating the Contract Registry as documentation, not enforcement.**
If agents can write signals outside their declared types, the fabric degrades.
The sidecar must reject invalid signals at runtime — not log a warning, reject them.

**3. Underestimating the vocabulary problem.**
"Distress" in Fraud means account takeover victim. "Distress" in Retail means
upset customer. If you propagate signals without vocabulary mapping, agents
misinterpret each other's context and the system actively causes harm.
The vocabulary mapping section of each contract is not optional.
