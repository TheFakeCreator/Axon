/**
 * Context Storage Service
 * 
 * Handles CRUD operations for contexts with MongoDB + vector database synchronization,
 * versioning, and relationship tracking.
 */

import { logger, MongoDBConnection } from '@axon/shared';
import type { IContext, ContextType, ContextTier } from '@axon/shared';
import type {
  ContextStorageRequest,
  ContextUpdateRequest,
} from '../types.js';
import type { EmbeddingService } from '../services/embedding.service.js';
import type { VectorStoreAdapter } from '../services/vector-store.adapter.js';
import { v4 as uuidv4 } from 'uuid';

export interface ContextVersion {
  version: number;
  content: string;
  metadata: Record<string, unknown>;
  updatedAt: Date;
  updatedBy?: string;
}

export class ContextStorage {
  private mongodb: MongoDBConnection;
  private embeddingService: EmbeddingService;
  private vectorStore: VectorStoreAdapter;
  private enableVersioning: boolean;

  constructor(
    mongodb: MongoDBConnection,
    embeddingService: EmbeddingService,
    vectorStore: VectorStoreAdapter,
    enableVersioning: boolean = true
  ) {
    this.mongodb = mongodb;
    this.embeddingService = embeddingService;
    this.vectorStore = vectorStore;
    this.enableVersioning = enableVersioning;
  }

  /**
   * Create a new context
   */
  async createContext(request: ContextStorageRequest): Promise<IContext> {
    const startTime = Date.now();
    const contextId = uuidv4();

    try {
      logger.info('Creating new context', { contextId, type: request.context.type });

      // Build context object
      const now = new Date();
      const context: IContext = {
        id: contextId,
        ...request.context,
        createdAt: now,
        updatedAt: now,
      };

      // Generate embeddings if requested
      let embedding: number[] | undefined;
      if (request.generateEmbeddings !== false) {
        embedding = await this.embeddingService.generateEmbedding(context.content);
        context.embedding = embedding;
      }

      // Store in MongoDB
      const db = this.mongodb.getDb();
      const contextsCollection = db.collection<IContext>('contexts');
      await contextsCollection.insertOne(context as any);

      // Index in vector database if requested
      if (request.indexInVectorDB !== false && embedding) {
        await this.vectorStore.indexContext(context, embedding);
      }

      // Create initial version if versioning enabled
      if (this.enableVersioning) {
        await this.createVersion(contextId, context.content, context.metadata);
      }

      const latencyMs = Date.now() - startTime;
      logger.info('Context created successfully', { contextId, latencyMs });

      return context;
    } catch (error) {
      logger.error('Failed to create context', { contextId, error });
      throw error;
    }
  }

  /**
   * Create multiple contexts in batch
   */
  async createContextsBatch(requests: ContextStorageRequest[]): Promise<IContext[]> {
    const startTime = Date.now();
    logger.info('Creating contexts in batch', { count: requests.length });

    try {
      const now = new Date();
      const contexts: IContext[] = requests.map((request) => ({
        id: uuidv4(),
        ...request.context,
        createdAt: now,
        updatedAt: now,
      }));

      // Generate embeddings in batch
      const textsToEmbed = contexts.map(c => c.content);
      const embeddingResult = await this.embeddingService.generateBatchEmbeddings({
        texts: textsToEmbed,
        cacheKeyPrefix: 'context',
      });

      // Attach embeddings to contexts
      contexts.forEach((context, index) => {
        context.embedding = embeddingResult.embeddings[index];
      });

      // Store in MongoDB
      const db = this.mongodb.getDb();
      const contextsCollection = db.collection<IContext>('contexts');
      await contextsCollection.insertMany(contexts as any[]);

      // Index in vector database
      await this.vectorStore.indexContextsBatch(contexts, embeddingResult.embeddings);

      // Create versions if enabled
      if (this.enableVersioning) {
        await Promise.all(
          contexts.map(c => this.createVersion(c.id, c.content, c.metadata))
        );
      }

      const latencyMs = Date.now() - startTime;
      logger.info('Batch contexts created successfully', { count: contexts.length, latencyMs });

      return contexts;
    } catch (error) {
      logger.error('Failed to create batch contexts', error);
      throw error;
    }
  }

  /**
   * Get context by ID
   */
  async getContext(contextId: string): Promise<IContext | null> {
    try {
      const db = this.mongodb.getDb();
      const contextsCollection = db.collection<IContext>('contexts');
      
      const context = await contextsCollection.findOne({ id: contextId });
      
      if (context) {
        // Update last accessed time
        await this.updateLastAccessed(contextId);
      }

      return context;
    } catch (error) {
      logger.error('Failed to get context', { contextId, error });
      throw error;
    }
  }

  /**
   * Get multiple contexts by IDs
   */
  async getContextsBatch(contextIds: string[]): Promise<IContext[]> {
    try {
      const db = this.mongodb.getDb();
      const contextsCollection = db.collection<IContext>('contexts');
      
      const contexts = await contextsCollection
        .find({ id: { $in: contextIds } })
        .toArray();

      // Update last accessed times
      await Promise.all(contextIds.map(id => this.updateLastAccessed(id)));

      return contexts;
    } catch (error) {
      logger.error('Failed to get batch contexts', { count: contextIds.length, error });
      throw error;
    }
  }

  /**
   * Update an existing context
   */
  async updateContext(request: ContextUpdateRequest): Promise<IContext | null> {
    const startTime = Date.now();

    try {
      logger.info('Updating context', { contextId: request.contextId });

      const db = this.mongodb.getDb();
      const contextsCollection = db.collection<IContext>('contexts');

      // Get current context
      const currentContext = await contextsCollection.findOne({ id: request.contextId });
      if (!currentContext) {
        logger.warn('Context not found for update', { contextId: request.contextId });
        return null;
      }

      // Build update object
      const now = new Date();
      const updates = {
        ...request.updates,
        updatedAt: now,
      };

      // Regenerate embeddings if content changed
      let newEmbedding: number[] | undefined;
      if (request.updates.content && request.regenerateEmbeddings !== false) {
        newEmbedding = await this.embeddingService.generateEmbedding(request.updates.content);
        updates.embedding = newEmbedding;
      }

      // Update in MongoDB
      const result = await contextsCollection.findOneAndUpdate(
        { id: request.contextId },
        { $set: updates },
        { returnDocument: 'after' }
      );

      if (!result) {
        return null;
      }

      // Update in vector database if embedding changed
      if (newEmbedding) {
        await this.vectorStore.deleteContext(request.contextId);
        await this.vectorStore.indexContext(result, newEmbedding);
      }

      // Create new version if versioning enabled
      if (this.enableVersioning && request.updates.content) {
        await this.createVersion(
          request.contextId,
          request.updates.content,
          result.metadata
        );
      }

      const latencyMs = Date.now() - startTime;
      logger.info('Context updated successfully', { contextId: request.contextId, latencyMs });

      return result;
    } catch (error) {
      logger.error('Failed to update context', { contextId: request.contextId, error });
      throw error;
    }
  }

  /**
   * Delete a context
   */
  async deleteContext(contextId: string): Promise<boolean> {
    try {
      logger.info('Deleting context', { contextId });

      const db = this.mongodb.getDb();
      const contextsCollection = db.collection<IContext>('contexts');

      // Delete from MongoDB
      const result = await contextsCollection.deleteOne({ id: contextId });

      if (result.deletedCount === 0) {
        logger.warn('Context not found for deletion', { contextId });
        return false;
      }

      // Delete from vector database
      await this.vectorStore.deleteContext(contextId);

      // Delete versions if versioning enabled
      if (this.enableVersioning) {
        const versionsCollection = db.collection('context_versions');
        await versionsCollection.deleteMany({ contextId });
      }

      logger.info('Context deleted successfully', { contextId });
      return true;
    } catch (error) {
      logger.error('Failed to delete context', { contextId, error });
      throw error;
    }
  }

  /**
   * Delete multiple contexts
   */
  async deleteContextsBatch(contextIds: string[]): Promise<number> {
    try {
      logger.info('Deleting contexts in batch', { count: contextIds.length });

      const db = this.mongodb.getDb();
      const contextsCollection = db.collection<IContext>('contexts');

      // Delete from MongoDB
      const result = await contextsCollection.deleteMany({ id: { $in: contextIds } });

      // Delete from vector database
      await this.vectorStore.deleteContextsBatch(contextIds);

      // Delete versions if versioning enabled
      if (this.enableVersioning) {
        const versionsCollection = db.collection('context_versions');
        await versionsCollection.deleteMany({ contextId: { $in: contextIds } });
      }

      logger.info('Batch contexts deleted successfully', { deleted: result.deletedCount });
      return result.deletedCount || 0;
    } catch (error) {
      logger.error('Failed to delete batch contexts', error);
      throw error;
    }
  }

  /**
   * Get contexts by workspace
   */
  async getContextsByWorkspace(
    workspaceId: string,
    options?: {
      tier?: ContextTier;
      type?: ContextType;
      limit?: number;
      skip?: number;
    }
  ): Promise<IContext[]> {
    try {
      const db = this.mongodb.getDb();
      const contextsCollection = db.collection<IContext>('contexts');

      const filter: any = { workspaceId };
      if (options?.tier) filter.tier = options.tier;
      if (options?.type) filter.type = options.type;

      const query = contextsCollection.find(filter);

      if (options?.skip) query.skip(options.skip);
      if (options?.limit) query.limit(options.limit);

      const contexts = await query.toArray();
      return contexts;
    } catch (error) {
      logger.error('Failed to get contexts by workspace', { workspaceId, error });
      throw error;
    }
  }

  /**
   * Count contexts by workspace
   */
  async countContextsByWorkspace(
    workspaceId: string,
    options?: {
      tier?: ContextTier;
      type?: ContextType;
    }
  ): Promise<number> {
    try {
      const db = this.mongodb.getDb();
      const contextsCollection = db.collection<IContext>('contexts');

      const filter: any = { workspaceId };
      if (options?.tier) filter.tier = options.tier;
      if (options?.type) filter.type = options.type;

      const count = await contextsCollection.countDocuments(filter);
      return count;
    } catch (error) {
      logger.error('Failed to count contexts by workspace', { workspaceId, error });
      throw error;
    }
  }

  /**
   * Get context versions
   */
  async getContextVersions(contextId: string, limit: number = 10): Promise<ContextVersion[]> {
    if (!this.enableVersioning) {
      return [];
    }

    try {
      const db = this.mongodb.getDb();
      const versionsCollection = db.collection<ContextVersion>('context_versions');

      const versions = await versionsCollection
        .find({ contextId })
        .sort({ version: -1 })
        .limit(limit)
        .toArray();

      return versions;
    } catch (error) {
      logger.error('Failed to get context versions', { contextId, error });
      throw error;
    }
  }

  /**
   * Restore context to a specific version
   */
  async restoreContextVersion(contextId: string, version: number): Promise<IContext | null> {
    if (!this.enableVersioning) {
      throw new Error('Versioning is not enabled');
    }

    try {
      logger.info('Restoring context version', { contextId, version });

      const db = this.mongodb.getDb();
      const versionsCollection = db.collection<ContextVersion>('context_versions');

      // Get the version
      const versionDoc = await versionsCollection.findOne({ contextId, version });
      if (!versionDoc) {
        logger.warn('Version not found', { contextId, version });
        return null;
      }

      // Update the context with version content
      const updatedContext = await this.updateContext({
        contextId,
        updates: {
          content: versionDoc.content,
          metadata: versionDoc.metadata as any,
        },
        regenerateEmbeddings: true,
      });

      logger.info('Context version restored successfully', { contextId, version });
      return updatedContext;
    } catch (error) {
      logger.error('Failed to restore context version', { contextId, version, error });
      throw error;
    }
  }

  /**
   * Create a new version entry
   */
  private async createVersion(
    contextId: string,
    content: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    try {
      const db = this.mongodb.getDb();
      const versionsCollection = db.collection('context_versions');

      // Get current version number
      const latestVersion = await versionsCollection
        .findOne({ contextId }, { sort: { version: -1 } });

      const versionNumber = latestVersion ? (latestVersion.version as number) + 1 : 1;

      // Create version document
      const versionDoc: ContextVersion & { contextId: string } = {
        contextId,
        version: versionNumber,
        content,
        metadata,
        updatedAt: new Date(),
      };

      await versionsCollection.insertOne(versionDoc as any);
    } catch (error) {
      logger.error('Failed to create version', { contextId, error });
      // Don't throw - versioning is non-critical
    }
  }

  /**
   * Update last accessed timestamp
   */
  private async updateLastAccessed(contextId: string): Promise<void> {
    try {
      const db = this.mongodb.getDb();
      const contextsCollection = db.collection('contexts');

      await contextsCollection.updateOne(
        { id: contextId },
        { $set: { 'metadata.lastAccessed': new Date() } }
      );
    } catch (error) {
      // Silently fail - this is a non-critical operation
      logger.debug('Failed to update last accessed time', { contextId });
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const db = this.mongodb.getDb();
      await db.command({ ping: 1 });
      return true;
    } catch (error) {
      logger.error('Context storage health check failed', error);
      return false;
    }
  }
}
