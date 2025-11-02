/**
 * EmbeddingService Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmbeddingService } from '../src/services/embedding.service.js';
import type { RedisConnection } from '@axon/shared';
import type { Redis } from 'ioredis';

describe('EmbeddingService', () => {
  let embeddingService: EmbeddingService;
  let mockRedis: Partial<Redis>;
  let mockRedisConnection: Partial<RedisConnection>;

  beforeEach(() => {
    // Mock Redis client
    mockRedis = {
      get: vi.fn(),
      setex: vi.fn(),
      del: vi.fn(),
      ping: vi.fn().mockResolvedValue('PONG'),
    };

    // Mock RedisConnection
    mockRedisConnection = {
      getClient: vi.fn().mockReturnValue(mockRedis as Redis),
    };

    embeddingService = new EmbeddingService(mockRedisConnection as RedisConnection);
  });

  describe('generateEmbedding', () => {
    it('should generate embeddings for text', async () => {
      const text = 'test text';
      const embedding = await embeddingService.generateEmbedding(text);

      expect(embedding).toBeInstanceOf(Array);
      expect(embedding.length).toBeGreaterThan(0);
      expect(typeof embedding[0]).toBe('number');
    });

    it('should cache embeddings in Redis', async () => {
      const text = 'cache test';
      (mockRedis.get as any).mockResolvedValue(null); // Cache miss

      await embeddingService.generateEmbedding(text);

      expect(mockRedis.setex).toHaveBeenCalled();
      const setexCall = (mockRedis.setex as any).mock.calls[0];
      expect(setexCall[0]).toMatch(/^embed:/); // Cache key
      expect(setexCall[1]).toBe(86400); // TTL
      expect(typeof setexCall[2]).toBe('string'); // JSON string
    });

    it('should return cached embeddings on cache hit', async () => {
      const text = 'cached text';
      const cachedEmbedding = [0.1, 0.2, 0.3];
      (mockRedis.get as any).mockResolvedValue(JSON.stringify(cachedEmbedding));

      const embedding = await embeddingService.generateEmbedding(text);

      expect(embedding).toEqual(cachedEmbedding);
      expect(mockRedis.get).toHaveBeenCalled();
    });

    it('should handle empty text', async () => {
      const embedding = await embeddingService.generateEmbedding('');
      expect(embedding).toBeInstanceOf(Array);
    });
  });

  describe('generateBatchEmbeddings', () => {
    it('should generate embeddings for multiple texts', async () => {
      const texts = ['text 1', 'text 2', 'text 3'];
      (mockRedis.get as any).mockResolvedValue(null); // All cache misses

      const result = await embeddingService.generateBatchEmbeddings({
        texts,
        cacheKeyPrefix: 'test',
      });

      expect(result.embeddings).toHaveLength(texts.length);
      expect(result.cacheHits).toEqual([false, false, false]);
      expect(result.latencyMs).toBeGreaterThan(0);
    });

    it('should use cached embeddings when available', async () => {
      const texts = ['text 1', 'text 2'];
      const cachedEmbedding = [0.1, 0.2, 0.3];

      // First text cached, second not
      (mockRedis.get as any)
        .mockResolvedValueOnce(JSON.stringify(cachedEmbedding))
        .mockResolvedValueOnce(null);

      const result = await embeddingService.generateBatchEmbeddings({
        texts,
        cacheKeyPrefix: 'test',
      });

      expect(result.embeddings).toHaveLength(2);
      expect(result.cacheHits).toEqual([true, false]);
      expect(result.embeddings[0]).toEqual(cachedEmbedding);
    });

    it('should handle large batches by chunking', async () => {
      const texts = Array(100).fill('test text');
      (mockRedis.get as any).mockResolvedValue(null);

      const result = await embeddingService.generateBatchEmbeddings({
        texts,
        cacheKeyPrefix: 'large',
      });

      expect(result.embeddings).toHaveLength(100);
    });
  });

  describe('clearCache', () => {
    it('should clear embedding cache', async () => {
      const pattern = 'embed:test*';
      await embeddingService.clearCache(pattern);

      // Note: This is a simplified test - actual Redis SCAN would be more complex
      expect(mockRedis.del).toHaveBeenCalled();
    });
  });

  describe('healthCheck', () => {
    it('should return true when Redis is healthy', async () => {
      const isHealthy = await embeddingService.healthCheck();
      expect(isHealthy).toBe(true);
      expect(mockRedis.ping).toHaveBeenCalled();
    });

    it('should return false when Redis is unhealthy', async () => {
      (mockRedis.ping as any).mockRejectedValue(new Error('Connection failed'));

      const isHealthy = await embeddingService.healthCheck();
      expect(isHealthy).toBe(false);
    });
  });
});
