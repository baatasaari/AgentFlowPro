/**
 * M06 Synthesis Engine — PromptBuilder
 *
 * Constructs structured LLM prompts from an AssembledPackage.
 * Produces both a system prompt (role + constraints) and a user prompt
 * (structured context data + synthesis request).
 *
 * Design principles:
 *   - Deterministic: same input produces same prompt (enables unit testing)
 *   - Token-efficient: only top signals included (configurable, default 15)
 *   - Banking-safe: always includes regulatory constraint reminder
 *   - Domain-aware: system prompt adapts to the requesting agent's domain
 */

import type { SignalDomain } from '../core/types.js';
import type { AssembledPackage, WeightedSignal } from '../m05-context-assembler/ContextAssemblerService.js';
import type { DbInference, DbDecision } from '../m03-context-store/schema.js';

// ── Domain context descriptors ────────────────────────────────────────────────

const DOMAIN_DESCRIPTORS: Record<SignalDomain, string> = {
  RETAIL:      'Retail Banking — personal current accounts, savings, overdrafts, and everyday money management',
  FRAUD:       'Fraud Prevention — real-time fraud detection, dispute management, and account protection',
  RISK:        'Credit Risk — lending decisions, credit assessment, and portfolio risk management',
  MORTGAGE:    'Mortgage & Home Finance — home purchase, remortgage, and product transfer journeys',
  OPERATIONS:  'Operations — back-office processing, complaints, and operational incident management',
  COLLECTIONS: 'Collections & Recoveries — arrears management, hardship support, and debt resolution',
  COMMERCIAL:  'Commercial Banking — business accounts, SME lending, and treasury services',
  SHARED:      'Enterprise Shared Services — cross-domain capability used by multiple business lines',
};

// ── PromptBuilder ─────────────────────────────────────────────────────────────

/**
 * Constructs structured LLM prompts from an AssembledPackage.
 * Stateless and deterministic — same inputs always produce the same output.
 */
export class PromptBuilder {

  // ── System prompt ─────────────────────────────────────────────────────────

  /**
   * Builds a system prompt that establishes the LLM as a context synthesis
   * specialist operating within LBG's regulated environment.
   *
   * @param agentId  The ID of the requesting agent (used for attribution).
   * @param domain   The domain the agent operates in; shapes domain context.
   */
  buildSystemPrompt(agentId: string, domain: SignalDomain): string {
    const domainDesc = DOMAIN_DESCRIPTORS[domain] ?? `${domain} domain`;

    return `You are a context synthesis specialist operating within Lloyds Banking Group (LBG), \
one of the UK's largest financial services groups. Your role is to synthesise structured customer \
context data into clear, concise, actionable prose narratives for internal banking agents.

DOMAIN CONTEXT
You are synthesising context on behalf of the requesting agent '${agentId}', which operates in \
the ${domainDesc} business area. Tailor your synthesis to be most relevant to this domain's \
priorities, language, and customer outcomes.

REGULATORY AND COMPLIANCE CONSTRAINTS
You must adhere strictly to the following constraints in every response:

1. FCA / PRA COMPLIANCE: This system operates under FCA (Financial Conduct Authority) and PRA \
(Prudential Regulation Authority) rules. Do not generate content that could constitute regulated \
financial advice. Describe facts and observed context; do not prescribe specific financial products, \
interest rates, or investment recommendations.

2. VULNERABLE CUSTOMER DUTY: Under the FCA Consumer Duty (PS22/9) and Guidance FG21/1, you must \
flag indicators of customer vulnerability wherever they appear in the context. Use the phrase \
"Vulnerability indicator:" to surface these clearly so the agent can apply appropriate treatment.

3. FACTUAL GROUNDING: Your narrative must be grounded solely in the structured signals, inferences, \
and decisions provided to you. Do not hallucinate, infer, or speculate beyond what the data \
supports. If the context is sparse, say so explicitly.

4. DATA MINIMISATION: Do not reproduce raw personal data verbatim. Describe patterns and \
conclusions, not individual data points.

5. INTERNAL USE ONLY: This synthesis is strictly for internal LBG agent use. It must not be shared \
with customers verbatim or used as the basis for automated decisions without human review.

OUTPUT FORMAT
Provide a synthesis of 2–3 paragraphs. Be concise, factual, and professional. Write in the \
third person (e.g. "The customer…"). Prioritise what is most actionable right now for the \
requesting agent.`.trim();
  }

  // ── User prompt ───────────────────────────────────────────────────────────

  /**
   * Formats an AssembledPackage into a structured user prompt ready for the LLM.
   *
   * @param pkg        The assembled context package from M05.
   * @param maxSignals Maximum number of signals to include (default 15).
   */
  buildUserPrompt(pkg: AssembledPackage, maxSignals = 15): string {
    const lines: string[] = [];

    // Header
    lines.push(`=== Customer Context for Entity: ${pkg.entityId} ===`);
    lines.push(`Requesting Agent  : ${pkg.requestingAgentId}`);
    lines.push(`Assembled At      : ${pkg.assembledAt.toISOString()}`);
    lines.push('');

    // Stats summary
    lines.push('--- CONTEXT SUMMARY ---');
    lines.push(`Total Signals     : ${pkg.stats.totalSignals}`);
    lines.push(`Domains Present   : ${pkg.stats.domainsPresent.length ? pkg.stats.domainsPresent.join(', ') : 'none'}`);
    lines.push(`Avg Confidence    : ${pkg.stats.avgConfidence.toFixed(2)}`);
    lines.push(`Latest Signal At  : ${pkg.stats.latestSignalAt ? pkg.stats.latestSignalAt.toISOString() : 'n/a'}`);
    lines.push(`Oldest Signal At  : ${pkg.stats.oldestSignalAt ? pkg.stats.oldestSignalAt.toISOString() : 'n/a'}`);
    lines.push(`Top Topics        : ${pkg.stats.topTopics.length ? pkg.stats.topTopics.join(', ') : 'none'}`);
    lines.push('');

    // Signals — top N by weight (already ranked by M05, we just take a slice)
    const topSignals = [...pkg.signals]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, maxSignals);

    lines.push(`--- TOP SIGNALS (showing ${topSignals.length} of ${pkg.stats.totalSignals}) ---`);
    if (topSignals.length === 0) {
      lines.push('  (no signals available)');
    } else {
      topSignals.forEach((sig, i) => {
        const payloadStr = this._truncate(JSON.stringify(sig.payload), 200);
        const ageStr     = `${sig.ageHours.toFixed(1)}h ago`;
        lines.push(
          `[${i + 1}] topic=${sig.topic} | domain=${sig.sourceDomain} | ` +
          `confidence=${sig.confidence.toFixed(2)} | age=${ageStr} | weight=${sig.weight.toFixed(3)}`,
        );
        lines.push(`    payload: ${payloadStr}`);
      });
    }
    lines.push('');

    // Inferences
    lines.push('--- ACTIVE INFERENCES ---');
    if (pkg.inferences.length === 0) {
      lines.push('  (no active inferences)');
    } else {
      (pkg.inferences as DbInference[]).forEach((inf, i) => {
        lines.push(
          `[${i + 1}] type=${inf.inferenceType} | confidence=${inf.confidence.toFixed(2)}`,
        );
        lines.push(`    summary: ${inf.summary}`);
      });
    }
    lines.push('');

    // Decisions
    lines.push('--- RECENT DECISIONS ---');
    if (pkg.decisions.length === 0) {
      lines.push('  (no recent decisions)');
    } else {
      (pkg.decisions as DbDecision[]).forEach((dec, i) => {
        const rationaleStr = this._truncate(dec.rationale, 150);
        lines.push(
          `[${i + 1}] type=${dec.decisionType} | outcome=${dec.outcome} | agent=${dec.sourceAgentId}`,
        );
        lines.push(`    rationale: ${rationaleStr}`);
      });
    }
    lines.push('');

    // Synthesis request
    lines.push(
      'Based on the above context, provide a concise synthesis (2-3 paragraphs) for the ' +
      "requesting agent's use in this interaction. Focus on what is most actionable right now.",
    );

    return lines.join('\n');
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _truncate(str: string, maxLen: number): string {
    if (str.length <= maxLen) return str;
    return `${str.slice(0, maxLen - 3)}...`;
  }
}
