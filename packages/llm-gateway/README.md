# @axon/llm-gateway

LLM Gateway Service - Abstraction layer for multiple LLM providers with streaming support, retry logic, rate limiting, and circuit breaker patterns.

## Features

- ✅ **Multi-Provider Support**: OpenAI (implemented), Anthropic (planned), Ollama (planned)
- ✅ **Streaming Support**: AsyncGenerator-based streaming for real-time responses
- ✅ **Retry Logic**: Exponential backoff with configurable retry strategies
- ✅ **Rate Limiting**: Token bucket algorithm for requests and tokens
- ✅ **Circuit Breaker**: Automatic failure detection and recovery
- ✅ **Error Handling**: Comprehensive error categorization and handling
- ✅ **Metrics Collection**: Track requests, tokens, latency, errors
- ✅ **Type Safety**: Full TypeScript support with strict typing

## Installation

```bash
pnpm add @axon/llm-gateway
```

## Usage

### Basic Setup

```typescript
import { LLMGatewayService, createDefaultConfig, LLMProvider, LLMModel, MessageRole } from '@axon/llm-gateway';

// Create configuration
const config = createDefaultConfig(
  LLMProvider.OPENAI,
  process.env.OPENAI_API_KEY!,
  {
    defaultModel: LLMModel.GPT_4O,
    timeout: 60000,
    rateLimit: {
      requestsPerMinute: 60,
      tokensPerMinute: 90000,
      enabled: true,
    },
    circuitBreaker: {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000,
      enabled: true,
    },
    retry: {
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 60000,
      backoffMultiplier: 2,
    },
  }
);

// Initialize service
const llmGateway = new LLMGatewayService(config);

// Validate configuration
await llmGateway.validateConfig();
```

### Non-Streaming Completion

```typescript
const response = await llmGateway.complete({
  messages: [
    {
      role: MessageRole.SYSTEM,
      content: 'You are a helpful assistant.',
    },
    {
      role: MessageRole.USER,
      content: 'What is TypeScript?',
    },
  ],
  model: LLMModel.GPT_4O,
  temperature: 0.7,
  maxTokens: 1000,
});

console.log(response.content);
console.log('Tokens used:', response.usage.totalTokens);
```

### Streaming Completion

```typescript
const stream = llmGateway.completeStream({
  messages: [
    {
      role: MessageRole.USER,
      content: 'Write a short story about a robot.',
    },
  ],
  model: LLMModel.GPT_4O,
  temperature: 0.8,
  maxTokens: 500,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.delta);
  
  if (chunk.finishReason) {
    console.log('\nFinish reason:', chunk.finishReason);
  }
}
```

### Error Handling

```typescript
import { LLMError, LLMErrorType } from '@axon/llm-gateway';

try {
  const response = await llmGateway.complete({
    messages: [{ role: MessageRole.USER, content: 'Hello' }],
    model: LLMModel.GPT_4,
  });
} catch (error) {
  if (error instanceof LLMError) {
    switch (error.type) {
      case LLMErrorType.RATE_LIMIT:
        console.error('Rate limit exceeded, please wait');
        break;
      case LLMErrorType.AUTHENTICATION:
        console.error('Invalid API key');
        break;
      case LLMErrorType.CIRCUIT_OPEN:
        console.error('Circuit breaker is open, service temporarily unavailable');
        break;
      default:
        console.error('LLM error:', error.message);
    }
  }
}
```

### Metrics

```typescript
// Get metrics
const metrics = llmGateway.getMetrics();
console.log({
  totalRequests: metrics.totalRequests,
  successRate: metrics.successfulRequests / metrics.totalRequests,
  averageLatency: metrics.averageLatencyMs,
  totalTokens: metrics.totalTokens,
  cacheHitRate: metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses),
});

// Reset metrics
llmGateway.resetMetrics();
```

### Health Check

```typescript
const isHealthy = await llmGateway.healthCheck();
console.log('LLM Gateway is', isHealthy ? 'healthy' : 'unhealthy');

// Get circuit breaker state
const cbState = llmGateway.getCircuitBreakerState();
console.log('Circuit breaker state:', cbState); // CLOSED | OPEN | HALF_OPEN
```

## Configuration

### Provider Configuration

```typescript
interface ProviderConfig {
  provider: LLMProvider;        // Provider type
  apiKey: string;               // API key
  baseUrl?: string;             // Custom API endpoint
  organization?: string;        // OpenAI organization
  timeout?: number;             // Request timeout (ms)
  defaultModel?: LLMModel;      // Default model
}
```

### Rate Limiting

```typescript
interface RateLimitConfig {
  requestsPerMinute: number;    // Max requests per minute
  tokensPerMinute: number;      // Max tokens per minute
  enabled: boolean;             // Enable/disable
}
```

### Circuit Breaker

```typescript
interface CircuitBreakerConfig {
  failureThreshold: number;     // Failures before opening
  successThreshold: number;     // Successes to close from half-open
  timeout: number;              // Time before retry (ms)
  enabled: boolean;             // Enable/disable
}
```

### Retry Configuration

```typescript
interface RetryConfig {
  maxRetries: number;           // Max retry attempts
  initialDelayMs: number;       // Initial retry delay
  maxDelayMs: number;           // Max retry delay
  backoffMultiplier: number;    // Exponential backoff multiplier
  retryableErrors: string[];    // Error types to retry
}
```

## Supported Models

### OpenAI
- `gpt-4`
- `gpt-4-turbo-preview`
- `gpt-4o`
- `gpt-3.5-turbo`

### Anthropic (Planned)
- `claude-3-opus-20240229`
- `claude-3-sonnet-20240229`
- `claude-3-haiku-20240307`

### Ollama (Planned)
- `llama3`

## Architecture

```
┌─────────────────────────────────────────────────┐
│           LLMGatewayService                     │
├─────────────────────────────────────────────────┤
│  • Rate Limiting (Token Bucket)                 │
│  • Circuit Breaker (State Machine)              │
│  • Metrics Collection                           │
│  • Provider Abstraction                         │
└─────────────────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────┐
│            ILLMProvider Interface                │
├─────────────────────────────────────────────────┤
│  • complete()                                    │
│  • completeStream()                              │
│  • healthCheck()                                 │
│  • validateConfig()                              │
└─────────────────────────────────────────────────┘
                      ▼
┌──────────────┬──────────────┬──────────────────┐
│   OpenAI     │  Anthropic   │     Ollama       │
│  Provider    │  Provider    │    Provider      │
│ (Implemented)│  (Planned)   │   (Planned)      │
└──────────────┴──────────────┴──────────────────┘
```

## Error Types

- `RATE_LIMIT`: Rate limit exceeded (retryable)
- `AUTHENTICATION`: Invalid API key
- `INVALID_REQUEST`: Malformed request
- `SERVER_ERROR`: Provider server error (retryable)
- `TIMEOUT`: Request timeout (retryable)
- `NETWORK`: Network connectivity error (retryable)
- `CIRCUIT_OPEN`: Circuit breaker is open
- `UNKNOWN`: Unknown error

## Best Practices

1. **Always handle errors**: Use try-catch blocks and check error types
2. **Configure timeouts**: Set appropriate timeouts based on your use case
3. **Monitor metrics**: Track success rates, latency, and token usage
4. **Use streaming for long responses**: Improves perceived performance
5. **Enable circuit breaker**: Prevents cascade failures
6. **Set rate limits**: Avoid exceeding provider quotas
7. **Validate configuration**: Call `validateConfig()` on startup

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test

# Type check
pnpm type-check

# Lint
pnpm lint
```

## License

MIT
