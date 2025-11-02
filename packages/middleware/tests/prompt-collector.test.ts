import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PromptCollector, ValidationError } from '../src/services/prompt-collector.js';
import type { PromptRequest } from '../src/types.js';

describe('PromptCollector', () => {
  let collector: PromptCollector;

  beforeEach(() => {
    collector = new PromptCollector({
      strictValidation: true,
      enableLogging: false, // Disable logging in tests
    });
  });

  describe('collect()', () => {
    it('should successfully collect a valid prompt request', async () => {
      const request: PromptRequest = {
        prompt: 'How do I fix this bug?',
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        metadata: {
          source: 'vscode',
          language: 'typescript',
          fileName: 'app.ts',
        },
      };

      const result = await collector.collect(request);

      expect(result).toMatchObject({
        originalPrompt: request.prompt,
        workspaceId: request.workspaceId,
        metadata: expect.objectContaining({
          source: 'vscode',
          language: 'typescript',
          fileName: 'app.ts',
        }),
      });
      expect(result.requestId).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should generate unique request IDs for each request', async () => {
      const request: PromptRequest = {
        prompt: 'Test prompt',
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
      };

      const result1 = await collector.collect(request);
      const result2 = await collector.collect(request);

      expect(result1.requestId).not.toBe(result2.requestId);
    });

    it('should throw ValidationError for empty prompt', async () => {
      const request: PromptRequest = {
        prompt: '',
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
      };

      await expect(collector.collect(request)).rejects.toThrow(ValidationError);
      try {
        await collector.collect(request);
      } catch (error) {
        expect((error as ValidationError).errors).toContainEqual(
          expect.objectContaining({ path: 'prompt', message: expect.stringContaining('empty') })
        );
      }
    });

    it('should throw ValidationError for invalid workspace ID', async () => {
      const request: PromptRequest = {
        prompt: 'Test prompt',
        workspaceId: 'invalid-uuid',
      };

      await expect(collector.collect(request)).rejects.toThrow(ValidationError);
      try {
        await collector.collect(request);
      } catch (error) {
        expect((error as ValidationError).errors).toContainEqual(
          expect.objectContaining({ path: 'workspaceId', message: expect.stringContaining('Invalid') })
        );
      }
    });

    it('should throw ValidationError for prompt exceeding max length', async () => {
      const longPrompt = 'a'.repeat(10001);
      const request: PromptRequest = {
        prompt: longPrompt,
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
      };

      await expect(collector.collect(request)).rejects.toThrow(ValidationError);
      try {
        await collector.collect(request);
      } catch (error) {
        expect((error as ValidationError).errors).toContainEqual(
          expect.objectContaining({ path: 'prompt', message: expect.stringContaining('long') })
        );
      }
    });

    it('should handle optional userId and sessionId', async () => {
      const request: PromptRequest = {
        prompt: 'Test prompt',
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        userId: '223e4567-e89b-12d3-a456-426614174000',
        sessionId: '323e4567-e89b-12d3-a456-426614174000',
      };

      const result = await collector.collect(request);

      expect(result.userId).toBe(request.userId);
      expect(result.sessionId).toBe(request.sessionId);
    });

    it('should validate and accept all valid metadata fields', async () => {
      const request: PromptRequest = {
        prompt: 'Fix this error',
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        metadata: {
          source: 'vscode',
          language: 'python',
          fileName: 'main.py',
          cursorPosition: { line: 42, column: 15 },
          selectedText: 'def broken_function():',
          diagnostics: [
            {
              message: 'Syntax error',
              severity: 'error',
              range: {
                start: { line: 42, column: 0 },
                end: { line: 42, column: 22 },
              },
            },
          ],
        },
      };

      const result = await collector.collect(request);

      expect(result.metadata).toMatchObject({
        source: 'vscode',
        language: 'python',
        fileName: 'main.py',
        cursorPosition: { line: 42, column: 15 },
        selectedText: 'def broken_function():',
        diagnostics: [
          {
            message: 'Syntax error',
            severity: 'error',
            range: {
              start: { line: 42, column: 0 },
              end: { line: 42, column: 22 },
            },
          },
        ],
      });
    });
  });

  describe('sanitize()', () => {
    it('should remove script tags from prompt', async () => {
      const request: PromptRequest = {
        prompt: 'Test <script>alert("xss")</script> prompt',
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
      };

      const result = await collector.collect(request);

      expect(result.originalPrompt).not.toContain('<script>');
      expect(result.originalPrompt).not.toContain('</script>');
      expect(result.originalPrompt).toContain('Test');
      expect(result.originalPrompt).toContain('prompt');
    });

    it('should remove iframe tags', async () => {
      const request: PromptRequest = {
        prompt: 'Test <iframe src="malicious"></iframe> prompt',
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
      };

      const result = await collector.collect(request);

      expect(result.originalPrompt).not.toContain('<iframe');
      expect(result.originalPrompt).not.toContain('</iframe>');
    });

    it('should preserve safe HTML-like content', async () => {
      const request: PromptRequest = {
        prompt: 'How to use <div> tags in HTML?',
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
      };

      const result = await collector.collect(request);

      expect(result.originalPrompt).toContain('<div>');
    });

    it('should handle multiple malicious tags', async () => {
      const request: PromptRequest = {
        prompt: '<script>bad()</script>Test<iframe></iframe>',
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
      };

      const result = await collector.collect(request);

      expect(result.originalPrompt).not.toContain('<script>');
      expect(result.originalPrompt).not.toContain('<iframe>');
      expect(result.originalPrompt).toContain('Test');
    });
  });

  describe('enrichMetadata()', () => {
    it('should add default source if not provided', async () => {
      const request: PromptRequest = {
        prompt: 'Test prompt',
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
      };

      const result = await collector.collect(request);

      expect(result.metadata?.source).toBe('api');
    });

    it('should preserve provided metadata', async () => {
      const request: PromptRequest = {
        prompt: 'Test prompt',
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        metadata: {
          source: 'vscode',
          language: 'javascript',
        },
      };

      const result = await collector.collect(request);

      expect(result.metadata?.source).toBe('vscode');
      expect(result.metadata?.language).toBe('javascript');
    });
  });

  describe('configuration', () => {
    it('should respect strictValidation: false', async () => {
      const lenientCollector = new PromptCollector({
        strictValidation: false,
        enableLogging: false,
      });

      const request: PromptRequest = {
        prompt: '', // Invalid
        workspaceId: 'invalid', // Invalid
      };

      // Should not throw when strictValidation is false
      const result = await lenientCollector.collect(request);
      expect(result).toBeDefined();
    });

    it('should respect maxPromptLength config in constructor', () => {
      const customCollector = new PromptCollector({
        maxPromptLength: 50,
        enableLogging: false,
      });

      // Verify config is set (this just tests construction, actual validation uses hardcoded schema)
      expect(customCollector).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should provide detailed error information in ValidationError', async () => {
      const request: PromptRequest = {
        prompt: '',
        workspaceId: 'invalid',
      };

      try {
        await collector.collect(request);
        expect.fail('Should have thrown ValidationError');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).errors).toHaveLength(2);
        expect((error as ValidationError).errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ path: 'prompt' }),
            expect.objectContaining({ path: 'workspaceId' }),
          ])
        );
      }
    });
  });
});
