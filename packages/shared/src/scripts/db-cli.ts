#!/usr/bin/env node
/**
 * Database management CLI script
 * 
 * Usage:
 *   pnpm db:migrate    - Run migrations
 *   pnpm db:seed       - Seed database
 *   pnpm db:reset      - Drop all collections and re-migrate
 *   pnpm db:setup      - Run migrations and seed
 */

import { runMigrations, DatabaseMigrator } from '../database/migrations';
import { seedDatabase, DatabaseSeeder } from '../database/seeds';
import { MongoClient } from 'mongodb';
import { logger } from '../utils/logger';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://admin:password@localhost:27017';
const DB_NAME = process.env.MONGODB_DB_NAME || 'axon';

/**
 * Main CLI function
 */
async function main() {
  const command = process.argv[2];

  if (!command) {
    console.log(`
Database Management CLI

Usage:
  npm run db:migrate    - Run migrations (create collections and indexes)
  npm run db:seed       - Seed database with sample data
  npm run db:reset      - Drop all collections and re-migrate
  npm run db:setup      - Run migrations and seed (full setup)
  npm run db:status     - Check migration status

Environment Variables:
  MONGODB_URI=${MONGO_URI}
  MONGODB_DB_NAME=${DB_NAME}
    `);
    process.exit(0);
  }

  try {
    switch (command) {
      case 'migrate':
        await runMigrations(MONGO_URI, DB_NAME);
        break;

      case 'seed':
        await seedDatabase(MONGO_URI, DB_NAME);
        break;

      case 'reset':
        await resetDatabase();
        break;

      case 'setup':
        await setupDatabase();
        break;

      case 'status':
        await checkStatus();
        break;

      default:
        logger.error('Unknown command', { command });
        console.log('Valid commands: migrate, seed, reset, setup, status');
        process.exit(1);
    }

    logger.info('Command completed successfully', { command });
    process.exit(0);
  } catch (error) {
    logger.error('Command failed', { command, error });
    process.exit(1);
  }
}

/**
 * Reset database (drop all and re-migrate)
 */
async function resetDatabase(): Promise<void> {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    logger.info('Connected to MongoDB for reset');

    const db = client.db(DB_NAME);
    const migrator = new DatabaseMigrator(db);

    // Drop all collections
    logger.warn('Dropping all collections...');
    await migrator.dropAllCollections();

    // Re-run migrations
    logger.info('Re-running migrations...');
    await migrator.runMigrations();

    logger.info('Database reset completed');
  } finally {
    await client.close();
  }
}

/**
 * Full database setup (migrate + seed)
 */
async function setupDatabase(): Promise<void> {
  logger.info('Running full database setup...');

  // Run migrations
  await runMigrations(MONGO_URI, DB_NAME);

  // Seed database
  await seedDatabase(MONGO_URI, DB_NAME);

  logger.info('Full database setup completed');
}

/**
 * Check migration status
 */
async function checkStatus(): Promise<void> {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    logger.info('Connected to MongoDB for status check');

    const db = client.db(DB_NAME);
    const migrator = new DatabaseMigrator(db);

    const status = await migrator.getMigrationStatus();

    console.log('\nDatabase Status:');
    console.log('================');
    console.log(`Database: ${DB_NAME}`);
    console.log(`Collections exist: ${status.collectionsExist ? '✓' : '✗'}`);
    console.log(`\nExisting collections (${status.collections.length}):`);
    status.collections.forEach((name) => console.log(`  - ${name}`));

    if (status.missingCollections.length > 0) {
      console.log(`\nMissing collections (${status.missingCollections.length}):`);
      status.missingCollections.forEach((name) => console.log(`  - ${name}`));
      console.log('\nRun "npm run db:migrate" to create missing collections');
    } else {
      console.log('\n✓ All required collections exist');
    }

    // Check document counts
    console.log('\nDocument counts:');
    for (const collectionName of ['workspaces', 'contexts', 'interactions', 'prompt_patterns']) {
      const count = await db.collection(collectionName).countDocuments();
      console.log(`  - ${collectionName}: ${count}`);
    }

    console.log('');
  } finally {
    await client.close();
  }
}

// Run main function
main();
