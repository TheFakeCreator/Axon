/**
 * Integration Test Setup
 * Sets up test databases and cleans up after tests
 */

import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Db } from 'mongodb';
import Redis from 'ioredis';

export interface TestContext {
  mongoServer: MongoMemoryServer;
  mongoClient: MongoClient;
  db: Db;
  redis: Redis;
}

let testContext: TestContext | null = null;

/**
 * Set up test databases before all tests
 */
export async function setupTestDatabases(): Promise<TestContext> {
  if (testContext) {
    return testContext;
  }

  // Start in-memory MongoDB
  const mongoServer = await MongoMemoryServer.create({
    instance: {
      dbName: 'axon-test',
    },
  });

  const mongoUri = mongoServer.getUri();
  const mongoClient = new MongoClient(mongoUri);
  await mongoClient.connect();
  const db = mongoClient.db('axon-test');

  // Create indexes
  await db.collection('contexts').createIndex({ workspaceId: 1 });
  await db.collection('contexts').createIndex({ type: 1 });
  await db.collection('contexts').createIndex({ createdAt: -1 });
  await db.collection('workspaces').createIndex({ path: 1 }, { unique: true });

  // Connect to Redis (use test database 15)
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    db: 15, // Use separate DB for tests
  });

  // Clear Redis test database
  await redis.flushdb();

  testContext = {
    mongoServer,
    mongoClient,
    db,
    redis,
  };

  return testContext;
}

/**
 * Clean up test databases after all tests
 */
export async function teardownTestDatabases(): Promise<void> {
  if (!testContext) {
    return;
  }

  const { mongoServer, mongoClient, redis } = testContext;

  // Clear and close Redis
  await redis.flushdb();
  await redis.quit();

  // Close MongoDB
  await mongoClient.close();
  await mongoServer.stop();

  testContext = null;
}

/**
 * Clear all test data (run before each test)
 */
export async function clearTestData(): Promise<void> {
  if (!testContext) {
    throw new Error('Test context not initialized');
  }

  const { db, redis } = testContext;

  // Clear MongoDB collections
  const collections = await db.listCollections().toArray();
  for (const collection of collections) {
    await db.collection(collection.name).deleteMany({});
  }

  // Clear Redis
  await redis.flushdb();
}

/**
 * Get current test context
 */
export function getTestContext(): TestContext {
  if (!testContext) {
    throw new Error('Test context not initialized. Call setupTestDatabases() first.');
  }
  return testContext;
}

/**
 * Insert test data into MongoDB
 */
export async function insertTestData(collection: string, data: any[]): Promise<void> {
  const { db } = getTestContext();
  if (data.length > 0) {
    await db.collection(collection).insertMany(data);
  }
}

/**
 * Get test data from MongoDB
 */
export async function getTestData(collection: string, filter: any = {}): Promise<any[]> {
  const { db } = getTestContext();
  return db.collection(collection).find(filter).toArray();
}

/**
 * Set test data in Redis
 */
export async function setRedisTestData(key: string, value: string, ttl?: number): Promise<void> {
  const { redis } = getTestContext();
  if (ttl) {
    await redis.setex(key, ttl, value);
  } else {
    await redis.set(key, value);
  }
}

/**
 * Get test data from Redis
 */
export async function getRedisTestData(key: string): Promise<string | null> {
  const { redis } = getTestContext();
  return redis.get(key);
}
