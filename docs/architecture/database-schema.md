# Database Schema Documentation

This document describes the database schemas used across Axon's three database systems: MongoDB (document store), Redis (cache), and Qdrant (vector store).

## Table of Contents

1. [MongoDB Collections](#mongodb-collections)
2. [Redis Cache Patterns](#redis-cache-patterns)
3. [Qdrant Vector Collections](#qdrant-vector-collections)
4. [Data Relationships](#data-relationships)

---

## MongoDB Collections

### Collection: `contexts`

**Purpose**: Store all context knowledge with metadata

**Schema**:

```typescript
{
  _id: ObjectId,
  id: string,                    // UUID for application-level ID
  workspaceId: string,           // Reference to workspace
  tier: 'workspace' | 'hybrid' | 'global',
  type: 'file' | 'symbol' | 'documentation' | 'conversation' | 'error' | 'architecture',
  content: string,               // Full context content
  summary?: string,              // Optional summary for compression
  metadata: {
    source: string,              // 'workspace-scan', 'user-input', 'llm-extract'
    language?: string,           // 'typescript', 'python', 'markdown', etc.
    filePath?: string,           // Relative path in workspace
    lineRange?: {
      start: number,
      end: number
    },
    confidence: number,          // 0-1, quality score
    tags?: string[]              // ['authentication', 'api', 'security']
  },
  usageCount: number,            // How many times retrieved
  lastAccessed: Date,            // Last retrieval timestamp
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**:

```javascript
db.contexts.createIndex({ workspaceId: 1 });
db.contexts.createIndex({ tier: 1, type: 1 });
db.contexts.createIndex({ createdAt: -1 });
db.contexts.createIndex({ usageCount: -1 });
db.contexts.createIndex({ 'metadata.confidence': -1 });
```

**Example Document**:

```json
{
  "_id": "507f1f77bcf86cd799439011",
  "id": "ctx_abc123",
  "workspaceId": "ws_myproject",
  "tier": "workspace",
  "type": "file",
  "content": "export class UserService {\n  async authenticate(credentials) {...}\n}",
  "summary": "User authentication service with login/logout methods",
  "metadata": {
    "source": "workspace-scan",
    "language": "typescript",
    "filePath": "src/services/UserService.ts",
    "lineRange": { "start": 1, "end": 50 },
    "confidence": 0.92,
    "tags": ["authentication", "service", "user"]
  },
  "usageCount": 15,
  "lastAccessed": "2025-11-03T10:30:00Z",
  "createdAt": "2025-11-01T08:00:00Z",
  "updatedAt": "2025-11-03T10:30:00Z"
}
```

---

### Collection: `workspaces`

**Purpose**: Store workspace metadata and configuration

**Schema**:

```typescript
{
  _id: ObjectId,
  id: string,                    // UUID
  path: string,                  // Absolute path, unique
  type: 'coding' | 'pkm' | 'root',
  name: string,                  // User-friendly name
  metadata: {
    techStack?: string[],        // ['React', 'Node.js', 'PostgreSQL']
    packageManager?: string,     // 'pnpm', 'npm', 'yarn'
    frameworks?: string[],       // ['Next.js', 'Express']
    buildTools?: string[],       // ['Turbo', 'Vite']
    vcs?: string,                // 'git', 'hg'
    totalFiles?: number,
    totalContexts?: number,
    lastIndexed?: Date
  },
  config?: {
    excludePatterns?: string[],  // Additional ignore patterns
    maxFileSize?: number,        // Max file size to index (bytes)
    autoReindex?: boolean        // Auto-reindex on file changes
  },
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**:

```javascript
db.workspaces.createIndex({ path: 1 }, { unique: true });
db.workspaces.createIndex({ type: 1 });
db.workspaces.createIndex({ name: 1 });
```

**Example Document**:

```json
{
  "_id": "507f1f77bcf86cd799439012",
  "id": "ws_myproject",
  "path": "/Users/john/projects/my-app",
  "type": "coding",
  "name": "My App",
  "metadata": {
    "techStack": ["TypeScript", "React", "Node.js", "MongoDB"],
    "packageManager": "pnpm",
    "frameworks": ["Next.js", "Express"],
    "buildTools": ["Turbo"],
    "vcs": "git",
    "totalFiles": 1500,
    "totalContexts": 2300,
    "lastIndexed": "2025-11-03T09:00:00Z"
  },
  "config": {
    "excludePatterns": ["*.test.ts", "*.spec.ts"],
    "maxFileSize": 1048576,
    "autoReindex": false
  },
  "createdAt": "2025-11-01T08:00:00Z",
  "updatedAt": "2025-11-03T09:00:00Z"
}
```

---

### Collection: `interactions`

**Purpose**: Store user interactions and feedback for learning

**Schema**:

```typescript
{
  _id: ObjectId,
  id: string,                    // UUID
  workspaceId: string,
  prompt: string,                // Original user prompt
  analysis: {                    // Prompt analysis result
    intent: string,
    taskTypes: string[],
    entities: object[]
  },
  contextUsed: string[],         // Context IDs used
  response: string,              // LLM response
  feedback?: {
    rating?: number,             // 1-5 scale
    helpful?: boolean,
    corrections?: string,        // User corrections
    acceptedActions?: string[]   // Which actions were accepted
  },
  metadata: {
    latency: number,             // Total processing time (ms)
    tokensUsed: {
      input: number,
      output: number,
      total: number
    },
    llmProvider: string,         // 'openai', 'anthropic'
    llmModel: string             // 'gpt-4', 'claude-2'
  },
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**:

```javascript
db.interactions.createIndex({ workspaceId: 1 });
db.interactions.createIndex({ createdAt: -1 });
db.interactions.createIndex({ 'feedback.rating': 1 });
```

**Example Document**:

```json
{
  "_id": "507f1f77bcf86cd799439013",
  "id": "int_xyz789",
  "workspaceId": "ws_myproject",
  "prompt": "Fix the authentication bug in UserService",
  "analysis": {
    "intent": "coding",
    "taskTypes": ["bug-fix"],
    "entities": [{ "type": "file", "value": "UserService", "confidence": 0.9 }]
  },
  "contextUsed": ["ctx_abc123", "ctx_def456"],
  "response": "The bug is in the authenticate method...",
  "feedback": {
    "rating": 5,
    "helpful": true,
    "corrections": null,
    "acceptedActions": ["code-change-1"]
  },
  "metadata": {
    "latency": 2150,
    "tokensUsed": {
      "input": 250,
      "output": 180,
      "total": 430
    },
    "llmProvider": "openai",
    "llmModel": "gpt-4"
  },
  "createdAt": "2025-11-03T10:30:00Z",
  "updatedAt": "2025-11-03T10:35:00Z"
}
```

---

### Collection: `prompt_patterns`

**Purpose**: Learn common prompt patterns for optimization

**Schema**:

```typescript
{
  _id: ObjectId,
  pattern: string,               // Normalized pattern
  frequency: number,             // How often seen
  taskTypes: string[],           // Associated task types
  avgContextCount: number,       // Average contexts retrieved
  successRate: number,           // 0-1, based on feedback
  examplePrompts: string[],      // Sample prompts (max 5)
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**:

```javascript
db.prompt_patterns.createIndex({ frequency: -1 });
db.prompt_patterns.createIndex({ successRate: -1 });
```

**Example Document**:

```json
{
  "_id": "507f1f77bcf86cd799439014",
  "pattern": "fix [entity] bug",
  "frequency": 42,
  "taskTypes": ["bug-fix"],
  "avgContextCount": 6.5,
  "successRate": 0.88,
  "examplePrompts": [
    "Fix the login bug",
    "Fix authentication bug in UserService",
    "Fix the API bug in payment processing"
  ],
  "createdAt": "2025-10-15T08:00:00Z",
  "updatedAt": "2025-11-03T10:30:00Z"
}
```

---

## Redis Cache Patterns

### Pattern 1: Embedding Cache

**Key**: `embedding:{md5(text)}`  
**Value**: JSON stringified embedding vector  
**TTL**: 86400 seconds (24 hours)

**Example**:

```
Key: embedding:5d41402abc4b2a76b9719d911017c592
Value: "[0.123, -0.456, 0.789, ..., 0.321]"  // 384-dim vector
TTL: 86400
```

**Usage**:

```typescript
const key = `embedding:${md5(text)}`;
const cached = await redis.get(key);
if (cached) {
  return JSON.parse(cached);
}
const embedding = await generateEmbedding(text);
await redis.set(key, JSON.stringify(embedding), 'EX', 86400);
return embedding;
```

---

### Pattern 2: Prompt Analysis Cache

**Key**: `analysis:{md5(prompt)}`  
**Value**: JSON stringified PromptAnalysis object  
**TTL**: 3600 seconds (1 hour)

**Example**:

```
Key: analysis:7d793037a0760186574b0282f2f435e7
Value: '{"intent":"coding","taskTypes":[{"type":"bug-fix","confidence":0.9}],...}'
TTL: 3600
```

---

### Pattern 3: Session Data

**Key**: `session:{userId}:{sessionId}`  
**Value**: JSON stringified session state  
**TTL**: 1800 seconds (30 minutes)

**Example**:

```
Key: session:user123:sess_abc
Value: '{"activeWorkspace":"ws_myproject","lastPrompt":"...", "context":[]}'
TTL: 1800
```

---

### Pattern 4: Query Result Cache

**Key**: `query:{workspaceId}:{md5(query)}`  
**Value**: JSON stringified RetrievedContext[]  
**TTL**: 300 seconds (5 minutes)

**Example**:

```
Key: query:ws_myproject:9e107d9d372bb6826bd81d3542a419d6
Value: '[{"id":"ctx_abc","content":"...","relevanceScore":0.92}]'
TTL: 300
```

---

### Pattern 5: Rate Limiting

**Key**: `ratelimit:{ip}:{endpoint}`  
**Value**: Request count (integer)  
**TTL**: 900 seconds (15 minutes)

**Example**:

```
Key: ratelimit:192.168.1.1:/api/v1/prompts/process
Value: 42
TTL: 900
```

**Usage**:

```typescript
const key = `ratelimit:${ip}:${endpoint}`;
const count = await redis.incr(key);
if (count === 1) {
  await redis.expire(key, 900);
}
if (count > 100) {
  throw new RateLimitError('Too many requests');
}
```

---

### Pattern 6: BullMQ Job Queue

**Queue**: `context-evolution`  
**Jobs**: Evolution tasks (decay, consolidation)

**Example Job**:

```json
{
  "id": "job_123",
  "data": {
    "operation": "temporal-decay",
    "workspaceId": "ws_myproject"
  },
  "opts": {
    "attempts": 3,
    "backoff": { "type": "exponential", "delay": 2000 }
  }
}
```

---

## Qdrant Vector Collections

### Collection: `contexts`

**Purpose**: Semantic search for context retrieval

**Vector Dimensions**: 384 (all-MiniLM-L6-v2 model)

**Distance Metric**: Cosine similarity

**Payload Schema**:

```typescript
{
  id: string,                    // Matches MongoDB context.id
  workspaceId: string,
  tier: 'workspace' | 'hybrid' | 'global',
  type: 'file' | 'symbol' | 'documentation' | 'conversation' | 'error' | 'architecture',
  source: string,                // 'workspace-scan', 'user-input', etc.
  confidence: number,            // 0-1
  tags: string[],
  createdAt: number              // Unix timestamp
}
```

**Index Configuration**:

```json
{
  "vectors": {
    "size": 384,
    "distance": "Cosine"
  },
  "hnsw_config": {
    "m": 16,
    "ef_construct": 100,
    "full_scan_threshold": 10000
  }
}
```

**Example Point**:

```json
{
  "id": "ctx_abc123",
  "vector": [0.123, -0.456, 0.789, ..., 0.321],  // 384 dimensions
  "payload": {
    "id": "ctx_abc123",
    "workspaceId": "ws_myproject",
    "tier": "workspace",
    "type": "file",
    "source": "workspace-scan",
    "confidence": 0.92,
    "tags": ["authentication", "service"],
    "createdAt": 1698825600
  }
}
```

**Search Example**:

```typescript
const results = await qdrant.search('contexts', {
  vector: queryEmbedding, // 384-dim vector
  filter: {
    must: [
      { key: 'workspaceId', match: { value: 'ws_myproject' } },
      { key: 'tier', match: { value: 'workspace' } },
    ],
    should: [
      { key: 'type', match: { value: 'file' } },
      { key: 'type', match: { value: 'symbol' } },
    ],
  },
  limit: 10,
  with_payload: true,
});
```

---

## Data Relationships

### Relationship Diagram

```
┌─────────────────┐
│   Workspaces    │
│   (MongoDB)     │
└────────┬────────┘
         │ 1:N
         │
         ▼
┌─────────────────┐         ┌─────────────────┐
│    Contexts     │────────▶│  Contexts       │
│   (MongoDB)     │  Sync   │  (Qdrant)       │
└────────┬────────┘         └─────────────────┘
         │ N:M
         │ (contextUsed array)
         ▼
┌─────────────────┐
│  Interactions   │
│   (MongoDB)     │
└─────────────────┘
```

### Consistency Rules

1. **MongoDB ↔ Qdrant Sync**:
   - When context created in MongoDB → Immediately upsert to Qdrant
   - When context updated in MongoDB → Re-index in Qdrant
   - When context deleted in MongoDB → Delete from Qdrant
   - Sync is atomic: Both succeed or both fail

2. **Workspace → Contexts**:
   - Contexts must reference a valid workspace
   - Deleting workspace → Cascade delete all contexts
   - Workspace stats (totalContexts) updated on context changes

3. **Interactions → Contexts**:
   - contextUsed array contains context IDs
   - Soft reference: Contexts can be deleted independently
   - Orphaned references handled gracefully (skip in retrieval)

---

## Migration Scripts

### Initial Setup

```javascript
// MongoDB setup
db.createCollection('contexts');
db.contexts.createIndex({ workspaceId: 1 });
db.contexts.createIndex({ tier: 1, type: 1 });
db.contexts.createIndex({ createdAt: -1 });

db.createCollection('workspaces');
db.workspaces.createIndex({ path: 1 }, { unique: true });

db.createCollection('interactions');
db.interactions.createIndex({ workspaceId: 1 });
db.interactions.createIndex({ createdAt: -1 });

// Qdrant setup
await qdrant.createCollection('contexts', {
  vectors: { size: 384, distance: 'Cosine' },
  hnsw_config: { m: 16, ef_construct: 100 },
});
```

### Data Seeding (Development)

```javascript
// Seed sample workspace
await db.workspaces.insertOne({
  id: 'ws_sample',
  path: '/sample/project',
  type: 'coding',
  name: 'Sample Project',
  metadata: {
    techStack: ['TypeScript', 'React'],
    totalFiles: 50,
  },
  createdAt: new Date(),
  updatedAt: new Date(),
});

// Seed sample contexts
await db.contexts.insertMany([
  {
    id: 'ctx_sample1',
    workspaceId: 'ws_sample',
    tier: 'workspace',
    type: 'file',
    content: 'Sample content...',
    metadata: { source: 'seed', confidence: 1.0 },
    usageCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]);
```

---

## Backup & Recovery

### MongoDB Backup

```bash
# Backup all collections
mongodump --uri="mongodb://localhost:27017/axon" --out=/backup/$(date +%Y%m%d)

# Restore from backup
mongorestore --uri="mongodb://localhost:27017/axon" /backup/20251103
```

### Redis Persistence

```bash
# Enable RDB snapshots (redis.conf)
save 900 1       # After 900s if at least 1 key changed
save 300 10      # After 300s if at least 10 keys changed
save 60 10000    # After 60s if at least 10000 keys changed
```

### Qdrant Backup

```bash
# Snapshot collection
curl -X POST 'http://localhost:6333/collections/contexts/snapshots'

# Download snapshot
curl 'http://localhost:6333/collections/contexts/snapshots/{snapshot_name}' \
  --output snapshot.tar
```

---

**Last Updated**: 2025-11-03  
**Version**: 1.0 (MVP)
