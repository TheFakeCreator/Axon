# Data Flow Documentation

This document describes how data flows through the Axon system for key workflows.

## Table of Contents

1. [Prompt Processing Flow](#prompt-processing-flow)
2. [Workspace Initialization Flow](#workspace-initialization-flow)
3. [Context Evolution Flow](#context-evolution-flow)
4. [Streaming Response Flow](#streaming-response-flow)

---

## Prompt Processing Flow

### Overview

The prompt processing flow is the core workflow of Axon, transforming a user prompt into a contextually-enriched LLM response.

### Flow Diagram

````
┌────────────┐
│    User    │
└─────┬──────┘
      │ 1. Submit Prompt
      ▼
┌─────────────────────────────────────────────────────────────┐
│                     API Gateway                              │
│  POST /api/v1/prompts/process                               │
│  • Validate request (Zod schema)                            │
│  • Rate limiting check (100 req/15min)                      │
│  • CORS validation                                          │
└─────┬───────────────────────────────────────────────────────┘
      │ 2. Forward to Middleware
      ▼
┌─────────────────────────────────────────────────────────────┐
│                  Prompt Collector                            │
│  • Generate request ID (UUID)                               │
│  • XSS sanitization                                         │
│  • Extract metadata (source, language, file, cursor)        │
│  • Add timestamps                                           │
│  • Structured logging                                       │
└─────┬───────────────────────────────────────────────────────┘
      │ 3. CollectedPrompt
      ▼
┌─────────────────────────────────────────────────────────────┐
│                  Prompt Analyzer                             │
│  Step 1: Intent Classification                              │
│    • Coding: "fix bug", "add feature", "refactor"          │
│    • PKM: "create note", "find notes"                       │
│    • General: "what is", "how do I"                         │
│                                                              │
│  Step 2: Task Type Identification                           │
│    • Bug Fix, Feature Add, Code Review, Testing, etc.      │
│                                                              │
│  Step 3: Entity Extraction                                  │
│    • Files: authentication.ts, UserService.java            │
│    • Functions: handleLogin(), validateUser()              │
│    • Technologies: React, Express, PostgreSQL              │
│                                                              │
│  Step 4: Ambiguity Detection                                │
│    • Check for vague references ("the function", "that")   │
│    • Missing critical info (no file, no error message)     │
│    • Generate clarification suggestions                    │
└─────┬───────────────────────────────────────────────────────┘
      │ 4. PromptAnalysis
      │    { intent, taskTypes, entities, ambiguityScore }
      ▼
┌─────────────────────────────────────────────────────────────┐
│              Context Retriever (Context Engine)              │
│  Step 1: Query Expansion                                    │
│    • Add high-confidence entities (>0.7) to search         │
│    • Example: "fix login" → "fix login authentication.ts"  │
│                                                              │
│  Step 2: Hierarchical Search                                │
│    Tier 1: Workspace Context (project-specific)            │
│      ↓ Generate embedding for query                         │
│      ↓ Vector search in Qdrant (workspaceId filter)        │
│      ↓ MongoDB hydration for full content                   │
│                                                              │
│    Tier 2: Hybrid Context (runtime integration)            │
│      ↓ Search across workspace + global                     │
│      ↓ Filter by task type, tier                            │
│                                                              │
│    Tier 3: Global Context (fallback)                        │
│      ↓ Cross-workspace knowledge                            │
│                                                              │
│  Step 3: 4-Factor Re-Ranking                                │
│    Score = 0.6*similarity + 0.2*freshness +                │
│            0.1*usage + 0.1*confidence                       │
│                                                              │
│  Step 4: Diversity Selection                                │
│    • Avoid redundant contexts                               │
│    • Balance: 70% score + 30% diversity                    │
│                                                              │
│  Step 5: Update Usage Stats (async)                        │
│    • Increment usageCount                                   │
│    • Update lastAccessed timestamp                          │
└─────┬───────────────────────────────────────────────────────┘
      │ 5. RetrievedContext[]
      │    { id, content, type, relevanceScore, metadata }
      ▼
┌─────────────────────────────────────────────────────────────┐
│                  Context Synthesizer                         │
│  Step 1: Token Budget Allocation (task-specific)            │
│    Bug Fix:   35% errors, 20% files, 15% symbols, ...      │
│    Feature:   25% files, 25% architecture, 20% symbols, ...│
│                                                              │
│  Step 2: Context Prioritization                             │
│    • Sort by relevanceScore                                 │
│    • Group by context type (file, symbol, error, ...)      │
│                                                              │
│  Step 3: Compression (if needed)                            │
│    • Use summaries when available                           │
│    • Truncate long content (keep start + end)              │
│    • Apply when >80% of token budget used                   │
│                                                              │
│  Step 4: LLM-Optimized Formatting                           │
│    • Markdown sections                                      │
│    • Code blocks with language tags                        │
│    • Source attribution with relevance scores              │
│    • Metadata (file paths, line ranges)                    │
└─────┬───────────────────────────────────────────────────────┘
      │ 6. SynthesizedContext (formatted string)
      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Prompt Injector                           │
│  Step 1: Injection Strategy Selection                       │
│    • Prefix: Context in system prompt (general queries)    │
│    • Inline: Mixed with user prompt (code review)          │
│    • Suffix: After user prompt (documentation)             │
│    • Hybrid: Balanced (default, adapts to task)            │
│                                                              │
│  Step 2: System Prompt Construction                         │
│    You are an expert AI assistant...                        │
│    Task: {Bug Fix, Feature Add, etc.}                       │
│    Available Context: {synthesized context}                 │
│    Instructions: {task-specific guidance}                   │
│                                                              │
│  Step 3: User Prompt Construction                           │
│    {original user prompt}                                   │
│    {inline/suffix context if applicable}                    │
│                                                              │
│  Step 4: Token Limit Validation                             │
│    • Check total tokens < model limit                       │
│    • Throw TokenLimitError if exceeded                      │
└─────┬───────────────────────────────────────────────────────┘
      │ 7. EnrichedPrompt
      │    { systemMessage, userMessage, totalTokens }
      ▼
┌─────────────────────────────────────────────────────────────┐
│                    LLM Gateway                               │
│  Step 1: Provider Selection                                 │
│    • OpenAI (default: GPT-4)                                │
│    • Anthropic (Claude)                                     │
│    • Ollama (local models)                                  │
│                                                              │
│  Step 2: Request Preparation                                │
│    messages: [                                              │
│      { role: 'system', content: systemMessage },           │
│      { role: 'user', content: userMessage }                │
│    ]                                                         │
│                                                              │
│  Step 3: Streaming/Non-Streaming Execution                  │
│    Streaming: AsyncGenerator yielding chunks               │
│    Non-Streaming: Single completion response               │
│                                                              │
│  Step 4: Retry Logic (on failure)                          │
│    • Exponential backoff: 1s, 2s, 4s, 8s                   │
│    • Max retries: 3                                         │
│    • Retry on: 429, 500, 502, 503, 504                     │
│                                                              │
│  Step 5: Circuit Breaker                                    │
│    • Track failure rate                                     │
│    • Open circuit if >50% failures in 1min                  │
│    • Fallback: cached response or error                    │
│                                                              │
│  Step 6: Token Usage Tracking                               │
│    • Input tokens, output tokens, total                     │
│    • Cost calculation                                       │
└─────┬───────────────────────────────────────────────────────┘
      │ 8. LLM Response (streaming or complete)
      ▼
┌─────────────────────────────────────────────────────────────┐
│              Response Post-Processor                         │
│  Step 1: Quality Assessment                                 │
│    • Check for error indicators:                            │
│      "I don't know", "unclear", "I cannot"                  │
│    • Validate structure:                                    │
│      Headings, lists, code blocks present                   │
│    • Check completeness:                                    │
│      Proper ending, no truncation markers                   │
│    • Calculate quality score (0-1)                          │
│                                                              │
│  Step 2: Action Extraction                                  │
│    • Code changes: Extract from ```code``` blocks          │
│    • File operations: "create file", "update", "delete"    │
│    • Test suggestions: "add test for..."                   │
│    • Documentation: "update README"                         │
│    • Confidence-based filtering (>0.6 threshold)           │
│                                                              │
│  Step 3: Knowledge Capture                                  │
│    • Classify knowledge type:                               │
│      Pattern, Solution, Decision, Error-Fix                │
│    • Extract entities (files, functions, classes)          │
│    • Calculate confidence score                             │
│    • Convert to NewKnowledge format                         │
│                                                              │
│  Step 4: Async Context Storage                              │
│    • Store new knowledge in Context Engine                  │
│    • Index in vector DB for future retrieval               │
│    • Update interaction history                             │
└─────┬───────────────────────────────────────────────────────┘
      │ 9. ProcessedResponse
      │    { response, actions, knowledge, qualityScore }
      ▼
┌─────────────────────────────────────────────────────────────┐
│                     API Gateway                              │
│  • Format response (JSON or SSE)                            │
│  • Add metadata (latency, tokens used)                      │
│  • Log request completion                                   │
└─────┬───────────────────────────────────────────────────────┘
      │ 10. Return to User
      ▼
┌────────────┐
│    User    │
└────────────┘
````

### Latency Breakdown

| Stage                   | Typical Latency | Notes                             |
| ----------------------- | --------------- | --------------------------------- |
| API Gateway             | 5ms             | Validation, routing               |
| Prompt Collector        | 10ms            | Enrichment, sanitization          |
| Prompt Analyzer         | 150ms           | NLP processing, classification    |
| Context Retriever       | 300ms           | Vector search + MongoDB hydration |
| Context Synthesizer     | 80ms            | Formatting, compression           |
| Prompt Injector         | 30ms            | Prompt construction               |
| LLM Gateway             | 1500ms          | Model-dependent (GPT-4)           |
| Response Post-Processor | 50ms            | Extraction, storage               |
| **Total**               | **~2125ms**     | **~2.1 seconds**                  |

### Data Structures

**CollectedPrompt**:

```typescript
{
  requestId: string;        // UUID
  prompt: string;           // User's original prompt
  workspaceId: string;      // Target workspace
  metadata: {
    source: string;         // 'vscode', 'cli', 'web'
    language?: string;      // 'typescript', 'python', etc.
    fileName?: string;      // Active file
    cursorPosition?: { line: number; column: number };
    diagnostics?: Array<{ message: string; severity: string }>;
  };
  timestamp: Date;
}
```

**PromptAnalysis**:

```typescript
{
  intent: 'coding' | 'pkm' | 'general';
  intentConfidence: number;
  taskTypes: Array<{
    type: TaskType;         // 'bug-fix', 'feature-add', etc.
    confidence: number;
  }>;
  entities: Array<{
    type: 'file' | 'function' | 'class' | 'technology';
    value: string;
    confidence: number;
  }>;
  ambiguityScore: number;   // 0-1 (higher = more ambiguous)
  clarifications?: string[]; // Suggested questions
}
```

**RetrievedContext**:

```typescript
{
  id: string;
  content: string;
  summary?: string;
  type: ContextType;        // 'file', 'symbol', 'error', etc.
  tier: 'workspace' | 'hybrid' | 'global';
  relevanceScore: number;   // 0-1 from re-ranking
  metadata: {
    source: string;
    filePath?: string;
    lineRange?: { start: number; end: number };
    language?: string;
    confidence: number;
    tags?: string[];
  };
}
```

**SynthesizedContext**:

```typescript
{
  formattedContext: string; // Markdown-formatted
  tokenCount: number;
  contextSources: Array<{
    id: string;
    type: ContextType;
    relevance: number;
  }>;
}
```

**EnrichedPrompt**:

```typescript
{
  systemMessage: string;    // System prompt with context
  userMessage: string;      // User prompt (possibly enriched)
  totalTokens: number;
  injectionStrategy: 'prefix' | 'inline' | 'suffix' | 'hybrid';
  contextUsed: string[];    // Context IDs
}
```

**ProcessedResponse**:

```typescript
{
  response: string; // LLM response text
  actions: Array<{
    type: 'code-change' | 'file-operation' | 'test' | 'documentation';
    description: string;
    confidence: number;
    details?: any;
  }>;
  knowledge: Array<{
    type: 'pattern' | 'solution' | 'decision' | 'error-fix';
    content: string;
    entities: string[];
    confidence: number;
  }>;
  qualityScore: number; // 0-1
}
```

---

## Workspace Initialization Flow

### Overview

When a user adds a new workspace, Axon scans the directory, extracts context, and indexes it for future retrieval.

### Flow Diagram

```
┌────────────┐
│    User    │
└─────┬──────┘
      │ 1. Add Workspace (path, type)
      ▼
┌─────────────────────────────────────────────────────────────┐
│                  Workspace Manager                           │
│  • Detect workspace type (coding, PKM, root)                │
│  • Create workspace metadata in MongoDB                     │
│  • Generate workspace ID                                    │
└─────┬───────────────────────────────────────────────────────┘
      │ 2. Workspace Created
      ▼
┌─────────────────────────────────────────────────────────────┐
│            Directory Scanner (Workspace Manager)             │
│  • Recursive directory traversal                            │
│  • Respect .gitignore, .axonignore                          │
│  • Exclude patterns:                                        │
│    - node_modules, .git, dist, build, coverage             │
│  • Collect file paths and metadata                          │
└─────┬───────────────────────────────────────────────────────┘
      │ 3. File List
      ▼
┌─────────────────────────────────────────────────────────────┐
│          Technology Stack Detector (Coding Workspace)        │
│  • Parse package.json → frameworks, dependencies            │
│  • Detect package manager (pnpm-lock, yarn.lock, etc.)     │
│  • Identify build tools (turbo.json, vite.config.ts)       │
│  • Detect VCS (.git, .hg)                                   │
│  • Store in workspace metadata                              │
└─────┬───────────────────────────────────────────────────────┘
      │ 4. Tech Stack Metadata
      ▼
┌─────────────────────────────────────────────────────────────┐
│             File Context Extractor                           │
│  For each file:                                             │
│    • Read file content                                      │
│    • Detect language (extension, shebang)                   │
│    • Extract imports/exports (for code files)              │
│    • Generate summary (first 500 chars)                     │
│    • Calculate line count, file size                        │
│    • Create ContextNode object                              │
└─────┬───────────────────────────────────────────────────────┘
      │ 5. ContextNode[] (raw contexts)
      ▼
┌─────────────────────────────────────────────────────────────┐
│              Embedding Generator (Context Engine)            │
│  • Batch contexts (max 32 per batch)                        │
│  • Generate embeddings using @xenova/transformers           │
│  • Model: all-MiniLM-L6-v2 (384 dimensions)                 │
│  • Cache embeddings in Redis (MD5-based key, 24h TTL)      │
└─────┬───────────────────────────────────────────────────────┘
      │ 6. Contexts with Embeddings
      ▼
┌─────────────────────────────────────────────────────────────┐
│              Context Storage (Context Engine)                │
│  • Batch insert to MongoDB (contexts collection)           │
│  • Batch upsert to Qdrant (vector DB)                      │
│  • Link contexts to workspace ID                            │
│  • Create indexes (workspaceId, type, createdAt)           │
└─────┬───────────────────────────────────────────────────────┘
      │ 7. Indexing Complete
      ▼
┌────────────┐
│    User    │ ← "Workspace indexed: 1500 files, 3.2MB context"
└────────────┘
```

### Progress Tracking

```typescript
interface IndexingProgress {
  workspaceId: string;
  totalFiles: number;
  processedFiles: number;
  currentFile: string;
  status: 'scanning' | 'extracting' | 'embedding' | 'indexing' | 'complete';
  errors: string[];
}
```

### Performance Considerations

- **Large Workspaces**: Process in batches (e.g., 100 files at a time)
- **Binary Files**: Skip (images, videos, compiled binaries)
- **Large Files**: Truncate or summarize (>1MB files)
- **Parallelization**: Use worker threads for CPU-intensive tasks

---

## Context Evolution Flow

### Overview

Context evolves over time based on user feedback, usage patterns, and temporal decay.

### Flow Diagram

```
┌────────────┐
│    User    │
└─────┬──────┘
      │ Provides Feedback (rating, corrections)
      ▼
┌─────────────────────────────────────────────────────────────┐
│            Feedback Collector (API Endpoint)                 │
│  POST /api/v1/interactions/:id/feedback                     │
│  {                                                           │
│    rating: 4 (1-5 scale),                                   │
│    helpful: true,                                            │
│    corrections: "Should use async/await, not callbacks"     │
│  }                                                           │
└─────┬───────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────┐
│          Context Evolution Engine (Background Job)           │
│  Step 1: Feedback Integration                               │
│    • Retrieve contexts used in interaction                  │
│    • Update confidence scores:                              │
│      newConfidence = 0.7*current + 0.3*(rating/5)          │
│    • Store feedback in interactions collection             │
│                                                              │
│  Step 2: Temporal Decay (Scheduled Job - Daily)            │
│    • For all contexts older than 1 day:                     │
│      decayedConf = conf * exp(-age/maxAge)                 │
│    • maxAge = 90 days (default)                             │
│    • 1% decay per day                                       │
│                                                              │
│  Step 3: Auto-Deletion                                      │
│    • Find contexts with confidence < 0.3                    │
│    • Delete from MongoDB + Qdrant (batch operation)        │
│                                                              │
│  Step 4: Consolidation (Post-MVP)                          │
│    • Find similar contexts (embedding similarity >0.9)     │
│    • Merge duplicates, keep highest confidence             │
│    • Create summarized version                              │
│                                                              │
│  Step 5: Conflict Resolution (Post-MVP)                    │
│    • Detect contradictory contexts                          │
│    • Resolve using: timestamps, feedback, usage            │
│    • Flag for human review if uncertain                     │
└─────┬───────────────────────────────────────────────────────┘
      │ Evolution Complete
      ▼
┌─────────────────────────────────────────────────────────────┐
│                 Context Storage (Updated)                    │
│  • Updated confidence scores                                │
│  • Removed low-confidence contexts                          │
│  • Consolidated duplicates                                  │
│  • Resolved conflicts                                       │
└─────────────────────────────────────────────────────────────┘
```

### Evolution Metrics

```typescript
interface EvolutionStats {
  totalContexts: number;
  averageConfidence: number;
  lowConfidenceCount: number; // confidence < 0.5
  recentFeedbackCount: number; // last 7 days
  deletedCount: number; // in last evolution cycle
  consolidatedCount: number; // merged contexts
}
```

---

## Streaming Response Flow

### Overview

For real-time user experience, Axon supports streaming responses via Server-Sent Events (SSE).

### Flow Diagram

```
┌────────────┐
│    User    │
└─────┬──────┘
      │ Request with stream: true
      ▼
┌─────────────────────────────────────────────────────────────┐
│                  API Gateway (SSE Setup)                     │
│  • Set headers:                                             │
│    Content-Type: text/event-stream                          │
│    Cache-Control: no-cache                                  │
│    Connection: keep-alive                                   │
│  • Open SSE connection                                      │
└─────┬───────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────┐
│            Middleware Pipeline (Streaming Mode)              │
│  Steps 1-6: Same as non-streaming                           │
│    (Collection → Analysis → Retrieval → Synthesis →        │
│     Injection)                                              │
│                                                              │
│  Step 7: Send Metadata Event                                │
│    event: metadata                                          │
│    data: { requestId, taskType, contextCount }             │
└─────┬───────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────┐
│           LLM Gateway (Streaming Completion)                 │
│  async *processStreaming(messages) {                        │
│    const stream = await openai.chat.completions.create({   │
│      messages,                                              │
│      stream: true                                           │
│    });                                                       │
│                                                              │
│    for await (const chunk of stream) {                     │
│      const content = chunk.choices[0]?.delta?.content;    │
│      if (content) {                                         │
│        yield content;  // ← Stream chunk to client         │
│      }                                                       │
│    }                                                         │
│  }                                                           │
└─────┬───────────────────────────────────────────────────────┘
      │ Chunks streamed as they arrive
      ▼
┌─────────────────────────────────────────────────────────────┐
│                  API Gateway (SSE Events)                    │
│  For each chunk:                                            │
│    event: chunk                                             │
│    data: { content: "Hello", index: 0 }                    │
│                                                              │
│  On completion:                                             │
│    event: done                                              │
│    data: { totalTokens, latency }                          │
└─────┬───────────────────────────────────────────────────────┘
      │ Stream chunks in real-time
      ▼
┌────────────┐
│    User    │ ← Receives text incrementally
└────────────┘
```

### SSE Event Types

**metadata**:

```
event: metadata
data: {"requestId":"abc123","taskType":"bug-fix","contextCount":5}
```

**chunk**:

```
event: chunk
data: {"content":"To fix this bug, ","index":0}
```

**done**:

```
event: done
data: {"totalTokens":350,"latency":2150,"qualityScore":0.85}
```

**error**:

```
event: error
data: {"message":"LLM rate limit exceeded","code":"RATE_LIMIT"}
```

### Client-Side Handling (JavaScript)

```javascript
const eventSource = new EventSource('/api/v1/prompts/process');

eventSource.addEventListener('metadata', (event) => {
  const meta = JSON.parse(event.data);
  console.log('Metadata:', meta);
});

eventSource.addEventListener('chunk', (event) => {
  const { content } = JSON.parse(event.data);
  displayStream(content); // Append to UI
});

eventSource.addEventListener('done', (event) => {
  const stats = JSON.parse(event.data);
  console.log('Complete:', stats);
  eventSource.close();
});

eventSource.addEventListener('error', (event) => {
  const error = JSON.parse(event.data);
  console.error('Error:', error);
  eventSource.close();
});
```

---

## Performance Optimization Strategies

### 1. Caching

- **Embeddings**: Redis cache (24h TTL, MD5 keys)
- **Analyses**: Redis cache (1h TTL, prompt-based keys)
- **Query Results**: Redis cache (5min TTL, query hash keys)

### 2. Parallel Processing

```typescript
// Parallel context retrieval from multiple tiers
const [workspaceContexts, hybridContexts, globalContexts] = await Promise.all([
  retrieveFromWorkspace(query, workspaceId),
  retrieveFromHybrid(query, workspaceId),
  retrieveFromGlobal(query),
]);
```

### 3. Connection Pooling

- MongoDB: Max 50 connections per instance
- Redis: Connection pool with 10 connections
- Qdrant: HTTP connection reuse

### 4. Lazy Loading

- Load context content only when needed (not during retrieval)
- Defer non-critical operations (usage tracking, logging)

### 5. Database Optimization

- Proper indexes on frequently queried fields
- Projection to limit returned fields
- Aggregation pipelines for complex queries

---

**Last Updated**: 2025-11-03
**Version**: 1.0 (MVP)
