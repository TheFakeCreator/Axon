/**
 * Token limits utility tests
 */

import { describe, it, expect } from 'vitest';
import {
  estimateTokenCount,
  calculateContextBudget,
  validateTokenBudget,
  MODEL_CONTEXT_LIMITS,
} from '../src/constants/token-limits';
import { LLMModel } from '../src/types';

describe('Token Limits', () => {
  describe('estimateTokenCount', () => {
    it('should estimate token count for text', () => {
      const text = 'This is a test message';
      const tokens = estimateTokenCount(text);
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(text.length);
    });

    it('should handle empty string', () => {
      expect(estimateTokenCount('')).toBe(0);
    });
  });

  describe('calculateContextBudget', () => {
    it('should calculate available context budget', () => {
      const modelLimit = MODEL_CONTEXT_LIMITS[LLMModel.GPT4];
      const userPromptTokens = 100;
      const budget = calculateContextBudget(modelLimit, userPromptTokens, true);
      
      expect(budget).toBeGreaterThan(0);
      expect(budget).toBeLessThan(modelLimit);
    });

    it('should reserve tokens for response when specified', () => {
      const modelLimit = MODEL_CONTEXT_LIMITS[LLMModel.GPT4];
      const userPromptTokens = 100;
      
      const withReserve = calculateContextBudget(modelLimit, userPromptTokens, true);
      const withoutReserve = calculateContextBudget(modelLimit, userPromptTokens, false);
      
      expect(withoutReserve).toBeGreaterThan(withReserve);
    });
  });

  describe('validateTokenBudget', () => {
    it('should validate within budget', () => {
      const result = validateTokenBudget(5000, 8000);
      expect(result.valid).toBe(true);
      expect(result.excess).toBeUndefined();
    });

    it('should detect budget exceeded', () => {
      const result = validateTokenBudget(10000, 8000);
      expect(result.valid).toBe(false);
      expect(result.excess).toBe(2000);
    });
  });
});
