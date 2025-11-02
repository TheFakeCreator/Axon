/**
 * MongoDB connection utility
 */

import { MongoClient, Db, Collection, Document } from 'mongodb';
import { logger } from './logger';

/**
 * MongoDB connection manager
 */
export class MongoDBConnection {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private uri: string;
  private dbName: string;

  constructor(uri: string, dbName: string) {
    this.uri = uri;
    this.dbName = dbName;
  }

  /**
   * Connect to MongoDB
   */
  async connect(): Promise<void> {
    try {
      logger.info('Connecting to MongoDB...', { dbName: this.dbName });
      
      this.client = new MongoClient(this.uri);
      await this.client.connect();
      
      this.db = this.client.db(this.dbName);
      
      logger.info('MongoDB connected successfully', { dbName: this.dbName });
    } catch (error) {
      logger.error('MongoDB connection failed', { error });
      throw error;
    }
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.close();
        this.client = null;
        this.db = null;
        logger.info('MongoDB disconnected');
      }
    } catch (error) {
      logger.error('MongoDB disconnection failed', { error });
      throw error;
    }
  }

  /**
   * Get database instance
   */
  getDb(): Db {
    if (!this.db) {
      throw new Error('MongoDB not connected. Call connect() first.');
    }
    return this.db;
  }

  /**
   * Get collection
   */
  getCollection<T extends Document = Document>(name: string): Collection<T> {
    return this.getDb().collection<T>(name);
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.client !== null && this.db !== null;
  }

  /**
   * Ping database to verify connection
   */
  async ping(): Promise<boolean> {
    try {
      await this.getDb().admin().ping();
      return true;
    } catch (error) {
      logger.error('MongoDB ping failed', { error });
      return false;
    }
  }
}

/**
 * Singleton instance (optional pattern)
 */
let mongoInstance: MongoDBConnection | null = null;

export const getMongoDBInstance = (uri?: string, dbName?: string): MongoDBConnection => {
  if (!mongoInstance) {
    if (!uri || !dbName) {
      throw new Error('MongoDB URI and database name required for first initialization');
    }
    mongoInstance = new MongoDBConnection(uri, dbName);
  }
  return mongoInstance;
};
