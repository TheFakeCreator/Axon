/**
 * Redis-based caching utilities with advanced features
 */

import { Redis } from 'ioredis';
import { logger } from './logger';

/**
 * Cache options
 */
export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  namespace?: string; // Key namespace prefix
}

/**
 * Cache key pattern for different data types
 */
export enum CacheKeyPattern {
  EMBEDDING = 'embedding',
  CONTEXT = 'context',
  WORKSPACE = 'workspace',
  ANALYSIS = 'analysis',
  PROMPT = 'prompt',
  INTERACTION = 'interaction',
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalKeys: number;
}

/**
 * Redis cache service with advanced caching capabilities
 */
export class CacheService {
  private redis: Redis;
  private namespace: string;
  private hits = 0;
  private misses = 0;

  constructor(redis: Redis, namespace = 'axon') {
    this.redis = redis;
    this.namespace = namespace;
  }

  /**
   * Generate cache key with namespace
   */
  private buildKey(pattern: CacheKeyPattern | string, ...parts: string[]): string {
    return `${this.namespace}:${pattern}:${parts.join(':')}`;
  }

  /**
   * Set value in cache with optional TTL
   */
  async set<T>(
    pattern: CacheKeyPattern | string,
    key: string,
    value: T,
    options?: CacheOptions
  ): Promise<void> {
    try {
      const fullKey = this.buildKey(pattern, key);
      const serialized = JSON.stringify(value);
      const ttl = options?.ttl;

      if (ttl) {
        await this.redis.setex(fullKey, ttl, serialized);
        logger.debug('Cache set with TTL', { key: fullKey, ttl });
      } else {
        await this.redis.set(fullKey, serialized);
        logger.debug('Cache set without TTL', { key: fullKey });
      }
    } catch (error) {
      logger.error('Cache set failed', { pattern, key, error });
      // Don't throw - caching is non-critical
    }
  }

  /**
   * Get value from cache
   */
  async get<T>(pattern: CacheKeyPattern | string, key: string): Promise<T | null> {
    try {
      const fullKey = this.buildKey(pattern, key);
      const value = await this.redis.get(fullKey);

      if (value === null) {
        this.misses++;
        logger.debug('Cache miss', { key: fullKey });
        return null;
      }

      this.hits++;
      logger.debug('Cache hit', { key: fullKey });
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Cache get failed', { pattern, key, error });
      this.misses++;
      return null;
    }
  }

  /**
   * Get or compute value (cache-aside pattern)
   */
  async getOrCompute<T>(
    pattern: CacheKeyPattern | string,
    key: string,
    computeFn: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(pattern, key);
    if (cached !== null) {
      return cached;
    }

    // Compute value if not in cache
    const value = await computeFn();

    // Store in cache (fire and forget)
    this.set(pattern, key, value, options).catch((error) => {
      logger.warn('Failed to cache computed value', { pattern, key, error });
    });

    return value;
  }

  /**
   * Delete key from cache
   */
  async delete(pattern: CacheKeyPattern | string, key: string): Promise<void> {
    try {
      const fullKey = this.buildKey(pattern, key);
      await this.redis.del(fullKey);
      logger.debug('Cache delete', { key: fullKey });
    } catch (error) {
      logger.error('Cache delete failed', { pattern, key, error });
    }
  }

  /**
   * Delete multiple keys by pattern
   */
  async deleteByPattern(pattern: string): Promise<number> {
    try {
      const fullPattern = this.buildKey(pattern, '*');
      const keys = await this.redis.keys(fullPattern);

      if (keys.length === 0) {
        return 0;
      }

      const deleted = await this.redis.del(...keys);
      logger.info('Cache pattern delete', { pattern: fullPattern, deleted });
      return deleted;
    } catch (error) {
      logger.error('Cache pattern delete failed', { pattern, error });
      return 0;
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(pattern: CacheKeyPattern | string, key: string): Promise<boolean> {
    try {
      const fullKey = this.buildKey(pattern, key);
      const exists = await this.redis.exists(fullKey);
      return exists === 1;
    } catch (error) {
      logger.error('Cache exists check failed', { pattern, key, error });
      return false;
    }
  }

  /**
   * Get remaining TTL for a key
   */
  async getTTL(pattern: CacheKeyPattern | string, key: string): Promise<number> {
    try {
      const fullKey = this.buildKey(pattern, key);
      const ttl = await this.redis.ttl(fullKey);
      return ttl;
    } catch (error) {
      logger.error('Cache TTL check failed', { pattern, key, error });
      return -1;
    }
  }

  /**
   * Extend TTL for a key
   */
  async extendTTL(
    pattern: CacheKeyPattern | string,
    key: string,
    ttl: number
  ): Promise<void> {
    try {
      const fullKey = this.buildKey(pattern, key);
      await this.redis.expire(fullKey, ttl);
      logger.debug('Cache TTL extended', { key: fullKey, ttl });
    } catch (error) {
      logger.error('Cache TTL extend failed', { pattern, key, error });
    }
  }

  /**
   * Set multiple values at once
   */
  async setMany<T>(
    pattern: CacheKeyPattern | string,
    entries: Array<{ key: string; value: T }>,
    options?: CacheOptions
  ): Promise<void> {
    try {
      const pipeline = this.redis.pipeline();

      for (const entry of entries) {
        const fullKey = this.buildKey(pattern, entry.key);
        const serialized = JSON.stringify(entry.value);

        if (options?.ttl) {
          pipeline.setex(fullKey, options.ttl, serialized);
        } else {
          pipeline.set(fullKey, serialized);
        }
      }

      await pipeline.exec();
      logger.debug('Cache batch set', { pattern, count: entries.length });
    } catch (error) {
      logger.error('Cache batch set failed', { pattern, error });
    }
  }

  /**
   * Get multiple values at once
   */
  async getMany<T>(
    pattern: CacheKeyPattern | string,
    keys: string[]
  ): Promise<Map<string, T>> {
    try {
      const fullKeys = keys.map((key) => this.buildKey(pattern, key));
      const values = await this.redis.mget(...fullKeys);

      const result = new Map<string, T>();

      values.forEach((value, index) => {
        if (value !== null) {
          try {
            result.set(keys[index], JSON.parse(value) as T);
            this.hits++;
          } catch (error) {
            logger.warn('Failed to parse cached value', { key: keys[index], error });
            this.misses++;
          }
        } else {
          this.misses++;
        }
      });

      logger.debug('Cache batch get', {
        pattern,
        requested: keys.length,
        found: result.size,
      });

      return result;
    } catch (error) {
      logger.error('Cache batch get failed', { pattern, error });
      return new Map();
    }
  }

  /**
   * Increment a counter
   */
  async increment(pattern: CacheKeyPattern | string, key: string): Promise<number> {
    try {
      const fullKey = this.buildKey(pattern, key);
      const value = await this.redis.incr(fullKey);
      logger.debug('Cache increment', { key: fullKey, value });
      return value;
    } catch (error) {
      logger.error('Cache increment failed', { pattern, key, error });
      return 0;
    }
  }

  /**
   * Decrement a counter
   */
  async decrement(pattern: CacheKeyPattern | string, key: string): Promise<number> {
    try {
      const fullKey = this.buildKey(pattern, key);
      const value = await this.redis.decr(fullKey);
      logger.debug('Cache decrement', { key: fullKey, value });
      return value;
    } catch (error) {
      logger.error('Cache decrement failed', { pattern, key, error });
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? this.hits / total : 0;

    return {
      hits: this.hits,
      misses: this.misses,
      hitRate,
      totalKeys: 0, // Can be computed with DBSIZE if needed
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Clear all cache keys in namespace
   */
  async clear(): Promise<number> {
    try {
      const pattern = `${this.namespace}:*`;
      const keys = await this.redis.keys(pattern);

      if (keys.length === 0) {
        return 0;
      }

      const deleted = await this.redis.del(...keys);
      logger.info('Cache cleared', { namespace: this.namespace, deleted });
      return deleted;
    } catch (error) {
      logger.error('Cache clear failed', { error });
      return 0;
    }
  }

  /**
   * Warm cache with precomputed values
   */
  async warm<T>(
    pattern: CacheKeyPattern | string,
    dataLoader: () => Promise<Array<{ key: string; value: T }>>,
    options?: CacheOptions
  ): Promise<number> {
    try {
      logger.info('Cache warming started', { pattern });
      const data = await dataLoader();
      await this.setMany(pattern, data, options);
      logger.info('Cache warming completed', { pattern, count: data.length });
      return data.length;
    } catch (error) {
      logger.error('Cache warming failed', { pattern, error });
      return 0;
    }
  }

  /**
   * Health check - verify Redis connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      logger.error('Cache health check failed', { error });
      return false;
    }
  }
}
