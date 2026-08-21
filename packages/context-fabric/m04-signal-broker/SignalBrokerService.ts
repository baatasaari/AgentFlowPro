/**
 * M04 Signal Broker — SignalBrokerService
 *
 * Orchestrates signal routing from producers to subscribers.
 * Wraps the ISignalBroker port and adds:
 *   - Module enabled guard
 *   - Contract-verified subscription (agent must be registered in M18)
 *   - Propagation-class-aware routing rules
 *   - Delivery metrics exposed to M17 (Observability)
 *
 * Routing rules by PropagationClass:
 *   IMMEDIATE  → deliver synchronously to all matching subscribers; surface errors
 *   STANDARD   → fire-and-forget; batch at turn boundary (handled by each orchestrator)
 *   SLOW       → fire-and-forget; delivered in background
 *   SILENT     → no routing; signal is stored only
 *
 * Subscription management:
 *   Agents call subscribe() once on startup with their topic patterns.
 *   Subscriptions persist for the process lifetime; no DB backing in Phase 1
 *   (Phase 2 persists subscriptions to survive restarts).
 */

import type { ISignalBroker, BrokerSubscription, BrokerStats, SignalHandler } from '../ports/ISignalBroker.js';
import type { Signal, Result } from '../core/types.js';
import { ok, err } from '../core/types.js';
import { ModuleDisabledError } from '../core/errors.js';
import type { ContractRegistryService } from '../m18-contract-registry/ContractRegistryService.js';

// ── Input types ───────────────────────────────────────────────────────────────

export interface SubscribeInput {
  agentId:      string;
  topicPattern: string;
  handler:      SignalHandler;
}

// ── Service ──────────────────────────────────────────────────────────────────

export class SignalBrokerService {
  constructor(
    private readonly broker:    ISignalBroker,
    private readonly registry:  ContractRegistryService,
    private readonly enabled:   boolean,
  ) {}

  // ── Publish ───────────────────────────────────────────────────────────────

  /**
   * Route a signal to all matching subscribers.
   * Called by M01 post-persistence. The signal has already been validated
   * and contract-checked at this point.
   */
  async publish(signal: Signal): Promise<Result<void>> {
    if (!this.enabled) return err(new ModuleDisabledError('M04_SIGNAL_BROKER'));
    if (signal.propagationClass === 'SILENT') return ok(undefined);

    await this.broker.publish(signal);
    return ok(undefined);
  }

  // ── Subscribe ─────────────────────────────────────────────────────────────

  /**
   * Register a handler for a topic pattern.
   * Validates that the agent's contract permits subscription to this pattern.
   */
  async subscribe(input: SubscribeInput): Promise<Result<string>> {
    if (!this.enabled) return err(new ModuleDisabledError('M04_SIGNAL_BROKER'));

    // Verify agent contract
    const contractResult = await this.registry.findByAgentId(input.agentId);
    if (!contractResult.ok) return err(contractResult.error);

    const contract = contractResult.value;

    // Check that the requested pattern is covered by the contract's subscribe list
    const { topicMatches } = await import('../m18-contract-registry/ContractRegistryService.js');
    const permitted = contract.allowedTopicsSubscribe.some(allowed =>
      topicMatches(allowed, input.topicPattern) || topicMatches(input.topicPattern, allowed),
    );

    if (!permitted) {
      // Soft-fail: log warning but don't block the agent. Strict mode (Phase 2).
      console.warn(
        `[M04] Agent '${input.agentId}' subscribed to '${input.topicPattern}' ` +
          `which is not in its contract. Consider updating the contract.`,
      );
    }

    const subscriptionId = await this.broker.subscribe(
      input.topicPattern,
      input.agentId,
      input.handler,
    );

    return ok(subscriptionId);
  }

  // ── Unsubscribe ───────────────────────────────────────────────────────────

  async unsubscribe(subscriptionId: string): Promise<Result<void>> {
    if (!this.enabled) return err(new ModuleDisabledError('M04_SIGNAL_BROKER'));
    await this.broker.unsubscribe(subscriptionId);
    return ok(undefined);
  }

  // ── Introspection ─────────────────────────────────────────────────────────

  async listSubscriptions(agentId: string): Promise<Result<BrokerSubscription[]>> {
    if (!this.enabled) return err(new ModuleDisabledError('M04_SIGNAL_BROKER'));
    const subs = await this.broker.listSubscriptions(agentId);
    return ok(subs);
  }

  async stats(): Promise<Result<BrokerStats>> {
    if (!this.enabled) return err(new ModuleDisabledError('M04_SIGNAL_BROKER'));
    return ok(await this.broker.stats());
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async close(): Promise<void> {
    await this.broker.close();
  }
}
