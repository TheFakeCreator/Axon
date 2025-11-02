/**
 * OpenAI Provider Tests
 * 
 * Unit tests for the OpenAI provider implementation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIProvider } from '../src/providers/openai-provider';
import {
  LLMProvider,
  LLMModel,
  MessageRole,
  ProviderConfig,
  RetryConfig,
  LLMErrorType,
} from '../src/types';

// Mock OpenAI SDK
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
      models: {
        list: vi.fn(),
      },
    })),
    APIError: class APIError extends Error {
      constructor(
        message: string,
        public status: number,
        public code?: string
      ) {
        super(message);
        this.name = 'APIError';
      }
    },
  };
});

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;
  let mockConfig: ProviderConfig;
  let mockRetryConfig: RetryConfig;

  beforeEach(() => {
    mockConfig = {
      provider: LLMProvider.OPENAI,
      apiKey: 'test-api-key',
      timeout: 30000,
      defaultModel: LLMModel.GPT_4,
    };

    mockRetryConfig = {
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 60000,
      backoffMultiplier: 2,
      retryableErrors: ['rate_limit', 'server_error', 'timeout', 'network'],
    };

    provider = new OpenAIProvider(mockConfig, mockRetryConfig);
  });

  describe('complete', () => {
    it('should generate a completion successfully', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        model: 'gpt-4',
        created: 1677652288,
        choices: [
          {
            message: {
              content: 'Hello! How can I help you today?',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      };

      // @ts-expect-error - Accessing private property for testing
      provider.client.chat.completions.create = vi.fn().mockResolvedValue(mockResponse);

      const result = await provider.complete({
        messages: [
          {
            role: MessageRole.USER,
            content: 'Hello',
          },
        ],
        model: LLMModel.GPT_4,
      });

      expect(result).toEqual({
        id: 'chatcmpl-123',
        model: 'gpt-4',
        content: 'Hello! How can I help you today?',
        finishReason: 'stop',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
        createdAt: new Date(1677652288 * 1000),
      });
    });

    it('should handle rate limit errors', async () => {
      const OpenAI = await import('openai');
      const error = new OpenAI.APIError(
        429,
        {
          error: {
            message: 'Rate limit exceeded',
            type: 'rate_limit_exceeded',
            code: 'rate_limit_exceeded',
          },
        },
        'Rate limit exceeded',
        new Headers()
      );

      // @ts-expect-error - Accessing private property for testing
      provider.client.chat.completions.create = vi.fn().mockRejectedValue(error);

      await expect(
        provider.complete({
          messages: [{ role: MessageRole.USER, content: 'Hello' }],
          model: LLMModel.GPT_4,
        })
      ).rejects.toThrow('OpenAI rate limit exceeded');
    });

    it('should handle authentication errors', async () => {
      const OpenAI = await import('openai');
      const error = new OpenAI.APIError(
        401,
        {
          error: {
            message: 'Invalid API key',
            type: 'invalid_api_key',
            code: 'invalid_api_key',
          },
        },
        'Invalid API key',
        new Headers()
      );

      // @ts-expect-error - Accessing private property for testing
      provider.client.chat.completions.create = vi.fn().mockRejectedValue(error);

      await expect(
        provider.complete({
          messages: [{ role: MessageRole.USER, content: 'Hello' }],
          model: LLMModel.GPT_4,
        })
      ).rejects.toThrow('OpenAI authentication failed');
    });

    it('should handle invalid request errors', async () => {
      const OpenAI = await import('openai');
      const error = new OpenAI.APIError(
        400,
        {
          error: {
            message: 'Invalid request',
            type: 'invalid_request',
            code: 'invalid_request',
          },
        },
        'Invalid request',
        new Headers()
      );

      // @ts-expect-error - Accessing private property for testing
      provider.client.chat.completions.create = vi.fn().mockRejectedValue(error);

      await expect(
        provider.complete({
          messages: [{ role: MessageRole.USER, content: 'Hello' }],
          model: LLMModel.GPT_4,
        })
      ).rejects.toThrow('OpenAI invalid request');
    });

    it('should retry on server errors', async () => {
      const OpenAI = await import('openai');
      const error = new OpenAI.APIError(
        500,
        {
          error: {
            message: 'Server error',
            type: 'server_error',
            code: 'server_error',
          },
        },
        'Server error',
        new Headers()
      );
      const mockResponse = {
        id: 'chatcmpl-123',
        model: 'gpt-4',
        created: 1677652288,
        choices: [
          {
            message: { content: 'Success after retry' },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      };

      // @ts-expect-error - Accessing private property for testing
      provider.client.chat.completions.create = vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(mockResponse);

      const result = await provider.complete({
        messages: [{ role: MessageRole.USER, content: 'Hello' }],
        model: LLMModel.GPT_4,
      });

      expect(result.content).toBe('Success after retry');
      // @ts-expect-error - Accessing private property for testing
      expect(provider.client.chat.completions.create).toHaveBeenCalledTimes(2);
    }, 10000); // Increase timeout for retry test
  });

  describe('completeStream', () => {
    it('should generate streaming chunks', async () => {
      const mockChunks = [
        {
          id: 'chatcmpl-123',
          model: 'gpt-4',
          choices: [
            {
              delta: { content: 'Hello' },
              finish_reason: null,
            },
          ],
        },
        {
          id: 'chatcmpl-123',
          model: 'gpt-4',
          choices: [
            {
              delta: { content: ' world' },
              finish_reason: null,
            },
          ],
        },
        {
          id: 'chatcmpl-123',
          model: 'gpt-4',
          choices: [
            {
              delta: { content: '!' },
              finish_reason: 'stop',
            },
          ],
        },
      ];

      async function* mockStream() {
        for (const chunk of mockChunks) {
          yield chunk;
        }
      }

      // @ts-expect-error - Accessing private property for testing
      provider.client.chat.completions.create = vi.fn().mockResolvedValue(mockStream());

      const chunks: string[] = [];
      for await (const chunk of provider.completeStream({
        messages: [{ role: MessageRole.USER, content: 'Hello' }],
        model: LLMModel.GPT_4,
      })) {
        chunks.push(chunk.delta);
      }

      expect(chunks).toEqual(['Hello', ' world', '!']);
    });
  });

  describe('healthCheck', () => {
    it('should return true when healthy', async () => {
      // @ts-expect-error - Accessing private property for testing
      provider.client.models.list = vi.fn().mockResolvedValue({});

      const result = await provider.healthCheck();
      expect(result).toBe(true);
    });

    it('should return false when unhealthy', async () => {
      // @ts-expect-error - Accessing private property for testing
      provider.client.models.list = vi.fn().mockRejectedValue(new Error('Connection failed'));

      const result = await provider.healthCheck();
      expect(result).toBe(false);
    });
  });
});
