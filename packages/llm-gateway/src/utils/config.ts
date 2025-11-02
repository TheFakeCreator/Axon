/**
 * Configuration Utilities
 *
 * Helper functions for creating and validating LLM Gateway configurations.
 */

import {
  LLMGatewayConfig,
  LLMProvider,
  LLMModel,
  ProviderConfig,
  RateLimitConfig,
  CircuitBreakerConfig,
  RetryConfig,
} from '../types';

/**
 * Default rate limit configuration
 */
const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  requestsPerMinute: 60,
  tokensPerMinute: 90000, // OpenAI default for tier 1
  enabled: true,
};

/**
 * Default circuit breaker configuration
 */
const DEFAULT_CIRCUIT_BREAKER: CircuitBreakerConfig = {
  failureThreshold: 5, // Open after 5 failures
  successThreshold: 2, // Close after 2 successes in half-open
  timeout: 60000, // Try again after 60s
  enabled: true,
};

/**
 * Default retry configuration
 */
const DEFAULT_RETRY: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000, // 1s
  maxDelayMs: 60000, // 60s max
  backoffMultiplier: 2, // Exponential backoff
  retryableErrors: ['rate_limit', 'server_error', 'timeout', 'network'],
};

/**
 * Create a default LLM Gateway configuration
 */
export function createDefaultConfig(
  provider: LLMProvider,
  apiKey: string,
  options: {
    baseUrl?: string;
    organization?: string;
    timeout?: number;
    defaultModel?: LLMModel;
    rateLimit?: Partial<RateLimitConfig>;
    circuitBreaker?: Partial<CircuitBreakerConfig>;
    retry?: Partial<RetryConfig>;
    enableCaching?: boolean;
    cacheTTL?: number;
  } = {}
): LLMGatewayConfig {
  const providerConfig: ProviderConfig = {
    provider,
    apiKey,
    baseUrl: options.baseUrl,
    organization: options.organization,
    timeout: options.timeout || 60000,
    maxRetries: 0, // Handled by retry config
    defaultModel: options.defaultModel || getDefaultModel(provider),
  };

  return {
    provider: providerConfig,
    rateLimit: {
      ...DEFAULT_RATE_LIMIT,
      ...options.rateLimit,
    },
    circuitBreaker: {
      ...DEFAULT_CIRCUIT_BREAKER,
      ...options.circuitBreaker,
    },
    retry: {
      ...DEFAULT_RETRY,
      ...options.retry,
    },
    enableCaching: options.enableCaching ?? true,
    cacheTTL: options.cacheTTL ?? 3600, // 1 hour default
  };
}

/**
 * Get default model for a provider
 */
function getDefaultModel(provider: LLMProvider): LLMModel {
  switch (provider) {
    case LLMProvider.OPENAI:
      return LLMModel.GPT_4O;
    case LLMProvider.ANTHROPIC:
      return LLMModel.CLAUDE_3_SONNET;
    case LLMProvider.OLLAMA:
      return LLMModel.LLAMA_3;
    default:
      return LLMModel.GPT_35_TURBO;
  }
}

/**
 * Validate LLM Gateway configuration
 */
export function validateConfig(config: LLMGatewayConfig): string[] {
  const errors: string[] = [];

  // Validate provider config - API key not required for Ollama
  if (!config.provider.apiKey && config.provider.provider !== LLMProvider.OLLAMA) {
    errors.push('Provider API key is required');
  }

  if (config.provider.timeout && config.provider.timeout < 1000) {
    errors.push('Provider timeout must be at least 1000ms');
  }

  // Validate rate limit config
  if (config.rateLimit.enabled) {
    if (config.rateLimit.requestsPerMinute < 1) {
      errors.push('Rate limit requestsPerMinute must be at least 1');
    }
    if (config.rateLimit.tokensPerMinute < 1) {
      errors.push('Rate limit tokensPerMinute must be at least 1');
    }
  }

  // Validate circuit breaker config
  if (config.circuitBreaker.enabled) {
    if (config.circuitBreaker.failureThreshold < 1) {
      errors.push('Circuit breaker failureThreshold must be at least 1');
    }
    if (config.circuitBreaker.successThreshold < 1) {
      errors.push('Circuit breaker successThreshold must be at least 1');
    }
    if (config.circuitBreaker.timeout < 1000) {
      errors.push('Circuit breaker timeout must be at least 1000ms');
    }
  }

  // Validate retry config
  if (config.retry.maxRetries < 0) {
    errors.push('Retry maxRetries must be at least 0');
  }
  if (config.retry.initialDelayMs < 0) {
    errors.push('Retry initialDelayMs must be at least 0');
  }
  if (config.retry.maxDelayMs < config.retry.initialDelayMs) {
    errors.push('Retry maxDelayMs must be greater than initialDelayMs');
  }
  if (config.retry.backoffMultiplier < 1) {
    errors.push('Retry backoffMultiplier must be at least 1');
  }

  // Validate caching config
  if (config.enableCaching && config.cacheTTL && config.cacheTTL < 1) {
    errors.push('Cache TTL must be at least 1 second');
  }

  return errors;
}
