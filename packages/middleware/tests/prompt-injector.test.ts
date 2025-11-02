/**
 * Tests for PromptInjector Service
 * 
 * Tests injection strategies, prompt construction, and token validation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TaskCategory } from '@axon/shared';
import { PromptInjector, TokenLimitError } from '../src/services/prompt-injector.js';
import type {
  EnrichedPrompt,
  SynthesizedContext,
  ContextSection,
  ContextSource,
} from '../src/types.js';

describe('PromptInjector', () => {
  let injector: PromptInjector;

  beforeEach(() => {
    injector = new PromptInjector({ enableLogging: false });
  });

  // Helper to create mock enriched prompt
  const createMockPrompt = (prompt: string): EnrichedPrompt => ({
    originalPrompt: prompt,
    workspaceId: 'test-workspace',
    requestId: 'req-123',
    timestamp: new Date(),
    metadata: {
      source: 'api',
    },
  });

  // Helper to create mock synthesized context
  const createMockContext = (sections: Partial<ContextSection>[] = []): SynthesizedContext => {
    const fullSections: ContextSection[] = sections.map((s, i) => ({
      type: s.type || 'file',
      title: s.title || `Context ${i + 1}`,
      content: s.content || 'Test content',
      tokens: s.tokens || 10,
      relevance: s.relevance || 0.9,
      contextId: s.contextId || `ctx-${i + 1}`,
    }));

    const sources: ContextSource[] = fullSections.map(s => ({
      contextId: s.contextId,
      source: s.title,
      score: s.relevance,
    }));

    return {
      sections: fullSections,
      totalTokens: fullSections.reduce((sum, s) => sum + s.tokens, 0),
      budgetRemaining: 1000,
      sources,
    };
  };

  describe('inject()', () => {
    it('should inject context successfully', async () => {
      const prompt = createMockPrompt('Fix the bug in authentication');
      const context = createMockContext([
        { title: 'auth.ts', content: 'function login() {}' },
      ]);

      const result = await injector.inject(
        prompt,
        context,
        TaskCategory.BUG_FIX
      );

      expect(result).toBeDefined();
      expect(result.systemPrompt).toBeTruthy();
      expect(result.userPrompt).toBeTruthy();
      expect(result.totalTokens).toBeGreaterThan(0);
      expect(result.contextSections).toHaveLength(1);
    });

    it('should include original prompt in user prompt', async () => {
      const prompt = createMockPrompt('Help me write tests');
      const context = createMockContext([]);

      const result = await injector.inject(
        prompt,
        context,
        TaskCategory.TESTING
      );

      expect(result.userPrompt).toContain('Help me write tests');
    });

    it('should calculate total tokens correctly', async () => {
      const prompt = createMockPrompt('a'.repeat(400)); // ~100 tokens
      const context = createMockContext([
        { content: 'b'.repeat(400) }, // ~100 tokens
      ]);

      const result = await injector.inject(
        prompt,
        context,
        TaskCategory.GENERAL_QUERY
      );

      // Should be roughly 200+ tokens (accounting for formatting)
      expect(result.totalTokens).toBeGreaterThan(150);
      expect(result.totalTokens).toBeLessThan(500);
    });

    it('should throw TokenLimitError when exceeding max tokens', async () => {
      const smallInjector = new PromptInjector({
        maxTokens: 100,
        enableLogging: false,
      });

      const prompt = createMockPrompt('a'.repeat(1000)); // ~250 tokens
      const context = createMockContext([
        { content: 'b'.repeat(1000) }, // ~250 tokens
      ]);

      await expect(
        smallInjector.inject(prompt, context, TaskCategory.GENERAL_QUERY)
      ).rejects.toThrow(TokenLimitError);
    });

    it('should respect custom injection strategy', async () => {
      const prompt = createMockPrompt('Test prompt');
      const context = createMockContext([
        { title: 'test.ts', content: 'const x = 1;' },
      ]);

      const prefixResult = await injector.inject(
        prompt,
        context,
        TaskCategory.GENERAL_QUERY,
        'prefix'
      );

      const inlineResult = await injector.inject(
        prompt,
        context,
        TaskCategory.GENERAL_QUERY,
        'inline'
      );

      // Prefix: context in system prompt
      expect(prefixResult.systemPrompt).toContain('test.ts');
      expect(prefixResult.userPrompt).not.toContain('test.ts');

      // Inline: context in user prompt
      expect(inlineResult.userPrompt).toContain('test.ts');
    });
  });

  describe('injection strategies', () => {
    it('should use prefix strategy: all context in system prompt', async () => {
      const prompt = createMockPrompt('What is this?');
      const context = createMockContext([
        { title: 'file.ts', content: 'console.log("test");' },
      ]);

      const result = await injector.inject(
        prompt,
        context,
        TaskCategory.GENERAL_QUERY,
        'prefix'
      );

      // Context should be in system prompt
      expect(result.systemPrompt).toContain('file.ts');
      expect(result.systemPrompt).toContain('console.log("test");');

      // User prompt should only have the original prompt
      expect(result.userPrompt).toBe('What is this?');
      expect(result.userPrompt).not.toContain('file.ts');
    });

    it('should use inline strategy: context with user prompt', async () => {
      const prompt = createMockPrompt('Review this code');
      const context = createMockContext([
        { title: 'app.ts', content: 'function main() {}' },
      ]);

      const result = await injector.inject(
        prompt,
        context,
        TaskCategory.CODE_REVIEW,
        'inline'
      );

      // Context should be in user prompt
      expect(result.userPrompt).toContain('app.ts');
      expect(result.userPrompt).toContain('function main() {}');
      expect(result.userPrompt).toContain('Review this code');

      // System prompt should NOT have context sections
      expect(result.systemPrompt).not.toContain('app.ts');
    });

    it('should use suffix strategy: context after user prompt', async () => {
      const prompt = createMockPrompt('Explain this');
      const context = createMockContext([
        { title: 'util.ts', content: 'export const helper = () => {}' },
      ]);

      const result = await injector.inject(
        prompt,
        context,
        TaskCategory.GENERAL_QUERY,
        'suffix'
      );

      // User prompt should have both original prompt and context
      expect(result.userPrompt).toContain('Explain this');
      expect(result.userPrompt).toContain('util.ts');

      // Context should appear after the original prompt
      const promptIndex = result.userPrompt.indexOf('Explain this');
      const contextIndex = result.userPrompt.indexOf('util.ts');
      expect(contextIndex).toBeGreaterThan(promptIndex);
    });

    it('should use hybrid strategy: split context between system and user', async () => {
      const prompt = createMockPrompt('Fix the authentication bug');
      const context = createMockContext([
        { title: 'auth.ts', content: 'function login() {}' },
        { title: 'user.ts', content: 'class User {}' },
        { title: 'session.ts', content: 'class Session {}' },
      ]);

      const result = await injector.inject(
        prompt,
        context,
        TaskCategory.BUG_FIX,
        'hybrid'
      );

      // System prompt should have some context
      expect(result.systemPrompt).toContain('Relevant Context');

      // User prompt should have some context (limited to 2 sections in hybrid mode)
      expect(result.userPrompt).toContain('Relevant Context');
      expect(result.userPrompt).toContain('Fix the authentication bug');
    });
  });

  describe('task-specific strategies', () => {
    it('should select hybrid strategy for bug fixes', async () => {
      const prompt = createMockPrompt('Fix error');
      const context = createMockContext([{ title: 'test.ts' }]);

      const result = await injector.inject(
        prompt,
        context,
        TaskCategory.BUG_FIX
      );

      // Hybrid should have context in both system and user prompts
      expect(result.systemPrompt).toContain('Relevant Context');
      expect(result.userPrompt).toContain('Relevant Context');
    });

    it('should select inline strategy for code reviews', async () => {
      const prompt = createMockPrompt('Review this');
      const context = createMockContext([{ title: 'code.ts' }]);

      const result = await injector.inject(
        prompt,
        context,
        TaskCategory.CODE_REVIEW
      );

      // Inline should have context in user prompt
      expect(result.userPrompt).toContain('code.ts');
    });

    it('should select prefix strategy for general queries', async () => {
      const prompt = createMockPrompt('What is this?');
      const context = createMockContext([{ title: 'file.ts' }]);

      const result = await injector.inject(
        prompt,
        context,
        TaskCategory.GENERAL_QUERY
      );

      // Prefix should have context in system prompt only
      expect(result.systemPrompt).toContain('file.ts');
      expect(result.userPrompt).not.toContain('file.ts');
    });
  });

  describe('task-specific system prompts', () => {
    it('should include bug fix instructions', async () => {
      const prompt = createMockPrompt('Fix this');
      const context = createMockContext([]);

      const result = await injector.inject(
        prompt,
        context,
        TaskCategory.BUG_FIX
      );

      expect(result.systemPrompt).toContain('debugging assistant');
      expect(result.systemPrompt).toContain('root cause');
    });

    it('should include feature addition instructions', async () => {
      const prompt = createMockPrompt('Add feature');
      const context = createMockContext([]);

      const result = await injector.inject(
        prompt,
        context,
        TaskCategory.FEATURE_ADD
      );

      expect(result.systemPrompt).toContain('software engineer');
      expect(result.systemPrompt).toContain('best practices');
    });

    it('should include code review instructions', async () => {
      const prompt = createMockPrompt('Review');
      const context = createMockContext([]);

      const result = await injector.inject(
        prompt,
        context,
        TaskCategory.CODE_REVIEW
      );

      expect(result.systemPrompt).toContain('code reviewer');
      expect(result.systemPrompt).toContain('bugs');
    });

    it('should include testing instructions', async () => {
      const prompt = createMockPrompt('Write tests');
      const context = createMockContext([]);

      const result = await injector.inject(
        prompt,
        context,
        TaskCategory.TESTING
      );

      expect(result.systemPrompt).toContain('testing expert');
      expect(result.systemPrompt).toContain('edge cases');
    });

    it('should use generic prompt for unknown task types', async () => {
      const prompt = createMockPrompt('Help');
      const context = createMockContext([]);

      const result = await injector.inject(
        prompt,
        context,
        TaskCategory.GENERAL_QUERY
      );

      expect(result.systemPrompt).toContain('AI programming assistant');
    });
  });

  describe('context formatting', () => {
    it('should format multiple context sections', async () => {
      const prompt = createMockPrompt('Test');
      const context = createMockContext([
        { title: 'File 1', content: 'Content 1' },
        { title: 'File 2', content: 'Content 2' },
      ]);

      const result = await injector.inject(
        prompt,
        context,
        TaskCategory.GENERAL_QUERY,
        'prefix'
      );

      expect(result.systemPrompt).toContain('File 1');
      expect(result.systemPrompt).toContain('Content 1');
      expect(result.systemPrompt).toContain('File 2');
      expect(result.systemPrompt).toContain('Content 2');
    });

    it('should include source attribution with suffix strategy', async () => {
      const prompt = createMockPrompt('Test');
      const context = createMockContext([
        { title: 'test.ts', content: 'code', relevance: 0.95 },
      ]);

      const result = await injector.inject(
        prompt,
        context,
        TaskCategory.GENERAL_QUERY,
        'suffix'
      );

      // Suffix strategy should include sources
      expect(result.userPrompt).toContain('Sources:');
      expect(result.userPrompt).toContain('95.0%');
    });

    it('should handle empty context sections', async () => {
      const prompt = createMockPrompt('Test');
      const context = createMockContext([]);

      const result = await injector.inject(
        prompt,
        context,
        TaskCategory.GENERAL_QUERY
      );

      // Should still work with no context
      expect(result.systemPrompt).toBeDefined();
      expect(result.userPrompt).toBe('Test');
    });

    it('should limit sections in hybrid mode', async () => {
      const prompt = createMockPrompt('Test');
      const context = createMockContext([
        { title: 'File 1' },
        { title: 'File 2' },
        { title: 'File 3' },
        { title: 'File 4' },
      ]);

      const result = await injector.inject(
        prompt,
        context,
        TaskCategory.GENERAL_QUERY,
        'hybrid'
      );

      // Hybrid limits user context to 2 sections
      const userContextMatches = (result.userPrompt.match(/###/g) || []).length;
      expect(userContextMatches).toBeLessThanOrEqual(2);
    });
  });

  describe('configuration', () => {
    it('should use custom default strategy', async () => {
      const customInjector = new PromptInjector({
        defaultStrategy: 'inline',
        enableLogging: false,
      });

      const prompt = createMockPrompt('Test');
      const context = createMockContext([{ title: 'file.ts' }]);

      // Use a task that would normally use 'prefix', but our default is 'inline'
      // Since we're not overriding, it should use task-specific strategy
      const result = await customInjector.inject(
        prompt,
        context,
        TaskCategory.GENERAL_QUERY // This normally uses 'prefix'
      );

      // Should use task-specific strategy (prefix) not default
      expect(result.systemPrompt).toContain('file.ts');
    });

    it('should respect custom max tokens', async () => {
      const smallInjector = new PromptInjector({
        maxTokens: 200,
        enableLogging: false,
      });

      const prompt = createMockPrompt('a'.repeat(800)); // ~200 tokens
      const context = createMockContext([
        { content: 'b'.repeat(800) }, // ~200 tokens
      ]);

      await expect(
        smallInjector.inject(prompt, context, TaskCategory.GENERAL_QUERY)
      ).rejects.toThrow(TokenLimitError);
    });
  });

  describe('TokenLimitError', () => {
    it('should provide actual and max tokens in error', async () => {
      const smallInjector = new PromptInjector({
        maxTokens: 50,
        enableLogging: false,
      });

      const prompt = createMockPrompt('a'.repeat(1000));
      const context = createMockContext([]);

      try {
        await smallInjector.inject(prompt, context, TaskCategory.GENERAL_QUERY);
        expect.fail('Should have thrown TokenLimitError');
      } catch (error) {
        expect(error).toBeInstanceOf(TokenLimitError);
        const tokenError = error as TokenLimitError;
        expect(tokenError.actualTokens).toBeGreaterThan(50);
        expect(tokenError.maxTokens).toBe(50);
        expect(tokenError.message).toContain('exceeds token limit');
      }
    });
  });

  describe('context sections preservation', () => {
    it('should preserve all context sections in result', async () => {
      const prompt = createMockPrompt('Test');
      const context = createMockContext([
        { title: 'Section 1', contextId: 'ctx-1' },
        { title: 'Section 2', contextId: 'ctx-2' },
      ]);

      const result = await injector.inject(
        prompt,
        context,
        TaskCategory.GENERAL_QUERY
      );

      expect(result.contextSections).toHaveLength(2);
      expect(result.contextSections[0].contextId).toBe('ctx-1');
      expect(result.contextSections[1].contextId).toBe('ctx-2');
    });
  });
});
