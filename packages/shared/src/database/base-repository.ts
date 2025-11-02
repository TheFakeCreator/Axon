/**
 * Base repository class for MongoDB operations
 * Provides common CRUD operations with type safety
 */

import { Collection, Document, Filter, FindOptions, UpdateFilter, WithId } from 'mongodb';
import { logger } from '../utils/logger';
import { DatabaseError, NotFoundError } from '../utils/errors';

/**
 * Generic repository base class
 */
export abstract class BaseRepository<T extends Document> {
  protected collection: Collection<T>;
  protected collectionName: string;

  constructor(collection: Collection<T>, collectionName: string) {
    this.collection = collection;
    this.collectionName = collectionName;
  }

  /**
   * Find a single document by ID
   */
  async findById(id: string): Promise<WithId<T> | null> {
    try {
      logger.debug(`Finding document by ID in ${this.collectionName}`, { id });
      const result = await this.collection.findOne({ _id: id } as Filter<T>);
      return result;
    } catch (error) {
      logger.error(`Error finding document by ID in ${this.collectionName}`, { id, error });
      throw new DatabaseError(`Failed to find document in ${this.collectionName}`, { id, error });
    }
  }

  /**
   * Find documents matching a filter
   */
  async find(filter: Filter<T>, options?: FindOptions<T>): Promise<WithId<T>[]> {
    try {
      logger.debug(`Finding documents in ${this.collectionName}`, { filter, options });
      const results = await this.collection.find(filter, options).toArray();
      return results;
    } catch (error) {
      logger.error(`Error finding documents in ${this.collectionName}`, { filter, error });
      throw new DatabaseError(`Failed to find documents in ${this.collectionName}`, { filter, error });
    }
  }

  /**
   * Find a single document matching a filter
   */
  async findOne(filter: Filter<T>, options?: FindOptions<T>): Promise<WithId<T> | null> {
    try {
      logger.debug(`Finding one document in ${this.collectionName}`, { filter });
      const result = await this.collection.findOne(filter, options);
      return result as WithId<T> | null;
    } catch (error) {
      logger.error(`Error finding one document in ${this.collectionName}`, { filter, error });
      throw new DatabaseError(`Failed to find document in ${this.collectionName}`, { filter, error });
    }
  }

  /**
   * Create a new document
   */
  async create(document: T): Promise<WithId<T>> {
    try {
      logger.debug(`Creating document in ${this.collectionName}`, { document });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await this.collection.insertOne(document as any);
      const created = await this.findById(String(result.insertedId));
      if (!created) {
        throw new DatabaseError(`Document created but not found in ${this.collectionName}`);
      }
      return created;
    } catch (error) {
      logger.error(`Error creating document in ${this.collectionName}`, { error });
      throw new DatabaseError(`Failed to create document in ${this.collectionName}`, { error });
    }
  }

  /**
   * Create multiple documents
   */
  async createMany(documents: T[]): Promise<WithId<T>[]> {
    try {
      logger.debug(`Creating ${documents.length} documents in ${this.collectionName}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await this.collection.insertMany(documents as any[]);
      const ids = Object.values(result.insertedIds).map(String);
      const created = await this.find({ _id: { $in: ids } } as Filter<T>);
      return created;
    } catch (error) {
      logger.error(`Error creating documents in ${this.collectionName}`, { error });
      throw new DatabaseError(`Failed to create documents in ${this.collectionName}`, { error });
    }
  }

  /**
   * Update a document by ID
   */
  async updateById(id: string, update: UpdateFilter<T>): Promise<WithId<T>> {
    try {
      logger.debug(`Updating document in ${this.collectionName}`, { id, update });
      const result = await this.collection.findOneAndUpdate(
        { _id: id } as Filter<T>,
        update,
        { returnDocument: 'after' }
      );
      if (!result) {
        throw new NotFoundError(this.collectionName, id);
      }
      return result;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error(`Error updating document in ${this.collectionName}`, { id, error });
      throw new DatabaseError(`Failed to update document in ${this.collectionName}`, { id, error });
    }
  }

  /**
   * Update documents matching a filter
   */
  async updateMany(filter: Filter<T>, update: UpdateFilter<T>): Promise<number> {
    try {
      logger.debug(`Updating documents in ${this.collectionName}`, { filter, update });
      const result = await this.collection.updateMany(filter, update);
      return result.modifiedCount;
    } catch (error) {
      logger.error(`Error updating documents in ${this.collectionName}`, { filter, error });
      throw new DatabaseError(`Failed to update documents in ${this.collectionName}`, { filter, error });
    }
  }

  /**
   * Delete a document by ID
   */
  async deleteById(id: string): Promise<boolean> {
    try {
      logger.debug(`Deleting document in ${this.collectionName}`, { id });
      const result = await this.collection.deleteOne({ _id: id } as Filter<T>);
      return result.deletedCount > 0;
    } catch (error) {
      logger.error(`Error deleting document in ${this.collectionName}`, { id, error });
      throw new DatabaseError(`Failed to delete document in ${this.collectionName}`, { id, error });
    }
  }

  /**
   * Delete documents matching a filter
   */
  async deleteMany(filter: Filter<T>): Promise<number> {
    try {
      logger.debug(`Deleting documents in ${this.collectionName}`, { filter });
      const result = await this.collection.deleteMany(filter);
      return result.deletedCount;
    } catch (error) {
      logger.error(`Error deleting documents in ${this.collectionName}`, { filter, error });
      throw new DatabaseError(`Failed to delete documents in ${this.collectionName}`, { filter, error });
    }
  }

  /**
   * Count documents matching a filter
   */
  async count(filter: Filter<T> = {}): Promise<number> {
    try {
      logger.debug(`Counting documents in ${this.collectionName}`, { filter });
      const count = await this.collection.countDocuments(filter);
      return count;
    } catch (error) {
      logger.error(`Error counting documents in ${this.collectionName}`, { filter, error });
      throw new DatabaseError(`Failed to count documents in ${this.collectionName}`, { filter, error });
    }
  }

  /**
   * Check if a document exists
   */
  async exists(filter: Filter<T>): Promise<boolean> {
    try {
      const count = await this.collection.countDocuments(filter, { limit: 1 });
      return count > 0;
    } catch (error) {
      logger.error(`Error checking existence in ${this.collectionName}`, { filter, error });
      throw new DatabaseError(`Failed to check existence in ${this.collectionName}`, { filter, error });
    }
  }
}
