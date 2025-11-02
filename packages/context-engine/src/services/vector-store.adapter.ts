/**
 * Vector Store Adapter
 * 
 * Wraps QdrantVectorStore with context-specific operations,
 * filtering, and error handling.
 */

import { QdrantVectorStore, logger } from '@axon/shared';
import type { IContext, ContextTier } from '@axon/shared';
import type { VectorPoint } from '@axon/shared';
import type { VectorSearchFilter } from '../types';
import { VECTOR_SEARCH_LIMIT } from '../config';

export interface ContextSearchResult {
  context: Partial<IContext>;
  similarity: number;
  payload: Record<string, any>;
}

export class VectorStoreAdapter {
  private vectorStore: QdrantVectorStore;

  constructor(vectorStore: QdrantVectorStore) {
    this.vectorStore = vectorStore;
  }

  /**
   * Initialize the vector store collection
   */
  async initialize(): Promise<void> {
    try {
      await this.vectorStore.initializeCollection();
      logger.info('Vector store collection initialized');
    } catch (error) {
      logger.error('Failed to initialize vector store collection', error);
      throw error;
    }
  }

  /**
   * Index a context in the vector store
   */
  async indexContext(context: IContext, embedding: number[]): Promise<void> {
    try {
      const point: VectorPoint = {
        id: context.id,
        vector: embedding,
        payload: {
          workspaceId: context.workspaceId,
          tier: context.tier,
          type: context.type,
          source: context.metadata.source || '',
          confidence: 1.0, // Default confidence
          usageCount: context.metadata.usageCount || 0,
          tags: context.metadata.tags || [],
          createdAt: context.createdAt.toISOString(),
          updatedAt: context.updatedAt.toISOString(),
        },
      };

      await this.vectorStore.upsert(point);
      logger.debug(`Indexed context ${context.id} in vector store`);
    } catch (error) {
      logger.error(`Failed to index context ${context.id}`, error);
      throw error;
    }
  }

  /**
   * Index multiple contexts in batch
   */
  async indexContextsBatch(contexts: IContext[], embeddings: number[][]): Promise<void> {
    if (contexts.length !== embeddings.length) {
      throw new Error('Contexts and embeddings arrays must have the same length');
    }

    try {
      const points: VectorPoint[] = contexts.map((context, index) => ({
        id: context.id,
        vector: embeddings[index],
        payload: {
          workspaceId: context.workspaceId,
          tier: context.tier,
          type: context.type,
          source: context.metadata.source || '',
          confidence: 1.0,
          usageCount: context.metadata.usageCount || 0,
          tags: context.metadata.tags || [],
          createdAt: context.createdAt.toISOString(),
          updatedAt: context.updatedAt.toISOString(),
        },
      }));

      await this.vectorStore.upsertBatch(points);
      logger.info(`Indexed ${contexts.length} contexts in batch`);
    } catch (error) {
      logger.error('Failed to index contexts batch', error);
      throw error;
    }
  }

  /**
   * Search for similar contexts with filtering
   */
  async search(
    queryEmbedding: number[],
    filter?: VectorSearchFilter,
    limit: number = VECTOR_SEARCH_LIMIT
  ): Promise<ContextSearchResult[]> {
    try {
      // Build filter object for Qdrant
      const qdrantFilter = this.buildQdrantFilter(filter);

      // Perform vector search
      const results = await this.vectorStore.search(
        queryEmbedding,
        limit,
        qdrantFilter
      );

      // Map results to ContextSearchResult format
      return results.map(result => ({
        context: {
          id: result.id,
          workspaceId: result.payload.workspaceId as string,
          tier: result.payload.tier as ContextTier,
          type: result.payload.type as any, // Type from payload
          metadata: {
            source: result.payload.source as string,
            usageCount: result.payload.usageCount as number,
            tags: result.payload.tags as string[],
          },
          createdAt: new Date(result.payload.createdAt as string),
          updatedAt: new Date(result.payload.updatedAt as string),
        },
        similarity: result.score,
        payload: result.payload,
      }));
    } catch (error) {
      logger.error('Vector search failed', error);
      throw error;
    }
  }

  /**
   * Delete a context from the vector store
   */
  async deleteContext(contextId: string): Promise<void> {
    try {
      await this.vectorStore.delete(contextId);
      logger.debug(`Deleted context ${contextId} from vector store`);
    } catch (error) {
      logger.error(`Failed to delete context ${contextId}`, error);
      throw error;
    }
  }

  /**
   * Delete multiple contexts in batch
   */
  async deleteContextsBatch(contextIds: string[]): Promise<void> {
    try {
      await this.vectorStore.deleteBatch(contextIds);
      logger.info(`Deleted ${contextIds.length} contexts from vector store`);
    } catch (error) {
      logger.error('Failed to delete contexts batch', error);
      throw error;
    }
  }

  /**
   * Delete contexts by filter
   */
  async deleteByFilter(filter: VectorSearchFilter): Promise<void> {
    try {
      const qdrantFilter = this.buildQdrantFilter(filter);
      if (qdrantFilter) {
        await this.vectorStore.deleteByFilter(qdrantFilter);
        logger.info('Deleted contexts by filter');
      }
    } catch (error) {
      logger.error('Failed to delete contexts by filter', error);
      throw error;
    }
  }

  /**
   * Get collection statistics
   */
  async getStats(): Promise<{ count: number }> {
    try {
      const count = await this.vectorStore.count();
      return { count };
    } catch (error) {
      logger.error('Failed to get vector store stats', error);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      return await this.vectorStore.healthCheck();
    } catch (error) {
      logger.error('Vector store health check failed', error);
      return false;
    }
  }

  /**
   * Build Qdrant filter from VectorSearchFilter
   */
  private buildQdrantFilter(filter?: VectorSearchFilter): Record<string, any> | undefined {
    if (!filter) return undefined;

    const must: any[] = [];

    if (filter.workspaceId) {
      must.push({
        key: 'workspaceId',
        match: { value: filter.workspaceId },
      });
    }

    if (filter.tier) {
      must.push({
        key: 'tier',
        match: { value: filter.tier },
      });
    }

    if (filter.taskType) {
      must.push({
        key: 'taskType',
        match: { value: filter.taskType },
      });
    }

    if (filter.source) {
      must.push({
        key: 'source',
        match: { value: filter.source },
      });
    }

    if (filter.minConfidence !== undefined) {
      must.push({
        key: 'confidence',
        range: { gte: filter.minConfidence },
      });
    }

    if (filter.tags && filter.tags.length > 0) {
      must.push({
        key: 'tags',
        match: { any: filter.tags },
      });
    }

    return must.length > 0 ? { must } : undefined;
  }
}
