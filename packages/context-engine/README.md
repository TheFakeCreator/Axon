# Context Engine

The Context Engine is the core of Axon's intelligent context management system. It provides sophisticated retrieval, storage, and evolution capabilities for managing contextual information across workspaces.

## Architecture

The Context Engine consists of four main components:

### 1. **ContextRetriever** - Intelligent Context Retrieval
Hierarchical search and multi-factor re-ranking for optimal context selection.

**Key Features:**
- **Hierarchical Search**: Searches across workspace → hybrid → global tiers
- **Query Expansion**: Enriches queries with high-confidence extracted entities
- **4-Factor Re-Ranking Algorithm**:
  - 60% Semantic Similarity (vector similarity)
  - 20% Freshness (exponential temporal decay)
  - 10% Usage Frequency (normalized usage count)
  - 10% Confidence Boost (quality signal)
- **Diversity Selection**: Avoids redundant results
- **Usage Tracking**: Automatically tracks context access patterns

**Performance**: <500ms retrieval latency

### 2. **ContextStorage** - Persistence Layer
Manages context lifecycle with MongoDB and vector database synchronization.

**Key Features:**
- **CRUD Operations**: create, read, update, delete
- **Batch Operations**: Efficient bulk processing
- **MongoDB + Qdrant Sync**: Maintains consistency between document and vector stores
- **Versioning System**: Track changes and enable rollback
- **Workspace Queries**: Filter by tier, type, with pagination
- **Auto Usage Tracking**: Updates lastAccessed timestamps

**Performance**: <100ms for single operations, <500ms for batch

### 3. **ContextEvolutionEngine** - Quality Management
Manages context quality through feedback and temporal decay.

**Key Features:**
- **Feedback Processing**: Integrates helpful/not helpful signals and ratings
- **Confidence Calculation**: Weighted average based on usage patterns
- **Temporal Decay**: Exponential decay for aging contexts
- **Evolution Statistics**: Monitor context health metrics
- **Auto-Evolution**: Scheduled quality maintenance (configurable)

### 4. **Supporting Services**
- **EmbeddingService**: Redis-cached vector embeddings with batch processing
- **VectorStoreAdapter**: Qdrant integration for semantic search

## Installation

```bash
pnpm add @axon/context-engine
```

## Usage

### Basic Retrieval

```typescript
import { 
  ContextRetriever, 
  EmbeddingService, 
  VectorStoreAdapter 
} from '@axon/context-engine';
import { MongoDBConnection, RedisConnection, QdrantVectorStore } from '@axon/shared';

// Initialize dependencies
const mongodb = new MongoDBConnection('mongodb://localhost:27017/axon');
const redis = new RedisConnection({ host: 'localhost', port: 6379 });
const qdrant = new QdrantVectorStore('http://localhost:6333');

// Create services
const embeddingService = new EmbeddingService(redis);
const vectorStore = new VectorStoreAdapter(qdrant);
await vectorStore.initialize();

// Create retriever
const retriever = new ContextRetriever(embeddingService, vectorStore, mongodb);

// Retrieve contexts
const result = await retriever.retrieve({
  query: 'How do I implement authentication?',
  workspaceId: 'my-workspace',
  taskType: 'feature-addition',
  entities: [
    { type: 'technology', value: 'JWT', confidence: 0.9 }
  ],
  limit: 10,
});

console.log(`Found ${result.totalFound} contexts in ${result.latencyMs}ms`);
result.contexts.forEach(ctx => {
  console.log(`- ${ctx.content} (score: ${ctx.score.toFixed(2)})`);
});
```

### Storing Contexts

```typescript
import { ContextStorage } from '@axon/context-engine';
import { ContextTier, ContextType } from '@axon/shared';

const storage = new ContextStorage(
  mongodb,
  embeddingService,
  vectorStore,
  true // Enable versioning
);

// Create a context
const context = await storage.createContext({
  context: {
    workspaceId: 'my-workspace',
    tier: ContextTier.WORKSPACE,
    type: ContextType.SYMBOL,
    content: 'function authenticateUser(token: string): Promise<User>',
    metadata: {
      filePath: 'src/auth/authenticate.ts',
      language: 'typescript',
      tags: ['auth', 'security'],
    },
  },
  generateEmbeddings: true,
  indexInVectorDB: true,
});

// Update a context
await storage.updateContext({
  contextId: context.id,
  updates: {
    content: 'Updated content',
  },
  regenerateEmbeddings: true,
});

// Get context versions
const versions = await storage.getContextVersions(context.id, 5);
console.log(`Context has ${versions.length} versions`);

// Restore previous version
await storage.restoreContextVersion(context.id, 2);
```

### Evolution and Quality Management

```typescript
import { ContextEvolutionEngine } from '@axon/context-engine';

const evolution = new ContextEvolutionEngine(
  mongodb,
  storage,
  vectorStore,
  {
    temporalDecayRate: 0.01, // 1% decay per day
    minConfidenceThreshold: 0.3, // Remove below this
    autoEvolutionEnabled: false, // Manual evolution for MVP
  }
);

// Process user feedback
await evolution.processFeedback({
  contextId: context.id,
  helpful: true,
  used: true,
  rating: 5,
  timestamp: new Date(),
});

// Run evolution cycle
const evolutionResult = await evolution.evolve({
  workspaceId: 'my-workspace',
  applyTemporalDecay: true,
  consolidateSimilar: false, // Post-MVP
  resolveConflicts: false, // Post-MVP
});

console.log(evolutionResult.summary);
// "Evolution cycle complete: 42 updated, 0 consolidated, 0 conflicts resolved"

// Get evolution statistics
const stats = await evolution.getEvolutionStats('my-workspace');
console.log(`Average confidence: ${stats.averageConfidence.toFixed(2)}`);
console.log(`Low confidence contexts: ${stats.lowConfidenceContexts}`);
```

### Batch Operations

```typescript
// Create multiple contexts efficiently
const contexts = await storage.createContextsBatch([
  {
    context: {
      workspaceId: 'my-workspace',
      tier: ContextTier.WORKSPACE,
      type: ContextType.FILE,
      content: 'File 1 content',
      metadata: { filePath: 'src/file1.ts' },
    },
  },
  {
    context: {
      workspaceId: 'my-workspace',
      tier: ContextTier.WORKSPACE,
      type: ContextType.FILE,
      content: 'File 2 content',
      metadata: { filePath: 'src/file2.ts' },
    },
  },
]);

// Retrieve multiple contexts by ID
const retrieved = await storage.getContextsBatch(contexts.map(c => c.id));
```

## Configuration

### Retrieval Configuration

```typescript
import { DEFAULT_RETRIEVAL_CONFIG } from '@axon/context-engine';

const customConfig = {
  ...DEFAULT_RETRIEVAL_CONFIG,
  defaultLimit: 20, // Retrieve up to 20 contexts
  defaultMinSimilarity: 0.8, // Higher similarity threshold
  enableQueryExpansion: true, // Add entities to query
  enableDiversitySelection: true, // Select diverse results
  maxContextAge: 90, // Consider contexts up to 90 days old
  reRankingWeights: {
    semanticSimilarity: 0.7, // Increase semantic weight
    freshness: 0.15,
    usage: 0.1,
    confidence: 0.05,
  },
};

const retriever = new ContextRetriever(
  embeddingService,
  vectorStore,
  mongodb,
  customConfig
);
```

### Evolution Configuration

```typescript
import { DEFAULT_EVOLUTION_CONFIG } from '@axon/context-engine';

const customEvolution = {
  ...DEFAULT_EVOLUTION_CONFIG,
  temporalDecayRate: 0.02, // 2% decay per day
  minConfidenceThreshold: 0.5, // Higher quality threshold
  consolidationSimilarityThreshold: 0.98, // Very similar = merge
  autoEvolutionEnabled: true, // Enable automatic evolution
};

const evolution = new ContextEvolutionEngine(
  mongodb,
  storage,
  vectorStore,
  customEvolution
);
```

## API Reference

### ContextRetriever

#### `retrieve(request: ContextRetrievalRequest): Promise<ContextRetrievalResult>`

Retrieve contexts with hierarchical search and re-ranking.

**Parameters:**
- `query`: Search query string
- `workspaceId`: Workspace identifier
- `taskType`: Task category for filtering
- `entities`: Extracted entities for query expansion
- `tier`: Specific tier to search (optional)
- `limit`: Maximum number of results (default: 10)
- `minSimilarity`: Minimum similarity threshold (default: 0.7)

**Returns:**
- `contexts`: Array of scored contexts
- `query`: Original query
- `totalFound`: Total matching contexts
- `latencyMs`: Retrieval latency
- `tiersSearched`: Tiers that were searched

### ContextStorage

#### `createContext(request: ContextStorageRequest): Promise<IContext>`
Create a new context with embeddings and vector indexing.

#### `getContext(contextId: string): Promise<IContext | null>`
Retrieve a context by ID.

#### `updateContext(request: ContextUpdateRequest): Promise<IContext | null>`
Update an existing context.

#### `deleteContext(contextId: string): Promise<boolean>`
Delete a context.

#### `getContextsByWorkspace(workspaceId, options?): Promise<IContext[]>`
Query contexts by workspace with filtering.

#### `getContextVersions(contextId, limit?): Promise<ContextVersion[]>`
Get version history for a context.

#### `restoreContextVersion(contextId, version): Promise<IContext | null>`
Restore a context to a previous version.

### ContextEvolutionEngine

#### `processFeedback(feedback: ContextFeedback): Promise<void>`
Process user feedback to update context confidence.

#### `applyTemporalDecay(request: ContextEvolutionRequest): Promise<ContextEvolutionResult>`
Apply exponential decay to aging contexts.

#### `evolve(request: ContextEvolutionRequest): Promise<ContextEvolutionResult>`
Run full evolution cycle (decay + consolidation + conflict resolution).

#### `getEvolutionStats(workspaceId): Promise<EvolutionStats>`
Get evolution statistics for a workspace.

## Performance

- **Retrieval**: <500ms for 10 contexts
- **Single CRUD**: <100ms
- **Batch Operations**: <500ms for 50 contexts
- **Embedding Generation**: <50ms (cached), <200ms (uncached)
- **Evolution Cycle**: <1000ms for 1000 contexts

## Testing

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

## Architecture Principles

1. **Separation of Concerns**: Each service has a single responsibility
2. **Type Safety**: Strict TypeScript for reliability
3. **Performance First**: Caching, batching, and optimization
4. **Scalability**: Stateless design for horizontal scaling
5. **Observability**: Comprehensive logging and metrics

## Future Enhancements (Post-MVP)

- **Graph-based retrieval**: Leverage context relationships
- **Advanced consolidation**: Merge similar contexts automatically
- **Conflict resolution**: Handle contradictory information
- **Reinforcement learning**: Learn from user feedback
- **Multi-modal contexts**: Support images, audio, etc.

## License

MIT

## Contributing

See the main Axon repository for contribution guidelines.
