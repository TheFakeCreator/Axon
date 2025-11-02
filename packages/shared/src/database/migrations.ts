/**
 * Database migration utilities for MongoDB
 * 
 * This module provides utilities to create collections, indexes, and seed initial data
 */

import { Db, MongoClient, CreateIndexesOptions } from 'mongodb';
import { logger } from '../utils/logger';
import {
  workspaceIndexes,
  contextIndexes,
  interactionIndexes,
  promptPatternIndexes,
} from './schemas';

/**
 * Migration status
 */
export interface MigrationResult {
  success: boolean;
  collections: string[];
  indexes: number;
  error?: Error;
}

/**
 * Database migrator class
 */
export class DatabaseMigrator {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  /**
   * Run all migrations (create collections and indexes)
   */
  async runMigrations(): Promise<MigrationResult> {
    try {
      logger.info('Starting database migrations...');

      const collections = await this.createCollections();
      const indexCount = await this.createIndexes();

      logger.info('Database migrations completed successfully', {
        collections: collections.length,
        indexes: indexCount,
      });

      return {
        success: true,
        collections,
        indexes: indexCount,
      };
    } catch (error) {
      logger.error('Database migrations failed', { error });
      return {
        success: false,
        collections: [],
        indexes: 0,
        error: error as Error,
      };
    }
  }

  /**
   * Create all required collections
   */
  private async createCollections(): Promise<string[]> {
    const requiredCollections = [
      'workspaces',
      'contexts',
      'interactions',
      'prompt_patterns',
    ];

    const existingCollections = await this.db.listCollections().toArray();
    const existingNames = existingCollections.map((c) => c.name);

    const collectionsToCreate = requiredCollections.filter(
      (name) => !existingNames.includes(name)
    );

    for (const collectionName of collectionsToCreate) {
      await this.db.createCollection(collectionName);
      logger.info('Collection created', { collection: collectionName });
    }

    return requiredCollections;
  }

  /**
   * Create all indexes for collections
   */
  private async createIndexes(): Promise<number> {
    let totalIndexes = 0;

    // Workspaces indexes
    const workspacesCollection = this.db.collection('workspaces');
    for (const index of workspaceIndexes) {
      const options = ('options' in index ? index.options : {}) as CreateIndexesOptions;
      await workspacesCollection.createIndex(index.key, options);
      logger.debug('Index created', {
        collection: 'workspaces',
        key: index.key,
      });
      totalIndexes++;
    }

    // Contexts indexes
    const contextsCollection = this.db.collection('contexts');
    for (const index of contextIndexes) {
      const options = ('options' in index ? index.options : {}) as CreateIndexesOptions;
      await contextsCollection.createIndex(index.key, options);
      logger.debug('Index created', {
        collection: 'contexts',
        key: index.key,
      });
      totalIndexes++;
    }

    // Interactions indexes
    const interactionsCollection = this.db.collection('interactions');
    for (const index of interactionIndexes) {
      const options = ('options' in index ? index.options : {}) as CreateIndexesOptions;
      await interactionsCollection.createIndex(index.key, options);
      logger.debug('Index created', {
        collection: 'interactions',
        key: index.key,
      });
      totalIndexes++;
    }

    // Prompt patterns indexes
    const promptPatternsCollection = this.db.collection('prompt_patterns');
    for (const index of promptPatternIndexes) {
      const options = ('options' in index ? index.options : {}) as CreateIndexesOptions;
      await promptPatternsCollection.createIndex(index.key, options);
      logger.debug('Index created', {
        collection: 'prompt_patterns',
        key: index.key,
      });
      totalIndexes++;
    }

    return totalIndexes;
  }

  /**
   * Drop all collections (use with caution!)
   */
  async dropAllCollections(): Promise<void> {
    const collections = await this.db.listCollections().toArray();

    for (const collection of collections) {
      if (collection.name.startsWith('system.')) {
        continue; // Skip system collections
      }
      await this.db.dropCollection(collection.name);
      logger.warn('Collection dropped', { collection: collection.name });
    }
  }

  /**
   * Check if migrations are needed
   */
  async needsMigration(): Promise<boolean> {
    const requiredCollections = [
      'workspaces',
      'contexts',
      'interactions',
      'prompt_patterns',
    ];

    const existingCollections = await this.db.listCollections().toArray();
    const existingNames = existingCollections.map((c) => c.name);

    return !requiredCollections.every((name) => existingNames.includes(name));
  }

  /**
   * Get migration status
   */
  async getMigrationStatus(): Promise<{
    collectionsExist: boolean;
    collections: string[];
    missingCollections: string[];
  }> {
    const requiredCollections = [
      'workspaces',
      'contexts',
      'interactions',
      'prompt_patterns',
    ];

    const existingCollections = await this.db.listCollections().toArray();
    const existingNames = existingCollections.map((c) => c.name);

    const missingCollections = requiredCollections.filter(
      (name) => !existingNames.includes(name)
    );

    return {
      collectionsExist: missingCollections.length === 0,
      collections: existingNames,
      missingCollections,
    };
  }
}

/**
 * Standalone migration function for CLI usage
 */
export async function runMigrations(mongoUri: string, dbName: string): Promise<void> {
  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    logger.info('Connected to MongoDB for migrations', { dbName });

    const db = client.db(dbName);
    const migrator = new DatabaseMigrator(db);

    const result = await migrator.runMigrations();

    if (result.success) {
      logger.info('Migrations completed successfully', {
        collections: result.collections.length,
        indexes: result.indexes,
      });
    } else {
      logger.error('Migrations failed', { error: result.error });
      throw result.error;
    }
  } catch (error) {
    logger.error('Migration error', { error });
    throw error;
  } finally {
    await client.close();
    logger.info('MongoDB connection closed');
  }
}
