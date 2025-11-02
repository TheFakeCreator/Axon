/**
 * Custom errors tests
 */

import { describe, it, expect } from 'vitest';
import {
  AxonError,
  ConfigurationError,
  DatabaseError,
  ValidationError,
  NotFoundError,
  TokenBudgetExceededError,
} from '../src/utils/errors';

describe('Custom Errors', () => {
  it('should create AxonError with correct properties', () => {
    const error = new AxonError('Test error', 'TEST_ERROR', 500, { foo: 'bar' });
    
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_ERROR');
    expect(error.statusCode).toBe(500);
    expect(error.details).toEqual({ foo: 'bar' });
    expect(error.stack).toBeDefined();
  });

  it('should create ConfigurationError', () => {
    const error = new ConfigurationError('Invalid config');
    expect(error).toBeInstanceOf(AxonError);
    expect(error.code).toBe('CONFIGURATION_ERROR');
    expect(error.statusCode).toBe(500);
  });

  it('should create DatabaseError', () => {
    const error = new DatabaseError('DB connection failed');
    expect(error).toBeInstanceOf(AxonError);
    expect(error.code).toBe('DATABASE_ERROR');
  });

  it('should create ValidationError with 400 status', () => {
    const error = new ValidationError('Invalid input');
    expect(error).toBeInstanceOf(AxonError);
    expect(error.statusCode).toBe(400);
  });

  it('should create NotFoundError with resource details', () => {
    const error = new NotFoundError('Workspace', 'ws-123');
    expect(error).toBeInstanceOf(AxonError);
    expect(error.statusCode).toBe(404);
    expect(error.details).toEqual({ resource: 'Workspace', identifier: 'ws-123' });
  });

  it('should create TokenBudgetExceededError with token details', () => {
    const error = new TokenBudgetExceededError(10000, 8000);
    expect(error).toBeInstanceOf(AxonError);
    expect(error.statusCode).toBe(400);
    expect(error.details).toEqual({ requested: 10000, limit: 8000 });
  });
});
