// MongoDB Initialization Script for Axon
// This script runs automatically when the MongoDB container starts

print('==============================================');
print('Axon MongoDB Initialization');
print('==============================================');

// Switch to axon database
db = db.getSiblingDB('axon');

print('Creating collections...');

// Create collections
db.createCollection('contexts');
db.createCollection('workspaces');
db.createCollection('interactions');
db.createCollection('prompt_patterns');

print('Creating indexes...');

// Contexts collection indexes
db.contexts.createIndex({ workspaceId: 1, tier: 1 });
db.contexts.createIndex({ createdAt: -1 });
db.contexts.createIndex({ usageCount: -1 });
db.contexts.createIndex({ 'metadata.confidence': -1 });
db.contexts.createIndex({ type: 1 });

// Workspaces collection indexes
db.workspaces.createIndex({ path: 1 }, { unique: true });
db.workspaces.createIndex({ type: 1 });

// Interactions collection indexes
db.interactions.createIndex({ workspaceId: 1 });
db.interactions.createIndex({ timestamp: -1 });
db.interactions.createIndex({ 'metadata.taskType': 1 });

// Prompt patterns collection indexes
db.prompt_patterns.createIndex({ pattern: 1 });
db.prompt_patterns.createIndex({ frequency: -1 });

print('Indexes created successfully!');

// Insert sample workspace for testing (optional)
if (db.workspaces.countDocuments() === 0) {
  print('Inserting sample workspace...');
  db.workspaces.insertOne({
    _id: 'ws_sample_123',
    name: 'Sample Workspace',
    type: 'coding',
    path: '/sample/workspace',
    metadata: {
      techStack: ['TypeScript', 'Node.js'],
      packageManager: 'pnpm',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  print('Sample workspace created!');
}

print('==============================================');
print('MongoDB initialization completed successfully!');
print('==============================================');
