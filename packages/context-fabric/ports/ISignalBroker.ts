/**
 * Context Fabric Platform — ISignalBroker Port
 *
 * This interface is the contract between the fabric's routing logic and
 * the underlying messaging infrastructure. Swap implementations without
 * touching business logic:
 *
 *   Default (Phase 1)   → EventEmitterBroker  (in-process, zero deps)
 *   GCP                 → PubSubBroker        (Google Cloud Pub/Sub)
 *   AWS                 → SqsSnseBroker       (SQS + SNS)
 *   Azure               → ServiceBusBroker    (Azure Service Bus)
 *   Self-hosted         → KafkaBroker         (Apache Kafka)
 *
 * Topic syntax: dot-separated hierarchy, e.g. "customer.vulnerability.detected"
 * Subscription patterns:
 *   "customer.*"    → matches any single segment after "customer."
 *   "customer.#"    → matches any number of segments after "customer."
 *   "fraud.alert.*" → matches "fraud.alert.raised", "fraud.alert.cleared"
 */

import type { Signal } from '../core/types.js';

export type SignalHandler = (signal: Signal) => Promise<void>;

export interface BrokerSubscription {
  subscriptionId: string;
  topic: string;
  agentId: string;
  createdAt: Date;
}

export interface BrokerStats {
  published: number;
  delivered: number;
  failed: number;
  activeSubscriptions: number;
}

export interface ISignalBroker {
  /**
   * Publish a signal. The broker routes it to all matching subscribers.
   * Returns once the signal has been accepted for delivery.
   * Does NOT guarantee delivery — use IMMEDIATE propagation class for
   * at-least-once semantics with retry.
   */
  publish(signal: Signal): Promise<void>;

  /**
   * Subscribe to a topic pattern.
   * @param topicPattern  Dot-separated pattern, supports * and # wildcards.
   * @param agentId       The subscribing agent's registered ID (for audit).
   * @param handler       Async callback invoked for each matching signal.
   * @returns             A subscriptionId that can be passed to unsubscribe().
   */
  subscribe(
    topicPattern: string,
    agentId: string,
    handler: SignalHandler,
  ): Promise<string>;

  /**
   * Cancel a subscription. No-op if the subscriptionId does not exist.
   */
  unsubscribe(subscriptionId: string): Promise<void>;

  /**
   * List active subscriptions for a given agent.
   */
  listSubscriptions(agentId: string): Promise<BrokerSubscription[]>;

  /**
   * Runtime delivery statistics. Useful for health checks and alerting.
   */
  stats(): Promise<BrokerStats>;

  /**
   * Drain in-flight messages and release resources.
   * Call during graceful shutdown.
   */
  close(): Promise<void>;
}
