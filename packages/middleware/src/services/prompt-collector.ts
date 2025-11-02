/**
 * Prompt Collector Service
 * 
 * Validates incoming prompt requests and enriches them with metadata.
 * This is the first stage in the orchestration pipeline.
 */

import { z } from 'zod';
import { randomUUID } from 'crypto';
import type { PromptRequest, EnrichedPrompt } from '../types.js';

/**
 * Zod schema for validating PromptRequest
 */
const PromptRequestSchema = z.object({
  prompt: z.string().min(1, 'Prompt cannot be empty').max(10000, 'Prompt too long'),
  workspaceId: z.string().uuid('Invalid workspace ID'),
  userId: z.string().uuid('Invalid user ID').optional(),
  sessionId: z.string().uuid('Invalid session ID').optional(),
  metadata: z.object({
    source: z.enum(['vscode', 'cli', 'api', 'web']).optional(),
    language: z.string().optional(),
    fileName: z.string().optional(),
    cursorPosition: z.object({
      line: z.number(),
      column: z.number(),
    }).optional(),
    selectedText: z.string().optional(),
    diagnostics: z.array(z.object({
      message: z.string(),
      severity: z.enum(['error', 'warning', 'info', 'hint']),
      range: z.object({
        start: z.object({ line: z.number(), column: z.number() }),
        end: z.object({ line: z.number(), column: z.number() }),
      }),
    })).optional(),
  }).optional(),
});

/**
 * Configuration for PromptCollector
 */
export interface PromptCollectorConfig {
  /** Enable strict validation (reject requests that fail schema) */
  strictValidation?: boolean;
  /** Log all requests */
  enableLogging?: boolean;
  /** Maximum prompt length */
  maxPromptLength?: number;
}

/**
 * PromptCollector Service
 * 
 * Responsibilities:
 * - Validate incoming requests against schema
 * - Generate unique request IDs
 * - Enrich requests with timestamps and metadata
 * - Sanitize input (basic XSS prevention)
 */
export class PromptCollector {
  private config: Required<PromptCollectorConfig>;

  constructor(config: PromptCollectorConfig = {}) {
    this.config = {
      strictValidation: config.strictValidation ?? true,
      enableLogging: config.enableLogging ?? true,
      maxPromptLength: config.maxPromptLength ?? 10000,
    };
  }

  /**
   * Collect and validate a prompt request
   * 
   * @param request - Raw prompt request
   * @returns Enriched prompt with metadata
   * @throws ValidationError if request is invalid and strictValidation is enabled
   */
  async collect(request: PromptRequest): Promise<EnrichedPrompt> {
    // Validate request
    const validationResult = await this.validate(request);
    if (!validationResult.isValid && this.config.strictValidation) {
      throw new ValidationError(
        'Invalid prompt request',
        validationResult.errors
      );
    }

    // Generate request ID
    const requestId = this.generateRequestId();

    // Sanitize prompt (basic XSS prevention)
    const sanitizedPrompt = this.sanitizePrompt(request.prompt);

    // Enrich with metadata
    const enriched: EnrichedPrompt = {
      originalPrompt: sanitizedPrompt,
      workspaceId: request.workspaceId,
      userId: request.userId,
      sessionId: request.sessionId,
      requestId,
      timestamp: new Date(),
      metadata: {
        ...request.metadata,
        // Add default metadata if not provided
        source: request.metadata?.source ?? 'api',
      },
    };

    // Log if enabled
    if (this.config.enableLogging) {
      this.logRequest(enriched);
    }

    return enriched;
  }

  /**
   * Validate a prompt request against schema
   * 
   * @param request - Request to validate
   * @returns Validation result with errors if any
   */
  private async validate(request: PromptRequest): Promise<ValidationResult> {
    try {
      PromptRequestSchema.parse(request);
      return { isValid: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const zodError = error as z.ZodError;
        return {
          isValid: false,
          errors: zodError.issues.map((e: z.ZodIssue) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        };
      }
      return {
        isValid: false,
        errors: [{ path: 'unknown', message: 'Unknown validation error' }],
      };
    }
  }

  /**
   * Generate a unique request ID
   * 
   * @returns UUID v4 string
   */
  private generateRequestId(): string {
    return randomUUID();
  }

  /**
   * Sanitize prompt to prevent XSS and other injection attacks
   * 
   * @param prompt - Raw prompt text
   * @returns Sanitized prompt
   */
  private sanitizePrompt(prompt: string): string {
    // Basic sanitization - remove potentially dangerous characters
    // Note: For production, use a proper sanitization library like DOMPurify
    return prompt
      .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '') // Remove iframe tags
      .trim();
  }

  /**
   * Log request for debugging and analytics
   * 
   * @param request - Enriched request
   */
  private logRequest(request: EnrichedPrompt): void {
    // In production, use proper logger (Winston, Pino, etc.)
    console.log('[PromptCollector]', {
      requestId: request.requestId,
      workspaceId: request.workspaceId,
      userId: request.userId,
      promptLength: request.originalPrompt.length,
      source: request.metadata?.source,
      timestamp: request.timestamp,
    });
  }
}

/**
 * Validation result interface
 */
interface ValidationResult {
  isValid: boolean;
  errors: Array<{ path: string; message: string }>;
}

/**
 * Custom validation error
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public errors: Array<{ path: string; message: string }>
  ) {
    super(message);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}
