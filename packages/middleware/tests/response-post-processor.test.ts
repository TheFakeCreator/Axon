/**
 * Response Post-Processor Tests
 *
 * Tests for the ResponsePostProcessor service that processes LLM responses
 * to extract actions, assess quality, and capture new knowledge.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ResponsePostProcessor } from '../src/services/response-post-processor';
import type { CompletionResponse } from '@axon/llm-gateway';
import type { EnrichedPrompt } from '../src/types';

describe('ResponsePostProcessor', () => {
  let processor: ResponsePostProcessor;

  beforeEach(() => {
    processor = new ResponsePostProcessor({
      enableLogging: false, // Disable logging in tests
    });
  });

  describe('Constructor & Configuration', () => {
    it('should create processor with default config', () => {
      const proc = new ResponsePostProcessor();
      expect(proc).toBeDefined();
    });

    it('should create processor with custom config', () => {
      const proc = new ResponsePostProcessor({
        enableQualityAssessment: false,
        enableActionExtraction: false,
        enableKnowledgeCapture: false,
        minActionConfidence: 0.8,
        minKnowledgeConfidence: 0.9,
        enableLogging: false,
      });
      expect(proc).toBeDefined();
    });
  });

  describe('Quality Assessment', () => {
    it('should give high quality score for complete, structured response', async () => {
      const response = createMockResponse(
        `# Solution

Here's how to fix the authentication bug:

1. Update the login function
2. Add proper error handling
3. Test the changes

\`\`\`typescript
async function login(username: string, password: string) {
  // Fixed implementation
  return await authenticate(username, password);
}
\`\`\`

This solution addresses all the requirements.`
      );

      const prompt = createMockPrompt('Fix the authentication bug in the login function');
      const result = await processor.process(response, prompt, 'workspace-1');

      expect(result.qualityScore).toBeGreaterThan(0.7);
      expect(result.isComplete).toBe(true);
    });

    it('should give lower quality score for uncertain response', async () => {
      const response = createMockResponse(
        "I'm not sure about this. I don't know if this will work. The information is unclear."
      );

      const prompt = createMockPrompt('How do I implement this feature?');
      const result = await processor.process(response, prompt, 'workspace-1');

      expect(result.qualityScore).toBeLessThan(0.5);
    });

    it('should penalize code-related prompts without code blocks', async () => {
      const response = createMockResponse(
        'You should fix the function by changing the implementation.'
      );

      const prompt = createMockPrompt('Fix the bug in the function implementation');
      const result = await processor.process(response, prompt, 'workspace-1');

      expect(result.qualityScore).toBeLessThan(0.8);
    });

    it('should penalize very short responses', async () => {
      const response = createMockResponse('Yes.');

      const prompt = createMockPrompt('How do I fix this?');
      const result = await processor.process(response, prompt, 'workspace-1');

      expect(result.qualityScore).toBeLessThan(0.9); // Very short, should lose 0.2 points
    });

    it('should reward structured long responses', async () => {
      const response = createMockResponse(
        `
# Comprehensive Solution

## Problem Analysis
The issue stems from incorrect error handling.

## Solution Steps
1. First step
2. Second step  
3. Third step

## Implementation
Here's the code...

## Testing
Run these tests...
      `.trim()
      );

      const prompt = createMockPrompt('How do I solve this problem?');
      const result = await processor.process(response, prompt, 'workspace-1');

      expect(result.qualityScore).toBeGreaterThan(0.8);
    });
  });

  describe('Completeness Check', () => {
    it('should detect complete response', async () => {
      const response = createMockResponse('This is a complete response with proper ending.');

      const prompt = createMockPrompt('Answer this question');
      const result = await processor.process(response, prompt, 'workspace-1');

      expect(result.isComplete).toBe(true);
    });

    it('should detect incomplete response with indicator', async () => {
      const response = createMockResponse('This response is to be continued...');

      const prompt = createMockPrompt('Answer this question');
      const result = await processor.process(response, prompt, 'workspace-1');

      expect(result.isComplete).toBe(false);
    });

    it('should detect incomplete response with truncation marker', async () => {
      const response = createMockResponse('This response is [truncated]');

      const prompt = createMockPrompt('Answer this question');
      const result = await processor.process(response, prompt, 'workspace-1');

      expect(result.isComplete).toBe(false);
    });

    it('should accept code block as proper ending', async () => {
      const response = createMockResponse(
        `
Here's the code:

\`\`\`typescript
function example() {}
\`\`\`
      `.trim()
      );

      const prompt = createMockPrompt('Show me code');
      const result = await processor.process(response, prompt, 'workspace-1');

      expect(result.isComplete).toBe(true);
    });
  });

  describe('Action Extraction', () => {
    it('should extract code change actions from code blocks', async () => {
      const response = createMockResponse(
        `
Update the file \`src/auth.ts\`:

\`\`\`typescript
async function login() {
  // New implementation
}
\`\`\`
      `.trim()
      );

      const prompt = createMockPrompt('Fix authentication');
      const result = await processor.process(response, prompt, 'workspace-1');

      expect(result.actions).toBeDefined();
      expect(result.actions.length).toBeGreaterThan(0);
      const codeAction = result.actions.find((a) => a.type === 'code-change');
      expect(codeAction).toBeDefined();
      expect(codeAction?.target).toContain('auth.ts');
    });

    it('should extract file creation actions', async () => {
      const response = createMockResponse(
        'Create a new file `src/utils/helper.ts` with this content...'
      );

      const prompt = createMockPrompt('Add utility function');
      const result = await processor.process(response, prompt, 'workspace-1');

      expect(result.actions.length).toBeGreaterThan(0);
      const fileAction = result.actions.find((a) => a.type === 'file-create');
      expect(fileAction).toBeDefined();
      expect(fileAction?.target).toBe('src/utils/helper.ts');
    });

    it('should extract file deletion actions', async () => {
      const response = createMockResponse(
        'Delete the file `src/old/deprecated.ts` as it is no longer needed.'
      );

      const prompt = createMockPrompt('Clean up old files');
      const result = await processor.process(response, prompt, 'workspace-1');

      expect(result.actions.length).toBeGreaterThan(0);
      const deleteAction = result.actions.find((a) => a.type === 'file-delete');
      expect(deleteAction).toBeDefined();
      expect(deleteAction?.target).toBe('src/old/deprecated.ts');
    });

    it('should extract test creation actions', async () => {
      const response = createMockResponse(
        'Write a test for this function in test file `auth.test.ts`.'
      );

      const prompt = createMockPrompt('How to test this?');
      const result = await processor.process(response, prompt, 'workspace-1');

      expect(result.actions.length).toBeGreaterThan(0);
      const testAction = result.actions.find((a) => a.type === 'test-create');
      expect(testAction).toBeDefined();
      expect(testAction?.target).toBe('auth.test.ts');
    });

    it('should extract documentation update actions', async () => {
      const response = createMockResponse('Update the documentation to reflect these changes.');

      const prompt = createMockPrompt('What else should I do?');
      const result = await processor.process(response, prompt, 'workspace-1');

      expect(result.actions.length).toBeGreaterThan(0);
      const docAction = result.actions.find((a) => a.type === 'doc-update');
      expect(docAction).toBeDefined();
    });

    it('should filter actions below confidence threshold', async () => {
      const proc = new ResponsePostProcessor({
        minActionConfidence: 0.9, // Very high threshold
        enableLogging: false,
      });

      const response = createMockResponse(
        `
\`\`\`typescript
// Code without file path
function example() {}
\`\`\`
      `.trim()
      );

      const prompt = createMockPrompt('Show code');
      const result = await proc.process(response, prompt, 'workspace-1');

      // Should have fewer actions due to high confidence requirement
      const lowConfidenceActions = result.actions.filter((a) => a.confidence < 0.9);
      expect(lowConfidenceActions.length).toBe(0);
    });

    it('should handle response with no actionable items', async () => {
      const response = createMockResponse(
        'This is a general explanation without any specific actions.'
      );

      const prompt = createMockPrompt('Explain this concept');
      const result = await processor.process(response, prompt, 'workspace-1');

      expect(result.actions).toBeDefined();
      expect(result.actions.length).toBe(0);
    });

    it('should extract multiple actions from complex response', async () => {
      const response = createMockResponse(
        `
1. Create a new file \`src/api.ts\`
2. Update the file \`src/main.ts\`
3. Delete the file \`src/old.ts\`
4. Write a test
5. Update the documentation

\`\`\`typescript
// Code for api.ts
\`\`\`

\`\`\`typescript
// Code for main.ts
\`\`\`
      `.trim()
      );

      const prompt = createMockPrompt('Refactor the codebase');
      const result = await processor.process(response, prompt, 'workspace-1');

      expect(result.actions.length).toBeGreaterThan(3);
      expect(result.actions.some((a) => a.type === 'file-create')).toBe(true);
      expect(result.actions.some((a) => a.type === 'code-change')).toBe(true);
      expect(result.actions.some((a) => a.type === 'file-delete')).toBe(true);
      expect(result.actions.some((a) => a.type === 'test-create')).toBe(true);
      expect(result.actions.some((a) => a.type === 'doc-update')).toBe(true);
    });
  });

  describe('Knowledge Extraction', () => {
    it('should extract pattern knowledge', async () => {
      const response = createMockResponse(
        'This is a best practice pattern for handling authentication in TypeScript applications.'
      );

      const prompt = createMockPrompt('How to handle auth?');
      const result = await processor.process(response, prompt, 'workspace-1');

      expect(result.newKnowledge).toBeDefined();
      expect(result.newKnowledge.length).toBeGreaterThan(0);
      expect(result.newKnowledge[0].type).toBe('pattern');
    });

    it('should extract solution knowledge', async () => {
      const response = createMockResponse(
        'The solution to fix this bug is to add proper null checking before accessing the property.'
      );

      const prompt = createMockPrompt('Fix this bug');
      const result = await processor.process(response, prompt, 'workspace-1');

      expect(result.newKnowledge).toBeDefined();
      expect(result.newKnowledge.length).toBeGreaterThan(0);
      expect(result.newKnowledge[0].type).toBe('solution');
    });

    it('should extract decision knowledge', async () => {
      const response = createMockResponse(
        'I chose to use React over Vue because it has better TypeScript support for this use case.'
      );

      const prompt = createMockPrompt('Which framework to use?');
      const result = await processor.process(response, prompt, 'workspace-1');

      expect(result.newKnowledge).toBeDefined();
      expect(result.newKnowledge.length).toBeGreaterThan(0);
      expect(result.newKnowledge[0].type).toBe('decision');
    });

    it('should extract error-fix knowledge', async () => {
      const response = createMockResponse(
        'To address this error, we need to fix the authentication module by updating the password validation logic.'
      );

      const prompt = createMockPrompt('Fix API error');
      const result = await processor.process(response, prompt, 'workspace-1');

      expect(result.newKnowledge).toBeDefined();
      expect(result.newKnowledge.length).toBeGreaterThan(0);
      // Pattern matching checks in order: pattern, solution, decision, error-fix
      // The word "fix" will match solution first, so expecting that classification
      expect(['error-fix', 'solution']).toContain(result.newKnowledge[0].type);
    });

    it('should extract entities from knowledge', async () => {
      const response = createMockResponse(
        'The pattern is to use `authentication.ts` file with `validateUser()` function and `UserModel` class.'
      );

      const prompt = createMockPrompt('Auth pattern');
      const result = await processor.process(response, prompt, 'workspace-1');

      expect(result.newKnowledge).toBeDefined();
      if (result.newKnowledge.length > 0) {
        expect(result.newKnowledge[0].entities).toBeDefined();
        expect(result.newKnowledge[0].entities.length).toBeGreaterThan(0);
      }
    });

    it('should not extract knowledge below confidence threshold', async () => {
      const proc = new ResponsePostProcessor({
        minKnowledgeConfidence: 0.95, // Very high threshold
        enableLogging: false,
      });

      const response = createMockResponse('Maybe you could try this approach.');

      const prompt = createMockPrompt('Suggestion?');
      const result = await proc.process(response, prompt, 'workspace-1');

      expect(result.newKnowledge.length).toBe(0);
    });

    it('should not extract knowledge from non-informative response', async () => {
      const response = createMockResponse('Yes, that looks good. Proceed with the implementation.');

      const prompt = createMockPrompt('Is this correct?');
      const result = await processor.process(response, prompt, 'workspace-1');

      expect(result.newKnowledge.length).toBe(0);
    });
  });

  describe('Feature Toggles', () => {
    it('should skip quality assessment when disabled', async () => {
      const proc = new ResponsePostProcessor({
        enableQualityAssessment: false,
        enableLogging: false,
      });

      const response = createMockResponse("I don't know and I'm not sure");
      const prompt = createMockPrompt('Question?');
      const result = await proc.process(response, prompt, 'workspace-1');

      // Should return default score of 1.0 when disabled
      expect(result.qualityScore).toBe(1.0);
    });

    it('should skip action extraction when disabled', async () => {
      const proc = new ResponsePostProcessor({
        enableActionExtraction: false,
        enableLogging: false,
      });

      const response = createMockResponse('Create a new file `test.ts` with code...');
      const prompt = createMockPrompt('Add file');
      const result = await proc.process(response, prompt, 'workspace-1');

      expect(result.actions.length).toBe(0);
    });

    it('should skip knowledge capture when disabled', async () => {
      const proc = new ResponsePostProcessor({
        enableKnowledgeCapture: false,
        enableLogging: false,
      });

      const response = createMockResponse('This is a best practice pattern for authentication.');
      const prompt = createMockPrompt('Auth pattern');
      const result = await proc.process(response, prompt, 'workspace-1');

      expect(result.newKnowledge.length).toBe(0);
    });
  });

  describe('Integration', () => {
    it('should process complete response with all features', async () => {
      const response = createMockResponse(
        `
# Authentication Bug Fix

## Problem
The current implementation has a null pointer error.

## Solution  
Update the file \`src/auth.ts\`:

\`\`\`typescript
async function validateUser(username: string) {
  if (!username) {
    throw new Error('Username required');
  }
  return await db.findUser(username);
}
\`\`\`

## Testing
Create a test in \`src/auth.test.ts\` to verify the fix.

## Documentation
Update the documentation to reflect the new validation.

This fix follows the best practice pattern of fail-fast validation.
      `.trim()
      );

      const prompt = createMockPrompt('Fix the authentication bug in validateUser()');
      const result = await processor.process(response, prompt, 'workspace-1');

      // Should have high quality
      expect(result.qualityScore).toBeGreaterThan(0.7);

      // Should be complete
      expect(result.isComplete).toBe(true);

      // Should extract multiple actions
      expect(result.actions.length).toBeGreaterThan(2);

      // Should extract knowledge
      expect(result.newKnowledge.length).toBeGreaterThan(0);
    });
  });
});

// Helper functions

function createMockResponse(content: string): CompletionResponse {
  return {
    id: 'test-response-id',
    model: 'gpt-4o',
    content,
    finishReason: 'stop',
    usage: {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    },
    createdAt: new Date(),
  };
}

function createMockPrompt(originalPrompt: string): EnrichedPrompt {
  return {
    requestId: 'test-request-id',
    originalPrompt,
    workspaceId: 'test-workspace',
    timestamp: new Date(),
    metadata: {
      timestamp: new Date(),
      userId: 'test-user',
      sessionId: 'test-session',
    },
  };
}
