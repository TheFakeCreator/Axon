/**
 * Custom error classes for Axon
 */

/**
 * Base Axon error
 */
export class AxonError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Configuration error
 */
export class ConfigurationError extends AxonError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONFIGURATION_ERROR', 500, details);
  }
}

/**
 * Database error
 */
export class DatabaseError extends AxonError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'DATABASE_ERROR', 500, details);
  }
}

/**
 * Context retrieval error
 */
export class ContextRetrievalError extends AxonError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONTEXT_RETRIEVAL_ERROR', 500, details);
  }
}

/**
 * Prompt analysis error
 */
export class PromptAnalysisError extends AxonError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'PROMPT_ANALYSIS_ERROR', 500, details);
  }
}

/**
 * LLM provider error
 */
export class LLMProviderError extends AxonError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'LLM_PROVIDER_ERROR', 502, details);
  }
}

/**
 * Validation error
 */
export class ValidationError extends AxonError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

/**
 * Not found error
 */
export class NotFoundError extends AxonError {
  constructor(resource: string, identifier: string) {
    super(
      `${resource} not found: ${identifier}`,
      'NOT_FOUND',
      404,
      { resource, identifier }
    );
  }
}

/**
 * Token budget exceeded error
 */
export class TokenBudgetExceededError extends AxonError {
  constructor(requested: number, limit: number) {
    super(
      `Token budget exceeded: requested ${requested}, limit ${limit}`,
      'TOKEN_BUDGET_EXCEEDED',
      400,
      { requested, limit }
    );
  }
}

/**
 * Unauthorized error
 */
export class UnauthorizedError extends AxonError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

/**
 * Forbidden error
 */
export class ForbiddenError extends AxonError {
  constructor(message: string = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
  }
}
