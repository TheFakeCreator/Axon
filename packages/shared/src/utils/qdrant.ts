/**
 * Qdrant vector database connection and operations
 */

import { logger } from './logger';
import { DatabaseError } from './errors';

// Type for QdrantClient (will be imported dynamically)
type QdrantClient = any;

/**
 * Vector search result
 */
export interface VectorSearchResult {
  id: string;
  score: number;
  payload: Record<string, unknown>;
}

/**
 * Vector upsert payload
 */
export interface VectorPoint {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}

/**
 * Qdrant vector store configuration
 */
export interface QdrantConfig {
  url: string;
  apiKey?: string;
  collectionName: string;
  vectorSize: number;
  distance?: 'Cosine' | 'Euclid' | 'Dot';
}

/**
 * Qdrant vector store manager
 */
export class QdrantVectorStore {
  private client: QdrantClient | null = null;
  private collectionName: string;
  private vectorSize: number;
  private distance: 'Cosine' | 'Euclid' | 'Dot';
  private config: QdrantConfig;
  private initPromise: Promise<void> | null = null;

  constructor(config: QdrantConfig) {
    this.config = config;
    this.collectionName = config.collectionName;
    this.vectorSize = config.vectorSize;
    this.distance = config.distance || 'Cosine';
  }

  /**
   * Initialize Qdrant client (lazy initialization with dynamic import)
   */
  private async initClient(): Promise<void> {
    if (this.client) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        const { QdrantClient } = await import('@qdrant/js-client-rest');
        this.client = new QdrantClient({
          url: this.config.url,
          apiKey: this.config.apiKey,
        });
        logger.info('Qdrant client initialized', { url: this.config.url });
      } catch (error) {
        this.initPromise = null;
        throw new DatabaseError('Failed to initialize Qdrant client', { error });
      }
    })();

    return this.initPromise;
  }

  /**
   * Ensure client is initialized before use
   */
  private async ensureClient(): Promise<void> {
    await this.initClient();
    if (!this.client) {
      throw new DatabaseError('Qdrant client not initialized');
    }
  }

  /**
   * Initialize collection if it doesn't exist
   */
  async initializeCollection(): Promise<void> {
    try {
      await this.ensureClient();

      logger.info('Initializing Qdrant collection', { collection: this.collectionName });

      // Check if collection exists
      const collections = await this.client!.getCollections();
      const exists = collections.collections.some((c: any) => c.name === this.collectionName);

      if (!exists) {
        // Create collection
        await this.client!.createCollection(this.collectionName, {
          vectors: {
            size: this.vectorSize,
            distance: this.distance,
          },
        });
        logger.info('Qdrant collection created', { collection: this.collectionName });
      } else {
        logger.info('Qdrant collection already exists', { collection: this.collectionName });
      }
    } catch (error) {
      logger.error('Failed to initialize Qdrant collection', { error });
      throw new DatabaseError('Failed to initialize Qdrant collection', { error });
    }
  }

  /**
   * Upsert a single vector
   */
  async upsert(point: VectorPoint): Promise<void> {
    try {
      await this.ensureClient();

      await this.client!.upsert(this.collectionName, {
        wait: true,
        points: [
          {
            id: point.id,
            vector: point.vector,
            payload: point.payload,
          },
        ],
      });
      logger.debug('Vector upserted to Qdrant', { id: point.id });
    } catch (error) {
      logger.error('Failed to upsert vector to Qdrant', { id: point.id, error });
      throw new DatabaseError('Failed to upsert vector', { id: point.id, error });
    }
  }

  /**
   * Upsert multiple vectors in batch
   */
  async upsertBatch(points: VectorPoint[]): Promise<void> {
    try {
      await this.ensureClient();

      await this.client!.upsert(this.collectionName, {
        wait: true,
        points: points.map(p => ({
          id: p.id,
          vector: p.vector,
          payload: p.payload,
        })),
      });
      logger.debug('Batch vectors upserted to Qdrant', { count: points.length });
    } catch (error) {
      logger.error('Failed to upsert batch vectors to Qdrant', { count: points.length, error });
      throw new DatabaseError('Failed to upsert batch vectors', { count: points.length, error });
    }
  }

  /**
   * Search for similar vectors
   */
  async search(
    vector: number[],
    limit: number = 10,
    filter?: Record<string, unknown>,
    scoreThreshold?: number
  ): Promise<VectorSearchResult[]> {
    try {
      await this.ensureClient();

      logger.debug('Searching vectors in Qdrant', { limit, filter, scoreThreshold });

      const searchResult = await this.client!.search(this.collectionName, {
        vector,
        limit,
        filter,
        score_threshold: scoreThreshold,
        with_payload: true,
      });

      const results: VectorSearchResult[] = searchResult.map((result: any) => ({
        id: String(result.id),
        score: result.score,
        payload: result.payload || {},
      }));

      logger.debug('Vector search completed', { resultsCount: results.length });
      return results;
    } catch (error) {
      logger.error('Failed to search vectors in Qdrant', { error });
      throw new DatabaseError('Failed to search vectors', { error });
    }
  }

  /**
   * Delete vector by ID
   */
  async delete(id: string): Promise<void> {
    try {
      await this.ensureClient();
      await this.client!.delete(this.collectionName, {
        wait: true,
        points: [id],
      });
      logger.debug('Vector deleted from Qdrant', { id });
    } catch (error) {
      logger.error('Failed to delete vector from Qdrant', { id, error });
      throw new DatabaseError('Failed to delete vector', { id, error });
    }
  }

  /**
   * Delete multiple vectors by IDs
   */
  async deleteBatch(ids: string[]): Promise<void> {
    try {
      await this.ensureClient();
      await this.client!.delete(this.collectionName, {
        wait: true,
        points: ids,
      });
      logger.debug('Batch vectors deleted from Qdrant', { count: ids.length });
    } catch (error) {
      logger.error('Failed to delete batch vectors from Qdrant', { count: ids.length, error });
      throw new DatabaseError('Failed to delete batch vectors', { count: ids.length, error });
    }
  }

  /**
   * Delete vectors by filter
   */
  async deleteByFilter(filter: Record<string, unknown>): Promise<void> {
    try {
      await this.ensureClient();
      await this.client!.delete(this.collectionName, {
        wait: true,
        filter,
      });
      logger.debug('Vectors deleted by filter from Qdrant', { filter });
    } catch (error) {
      logger.error('Failed to delete vectors by filter from Qdrant', { filter, error });
      throw new DatabaseError('Failed to delete vectors by filter', { filter, error });
    }
  }

  /**
   * Get collection info
   */
  async getCollectionInfo(): Promise<unknown> {
    try {
      await this.ensureClient();
      const info = await this.client!.getCollection(this.collectionName);
      return info;
    } catch (error) {
      logger.error('Failed to get Qdrant collection info', { error });
      throw new DatabaseError('Failed to get collection info', { error });
    }
  }

  /**
   * Count vectors in collection
   */
  async count(filter?: Record<string, unknown>): Promise<number> {
    try {
      await this.ensureClient();
      const result = await this.client!.count(this.collectionName, {
        filter,
        exact: true,
      });
      return result.count;
    } catch (error) {
      logger.error('Failed to count vectors in Qdrant', { error });
      throw new DatabaseError('Failed to count vectors', { error });
    }
  }

  /**
   * Scroll through all vectors (for batch operations)
   */
  async scroll(
    limit: number = 100,
    offset?: string,
    filter?: Record<string, unknown>
  ): Promise<{ points: VectorSearchResult[]; nextOffset?: string }> {
    try {
      await this.ensureClient();
      const result = await this.client!.scroll(this.collectionName, {
        limit,
        offset,
        filter,
        with_payload: true,
        with_vector: false,
      });

      const points: VectorSearchResult[] = result.points.map((p: any) => ({
        id: String(p.id),
        score: 1, // No score in scroll results
        payload: p.payload || {},
      }));

      return {
        points,
        nextOffset: result.next_page_offset ? String(result.next_page_offset) : undefined,
      };
    } catch (error) {
      logger.error('Failed to scroll vectors in Qdrant', { error });
      throw new DatabaseError('Failed to scroll vectors', { error });
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.ensureClient();
      await this.client!.getCollections();
      return true;
    } catch (error) {
      logger.error('Qdrant health check failed', { error });
      return false;
    }
  }
}

/**
 * Singleton instance (optional pattern)
 */
let qdrantInstance: QdrantVectorStore | null = null;

export const getQdrantInstance = (config?: QdrantConfig): QdrantVectorStore => {
  if (!qdrantInstance) {
    if (!config) {
      throw new Error('Qdrant configuration required for first initialization');
    }
    qdrantInstance = new QdrantVectorStore(config);
  }
  return qdrantInstance;
};
