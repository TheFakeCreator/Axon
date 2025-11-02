/**
 * Token limit constants for different models and operations
 */

import { LLMModel } from '../types';

/**
 * Maximum context tokens per model
 */
export const MODEL_CONTEXT_LIMITS: Record<LLMModel, number> = {
  [LLMModel.GPT4]: 8192,
  [LLMModel.GPT4_TURBO]: 128000,
  [LLMModel.GPT35_TURBO]: 16385,
  [LLMModel.CLAUDE_3_OPUS]: 200000,
  [LLMModel.CLAUDE_3_SONNET]: 200000,
  [LLMModel.LLAMA3]: 8192,
};

/**
 * Default token budget allocation (percentage of total context)
 */
export const TOKEN_BUDGET_ALLOCATION = {
  SYSTEM_MESSAGE: 0.05, // 5% for system instructions
  USER_PROMPT: 0.15, // 15% for user prompt
  INJECTED_CONTEXT: 0.60, // 60% for context injection
  RESPONSE_RESERVE: 0.20, // 20% reserved for response generation
};

/**
 * Minimum tokens required per component
 */
export const MIN_TOKEN_REQUIREMENTS = {
  SYSTEM_MESSAGE: 100,
  USER_PROMPT: 50,
  INJECTED_CONTEXT: 500,
  RESPONSE: 500,
};

/**
 * Maximum tokens for different context types
 */
export const CONTEXT_TYPE_TOKEN_LIMITS = {
  FILE_CONTENT: 2000,
  DOCUMENTATION: 1500,
  ERROR_CONTEXT: 500,
  DEPENDENCY_INFO: 300,
  CONVERSATION_HISTORY: 1000,
};

/**
 * Token counting approximation (rough estimate)
 * More accurate counting should use tiktoken or similar
 */
export const CHARS_PER_TOKEN = 4; // Average for English text

/**
 * Estimate token count from text
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Calculate available tokens for context injection
 */
export function calculateContextBudget(
  modelLimit: number,
  userPromptTokens: number,
  reserveForResponse: boolean = true
): number {
  const systemTokens = Math.max(
    modelLimit * TOKEN_BUDGET_ALLOCATION.SYSTEM_MESSAGE,
    MIN_TOKEN_REQUIREMENTS.SYSTEM_MESSAGE
  );

  const responseReserve = reserveForResponse
    ? Math.max(
        modelLimit * TOKEN_BUDGET_ALLOCATION.RESPONSE_RESERVE,
        MIN_TOKEN_REQUIREMENTS.RESPONSE
      )
    : 0;

  const availableForContext =
    modelLimit - systemTokens - userPromptTokens - responseReserve;

  return Math.max(availableForContext, MIN_TOKEN_REQUIREMENTS.INJECTED_CONTEXT);
}

/**
 * Validate token budget
 */
export function validateTokenBudget(
  totalTokens: number,
  modelLimit: number
): { valid: boolean; excess?: number } {
  if (totalTokens <= modelLimit) {
    return { valid: true };
  }
  return {
    valid: false,
    excess: totalTokens - modelLimit,
  };
}
