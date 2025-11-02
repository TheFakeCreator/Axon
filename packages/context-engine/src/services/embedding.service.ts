/**
 * Embedding Service
 * 
 * Wraps the shared embedding utility with batch operations, caching,
 * and performance optimizations for the Context Engine.
 */

import { EmbeddingService as BaseEmbeddingService, RedisConnection, logger } from '@axon/shared';
import type { BatchEmbeddingRequest, BatchEmbeddingResult } from '../types';
import { EMBEDDING_CACHE_TTL, MAX_EMBEDDING_BATCH_SIZE } from '../config';
import crypto from 'crypto';
import type { Redis } from 'ioredis';

export class EmbeddingService {
  private baseService: BaseEmbeddingService;
  private redis: Redis;

  constructor(redisConnection: RedisConnection) {
    this.baseService = new BaseEmbeddingService();
    this.redis = redisConnection.getClient();
  }

  /**
   * Generate embedding for a single text with caching
   */
  async generateEmbedding(text: string, cacheKey?: string): Promise<number[]> {
    const key = cacheKey || this.generateCacheKey(text);

    // Check cache first
    const cached = await this.redis.get(key);
    if (cached) {
      logger.debug(`Embedding cache hit for key: ${key}`);
      return JSON.parse(cached);
    }

    // Generate new embedding
    const startTime = Date.now();
    const result = await this.baseService.generateEmbedding(text);
    // Handle both array and EmbeddingResult type
    const embedding = Array.isArray(result) ? result : (result as any).vector || [];
    const latency = Date.now() - startTime;

    logger.debug(`Generated embedding in ${latency}ms`);

    // Cache the result
    await this.redis.setex(key, EMBEDDING_CACHE_TTL, JSON.stringify(embedding));

    return embedding;
  }

  /**
   * Generate embeddings for multiple texts with batching and caching
   */
  async generateBatchEmbeddings(request: BatchEmbeddingRequest): Promise<BatchEmbeddingResult> {
    const { texts, cacheKeyPrefix = 'embed' } = request;
    const startTime = Date.now();

    if (texts.length === 0) {
      return {
        embeddings: [],
        texts: [],
        cacheHits: [],
        latencyMs: 0,
      };
    }

    // Check cache for all texts
    const results: (number[] | null)[] = [];
    const uncachedIndices: number[] = [];
    const uncachedTexts: string[] = [];
    const cacheHits: number[] = [];

    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      const key = this.generateCacheKey(text, cacheKeyPrefix);
      const cached = await this.redis.get(key);

      if (cached) {
        results[i] = JSON.parse(cached);
        cacheHits.push(i);
      } else {
        results[i] = null;
        uncachedIndices.push(i);
        uncachedTexts.push(text);
      }
    }

    logger.debug(`Embedding batch: ${cacheHits.length} cache hits, ${uncachedTexts.length} to generate`);

    // Generate embeddings for uncached texts in batches
    if (uncachedTexts.length > 0) {
      const batches = this.chunkArray(uncachedTexts, MAX_EMBEDDING_BATCH_SIZE);
      let batchIndex = 0;

      for (const batch of batches) {
        const batchResults = await this.baseService.generateBatchEmbeddings(batch);
        // Extract vectors from results
        const batchEmbeddings = Array.isArray(batchResults) 
          ? batchResults 
          : batch.map((_, idx) => (batchResults as any)[idx]?.vector || []);

        // Store results and cache
        for (let i = 0; i < batch.length; i++) {
          const originalIndex = uncachedIndices[batchIndex];
          const embedding = batchEmbeddings[i];
          results[originalIndex] = embedding;

          // Cache the result
          const key = this.generateCacheKey(batch[i], cacheKeyPrefix);
          await this.redis.setex(key, EMBEDDING_CACHE_TTL, JSON.stringify(embedding));

          batchIndex++;
        }
      }
    }

    const latencyMs = Date.now() - startTime;

    return {
      embeddings: results as number[][],
      texts,
      cacheHits,
      latencyMs,
    };
  }

  /**
   * Clear embedding cache for a specific text or pattern
   */
  async clearCache(pattern?: string): Promise<void> {
    if (pattern) {
      await this.redis.del(pattern);
      logger.info(`Cleared embedding cache for pattern: ${pattern}`);
    }
  }

  /**
   * Warm up cache with frequently used texts
   */
  async warmupCache(texts: string[], cacheKeyPrefix?: string): Promise<void> {
    logger.info(`Warming up embedding cache with ${texts.length} texts`);
    await this.generateBatchEmbeddings({ texts, cacheKeyPrefix });
  }

  /**
   * Generate cache key for a text
   */
  private generateCacheKey(text: string, prefix: string = 'embed'): string {
    const hash = crypto.createHash('md5').update(text).digest('hex');
    return `${prefix}:${hash}`;
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Test embedding generation
      await this.baseService.generateEmbedding('health check');
      // Test cache
      await this.redis.ping();
      return true;
    } catch (error) {
      logger.error('Embedding service health check failed', error);
      return false;
    }
  }
}
