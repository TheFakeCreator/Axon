# Axon API Gateway

The API Gateway provides a RESTful HTTP interface to all Axon services, enabling external clients to access context-aware prompt processing, workspace management, quality gate execution, and more.

## Overview

The API Gateway is the primary entry point for external interactions with Axon. It handles:

- **Request Authentication & Authorization** (future)
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Request Validation**: Zod-based schema validation
- **Logging**: Structured logging with Winston
- **Error Handling**: Centralized error handling with consistent JSON responses
- **Security**: Helmet.js security headers, CORS configuration
- **Streaming**: Server-Sent Events (SSE) for real-time LLM responses

## Architecture

```
External Clients
       ↓
  API Gateway (Express.js)
       ↓
  ├─ /api/v1/prompts → PromptOrchestrator → (Middleware, Context, LLM)
  ├─ /api/v1/workspaces → WorkspaceManager
  ├─ /api/v1/contexts → ContextStorage
  └─ /api/v1/quality-gate → QualityGateOrchestrator
```

## Getting Started

### Installation

```bash
# From the monorepo root
pnpm install

# Install API dependencies only
pnpm --filter @axon/api install
```

### Configuration

Create a `.env` file in `apps/api/`:

```env
# Server
NODE_ENV=development
PORT=3000

# Logging
LOG_LEVEL=info

# CORS
CORS_ORIGIN=*

# Future: Authentication, database, LLM API keys, etc.
```

### Development

```bash
# Run in development mode with hot reload
pnpm --filter @axon/api dev

# Build TypeScript
pnpm --filter @axon/api build

# Run production build
pnpm --filter @axon/api start

# Lint
pnpm --filter @axon/api lint
```

## API Endpoints

### Health Checks

#### `GET /health`
Basic health check with uptime and version information.

**Response:**
```json
{
  "status": "ok",
  "uptime": 123.456,
  "version": "0.1.0",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### `GET /health/ready`
Readiness probe - checks if all services are ready.

**Response:**
```json
{
  "status": "ready",
  "services": {
    "api": true,
    "middleware": true,
    "workspaceManager": true,
    "qualityGate": true
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### `GET /health/live`
Liveness probe - always returns true if server is running.

**Response:**
```json
{
  "status": "alive",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Prompts

#### `POST /api/v1/prompts/process`
Process a prompt with context injection and LLM integration.

**Request Body:**
```json
{
  "prompt": "How do I implement authentication in Express.js?",
  "workspaceId": "550e8400-e29b-41d4-a716-446655440000",
  "source": "api",
  "metadata": {
    "fileName": "server.ts",
    "language": "typescript",
    "cursorPosition": {
      "line": 42,
      "column": 10
    }
  },
  "stream": false
}
```

**Parameters:**
- `prompt` (string, required): The user's prompt/query
- `workspaceId` (string, required): UUID of the workspace
- `source` (enum, optional): Source of the request - `cli`, `api`, `editor`, `chat` (default: `api`)
- `metadata` (object, optional): Additional context
  - `fileName` (string): File being edited
  - `language` (string): Programming language
  - `cursorPosition` (object): Cursor location with `line` and `column`
- `stream` (boolean, optional): Enable streaming response via SSE (default: `false`)

**Response (Non-Streaming):**
```json
{
  "success": true,
  "data": {
    "requestId": "req-1234567890",
    "response": {
      "content": "Here's how to implement authentication in Express.js..."
    },
    "metadata": {
      "tokensUsed": 450,
      "latency": {
        "total": 1234
      }
    }
  }
}
```

**Response (Streaming):**
Server-Sent Events format:
```
data: {"type":"start","requestId":"req-1234567890"}

data: {"type":"content","content":"Here's how to"}

data: {"type":"content","content":" implement authentication"}

data: [DONE]
```

#### `GET /api/v1/prompts/history`
Retrieve prompt processing history for a workspace.

**Query Parameters:**
- `workspaceId` (string, optional): Filter by workspace
- `limit` (number, optional): Max results (default: 10)
- `offset` (number, optional): Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "interactions": [],
    "pagination": {
      "limit": 10,
      "offset": 0,
      "total": 0
    }
  }
}
```

### Workspaces

#### `POST /api/v1/workspaces`
Create a new workspace.

**Status:** 🚧 Placeholder (MVP)

#### `GET /api/v1/workspaces`
List all workspaces.

**Status:** 🚧 Placeholder (MVP)

#### `GET /api/v1/workspaces/:id`
Get workspace details.

**Status:** 🚧 Placeholder (MVP)

### Contexts

#### `POST /api/v1/contexts`
Add context to a workspace.

**Status:** 🚧 Placeholder (MVP)

#### `GET /api/v1/contexts`
List contexts in a workspace.

**Status:** 🚧 Placeholder (MVP)

#### `POST /api/v1/contexts/search`
Search for relevant contexts.

**Status:** 🚧 Placeholder (MVP)

### Quality Gate

#### `POST /api/v1/quality-gate/execute`
Execute quality checks (tests, linting, validation).

**Status:** 🚧 Placeholder (MVP)

#### `GET /api/v1/quality-gate/status/:id`
Get quality gate execution status.

**Status:** 🚧 Placeholder (MVP)

## Middleware Stack

The API applies middleware in the following order:

1. **Helmet** - Security headers (XSS, content type, HSTS, etc.)
2. **CORS** - Cross-origin resource sharing
3. **Morgan** - HTTP request logging (streams to Winston)
4. **Body Parser** - JSON and URL-encoded parsing (10MB limit)
5. **Rate Limiter** - 100 requests per 15 minutes per IP
6. **Routes** - Application routes
7. **404 Handler** - Catch undefined routes
8. **Error Handler** - Centralized error handling (must be last)

## Error Handling

All errors follow a consistent JSON format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Prompt cannot be empty",
    "statusCode": 400
  }
}
```

**Common Error Codes:**
- `400` - `VALIDATION_ERROR`: Invalid request data
- `404` - `NOT_FOUND`: Resource not found
- `429` - `RATE_LIMIT_EXCEEDED`: Too many requests
- `500` - `INTERNAL_ERROR`: Server error

## Logging

The API uses structured logging with Winston:

```typescript
logger.info('Processing prompt', {
  workspaceId: '550e8400-e29b-41d4-a716-446655440000',
  promptLength: 42,
  stream: false,
  source: 'api',
});
```

**Log Levels:**
- `error` - Errors and exceptions
- `warn` - Warnings and deprecations
- `info` - General information (default)
- `debug` - Detailed debugging information
- `verbose` - Very detailed logs

## Security

### Rate Limiting
- **Limit**: 100 requests per 15 minutes per IP
- **Headers**: Standard `RateLimit-*` headers included
- **Response**: 429 status when limit exceeded

### CORS
- **Default**: Allow all origins (`*`)
- **Production**: Configure `CORS_ORIGIN` environment variable
- **Credentials**: Enabled for authenticated requests

### Helmet.js
- **X-XSS-Protection**: Enabled
- **X-Content-Type-Options**: `nosniff`
- **X-Frame-Options**: `SAMEORIGIN`
- **HSTS**: Enabled (production)

### Request Size Limits
- **JSON**: 10MB maximum
- **URL-encoded**: 10MB maximum

## Streaming Responses

The API supports Server-Sent Events (SSE) for streaming LLM responses:

```typescript
// Client-side example (JavaScript)
const eventSource = new EventSource('/api/v1/prompts/process?stream=true');

eventSource.addEventListener('message', (event) => {
  if (event.data === '[DONE]') {
    eventSource.close();
    return;
  }
  
  const data = JSON.parse(event.data);
  if (data.type === 'content') {
    console.log(data.content);
  }
});
```

**Event Types:**
- `start` - Request started, includes `requestId`
- `content` - Chunk of generated content
- `error` - Error occurred during streaming
- `[DONE]` - Stream completed

## Graceful Shutdown

The API handles `SIGTERM` and `SIGINT` signals for graceful shutdown:

1. Stop accepting new connections
2. Complete in-flight requests
3. Close database connections
4. Exit with code 0

## Development Workflow

### Adding a New Endpoint

1. **Create route handler** in `src/routes/`:
   ```typescript
   import { Router } from 'express';
   
   const router: Router = Router();
   
   router.get('/example', async (req, res) => {
     res.json({ success: true, data: 'Example' });
   });
   
   export { router as exampleRouter };
   ```

2. **Mount route** in `src/server.ts`:
   ```typescript
   import { exampleRouter } from './routes/example.js';
   app.use('/api/v1/example', exampleRouter);
   ```

3. **Add validation** using Zod:
   ```typescript
   import { z } from 'zod';
   
   const schema = z.object({
     field: z.string().min(1),
   });
   
   const validated = schema.parse(req.body);
   ```

4. **Handle errors** using `AppError`:
   ```typescript
   import { AppError } from '../middleware/error-handler.js';
   
   if (!resource) {
     throw new AppError(404, 'Resource not found', 'NOT_FOUND');
   }
   ```

5. **Log activity**:
   ```typescript
   import { logger } from '../utils/logger.js';
   
   logger.info('Action performed', { userId, resourceId });
   ```

## Testing

```bash
# Unit tests (future)
pnpm --filter @axon/api test

# Integration tests (future)
pnpm --filter @axon/api test:integration

# E2E tests (future)
pnpm --filter @axon/api test:e2e
```

## Deployment

### Docker (Future)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

### Environment Variables (Production)

```env
NODE_ENV=production
PORT=3000
LOG_LEVEL=warn
CORS_ORIGIN=https://yourdomain.com
# Add database, LLM API keys, etc.
```

## Monitoring

### Health Checks
- **Kubernetes Readiness**: `GET /health/ready`
- **Kubernetes Liveness**: `GET /health/live`

### Metrics (Future)
- Prometheus endpoint: `GET /metrics`
- Grafana dashboards
- Request latency
- Error rates
- Token usage

## Future Enhancements

- [ ] Authentication (JWT-based)
- [ ] WebSocket support for real-time updates
- [ ] GraphQL endpoint (alternative to REST)
- [ ] API versioning (v1, v2)
- [ ] Request/response caching
- [ ] Comprehensive test suite
- [ ] OpenAPI/Swagger documentation
- [ ] Metrics and observability
- [ ] Multi-tenancy support
- [ ] Advanced rate limiting (per user, per endpoint)

## Troubleshooting

### Port Already in Use
```bash
# Find process using port 3000
netstat -ano | findstr :3000

# Kill process (Windows)
taskkill /PID <PID> /F
```

### TypeScript Build Errors
```bash
# Clean build
rm -rf dist
pnpm build
```

### Rate Limit Issues
```bash
# Clear Redis cache (if using Redis for rate limiting)
# Or restart server to reset in-memory rate limits
```

## Contributing

1. Follow the coding standards in `.copilot-instructions.md`
2. Add tests for new endpoints
3. Update this README with new routes
4. Ensure linting passes: `pnpm lint`
5. Build successfully: `pnpm build`

## License

MIT

---

**Axon API Gateway** - Context-aware AI assistance, accessible via HTTP.
