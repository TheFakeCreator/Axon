/**
 * ContextRetriever Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContextRetriever } from '../src/retrieval/context-retriever.js';
import type { MongoDBConnection } from '@axon/shared';
import type { IContext, IEntity, TaskCategory } from '@axon/shared';
import { ContextTier, ContextType } from '@axon/shared';
import type { EmbeddingService } from '../src/services/embedding.service.js';
import type { VectorStoreAdapter } from '../src/services/vector-store.adapter.js';

describe('ContextRetriever', () => {
  let contextRetriever: ContextRetriever;
  let mockEmbeddingService: Partial<EmbeddingService>;
  let mockVectorStore: Partial<VectorStoreAdapter>;
  let mockMongoDB: Partial<MongoDBConnection>;
  let mockCollection: any;

  beforeEach(() => {
    // Mock collection
    mockCollection = {
      find: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([]),
      updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
    };

    // Mock MongoDB
    mockMongoDB = {
      getDb: vi.fn().mockReturnValue({
        collection: vi.fn().mockReturnValue(mockCollection),
      }),
    };

    // Mock EmbeddingService
    mockEmbeddingService = {
      generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    };

    // Mock VectorStoreAdapter
    mockVectorStore = {
      search: vi.fn().mockResolvedValue([]),
    };

    contextRetriever = new ContextRetriever(
      mockEmbeddingService as EmbeddingService,
      mockVectorStore as VectorStoreAdapter,
      mockMongoDB as MongoDBConnection
    );
  });

  describe('retrieve', () => {
    it('should retrieve contexts successfully', async () => {
      const request = {
        query: 'test query',
        workspaceId: 'workspace-1',
        taskType: 'general-query' as TaskCategory,
        entities: [],
        limit: 10,
      };

      const mockSearchResults = [
        {
          context: { id: 'ctx-1', workspaceId: 'workspace-1' },
          similarity: 0.9,
          payload: {},
        },
      ];

      const mockContext: IContext = {
        id: 'ctx-1',
        workspaceId: 'workspace-1',
        tier: ContextTier.WORKSPACE,
        type: ContextType.SYMBOL,
        content: 'test content',
        metadata: {
          source: 'test.ts',
          usageCount: 5,
          confidence: 0.9,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockVectorStore.search as any).mockResolvedValue(mockSearchResults);
      mockCollection.toArray.mockResolvedValue([mockContext]);

      const result = await contextRetriever.retrieve(request);

      expect(result.contexts).toHaveLength(1);
      expect(result.contexts[0].id).toBe('ctx-1');
      expect(result.totalFound).toBe(1);
      expect(result.latencyMs).toBeGreaterThan(0);
    });

    it('should expand query with high-confidence entities', async () => {
      const entities: IEntity[] = [
        { type: 'technology', value: 'TypeScript', confidence: 0.8 },
        { type: 'technology', value: 'React', confidence: 0.5 }, // Low confidence
      ];

      const request = {
        query: 'test query',
        workspaceId: 'workspace-1',
        taskType: 'general-query' as TaskCategory,
        entities,
        limit: 10,
      };

      await contextRetriever.retrieve(request);

      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith(
        expect.stringContaining('TypeScript')
      );
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith(
        expect.not.stringContaining('React')
      );
    });

    it('should apply re-ranking algorithm', async () => {
      const now = Date.now();
      const oldDate = new Date(now - 30 * 24 * 60 * 60 * 1000); // 30 days old
      const newDate = new Date(now - 1 * 24 * 60 * 60 * 1000); // 1 day old

      const mockSearchResults = [
        {
          context: { id: 'ctx-1' },
          similarity: 0.8,
          payload: {},
        },
        {
          context: { id: 'ctx-2' },
          similarity: 0.7,
          payload: {},
        },
      ];

      const mockContexts: IContext[] = [
        {
          id: 'ctx-1',
          workspaceId: 'workspace-1',
          tier: ContextTier.WORKSPACE,
          type: ContextType.SYMBOL,
          content: 'old content',
          metadata: {
            source: 'old.ts',
            usageCount: 10,
            confidence: 0.9,
          },
          createdAt: oldDate,
          updatedAt: oldDate,
        },
        {
          id: 'ctx-2',
          workspaceId: 'workspace-1',
          tier: ContextTier.WORKSPACE,
          type: ContextType.SYMBOL,
          content: 'new content',
          metadata: {
            source: 'new.ts',
            usageCount: 2,
            confidence: 0.9,
          },
          createdAt: newDate,
          updatedAt: newDate,
        },
      ];

      (mockVectorStore.search as any).mockResolvedValue(mockSearchResults);
      mockCollection.toArray.mockResolvedValue(mockContexts);

      const result = await contextRetriever.retrieve({
        query: 'test',
        workspaceId: 'workspace-1',
        taskType: 'general-query' as TaskCategory,
        entities: [],
        limit: 10,
      });

      // Newer context should rank higher due to freshness despite lower semantic score
      expect(result.contexts[0].scoreBreakdown.freshness).toBeGreaterThan(
        result.contexts[1].scoreBreakdown.freshness
      );
    });

    it('should search hierarchically across tiers', async () => {
      const request = {
        query: 'test',
        workspaceId: 'workspace-1',
        taskType: 'general-query' as TaskCategory,
        entities: [],
        limit: 10,
      };

      await contextRetriever.retrieve(request);

      // Should search workspace tier first
      expect(mockVectorStore.search).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          workspaceId: 'workspace-1',
          tier: 'workspace',
        }),
        expect.any(Number)
      );
    });
  });

  describe('edge cases', () => {
    it('should handle empty query', async () => {
      const result = await contextRetriever.retrieve({
        query: '',
        workspaceId: 'workspace-1',
        taskType: 'general-query' as TaskCategory,
        entities: [],
        limit: 10,
      });

      expect(result.contexts).toHaveLength(0);
    });

    it('should handle no results from vector search', async () => {
      (mockVectorStore.search as any).mockResolvedValue([]);

      const result = await contextRetriever.retrieve({
        query: 'test',
        workspaceId: 'workspace-1',
        taskType: 'general-query' as TaskCategory,
        entities: [],
        limit: 10,
      });

      expect(result.contexts).toHaveLength(0);
      expect(result.totalFound).toBe(0);
    });

    it('should update usage statistics', async () => {
      const mockContext: IContext = {
        id: 'ctx-1',
        workspaceId: 'workspace-1',
        tier: ContextTier.WORKSPACE,
        type: ContextType.SYMBOL,
        content: 'test',
        metadata: {
          source: 'test.ts',
          usageCount: 5,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockVectorStore.search as any).mockResolvedValue([
        { context: { id: 'ctx-1' }, similarity: 0.9, payload: {} },
      ]);
      mockCollection.toArray.mockResolvedValue([mockContext]);

      await contextRetriever.retrieve({
        query: 'test',
        workspaceId: 'workspace-1',
        taskType: 'general-query' as TaskCategory,
        entities: [],
        limit: 10,
      });

      expect(mockCollection.updateOne).toHaveBeenCalled();
    });
  });
});
