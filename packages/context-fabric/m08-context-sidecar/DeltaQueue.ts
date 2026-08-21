/**
 * M08 Context Sidecar — DeltaQueue
 *
 * In-memory buffer of signals that arrived between agent turns.
 * One DeltaQueue per active session.
 *
 * At turn-boundary: caller drains the queue, gets the full delta set,
 * queue resets to empty.
 *
 * Thread-safety: Node.js is single-threaded so no locking needed,
 * but we cap the buffer at maxSize to prevent OOM on high-frequency sessions.
 * When the cap is hit, oldest entries are dropped (newest signals win).
 */

import type { Signal } from '../core/types.js';

export class DeltaQueue {
  readonly sessionId: string;
  private readonly maxSize: number;
  private buffer: Signal[] = [];

  constructor(sessionId: string, maxSize = 500) {
    this.sessionId = sessionId;
    this.maxSize   = maxSize;
  }

  /**
   * Append a signal to the buffer.
   * If the buffer is already at maxSize, the oldest signal is evicted
   * to make room for the new one (newest signals win).
   */
  push(signal: Signal): void {
    if (this.buffer.length >= this.maxSize) {
      this.buffer.shift();
    }
    this.buffer.push(signal);
  }

  /**
   * Return a copy of every buffered signal and reset the queue.
   * This is the turn-boundary flush operation.
   */
  drain(): Signal[] {
    const snapshot = [...this.buffer];
    this.buffer = [];
    return snapshot;
  }

  /**
   * Return a copy of the current buffer without clearing it.
   * Useful for observability / health checks.
   */
  peek(): Signal[] {
    return [...this.buffer];
  }

  /** Number of signals currently in the buffer. */
  size(): number {
    return this.buffer.length;
  }
}
