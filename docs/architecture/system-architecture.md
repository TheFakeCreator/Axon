# System Architecture

## Overview

Axon is a **5-layer middleware architecture** designed to enrich AI prompts with relevant context from a multi-tier knowledge base. The system follows a **microservices approach** with 7 independently scalable services organized within a monorepo.

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Layer 1: User Interface                          │
│         (VS Code Extension, CLI, Web Dashboard, API Clients)        │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTP/REST, Server-Sent Events (SSE)
┌────────────────────────────▼────────────────────────────────────────┐
│                    Layer 2: Middleware Layer                        │
│                     (Orchestration & Pipeline)                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐         │
│  │   Prompt     │───▶│   Prompt     │───▶│   Context    │         │
│  │  Collector   │    │  Analyzer    │    │  Retriever   │         │
│  └──────────────┘    └──────────────┘    └──────┬───────┘         │
│                                                   │                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────▼───────┐         │
│  │   Response   │◀───│   Prompt     │◀───│   Context    │         │
│  │Post-Processor│    │  Injector    │    │ Synthesizer  │         │
│  └──────────────┘    └──────────────┘    └──────────────┘         │
└────────────────────────────┬────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│              Layer 3: Context Management Layer (CREE)               │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │              Context Retrieval Engine                        │ │
│  │  • Hierarchical Search (Workspace → Hybrid → Global)        │ │
│  │  • Semantic Search (Vector Embeddings)                      │ │
│  │  • 4-Factor Re-Ranking (Similarity, Freshness, Usage, Conf.)│ │
│  │  • Diversity-Aware Selection                                │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │              Context Storage Service                         │ │
│  │  • CRUD Operations (Create, Read, Update, Delete)           │ │
│  │  • Versioning System (Context History)                      │ │
│  │  • Batch Operations (Bulk Insert/Update/Delete)             │ │
│  │  • Vector Synchronization (MongoDB ↔ Qdrant)                │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │              Context Evolution Engine                        │ │
│  │  • Feedback Integration (Ratings, Corrections)              │ │
│  │  • Temporal Decay (Exponential Age-Based)                   │ │
│  │  • Consolidation (Merge Similar Contexts - Post-MVP)        │ │
│  │  • Conflict Resolution (Resolve Contradictions - Post-MVP)  │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  3-Tier Context Base:                                              │
│  • Workspace Context (Project-specific, highest priority)          │
│  • Hybrid Context (Runtime integration, medium priority)           │
│  • Global Context (Cross-workspace, fallback)                      │
└────────────────────────────┬────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                   Layer 4: LLM Interface Layer                      │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                   LLM Gateway Service                        │ │
│  │  • Multi-Provider Support (OpenAI, Anthropic, Ollama)       │ │
│  │  • Streaming Support (AsyncGenerator)                       │ │
│  │  • Retry Logic (Exponential Backoff)                        │ │
│  │  • Circuit Breaker (Prevent Cascading Failures)             │ │
│  │  • Token Usage Tracking                                      │ │
│  │  • Rate Limiting                                             │ │
│  └──────────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                   Layer 5: Data Persistence Layer                   │
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐         │
│  │   MongoDB    │    │    Redis     │    │   Qdrant     │         │
│  │  (Document)  │    │   (Cache)    │    │  (Vector)    │         │
│  │              │    │              │    │              │         │
│  │ • Contexts   │    │ • Embeddings │    │ • Semantic   │         │
│  │ • Workspaces │    │ • Analyses   │    │   Search     │         │
│  │ • Interactions    │ • Sessions   │    │ • Similarity │         │
│  │ • Patterns   │    │ • Queue Jobs │    │   Matching   │         │
│  └──────────────┘    └──────────────┘    └──────────────┘         │
└─────────────────────────────────────────────────────────────────────┘
```

## Microservices Architecture

### Core Services

| Service               | Package                      | Responsibility            | Key Features                                 |
| --------------------- | ---------------------------- | ------------------------- | -------------------------------------------- |
| **API Gateway**       | `apps/api`                   | Entry point, routing      | REST endpoints, SSE streaming, rate limiting |
| **Middleware**        | `packages/middleware`        | Pipeline orchestration    | Request flow, error handling, metrics        |
| **Context Engine**    | `packages/context-engine`    | Context management (CREE) | Retrieval, storage, evolution                |
| **Prompt Analyzer**   | `packages/prompt-analyzer`   | Prompt understanding      | Intent, task type, entities, ambiguity       |
| **LLM Gateway**       | `packages/llm-gateway`       | LLM abstraction           | Multi-provider, streaming, retry logic       |
| **Workspace Manager** | `packages/workspace-manager` | Workspace handling        | File scanning, tech detection, extraction    |
| **Quality Gate**      | `packages/quality-gate`      | QA orchestration          | Testing, linting, type checking              |
| **Shared**            | `packages/shared`            | Common utilities          | Types, DB clients, logger, config            |

### Service Communication

**Intra-Monorepo (Development)**:

- Direct imports via TypeScript project references
- Shared types ensure compile-time safety
- Turbo caching for fast builds

**Inter-Service (Production - Future)**:

- RESTful APIs for synchronous communication
- Message queues (BullMQ/RabbitMQ) for async tasks
- gRPC for high-performance service-to-service calls

## Layer Details

### Layer 1: User Interface

**Purpose**: Provide multiple entry points for users to interact with Axon

**Components**:

- **VS Code Extension** (Post-MVP): Native integration with editor
- **CLI Tool** (Post-MVP): Command-line interface for scripting
- **Web Dashboard** (Post-MVP): Browser-based UI for management
- **API Clients**: HTTP clients, SDKs for integration

**Protocols**: HTTP/REST, Server-Sent Events (SSE) for streaming

---

### Layer 2: Middleware Layer

**Purpose**: Orchestrate the complete prompt processing pipeline

#### 2.1 Prompt Collector

- **Input**: Raw user prompt with metadata
- **Responsibilities**:
  - Request validation (Zod schemas)
  - XSS sanitization
  - Metadata extraction (source, language, file, cursor position)
  - Request ID generation
  - Structured logging
- **Output**: `CollectedPrompt` with enriched metadata

#### 2.2 Prompt Analyzer

- **Input**: `CollectedPrompt`
- **Responsibilities**:
  - Intent classification (coding, PKM, general)
  - Task type identification (bug fix, feature add, etc.)
  - Entity extraction (files, functions, technologies)
  - Ambiguity detection
- **Output**: `PromptAnalysis` with intent, tasks, entities, ambiguity score

#### 2.3 Context Retriever (via Context Engine)

- **Input**: `PromptAnalysis`
- **Responsibilities**:
  - Hierarchical context search (workspace → hybrid → global)
  - Semantic search using vector embeddings
  - 4-factor re-ranking
  - Diversity-aware selection
- **Output**: `RetrievedContext[]` with relevance scores

#### 2.4 Context Synthesizer

- **Input**: `RetrievedContext[]`, `PromptAnalysis`
- **Responsibilities**:
  - Token budget management (task-specific allocation)
  - Context prioritization
  - Compression (summaries, truncation)
  - LLM-optimized formatting (Markdown, code blocks)
- **Output**: `SynthesizedContext` (formatted string)

#### 2.5 Prompt Injector

- **Input**: `SynthesizedContext`, `CollectedPrompt`, `PromptAnalysis`
- **Responsibilities**:
  - Injection strategy selection (prefix, inline, suffix, hybrid)
  - System prompt construction
  - User prompt enrichment
  - Token limit validation
- **Output**: `EnrichedPrompt` with system + user messages

#### 2.6 Response Post-Processor

- **Input**: LLM response
- **Responsibilities**:
  - Quality assessment (error indicators, structure, completeness)
  - Action extraction (code changes, file operations)
  - Knowledge capture (patterns, solutions, decisions)
  - Async context storage
- **Output**: `ProcessedResponse` with actions and knowledge

---

### Layer 3: Context Management Layer (CREE)

**Purpose**: Manage the complete lifecycle of context knowledge

#### 3.1 Context Retrieval Engine

**Hierarchical Search**:

1. **Workspace Tier**: Search project-specific context first
2. **Hybrid Tier**: Runtime integration of workspace + global
3. **Global Tier**: Fallback to cross-workspace knowledge

**Semantic Search**:

- Generate embeddings for user query
- Vector similarity search in Qdrant
- Filter by workspace, tier, task type, tags

**4-Factor Re-Ranking Algorithm**:

```typescript
finalScore =
  0.6 * semanticSimilarity + // Cosine similarity from vector search
  0.2 * freshnessScore + // exp(-age / maxAge)
  0.1 * usageBoost + // normalized usage count
  0.1 * confidenceBoost; // quality score from feedback
```

**Diversity Selection**:

- Avoid redundant context
- Balance: 70% score-based + 30% diversity-based

#### 3.2 Context Storage Service

**CRUD Operations**:

- `create()`: Insert context + sync to vector DB
- `get()`: Retrieve by ID with MongoDB hydration
- `update()`: Update + re-index in vector DB
- `delete()`: Remove from MongoDB + vector DB

**Versioning**:

- Store context history for rollback
- Track changes over time
- Restore previous versions

**Batch Operations**:

- `createBatch()`: Bulk insert for workspace initialization
- `getBatch()`: Retrieve multiple contexts efficiently
- `deleteBatch()`: Cleanup old/low-confidence contexts

#### 3.3 Context Evolution Engine

**Feedback Integration**:

```typescript
newConfidence =
  0.7 * currentConfidence + 0.3 * (rating / 5.0); // User rating 0-5
```

**Temporal Decay**:

```typescript
decayedConfidence = currentConfidence * exp(-age / maxAge);
// maxAge = 90 days default, 1% decay per day
```

**Auto-Deletion**:

- Delete contexts with confidence < 0.3 (threshold)
- Batch process for efficiency

**Consolidation** (Post-MVP):

- Merge similar contexts
- Deduplicate knowledge
- Summarize related contexts

**Conflict Resolution** (Post-MVP):

- Detect contradictory contexts
- Resolve with timestamps, feedback, usage

---

### Layer 4: LLM Interface Layer

**Purpose**: Abstract LLM provider details and handle LLM interactions

**LLM Gateway Service**:

**Multi-Provider Support**:

- OpenAI (GPT-3.5, GPT-4)
- Anthropic (Claude)
- Ollama (Local models)

**Streaming Support**:

```typescript
async *processStreaming(messages): AsyncGenerator<string> {
  // Yield chunks as they arrive
  for await (const chunk of stream) {
    yield chunk.choices[0]?.delta?.content || '';
  }
}
```

**Retry Logic**:

- Exponential backoff: 1s, 2s, 4s, 8s
- Max retries: 3 (configurable)
- Retry on: 429 (rate limit), 500, 502, 503, 504

**Circuit Breaker**:

- Track failure rate
- Open circuit after threshold (e.g., 50% failures in 1 min)
- Half-open state for testing recovery
- Close circuit when stable

**Token Tracking**:

- Input tokens, output tokens, total tokens
- Cost calculation (provider-specific)
- Usage metrics for monitoring

---

### Layer 5: Data Persistence Layer

#### 5.1 MongoDB (Document Store)

**Collections**:

**`contexts`**:

```typescript
{
  _id: ObjectId,
  id: string (UUID),
  workspaceId: string,
  tier: 'workspace' | 'hybrid' | 'global',
  type: 'file' | 'symbol' | 'documentation' | 'conversation' | 'error' | 'architecture',
  content: string,
  summary?: string,
  metadata: {
    source: string,
    language?: string,
    filePath?: string,
    lineRange?: { start: number, end: number },
    confidence: number,
    tags?: string[]
  },
  usageCount: number,
  lastAccessed: Date,
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**: workspaceId, tier, type, createdAt, usageCount

**`workspaces`**:

```typescript
{
  _id: ObjectId,
  id: string (UUID),
  path: string (unique),
  type: 'coding' | 'pkm' | 'root',
  name: string,
  metadata: {
    techStack?: string[],
    packageManager?: string,
    frameworks?: string[]
  },
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**: path (unique), type

**`interactions`**:

```typescript
{
  _id: ObjectId,
  id: string (UUID),
  workspaceId: string,
  prompt: string,
  response: string,
  feedback?: {
    rating: number (1-5),
    helpful: boolean,
    corrections?: string
  },
  contextUsed: string[], // Context IDs
  createdAt: Date
}
```

**Indexes**: workspaceId, createdAt

**`prompt_patterns`**:

```typescript
{
  _id: ObjectId,
  pattern: string,
  frequency: number,
  taskTypes: string[],
  successRate: number,
  createdAt: Date,
  updatedAt: Date
}
```

#### 5.2 Redis (Cache & Queue)

**Cache Patterns**:

- **Embeddings**: `embedding:{md5(text)}` → `[vector]` (TTL: 24h)
- **Analyses**: `analysis:{md5(prompt)}` → `PromptAnalysis` (TTL: 1h)
- **Sessions**: `session:{userId}` → `SessionData` (TTL: 30min)
- **Query Results**: `query:{hash}` → `RetrievedContext[]` (TTL: 5min)

**Queue Jobs** (BullMQ):

- Context evolution jobs
- Workspace indexing jobs
- Batch operations
- Quality gate execution

#### 5.3 Qdrant (Vector Store)

**Collections**:

**`contexts`**:

- **Vectors**: 384-dimensional (all-MiniLM-L6-v2 model)
- **Payload**:
  ```typescript
  {
    id: string,
    workspaceId: string,
    tier: string,
    type: string,
    source: string,
    confidence: number,
    tags: string[],
    createdAt: timestamp
  }
  ```
- **Indexes**: HNSW for fast similarity search

## Data Flow

### Request Flow (Simplified)

```
User Prompt
    ↓
API Gateway (Validation)
    ↓
Prompt Collector (Enrichment)
    ↓
Prompt Analyzer (Understanding)
    ↓
Context Retriever (Semantic Search)
    ↓
Context Synthesizer (Formatting)
    ↓
Prompt Injector (Enrichment)
    ↓
LLM Gateway (Completion)
    ↓
Response Post-Processor (Extraction)
    ↓
User Response + Background Context Update
```

**Latency Breakdown** (Typical):

- API Gateway: ~5ms
- Prompt Collector: ~10ms
- Prompt Analyzer: ~150ms
- Context Retriever: ~300ms (includes vector search)
- Context Synthesizer: ~80ms
- Prompt Injector: ~30ms
- LLM Gateway: ~1500ms (GPT-4, varies by response length)
- Response Post-Processor: ~50ms
- **Total: ~2125ms (~2.1 seconds)**

## Scalability Considerations

### Horizontal Scaling

**Stateless Services** (can scale independently):

- API Gateway (multiple instances behind load balancer)
- Middleware services (per-request instantiation)
- Prompt Analyzer (independent processing)
- LLM Gateway (connection pooling)

**Stateful Services** (require coordination):

- Context Engine (shared database state)
- Workspace Manager (file system access)

### Performance Optimizations

1. **Caching**: Redis for embeddings, analyses, query results
2. **Connection Pooling**: Reuse MongoDB, Redis, Qdrant connections
3. **Lazy Loading**: Load context on-demand, not preemptively
4. **Parallel Retrieval**: Fetch from multiple tiers concurrently
5. **Batch Operations**: Group database operations where possible
6. **Query Optimization**: Proper indexes, projections to limit fields

### Database Sharding (Future)

- **MongoDB**: Shard by `workspaceId` for workspace isolation
- **Qdrant**: Shard by collection or workspace
- **Redis**: Cluster mode with hash slot distribution

## Security Architecture

### Authentication & Authorization

- **API Keys** (Post-MVP): Header-based authentication
- **JWT Tokens** (Post-MVP): Stateless session management
- **Rate Limiting**: 100 requests per 15 minutes per IP

### Input Validation

- Zod schemas for all API inputs
- XSS sanitization (script tag removal)
- Path traversal prevention
- NoSQL injection prevention (parameterized queries)

### Data Protection

- Sensitive data encryption at rest (MongoDB encryption)
- TLS/SSL for data in transit
- Environment secrets via secret managers (not .env in production)

## Monitoring & Observability

### Logging

- **Winston Logger**: Structured JSON logs
- **Log Levels**: error, warn, info, debug
- **Context**: Request ID, user ID, workspace ID in all logs

### Metrics (Future)

- **Prometheus**: Request count, latency, error rates
- **Grafana**: Dashboards for system health
- **Custom Metrics**: Token usage, context utilization, cache hit rates

### Tracing (Future)

- **OpenTelemetry**: Distributed tracing across services
- **Jaeger**: Trace visualization

## Deployment Architecture

### Development

- Monorepo on local machine
- MongoDB/Redis/Qdrant running locally or via Docker
- Hot reload with Turbo

### Staging

- Docker containers via docker-compose
- Separate databases (test data)
- Monitoring enabled

### Production (Future)

- Kubernetes cluster (EKS, GKE, AKS)
- Managed databases (MongoDB Atlas, Redis Cloud, Qdrant Cloud)
- Auto-scaling based on load
- Multi-region deployment for low latency

---

**Last Updated**: 2025-11-03
**Version**: 1.0 (MVP)
