/**
 * Context Fabric Platform — EventEmitterBroker Adapter
 *
 * Default ISignalBroker implementation using Node.js EventEmitter.
 * Delivers signals synchronously within the same process.
 *
 * Limitations (replace with KafkaBroker / PubSubBroker in production):
 *   - No persistence: signals are lost on restart
 *   - No cross-process delivery
 *   - No dead-letter queue
 *   - No at-least-once guarantee
 *
 * Topic routing supports AMQP-style wildcards:
 *   *   matches exactly one dot-delimited segment
 *   #   matches zero or more segments
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import type { ISignalBroker, SignalHandler, BrokerSubscription, BrokerStats } from '../ports/ISignalBroker.js';
import type { Signal } from '../core/types.js';

interface Subscription {
  subscriptionId: string;
  topicPattern: string;
  agentId: string;
  handler: SignalHandler;
  regex: RegExp;
  createdAt: Date;
}

export class EventEmitterBroker implements ISignalBroker {
  private readonly emitter = new EventEmitter();
  private readonly subscriptions = new Map<string, Subscription>();
  private stats_published  = 0;
  private stats_delivered  = 0;
  private stats_failed     = 0;

  constructor() {
    // Allow many subscriptions (one per domain agent) without hitting the
    // default Node.js warning threshold of 10.
    this.emitter.setMaxListeners(256);
  }

  async publish(signal: Signal): Promise<void> {
    this.stats_published++;
    const deliveries: Promise<void>[] = [];

    for (const sub of this.subscriptions.values()) {
      if (sub.regex.test(signal.topic)) {
        deliveries.push(
          sub.handler(signal)
            .then(() => { this.stats_delivered++; })
            .catch(() => { this.stats_failed++; }),
        );
      }
    }

    // For IMMEDIATE propagation, await all handlers.
    // For STANDARD / SLOW / SILENT the caller fire-and-forgets anyway.
    if (signal.propagationClass === 'IMMEDIATE') {
      await Promise.allSettled(deliveries);
    }
  }

  async subscribe(
    topicPattern: string,
    agentId: string,
    handler: SignalHandler,
  ): Promise<string> {
    const subscriptionId = randomUUID();
    const regex = topicPatternToRegex(topicPattern);
    this.subscriptions.set(subscriptionId, {
      subscriptionId,
      topicPattern,
      agentId,
      handler,
      regex,
      createdAt: new Date(),
    });
    return subscriptionId;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    this.subscriptions.delete(subscriptionId);
  }

  async listSubscriptions(agentId: string): Promise<BrokerSubscription[]> {
    return Array.from(this.subscriptions.values())
      .filter(s => s.agentId === agentId)
      .map(s => ({
        subscriptionId: s.subscriptionId,
        topic: s.topicPattern,
        agentId: s.agentId,
        createdAt: s.createdAt,
      }));
  }

  async stats(): Promise<BrokerStats> {
    return {
      published:          this.stats_published,
      delivered:          this.stats_delivered,
      failed:             this.stats_failed,
      activeSubscriptions: this.subscriptions.size,
    };
  }

  async close(): Promise<void> {
    this.subscriptions.clear();
    this.emitter.removeAllListeners();
  }
}

/**
 * Convert an AMQP-style topic pattern to a RegExp.
 *
 * "customer.*"         → /^customer\.[^.]+$/          (one extra segment)
 * "customer.#"         → /^customer(\..+)?$/           (zero or more extra segments)
 * "fraud.alert.raised" → /^fraud\.alert\.raised$/      (exact)
 * "*.alert.#"          → /^[^.]+\.alert(\..+)?$/
 *
 * Key insight: `#` is handled specially — when reached, we stop joining
 * segments and instead append `(\..+)?` to the prefix built so far,
 * rather than including the joiner `.` twice.
 */
function topicPatternToRegex(pattern: string): RegExp {
  const parts = pattern.split('.');

  if (parts.length === 1 && parts[0] === '#') {
    return /^.*$/; // bare # matches everything
  }

  const segments: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i];

    if (seg === '#') {
      // # matches zero or more additional .segment pairs.
      // The prefix (segments joined so far) is already built; we append (\..+)?
      // to handle "zero or more further segments" after the last separator.
      const prefix = segments.join('\\.');
      return new RegExp(`^${prefix}(\\..*)?$`);
    }

    segments.push(
      seg === '*'
        ? '[^.]+' // * matches exactly one non-empty segment (no dots)
        : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    );
  }

  return new RegExp(`^${segments.join('\\.')}$`);
}
