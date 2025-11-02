/**
 * OpenAI Provider Implementation
 * 
 * Implements the ILLMProvider interface for OpenAI's API,
 * including completion, streaming, retry logic, and error handling.
 */

import OpenAI from 'openai';
import type {
  ChatCompletionMessageParam,
  ChatCompletionChunk,
} from 'openai/resources/chat/completions';
import { logger } from '@axon/shared';
import {
  ILLMProvider,
  LLMProvider,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
  Message,
  MessageRole,
  TokenUsage,
  LLMError,
  LLMErrorType,
  ProviderConfig,
  RetryConfig,
} from '../types';

/**
 * OpenAI provider implementation
 */
export class OpenAIProvider implements ILLMProvider {
  readonly name = LLMProvider.OPENAI;
  private client: OpenAI;
  private config: ProviderConfig;
  private retryConfig: RetryConfig;

  constructor(config: ProviderConfig, retryConfig: RetryConfig) {
    this.config = config;
    this.retryConfig = retryConfig;

    // Initialize OpenAI client
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      organization: config.organization,
      timeout: config.timeout || 60000, // 60s default
      maxRetries: 0, // We handle retries ourselves
    });

    logger.info('OpenAI provider initialized', {
      baseUrl: config.baseUrl || 'default',
      timeout: config.timeout,
    });
  }

  /**
   * Generate a completion (non-streaming)
   */
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const startTime = Date.now();

    try {
      logger.debug('OpenAI completion request', {
        model: request.model,
        messageCount: request.messages.length,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
      });

      const response = await this.executeWithRetry(async () => {
        return await this.client.chat.completions.create({
          model: request.model,
          messages: this.convertMessages(request.messages),
          temperature: request.temperature ?? 1,
          max_tokens: request.maxTokens,
          top_p: request.topP,
          frequency_penalty: request.frequencyPenalty,
          presence_penalty: request.presencePenalty,
          stop: request.stop,
          user: request.user,
          stream: false,
        });
      });

      const duration = Date.now() - startTime;

      const content = response.choices[0]?.message?.content || '';
      const usage: TokenUsage = {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      };

      logger.info('OpenAI completion successful', {
        model: response.model,
        tokens: usage.totalTokens,
        duration,
        finishReason: response.choices[0]?.finish_reason,
      });

      return {
        id: response.id,
        model: response.model,
        content,
        finishReason: response.choices[0]?.finish_reason || null,
        usage,
        createdAt: new Date(response.created * 1000),
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('OpenAI completion failed', { error, duration });
      throw this.handleError(error);
    }
  }

  /**
   * Generate a streaming completion
   */
  async *completeStream(
    request: CompletionRequest
  ): AsyncGenerator<StreamChunk, void, unknown> {
    try {
      logger.debug('OpenAI streaming completion request', {
        model: request.model,
        messageCount: request.messages.length,
      });

      const stream = await this.executeWithRetry(async () => {
        return await this.client.chat.completions.create({
          model: request.model,
          messages: this.convertMessages(request.messages),
          temperature: request.temperature ?? 1,
          max_tokens: request.maxTokens,
          top_p: request.topP,
          frequency_penalty: request.frequencyPenalty,
          presence_penalty: request.presencePenalty,
          stop: request.stop,
          user: request.user,
          stream: true,
        });
      });

      let chunkIndex = 0;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || '';
        const finishReason = chunk.choices[0]?.finish_reason || null;

        const streamChunk: StreamChunk = {
          id: chunk.id,
          model: chunk.model,
          delta,
          finishReason,
          index: chunkIndex++,
        };

        yield streamChunk;

        if (finishReason) {
          logger.info('OpenAI streaming completed', {
            model: chunk.model,
            chunks: chunkIndex,
            finishReason,
          });
          break;
        }
      }
    } catch (error) {
      logger.error('OpenAI streaming failed', { error });
      throw this.handleError(error);
    }
  }

  /**
   * Validate configuration by making a test request
   */
  async validateConfig(): Promise<void> {
    try {
      // Make a minimal test request
      await this.client.chat.completions.create({
        model: this.config.defaultModel || 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
      });

      logger.info('OpenAI configuration validated successfully');
    } catch (error) {
      logger.error('OpenAI configuration validation failed', { error });
      throw this.handleError(error);
    }
  }

  /**
   * Check provider health
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Simple check - try to list models or make a minimal request
      await this.client.models.list();
      return true;
    } catch (error) {
      logger.warn('OpenAI health check failed', { error });
      return false;
    }
  }

  /**
   * Convert internal message format to OpenAI format
   */
  private convertMessages(
    messages: Message[]
  ): ChatCompletionMessageParam[] {
    return messages.map((msg) => ({
      role: msg.role.toLowerCase() as 'system' | 'user' | 'assistant',
      content: msg.content,
      name: msg.name,
    }));
  }

  /**
   * Execute a function with retry logic
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    attempt: number = 0
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      const llmError = this.handleError(error);

      // Check if error is retryable
      if (!llmError.retryable || attempt >= this.retryConfig.maxRetries) {
        throw llmError;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        this.retryConfig.initialDelayMs *
          Math.pow(this.retryConfig.backoffMultiplier, attempt),
        this.retryConfig.maxDelayMs
      );

      logger.warn(`Retrying OpenAI request (attempt ${attempt + 1})`, {
        delay,
        maxRetries: this.retryConfig.maxRetries,
      });

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Retry
      return this.executeWithRetry(fn, attempt + 1);
    }
  }

  /**
   * Handle and categorize errors from OpenAI
   */
  private handleError(error: unknown): LLMError {
    // OpenAI SDK errors
    if (error instanceof OpenAI.APIError) {
      const { status, message, code } = error;

      // Rate limit error
      if (status === 429) {
        return new LLMError(
          `OpenAI rate limit exceeded: ${message}`,
          LLMErrorType.RATE_LIMIT,
          status,
          LLMProvider.OPENAI,
          true, // Retryable
          error
        );
      }

      // Authentication error
      if (status === 401 || status === 403) {
        return new LLMError(
          `OpenAI authentication failed: ${message}`,
          LLMErrorType.AUTHENTICATION,
          status,
          LLMProvider.OPENAI,
          false,
          error
        );
      }

      // Invalid request error
      if (status === 400 || status === 422) {
        return new LLMError(
          `OpenAI invalid request: ${message}`,
          LLMErrorType.INVALID_REQUEST,
          status,
          LLMProvider.OPENAI,
          false,
          error
        );
      }

      // Server error (retryable)
      if (status && status >= 500) {
        return new LLMError(
          `OpenAI server error: ${message}`,
          LLMErrorType.SERVER_ERROR,
          status,
          LLMProvider.OPENAI,
          true,
          error
        );
      }

      // Timeout error
      if (code === 'ETIMEDOUT' || code === 'ECONNABORTED') {
        return new LLMError(
          `OpenAI request timeout: ${message}`,
          LLMErrorType.TIMEOUT,
          status,
          LLMProvider.OPENAI,
          true,
          error
        );
      }

      // Network error
      if (code === 'ENOTFOUND' || code === 'ECONNREFUSED') {
        return new LLMError(
          `OpenAI network error: ${message}`,
          LLMErrorType.NETWORK,
          status,
          LLMProvider.OPENAI,
          true,
          error
        );
      }
    }

    // Generic error
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new LLMError(
      `OpenAI error: ${message}`,
      LLMErrorType.UNKNOWN,
      undefined,
      LLMProvider.OPENAI,
      false,
      error instanceof Error ? error : undefined
    );
  }
}
