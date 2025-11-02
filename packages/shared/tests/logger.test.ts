/**
 * Logger utility tests
 */

import { describe, it, expect } from 'vitest';
import { createLogger, LogLevel } from '../src/utils/logger';

describe('Logger Utility', () => {
  it('should create a logger instance', () => {
    const logger = createLogger('test-service');
    expect(logger).toBeDefined();
    expect(logger.info).toBeDefined();
    expect(logger.error).toBeDefined();
    expect(logger.warn).toBeDefined();
    expect(logger.debug).toBeDefined();
  });

  it('should log messages without errors', () => {
    const logger = createLogger('test-service');
    
    // These should not throw
    expect(() => logger.info('Test info message')).not.toThrow();
    expect(() => logger.error('Test error message')).not.toThrow();
    expect(() => logger.warn('Test warning message')).not.toThrow();
    expect(() => logger.debug('Test debug message')).not.toThrow();
  });
});
