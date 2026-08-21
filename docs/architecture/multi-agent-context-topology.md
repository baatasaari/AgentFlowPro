# Multi-Agent Context Topology

> **Companion to:** `enterprise-context-fabric.md`  
> **Answers the question:** How does context actually flow across a topology of domain
> orchestrators, their sub-agents, and between domains — when agents of fundamentally
> different types are all updating context dynamically at the same time?

---

## The Topology This Architecture Must Handle

Each domain has a lead **Orchestrator Agent** that owns domain reasoning and coordinates
its sub-agents. Sub-agents are not all the same — they have different lifecycles, different
relationships with context, and different rates of context change.

```
                        ┌─────────────────────────────┐
                        │     CONTEXT FABRIC PLANE     │
                        │  (Signal Bus, Assembler,      │
                        │   Identity Graph, Stores)     │
                        └──────────────┬───────────────┘
                                       │
          ┌────────────────────────────┼────────────────────────────┐
          │                            │                            │
┌─────────▼──────────┐    ┌────────────▼───────────┐   ┌──────────▼─────────┐
│  RETAIL DOMAIN     │    │   FRAUD DOMAIN          │   │  RISK DOMAIN       │
│                    │    │                         │   │                    │
│  Orchestrator      │    │  Orchestrator           │   │  Orchestrator      │
│  (Lead Agent)      │    │  (Lead Agent)           │   │  (Lead Agent)      │
│       │            │    │       │                 │   │       │            │
│  ┌────┴───────┐    │    │  ┌────┴────────┐        │   │  ┌────┴────────┐   │
│  │Convo  Wflow│    │    │  │Convo  Wflow │        │   │  │Wflow  Tool  │   │
│  │Agent  Agent│    │    │  │Agent  Agent │        │   │  │Agent  Agent │   │
│  │       │    │    │    │  │       │     │        │   │  │       │     │   │
│  │  Tool RAG  │    │    │  │  Tool │     │        │   │  │  RAG  │     │   │
│  │  Agent Agt │    │    │  │  Agent│     │        │   │  │  Agt  │     │   │
│  └────────────┘    │    │  └───────┴─────┘        │   │  └───────┴─────┘   │
│  Domain Context    │    │  Domain Context         │   │  Domain Context    │
│  Buffer            │    │  Buffer                 │   │  Buffer            │
└────────────────────┘    └─────────────────────────┘   └────────────────────┘
        ...also: Mortgage Domain, Operations Domain, Collections Domain, Commercial Domain
```

**The central problem**: these agents update context at completely different rates and
in completely different ways. A conversational agent produces a new signal every 30 seconds.
A workflow agent runs for 20 minutes and produces five structured outputs. A tool agent
reads context but rarely writes it. A RAG agent is stateless. The architecture must handle
all of these without the fast agents flooding the slow ones, and without the slow agents
missing critical updates from the fast ones.

---

## Context Scope Hierarchy

Context does not exist at one level — it exists across a hierarchy of scopes.
Understanding which scope a piece of context belongs to determines how it propagates,
who can read it, and when it expires.

```
ENTERPRISE SCOPE
│   Visible to all orchestrators. Managed by Context Fabric.
│   Write: orchestrators only (via sidecar). Read: all agents.
│   TTL: defined per signal type.
│
├── DOMAIN SCOPE
│   │   Visible within one domain (orchestrator + its sub-agents).
│   │   Managed by the orchestrator. Not yet published to enterprise.
│   │   TTL: session or process lifetime.
│   │
│   ├── SESSION SCOPE
│   │   │   One conversational session. Turn-by-turn accumulation.
│   │   │   Visible to: the orchestrator running this session.
│   │   │   TTL: session duration + configurable retention window.
│   │   │
│   │   └── TURN SCOPE
│   │           Single agent turn. Ephemeral.
│   │           Never propagates — orchestrator decides what to promote.
│   │           TTL: duration of the turn.
│   │
│   └── TASK SCOPE
│           One workflow run. Starts at trigger, ends at completion.
│           Visible to: the orchestrator + sub-agents in this workflow.
│           Frozen context snapshot at task start + critical update subscription.
│           TTL: workflow duration + configurable retention window.
│
└── SHARED SCOPE
        Context that has been asserted by multiple orchestrators independently.
        Elevated confidence — convergent signals from different domains.
        Managed by the Synthesis Engine.
```

### Propagation Rules Between Scopes

```
TURN → SESSION:
  When: orchestrator decides a turn produced a signal worth retaining
  Gate: orchestrator's Promotion Policy (configurable per domain)
  What moves: the orchestrator writes a session-scoped signal
  What stays: raw turn transcript, intermediate reasoning

SESSION → DOMAIN:
  When: session ends, or orchestrator hits a Promotion Checkpoint
  Gate: orchestrator reviews accumulated session signals, decides which to publish
  What moves: promoted signals written to Domain Context Buffer
  What stays: session signals that don't meet promotion threshold

DOMAIN → ENTERPRISE:
  When: orchestrator publishes from Domain Context Buffer to Signal Bus
  Gate: orchestrator's publication policy (confidence threshold, signal type rules)
  What moves: signals above publication threshold
  What stays: domain-internal signals (e.g., intermediate reasoning, tool call logs)

ENTERPRISE → DOMAIN:
  When: Signal Bus delivers to consuming orchestrators (via their sidecars)
  Gate: orchestrator's contract consumption declarations
  What happens: orchestrator receives signal, decides whether to:
    (a) update its active session's context window immediately (if session active)
    (b) store in Domain Context Buffer for next session
    (c) trigger a workflow (if signal matches a workflow trigger)

TASK (workflow) → DOMAIN:
  When: workflow hits a checkpoint or completes
  Gate: orchestrator reviews workflow output signals
  What moves: structured decision signals, state change signals
  What stays: intermediate workflow steps
```

---

## Component: Active Session Registry

### What It Does

Answers: *Which orchestrators are currently active for entity X right now?*

This is load-bearing for real-time context sharing. If the Fraud Orchestrator publishes
a critical signal while the Retail Orchestrator has an active conversation with that customer,
Retail needs to receive it in the current turn — not the next session. The Active Session
Registry makes "who is active right now" a queryable fact.

### Data Model

```sql
CREATE TABLE active_sessions (
  session_id       UUID        PRIMARY KEY,
  entity_id        UUID        NOT NULL,
  orchestrator     VARCHAR(64) NOT NULL,  -- 'retail', 'fraud', 'mortgage', etc.
  session_type     VARCHAR(32) NOT NULL,  -- CONVERSATIONAL | WORKFLOW | MONITORING
  intent           VARCHAR(64),           -- declared intent (may update mid-session)
  state            VARCHAR(32) NOT NULL,  -- ACTIVE | PAUSED | AWAITING_INPUT
  channel          VARCHAR(32),           -- VOICE | CHAT | BRANCH | DIGITAL | BACKGROUND
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at       TIMESTAMPTZ NOT NULL,  -- auto-expire stale sessions
  metadata         JSONB                  -- orchestrator-specific extra fields
);

CREATE INDEX idx_sessions_entity    ON active_sessions(entity_id, state);
CREATE INDEX idx_sessions_orch      ON active_sessions(orchestrator, entity_id);
CREATE INDEX idx_sessions_expiry    ON active_sessions(expires_at);

-- Example state at one moment:
-- entity_id=ent_abc, orchestrator=retail,   session_type=CONVERSATIONAL, state=ACTIVE
-- entity_id=ent_abc, orchestrator=fraud,    session_type=WORKFLOW,       state=ACTIVE
-- entity_id=ent_abc, orchestrator=mortgage, session_type=MONITORING,     state=PAUSED
```

### Session Registry API

```python
class ActiveSessionRegistry:

    def announce_session(self, session: SessionAnnouncement) -> Session:
        """
        Called by orchestrator sidecar at session start.
        Publishes 'session.started' signal to bus so other orchestrators can react.
        """
        session_record = self.db.insert("active_sessions", session)

        # Notify other orchestrators that are active for the same entity
        concurrent = self.get_concurrent_sessions(session.entity_id, exclude=session.orchestrator)
        if concurrent:
            self.bus.publish(Signal(
                signal_type="fabric.concurrent_session_started",
                entity_id=session.entity_id,
                content={
                    "new_session": session.session_id,
                    "new_orchestrator": session.orchestrator,
                    "new_intent": session.intent,
                    "concurrent_with": [s.orchestrator for s in concurrent]
                },
                metadata=SignalMetadata(propagation_class="IMMEDIATE", confidence=1.0)
            ))
        return session_record

    def get_concurrent_sessions(self, entity_id: str,
                                  exclude: str = None) -> list[Session]:
        """
        Who else is currently handling this entity?
        Called by orchestrators before taking significant actions.
        """
        sessions = self.db.query("""
            SELECT * FROM active_sessions
            WHERE entity_id = $1
              AND state = 'ACTIVE'
              AND expires_at > NOW()
              AND ($2 IS NULL OR orchestrator != $2)
        """, entity_id, exclude)
        return sessions

    def heartbeat(self, session_id: str):
        """Orchestrators call this every 30s to keep session alive."""
        self.db.update("active_sessions",
            where={"session_id": session_id},
            set={"last_activity_at": now(), "expires_at": now() + timedelta(minutes=5)}
        )

    def end_session(self, session_id: str, summary_signal_id: str = None):
        """
        Called at session close. Publishes session.ended signal.
        summary_signal_id: the signal containing the session summary (if published).
        """
        self.db.update("active_sessions",
            where={"session_id": session_id},
            set={"state": "ENDED", "ended_at": now()}
        )
        session = self.db.get("active_sessions", session_id)
        self.bus.publish(Signal(
            signal_type="fabric.session_ended",
            entity_id=session.entity_id,
            content={
                "session_id": session_id,
                "orchestrator": session.orchestrator,
                "duration_seconds": (now() - session.started_at).seconds,
                "summary_signal_id": summary_signal_id
            },
            metadata=SignalMetadata(propagation_class="STANDARD", confidence=1.0)
        ))
```

---

## Orchestrator Context Protocol

Every domain orchestrator must implement this protocol. It defines the contract between
the orchestrator and the Context Fabric, and between the orchestrator and its sub-agents.

```python
class OrchestratorContextProtocol(ABC):
    """
    Base protocol every domain orchestrator implements.
    The orchestrator is the context boundary for its domain.
    Sub-agents do not talk to the fabric directly.
    """

    # ─── FABRIC INTERFACE ───────────────────────────────────────────────

    def on_session_start(self, entity_id: str, intent: str,
                          session_type: str, channel: str) -> Session:
        """
        Called when orchestrator begins handling an entity.
        Announces presence to Active Session Registry.
        Loads initial context window from Assembler.
        """
        session = self.session_registry.announce_session(SessionAnnouncement(
            entity_id=entity_id,
            orchestrator=self.domain,
            session_type=session_type,
            intent=intent,
            channel=channel
        ))
        self.domain_context = self.sidecar.GetContext(GetContextRequest(
            entity_id=entity_id,
            agent_intent=intent,
            session_id=session.session_id,
            include_graph=True
        ))
        self.local_buffer = DomainContextBuffer(entity_id, session.session_id)
        return session

    def on_session_end(self, session: Session):
        """
        Called when orchestrator completes handling.
        Reviews local buffer, promotes signals above threshold, publishes session summary.
        """
        promoted_signals = self.local_buffer.get_promotable(
            threshold=self.promotion_policy.min_confidence
        )
        published_ids = []
        for signal in promoted_signals:
            result = self.sidecar.WriteSignal(signal)
            published_ids.append(result.signal_id)

        summary_signal_id = self._publish_session_summary(session, published_ids)
        self.session_registry.end_session(session.session_id, summary_signal_id)

    def on_context_delta_received(self, delta: ContextDelta):
        """
        Called when a new signal arrives for this entity from another domain.
        Orchestrator decides: inject into active session? trigger workflow? buffer?
        """
        if delta.is_critical:
            # Critical — interrupt and inject immediately
            self._inject_critical_update(delta)
        elif self.has_active_conversational_session():
            # Non-critical but session is live — buffer for next turn boundary
            self.local_buffer.queue_for_next_turn(delta)
        else:
            # No live session — store for next session context window
            self.local_buffer.store(delta.new_signal)

        # Check if this signal triggers any workflow
        self._evaluate_workflow_triggers(delta.new_signal)

    # ─── SUB-AGENT INTERFACE ────────────────────────────────────────────

    def get_context_for_subagent(self, sub_agent_type: str,
                                   task_description: str) -> SubAgentContext:
        """
        Called by orchestrator when routing a task to a sub-agent.
        Sub-agents never call the fabric directly — context always flows through here.
        """
        # Start with the orchestrator's current domain context window
        base_context = self.domain_context

        # Filter for relevance to this sub-agent's task
        relevant_signals = self._filter_for_subagent(
            base_context.signals, sub_agent_type, task_description
        )

        # Add any task-scoped context (task history, prior sub-agent outputs)
        task_context = self.local_buffer.get_task_context(task_description)

        return SubAgentContext(
            narrative=base_context.narrative,
            stance=base_context.stance,
            relevant_signals=relevant_signals,
            task_context=task_context,
            critical_flags=base_context.flags,
            # Sub-agents get a summary of other concurrent orchestrators
            concurrent_domains=self._get_concurrent_domain_summary()
        )

    def on_subagent_output(self, sub_agent_type: str, output: SubAgentOutput):
        """
        Sub-agents write their outputs back to the orchestrator.
        The orchestrator decides whether this crosses the domain boundary.
        Never the sub-agent's decision — always the orchestrator's.
        """
        # Write to local buffer always
        self.local_buffer.add(output.signals)

        # Evaluate promotion to enterprise fabric
        for signal in output.signals:
            if self._should_promote(signal):
                self.sidecar.WriteSignal(signal)
            elif self._should_hold(signal):
                self.local_buffer.mark_pending_promotion(signal)
            # else: stays local, domain-internal only

    # ─── ABSTRACT — DOMAIN-SPECIFIC LOGIC ──────────────────────────────

    @abstractmethod
    def _should_promote(self, signal: Signal) -> bool:
        """
        Domain-specific promotion policy.
        Example for Retail:
          - sentiment.distressed → always promote
          - product_recommendation → promote only if customer accepted
          - balance_check → never promote (internal operational signal)
        """
        pass

    @abstractmethod
    def _evaluate_workflow_triggers(self, signal: Signal):
        """
        Domain-specific workflow trigger evaluation.
        Example for Fraud:
          - risk.transaction_flagged confidence > 0.8 → trigger investigation workflow
          - fabric.session_ended (from retail) → check if session context changes risk picture
        """
        pass
```

---

## Domain Context Buffer

The Domain Context Buffer is the orchestrator's local staging area — the boundary between
what stays within the domain and what propagates to the enterprise.

```python
class DomainContextBuffer:
    """
    Local, in-memory context accumulation within one orchestrator's session/task.
    Acts as the gate between domain context and enterprise context.
    """

    def __init__(self, entity_id: str, session_id: str):
        self.entity_id = entity_id
        self.session_id = session_id
        self._session_signals: list[Signal] = []
        self._turn_queue: list[ContextDelta] = []       # deltas waiting for next turn boundary
        self._pending_promotion: list[Signal] = []       # held for orchestrator decision
        self._task_contexts: dict[str, list] = {}        # per-task accumulation

    def add(self, signals: list[Signal]):
        """Sub-agent outputs accumulate here."""
        self._session_signals.extend(signals)

    def queue_for_next_turn(self, delta: ContextDelta):
        """
        Non-critical context updates from other domains.
        Delivered at next turn boundary, not mid-turn, to preserve reasoning coherence.
        """
        self._turn_queue.append(delta)

    def flush_turn_queue(self) -> list[ContextDelta]:
        """
        Called by orchestrator at the START of each new turn (before invoking sub-agent).
        Returns pending deltas so orchestrator can update its context window.
        Clears the queue.
        """
        pending = self._turn_queue.copy()
        self._turn_queue.clear()
        return pending

    def get_promotable(self, threshold: float) -> list[Signal]:
        """At session end: which signals meet the confidence threshold for enterprise promotion?"""
        return [s for s in self._session_signals
                if s.metadata.confidence >= threshold
                and not s._promoted_already]

    def build_session_summary(self) -> dict:
        """
        Synthesises the session into a compact summary signal.
        This is what goes to the enterprise fabric as the session's contribution.
        """
        return {
            "session_signal_count": len(self._session_signals),
            "signals_promoted": sum(1 for s in self._session_signals if s._promoted_already),
            "key_signals": [s.signal_id for s in self._get_high_value_signals(top_n=5)],
            "session_duration_seconds": (now() - self._started_at).seconds
        }
```

---

## Agent Type Patterns

### Pattern A: Conversational Agent

Conversational agents are the most demanding context consumers. They run in real-time,
the customer is on the other end, and context must update dynamically within the session.

```
SESSION LIFECYCLE:

On Start:
  Orchestrator loads ContextWindow → injects narrative into system prompt
  Opens ContextDelta stream via sidecar.SubscribeContextUpdates()
  Starts session heartbeat (every 30s)
  Domain Context Buffer initialised

Each Turn:
  [Turn Start]
  1. Orchestrator calls buffer.flush_turn_queue()
     → Collects any cross-domain deltas that arrived since last turn
  2. If deltas contain critical alerts:
     → Orchestrator immediately updates system prompt / injects into next message
  3. If non-critical deltas:
     → Orchestrator updates context summary section of prompt (not the full narrative)
  
  [Turn Execution]
  4. Orchestrator routes to appropriate sub-agent with current context
  5. Sub-agent produces response and any output signals
  6. Orchestrator evaluates sub-agent outputs via on_subagent_output()
  
  [Turn End]
  7. Orchestrator decides: does anything from this turn promote immediately?
     → If customer revealed distress / complaint / unusual request → promote now
     → Otherwise → accumulate in buffer

On End:
  1. buffer.get_promotable() → review session signals for promotion
  2. Synthesise session summary signal
  3. Publish promoted signals + summary to fabric
  4. session_registry.end_session()
```

**The Turn Boundary Rule** is critical: context updates from other domains are delivered
at turn boundaries, not mid-turn. This prevents a mid-conversation interrupt from
corrupting the agent's in-flight reasoning. The delta is buffered and applied cleanly
at the start of the next turn.

**Exception**: `is_critical=true` deltas (fraud, safeguarding, AML) bypass the turn boundary.
These are delivered immediately and the orchestrator is expected to interrupt the current flow.

```python
class ConversationalOrchestrator(OrchestratorContextProtocol):

    async def run_turn(self, user_message: str, turn_number: int) -> str:

        # Step 1: Flush turn queue — apply any cross-domain updates
        pending_deltas = self.local_buffer.flush_turn_queue()
        if pending_deltas:
            self.domain_context = self._apply_deltas(self.domain_context, pending_deltas)

        # Step 2: Determine which sub-agent handles this turn
        sub_agent_type, task = self.router.route(user_message, self.domain_context)

        # Step 3: Build sub-agent context (filtered view of domain context)
        sub_context = self.get_context_for_subagent(sub_agent_type, task)

        # Step 4: Run sub-agent
        response, output_signals = await self.sub_agents[sub_agent_type].run(
            user_message=user_message,
            context=sub_context,
            task=task
        )

        # Step 5: Process outputs
        self.on_subagent_output(sub_agent_type, SubAgentOutput(signals=output_signals))

        return response

    def _inject_critical_update(self, delta: ContextDelta):
        """
        Called when is_critical=True arrives mid-conversation.
        Overrides the normal turn-boundary rule.
        """
        # Update orchestrator's internal state immediately
        self.domain_context.narrative = delta.narrative
        self.domain_context.has_critical_alerts = True
        self.domain_context.flags.append(CriticalFlag(
            text=f"CRITICAL UPDATE from {delta.new_signal.producer.domain}: "
                 f"handle with extreme caution",
            severity="CRITICAL"
        ))
        # Flag for next turn — do NOT interrupt current sub-agent mid-execution
        self.local_buffer._critical_interrupt_pending = True
```

---

### Pattern B: Workflow Agent

Workflow agents are triggered by context events and run deterministic processes.
They have a fundamentally different relationship with context:
- They need a **stable** context at the moment of trigger (not a moving target)
- They run for minutes to hours — context changes while they run
- They produce structured decision outputs
- They write checkpoints as they progress

```
WORKFLOW LIFECYCLE:

Trigger:
  1. Signal arrives (e.g., "risk.transaction_flagged" confidence=0.87)
  2. Orchestrator evaluates: does this match a workflow trigger rule?
  3. If yes: orchestrator calls workflow.start(trigger_signal)

At Start (Context Snapshot):
  4. Workflow takes a FROZEN context snapshot:
     - Requests ContextWindow from Assembler
     - Snapshot is written to Context Store (snapshot_id generated)
     - Workflow runs against this snapshot — it will NOT automatically update
  5. Workflow subscribes to CRITICAL updates only (propagation_class=IMMEDIATE)
     - Normal/standard updates are ignored while workflow runs

During Run:
  6. Workflow executes steps, calling sub-agents with:
     - The frozen snapshot as base context
     - Any CRITICAL updates received since start (appended, not merged)
  7. At each CHECKPOINT:
     - Workflow writes intermediate signal to Domain Context Buffer
     - If checkpoint result changes the risk picture significantly:
       → Orchestrator may promote intermediate signal to enterprise immediately
       → Example: workflow determines "account definitely compromised" at step 3 of 8
                  → Don't wait until completion — publish now

On Completion:
  8. Workflow writes final decision signal(s) to orchestrator
  9. Orchestrator promotes decision signals to enterprise fabric
  10. Workflow context snapshot ID is linked to decision record (audit trail)

On Critical Interrupt (rare):
  If a CRITICAL signal arrives mid-workflow that fundamentally changes the picture:
  - Workflow pauses
  - Orchestrator evaluates: abort? incorporate? continue?
  - If abort: write "workflow_aborted" signal with reason
  - If incorporate: re-snapshot context, restart workflow (rare — usually avoid)
  - If continue: append critical signal to workflow's context notes, continue
```

```python
class WorkflowOrchestrator(OrchestratorContextProtocol):

    def start_workflow(self, workflow_type: str,
                        trigger_signal: Signal) -> WorkflowRun:

        # Take frozen context snapshot — this is the workflow's view of the world
        context_snapshot = self.sidecar.GetContext(GetContextRequest(
            entity_id=trigger_signal.entity_id,
            agent_intent=workflow_type,
            include_graph=True
        ))
        snapshot_id = context_snapshot.snapshot_id

        # Create workflow run record
        run = WorkflowRun(
            workflow_type=workflow_type,
            entity_id=trigger_signal.entity_id,
            trigger_signal_id=trigger_signal.signal_id,
            context_snapshot_id=snapshot_id,
            state="RUNNING"
        )

        # Subscribe ONLY to critical updates during this run
        critical_updates: list[ContextDelta] = []
        def on_critical_delta(delta: ContextDelta):
            if delta.is_critical:
                critical_updates.append(delta)
                self._evaluate_critical_interrupt(run, delta)

        self.sidecar.SubscribeContextUpdates(
            SubscribeRequest(
                entity_id=trigger_signal.entity_id,
                critical_only=True  # filter: only IMMEDIATE propagation class signals
            ),
            callback=on_critical_delta
        )

        # Run the workflow asynchronously
        asyncio.create_task(self._run_workflow(run, context_snapshot, critical_updates))
        return run

    async def _run_workflow(self, run: WorkflowRun,
                              base_context: ContextWindow,
                              critical_updates: list[ContextDelta]):

        steps = self.workflow_definitions[run.workflow_type]

        for step in steps:
            # Build step context: frozen base + any critical updates received so far
            step_context = self._merge_critical_updates(base_context, critical_updates)

            # Run this step's sub-agent
            step_output = await self.sub_agents[step.agent_type].run(
                context=step_context,
                task=step.task_description,
                inputs=step.inputs
            )

            # Checkpoint: should this intermediate result propagate now?
            if step_output.confidence > 0.85 and step.is_checkpoint:
                checkpoint_signal = Signal(
                    signal_type=f"{self.domain}.workflow_checkpoint",
                    entity_id=run.entity_id,
                    content={
                        "workflow_type": run.workflow_type,
                        "step": step.name,
                        "finding": step_output.key_finding,
                        "confidence": step_output.confidence
                    },
                    metadata=SignalMetadata(
                        confidence=step_output.confidence,
                        propagation_class="IMMEDIATE" if step_output.confidence > 0.90
                                          else "STANDARD"
                    )
                )
                self.sidecar.WriteSignal(checkpoint_signal)

        # Completion
        completion_signals = self._build_completion_signals(run, step_outputs)
        for signal in completion_signals:
            self.sidecar.WriteSignal(signal)

        run.state = "COMPLETED"
        run.context_snapshot_id = base_context.snapshot_id  # links decision to what agent knew
```

---

### Pattern C: Tool Agent

Tool agents are called by orchestrators to execute specific capabilities (look up a record,
call a downstream API, run a calculation). They are predominantly context consumers, not producers.

```python
class ToolAgentContextPattern:
    """
    Tool agents get a narrow, task-scoped context slice.
    They rarely produce enterprise-grade signals — their outputs flow back to the orchestrator.
    """

    def execute(self, tool_name: str, params: dict,
                 context: SubAgentContext) -> ToolOutput:
        """
        Tool agents receive SubAgentContext from the orchestrator.
        They do not call the fabric sidecar directly.
        Outputs go back to orchestrator for promotion decision.
        """
        # Tool agents use context to:
        # 1. Understand the purpose of the call (avoids blind execution)
        # 2. Apply sensitivity-appropriate handling (e.g., don't log PII to debug logs)
        # 3. Return outputs with context-appropriate confidence

        result = self.tool_registry.call(tool_name, params)

        # Tool agents produce factual signals — high confidence, narrow scope
        output_signal = Signal(
            signal_type=f"tool.{tool_name}_result",
            entity_id=context.entity_id,
            content={"tool": tool_name, "result": result},
            metadata=SignalMetadata(
                confidence=1.0,  # tool results are facts, not inferences
                sensitivity_class=self._classify_result_sensitivity(result),
                ttl_seconds=300   # tool results expire quickly — facts change
            )
        )

        return ToolOutput(result=result, signal=output_signal)
        # Orchestrator decides: does this tool result promote to enterprise?
        # Usually: no. Tool results are operational, not contextual.
        # Exception: a tool result that reveals new entity information (e.g., address change)
```

---

### Pattern D: RAG (Retrieval) Agent

RAG agents query knowledge corpora and return grounding context. They are pure consumers
of enterprise knowledge — they do not write signals. The context they retrieve (policies,
product specs, regulations) flows to their orchestrator as tool output.

```python
class RAGAgentContextPattern:
    """
    RAG agents are stateless knowledge retrievers.
    They do NOT interact with the entity context fabric at all.
    They serve a different knowledge plane: institutional knowledge, not customer context.
    """

    def retrieve(self, query: str, corpus: str) -> RAGOutput:
        # Queries the enterprise knowledge corpus (policies, products, regs)
        # Returns grounding context for the orchestrator to inject into reasoning
        # No entity context involved — this is institutional knowledge, not customer context

        chunks = self.vector_store.search(query, corpus=corpus, top_k=5)
        return RAGOutput(
            chunks=chunks,
            source_documents=[c.document_id for c in chunks],
            retrieval_confidence=max(c.score for c in chunks)
        )
        # Output goes to orchestrator as factual grounding material
        # Never writes to Signal Bus — institutional knowledge doesn't change per customer
```

---

## Cross-Orchestrator Context Flow

### The Four Flow Patterns

Different situations require different propagation patterns between orchestrators.
Using the wrong pattern causes either latency (treating urgent as standard) or
noise (treating routine as urgent).

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ PATTERN 1: ASYNC FABRIC PROPAGATION (standard case)                              │
│                                                                                  │
│  Retail Orchestrator                          Fraud Orchestrator                  │
│       │                                              │                           │
│  Publishes signal                           Receives signal via                  │
│  to Signal Bus ──────────────────────────► Signal Bus (STANDARD,                │
│                     ~30 seconds                 async delivery)                  │
│                                                     │                           │
│                                             Stores in Domain Buffer              │
│                                             or triggers workflow                 │
│                                                                                  │
│ Use for: sentiment signals, product interactions, non-urgent findings            │
└──────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────┐
│ PATTERN 2: IMMEDIATE PUSH (critical path)                                        │
│                                                                                  │
│  Fraud Orchestrator                           Retail Orchestrator                │
│       │                                              │                           │
│  Publishes CRITICAL ─────────────────────────► Sidecar delivers as              │
│  signal to bus          <100ms               ContextDelta(is_critical=true)     │
│  (propagation_class=                                  │                          │
│   IMMEDIATE)                                  Orchestrator _inject_critical_    │
│                                               _update() called immediately       │
│                                                                                  │
│ Use for: fraud flags, account takeover, safeguarding triggers, AML alerts        │
└──────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────┐
│ PATTERN 3: CONCURRENT SESSION COORDINATION                                        │
│                                                                                  │
│  Retail Orchestrator        Session Registry        Fraud Orchestrator           │
│  (active session)                  │               (starts investigation)        │
│       │                            │                      │                      │
│       │                            │◄── announce_session──┤                      │
│       │                            │                      │                      │
│       │◄── fabric.concurrent_      │                      │                      │
│       │    session_started ─────── │                      │                      │
│       │                                                   │                      │
│  Orchestrator updates                             Fraud knows Retail is          │
│  its context to note                              in live conversation           │
│  Fraud is now active                              → timing of actions matters    │
│                                                                                  │
│ Use for: any time multiple orchestrators become active for the same entity       │
└──────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────┐
│ PATTERN 4: ACTION DECLARATION + VETO (coordination before consequential action)  │
│                                                                                  │
│  Collections Orchestrator   Action Coordinator     Risk Orchestrator             │
│       │                            │                      │                      │
│  "I intend to issue              Register               "Risk says: financial    │
│   default notice to ──────────► action ───────────────► difficulty mitigation   │
│   entity X in 2min"            declaration              should go first"         │
│       │                            │                      │                      │
│       │◄── VETO (from Risk, ─────── │                      │                      │
│       │    within veto window)      │                      │                      │
│       │                                                                          │
│  Collections holds action.                                                       │
│  Routes to human: Risk and Collections need to coordinate.                       │
│                                                                                  │
│ Use for: irreversible or externally-visible actions (letters, calls, status      │
│          changes, fees) when another orchestrator is active for the same entity  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Action Coordinator: The Veto Protocol

```python
class ActionCoordinator:
    """
    Prevents orchestrators from taking conflicting consequential actions
    on the same entity at the same time.
    Used ONLY for irreversible or externally visible actions.
    """

    VETO_WINDOW_SECONDS = 120  # 2 minutes for concurrent orchestrators to veto

    def declare_action(self, orchestrator: str, entity_id: str,
                        action_type: str, action_detail: dict,
                        intended_at: datetime) -> ActionDeclaration:

        concurrent = self.session_registry.get_concurrent_sessions(
            entity_id, exclude=orchestrator
        )

        if not concurrent:
            # No concurrent orchestrators — action is approved immediately
            return ActionDeclaration(status="APPROVED", declaration_id=uuid4())

        # There are concurrent orchestrators — publish for veto review
        declaration = ActionDeclaration(
            declaration_id=uuid4(),
            orchestrator=orchestrator,
            entity_id=entity_id,
            action_type=action_type,
            action_detail=action_detail,
            intended_at=intended_at,
            veto_deadline=now() + timedelta(seconds=self.VETO_WINDOW_SECONDS),
            notified_orchestrators=[s.orchestrator for s in concurrent],
            status="PENDING"
        )
        self.db.insert("action_declarations", declaration)

        # Notify concurrent orchestrators via IMMEDIATE signal
        self.bus.publish(Signal(
            signal_type="fabric.action_declared",
            entity_id=entity_id,
            content={
                "declaration_id": str(declaration.declaration_id),
                "orchestrator": orchestrator,
                "action_type": action_type,
                "veto_deadline": declaration.veto_deadline.isoformat()
            },
            metadata=SignalMetadata(propagation_class="IMMEDIATE", confidence=1.0)
        ))

        return declaration

    def submit_veto(self, declaration_id: str, vetoing_orchestrator: str,
                     reason: str, authority_basis: str):
        """
        Concurrent orchestrator calls this within the veto window.
        authority_basis: which contract clause or policy justifies this veto.
        """
        declaration = self.db.get("action_declarations", declaration_id)
        if now() > declaration.veto_deadline:
            raise VetoWindowExpiredError()

        # Update declaration status
        self.db.update("action_declarations",
            where={"declaration_id": declaration_id},
            set={"status": "VETOED", "veto_by": vetoing_orchestrator,
                 "veto_reason": reason, "veto_basis": authority_basis}
        )

        # Route to human steward for resolution
        self.bus.publish(Signal(
            signal_type="fabric.action_vetoed",
            entity_id=declaration.entity_id,
            content={
                "declaration_id": declaration_id,
                "action_orchestrator": declaration.orchestrator,
                "veto_orchestrator": vetoing_orchestrator,
                "reason": reason,
                "requires_human_resolution": True
            },
            metadata=SignalMetadata(propagation_class="IMMEDIATE", confidence=1.0)
        ))
```

---

## Context Handoff Protocol

When a customer's interaction moves from one domain to another (e.g., Retail → Mortgage
after a customer expresses home buying interest), context must travel with them cleanly.

```
HANDOFF LIFECYCLE:

Initiating Orchestrator (e.g., Retail):
  1. Detects handoff condition (routing intent, customer request, or workflow signal)
  2. Builds a Handoff Package:
     - The current ContextWindow (assembled at this moment)
     - A handoff summary: "what happened in this session and why we're transferring"
     - Any domain-specific context the receiving domain needs (not in enterprise fabric)
     - Recommended stance for receiving agent
  3. Publishes handoff summary as a session-ending signal
  4. Closes session via session_registry.end_session()

Context Fabric (automatic):
  5. Session end signal triggers pre-assembly for the receiving orchestrator type
  6. Assembler pre-warms context window for likely receiving agent type + intent

Receiving Orchestrator (e.g., Mortgage):
  7. Starts new session (may happen immediately or later — e.g., scheduled callback)
  8. Receives enriched context window:
     - Enterprise signals as normal
     - PLUS the handoff summary signal from step 3
     - PLUS any signals promoted during the retail session
  9. Assembler incorporates handoff context into narrative
```

```python
@dataclass
class HandoffPackage:
    """
    Published by originating orchestrator as part of session close.
    Received by target orchestrator as part of first context assembly.
    """
    # Identity
    entity_id:              str
    from_orchestrator:      str
    to_orchestrator:        str   # 'any' if routing hasn't been determined yet

    # Context transfer
    handoff_reason:         str   # "CUSTOMER_REQUESTED_MORTGAGE" | "ESCALATION" | "DOMAIN_BOUNDARY"
    current_intent:         str   # what the customer is trying to achieve
    recommended_stance:     str   # EMPATHY_FIRST | STANDARD | CAUTION
    session_summary:        str   # 2-3 sentences: what happened, what matters

    # Key signals from this session (above promotion threshold)
    key_signal_ids:         list[str]

    # Domain-specific context NOT in enterprise fabric
    # (things too domain-specific to publish but useful for the receiver)
    supplementary_context:  dict  # e.g., {"product_discussed": "5yr fixed", "ltv_mentioned": "75%"}

    # What this orchestrator already knows the receiving orchestrator needs
    # Based on the receiving domain's contract consumption declarations
    pre_filtered_for_target: bool = True
```

---

## Dynamic Context Update Flow: End-to-End

This scenario walks through the full horizontal topology in action.

**Situation**: A customer calls Retail about their overdraft. While the conversation
is live, the Fraud Orchestrator starts an investigation triggered by an earlier signal.
The Collections Orchestrator has a scheduled workflow running for the same customer.
All three are simultaneously active.

```
T=0:00  Customer calls Retail
        ┌─────────────────────────────────────────────────────────────────┐
        │ RETAIL ORCHESTRATOR                                              │
        │ on_session_start(entity_id, intent="OVERDRAFT_ENQUIRY")         │
        │   → session_registry.announce_session()                         │
        │   → sidecar.GetContext() → narrative assembled                  │
        │     Narrative: "12yr customer, two missed DDs last month,       │
        │     mortgage application submitted 3 weeks ago. Handle with    │
        │     care — signs of financial pressure."                        │
        │   → domain_context loaded                                       │
        │   → local_buffer initialised                                    │
        └─────────────────────────────────────────────────────────────────┘

T=0:05  Retail Orchestrator routes to Conversational Sub-Agent
        Sub-Agent gets SubAgentContext (filtered view):
          narrative: [from above]
          relevant_signals: [payment_missed x2, mortgage_application_state]
          concurrent_domains: []  ← no other orchestrators yet

T=0:30  Fraud Orchestrator wakes — pattern detection triggered a workflow
        ┌─────────────────────────────────────────────────────────────────┐
        │ FRAUD ORCHESTRATOR                                               │
        │ start_workflow(workflow_type="TRANSACTION_REVIEW",              │
        │                trigger_signal=risk.transaction_flagged)         │
        │   → takes frozen context snapshot (snapshot_id=SNAP_001)       │
        │   → session_registry.announce_session()                         │
        │     → Active Session Registry: Retail + Fraud now concurrent   │
        │     → Signal Bus publishes "fabric.concurrent_session_started" │
        └─────────────────────────────────────────────────────────────────┘

        Signal "fabric.concurrent_session_started" arrives at Retail sidecar
        Retail delta: is_critical=false (concurrent session start, not critical)
        → Buffer queues for next turn boundary

T=0:45  [RETAIL TURN 2 STARTS]
        Retail Orchestrator calls buffer.flush_turn_queue()
          → Receives: concurrent_session_started (Fraud now active)
        → Updates context: adds to concurrent_domains summary
        Sub-Agent now knows: "Fraud investigation is currently running for this entity"
        → Sub-Agent adjusts: does not discuss recent transaction until fraud clears

T=1:20  Fraud Workflow hits checkpoint: "Transaction confirmed suspicious — likely fraud"
        confidence=0.91
        ┌─────────────────────────────────────────────────────────────────┐
        │ FRAUD ORCHESTRATOR                                               │
        │ Checkpoint signal: confidence 0.91 > threshold 0.85            │
        │ → Publishes immediately (doesn't wait for workflow completion)  │
        │ Signal: risk.account_suspected_compromised                      │
        │   confidence: 0.91                                              │
        │   propagation_class: IMMEDIATE  ← because confidence > 0.90   │
        └─────────────────────────────────────────────────────────────────┘

T=1:21  <100ms later:
        Signal arrives at RETAIL ORCHESTRATOR sidecar
        ContextDelta: is_critical=TRUE
        → _inject_critical_update() called IMMEDIATELY (bypasses turn boundary)
        → domain_context.flags += "CRITICAL: Account suspected compromised"
        → domain_context.stance = VERIFY_IDENTITY
        → local_buffer._critical_interrupt_pending = True

T=1:25  [RETAIL TURN 3 STARTS]
        Retail Sub-Agent receives updated context:
          stance: VERIFY_IDENTITY
          critical_flags: ["Do not discuss account details until identity confirmed",
                           "Fraud investigation active — concurrent Fraud session running",
                           "Pause overdraft discussion until fraud team clears"]
        Sub-Agent changes its approach completely — no longer discussing overdraft

T=1:40  Collections Orchestrator — scheduled workflow tries to generate default notice
        ┌─────────────────────────────────────────────────────────────────┐
        │ COLLECTIONS ORCHESTRATOR                                         │
        │ Workflow step: "issue_default_notice"                           │
        │ → Checks concurrent sessions: Retail(ACTIVE) + Fraud(ACTIVE)   │
        │ → Action type "issue_default_notice" is irreversible            │
        │ → action_coordinator.declare_action() called                    │
        │   → veto window: 2 minutes                                      │
        │   → notifies Retail + Fraud                                     │
        └─────────────────────────────────────────────────────────────────┘

        Fraud Orchestrator receives "fabric.action_declared"
        Fraud evaluates: issuing default notice while account compromise investigation
        is active is inappropriate — would alert a fraudster if they have email access
        → action_coordinator.submit_veto(reason="Active fraud investigation",
                                          basis="fraud_domain_authority_rank_1")

        Collections workflow pauses. Action routed to human steward.
        Human steward sees: "Collections needs to issue default notice,
        Fraud has vetoed due to active account compromise investigation.
        Decision required: delay notice until investigation completes?"

T=4:15  Fraud Workflow completes
        Publishes: risk.investigation_complete
          finding: "confirmed_fraud_victim"
          recommended_action: "restore_account, customer_not_liable"

        Signal propagates to Retail and Collections.

        Retail Orchestrator: updates context, changes stance to EMPATHY_FIRST
        Collections Orchestrator: receives clearance, re-evaluates default notice
          (may no longer be appropriate given confirmed fraud victim status)

T=4:20  Retail Orchestrator: session ends
        on_session_end():
          → Promotes: sentiment.distressed (customer was upset — confidence 0.88)
          → Promotes: retail.payment_missed (confirmed in conversation)
          → Does NOT promote: internal routing decisions, tool call logs
          → Publishes session summary signal
          → session_registry.end_session()
```

This scenario shows every pattern in action: concurrent session detection, turn-boundary
buffering, critical interrupt bypass, action declaration and veto, and session close
promotion. No orchestrator needed to know about the others' internal logic — all
coordination happened through the fabric protocols.

---

## Sub-Agent Context Isolation

Sub-agents must never receive more context than their task requires. Context flooding
causes both performance degradation (token bloat in LLM calls) and risk (sub-agent
reasons about signals outside its competence).

The orchestrator applies task-specific filtering before passing context to sub-agents:

```python
def _filter_for_subagent(self, signals: list[Signal],
                           sub_agent_type: str,
                           task: str) -> list[Signal]:
    """
    Each sub-agent type gets a filtered context slice.
    Defined in domain configuration — not hardcoded.
    """
    sub_agent_context_rules = {
        # Retail domain sub-agent filtering rules
        "product_recommendation_agent": {
            "allowed_signal_types": ["retail.*", "mortgage.application_state*"],
            "max_signals": 10,
            "exclude_types": ["risk.*", "operations.complaint*"]
            # Product recommender doesn't need fraud signals
        },
        "affordability_calculator_agent": {
            "allowed_signal_types": ["retail.payment_*", "retail.overdraft_*"],
            "max_signals": 5,
            "exclude_types": ["*"]  # narrow task — only financial signals
        },
        "complaint_handling_agent": {
            "allowed_signal_types": ["operations.*", "retail.sentiment*"],
            "max_signals": 20,
            "exclude_types": []  # complaint handlers need broad context
        },
        "identity_verification_agent": {
            "allowed_signal_types": ["risk.*", "fabric.concurrent_session*"],
            "max_signals": 5,
            "exclude_types": ["retail.*", "operations.*"]
            # Identity verification only needs risk signals
        }
    }

    rules = sub_agent_context_rules.get(sub_agent_type, {"max_signals": 5})
    filtered = [
        s for s in signals
        if self._matches_type_rule(s.signal_type, rules.get("allowed_signal_types", ["*"]))
        and not self._matches_type_rule(s.signal_type, rules.get("exclude_types", []))
    ]
    return filtered[:rules.get("max_signals", 10)]
```

---

## Context Accumulation and Compression

Long-running domains accumulate context at high velocity. A Retail Orchestrator handling
50 customer sessions per day for the same customer produces hundreds of signals. Without
compression, the Context Assembler would need to process thousands of signals per query.

The Synthesis Engine runs a nightly **Context Compression** job:

```python
class ContextCompressor:
    """
    Runs nightly. For each entity with > COMPRESSION_THRESHOLD signals,
    compresses historical signals into summarised inference records.
    Preserves the originals (regulatory) but reduces what the Assembler queries.
    """

    COMPRESSION_THRESHOLD = 100  # signals per entity before compression triggers
    COMPRESSION_WINDOW = "30d"   # compress signals older than this

    def compress_entity(self, entity_id: str):
        old_signals = self.signal_store.query(
            entity_ids=[entity_id],
            older_than=parse_duration(self.COMPRESSION_WINDOW)
        )

        if len(old_signals) < self.COMPRESSION_THRESHOLD:
            return  # nothing to do

        # Group by signal type family (e.g., all "retail.*" signals together)
        groups = self._group_by_family(old_signals)

        for family, signals in groups.items():
            # Summarise the group into a single compressed inference
            summary = self.synthesis_engine.compress(
                signals=signals,
                prompt=f"Summarise these {len(signals)} {family} signals "
                       f"from the last 30 days into 2-3 key facts about this entity's "
                       f"history in this domain. Be specific and factual."
            )

            # Write a compressed inference with a long TTL
            compressed_inference = Inference(
                entity_id=entity_id,
                inference_type=f"compressed_history.{family}",
                inference_value={"summary": summary, "source_count": len(signals),
                                 "covers_period": f"last {self.COMPRESSION_WINDOW}"},
                confidence=0.80,  # compressed history has slight confidence discount
                source_signal_ids=[s.signal_id for s in signals],
                expires_at=now() + timedelta(days=365),
                generated_by="ContextCompressor/nightly"
            )
            self.inference_store.insert(compressed_inference)

            # Mark original signals as compressed (Assembler will skip them, use inference)
            self.signal_store.mark_compressed(
                signal_ids=[s.signal_id for s in signals],
                compressed_into=compressed_inference.inference_id
            )
```

---

## What This Architecture Makes Possible

When the full topology is running, a new category of agent behaviour becomes possible:
**anticipatory context sharing**.

The Mortgage Orchestrator can ask: *"Based on what Retail, Risk, and Collections have
shared about this customer over the past 90 days, what is the probability this mortgage
application reaches completion, and what is the most likely obstacle?"*

It can ask this not because someone built a Mortgage × Retail × Risk × Collections
integration — but because the context fabric has been accumulating signals from all
four domains, and the Assembler composes them into a coherent answer on demand.

No orchestrator needed to know the others existed. No point-to-point integration was
built. The orchestrators talked to the fabric, and the fabric made them coherent.

That is what the horizontal architecture delivers.
