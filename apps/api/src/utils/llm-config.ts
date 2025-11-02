/**
 * LLM Gateway Configuration Helper
 *
 * Creates LLM Gateway configuration from environment variables
 */

import { LLMProvider, LLMGatewayConfig, LLMModel, createDefaultConfig } from '@axon/llm-gateway';
import { validateEnv } from '@axon/shared';

/**
 * Map environment provider string to LLMProvider enum
 */
function mapProviderString(provider: string): LLMProvider {
  switch (provider.toLowerCase()) {
    case 'openai':
      return LLMProvider.OPENAI;
    case 'ollama':
      return LLMProvider.OLLAMA;
    case 'anthropic':
      return LLMProvider.ANTHROPIC;
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}

/**
 * Map model string to LLMModel enum
 */
function mapModelString(model: string): LLMModel {
  const modelMap: Record<string, LLMModel> = {
    'gpt-3.5-turbo': LLMModel.GPT_35_TURBO,
    'gpt-4': LLMModel.GPT_4,
    'gpt-4o': LLMModel.GPT_4O,
    'gpt-4-turbo': LLMModel.GPT_4_TURBO,
    'claude-3-opus': LLMModel.CLAUDE_3_OPUS,
    'claude-3-sonnet': LLMModel.CLAUDE_3_SONNET,
    'claude-3-haiku': LLMModel.CLAUDE_3_HAIKU,
    llama3: LLMModel.LLAMA_3,
    'llama3.2:1b': LLMModel.LLAMA_3,
  };

  return modelMap[model] || LLMModel.GPT_35_TURBO;
}

/**
 * Create LLM Gateway configuration from environment variables
 */
export function createLLMGatewayConfig(): LLMGatewayConfig {
  const env = validateEnv();

  const provider = mapProviderString(env.LLM_PROVIDER);

  // Select API key and base URL based on provider
  let apiKey = '';
  let baseUrl: string | undefined;
  let model: LLMModel;

  switch (provider) {
    case LLMProvider.OPENAI:
      apiKey = env.OPENAI_API_KEY;
      model = mapModelString(env.OPENAI_MODEL);
      break;

    case LLMProvider.OLLAMA:
      // Ollama doesn't need an API key
      apiKey = 'not-required';
      baseUrl = env.OLLAMA_BASE_URL;
      model = mapModelString(env.OLLAMA_MODEL);
      break;

    case LLMProvider.ANTHROPIC:
      apiKey = env.ANTHROPIC_API_KEY;
      model = LLMModel.CLAUDE_3_SONNET;
      break;

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }

  return createDefaultConfig(provider, apiKey, {
    baseUrl,
    defaultModel: model,
    timeout: 60000,
    enableCaching: true,
    cacheTTL: 3600,
    rateLimit: {
      enabled: provider !== LLMProvider.OLLAMA, // No rate limit for local Ollama
      requestsPerMinute: 60,
      tokensPerMinute: 90000,
    },
    circuitBreaker: {
      enabled: true,
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000,
    },
  });
}
