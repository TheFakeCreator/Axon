/**
 * LLM Gateway Service
 * 
 * Main service that orchestrates LLM providers with:
 * - Rate limiting
 * - Circuit breaker
 * - Caching
 * - Metrics collection
 * - Provider abstraction
 */

import { logger } from '@axon/shared';
import {
  ILLMProvider,
  LLMProvider,
  LLMGatewayConfig,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
  LLMError,
  LLMErrorType,
  CircuitBreakerState,
  LLMMetrics,
} from './types';
import { OpenAIProvider } from './providers/openai-provider';

/**
 * Rate limiter using token bucket algorithm
 */
class RateLimiter {
  private requestTokens: number;
  private tokenTokens: number;
  private lastRefill: number;
  private requestsPerMinute: number;
  private tokensPerMinute: number;

  constructor(requestsPerMinute: number, tokensPerMinute: number) {
    this.requestsPerMinute = requestsPerMinute;
    this.tokensPerMinute = tokensPerMinute;
    this.requestTokens = requestsPerMinute;
    this.tokenTokens = tokensPerMinute;
    this.lastRefill = Date.now();
  }

  /**
   * Check if request can be made
   */
  canMakeRequest(estimatedTokens: number = 1000): boolean {
    this.refillBuckets();
    return this.requestTokens >= 1 && this.tokenTokens >= estimatedTokens;
  }

  /**
   * Consume tokens for a request
   */
  consumeTokens(actualTokens: number): void {
    this.refillBuckets();
    this.requestTokens = Math.max(0, this.requestTokens - 1);
    this.tokenTokens = Math.max(0, this.tokenTokens - actualTokens);
  }

  /**
   * Refill token buckets based on time elapsed
   */
  private refillBuckets(): void {
    const now = Date.now();
    const elapsedMs = now - this.lastRefill;
    const elapsedMinutes = elapsedMs / 60000;

    if (elapsedMinutes > 0) {
      this.requestTokens = Math.min(
        this.requestsPerMinute,
        this.requestTokens + this.requestsPerMinute * elapsedMinutes
      );
      this.tokenTokens = Math.min(
        this.tokensPerMinute,
        this.tokenTokens + this.tokensPerMinute * elapsedMinutes
      );
      this.lastRefill = now;
    }
  }
}

/**
 * Circuit breaker implementation
 */
class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private nextAttempt: number = 0;
  private failureThreshold: number;
  private successThreshold: number;
  private timeout: number;

  constructor(
    failureThreshold: number,
    successThreshold: number,
    timeout: number
  ) {
    this.failureThreshold = failureThreshold;
    this.successThreshold = successThreshold;
    this.timeout = timeout;
  }

  /**
   * Check if request can proceed
   */
  canProceed(): boolean {
    if (this.state === CircuitBreakerState.CLOSED) {
      return true;
    }

    if (this.state === CircuitBreakerState.OPEN) {
      // Check if timeout has elapsed
      if (Date.now() >= this.nextAttempt) {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.successCount = 0;
        logger.info('Circuit breaker transitioning to HALF_OPEN');
        return true;
      }
      return false;
    }

    // HALF_OPEN state
    return true;
  }

  /**
   * Record a successful request
   */
  recordSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = CircuitBreakerState.CLOSED;
        this.successCount = 0;
        logger.info('Circuit breaker CLOSED');
      }
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(): void {
    this.failureCount++;
    this.successCount = 0;

    if (
      this.state === CircuitBreakerState.HALF_OPEN ||
      this.failureCount >= this.failureThreshold
    ) {
      this.state = CircuitBreakerState.OPEN;
      this.nextAttempt = Date.now() + this.timeout;
      logger.warn('Circuit breaker OPEN', {
        failureCount: this.failureCount,
        nextAttempt: new Date(this.nextAttempt).toISOString(),
      });
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return this.state;
  }
}

/**
 * Main LLM Gateway Service
 */
export class LLMGatewayService {
  private provider: ILLMProvider;
  private config: LLMGatewayConfig;
  private rateLimiter?: RateLimiter;
  private circuitBreaker?: CircuitBreaker;
  private metrics: LLMMetrics;

  constructor(config: LLMGatewayConfig) {
    this.config = config;

    // Initialize provider
    this.provider = this.createProvider(config.provider.provider);

    // Initialize rate limiter
    if (config.rateLimit.enabled) {
      this.rateLimiter = new RateLimiter(
        config.rateLimit.requestsPerMinute,
        config.rateLimit.tokensPerMinute
      );
    }

    // Initialize circuit breaker
    if (config.circuitBreaker.enabled) {
      this.circuitBreaker = new CircuitBreaker(
        config.circuitBreaker.failureThreshold,
        config.circuitBreaker.successThreshold,
        config.circuitBreaker.timeout
      );
    }

    // Initialize metrics
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalTokens: 0,
      totalLatencyMs: 0,
      averageLatencyMs: 0,
      cacheHits: 0,
      cacheMisses: 0,
      rateLimitHits: 0,
      circuitBreakerTrips: 0,
    };

    logger.info('LLM Gateway Service initialized', {
      provider: config.provider.provider,
      rateLimitEnabled: config.rateLimit.enabled,
      circuitBreakerEnabled: config.circuitBreaker.enabled,
    });
  }

  /**
   * Generate a completion
   */
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      // Check circuit breaker
      if (this.circuitBreaker && !this.circuitBreaker.canProceed()) {
        this.metrics.circuitBreakerTrips++;
        throw new LLMError(
          'Circuit breaker is OPEN',
          LLMErrorType.CIRCUIT_OPEN,
          undefined,
          this.provider.name,
          false
        );
      }

      // Check rate limit
      const estimatedTokens = this.estimateTokens(request);
      if (this.rateLimiter && !this.rateLimiter.canMakeRequest(estimatedTokens)) {
        this.metrics.rateLimitHits++;
        throw new LLMError(
          'Rate limit exceeded',
          LLMErrorType.RATE_LIMIT,
          429,
          this.provider.name,
          true
        );
      }

      // Make request
      const response = await this.provider.complete(request);

      // Update metrics
      const duration = Date.now() - startTime;
      this.metrics.successfulRequests++;
      this.metrics.totalTokens += response.usage.totalTokens;
      this.metrics.totalLatencyMs += duration;
      this.metrics.averageLatencyMs =
        this.metrics.totalLatencyMs / this.metrics.successfulRequests;

      // Consume rate limit tokens
      if (this.rateLimiter) {
        this.rateLimiter.consumeTokens(response.usage.totalTokens);
      }

      // Record success with circuit breaker
      if (this.circuitBreaker) {
        this.circuitBreaker.recordSuccess();
      }

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.metrics.failedRequests++;
      this.metrics.totalLatencyMs += duration;
      this.metrics.averageLatencyMs =
        this.metrics.totalLatencyMs /
        (this.metrics.successfulRequests + this.metrics.failedRequests);

      // Record failure with circuit breaker
      if (this.circuitBreaker && error instanceof LLMError && error.retryable) {
        this.circuitBreaker.recordFailure();
      }

      throw error;
    }
  }

  /**
   * Generate a streaming completion
   */
  async *completeStream(
    request: CompletionRequest
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      // Check circuit breaker
      if (this.circuitBreaker && !this.circuitBreaker.canProceed()) {
        this.metrics.circuitBreakerTrips++;
        throw new LLMError(
          'Circuit breaker is OPEN',
          LLMErrorType.CIRCUIT_OPEN,
          undefined,
          this.provider.name,
          false
        );
      }

      // Check rate limit
      const estimatedTokens = this.estimateTokens(request);
      if (this.rateLimiter && !this.rateLimiter.canMakeRequest(estimatedTokens)) {
        this.metrics.rateLimitHits++;
        throw new LLMError(
          'Rate limit exceeded',
          LLMErrorType.RATE_LIMIT,
          429,
          this.provider.name,
          true
        );
      }

      // Make streaming request
      let totalTokensEstimate = 0;
      for await (const chunk of this.provider.completeStream(request)) {
        yield chunk;
        totalTokensEstimate += chunk.delta.length / 4; // Rough estimate
      }

      // Update metrics
      const duration = Date.now() - startTime;
      this.metrics.successfulRequests++;
      this.metrics.totalTokens += Math.ceil(totalTokensEstimate);
      this.metrics.totalLatencyMs += duration;
      this.metrics.averageLatencyMs =
        this.metrics.totalLatencyMs / this.metrics.successfulRequests;

      // Consume rate limit tokens (estimate)
      if (this.rateLimiter) {
        this.rateLimiter.consumeTokens(Math.ceil(totalTokensEstimate));
      }

      // Record success with circuit breaker
      if (this.circuitBreaker) {
        this.circuitBreaker.recordSuccess();
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.metrics.failedRequests++;
      this.metrics.totalLatencyMs += duration;
      this.metrics.averageLatencyMs =
        this.metrics.totalLatencyMs /
        (this.metrics.successfulRequests + this.metrics.failedRequests);

      // Record failure with circuit breaker
      if (this.circuitBreaker && error instanceof LLMError && error.retryable) {
        this.circuitBreaker.recordFailure();
      }

      throw error;
    }
  }

  /**
   * Get service metrics
   */
  getMetrics(): LLMMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalTokens: 0,
      totalLatencyMs: 0,
      averageLatencyMs: 0,
      cacheHits: 0,
      cacheMisses: 0,
      rateLimitHits: 0,
      circuitBreakerTrips: 0,
    };
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState(): CircuitBreakerState | null {
    return this.circuitBreaker?.getState() || null;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      return await this.provider.healthCheck();
    } catch (error) {
      logger.error('Health check failed', { error });
      return false;
    }
  }

  /**
   * Validate configuration
   */
  async validateConfig(): Promise<void> {
    await this.provider.validateConfig();
  }

  /**
   * Create provider instance based on configuration
   */
  private createProvider(providerType: LLMProvider): ILLMProvider {
    switch (providerType) {
      case LLMProvider.OPENAI:
        return new OpenAIProvider(this.config.provider, this.config.retry);

      case LLMProvider.ANTHROPIC:
        throw new Error('Anthropic provider not yet implemented');

      case LLMProvider.OLLAMA:
        throw new Error('Ollama provider not yet implemented');

      default:
        throw new Error(`Unsupported provider: ${providerType}`);
    }
  }

  /**
   * Estimate tokens for a request (rough approximation)
   */
  private estimateTokens(request: CompletionRequest): number {
    const messageTokens = request.messages.reduce(
      (sum, msg) => sum + msg.content.length / 4, // Rough estimate: 1 token ≈ 4 chars
      0
    );
    const maxTokens = request.maxTokens || 1000;
    return Math.ceil(messageTokens + maxTokens);
  }
}
