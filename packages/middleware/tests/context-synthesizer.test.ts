/**
 * Tests for ContextSynthesizer Service
 * 
 * Tests token budgeting, context prioritization, compression, and formatting.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TaskCategory, ContextTier, ContextType } from '@axon/shared';
import type { ScoredContext } from '@axon/context-engine';
import { ContextSynthesizer } from '../src/services/context-synthesizer.js';
import type { TokenBudget } from '../src/types.js';

describe('ContextSynthesizer', () => {
  let synthesizer: ContextSynthesizer;

  beforeEach(() => {
    synthesizer = new ContextSynthesizer({ enableLogging: false });
  });

  // Helper to create mock contexts
  const createMockContext = (
    id: string,
    type: string,
    content: string,
    score: number,
    metadata?: Record<string, unknown>
  ): ScoredContext => ({
    id,
    type: type as ContextType,
    content,
    tier: ContextTier.WORKSPACE,
    score,
    workspaceId: 'test-workspace',
    metadata: metadata || {},
    createdAt: new Date(),
    lastAccessed: new Date(),
  });

  describe('synthesize()', () => {
    it('should synthesize contexts within token budget', async () => {
      const contexts: ScoredContext[] = [
        createMockContext('ctx1', 'file', 'console.log("test");', 0.9, {
          filePath: 'test.ts',
          language: 'typescript',
        }),
        createMockContext('ctx2', 'symbol', 'function test() {}', 0.85),
        createMockContext('ctx3', 'documentation', 'API documentation here', 0.8),
      ];

      const result = await synthesizer.synthesize(
        contexts,
        TaskCategory.GENERAL_QUERY
      );

      expect(result).toBeDefined();
      expect(result.sections).toHaveLength(3);
      expect(result.totalTokens).toBeGreaterThan(0);
      expect(result.sources).toHaveLength(3);
    });

    it('should respect custom token budget', async () => {
      const contexts: ScoredContext[] = [
        createMockContext('ctx1', 'file', 'a'.repeat(4000), 0.9), // ~1000 tokens
        createMockContext('ctx2', 'file', 'b'.repeat(4000), 0.85), // ~1000 tokens
      ];

      const customBudget: TokenBudget = {
        total: 2048,
        responseReserve: 1024,
        contextBudget: 1024,
        allocation: {
          file: 1024,
          symbol: 0,
          documentation: 0,
          conversation: 0,
          error: 0,
          architecture: 0,
        },
      };

      const result = await synthesizer.synthesize(
        contexts,
        TaskCategory.GENERAL_QUERY,
        customBudget
      );

      // Should only include one context due to budget
      expect(result.sections.length).toBeLessThanOrEqual(1);
      expect(result.totalTokens).toBeLessThanOrEqual(customBudget.contextBudget);
    });

    it('should prioritize higher-scored contexts', async () => {
      const contexts: ScoredContext[] = [
        createMockContext('low', 'file', 'low priority', 0.3),
        createMockContext('high', 'file', 'high priority', 0.95),
        createMockContext('medium', 'file', 'medium priority', 0.6),
      ];

      const result = await synthesizer.synthesize(
        contexts,
        TaskCategory.GENERAL_QUERY
      );

      // High-scored context should be first
      expect(result.sections[0].contextId).toBe('high');
      expect(result.sections[0].relevance).toBe(0.95);
    });

    it('should include source attribution', async () => {
      const contexts: ScoredContext[] = [
        createMockContext('ctx1', 'file', 'test content', 0.9, {
          filePath: 'src/test.ts',
        }),
      ];

      const result = await synthesizer.synthesize(
        contexts,
        TaskCategory.GENERAL_QUERY
      );

      expect(result.sources).toHaveLength(1);
      expect(result.sources[0]).toMatchObject({
        contextId: 'ctx1',
        source: 'src/test.ts',
        score: 0.9,
      });
    });

    it('should calculate budget remaining correctly', async () => {
      const contexts: ScoredContext[] = [
        createMockContext('ctx1', 'file', 'a'.repeat(400), 0.9), // ~100 tokens
      ];

      const result = await synthesizer.synthesize(
        contexts,
        TaskCategory.GENERAL_QUERY
      );

      expect(result.budgetRemaining).toBeGreaterThan(0);
      expect(result.totalTokens + result.budgetRemaining).toBeLessThanOrEqual(
        6144 // Default contextBudget
      );
    });
  });

  describe('task-specific token allocation', () => {
    it('should allocate more error tokens for bug fixes', async () => {
      const contexts: ScoredContext[] = [
        createMockContext('err1', 'error', 'TypeError: undefined', 0.9),
        createMockContext('err2', 'error', 'ReferenceError: foo', 0.85),
        createMockContext('doc1', 'documentation', 'API docs', 0.8),
      ];

      const bugFixResult = await synthesizer.synthesize(
        contexts,
        TaskCategory.BUG_FIX
      );

      const generalResult = await synthesizer.synthesize(
        contexts,
        TaskCategory.GENERAL_QUERY
      );

      // Bug fix should select more error contexts
      const bugFixErrorSections = bugFixResult.sections.filter(s => s.type === 'error');
      const generalErrorSections = generalResult.sections.filter(s => s.type === 'error');

      expect(bugFixErrorSections.length).toBeGreaterThanOrEqual(generalErrorSections.length);
    });

    it('should allocate more architecture tokens for features', async () => {
      const contexts: ScoredContext[] = [
        createMockContext('arch1', 'architecture', 'System design', 0.9),
        createMockContext('arch2', 'design', 'Module structure', 0.85),
        createMockContext('conv1', 'conversation', 'Chat history', 0.8),
      ];

      const featureResult = await synthesizer.synthesize(
        contexts,
        TaskCategory.FEATURE_ADD
      );

      const generalResult = await synthesizer.synthesize(
        contexts,
        TaskCategory.GENERAL_QUERY
      );

      // Feature add should include more architecture
      const featureArchSections = featureResult.sections.filter(
        s => s.type === 'architecture'
      );
      const generalArchSections = generalResult.sections.filter(
        s => s.type === 'architecture'
      );

      expect(featureArchSections.length).toBeGreaterThanOrEqual(generalArchSections.length);
    });

    it('should allocate more documentation tokens for documentation tasks', async () => {
      const contexts: ScoredContext[] = [
        createMockContext('doc1', 'documentation', 'README content', 0.9),
        createMockContext('doc2', 'docs', 'API reference', 0.85),
        createMockContext('sym1', 'symbol', 'function foo() {}', 0.8),
      ];

      const result = await synthesizer.synthesize(
        contexts,
        TaskCategory.DOCUMENTATION
      );

      const docSections = result.sections.filter(s => s.type === 'documentation');
      
      // Should prioritize documentation contexts
      expect(docSections.length).toBeGreaterThan(0);
    });
  });

  describe('context formatting', () => {
    it('should format file contexts with code blocks', async () => {
      const contexts: ScoredContext[] = [
        createMockContext('ctx1', 'file', 'const x = 1;', 0.9, {
          filePath: 'test.ts',
          language: 'typescript',
        }),
      ];

      const result = await synthesizer.synthesize(
        contexts,
        TaskCategory.GENERAL_QUERY
      );

      expect(result.sections[0].content).toContain('```typescript');
      expect(result.sections[0].content).toContain('const x = 1;');
      expect(result.sections[0].content).toContain('**File:** `test.ts`');
    });

    it('should format symbol contexts with code blocks', async () => {
      const contexts: ScoredContext[] = [
        createMockContext('ctx1', 'symbol', 'function test() {}', 0.9, {
          symbolName: 'test',
          language: 'javascript',
        }),
      ];

      const result = await synthesizer.synthesize(
        contexts,
        TaskCategory.GENERAL_QUERY
      );

      expect(result.sections[0].content).toContain('```javascript');
      expect(result.sections[0].content).toContain('function test() {}');
    });

    it('should format documentation contexts without code blocks', async () => {
      const contexts: ScoredContext[] = [
        createMockContext('ctx1', 'documentation', 'This is documentation', 0.9),
      ];

      const result = await synthesizer.synthesize(
        contexts,
        TaskCategory.GENERAL_QUERY
      );

      expect(result.sections[0].content).not.toContain('```');
      expect(result.sections[0].content).toContain('This is documentation');
    });

    it('should include file paths in section titles', async () => {
      const contexts: ScoredContext[] = [
        createMockContext('ctx1', 'file', 'content', 0.9, {
          filePath: 'src/utils/helper.ts',
        }),
      ];

      const result = await synthesizer.synthesize(
        contexts,
        TaskCategory.GENERAL_QUERY
      );

      expect(result.sections[0].title).toContain('src/utils/helper.ts');
    });

    it('should include symbol names in section titles', async () => {
      const contexts: ScoredContext[] = [
        createMockContext('ctx1', 'symbol', 'function parse() {}', 0.9, {
          symbolName: 'parse',
          filePath: 'parser.ts',
        }),
      ];

      const result = await synthesizer.synthesize(
        contexts,
        TaskCategory.GENERAL_QUERY
      );

      expect(result.sections[0].title).toContain('parse');
      expect(result.sections[0].title).toContain('parser.ts');
    });
  });

  describe('context compression', () => {
    it('should compress large contexts when enabled', async () => {
      // Create content larger than compression threshold
      // Default threshold: 0.8 * 8192 = 6553.6 tokens
      // 1 token ≈ 4 chars, so need > 26214 chars to trigger compression
      const largeContent = 'a'.repeat(30000); // ~7500 tokens
      
      const contexts: ScoredContext[] = [
        createMockContext('ctx1', 'file', largeContent, 0.9),
      ];

      const result = await synthesizer.synthesize(
        contexts,
        TaskCategory.GENERAL_QUERY
      );

      // Should be truncated with ellipsis
      if (result.sections.length > 0) {
        expect(result.sections[0].content).toContain('...');
        expect(result.sections[0].content).toContain('[Content truncated for brevity]');
      }
    });

    it('should not compress when compression disabled', async () => {
      const largeContent = 'a'.repeat(2000); // 500 tokens - fits in budget
      const noCompressionSynthesizer = new ContextSynthesizer({
        enableCompression: false,
        enableLogging: false,
      });

      const contexts: ScoredContext[] = [
        createMockContext('ctx1', 'documentation', largeContent, 0.9),
      ];

      const result = await noCompressionSynthesizer.synthesize(
        contexts,
        TaskCategory.GENERAL_QUERY
      );

      // Should include full content (without truncation marker)
      expect(result.sections.length).toBeGreaterThan(0);
      expect(result.sections[0].content).not.toContain('[Content truncated for brevity]');
    });

    it('should not compress small contexts', async () => {
      const smallContent = 'Small content here';
      const contexts: ScoredContext[] = [
        createMockContext('ctx1', 'file', smallContent, 0.9),
      ];

      const result = await synthesizer.synthesize(
        contexts,
        TaskCategory.GENERAL_QUERY
      );

      expect(result.sections[0].content).not.toContain('[Content truncated for brevity]');
    });
  });

  describe('token estimation', () => {
    it('should estimate tokens correctly (4 chars per token)', async () => {
      const content = 'a'.repeat(400); // Should be ~100 tokens
      const contexts: ScoredContext[] = [
        createMockContext('ctx1', 'file', content, 0.9),
      ];

      const result = await synthesizer.synthesize(
        contexts,
        TaskCategory.GENERAL_QUERY
      );

      // Should be close to 100 tokens (accounting for formatting)
      expect(result.sections[0].tokens).toBeGreaterThan(80);
      expect(result.sections[0].tokens).toBeLessThan(150);
    });
  });

  describe('context type mapping', () => {
    it('should map code to file type', async () => {
      const contexts: ScoredContext[] = [
        createMockContext('ctx1', 'code', 'const x = 1;', 0.9),
      ];

      const result = await synthesizer.synthesize(
        contexts,
        TaskCategory.GENERAL_QUERY
      );

      expect(result.sections[0].type).toBe('file');
    });

    it('should map function/class to symbol type', async () => {
      const contexts: ScoredContext[] = [
        createMockContext('ctx1', 'function', 'function test() {}', 0.9),
        createMockContext('ctx2', 'class', 'class Foo {}', 0.85),
      ];

      const result = await synthesizer.synthesize(
        contexts,
        TaskCategory.GENERAL_QUERY
      );

      expect(result.sections[0].type).toBe('symbol');
      expect(result.sections[1].type).toBe('symbol');
    });

    it('should map chat to conversation type', async () => {
      const contexts: ScoredContext[] = [
        createMockContext('ctx1', 'chat', 'User said: help me', 0.9),
      ];

      const result = await synthesizer.synthesize(
        contexts,
        TaskCategory.GENERAL_QUERY
      );

      expect(result.sections[0].type).toBe('conversation');
    });

    it('should map diagnostic to error type', async () => {
      const contexts: ScoredContext[] = [
        createMockContext('ctx1', 'diagnostic', 'TypeError: undefined', 0.9),
      ];

      const result = await synthesizer.synthesize(
        contexts,
        TaskCategory.GENERAL_QUERY
      );

      expect(result.sections[0].type).toBe('error');
    });
  });

  describe('configuration', () => {
    it('should use custom default budget', () => {
      const customBudget: TokenBudget = {
        total: 4096,
        responseReserve: 1024,
        contextBudget: 3072,
        allocation: {
          file: 1000,
          symbol: 1000,
          documentation: 500,
          conversation: 300,
          error: 200,
          architecture: 72,
        },
      };

      const customSynthesizer = new ContextSynthesizer({
        defaultTokenBudget: customBudget,
        enableLogging: false,
      });

      expect(customSynthesizer).toBeDefined();
    });

    it('should respect compression threshold', async () => {
      // Very low threshold - should compress almost everything
      const lowThresholdSynthesizer = new ContextSynthesizer({
        compressionThreshold: 0.01,
        enableLogging: false,
      });

      const contexts: ScoredContext[] = [
        createMockContext('ctx1', 'file', 'a'.repeat(2000), 0.9),
      ];

      const result = await lowThresholdSynthesizer.synthesize(
        contexts,
        TaskCategory.GENERAL_QUERY
      );

      // Should compress even medium content
      expect(result.sections[0].content).toContain('[Content truncated for brevity]');
    });
  });

  describe('empty contexts', () => {
    it('should handle empty context array', async () => {
      const result = await synthesizer.synthesize(
        [],
        TaskCategory.GENERAL_QUERY
      );

      expect(result.sections).toHaveLength(0);
      expect(result.totalTokens).toBe(0);
      expect(result.sources).toHaveLength(0);
    });

    it('should handle contexts with no matching types', async () => {
      const contexts: ScoredContext[] = [
        createMockContext('ctx1', 'unknown-type', 'content', 0.9),
      ];

      const result = await synthesizer.synthesize(
        contexts,
        TaskCategory.GENERAL_QUERY
      );

      // Should still work, mapping to default 'file' type
      expect(result.sections).toHaveLength(1);
    });
  });

  describe('section relevance', () => {
    it('should preserve context scores as relevance', async () => {
      const contexts: ScoredContext[] = [
        createMockContext('ctx1', 'file', 'content1', 0.95),
        createMockContext('ctx2', 'file', 'content2', 0.75),
      ];

      const result = await synthesizer.synthesize(
        contexts,
        TaskCategory.GENERAL_QUERY
      );

      expect(result.sections[0].relevance).toBe(0.95);
      expect(result.sections[1].relevance).toBe(0.75);
    });
  });
});
