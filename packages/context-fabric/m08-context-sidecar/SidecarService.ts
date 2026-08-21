/**
 * M08 Context Sidecar — SidecarService
 *
 * The per-agent context delivery service. Sits between the Context Assembler
 * (M05), the Synthesis Engine (M06), and the agent's LLM turns.
 *
 * Responsibilities:
 *   1. Session lifecycle: register / unregister agent sessions
 *   2. Signal delivery:
 *      a. IMMEDIATE signals → pushed to session queue immediately (bypass buffer)
 *         and optionally trigger a synthesis refresh
 *      b. STANDARD/SLOW signals → buffered in DeltaQueue until turn boundary
 *   3. Turn-boundary context flush:
 *      - Drain delta queue
 *      - Return assembled context package and optionally a narrative synthesis
 *   4. Workflow context delivery:
 *      - Deliver a frozen snapshot at workflow start
 *      - IMMEDIATE signals still pushed via bypass channel
 *
 * The sidecar does NOT subscribe to the broker itself — the caller
 * (API route handler or M04 subscriber) delivers signals via pushSignal().
 * This keeps the sidecar stateless w.r.t. broker connections.
 */

import type { Signal, Result } from '../core/types.js';
import { ok, err } from '../core/types.js';
import { ModuleDisabledError } from '../core/errors.js';
import type { ContextAssemblerService, AssembledPackage, AssemblerQuery } from '../m05-context-assembler/ContextAssemblerService.js';
import type { SynthesisService, SynthesisResult } from '../m06-synthesis-engine/SynthesisService.js';
import { SessionRegistry, type SessionEntry, type SessionType } from './SessionRegistry.js';

// ── Output types ──────────────────────────────────────────────────────────────

export interface SidecarContextPackage {
  sessionId:    string;
  entityId:     string;
  assembled:    AssembledPackage;
  synthesis?:   SynthesisResult;
  deltaSignals: Signal[];
  deliveredAt:  Date;
}

export interface SidecarStartOptions {
  sessionId:   string;
  agentId:     string;
  entityId:    string;
  sessionType: SessionType;
}

// Re-export for consumers
export type { SessionEntry, SessionType, SynthesisResult };

// ── Service ──────────────────────────────────────────────────────────────────

export class SidecarService {
  constructor(
    private readonly assembler:         ContextAssemblerService,
    private readonly synthesisService:  SynthesisService | null,
    private readonly registry:          SessionRegistry,
    private readonly enabled:           boolean,
  ) {}

  // ── Session lifecycle ─────────────────────────────────────────────────────

  /**
   * Register a new agent session.
   * Returns the created SessionEntry on success, or a ModuleDisabledError
   * when the M08 module flag is off.
   */
  startSession(opts: SidecarStartOptions): Result<SessionEntry> {
    if (!this.enabled) return err(new ModuleDisabledError('M08_CONTEXT_SIDECAR'));

    const entry = this.registry.register(
      opts.sessionId,
      opts.agentId,
      opts.entityId,
      opts.sessionType,
    );

    return ok(entry);
  }

  /** Tear down a session, discarding any buffered deltas. */
  endSession(sessionId: string): void {
    this.registry.unregister(sessionId);
  }

  // ── Signal delivery ───────────────────────────────────────────────────────

  /**
   * Deliver a signal into the session's delta queue.
   *
   * IMMEDIATE signals bypass the turn-boundary batch and are appended first so
   * they are always at the head of the next drain. Callers that need synchronous
   * side-effects on IMMEDIATE signals (e.g. triggering a synthesis refresh)
   * should do so themselves before or after calling this method.
   *
   * If the session is not found the signal is silently dropped — the agent
   * may have disconnected or the session may have been purged.
   */
  pushSignal(sessionId: string, signal: Signal): void {
    const entry = this.registry.get(sessionId);
    if (!entry) return;   // silently drop for unknown/expired sessions

    entry.queue.push(signal);
    this.registry.touch(sessionId);
  }

  // ── Turn-boundary context flush ───────────────────────────────────────────

  /**
   * Drain the delta queue, assemble context from M05, optionally synthesise
   * via M06, and return a complete SidecarContextPackage.
   *
   * This is the primary call at each agent turn boundary (conversational mode)
   * or at workflow start (workflow mode).
   *
   * @param sessionId - The session to fetch context for.
   * @param query     - Optional overrides merged into the AssemblerQuery.
   */
  async getContext(
    sessionId: string,
    query?: Partial<AssemblerQuery>,
  ): Promise<Result<SidecarContextPackage>> {
    if (!this.enabled) return err(new ModuleDisabledError('M08_CONTEXT_SIDECAR'));

    const entry = this.registry.get(sessionId);
    if (!entry) {
      return err(new Error(`Session not found: ${sessionId}`));
    }

    // Drain buffered signals before assembling so the assembler cache is
    // invalidated by any new signals that arrived since the last turn.
    const deltaSignals = entry.queue.drain();

    // Build the assembler query, merging caller overrides.
    const assemblerQuery: AssemblerQuery = {
      entityId:          entry.entityId,
      requestingAgentId: entry.agentId,
      ...query,
    };

    const assembleResult = await this.assembler.assemble(assemblerQuery);
    if (!assembleResult.ok) return err(assembleResult.error);

    const assembled = assembleResult.value;

    // Optional synthesis pass — failures are swallowed so a synthesis outage
    // never prevents the agent from receiving assembled context.
    let synthesis: SynthesisResult | undefined;
    if (this.synthesisService) {
      try {
        const synthResult = await this.synthesisService.synthesise(assembled);
        if (synthResult.ok) {
          synthesis = synthResult.value;
        }
      } catch {
        // Synthesis is a best-effort enhancement; log in prod, swallow here.
      }
    }

    this.registry.touch(sessionId);

    return ok({
      sessionId,
      entityId:    entry.entityId,
      assembled,
      synthesis,
      deltaSignals,
      deliveredAt: new Date(),
    });
  }

  // ── Maintenance ───────────────────────────────────────────────────────────

  /**
   * Remove sessions that have exceeded the idle timeout.
   * Intended to be called periodically (e.g. every 5 minutes) by a scheduler.
   * @returns Count of sessions removed.
   */
  purgeExpiredSessions(): number {
    return this.registry.purgeExpired();
  }
}
