/**
 * M08 Context Sidecar — SessionRegistry
 *
 * Tracks active sessions and their associated delta queues.
 * Sessions are created when an agent starts a conversation and
 * expire after a configurable idle timeout.
 *
 * The registry also stores: the agentId, entityId, and sessionType
 * ('CONVERSATIONAL' or 'WORKFLOW') per session.
 */

import { DeltaQueue } from './DeltaQueue.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type SessionType = 'CONVERSATIONAL' | 'WORKFLOW';

export interface SessionEntry {
  sessionId:    string;
  agentId:      string;
  entityId:     string;
  sessionType:  SessionType;
  startedAt:    Date;
  lastActiveAt: Date;
  queue:        DeltaQueue;
}

// ── Service ──────────────────────────────────────────────────────────────────

export class SessionRegistry {
  private readonly idleTimeoutMs: number;
  private readonly sessions = new Map<string, SessionEntry>();

  /** @param idleTimeoutMs Session idle timeout in milliseconds. Default: 30 minutes. */
  constructor(idleTimeoutMs = 30 * 60 * 1000) {
    this.idleTimeoutMs = idleTimeoutMs;
  }

  /**
   * Register a new session.
   * Throws if a session with the same sessionId is already registered;
   * callers should either reuse the existing session or unregister it first.
   */
  register(
    sessionId:   string,
    agentId:     string,
    entityId:    string,
    sessionType: SessionType,
  ): SessionEntry {
    if (this.sessions.has(sessionId)) {
      throw new Error(
        `Session '${sessionId}' is already registered. ` +
        'Unregister the existing session before creating a new one.',
      );
    }

    const now   = new Date();
    const entry: SessionEntry = {
      sessionId,
      agentId,
      entityId,
      sessionType,
      startedAt:    now,
      lastActiveAt: now,
      queue:        new DeltaQueue(sessionId),
    };

    this.sessions.set(sessionId, entry);
    return entry;
  }

  /** Look up a session by ID; returns undefined if not found. */
  get(sessionId: string): SessionEntry | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Update the lastActiveAt timestamp for a session.
   * Called after any interaction so idle-expiry resets correctly.
   * Silently does nothing if the session does not exist.
   */
  touch(sessionId: string): void {
    const entry = this.sessions.get(sessionId);
    if (entry) {
      entry.lastActiveAt = new Date();
    }
  }

  /** Remove a session from the registry immediately (e.g. on explicit agent disconnect). */
  unregister(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /** Return all currently registered sessions. */
  listActive(): SessionEntry[] {
    return [...this.sessions.values()];
  }

  /**
   * Remove sessions that have been idle longer than idleTimeoutMs.
   * @returns The number of sessions that were purged.
   */
  purgeExpired(): number {
    const cutoff = Date.now() - this.idleTimeoutMs;
    let removed  = 0;

    for (const [sessionId, entry] of this.sessions) {
      if (entry.lastActiveAt.getTime() < cutoff) {
        this.sessions.delete(sessionId);
        removed++;
      }
    }

    return removed;
  }

  /** Number of registered sessions. */
  size(): number {
    return this.sessions.size;
  }
}
