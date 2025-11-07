# Performance Optimization Guide

> **Purpose**: Guide for profiling, analyzing, and optimizing Axon performance to meet MVP targets and prepare for production scaling.

---

## Table of Contents

- [Performance Targets](#performance-targets)
- [Profiling Tools & Setup](#profiling-tools--setup)
- [Performance Analysis](#performance-analysis)
- [Database Optimization](#database-optimization)
- [Caching Optimization](#caching-optimization)
- [Code Optimization](#code-optimization)
- [Load Testing](#load-testing)
- [Performance Monitoring](#performance-monitoring)

---

## Performance Targets

### MVP Performance Targets

| Metric                 | Target         | Critical Threshold |
| ---------------------- | -------------- | ------------------ |
| **Prompt Analysis**    | < 200ms (p95)  | < 500ms            |
| **Context Retrieval**  | < 500ms (p95)  | < 1s               |
| **Full Orchestration** | < 3s (p95)     | < 5s               |
| **Health Check**       | < 50ms (p95)   | < 100ms            |
| **Memory Usage**       | < 2GB (idle)   | < 4GB (under load) |
| **CPU Usage**          | < 50% (normal) | < 80% (peak)       |
| **Throughput**         | 10+ req/s      | 5+ req/s minimum   |
| **Database Queries**   | < 100ms (p95)  | < 500ms            |
| **Cache Hit Rate**     | > 80%          | > 60% minimum      |

### Latency Breakdown (Target)

```
Total Request: 3000ms
├── Prompt Collection: 10ms (0.3%)
├── Prompt Analysis: 200ms (6.7%)
├── Context Retrieval: 500ms (16.7%)
│   ├── Vector Search: 200ms
│   ├── MongoDB Fetch: 150ms
│   └── Re-ranking: 150ms
├── Context Synthesis: 100ms (3.3%)
├── Prompt Injection: 50ms (1.7%)
├── LLM Processing: 2000ms (66.7%)
└── Post-processing: 140ms (4.7%)
```

---

## Profiling Tools & Setup

### Node.js Built-in Profiler

**CPU Profiling:**

```bash
# Start API with profiler
node --prof apps/api/dist/server.js

# Generate readable output after stopping
node --prof-process isolate-0x*.log > profile.txt

# Analyze profile.txt for hot functions
less profile.txt
```

**Heap Profiling:**

```bash
# Start with heap profiling
node --inspect apps/api/dist/server.js

# In Chrome, go to: chrome://inspect
# Click "Open dedicated DevTools for Node"
# Go to Memory tab, take heap snapshot

# Or use heapdump module
npm install heapdump
```

```typescript
// Add to server.ts for manual heap dumps
import heapdump from 'heapdump';

app.get('/admin/heapdump', (req, res) => {
  const filename = `/tmp/heapdump-${Date.now()}.heapsnapshot`;
  heapdump.writeSnapshot(filename, (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({ snapshot: filename });
    }
  });
});
```

### Clinic.js (Recommended)

**Installation:**

```bash
npm install -g clinic
```

**Doctor (Detect Performance Issues):**

```bash
# Profile application
clinic doctor -- node apps/api/dist/server.js

# Run some load tests while profiling
# Stop with Ctrl+C

# Opens HTML report automatically
```

**Flame (CPU Profiling):**

```bash
clinic flame -- node apps/api/dist/server.js
# Generates flame graph
```

**Bubbleprof (Async Operations):**

```bash
clinic bubbleprof -- node apps/api/dist/server.js
# Visualizes async operations
```

### autocannon (Load Testing)

**Installation:**

```bash
npm install -g autocannon
```

**Basic Load Test:**

```bash
# Health endpoint (baseline)
autocannon -c 10 -d 30 http://localhost:3000/health

# Prompt processing (realistic)
autocannon -c 5 -d 60 -m POST \
  -H "Content-Type: application/json" \
  -b '{"prompt":"What is TypeScript?","workspaceId":"test","source":"api"}' \
  http://localhost:3000/api/v1/prompts/process
```

**Analyze Results:**

```
Running 60s test @ http://localhost:3000/api/v1/prompts/process
5 connections

┌─────────┬───────┬───────┬───────┬───────┬─────────┬─────────┬───────┐
│ Stat    │ 2.5%  │ 50%   │ 97.5% │ 99%   │ Avg     │ Stdev   │ Max   │
├─────────┼───────┼───────┼───────┼───────┼─────────┼─────────┼───────┤
│ Latency │ 200ms │ 250ms │ 300ms │ 350ms │ 250ms   │ 50ms    │ 500ms │
└─────────┴───────┴───────┴───────┴───────┴─────────┴─────────┴───────┘

┌───────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐
│ Stat      │ 1%      │ 2.5%    │ 50%     │ 97.5%   │ Avg     │ Stdev   │ Min     │
├───────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│ Req/Sec   │ 15      │ 15      │ 20      │ 25      │ 20      │ 3       │ 15      │
└───────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘

300 requests in 60s, 1.5MB read
```

**Target Interpretation:**

- ✅ p95 latency < 3s: Good
- ✅ p99 latency < 5s: Acceptable
- ⚠️ p99 latency > 5s: Needs optimization
- ❌ p99 latency > 10s: Critical issue

### k6 (Advanced Load Testing)

**Installation:**

```bash
# macOS
brew install k6

# Windows
choco install k6

# Linux
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

**Load Test Script** (`scripts/load-test.js`):

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 }, // Ramp up to 10 users
    { duration: '1m', target: 10 }, // Stay at 10 users
    { duration: '30s', target: 20 }, // Ramp up to 20 users
    { duration: '1m', target: 20 }, // Stay at 20 users
    { duration: '30s', target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'], // 95% of requests < 3s
    http_req_failed: ['rate<0.05'], // Error rate < 5%
  },
};

export default function () {
  const url = 'http://localhost:3000/api/v1/prompts/process';
  const payload = JSON.stringify({
    prompt: 'What is TypeScript?',
    workspaceId: 'test',
    source: 'api',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(url, payload, params);

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response has result': (r) => JSON.parse(r.body).result !== undefined,
    'latency < 3s': (r) => r.timings.duration < 3000,
  });

  sleep(1);
}
```

**Run Load Test:**

```bash
k6 run scripts/load-test.js

# With custom VUs and duration
k6 run --vus 10 --duration 60s scripts/load-test.js

# With output to InfluxDB (for Grafana)
k6 run --out influxdb=http://localhost:8086/k6 scripts/load-test.js
```

---

## Performance Analysis

### Step 1: Establish Baseline

**Before optimization, measure current performance:**

```bash
# 1. Start application with monitoring
docker-compose up -d

# 2. Run baseline load test
autocannon -c 10 -d 60 http://localhost:3000/health > baseline-health.txt
autocannon -c 5 -d 60 -m POST \
  -H "Content-Type: application/json" \
  -b '{"prompt":"test","workspaceId":"test","source":"api"}' \
  http://localhost:3000/api/v1/prompts/process > baseline-prompts.txt

# 3. Check resource usage
docker stats --no-stream > baseline-resources.txt

# 4. Export database stats
mongo "$MONGODB_URI" --eval "db.serverStatus()" > baseline-mongodb.txt
redis-cli -u "$REDIS_URL" INFO > baseline-redis.txt
```

### Step 2: Identify Bottlenecks

**Use Clinic.js Doctor:**

```bash
clinic doctor -- node apps/api/dist/server.js

# In another terminal, run load test
autocannon -c 10 -d 30 -m POST \
  -H "Content-Type: application/json" \
  -b '{"prompt":"test","workspaceId":"test","source":"api"}' \
  http://localhost:3000/api/v1/prompts/process

# Stop server (Ctrl+C)
# Clinic opens report
```

**Look for:**

- 🔴 High Event Loop Delay (> 10ms) → CPU-bound operations
- 🔴 High I/O Wait → Database or network issues
- 🔴 Memory Growth → Potential memory leak
- 🔴 High CPU Usage → Inefficient algorithms

### Step 3: Profile CPU Usage

**Use Clinic Flame:**

```bash
clinic flame -- node apps/api/dist/server.js

# Run load test
autocannon -c 10 -d 30 -m POST \
  -H "Content-Type: application/json" \
  -b '{"prompt":"test","workspaceId":"test","source":"api"}' \
  http://localhost:3000/api/v1/prompts/process

# Stop server (Ctrl+C)
# Analyze flame graph
```

**Look for:**

- Wide bars → Hot functions (spend most time)
- Deep stacks → Complex call chains
- Unexpected functions → Inefficiencies

### Step 4: Analyze Async Operations

**Use Clinic Bubbleprof:**

```bash
clinic bubbleprof -- node apps/api/dist/server.js

# Run load test
# Stop server
# Analyze bubble graph
```

**Look for:**

- Large bubbles → Slow async operations
- Many small bubbles → Too many async operations
- Disconnected bubbles → Parallel operations

### Step 5: Memory Profiling

**Heap Snapshot Analysis:**

```bash
# Start with inspector
node --inspect apps/api/dist/server.js

# Chrome DevTools:
# 1. Take snapshot before load test
# 2. Run load test
# 3. Take snapshot after load test
# 4. Compare snapshots
```

**Look for:**

- Retained size growth → Memory leak
- Detached DOM nodes (if using UI)
- Large arrays or strings
- Closures retaining objects

---

## Database Optimization

### MongoDB Query Analysis

**Enable Profiling:**

```javascript
// Enable profiling (level 2 = all operations)
db.setProfilingLevel(2, { slowms: 100 });

// Run application for 5 minutes
// ...

// Analyze slow queries
db.system.profile
  .find({ millis: { $gt: 100 } })
  .sort({ millis: -1 })
  .limit(10)
  .pretty();

// Disable profiling
db.setProfilingLevel(0);
```

**Common Slow Queries:**

```javascript
// 1. Missing indexes
db.contexts.find({ workspaceId: 'test', tier: 'workspace' }).explain('executionStats');

// Look for:
// - executionTimeMillis > 100
// - totalDocsExamined >> nReturned (full collection scan)

// 2. Add missing indexes
db.contexts.createIndex({ workspaceId: 1, tier: 1 });

// 3. Verify index usage
db.contexts.find({ workspaceId: 'test', tier: 'workspace' }).explain('executionStats');
// Should show "IXSCAN" (index scan) not "COLLSCAN"
```

**Index Optimization:**

```javascript
// Check existing indexes
db.contexts.getIndexes();

// Check index usage
db.contexts.aggregate([{ $indexStats: {} }]);

// Remove unused indexes
db.contexts.dropIndex('unusedIndex');

// Compound indexes for common queries
db.contexts.createIndex(
  { workspaceId: 1, tier: 1, confidence: -1 },
  { name: 'workspace_tier_confidence_idx' }
);
```

**Query Optimization:**

```javascript
// Before: Fetch all fields
const contexts = await db.collection('contexts').find({ workspaceId }).toArray();

// After: Project only needed fields
const contexts = await db
  .collection('contexts')
  .find({ workspaceId })
  .project({ content: 1, metadata: 1, confidence: 1 })
  .toArray();

// Savings: ~70% less data transferred
```

**Connection Pool Tuning:**

```javascript
// packages/shared/src/database/mongodb-connection.ts
const client = new MongoClient(uri, {
  maxPoolSize: 50, // Increase from default 10
  minPoolSize: 10, // Keep connections warm
  maxIdleTimeMS: 60000, // Close idle connections after 1 min
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
});
```

### Redis Optimization

**Check Memory Usage:**

```bash
redis-cli -u "$REDIS_URL" INFO memory

# Key metrics:
# - used_memory: Current memory usage
# - used_memory_peak: Peak memory usage
# - mem_fragmentation_ratio: Should be close to 1.0
```

**Cache Hit Rate:**

```bash
redis-cli -u "$REDIS_URL" INFO stats | grep keyspace

# Calculate hit rate:
# hit_rate = keyspace_hits / (keyspace_hits + keyspace_misses)
# Target: > 80%
```

**Optimize Cache Strategy:**

```typescript
// Before: Short TTL (cache thrashing)
await redis.setex(`cache:${key}`, 300, value); // 5 min

// After: Longer TTL with LRU eviction
await redis.setex(`cache:${key}`, 3600, value); // 1 hour

// Configure maxmemory-policy
// In redis.conf or docker-compose.yml:
// maxmemory 2gb
// maxmemory-policy allkeys-lru
```

**Pipeline Commands:**

```typescript
// Before: Multiple round trips
await redis.get('key1');
await redis.get('key2');
await redis.get('key3');

// After: Single round trip with pipeline
const pipeline = redis.pipeline();
pipeline.get('key1');
pipeline.get('key2');
pipeline.get('key3');
const results = await pipeline.exec();

// Savings: ~66% latency reduction
```

### Qdrant Optimization

**Collection Configuration:**

```typescript
// Optimize HNSW index
await qdrant.createCollection('axon-contexts', {
  vectors: {
    size: 384,
    distance: 'Cosine',
  },
  hnsw_config: {
    m: 16, // Increase for better recall (default: 16)
    ef_construct: 200, // Increase for better quality (default: 100)
  },
  optimizers_config: {
    deleted_threshold: 0.2,
    vacuum_min_vector_number: 1000,
  },
});
```

**Search Optimization:**

```typescript
// Add search parameters
const searchResult = await qdrant.search('axon-contexts', {
  vector: embedding,
  limit: 20,
  params: {
    hnsw_ef: 128, // Increase for better recall (default: equal to limit)
    exact: false, // Use approximate search
  },
  filter: {
    must: [{ key: 'workspaceId', match: { value: workspaceId } }],
  },
});
```

**Batch Operations:**

```typescript
// Before: Multiple upserts
for (const context of contexts) {
  await qdrant.upsert('axon-contexts', {
    points: [{ id: context.id, vector: context.embedding, payload: context.metadata }],
  });
}

// After: Single batch upsert
await qdrant.upsert('axon-contexts', {
  points: contexts.map((c) => ({
    id: c.id,
    vector: c.embedding,
    payload: c.metadata,
  })),
});

// Savings: ~90% latency reduction for 50 contexts
```

---

## Caching Optimization

### Embedding Cache

**Current Implementation:**

```typescript
// packages/context-engine/src/services/embedding-service.ts
private async getCachedEmbedding(text: string): Promise<number[] | null> {
  const cacheKey = this.getCacheKey(text);
  const cached = await this.redis.get(cacheKey);
  return cached ? JSON.parse(cached) : null;
}

private async cacheEmbedding(text: string, embedding: number[]): Promise<void> {
  const cacheKey = this.getCacheKey(text);
  await this.redis.setex(cacheKey, 86400, JSON.stringify(embedding)); // 24 hours
}
```

**Optimization:**

```typescript
// Use MessagePack for 30% size reduction
import msgpack from 'msgpack-lite';

private async cacheEmbedding(text: string, embedding: number[]): Promise<void> {
  const cacheKey = this.getCacheKey(text);
  const packed = msgpack.encode(embedding);
  await this.redis.setex(cacheKey, 86400, packed);
}

private async getCachedEmbedding(text: string): Promise<number[] | null> {
  const cacheKey = this.getCacheKey(text);
  const cached = await this.redis.getBuffer(cacheKey);
  return cached ? msgpack.decode(cached) : null;
}
```

### Context Cache

**Implement Multi-Level Cache:**

```typescript
// packages/context-engine/src/retrieval/context-retriever.ts
export class ContextRetriever {
  private memoryCache: LRUCache<string, RetrievedContext[]>;

  constructor(/* ... */) {
    // In-memory LRU cache for hot contexts
    this.memoryCache = new LRUCache<string, RetrievedContext[]>({
      max: 100, // Max 100 entries
      ttl: 60000, // 1 minute TTL
    });
  }

  async retrieve(/* ... */): Promise<RetrievedContext[]> {
    // L1: Memory cache (< 1ms)
    const memoryCached = this.memoryCache.get(cacheKey);
    if (memoryCached) return memoryCached;

    // L2: Redis cache (< 10ms)
    const redisCached = await this.getCachedFromRedis(cacheKey);
    if (redisCached) {
      this.memoryCache.set(cacheKey, redisCached);
      return redisCached;
    }

    // L3: Database + vector search (< 500ms)
    const contexts = await this.retrieveFromDatabase(/* ... */);

    // Cache at all levels
    this.memoryCache.set(cacheKey, contexts);
    await this.cacheInRedis(cacheKey, contexts);

    return contexts;
  }
}
```

### Prompt Analysis Cache

**Aggressive Caching:**

```typescript
// packages/prompt-analyzer/src/analyzer/prompt-analyzer.ts
async analyze(prompt: RawPrompt): Promise<AnalyzedPrompt> {
  // Cache key based on prompt hash
  const cacheKey = `analysis:${this.hashPrompt(prompt.text)}`;

  // Check cache (Redis)
  const cached = await this.cache.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Analyze
  const analyzed = await this.performAnalysis(prompt);

  // Cache for 1 hour (analysis rarely changes)
  await this.cache.setex(cacheKey, 3600, JSON.stringify(analyzed));

  return analyzed;
}
```

---

## Code Optimization

### Async/Await Patterns

**Parallel Operations:**

```typescript
// Before: Sequential (slow)
const intent = await classifyIntent(prompt);
const taskType = await identifyTaskType(prompt);
const entities = await extractEntities(prompt);

// After: Parallel (3x faster)
const [intent, taskType, entities] = await Promise.all([
  classifyIntent(prompt),
  identifyTaskType(prompt),
  extractEntities(prompt),
]);
```

**Batch Processing:**

```typescript
// Before: Loop with await (N * latency)
const embeddings = [];
for (const text of texts) {
  embeddings.push(await generateEmbedding(text));
}

// After: Batch processing (latency / batch_size)
const embeddings = await generateEmbeddingsBatch(texts, { batchSize: 32 });
```

### Lazy Loading

```typescript
// Before: Load all context upfront
const allContexts = await contextStorage.getByWorkspace(workspaceId);
const filtered = allContexts.filter((c) => c.tier === tier);

// After: Load only what's needed
const contexts = await contextStorage.getByWorkspace(workspaceId, { tier });
```

### Stream Processing

```typescript
// Before: Load all into memory
const allData = await collection.find().toArray();
const processed = allData.map(process);

// After: Stream processing
const cursor = collection.find();
for await (const doc of cursor) {
  await process(doc); // Process one at a time
}
```

### Token Estimation Optimization

```typescript
// Before: Character-based estimation (fast but inaccurate)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// After: Use tiktoken for accurate counting
import { encoding_for_model } from 'tiktoken';

class TokenCounter {
  private encoder = encoding_for_model('gpt-4');

  estimateTokens(text: string): number {
    return this.encoder.encode(text).length;
  }
}

// Cache encoder to avoid re-initialization
```

---

## Load Testing

### Test Scenarios

**1. Health Check (Baseline):**

```bash
autocannon -c 50 -d 60 http://localhost:3000/health

# Expected:
# - p95 latency < 50ms
# - Throughput > 100 req/s
# - Error rate = 0%
```

**2. Simple Prompt (Light Load):**

```bash
autocannon -c 10 -d 60 -m POST \
  -H "Content-Type: application/json" \
  -b '{"prompt":"Hello","workspaceId":"test","source":"api"}' \
  http://localhost:3000/api/v1/prompts/process

# Expected:
# - p95 latency < 2s
# - Throughput > 10 req/s
# - Error rate < 1%
```

**3. Complex Prompt (Heavy Load):**

```bash
autocannon -c 5 -d 120 -m POST \
  -H "Content-Type: application/json" \
  -b '{"prompt":"Analyze this TypeScript codebase and suggest improvements to the architecture","workspaceId":"test","source":"api"}' \
  http://localhost:3000/api/v1/prompts/process

# Expected:
# - p95 latency < 5s
# - Throughput > 5 req/s
# - Error rate < 2%
```

**4. Sustained Load (Endurance):**

```bash
# Run for 30 minutes
autocannon -c 10 -d 1800 -m POST \
  -H "Content-Type: application/json" \
  -b '{"prompt":"test","workspaceId":"test","source":"api"}' \
  http://localhost:3000/api/v1/prompts/process

# Monitor:
# - Memory growth (should be flat)
# - Latency drift (should be stable)
# - Error rate (should stay < 1%)
```

**5. Spike Test (Burst):**

```bash
# Sudden spike from 5 to 50 users
k6 run scripts/spike-test.js
```

```javascript
// scripts/spike-test.js
export const options = {
  stages: [
    { duration: '30s', target: 5 }, // Normal load
    { duration: '10s', target: 50 }, // Spike!
    { duration: '1m', target: 50 }, // Sustain spike
    { duration: '30s', target: 5 }, // Return to normal
  ],
};
```

### Load Test Analysis

**Interpret Results:**

```
Latency Distribution:
  10%: 500ms  ✅ Good
  25%: 750ms  ✅ Good
  50%: 1000ms ✅ Good
  75%: 1500ms ✅ Good
  90%: 2000ms ✅ Good
  95%: 2500ms ⚠️  Near threshold
  99%: 4000ms ⚠️  Near threshold

Throughput: 12 req/s ✅ Above target (10 req/s)
Error Rate: 0.5% ✅ Below threshold (1%)
```

**Common Issues:**

| Symptom          | Cause                 | Solution                       |
| ---------------- | --------------------- | ------------------------------ |
| High p95 latency | Database slow queries | Add indexes, optimize queries  |
| High p99 latency | Occasional timeouts   | Increase timeouts, add retries |
| Low throughput   | CPU bottleneck        | Optimize hot functions         |
| Memory growth    | Memory leak           | Profile heap, fix leaks        |
| High error rate  | Service unavailable   | Add circuit breakers, retries  |

---

## Performance Monitoring

### Application Performance Monitoring (APM)

**Recommended Tools:**

1. **Prometheus + Grafana** (Open Source)
2. **New Relic** (Commercial)
3. **Datadog** (Commercial)
4. **Elastic APM** (Open Source/Commercial)

**Implementation Guide:** See [Monitoring Setup Guide](./monitoring-setup.md) (Phase 11.4)

### Custom Metrics

**Add to API:**

```typescript
// packages/middleware/src/orchestrator/prompt-orchestrator.ts
export class PromptOrchestrator {
  private metrics = {
    requestCount: 0,
    totalLatency: 0,
    errorCount: 0,
    stageLatencies: {
      collection: [] as number[],
      analysis: [] as number[],
      retrieval: [] as number[],
      synthesis: [] as number[],
      injection: [] as number[],
      llm: [] as number[],
      postProcessing: [] as number[],
    },
  };

  async processPrompt(/* ... */): Promise<OrchestrationResult> {
    const startTime = Date.now();
    this.metrics.requestCount++;

    try {
      // ... process request ...

      const totalLatency = Date.now() - startTime;
      this.metrics.totalLatency += totalLatency;

      // Log metrics
      logger.info('Request completed', {
        latency: totalLatency,
        stages: result.metadata.latency,
      });
    } catch (error) {
      this.metrics.errorCount++;
      throw error;
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      avgLatency: this.metrics.totalLatency / this.metrics.requestCount,
      errorRate: this.metrics.errorCount / this.metrics.requestCount,
    };
  }
}
```

**Expose Metrics Endpoint:**

```typescript
// apps/api/src/routes/metrics.ts
import { Router } from 'express';

export const metricsRouter = Router();

metricsRouter.get('/metrics', (req, res) => {
  const metrics = orchestrator.getMetrics();
  res.json(metrics);
});

// Format for Prometheus
metricsRouter.get('/metrics/prometheus', (req, res) => {
  const metrics = orchestrator.getMetrics();
  res.set('Content-Type', 'text/plain');
  res.send(
    `
# HELP axon_requests_total Total number of requests
# TYPE axon_requests_total counter
axon_requests_total ${metrics.requestCount}

# HELP axon_request_duration_seconds Request duration in seconds
# TYPE axon_request_duration_seconds histogram
axon_request_duration_seconds_sum ${metrics.totalLatency / 1000}
axon_request_duration_seconds_count ${metrics.requestCount}

# HELP axon_errors_total Total number of errors
# TYPE axon_errors_total counter
axon_errors_total ${metrics.errorCount}
  `.trim()
  );
});
```

---

## Performance Optimization Checklist

### Quick Wins (1-2 hours)

- [ ] Add missing database indexes
- [ ] Enable Redis caching for embeddings
- [ ] Implement parallel async operations
- [ ] Add connection pooling to databases
- [ ] Use projections in MongoDB queries

### Medium Effort (1 day)

- [ ] Implement multi-level caching
- [ ] Optimize vector search parameters
- [ ] Batch database operations
- [ ] Add memory LRU cache
- [ ] Optimize token counting

### Long-term (1 week)

- [ ] Set up APM monitoring
- [ ] Implement request tracing
- [ ] Create performance dashboard
- [ ] Regular load testing
- [ ] Continuous profiling

---

## Measuring Success

**Before & After Comparison:**

| Metric         | Before  | After    | Improvement |
| -------------- | ------- | -------- | ----------- |
| p95 Latency    | 4.5s    | 2.5s     | 44% ↓       |
| Throughput     | 8 req/s | 15 req/s | 87% ↑       |
| Memory Usage   | 3GB     | 1.5GB    | 50% ↓       |
| Cache Hit Rate | 45%     | 85%      | 89% ↑       |
| Error Rate     | 2%      | 0.5%     | 75% ↓       |

**Document Results:**

```markdown
## Performance Optimization Results

**Date**: 2025-11-07
**Version**: v1.1.0

### Changes Made

1. Added compound indexes to MongoDB
2. Implemented Redis caching for embeddings
3. Parallelized prompt analysis
4. Optimized vector search parameters

### Results

- Latency: 4.5s → 2.5s (44% improvement)
- Throughput: 8 → 15 req/s (87% improvement)
- Memory: 3GB → 1.5GB (50% improvement)

### Next Steps

- Implement APM monitoring
- Set up performance alerts
- Regular load testing (weekly)
```

---

**Document Version**: 1.0
**Last Updated**: 2025-11-07
**Next Review**: 2025-12-07
