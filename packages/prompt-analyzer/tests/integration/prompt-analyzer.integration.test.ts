/**
 * Integration Tests for PromptAnalyzer
 * 
 * Tests the complete prompt analysis pipeline with all components working together.
 */

import { PromptAnalyzer } from '../../src/prompt-analyzer';
import { IntentCategory, TaskCategory, EntityType } from '../../src/types';

describe('PromptAnalyzer Integration Tests', () => {
  let analyzer: PromptAnalyzer;

  beforeEach(() => {
    analyzer = new PromptAnalyzer();
  });

  afterEach(() => {
    analyzer.clearCache();
  });

  describe('Coding Workspace Scenarios', () => {
    test('should analyze a bug fix request correctly', async () => {
      const prompt = 'Fix the error in the handleClick function that throws TypeError when user is null';
      
      const result = await analyzer.analyze(prompt, {
        workspaceType: 'coding',
      });

      // Verify intent classification
      expect(result.intent.category).toBe(IntentCategory.CODING);
      expect(result.intent.confidence).toBeGreaterThan(0.5);

      // Verify task type
      expect(result.taskType.primary.category).toBe(TaskCategory.BUG_FIX);
      expect(result.taskType.primary.confidence).toBeGreaterThan(0.5);

      // Verify entity extraction
      const functionEntities = result.entities.filter(e => e.type === EntityType.FUNCTION_NAME);
      expect(functionEntities.length).toBeGreaterThan(0);
      expect(functionEntities.some(e => e.value.includes('handleClick'))).toBe(true);

      const errorEntities = result.entities.filter(e => e.type === EntityType.ERROR_MESSAGE);
      expect(errorEntities.length).toBeGreaterThan(0);

      // Verify metadata
      expect(result.metadata.hasCodeSnippets).toBe(false); // No code blocks
      expect(result.metadata.wordCount).toBeGreaterThan(5);
      expect(result.metadata.complexity).toBeDefined();

      // Verify performance
      expect(result.metrics.processingTimeMs).toBeLessThan(200);
    });

    test('should analyze a feature addition request', async () => {
      const prompt = `Add a new React component called UserProfile that displays user information.
      It should accept props for name, email, and avatar URL.`;
      
      const result = await analyzer.analyze(prompt, {
        workspaceType: 'coding',
      });

      // Verify intent
      expect(result.intent.category).toBe(IntentCategory.CODING);

      // Verify task type
      expect(result.taskType.primary.category).toBe(TaskCategory.FEATURE_ADD);

      // Verify entities
      const componentEntities = result.entities.filter(e => 
        e.type === EntityType.CLASS_NAME || e.type === EntityType.CONCEPT
      );
      expect(componentEntities.length).toBeGreaterThan(0);

      const techEntities = result.entities.filter(e => 
        e.type === EntityType.FRAMEWORK || e.type === EntityType.LIBRARY
      );
      expect(techEntities.some(e => e.value.toLowerCase().includes('react'))).toBe(true);

      // Verify no significant ambiguity
      expect(result.ambiguity.overallScore).toBeGreaterThan(0.5);
    });

    test('should detect ambiguity in vague requests', async () => {
      const prompt = 'Make it better';
      
      const result = await analyzer.analyze(prompt);

      // Should detect high ambiguity
      expect(result.ambiguity.isAmbiguous).toBe(true);
      expect(result.ambiguity.overallScore).toBeLessThan(0.5);
      expect(result.ambiguity.ambiguities.length).toBeGreaterThan(0);

      // Check metadata
      expect(result.metadata.complexity).toBe('simple');
      expect(result.metadata.wordCount).toBe(3);
    });

    test('should extract multiple entities from complex prompt', async () => {
      const prompt = `Refactor the UserService class to use TypeScript interfaces.
      Update the fetchUserData function to handle errors properly using try-catch.
      Also add proper type definitions for the User and Profile classes.`;
      
      const result = await analyzer.analyze(prompt);

      // Should be coding intent
      expect(result.intent.category).toBe(IntentCategory.CODING);

      // Should detect multiple tasks
      expect(result.taskType.isMultiTask).toBe(true);
      expect(result.taskType.primary.category).toBe(TaskCategory.REFACTOR);

      // Should extract multiple entities
      const classEntities = result.entities.filter(e => e.type === EntityType.CLASS_NAME);
      expect(classEntities.length).toBeGreaterThan(1);

      const functionEntities = result.entities.filter(e => e.type === EntityType.FUNCTION_NAME);
      expect(functionEntities.length).toBeGreaterThan(0);

      const techEntities = result.entities.filter(e => e.type === EntityType.TECHNOLOGY);
      expect(techEntities.some(e => e.value.toLowerCase().includes('typescript'))).toBe(true);

      // Should be moderate/complex
      expect(['moderate', 'complex']).toContain(result.metadata.complexity);
    });

    test('should handle code snippets in prompt', async () => {
      const prompt = `
        How can I fix this code?
        \`\`\`typescript
        function calculateTotal(items: Item[]): number {
          return items.reduce((sum, item) => sum + item.price);
        }
        \`\`\`
      `;
      
      const result = await analyzer.analyze(prompt);

      // Verify metadata detects code
      expect(result.metadata.hasCodeSnippets).toBe(true);
      expect(result.metadata.hasQuestions).toBe(true);

      // Should extract code entities
      const codeEntities = result.entities.filter(e => e.type === EntityType.CODE_SNIPPET);
      expect(codeEntities.length).toBeGreaterThan(0);

      const functionEntities = result.entities.filter(e => e.type === EntityType.FUNCTION_NAME);
      expect(functionEntities.some(e => e.value.includes('calculateTotal'))).toBe(true);
    });
  });

  describe('PKM Workspace Scenarios', () => {
    test('should classify PKM intent correctly', async () => {
      const prompt = 'Create a new note about machine learning concepts and link it to my AI research project';
      
      const result = await analyzer.analyze(prompt, {
        workspaceType: 'pkm',
      });

      // Should detect PKM intent
      expect(result.intent.category).toBe(IntentCategory.PKM);

      // Should have PKM-related entities
      const conceptEntities = result.entities.filter(e => e.type === EntityType.CONCEPT);
      expect(conceptEntities.length).toBeGreaterThan(0);
    });
  });

  describe('General Query Scenarios', () => {
    test('should handle general questions', async () => {
      const prompt = 'What is the best way to learn programming?';
      
      const result = await analyzer.analyze(prompt);

      // Could be general or coding intent
      expect([IntentCategory.GENERAL, IntentCategory.CODING]).toContain(result.intent.category);

      // Should detect question
      expect(result.metadata.hasQuestions).toBe(true);

      // Should be simple
      expect(result.metadata.complexity).toBe('simple');
    });

    test('should detect conflicting requirements', async () => {
      const prompt = 'Make it faster but also add more features that will slow it down';
      
      const result = await analyzer.analyze(prompt);

      // Should detect ambiguity
      expect(result.ambiguity.isAmbiguous).toBe(true);
      
      // Should detect conflicting requirements
      const conflicts = result.ambiguity.ambiguities.filter(
        a => a.type === 'conflicting_requirements'
      );
      expect(conflicts.length).toBeGreaterThan(0);
    });
  });

  describe('Caching Functionality', () => {
    test('should cache and reuse analysis results', async () => {
      const prompt = 'Fix the login bug in AuthService';
      
      // First analysis
      const result1 = await analyzer.analyze(prompt);
      const time1 = result1.metrics.processingTimeMs;

      // Second analysis (should hit cache)
      const result2 = await analyzer.analyze(prompt);
      const time2 = result2.metrics.processingTimeMs;

      // Results should be identical
      expect(result1.intent).toEqual(result2.intent);
      expect(result1.taskType).toEqual(result2.taskType);
      expect(result1.entities).toEqual(result2.entities);

      // Cache hit should be faster (though both should be fast)
      // Just verify both are under 200ms
      expect(time1).toBeLessThan(200);
      expect(time2).toBeLessThan(200);
    });

    test('should provide cache statistics', () => {
      const stats = analyzer.getCacheStats();
      
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
      expect(stats.maxSize).toBe(1000);
    });

    test('should clear cache when requested', async () => {
      await analyzer.analyze('Test prompt');
      
      let stats = analyzer.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);

      analyzer.clearCache();
      
      stats = analyzer.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('Batch Analysis', () => {
    test('should analyze multiple prompts in batch', async () => {
      const prompts = [
        'Fix the bug in handleSubmit',
        'Add user authentication',
        'Refactor the database queries',
      ];

      const results = await analyzer.analyzeBatch(prompts);

      expect(results.length).toBe(3);
      expect(results[0].taskType.primary.category).toBe(TaskCategory.BUG_FIX);
      expect(results[1].taskType.primary.category).toBe(TaskCategory.FEATURE_ADD);
      expect(results[2].taskType.primary.category).toBe(TaskCategory.REFACTOR);

      // All should be fast
      results.forEach(result => {
        expect(result.metrics.processingTimeMs).toBeLessThan(200);
      });
    });
  });

  describe('Custom Patterns', () => {
    test('should support adding custom task type patterns', () => {
      analyzer.addTaskTypeKeywords(TaskCategory.OPTIMIZATION, ['speedup', 'accelerate'], 0.8);

      // This should not throw
      expect(() => {
        analyzer.getConfig();
      }).not.toThrow();
    });
  });

  describe('Configuration', () => {
    test('should allow configuration updates', () => {
      const initialConfig = analyzer.getConfig();
      expect(initialConfig.caching?.enabled).toBe(true);

      analyzer.updateConfig({
        caching: {
          enabled: false,
        },
      });

      const updatedConfig = analyzer.getConfig();
      expect(updatedConfig.caching?.enabled).toBe(false);
    });

    test('should initialize with custom configuration', () => {
      const customAnalyzer = new PromptAnalyzer({
        intent: {
          minConfidence: 0.7,
          enableMultiIntent: true,
        },
        caching: {
          enabled: false,
        },
      });

      const config = customAnalyzer.getConfig();
      expect(config.intent.minConfidence).toBe(0.7);
      expect(config.caching?.enabled).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should throw error for empty prompt', async () => {
      await expect(analyzer.analyze('')).rejects.toThrow('Prompt cannot be empty');
      await expect(analyzer.analyze('   ')).rejects.toThrow('Prompt cannot be empty');
    });
  });

  describe('Performance Benchmarks', () => {
    test('should meet <200ms latency target for typical prompts', async () => {
      const testPrompts = [
        'Fix the bug in UserService',
        'Add authentication to the API',
        'Refactor the database layer',
        'Write tests for the payment module',
        'Deploy the application to production',
      ];

      for (const prompt of testPrompts) {
        const result = await analyzer.analyze(prompt);
        expect(result.metrics.processingTimeMs).toBeLessThan(200);
      }
    });

    test('should handle complex prompts under 300ms', async () => {
      const complexPrompt = `
        Refactor the entire UserService class to use dependency injection.
        Update all the methods (fetchUser, updateUser, deleteUser, createUser) to use async/await.
        Add proper error handling with try-catch blocks and custom error classes.
        Write comprehensive unit tests using Jest for all methods.
        Update the TypeScript interfaces to use stricter types.
        Add JSDoc comments for all public methods.
        Ensure backward compatibility with the old API.
      `;

      const result = await analyzer.analyze(complexPrompt);
      
      // Complex prompts can take slightly longer but should still be reasonable
      expect(result.metrics.processingTimeMs).toBeLessThan(300);
      expect(result.metadata.complexity).toBe('complex');
    });
  });
});
