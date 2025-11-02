/**
 * LLM Gateway Type Definitions
 * 
 * Defines interfaces and types for LLM provider abstraction,
 * including requests, responses, streaming, and configuration.
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
 * LLM models supported by each provider
 */
export enum LLMModel {
  // OpenAI models
  GPT_4 = 'gpt-4',
  GPT_4_TURBO = 'gpt-4-turbo-preview',
  GPT_4O = 'gpt-4o',
  GPT_35_TURBO = 'gpt-3.5-turbo',
  
  // Anthropic models (future)
  CLAUDE_3_OPUS = 'claude-3-opus-20240229',
  CLAUDE_3_SONNET = 'claude-3-sonnet-20240229',
  CLAUDE_3_HAIKU = 'claude-3-haiku-20240307',
  
  // Ollama models (future)
  LLAMA_3 = 'llama3',
}

/**
 * Message role in a conversation
 */
export enum MessageRole {
  SYSTEM = 'system',
  USER = 'user',
  ASSISTANT = 'assistant',
  FUNCTION = 'function',
}

/**
 * A single message in a conversation
 */
export interface Message {
  role: MessageRole;
  content: string;
  name?: string; // For function messages
}

/**
 * LLM completion request parameters
 */
export interface CompletionRequest {
  messages: Message[];
  model: LLMModel;
  temperature?: number; // 0-2, default 1
  maxTokens?: number;
  topP?: number; // 0-1, default 1
  frequencyPenalty?: number; // -2 to 2, default 0
  presencePenalty?: number; // -2 to 2, default 0
  stop?: string | string[];
  stream?: boolean; // Enable streaming
  user?: string; // Unique user identifier
}

/**
 * Token usage information
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * LLM completion response (non-streaming)
 */
export interface CompletionResponse {
  id: string;
  model: string;
  content: string;
  finishReason: 'stop' | 'length' | 'content_filter' | 'function_call' | 'tool_calls' | null;
  usage: TokenUsage;
  createdAt: Date;
}

/**
 * Streaming chunk from LLM
 */
export interface StreamChunk {
  id: string;
  model: string;
  delta: string; // Incremental content
  finishReason: 'stop' | 'length' | 'content_filter' | 'function_call' | 'tool_calls' | null;
  index: number;
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  provider: LLMProvider;
  apiKey: string;
  baseUrl?: string; // For custom endpoints
  organization?: string; // For OpenAI
  timeout?: number; // Request timeout in ms
  maxRetries?: number; // Max retry attempts
  defaultModel?: LLMModel;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  requestsPerMinute: number;
  tokensPerMinute: number;
  enabled: boolean;
}

/**
 * Circuit breaker state
 */
export enum CircuitBreakerState {
  CLOSED = 'closed', // Normal operation
  OPEN = 'open', // Circuit broken, rejecting requests
  HALF_OPEN = 'half_open', // Testing if circuit can close
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening
  successThreshold: number; // Number of successes to close from half-open
  timeout: number; // Time to wait before trying half-open (ms)
  enabled: boolean;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number; // Initial delay before first retry
  maxDelayMs: number; // Maximum delay between retries
  backoffMultiplier: number; // Exponential backoff multiplier
  retryableErrors: string[]; // Error codes/messages that trigger retry
}

/**
 * LLM Gateway configuration
 */
export interface LLMGatewayConfig {
  provider: ProviderConfig;
  rateLimit: RateLimitConfig;
  circuitBreaker: CircuitBreakerConfig;
  retry: RetryConfig;
  enableCaching?: boolean;
  cacheTTL?: number; // Cache TTL in seconds
}

/**
 * LLM error types
 */
export enum LLMErrorType {
  RATE_LIMIT = 'rate_limit',
  AUTHENTICATION = 'authentication',
  INVALID_REQUEST = 'invalid_request',
  SERVER_ERROR = 'server_error',
  TIMEOUT = 'timeout',
  NETWORK = 'network',
  CIRCUIT_OPEN = 'circuit_open',
  UNKNOWN = 'unknown',
}

/**
 * LLM error
 */
export class LLMError extends Error {
  constructor(
    message: string,
    public type: LLMErrorType,
    public statusCode?: number,
    public provider?: LLMProvider,
    public retryable: boolean = false,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'LLMError';
    Object.setPrototypeOf(this, LLMError.prototype);
  }
}

/**
 * Provider interface that all LLM providers must implement
 */
export interface ILLMProvider {
  /**
   * Provider name
   */
  readonly name: LLMProvider;

  /**
   * Generate a completion (non-streaming)
   */
  complete(request: CompletionRequest): Promise<CompletionResponse>;

  /**
   * Generate a streaming completion
   * Returns an async generator that yields chunks
   */
  completeStream(
    request: CompletionRequest
  ): AsyncGenerator<StreamChunk, void, unknown>;

  /**
   * Validate configuration
   */
  validateConfig(): Promise<void>;

  /**
   * Check provider health
   */
  healthCheck(): Promise<boolean>;
}

/**
 * Metrics for monitoring
 */
export interface LLMMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalTokens: number;
  totalLatencyMs: number;
  averageLatencyMs: number;
  cacheHits: number;
  cacheMisses: number;
  rateLimitHits: number;
  circuitBreakerTrips: number;
}
