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
   * @todo Implement using Ollama REST API
   */
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    logger.warn('OllamaProvider.complete is not implemented yet (stub)', {
      provider: this.name,
      model: request.model,
    });

    throw new Error(
      'OllamaProvider is not implemented. This is a stub for future development. ' +
        'Install Ollama and implement the complete() method using the REST API.'
    );

    // TODO: Implement using Ollama REST API
    /*
    const response = await fetch(`${this.config.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.model,
        prompt: request.messages.map(m => m.content).join('\n'),
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
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      id: `ollama-${Date.now()}`,
      model: request.model,
      content: data.response,
      finishReason: data.done ? 'stop' : null,
      usage: {
        promptTokens: data.prompt_eval_count || 0,
        completionTokens: data.eval_count || 0,
        totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      },
      createdAt: new Date(),
    };
    */
  }

  /**
   * Complete a prompt with streaming
   * @todo Implement using Ollama REST API streaming
   */
  async *completeStream(request: CompletionRequest): AsyncGenerator<StreamChunk> {
    logger.warn('OllamaProvider.completeStream is not implemented yet (stub)', {
      provider: this.name,
      model: request.model,
    });

    throw new Error(
      'OllamaProvider streaming is not implemented. This is a stub for future development. ' +
        'Install Ollama and implement the completeStream() method using the streaming API.'
    );

    // TODO: Implement using Ollama REST API streaming
    /*
    const response = await fetch(`${this.config.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.model,
        prompt: request.messages.map(m => m.content).join('\n'),
        stream: true,
        options: {
          temperature: request.temperature ?? 0.7,
          num_predict: request.maxTokens,
          top_p: request.topP,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
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
          const data = JSON.parse(line);
          
          yield {
            id: `ollama-${Date.now()}`,
            model: request.model,
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
    */

    // Placeholder to satisfy TypeScript generator type
    yield {
      id: 'stub-id',
      model: request.model,
      delta: '',
      finishReason: 'stop',
      index: 0,
    };
  }

  /**
   * Check if the provider is available
   */
  async isAvailable(): Promise<boolean> {
    // TODO: Implement actual availability check
    // Try to connect to Ollama server
    /*
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
    */
    return false; // Stub always returns false
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
   * @todo Implement to fetch available models from Ollama
   */
  async listModels(): Promise<string[]> {
    logger.warn('OllamaProvider.listModels is not implemented yet (stub)');
    
    // TODO: Implement
    /*
    const response = await fetch(`${this.config.baseUrl}/api/tags`);
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }
    const data = await response.json();
    return data.models.map((m: { name: string }) => m.name);
    */
    
    return [];
  }
}

/**
 * Factory function to create OllamaProvider
 */
export function createOllamaProvider(config?: OllamaConfig): OllamaProvider {
  return new OllamaProvider(config);
}
