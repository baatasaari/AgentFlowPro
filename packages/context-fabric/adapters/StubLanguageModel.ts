/**
 * Context Fabric Platform — StubLanguageModel Adapter
 *
 * Deterministic ILanguageModel for tests and local development.
 * Does not call any external API.
 *
 * Responses are generated from the prompt content using a simple template,
 * so tests can assert on keywords without needing real API calls.
 *
 * Activate with: CF_LLM_ADAPTER=stub
 */

import type { ILanguageModel, LlmRequest, LlmResponse } from '../ports/ILanguageModel.js';

export class StubLanguageModel implements ILanguageModel {
  private readonly model = 'stub-model-1.0';

  async complete(request: LlmRequest): Promise<LlmResponse> {
    // Build a canned response that includes keywords from the last user message
    const lastUser = [...request.messages].reverse().find(m => m.role === 'user');
    const preview  = lastUser?.content.slice(0, 120).replace(/\s+/g, ' ') ?? 'no input';

    const text =
      `[STUB SYNTHESIS] Context analysed. ` +
      `Key themes identified from ${request.messages.length} message(s). ` +
      `Input preview: "${preview}". ` +
      `Recommendation: engage customer with empathy and appropriate next steps.`;

    return {
      text,
      inputTokens:  Math.ceil(preview.length / 4),
      outputTokens: Math.ceil(text.length / 4),
      truncated:    false,
      modelUsed:    this.model,
    };
  }

  defaultModel(): string {
    return this.model;
  }

  async close(): Promise<void> {}
}
