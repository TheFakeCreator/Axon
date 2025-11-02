# @axon/middleware

Orchestration layer for the Axon context-aware AI system. Chains together prompt analysis, context retrieval, synthesis, injection, and LLM interaction into a complete intelligent pipeline.

## Overview

The middleware package implements the core orchestration logic that transforms user prompts into context-enriched LLM interactions. It manages the complete flow from request validation to response post-processing.

### Pipeline Stages

1. **Collection** - Validate and enrich incoming requests
2. **Analysis** - Classify intent and task type
3. **Retrieval** - Fetch relevant contexts from the context base
4. **Synthesis** - Format contexts within token budget
5. **Injection** - Construct final prompt with appropriate strategy
6. **LLM** - Generate response via LLM gateway
7. **Post-processing** - Extract actions and capture new knowledge

## Installation

```bash
pnpm add @axon/middleware
```

## Services

### PromptOrchestrator

Main orchestration service that coordinates all middleware components.

```typescript
import { PromptOrchestrator } from '@axon/middleware';
import { PromptAnalyzer } from '@axon/prompt-analyzer';
import { ContextRetriever, ContextStorage } from '@axon/context-engine';
import { LLMGatewayService } from '@axon/llm-gateway';

const orchestrator = new PromptOrchestrator({
  promptAnalyzer: new PromptAnalyzer(/* config */),
  contextRetriever: new ContextRetriever(/* config */),
  contextStorage: new ContextStorage(/* config */),
  llmGateway: new LLMGatewayService(/* config */),
  enableStreaming: true,
  tokenBudget: {
    total: 8192,
    responseReserve: 2048,
    contextBudget: 6144,
    allocation: {
      file: 2048,
      symbol: 1536,
      documentation: 1024,
      conversation: 768,
      error: 512,
      architecture: 256,
    },
  },
});

// Non-streaming
const result = await orchestrator.process({
  prompt: "Fix the bug in getUserProfile function",
  workspaceId: "workspace-uuid",
  userId: "user-uuid",
});

// Streaming
for await (const chunk of orchestrator.processStreaming(request)) {
  console.log(chunk.type, chunk.data);
}
```

### PromptCollector

Validates and enriches incoming requests.

```typescript
import { PromptCollector } from '@axon/middleware';

const collector = new PromptCollector({
  strictValidation: true,
  enableLogging: true,
  maxPromptLength: 10000,
});

const enriched = await collector.collect({
  prompt: "User's question",
  workspaceId: "workspace-uuid",
  metadata: {
    source: 'vscode',
    language: 'typescript',
    fileName: 'src/user.ts',
  },
});
```

### ContextSynthesizer

Formats contexts within token budget with task-specific allocation.

```typescript
import { ContextSynthesizer } from '@axon/middleware';
import { TaskCategory } from '@axon/shared';

const synthesizer = new ContextSynthesizer({
  enableCompression: true,
  compressionThreshold: 0.8,
});

const synthesized = await synthesizer.synthesize(
  scoredContexts,
  TaskCategory.BUG_FIX,
  customBudget
);
```

### PromptInjector

Injects contexts into prompts using various strategies.

```typescript
import { PromptInjector } from '@axon/middleware';

const injector = new PromptInjector({
  defaultStrategy: 'hybrid',
  maxTokens: 8192,
});

const constructed = await injector.inject(
  enrichedPrompt,
  synthesizedContext,
  TaskCategory.FEATURE_ADD
);
```

### ResponsePostProcessor

Extracts actions and captures new knowledge from responses.

```typescript
import { ResponsePostProcessor } from '@axon/middleware';

const postProcessor = new ResponsePostProcessor({
  enableQualityAssessment: true,
  enableActionExtraction: true,
  enableKnowledgeCapture: true,
  minActionConfidence: 0.6,
  minKnowledgeConfidence: 0.7,
}, contextStorage);

const processed = await postProcessor.process(
  llmResponse,
  enrichedPrompt,
  workspaceId
);
```

## Token Budget Management

The middleware intelligently allocates tokens based on task type:

### Budget Allocation by Task Type

| Task Type | File | Symbol | Docs | Conversation | Error | Architecture |
|-----------|------|--------|------|--------------|-------|--------------|
| Bug Fix | 1.2x | 1.0x | 0.7x | 1.0x | **1.5x** | 1.0x |
| Feature Add | 1.0x | 1.3x | 1.0x | 0.8x | 1.0x | **1.4x** |
| Documentation | 1.2x | 0.8x | **1.5x** | 1.0x | 1.0x | 1.0x |
| Refactor | 1.0x | 1.3x | 1.0x | 0.8x | 1.0x | 1.3x |
| Testing | 1.2x | 1.3x | 1.1x | 1.0x | 1.0x | 1.0x |

## Injection Strategies

### Prefix Strategy
All context in system prompt, user prompt contains only the question.
- **Best for**: General queries, documentation tasks, roadmaps
- **Pros**: Clean separation, LLM has full context upfront
- **Cons**: Can be verbose

### Inline Strategy
Context sections interleaved with user prompt.
- **Best for**: Code review, templating
- **Pros**: Context directly relates to specific parts of the request
- **Cons**: Can fragment the request

### Suffix Strategy
User prompt first, context at the end.
- **Best for**: Rare, mostly experimental
- **Pros**: User intent clear before context
- **Cons**: LLM may not integrate context well

### Hybrid Strategy (Default)
Critical context in system prompt, relevant snippets inline with user prompt.
- **Best for**: Bug fixes, feature additions, refactoring, optimization
- **Pros**: Balanced approach, flexible
- **Cons**: Slightly more complex

## Action Extraction

The post-processor automatically detects:

- **Code Changes** - Code blocks with file paths
- **File Operations** - Create, update, delete operations
- **Test Creation** - Test file generation
- **Documentation Updates** - Doc improvement suggestions

```typescript
const actions = processed.actions;
// [
//   {
//     type: 'code-change',
//     target: 'src/user.ts',
//     description: 'Code modification detected',
//     confidence: 0.8
//   },
//   {
//     type: 'test-create',
//     target: 'src/user.test.ts',
//     description: 'Test creation suggested',
//     confidence: 0.75
//   }
// ]
```

## Knowledge Capture

New knowledge is automatically extracted and categorized:

- **Pattern** - Coding patterns, best practices
- **Solution** - Bug fixes, implementations
- **Decision** - Architectural choices
- **Error Fix** - Error resolutions

```typescript
const knowledge = processed.newKnowledge;
// [
//   {
//     type: 'solution',
//     content: '...',
//     entities: ['getUserProfile', 'src/user.ts'],
//     confidence: 0.85
//   }
// ]
```

## Streaming Support

Stream orchestration progress in real-time:

```typescript
for await (const chunk of orchestrator.processStreaming(request)) {
  switch (chunk.type) {
    case 'analysis':
      console.log('Analyzing prompt...', chunk.data);
      break;
    case 'retrieval':
      console.log('Retrieved contexts:', chunk.data.contextsFound);
      break;
    case 'context':
      console.log('Synthesized sections:', chunk.data.sections);
      break;
    case 'llm-start':
      console.log('LLM processing started...');
      break;
    case 'llm-chunk':
      process.stdout.write(chunk.data.content);
      break;
    case 'llm-end':
      console.log('\\nLLM processing complete');
      break;
    case 'complete':
      console.log('Total latency:', chunk.data.totalLatencyMs, 'ms');
      break;
    case 'error':
      console.error('Error:', chunk.data.error);
      break;
  }
}
```

## Performance Metrics

The orchestrator tracks latency for each stage:

```typescript
const result = await orchestrator.process(request);
console.log(result.latencyBreakdown);
// {
//   collection: 5,
//   analysis: 120,
//   retrieval: 180,
//   synthesis: 45,
//   injection: 10,
//   llm: 2100,
//   postProcessing: 30
// }
```

**Target Latencies:**
- Collection: <10ms
- Analysis: <200ms
- Retrieval: <300ms
- Synthesis: <100ms
- Injection: <50ms
- LLM: 1-3s (varies by model)
- Post-processing: <100ms
- **Total: <3.5s**

## Error Handling

All services throw specific error types:

```typescript
import { ValidationError, TokenLimitError } from '@axon/middleware';

try {
  const result = await orchestrator.process(request);
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation failed:', error.errors);
  } else if (error instanceof TokenLimitError) {
    console.error('Token limit exceeded:', error.actualTokens, '/', error.maxTokens);
  } else {
    console.error('Orchestration error:', error.message);
  }
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PromptOrchestrator                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. PromptCollector                                         │
│     ├─ Validate request (Zod schema)                        │
│     ├─ Generate request ID                                  │
│     └─ Enrich metadata                                      │
│                                                             │
│  2. PromptAnalyzer (from @axon/prompt-analyzer)             │
│     ├─ Classify intent                                      │
│     ├─ Identify task type                                   │
│     └─ Extract entities                                     │
│                                                             │
│  3. ContextRetriever (from @axon/context-engine)            │
│     ├─ Semantic search                                      │
│     ├─ Graph traversal                                      │
│     └─ Score contexts                                       │
│                                                             │
│  4. ContextSynthesizer                                      │
│     ├─ Allocate token budget by task type                   │
│     ├─ Select contexts within budget                        │
│     ├─ Format for LLM (Markdown)                            │
│     └─ Compress if needed                                   │
│                                                             │
│  5. PromptInjector                                          │
│     ├─ Select injection strategy                            │
│     ├─ Build system prompt                                  │
│     ├─ Build user prompt                                    │
│     └─ Validate token limits                                │
│                                                             │
│  6. LLMGateway (from @axon/llm-gateway)                     │
│     ├─ Send to LLM (OpenAI/Anthropic)                       │
│     └─ Stream or wait for completion                        │
│                                                             │
│  7. ResponsePostProcessor                                   │
│     ├─ Assess quality                                       │
│     ├─ Extract actions                                      │
│     ├─ Capture new knowledge                                │
│     └─ Update context base                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Development

```bash
# Build
pnpm build

# Watch mode
pnpm dev

# Test
pnpm test

# Lint
pnpm lint
```

## Dependencies

- `@axon/shared` - Shared types and utilities
- `@axon/prompt-analyzer` - Prompt analysis service
- `@axon/context-engine` - Context retrieval and storage
- `@axon/llm-gateway` - LLM provider abstraction
- `zod` - Schema validation

## License

MIT
