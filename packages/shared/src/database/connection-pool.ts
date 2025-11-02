/**
 * MongoDB connection pooling with retry logic
 */

import { MongoClient, MongoClientOptions, ServerApiVersion } from 'mongodb';
import { logger } from '../utils/logger';

export interface ConnectionPoolConfig {
  uri: string;
  dbName: string;
  maxPoolSize?: number;
  minPoolSize?: number;
  maxIdleTimeMS?: number;
  retryWrites?: boolean;
  retryReads?: boolean;
  maxRetries?: number;
  retryDelayMs?: number;
  connectTimeoutMS?: number;
  socketTimeoutMS?: number;
}

/**
 * MongoDB connection pool manager with automatic retry
 */
export class ConnectionPool {
  private client: MongoClient | null = null;
  private config: ConnectionPoolConfig;
  private retryCount = 0;

  constructor(config: ConnectionPoolConfig) {
    this.config = {
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 60000,
      retryWrites: true,
      retryReads: true,
      maxRetries: 3,
      retryDelayMs: 1000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      ...config,
    };
  }

  /**
   * Connect with automatic retry logic
   */
  async connect(): Promise<MongoClient> {
    const options: MongoClientOptions = {
      maxPoolSize: this.config.maxPoolSize,
      minPoolSize: this.config.minPoolSize,
      maxIdleTimeMS: this.config.maxIdleTimeMS,
      retryWrites: this.config.retryWrites,
      retryReads: this.config.retryReads,
      connectTimeoutMS: this.config.connectTimeoutMS,
      socketTimeoutMS: this.config.socketTimeoutMS,
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    };

    while (this.retryCount < (this.config.maxRetries || 3)) {
      try {
        logger.info('Connecting to MongoDB...', {
          dbName: this.config.dbName,
          attempt: this.retryCount + 1,
          maxRetries: this.config.maxRetries,
        });

        this.client = new MongoClient(this.config.uri, options);
        await this.client.connect();

        // Verify connection
        await this.client.db(this.config.dbName).admin().ping();

        logger.info('MongoDB connection pool established', {
          dbName: this.config.dbName,
          maxPoolSize: this.config.maxPoolSize,
          minPoolSize: this.config.minPoolSize,
        });

        this.retryCount = 0; // Reset on success
        return this.client;
      } catch (error) {
        this.retryCount++;
        logger.error('MongoDB connection failed', {
          error,
          attempt: this.retryCount,
          maxRetries: this.config.maxRetries,
        });

        if (this.retryCount >= (this.config.maxRetries || 3)) {
          throw new Error(
            `Failed to connect to MongoDB after ${this.retryCount} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }

        // Exponential backoff
        const delay = this.config.retryDelayMs! * Math.pow(2, this.retryCount - 1);
        logger.info(`Retrying connection in ${delay}ms...`);
        await this.sleep(delay);
      }
    }

    throw new Error('Failed to connect to MongoDB');
  }

  /**
   * Get the MongoDB client
   */
  getClient(): MongoClient {
    if (!this.client) {
      throw new Error('MongoDB client not initialized. Call connect() first.');
    }
    return this.client;
  }

  /**
   * Disconnect and close all connections in the pool
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
        this.client = null;
        logger.info('MongoDB connection pool closed');
      } catch (error) {
        logger.error('Error closing MongoDB connection pool', { error });
        throw error;
      }
    }
  }

  /**
   * Check if the pool is connected
   */
  isConnected(): boolean {
    return this.client !== null;
  }

  /**
   * Health check - ping the database
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.client) return false;
      await this.client.db(this.config.dbName).admin().ping();
      return true;
    } catch (error) {
      logger.error('MongoDB health check failed', { error });
      return false;
    }
  }

  /**
   * Get connection pool statistics
   */
  getPoolStats(): {
    isConnected: boolean;
    maxPoolSize: number;
    minPoolSize: number;
  } {
    return {
      isConnected: this.isConnected(),
      maxPoolSize: this.config.maxPoolSize || 10,
      minPoolSize: this.config.minPoolSize || 2,
    };
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
