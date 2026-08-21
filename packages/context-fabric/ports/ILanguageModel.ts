/**
 * Context Fabric Platform — ILanguageModel Port
 *
 * Abstracts the language model used by M06 Synthesis Engine and future modules.
 *
 * Default implementation: AnthropicAdapter (Claude API)
 * Alternative implementations:
 *   VertexAIAdapter    — Google Vertex AI (Gemini)
 *   AzureOpenAIAdapter — Azure OpenAI (GPT-4o)
 *   StubAdapter        — deterministic stub for tests (no API call)
 *
 * Swap adapters via environment:
 *   CF_LLM_ADAPTER=anthropic   (default)
 *   CF_LLM_ADAPTER=vertexai
 *   CF_LLM_ADAPTER=azureopenai
 *   CF_LLM_ADAPTER=stub
 */

export interface LlmMessage {
  role:    'user' | 'assistant' | 'system';
  content: string;
}

export interface LlmRequest {
  messages:    LlmMessage[];
  /** Max tokens in the response. */
  maxTokens:   number;
  /** 0.0 = deterministic, 1.0 = most creative. Default: 0.3 for synthesis. */
  temperature?: number;
  /** Optional model override (e.g. "claude-sonnet-5"). */
  model?:       string;
  /** Stop sequences. */
  stopSequences?: string[];
}

export interface LlmResponse {
  text:       string;
  /** Tokens consumed in this call. Used for cost tracking (M17). */
  inputTokens:  number;
  outputTokens: number;
  /** True when the model stopped due to maxTokens limit, not end of generation. */
  truncated:  boolean;
  /** Which model variant actually served this request. */
  modelUsed:  string;
}

export interface ILanguageModel {
  /**
   * Send a message sequence to the model and return the response.
   */
  complete(request: LlmRequest): Promise<LlmResponse>;

  /**
   * Name of the default model this adapter uses (e.g. "claude-sonnet-5").
   */
  defaultModel(): string;

  /**
   * Release any open connections.
   */
  close(): Promise<void>;
}
