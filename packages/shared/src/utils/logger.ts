/**
 * Centralized logging utility using Winston
 */

import winston from 'winston';

/**
 * Log levels
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

/**
 * Create and configure logger instance
 */
export const createLogger = (serviceName: string): winston.Logger => {
  const { combine, timestamp, printf, colorize, errors } = winston.format;

  // Custom format
  const customFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
    let msg = `${String(timestamp)} [${serviceName}] ${String(level)}: ${String(message)}`;
    
    // Add stack trace for errors
    if (stack && typeof stack === 'string') {
      msg += `\n${stack}`;
    }
    
    // Add metadata if present
    const metadataKeys = Object.keys(metadata);
    if (metadataKeys.length > 0) {
      msg += `\n${JSON.stringify(metadata, null, 2)}`;
    }
    
    return msg;
  });

  // Create logger
  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(
      errors({ stack: true }),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      customFormat
    ),
    transports: [
      // Console transport
      new winston.transports.Console({
        format: combine(
          colorize(),
          customFormat
        ),
      }),
      // File transport for errors
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
      }),
      // File transport for all logs
      new winston.transports.File({
        filename: 'logs/combined.log',
      }),
    ],
  });

  return logger;
};

/**
 * Default logger instance
 */
export const logger = createLogger('axon');
