/**
 * Context Fabric Platform — AnthropicAdapter
 *
 * ILanguageModel implementation that calls the Anthropic Messages API.
 * Used by M06 Synthesis Engine and any other module that needs LLM completion.
 *
 * Configuration:
 *   CF_ANTHROPIC_API_KEY   — Anthropic API key (required when this adapter is active)
 *   CF_ANTHROPIC_MODEL     — Model ID (default: claude-sonnet-5)
 *   CF_ANTHROPIC_BASE_URL  — Override for proxy/VPC environments
 *
 * The adapter calls the Messages API directly via fetch so no Anthropic SDK
 * dependency is needed — keeps the package footprint minimal and avoids
 * version-lock to a specific SDK.
 */

import type { ILanguageModel, LlmRequest, LlmResponse } from '../ports/ILanguageModel.js';

const DEFAULT_MODEL  = 'claude-sonnet-5';
const ANTHROPIC_API  = 'https://api.anthropic.com/v1/messages';
const API_VERSION    = '2023-06-01';

interface AnthropicMessage {
  role:    'user' | 'assistant';
  content: string;
}

interface AnthropicResponse {
  id:      string;
  model:   string;
  content: Array<{ type: string; text: string }>;
  usage:   { input_tokens: number; output_tokens: number };
  stop_reason: string;
}

export class AnthropicAdapter implements ILanguageModel {
  private readonly apiKey:  string;
  private readonly model:   string;
  private readonly baseUrl: string;

  constructor() {
    this.apiKey  = process.env['CF_ANTHROPIC_API_KEY']  ?? '';
    this.model   = process.env['CF_ANTHROPIC_MODEL']    ?? DEFAULT_MODEL;
    this.baseUrl = process.env['CF_ANTHROPIC_BASE_URL'] ?? ANTHROPIC_API;

    if (!this.apiKey) {
      console.warn(
        '[AnthropicAdapter] CF_ANTHROPIC_API_KEY is not set. ' +
          'Synthesis Engine calls will fail. Set the key or switch to CF_LLM_ADAPTER=stub.',
      );
    }
  }

  async complete(request: LlmRequest): Promise<LlmResponse> {
    // Separate system message from the conversation
    const systemMessages = request.messages.filter(m => m.role === 'system');
    const userMessages   = request.messages.filter(m => m.role !== 'system') as AnthropicMessage[];

    const body = {
      model:       request.model ?? this.model,
      max_tokens:  request.maxTokens,
      temperature: request.temperature ?? 0.3,
      messages:    userMessages,
      ...(systemMessages.length > 0 && { system: systemMessages.map(m => m.content).join('\n') }),
      ...(request.stopSequences?.length && { stop_sequences: request.stopSequences }),
    };

    const response = await fetch(this.baseUrl, {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         this.apiKey,
        'anthropic-version': API_VERSION,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '(no body)');
      throw new Error(
        `Anthropic API error: ${response.status} ${response.statusText} — ${text}`,
      );
    }

    const data = (await response.json()) as AnthropicResponse;
    const text = data.content.find(c => c.type === 'text')?.text ?? '';

    return {
      text,
      inputTokens:  data.usage.input_tokens,
      outputTokens: data.usage.output_tokens,
      truncated:    data.stop_reason === 'max_tokens',
      modelUsed:    data.model,
    };
  }

  defaultModel(): string {
    return this.model;
  }

  async close(): Promise<void> {
    // fetch-based adapter: no persistent connections to close
  }
}
