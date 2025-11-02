/**
 * Database seeding utilities for MongoDB
 * 
 * This module provides utilities to seed initial data for testing and development
 */

import { Db, MongoClient, ObjectId } from 'mongodb';
import { logger } from '../utils/logger';
import type {
  WorkspaceDocument,
  ContextDocument,
  InteractionDocument,
  PromptPatternDocument,
} from './schemas';

/**
 * Seed result
 */
export interface SeedResult {
  success: boolean;
  workspaces: number;
  contexts: number;
  interactions: number;
  promptPatterns: number;
  error?: Error;
}

/**
 * Database seeder class
 */
export class DatabaseSeeder {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  /**
   * Seed all collections with sample data
   */
  async seedAll(): Promise<SeedResult> {
    try {
      logger.info('Starting database seeding...');

      const workspaceCount = await this.seedWorkspaces();
      const contextCount = await this.seedContexts();
      const interactionCount = await this.seedInteractions();
      const promptPatternCount = await this.seedPromptPatterns();

      logger.info('Database seeding completed successfully', {
        workspaces: workspaceCount,
        contexts: contextCount,
        interactions: interactionCount,
        promptPatterns: promptPatternCount,
      });

      return {
        success: true,
        workspaces: workspaceCount,
        contexts: contextCount,
        interactions: interactionCount,
        promptPatterns: promptPatternCount,
      };
    } catch (error) {
      logger.error('Database seeding failed', { error });
      return {
        success: false,
        workspaces: 0,
        contexts: 0,
        interactions: 0,
        promptPatterns: 0,
        error: error as Error,
      };
    }
  }

  /**
   * Seed sample workspaces
   */
  private async seedWorkspaces(): Promise<number> {
    const collection = this.db.collection<WorkspaceDocument>('workspaces');

    // Check if workspaces already exist
    const count = await collection.countDocuments();
    if (count > 0) {
      logger.info('Workspaces already seeded, skipping', { count });
      return count;
    }

    const sampleWorkspaces: Omit<WorkspaceDocument, '_id'>[] = [
      {
        name: 'Axon Project',
        type: 'coding',
        path: '/projects/axon',
        rootPath: '/projects/axon',
        metadata: {
          techStack: ['typescript', 'node', 'mongodb', 'redis', 'qdrant'],
          framework: 'express',
          language: 'typescript',
        },
        config: {
          autoContextExtraction: true,
          contextRefreshInterval: 3600,
          maxContextSize: 1000,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'Personal Knowledge Base',
        type: 'pkm',
        path: '/notes',
        rootPath: '/notes',
        metadata: {
          noteCount: 150,
          totalSize: 5242880,
        },
        config: {
          autoContextExtraction: true,
          contextRefreshInterval: 7200,
          maxContextSize: 500,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'Example Web App',
        type: 'coding',
        path: '/projects/webapp',
        rootPath: '/projects/webapp',
        metadata: {
          techStack: ['react', 'typescript', 'tailwind', 'vite'],
          framework: 'react',
          language: 'typescript',
        },
        config: {
          autoContextExtraction: true,
          contextRefreshInterval: 3600,
          maxContextSize: 800,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const result = await collection.insertMany(sampleWorkspaces as WorkspaceDocument[]);
    logger.info('Workspaces seeded', { count: result.insertedCount });
    return result.insertedCount;
  }

  /**
   * Seed sample contexts
   */
  private async seedContexts(): Promise<number> {
    const collection = this.db.collection<ContextDocument>('contexts');

    // Check if contexts already exist
    const count = await collection.countDocuments();
    if (count > 0) {
      logger.info('Contexts already seeded, skipping', { count });
      return count;
    }

    // Get workspace IDs for reference
    const workspaces = await this.db
      .collection<WorkspaceDocument>('workspaces')
      .find()
      .toArray();

    if (workspaces.length === 0) {
      logger.warn('No workspaces found, cannot seed contexts');
      return 0;
    }

    const axonWorkspace = workspaces.find((w) => w.name === 'Axon Project');
    if (!axonWorkspace) {
      logger.warn('Axon workspace not found, cannot seed contexts');
      return 0;
    }

    const sampleContexts: Omit<ContextDocument, '_id'>[] = [
      {
        workspaceId: axonWorkspace._id,
        tier: 'workspace',
        content: 'This is an Express.js TypeScript project using MongoDB, Redis, and Qdrant for context management.',
        type: 'architecture',
        source: 'README.md',
        metadata: {
          filePath: 'README.md',
          language: 'markdown',
          tags: ['overview', 'architecture'],
        },
        relationships: {
          dependencies: [],
          relatedTo: [],
        },
        stats: {
          usageCount: 10,
          lastUsed: new Date(),
          confidence: 0.95,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        workspaceId: axonWorkspace._id,
        tier: 'workspace',
        content: 'MongoDB connection with pooling, Redis for caching and queues, Qdrant for vector search.',
        type: 'tech-stack',
        source: 'package.json',
        metadata: {
          filePath: 'package.json',
          language: 'json',
          tags: ['dependencies', 'tech-stack'],
        },
        relationships: {
          dependencies: [],
          relatedTo: [],
        },
        stats: {
          usageCount: 8,
          lastUsed: new Date(),
          confidence: 0.9,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        workspaceId: axonWorkspace._id,
        tier: 'workspace',
        content: 'Context retrieval uses semantic search with Qdrant, embeddings generated using Transformers.js locally.',
        type: 'implementation',
        source: 'src/context-engine/retrieval.ts',
        metadata: {
          filePath: 'src/context-engine/retrieval.ts',
          language: 'typescript',
          tags: ['context', 'search', 'embeddings'],
        },
        relationships: {
          dependencies: [],
          relatedTo: [],
        },
        stats: {
          usageCount: 15,
          lastUsed: new Date(),
          confidence: 0.92,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const result = await collection.insertMany(sampleContexts as ContextDocument[]);
    logger.info('Contexts seeded', { count: result.insertedCount });
    return result.insertedCount;
  }

  /**
   * Seed sample interactions
   */
  private async seedInteractions(): Promise<number> {
    const collection = this.db.collection<InteractionDocument>('interactions');

    // Check if interactions already exist
    const count = await collection.countDocuments();
    if (count > 0) {
      logger.info('Interactions already seeded, skipping', { count });
      return count;
    }

    // Get workspace IDs for reference
    const workspaces = await this.db
      .collection<WorkspaceDocument>('workspaces')
      .find()
      .toArray();

    if (workspaces.length === 0) {
      logger.warn('No workspaces found, cannot seed interactions');
      return 0;
    }

    const axonWorkspace = workspaces.find((w) => w.name === 'Axon Project');
    if (!axonWorkspace) {
      logger.warn('Axon workspace not found, cannot seed interactions');
      return 0;
    }

    const sampleInteractions: Omit<InteractionDocument, '_id'>[] = [
      {
        workspaceId: axonWorkspace._id,
        userId: 'user-1',
        prompt: {
          raw: 'How do I set up MongoDB connection pooling?',
          analyzed: {
            intent: 'coding',
            taskType: 'implementation',
            entities: ['MongoDB', 'connection pooling'],
            confidence: 0.9,
          },
        },
        response: {
          content: 'To set up MongoDB connection pooling, use the MongoClient options...',
          model: 'gpt-4',
          tokensUsed: 250,
        },
        feedback: {
          helpful: true,
          corrections: [],
        },
        status: 'completed',
        createdAt: new Date(Date.now() - 86400000), // 1 day ago
        completedAt: new Date(Date.now() - 86400000 + 5000), // 5 seconds later
      },
      {
        workspaceId: axonWorkspace._id,
        userId: 'user-1',
        prompt: {
          raw: 'Explain the vector search architecture',
          analyzed: {
            intent: 'coding',
            taskType: 'general-query',
            entities: ['vector search', 'architecture'],
            confidence: 0.85,
          },
        },
        response: {
          content: 'The vector search architecture uses Qdrant for similarity search...',
          model: 'gpt-4',
          tokensUsed: 180,
        },
        feedback: {
          helpful: true,
          corrections: [],
        },
        status: 'completed',
        createdAt: new Date(Date.now() - 3600000), // 1 hour ago
        completedAt: new Date(Date.now() - 3600000 + 3000), // 3 seconds later
      },
    ];

    const result = await collection.insertMany(sampleInteractions as InteractionDocument[]);
    logger.info('Interactions seeded', { count: result.insertedCount });
    return result.insertedCount;
  }

  /**
   * Seed sample prompt patterns
   */
  private async seedPromptPatterns(): Promise<number> {
    const collection = this.db.collection<PromptPatternDocument>('prompt_patterns');

    // Check if prompt patterns already exist
    const count = await collection.countDocuments();
    if (count > 0) {
      logger.info('Prompt patterns already seeded, skipping', { count });
      return count;
    }

    // Get workspace IDs for reference
    const workspaces = await this.db
      .collection<WorkspaceDocument>('workspaces')
      .find()
      .toArray();

    if (workspaces.length === 0) {
      logger.warn('No workspaces found, cannot seed prompt patterns');
      return 0;
    }

    const axonWorkspace = workspaces.find((w) => w.name === 'Axon Project');
    if (!axonWorkspace) {
      logger.warn('Axon workspace not found, cannot seed prompt patterns');
      return 0;
    }

    const samplePatterns: Omit<PromptPatternDocument, '_id'>[] = [
      {
        workspaceId: axonWorkspace._id,
        pattern: 'how to {action} {technology}',
        taskCategory: 'implementation',
        frequency: 25,
        successRate: 0.88,
        examples: [
          'how to setup MongoDB connection',
          'how to use Redis caching',
          'how to implement vector search',
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        workspaceId: axonWorkspace._id,
        pattern: 'explain {concept}',
        taskCategory: 'general-query',
        frequency: 18,
        successRate: 0.92,
        examples: [
          'explain the architecture',
          'explain context retrieval',
          'explain embedding generation',
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        workspaceId: axonWorkspace._id,
        pattern: 'fix {error} in {file}',
        taskCategory: 'bug-fix',
        frequency: 12,
        successRate: 0.85,
        examples: [
          'fix type error in schemas.ts',
          'fix connection issue in mongodb.ts',
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const result = await collection.insertMany(samplePatterns as PromptPatternDocument[]);
    logger.info('Prompt patterns seeded', { count: result.insertedCount });
    return result.insertedCount;
  }

  /**
   * Clear all data from collections
   */
  async clearAll(): Promise<void> {
    await this.db.collection('workspaces').deleteMany({});
    await this.db.collection('contexts').deleteMany({});
    await this.db.collection('interactions').deleteMany({});
    await this.db.collection('prompt_patterns').deleteMany({});
    logger.info('All collections cleared');
  }
}

/**
 * Standalone seeding function for CLI usage
 */
export async function seedDatabase(mongoUri: string, dbName: string): Promise<void> {
  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    logger.info('Connected to MongoDB for seeding', { dbName });

    const db = client.db(dbName);
    const seeder = new DatabaseSeeder(db);

    const result = await seeder.seedAll();

    if (result.success) {
      logger.info('Seeding completed successfully', {
        workspaces: result.workspaces,
        contexts: result.contexts,
        interactions: result.interactions,
        promptPatterns: result.promptPatterns,
      });
    } else {
      logger.error('Seeding failed', { error: result.error });
      throw result.error;
    }
  } catch (error) {
    logger.error('Seeding error', { error });
    throw error;
  } finally {
    await client.close();
    logger.info('MongoDB connection closed');
  }
}
