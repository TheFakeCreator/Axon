/**
 * Redis connection utility
 */

import Redis, { RedisOptions } from 'ioredis';
import { logger } from './logger';

/**
 * Redis connection manager
 */
export class RedisConnection {
  private client: Redis | null = null;
  private options: RedisOptions;

  constructor(options: RedisOptions) {
    this.options = options;
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    try {
      logger.info('Connecting to Redis...', { 
        host: this.options.host, 
        port: this.options.port 
      });

      this.client = new Redis(this.options);

      // Handle connection events
      this.client.on('connect', () => {
        logger.info('Redis connected successfully');
      });

      this.client.on('error', (error) => {
        logger.error('Redis error', { error });
      });

      this.client.on('close', () => {
        logger.warn('Redis connection closed');
      });

      // Wait for connection to be ready
      await this.client.ping();
      
    } catch (error) {
      logger.error('Redis connection failed', { error });
      throw error;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.quit();
        this.client = null;
        logger.info('Redis disconnected');
      }
    } catch (error) {
      logger.error('Redis disconnection failed', { error });
      throw error;
    }
  }

  /**
   * Get Redis client
   */
  getClient(): Redis {
    if (!this.client) {
      throw new Error('Redis not connected. Call connect() first.');
    }
    return this.client;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.client !== null && this.client.status === 'ready';
  }

  /**
   * Set value with optional TTL
   */
  async set(key: string, value: string, ttl?: number): Promise<void> {
    const client = this.getClient();
    if (ttl) {
      await client.setex(key, ttl, value);
    } else {
      await client.set(key, value);
    }
  }

  /**
   * Get value by key
   */
  async get(key: string): Promise<string | null> {
    const client = this.getClient();
    return await client.get(key);
  }

  /**
   * Delete key
   */
  async delete(key: string): Promise<void> {
    const client = this.getClient();
    await client.del(key);
  }

  /**
   * Set object (automatically serialized)
   */
  async setObject<T>(key: string, value: T, ttl?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttl);
  }

  /**
   * Get object (automatically deserialized)
   */
  async getObject<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Failed to parse Redis value as JSON', { key, error });
      return null;
    }
  }

  /**
   * Ping Redis to verify connection
   */
  async ping(): Promise<boolean> {
    try {
      await this.getClient().ping();
      return true;
    } catch (error) {
      logger.error('Redis ping failed', { error });
      return false;
    }
  }
}

/**
 * Singleton instance (optional pattern)
 */
let redisInstance: RedisConnection | null = null;

export const getRedisInstance = (options?: RedisOptions): RedisConnection => {
  if (!redisInstance) {
    if (!options) {
      throw new Error('Redis options required for first initialization');
    }
    redisInstance = new RedisConnection(options);
  }
  return redisInstance;
};
