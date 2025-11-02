/**
 * LLM integration types
 */

/**
 * Supported LLM providers
 */
export enum LLMProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  OLLAMA = 'ollama',
}

/**
 * LLM models
 */
export enum LLMModel {
  GPT4 = 'gpt-4',
  GPT4_TURBO = 'gpt-4-turbo',
  GPT35_TURBO = 'gpt-3.5-turbo',
  CLAUDE_3_OPUS = 'claude-3-opus',
  CLAUDE_3_SONNET = 'claude-3-sonnet',
  LLAMA3 = 'llama3',
}

/**
 * LLM request configuration
 */
export interface ILLMRequest {
  model: LLMModel;
  provider: LLMProvider;
  prompt: string;
  systemMessage?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  stopSequences?: string[];
}

/**
 * LLM response
 */
export interface ILLMResponse {
  content: string;
  model: string;
  provider: string;
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
  finishReason: 'stop' | 'length' | 'error';
  metadata?: Record<string, unknown>;
}

/**
 * Streaming response chunk
 */
export interface ILLMStreamChunk {
  delta: string;
  isComplete: boolean;
}
