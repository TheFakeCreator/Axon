/**
 * Tests for cache service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Redis } from 'ioredis';
import { CacheService, CacheKeyPattern } from '../src/utils/cache';

// Mock Redis
vi.mock('ioredis');

describe('CacheService', () => {
  let mockRedis: Redis;
  let cacheService: CacheService;

  beforeEach(() => {
    // Create mock Redis instance
    mockRedis = {
      get: vi.fn(),
      set: vi.fn(),
      setex: vi.fn(),
      del: vi.fn(),
      keys: vi.fn(),
      exists: vi.fn(),
      ttl: vi.fn(),
      expire: vi.fn(),
      mget: vi.fn(),
      incr: vi.fn(),
      decr: vi.fn(),
      ping: vi.fn(),
      pipeline: vi.fn(() => ({
        set: vi.fn().mockReturnThis(),
        setex: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      })),
    } as unknown as Redis;

    cacheService = new CacheService(mockRedis, 'test');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('set', () => {
    it('should set value without TTL', async () => {
      const value = { name: 'test', count: 42 };
      await cacheService.set(CacheKeyPattern.CONTEXT, 'key1', value);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'test:context:key1',
        JSON.stringify(value)
      );
    });

    it('should set value with TTL', async () => {
      const value = { name: 'test', count: 42 };
      await cacheService.set(CacheKeyPattern.CONTEXT, 'key1', value, { ttl: 3600 });

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'test:context:key1',
        3600,
        JSON.stringify(value)
      );
    });

    it('should handle errors gracefully', async () => {
      vi.spyOn(mockRedis, 'set').mockRejectedValueOnce(new Error('Redis error'));

      await expect(
        cacheService.set(CacheKeyPattern.CONTEXT, 'key1', { test: 'value' })
      ).resolves.not.toThrow();
    });
  });

  describe('get', () => {
    it('should get value from cache', async () => {
      const value = { name: 'test', count: 42 };
      vi.spyOn(mockRedis, 'get').mockResolvedValue(JSON.stringify(value));

      const result = await cacheService.get(CacheKeyPattern.CONTEXT, 'key1');

      expect(result).toEqual(value);
      expect(mockRedis.get).toHaveBeenCalledWith('test:context:key1');
    });

    it('should return null for cache miss', async () => {
      vi.spyOn(mockRedis, 'get').mockResolvedValue(null);

      const result = await cacheService.get(CacheKeyPattern.CONTEXT, 'key1');

      expect(result).toBeNull();
    });

    it('should track cache hits and misses', async () => {
      vi.spyOn(mockRedis, 'get')
        .mockResolvedValueOnce(JSON.stringify({ test: 'value' }))
        .mockResolvedValueOnce(null);

      await cacheService.get(CacheKeyPattern.CONTEXT, 'key1');
      await cacheService.get(CacheKeyPattern.CONTEXT, 'key2');

      const stats = cacheService.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });
  });

  describe('getOrCompute', () => {
    it('should return cached value if exists', async () => {
      const cachedValue = { name: 'cached', count: 10 };
      vi.spyOn(mockRedis, 'get').mockResolvedValue(JSON.stringify(cachedValue));

      const computeFn = vi.fn().mockResolvedValue({ name: 'computed', count: 20 });
      const result = await cacheService.getOrCompute(
        CacheKeyPattern.CONTEXT,
        'key1',
        computeFn
      );

      expect(result).toEqual(cachedValue);
      expect(computeFn).not.toHaveBeenCalled();
    });

    it('should compute and cache value if not exists', async () => {
      const computedValue = { name: 'computed', count: 20 };
      vi.spyOn(mockRedis, 'get').mockResolvedValue(null);
      vi.spyOn(mockRedis, 'set').mockResolvedValue('OK');

      const computeFn = vi.fn().mockResolvedValue(computedValue);
      const result = await cacheService.getOrCompute(
        CacheKeyPattern.CONTEXT,
        'key1',
        computeFn
      );

      expect(result).toEqual(computedValue);
      expect(computeFn).toHaveBeenCalled();
      expect(mockRedis.set).toHaveBeenCalledWith(
        'test:context:key1',
        JSON.stringify(computedValue)
      );
    });
  });

  describe('delete', () => {
    it('should delete key from cache', async () => {
      await cacheService.delete(CacheKeyPattern.CONTEXT, 'key1');

      expect(mockRedis.del).toHaveBeenCalledWith('test:context:key1');
    });
  });

  describe('deleteByPattern', () => {
    it('should delete keys matching pattern', async () => {
      vi.spyOn(mockRedis, 'keys').mockResolvedValue([
        'test:context:key1',
        'test:context:key2',
      ]);
      vi.spyOn(mockRedis, 'del').mockResolvedValue(2);

      const deleted = await cacheService.deleteByPattern(CacheKeyPattern.CONTEXT);

      expect(deleted).toBe(2);
      expect(mockRedis.keys).toHaveBeenCalledWith('test:context:*');
      expect(mockRedis.del).toHaveBeenCalledWith('test:context:key1', 'test:context:key2');
    });

    it('should return 0 if no keys match', async () => {
      vi.spyOn(mockRedis, 'keys').mockResolvedValue([]);

      const deleted = await cacheService.deleteByPattern(CacheKeyPattern.CONTEXT);

      expect(deleted).toBe(0);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe('exists', () => {
    it('should check if key exists', async () => {
      vi.spyOn(mockRedis, 'exists').mockResolvedValue(1);

      const exists = await cacheService.exists(CacheKeyPattern.CONTEXT, 'key1');

      expect(exists).toBe(true);
      expect(mockRedis.exists).toHaveBeenCalledWith('test:context:key1');
    });

    it('should return false if key does not exist', async () => {
      vi.spyOn(mockRedis, 'exists').mockResolvedValue(0);

      const exists = await cacheService.exists(CacheKeyPattern.CONTEXT, 'key1');

      expect(exists).toBe(false);
    });
  });

  describe('getTTL', () => {
    it('should get remaining TTL', async () => {
      vi.spyOn(mockRedis, 'ttl').mockResolvedValue(3600);

      const ttl = await cacheService.getTTL(CacheKeyPattern.CONTEXT, 'key1');

      expect(ttl).toBe(3600);
      expect(mockRedis.ttl).toHaveBeenCalledWith('test:context:key1');
    });
  });

  describe('extendTTL', () => {
    it('should extend TTL for key', async () => {
      await cacheService.extendTTL(CacheKeyPattern.CONTEXT, 'key1', 7200);

      expect(mockRedis.expire).toHaveBeenCalledWith('test:context:key1', 7200);
    });
  });

  describe('setMany', () => {
    it('should set multiple values using pipeline', async () => {
      const entries = [
        { key: 'key1', value: { count: 1 } },
        { key: 'key2', value: { count: 2 } },
      ];

      await cacheService.setMany(CacheKeyPattern.CONTEXT, entries);

      expect(mockRedis.pipeline).toHaveBeenCalled();
    });
  });

  describe('getMany', () => {
    it('should get multiple values at once', async () => {
      const values = [JSON.stringify({ count: 1 }), JSON.stringify({ count: 2 })];
      vi.spyOn(mockRedis, 'mget').mockResolvedValue(values);

      const result = await cacheService.getMany(CacheKeyPattern.CONTEXT, [
        'key1',
        'key2',
      ]);

      expect(result.size).toBe(2);
      expect(result.get('key1')).toEqual({ count: 1 });
      expect(result.get('key2')).toEqual({ count: 2 });
    });

    it('should handle null values in batch get', async () => {
      vi.spyOn(mockRedis, 'mget').mockResolvedValue([
        JSON.stringify({ count: 1 }),
        null,
      ]);

      const result = await cacheService.getMany(CacheKeyPattern.CONTEXT, [
        'key1',
        'key2',
      ]);

      expect(result.size).toBe(1);
      expect(result.get('key1')).toEqual({ count: 1 });
      expect(result.has('key2')).toBe(false);
    });
  });

  describe('increment', () => {
    it('should increment counter', async () => {
      vi.spyOn(mockRedis, 'incr').mockResolvedValue(1);

      const value = await cacheService.increment(CacheKeyPattern.CONTEXT, 'counter');

      expect(value).toBe(1);
      expect(mockRedis.incr).toHaveBeenCalledWith('test:context:counter');
    });
  });

  describe('decrement', () => {
    it('should decrement counter', async () => {
      vi.spyOn(mockRedis, 'decr').mockResolvedValue(0);

      const value = await cacheService.decrement(CacheKeyPattern.CONTEXT, 'counter');

      expect(value).toBe(0);
      expect(mockRedis.decr).toHaveBeenCalledWith('test:context:counter');
    });
  });

  describe('clear', () => {
    it('should clear all keys in namespace', async () => {
      vi.spyOn(mockRedis, 'keys').mockResolvedValue([
        'test:context:key1',
        'test:embedding:key2',
      ]);
      vi.spyOn(mockRedis, 'del').mockResolvedValue(2);

      const deleted = await cacheService.clear();

      expect(deleted).toBe(2);
      expect(mockRedis.keys).toHaveBeenCalledWith('test:*');
    });
  });

  describe('warm', () => {
    it('should warm cache with precomputed values', async () => {
      const dataLoader = vi.fn().mockResolvedValue([
        { key: 'key1', value: { count: 1 } },
        { key: 'key2', value: { count: 2 } },
      ]);

      const count = await cacheService.warm(CacheKeyPattern.CONTEXT, dataLoader);

      expect(count).toBe(2);
      expect(dataLoader).toHaveBeenCalled();
      expect(mockRedis.pipeline).toHaveBeenCalled();
    });
  });

  describe('healthCheck', () => {
    it('should return true if Redis is healthy', async () => {
      vi.spyOn(mockRedis, 'ping').mockResolvedValue('PONG');

      const healthy = await cacheService.healthCheck();

      expect(healthy).toBe(true);
    });

    it('should return false if Redis ping fails', async () => {
      vi.spyOn(mockRedis, 'ping').mockRejectedValue(new Error('Connection failed'));

      const healthy = await cacheService.healthCheck();

      expect(healthy).toBe(false);
    });
  });

  describe('stats', () => {
    it('should return correct statistics', async () => {
      vi.spyOn(mockRedis, 'get')
        .mockResolvedValueOnce(JSON.stringify({ test: 'value' }))
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(JSON.stringify({ test: 'value' }));

      await cacheService.get(CacheKeyPattern.CONTEXT, 'key1'); // hit
      await cacheService.get(CacheKeyPattern.CONTEXT, 'key2'); // miss
      await cacheService.get(CacheKeyPattern.CONTEXT, 'key3'); // hit

      const stats = cacheService.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.667, 2);
    });

    it('should reset statistics', async () => {
      vi.spyOn(mockRedis, 'get').mockResolvedValue(JSON.stringify({ test: 'value' }));

      await cacheService.get(CacheKeyPattern.CONTEXT, 'key1');
      cacheService.resetStats();

      const stats = cacheService.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });
});
