/**
 * Ollama Local LLM Provider (Stub for post-MVP)
 *
 * This is a placeholder implementation for Ollama's local LLM API.
 * To enable this provider:
 * 1. Install Ollama: https://ollama.ai/download
 * 2. Pull a model: ollama pull llama3
 * 3. Implement the methods below using fetch or axios to call Ollama's REST API
 * 4. Add Ollama-specific configuration and error handling
 *
 * @see https://github.com/ollama/ollama/blob/main/docs/api.md
 */

import {
  ILLMProvider,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
  LLMProvider,
} from '../types';
import { logger } from '@axon/shared';

export interface OllamaConfig {
  baseUrl?: string; // Default: http://localhost:11434
  timeout?: number;
}

/**
 * Ollama local LLM provider implementation (stub)
 */
export class OllamaProvider implements ILLMProvider {
  readonly name: LLMProvider = LLMProvider.OLLAMA;
  private config: OllamaConfig;

  constructor(config: OllamaConfig = {}) {
    this.config = {
      baseUrl: 'http://localhost:11434',
      timeout: 30000,
      ...config,
    };
  }

  /**
   * Complete a prompt (non-streaming)
   */
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    logger.info('OllamaProvider.complete called', {
      provider: this.name,
      model: request.model,
    });

    try {
      const response = await fetch(`${this.config.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: request.model || 'llama3.2:1b',
          prompt: request.messages.map((m) => `${m.role}: ${m.content}`).join('\n\n'),
          stream: false,
          options: {
            temperature: request.temperature ?? 0.7,
            num_predict: request.maxTokens,
            top_p: request.topP,
          },
        }),
        signal: AbortSignal.timeout(this.config.timeout || 30000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.statusText} - ${errorText}`);
      }

      const data = (await response.json()) as {
        response: string;
        done: boolean;
        prompt_eval_count?: number;
        eval_count?: number;
      };

      return {
        id: `ollama-${Date.now()}`,
        model: request.model || 'llama3.2:1b',
        content: data.response,
        finishReason: data.done ? 'stop' : null,
        usage: {
          promptTokens: data.prompt_eval_count || 0,
          completionTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        },
        createdAt: new Date(),
      };
    } catch (error) {
      logger.error('Ollama completion error', { error });
      throw error;
    }
  }

  /**
   * Complete a prompt with streaming
   */
  async *completeStream(request: CompletionRequest): AsyncGenerator<StreamChunk> {
    logger.info('OllamaProvider.completeStream called', {
      provider: this.name,
      model: request.model,
    });

    try {
      const response = await fetch(`${this.config.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: request.model || 'llama3.2:1b',
          prompt: request.messages.map((m) => `${m.role}: ${m.content}`).join('\n\n'),
          stream: true,
          options: {
            temperature: request.temperature ?? 0.7,
            num_predict: request.maxTokens,
            top_p: request.topP,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.statusText} - ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is null');
      }

      const decoder = new TextDecoder();
      let index = 0;
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '') continue;

          try {
            const data = JSON.parse(line) as {
              response: string;
              done: boolean;
            };

            yield {
              id: `ollama-${Date.now()}`,
              model: request.model || 'llama3.2:1b',
              delta: data.response || '',
              finishReason: data.done ? 'stop' : null,
              index: index++,
            };

            if (data.done) break;
          } catch (error) {
            logger.error('Error parsing Ollama streaming response', { error, line });
          }
        }
      }
    } catch (error) {
      logger.error('Ollama streaming error', { error });
      throw error;
    }
  }

  /**
   * Check if the provider is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Validate configuration
   */
  async validateConfig(): Promise<void> {
    if (!this.config.baseUrl) {
      throw new Error('Ollama base URL is required');
    }

    // Validate URL format
    try {
      new URL(this.config.baseUrl);
    } catch {
      throw new Error('Invalid Ollama base URL format');
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    return this.isAvailable();
  }

  /**
   * List available models (Ollama-specific utility)
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`);
      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }
      const data = (await response.json()) as { models: { name: string }[] };
      return data.models.map((m: { name: string }) => m.name);
    } catch (error) {
      logger.error('Error listing Ollama models', { error });
      return [];
    }
  }
}

/**
 * Factory function to create OllamaProvider
 */
export function createOllamaProvider(config?: OllamaConfig): OllamaProvider {
  return new OllamaProvider(config);
}
