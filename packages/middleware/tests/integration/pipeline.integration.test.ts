/**
 * Integration Tests - Database Operations
 * Tests database operations with real MongoDB and Redis instances
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  setupTestDatabases,
  teardownTestDatabases,
  clearTestData,
  getTestContext,
  insertTestData,
  getTestData,
  setRedisTestData,
  getRedisTestData,
} from './setup.js';
import type { IContext } from '@axon/shared';
import { ContextTier, ContextType } from '@axon/shared';

describe('Database Integration Tests', () => {
  const WORKSPACE_ID = '123e4567-e89b-12d3-a456-426614174000';

  beforeAll(async () => {
    await setupTestDatabases();
  }, 300000); // 5 minutes timeout for MongoDB download on first run

  afterAll(async () => {
    await teardownTestDatabases();
  });

  beforeEach(async () => {
    await clearTestData();
  });

  describe('MongoDB Operations', () => {
    it('should insert and retrieve contexts from MongoDB', async () => {
      const testContexts: Partial<IContext>[] = [
        {
          id: 'ctx-1',
          workspaceId: WORKSPACE_ID,
          tier: ContextTier.WORKSPACE,
          type: ContextType.FILE,
          content: 'function authenticate(user) { /* auth logic */ }',
          metadata: {
            filePath: 'src/auth.ts',
            language: 'typescript',
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'ctx-2',
          workspaceId: WORKSPACE_ID,
          tier: ContextTier.WORKSPACE,
          type: ContextType.SYMBOL,
          content: 'class UserService { login() {} logout() {} }',
          metadata: {
            filePath: 'src/services/user.ts',
            tags: ['service', 'authentication'],
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      await insertTestData('contexts', testContexts);

      // Retrieve using helper
      const retrieved = await getTestData('contexts', { workspaceId: WORKSPACE_ID });

      expect(retrieved).toHaveLength(2);
      expect(retrieved[0].content).toContain('authenticate');
      expect(retrieved[1].content).toContain('UserService');
    });

    it('should filter contexts by workspace', async () => {
      await insertTestData('contexts', [
        {
          id: 'ctx-ws1',
          workspaceId: WORKSPACE_ID,
          tier: ContextTier.WORKSPACE,
          type: ContextType.FILE,
          content: 'Workspace 1 content',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'ctx-ws2',
          workspaceId: 'other-workspace-id',
          tier: ContextTier.WORKSPACE,
          type: ContextType.FILE,
          content: 'Workspace 2 content',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const ws1Contexts = await getTestData('contexts', { workspaceId: WORKSPACE_ID });
      const ws2Contexts = await getTestData('contexts', { workspaceId: 'other-workspace-id' });

      expect(ws1Contexts).toHaveLength(1);
      expect(ws2Contexts).toHaveLength(1);
      expect(ws1Contexts[0].content).toBe('Workspace 1 content');
      expect(ws2Contexts[0].content).toBe('Workspace 2 content');
    });

    it('should update existing contexts', async () => {
      const { db } = getTestContext();

      await insertTestData('contexts', [
        {
          id: 'update-test',
          workspaceId: WORKSPACE_ID,
          tier: ContextTier.WORKSPACE,
          type: ContextType.FILE,
          content: 'Original content',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      // Update context
      await db.collection('contexts').updateOne(
        { id: 'update-test' },
        {
          $set: {
            content: 'Updated content',
            updatedAt: new Date(),
          },
        }
      );

      // Retrieve updated context
      const updated = await getTestData('contexts', { id: 'update-test' });

      expect(updated).toHaveLength(1);
      expect(updated[0].content).toBe('Updated content');
    });

    it('should delete contexts', async () => {
      const { db } = getTestContext();

      await insertTestData('contexts', [
        {
          id: 'delete-test',
          workspaceId: WORKSPACE_ID,
          tier: ContextTier.WORKSPACE,
          type: ContextType.FILE,
          content: 'To be deleted',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      // Verify insertion
      let contexts = await getTestData('contexts', { id: 'delete-test' });
      expect(contexts).toHaveLength(1);

      // Delete context
      await db.collection('contexts').deleteOne({ id: 'delete-test' });

      // Verify deletion
      contexts = await getTestData('contexts', { id: 'delete-test' });
      expect(contexts).toHaveLength(0);
    });

    it('should handle batch inserts efficiently', async () => {
      const contexts: Partial<IContext>[] = Array.from({ length: 50 }, (_, i) => ({
        id: `batch-ctx-${i}`,
        workspaceId: WORKSPACE_ID,
        tier: ContextTier.WORKSPACE,
        type: i % 2 === 0 ? ContextType.FILE : ContextType.SYMBOL,
        content: `Content ${i}`,
        metadata: {},
        createdAt: new Date(Date.now() - i * 1000),
        updatedAt: new Date(),
      }));

      const startTime = Date.now();
      await insertTestData('contexts', contexts);
      const insertTime = Date.now() - startTime;

      const retrieved = await getTestData('contexts', { workspaceId: WORKSPACE_ID });

      expect(retrieved).toHaveLength(50);
      expect(insertTime).toBeLessThan(1000); // Should be fast
    });

    it('should use indexes for efficient querying', async () => {
      // Insert 100 contexts across multiple workspaces
      const contexts: Partial<IContext>[] = Array.from({ length: 100 }, (_, i) => ({
        id: `perf-ctx-${i}`,
        workspaceId: i < 50 ? WORKSPACE_ID : 'other-workspace',
        tier: ContextTier.WORKSPACE,
        type: i % 2 === 0 ? ContextType.FILE : ContextType.SYMBOL,
        content: `Content ${i}`,
        metadata: {},
        createdAt: new Date(Date.now() - i * 1000),
        updatedAt: new Date(),
      }));

      await insertTestData('contexts', contexts);

      // Query with index (workspaceId)
      const startTime = Date.now();
      const results = await getTestData('contexts', { workspaceId: WORKSPACE_ID });
      const queryTime = Date.now() - startTime;

      expect(results).toHaveLength(50);
      expect(queryTime).toBeLessThan(100); // Should be fast with index
    });
  });

  describe('Redis Operations', () => {
    it('should set and get values from Redis', async () => {
      await setRedisTestData('test-key', 'test-value');

      const value = await getRedisTestData('test-key');

      expect(value).toBe('test-value');
    });

    it('should set and get JSON objects from Redis', async () => {
      const testObject = {
        id: 'test-1',
        name: 'Test Object',
        count: 42,
      };

      await setRedisTestData('test-object', JSON.stringify(testObject));

      const retrieved = await getRedisTestData('test-object');
      const parsedObject = JSON.parse(retrieved!);

      expect(parsedObject).toEqual(testObject);
    });

    it('should handle TTL for cached values', async () => {
      await setRedisTestData('ttl-key', 'ttl-value', 1); // 1 second TTL

      // Should exist immediately
      let value = await getRedisTestData('ttl-key');
      expect(value).toBe('ttl-value');

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should be expired
      value = await getRedisTestData('ttl-key');
      expect(value).toBeNull();
    });

    it('should return null for non-existent keys', async () => {
      const value = await getRedisTestData('non-existent-key');

      expect(value).toBeNull();
    });

    it('should handle multiple Redis operations', async () => {
      await setRedisTestData('key-1', 'value-1');
      await setRedisTestData('key-2', 'value-2');
      await setRedisTestData('key-3', 'value-3');

      const value1 = await getRedisTestData('key-1');
      const value2 = await getRedisTestData('key-2');
      const value3 = await getRedisTestData('key-3');

      expect(value1).toBe('value-1');
      expect(value2).toBe('value-2');
      expect(value3).toBe('value-3');
    });
  });

  describe('Combined MongoDB + Redis Operations', () => {
    it('should cache MongoDB query results in Redis', async () => {
      // Insert context to MongoDB
      await insertTestData('contexts', [
        {
          id: 'cache-test',
          workspaceId: WORKSPACE_ID,
          tier: ContextTier.WORKSPACE,
          type: ContextType.FILE,
          content: 'Cached content',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      // Query MongoDB
      const contexts = await getTestData('contexts', { id: 'cache-test' });
      expect(contexts).toHaveLength(1);

      // Cache in Redis
      await setRedisTestData(`context:cache-test`, JSON.stringify(contexts[0]), 60);

      // Retrieve from cache
      const cached = await getRedisTestData(`context:cache-test`);
      const cachedContext = JSON.parse(cached!);

      expect(cachedContext.id).toBe('cache-test');
      expect(cachedContext.content).toBe('Cached content');
    });

    it('should invalidate cache on update', async () => {
      const { db } = getTestContext();

      // Insert and cache
      await insertTestData('contexts', [
        {
          id: 'invalidate-test',
          workspaceId: WORKSPACE_ID,
          tier: ContextTier.WORKSPACE,
          type: ContextType.FILE,
          content: 'Original',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      await setRedisTestData(`context:invalidate-test`, 'cached-value', 60);

      // Verify cache exists
      let cached = await getRedisTestData(`context:invalidate-test`);
      expect(cached).toBe('cached-value');

      // Update MongoDB
      await db
        .collection('contexts')
        .updateOne({ id: 'invalidate-test' }, { $set: { content: 'Updated' } });

      // Invalidate cache (delete from Redis)
      const { redis } = getTestContext();
      await redis.del(`context:invalidate-test`);

      // Verify cache is gone
      cached = await getRedisTestData(`context:invalidate-test`);
      expect(cached).toBeNull();

      // Verify MongoDB has updated value
      const updated = await getTestData('contexts', { id: 'invalidate-test' });
      expect(updated[0].content).toBe('Updated');
    });
  });

  describe('Workspace Management', () => {
    it('should create and retrieve workspace metadata', async () => {
      await insertTestData('workspaces', [
        {
          id: WORKSPACE_ID,
          path: '/path/to/workspace',
          type: 'coding',
          metadata: {
            language: 'typescript',
            framework: 'express',
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const workspaces = await getTestData('workspaces', { id: WORKSPACE_ID });

      expect(workspaces).toHaveLength(1);
      expect(workspaces[0].path).toBe('/path/to/workspace');
      expect(workspaces[0].type).toBe('coding');
    });

    it('should enforce unique workspace paths', async () => {
      const { db } = getTestContext();

      await insertTestData('workspaces', [
        {
          id: WORKSPACE_ID,
          path: '/unique/path',
          type: 'coding',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      // Attempt to insert duplicate path
      const duplicateInsert = db.collection('workspaces').insertOne({
        id: 'different-id',
        path: '/unique/path', // Same path
        type: 'pkm',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Should fail due to unique index
      await expect(duplicateInsert).rejects.toThrow();
    });
  });
});
