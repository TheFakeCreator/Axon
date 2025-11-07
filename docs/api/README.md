# Axon API Documentation

Complete API reference for the Axon Context Management System.

## Overview

Axon exposes a RESTful API for processing prompts with intelligent context enrichment, managing workspaces, and executing quality gates. The API is designed to be simple, predictable, and easy to integrate into various development tools.

## Table of Contents

- [Base URL](#base-url)
- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [Endpoints](#endpoints)
  - [Health Checks](#health-checks)
  - [Prompt Processing](#prompt-processing)
  - [Workspace Management](#workspace-management)
  - [Context Management](#context-management)
  - [Quality Gate](#quality-gate)
- [Streaming Responses](#streaming-responses)
- [Code Examples](#code-examples)
- [OpenAPI Specification](#openapi-specification)

---

## Base URL

**Development**: `http://localhost:3000/api/v1`  
**Production**: `https://api.axon.dev/api/v1` (future)

All endpoints are prefixed with `/api/v1` for versioning.

---

## Authentication

**MVP Status**: Authentication is **not implemented** in the current MVP.

**Future**: API key authentication will be required via the `X-API-Key` header:

```bash
curl -H "X-API-Key: your-api-key-here" \
  http://localhost:3000/api/v1/prompts/process
```

---

## Rate Limiting

**Current Limits** (per IP address):

- **100 requests per 15 minutes** across all endpoints
- Rate limit headers included in responses:
  - `X-RateLimit-Limit`: Total allowed requests
  - `X-RateLimit-Remaining`: Remaining requests in window
  - `X-RateLimit-Reset`: Time when limit resets (Unix timestamp)

**Response when rate limited**:

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please try again later.",
  "statusCode": 429
}
```

---

## Response Format

### Success Response

All successful responses follow this structure:

```json
{
  "data": {
    /* response data */
  },
  "meta": {
    /* optional metadata */
  }
}
```

For simple responses, the data may be returned directly without wrapping.

### Timestamps

All timestamps are in **ISO 8601 format** (UTC):

```json
"timestamp": "2025-11-07T10:30:00.000Z"
```

---

## Error Handling

### Error Response Format

```json
{
  "error": "Error Type",
  "message": "Human-readable error description",
  "statusCode": 400,
  "details": {
    "field": "prompt",
    "constraint": "minLength"
  },
  "timestamp": "2025-11-07T10:30:00.000Z"
}
```

### HTTP Status Codes

| Code | Meaning               | Description                              |
| ---- | --------------------- | ---------------------------------------- |
| 200  | OK                    | Request successful                       |
| 201  | Created               | Resource created successfully            |
| 204  | No Content            | Request successful, no content to return |
| 400  | Bad Request           | Invalid request parameters               |
| 401  | Unauthorized          | Authentication required                  |
| 403  | Forbidden             | Insufficient permissions                 |
| 404  | Not Found             | Resource not found                       |
| 429  | Too Many Requests     | Rate limit exceeded                      |
| 500  | Internal Server Error | Server-side error                        |
| 503  | Service Unavailable   | Service temporarily unavailable          |

### Common Error Types

- **Validation Error**: Invalid request parameters
- **Not Found**: Resource doesn't exist
- **Internal Server Error**: Unexpected server error
- **Service Unavailable**: Dependency (LLM, database) unavailable
- **Token Limit Error**: Prompt exceeds token budget
- **Timeout Error**: Operation took too long

---

## Endpoints

### Health Checks

#### Basic Health Check

Check if the API is running.

**Endpoint**: `GET /health`

**Response**:

```json
{
  "status": "ok",
  "timestamp": "2025-11-07T10:30:00.000Z"
}
```

**Example**:

```bash
curl http://localhost:3000/api/v1/health
```

---

#### Readiness Probe

Check if the API is ready to accept requests (all dependencies available).

**Endpoint**: `GET /health/ready`

**Response**:

```json
{
  "status": "ok",
  "services": {
    "mongodb": "up",
    "redis": "up",
    "qdrant": "up",
    "llm": "up"
  },
  "timestamp": "2025-11-07T10:30:00.000Z"
}
```

**Example**:

```bash
curl http://localhost:3000/api/v1/health/ready
```

---

#### Liveness Probe

Check if the API is alive and functioning.

**Endpoint**: `GET /health/live`

**Response**: Same as readiness probe

**Example**:

```bash
curl http://localhost:3000/api/v1/health/live
```

---

### Prompt Processing

#### Process Prompt (Non-Streaming)

Process a user prompt with context enrichment and return the complete response.

**Endpoint**: `POST /prompts/process`

**Request Body**:

```json
{
  "prompt": "How do I implement a binary search tree in TypeScript?",
  "workspaceId": "ws_123abc",
  "source": "vscode",
  "metadata": {
    "fileName": "data-structures.ts",
    "language": "typescript",
    "cursorPosition": {
      "line": 42,
      "column": 10
    }
  },
  "stream": false
}
```

**Parameters**:

- `prompt` (string, required): User's prompt (1-10,000 characters)
- `workspaceId` (string, required): Workspace ID for context retrieval
- `source` (string, optional): Source of prompt (default: "api")
- `metadata` (object, optional): Additional context metadata
  - `fileName`: Current file name
  - `language`: Programming language
  - `cursorPosition`: Cursor location
  - `diagnostics`: Compiler/linter errors
- `stream` (boolean, optional): Enable streaming (default: false)

**Response** (200 OK):

```json
{
  "requestId": "req_1a2b3c4d",
  "prompt": "How do I implement a binary search tree in TypeScript?",
  "analysis": {
    "intent": "coding",
    "taskType": "general_query",
    "confidence": 0.92,
    "entities": [
      {
        "text": "binary search tree",
        "type": "concept",
        "confidence": 0.95
      },
      {
        "text": "TypeScript",
        "type": "technology",
        "confidence": 1.0
      }
    ],
    "isAmbiguous": false
  },
  "contexts": [
    {
      "id": "ctx_abc123",
      "type": "documentation",
      "summary": "TypeScript class syntax and generics",
      "relevanceScore": 0.89
    }
  ],
  "response": {
    "content": "Here's how to implement a binary search tree...",
    "qualityScore": 0.94,
    "actions": [
      {
        "type": "create",
        "target": "binary-search-tree.ts",
        "description": "Create new BST implementation file",
        "confidence": 0.87
      }
    ]
  },
  "latency": {
    "total": 2345,
    "collection": 8,
    "analysis": 145,
    "retrieval": 287,
    "synthesis": 76,
    "injection": 34,
    "llm": 1650,
    "postProcessing": 145
  }
}
```

**Example**:

```bash
curl -X POST http://localhost:3000/api/v1/prompts/process \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "How do I implement a binary search tree in TypeScript?",
    "workspaceId": "ws_123abc",
    "stream": false
  }'
```

**Error Responses**:

- `400`: Invalid request (missing prompt, invalid workspaceId)
- `500`: Internal error (processing failed)
- `503`: LLM service unavailable

---

#### Process Prompt (Streaming)

Process a prompt with real-time streaming using Server-Sent Events (SSE).

**Endpoint**: `POST /prompts/process` (with `stream: true`)

**Request Body**:

```json
{
  "prompt": "Explain the repository pattern with examples",
  "workspaceId": "ws_123abc",
  "stream": true
}
```

**Response**: `Content-Type: text/event-stream`

**SSE Event Types**:

1. **metadata** - Initial metadata and analysis

```
event: metadata
data: {"requestId":"req_123","analysis":{"intent":"coding","taskType":"general_query"}}
```

2. **chunk** - Text chunks from LLM

```
event: chunk
data: {"content":"Here's how to"}

event: chunk
data: {"content":" implement the"}

event: chunk
data: {"content":" repository pattern:"}
```

3. **done** - Completion with metrics

```
event: done
data: {"latency":{"total":2100},"qualityScore":0.92}
```

4. **error** - Error event

```
event: error
data: {"error":"LLM Service Error","message":"Connection timeout"}
```

**Example** (JavaScript):

```javascript
const eventSource = new EventSource('http://localhost:3000/api/v1/prompts/process', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'Explain the repository pattern',
    workspaceId: 'ws_123abc',
    stream: true,
  }),
});

eventSource.addEventListener('metadata', (e) => {
  const data = JSON.parse(e.data);
  console.log('Analysis:', data.analysis);
});

eventSource.addEventListener('chunk', (e) => {
  const data = JSON.parse(e.data);
  process.stdout.write(data.content);
});

eventSource.addEventListener('done', (e) => {
  const data = JSON.parse(e.data);
  console.log('\nCompleted in', data.latency.total, 'ms');
  eventSource.close();
});

eventSource.addEventListener('error', (e) => {
  const data = JSON.parse(e.data);
  console.error('Error:', data.message);
  eventSource.close();
});
```

See [Streaming Responses](#streaming-responses) for more details.

---

#### Get Prompt History

Retrieve history of processed prompts (MVP placeholder).

**Endpoint**: `GET /prompts/history`

**Query Parameters**:

- `workspaceId` (string, optional): Filter by workspace
- `limit` (integer, optional): Max results (default: 50, max: 100)
- `offset` (integer, optional): Pagination offset (default: 0)

**Response** (200 OK):

```json
{
  "prompts": [],
  "total": 0,
  "limit": 50,
  "offset": 0
}
```

**Example**:

```bash
curl "http://localhost:3000/api/v1/prompts/history?workspaceId=ws_123&limit=20"
```

---

### Workspace Management

**Note**: Workspace endpoints are **placeholder implementations** in MVP. Full functionality will be available post-MVP.

#### List Workspaces

Get all registered workspaces.

**Endpoint**: `GET /workspaces`

**Response** (200 OK):

```json
{
  "workspaces": []
}
```

---

#### Create Workspace

Register a new workspace.

**Endpoint**: `POST /workspaces`

**Request Body**:

```json
{
  "name": "My TypeScript Project",
  "type": "coding",
  "path": "/Users/dev/projects/my-app",
  "config": {
    "techStack": ["TypeScript", "React", "Node.js"]
  }
}
```

**Parameters**:

- `name` (string, required): Workspace name (1-100 chars)
- `type` (string, required): Workspace type (`coding`, `pkm`, `root`)
- `path` (string, required): Absolute path to workspace directory
- `config` (object, optional): Workspace configuration

**Response** (201 Created):

```json
{
  "id": "ws_123abc",
  "name": "My TypeScript Project",
  "type": "coding",
  "path": "/Users/dev/projects/my-app",
  "config": {},
  "createdAt": "2025-11-07T10:30:00.000Z",
  "updatedAt": "2025-11-07T10:30:00.000Z"
}
```

---

#### Get Workspace

Get detailed workspace information.

**Endpoint**: `GET /workspaces/{id}`

**Response** (200 OK): Workspace object

---

#### Update Workspace

Update workspace configuration.

**Endpoint**: `PUT /workspaces/{id}`

**Request Body**:

```json
{
  "name": "Updated Name",
  "config": {
    "techStack": ["TypeScript", "Vue"]
  }
}
```

**Response** (200 OK): Updated workspace object

---

#### Delete Workspace

Delete a workspace and all associated contexts.

**Endpoint**: `DELETE /workspaces/{id}`

**Response** (204 No Content)

---

#### Scan Workspace

Initiate workspace scanning to extract and index contexts.

**Endpoint**: `POST /workspaces/{id}/scan`

**Response** (202 Accepted):

```json
{
  "message": "Workspace scan initiated",
  "scanId": "scan_xyz789"
}
```

---

### Context Management

**Note**: Context endpoints are **placeholder implementations** in MVP.

#### List Contexts

Get contexts with optional filtering.

**Endpoint**: `GET /contexts`

**Query Parameters**:

- `workspaceId` (string, optional): Filter by workspace
- `tier` (string, optional): Filter by tier (`workspace`, `hybrid`, `global`)
- `type` (string, optional): Filter by type (`file`, `symbol`, `documentation`, etc.)
- `limit` (integer, optional): Max results (default: 50, max: 100)
- `offset` (integer, optional): Pagination offset (default: 0)

**Response** (200 OK):

```json
{
  "contexts": [],
  "total": 0,
  "limit": 50,
  "offset": 0
}
```

---

#### Create Context

Manually create a context entry.

**Endpoint**: `POST /contexts`

**Request Body**:

```json
{
  "workspaceId": "ws_123abc",
  "tier": "workspace",
  "type": "file",
  "content": "// File content...",
  "summary": "User service implementation",
  "metadata": {
    "source": "user-service.ts",
    "language": "typescript"
  }
}
```

**Response** (201 Created): Context object

---

#### Get Context

Get detailed context information.

**Endpoint**: `GET /contexts/{id}`

**Response** (200 OK): Context object

---

#### Update Context

Update an existing context.

**Endpoint**: `PUT /contexts/{id}`

**Request Body**: Partial context object

**Response** (200 OK): Updated context object

---

#### Delete Context

Delete a context entry.

**Endpoint**: `DELETE /contexts/{id}`

**Response** (204 No Content)

---

#### Search Contexts

Perform semantic search across contexts.

**Endpoint**: `POST /contexts/search`

**Request Body**:

```json
{
  "query": "authentication middleware",
  "workspaceId": "ws_123abc",
  "tier": "workspace",
  "limit": 10
}
```

**Parameters**:

- `query` (string, required): Search query
- `workspaceId` (string, optional): Limit to workspace
- `tier` (string, optional): Limit to tier
- `type` (string, optional): Limit to type
- `limit` (integer, optional): Max results (default: 10, max: 50)

**Response** (200 OK):

```json
{
  "contexts": [],
  "total": 0
}
```

---

### Quality Gate

#### Execute Quality Gate

Run quality assurance checks on a project.

**Endpoint**: `POST /quality-gate/execute`

**Request Body**:

```json
{
  "projectPath": "/path/to/project",
  "checks": {
    "runTests": true,
    "runLinting": true,
    "runTypeCheck": true
  },
  "config": {
    "testFramework": "vitest",
    "linter": "eslint",
    "customChecks": [
      {
        "name": "Security Audit",
        "command": "npm audit --audit-level=moderate",
        "weight": 0.1
      }
    ]
  }
}
```

**Parameters**:

- `projectPath` (string, required): Absolute path to project
- `checks` (object, optional): Which checks to run
  - `runTests` (boolean, default: true)
  - `runLinting` (boolean, default: true)
  - `runTypeCheck` (boolean, default: true)
- `config` (object, optional): Check configuration
  - `testFramework`: Test framework to use (`jest`, `vitest`, `mocha`, `ava`, `tap`, `auto`)
  - `testCommand`: Custom test command
  - `testTimeout`: Test timeout (ms, default: 60000)
  - `linter`: Linter to use (`eslint`, `tslint`, `biome`, `oxlint`, `auto`)
  - `lintCommand`: Custom lint command
  - `typeCheckCommand`: Type check command (default: "tsc --noEmit")
  - `customChecks`: Array of custom checks

**Response** (200 OK):

```json
{
  "passed": true,
  "score": 87.5,
  "results": {
    "testing": {
      "passed": true,
      "score": 90,
      "summary": "32 tests passed, 0 failed",
      "details": {
        "totalTests": 32,
        "passedTests": 32,
        "failedTests": 0,
        "skippedTests": 0,
        "coverage": 87.3
      }
    },
    "linting": {
      "passed": true,
      "score": 85,
      "summary": "3 warnings found",
      "details": {
        "errors": 0,
        "warnings": 3,
        "info": 1
      }
    },
    "typeCheck": {
      "passed": true,
      "score": 100,
      "summary": "No type errors found"
    },
    "custom": []
  },
  "executionTime": 12450
}
```

**Scoring**:

- **Overall Score**: Weighted average (0-100)
  - Testing: 40% weight
  - Linting: 30% weight
  - Type Checking: 20% weight
  - Custom: 10% weight (distributed)

**Example**:

```bash
curl -X POST http://localhost:3000/api/v1/quality-gate/execute \
  -H "Content-Type: application/json" \
  -d '{
    "projectPath": "/path/to/project",
    "checks": {
      "runTests": true,
      "runLinting": true,
      "runTypeCheck": true
    }
  }'
```

---

#### Get Quality Gate Status

Get status of async quality gate execution (placeholder for future).

**Endpoint**: `GET /quality-gate/status/{id}`

**Response** (200 OK):

```json
{
  "id": "exec_abc123",
  "status": "completed",
  "result": {
    /* QualityGateResponse */
  }
}
```

---

## Streaming Responses

Axon supports **Server-Sent Events (SSE)** for real-time streaming of LLM responses.

### How It Works

1. Send a POST request to `/prompts/process` with `stream: true`
2. Response uses `Content-Type: text/event-stream`
3. Events are sent as they occur during processing
4. Client listens for different event types

### Event Format

```
event: <event-type>
data: <json-payload>

```

### Event Types

| Event      | Description                   | Payload                     |
| ---------- | ----------------------------- | --------------------------- |
| `metadata` | Initial metadata and analysis | `{ requestId, analysis }`   |
| `chunk`    | Text chunk from LLM           | `{ content }`               |
| `done`     | Processing complete           | `{ latency, qualityScore }` |
| `error`    | Error occurred                | `{ error, message }`        |

### Client Examples

#### JavaScript (Browser)

```javascript
const response = await fetch('http://localhost:3000/api/v1/prompts/process', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'Explain async/await',
    workspaceId: 'ws_123',
    stream: true,
  }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { value, done } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      console.log(data);
    }
  }
}
```

#### Node.js

```javascript
const EventSource = require('eventsource');

const es = new EventSource('http://localhost:3000/api/v1/prompts/process', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'Explain async/await',
    workspaceId: 'ws_123',
    stream: true,
  }),
});

es.addEventListener('chunk', (e) => {
  const data = JSON.parse(e.data);
  process.stdout.write(data.content);
});

es.addEventListener('done', (e) => {
  const data = JSON.parse(e.data);
  console.log('\nDone!');
  es.close();
});
```

#### cURL

```bash
curl -N -X POST http://localhost:3000/api/v1/prompts/process \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Explain async/await",
    "workspaceId": "ws_123",
    "stream": true
  }'
```

---

## Code Examples

### TypeScript/JavaScript

```typescript
import axios from 'axios';

const client = axios.create({
  baseURL: 'http://localhost:3000/api/v1',
  timeout: 30000,
});

// Process prompt (non-streaming)
async function processPrompt(prompt: string, workspaceId: string) {
  try {
    const response = await client.post('/prompts/process', {
      prompt,
      workspaceId,
      stream: false,
    });

    console.log('Response:', response.data.response.content);
    console.log('Quality Score:', response.data.response.qualityScore);
    console.log('Latency:', response.data.latency.total, 'ms');

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Error:', error.response?.data);
    }
    throw error;
  }
}

// Execute quality gate
async function runQualityGate(projectPath: string) {
  try {
    const response = await client.post('/quality-gate/execute', {
      projectPath,
      checks: {
        runTests: true,
        runLinting: true,
        runTypeCheck: true,
      },
    });

    console.log('Quality Score:', response.data.score);
    console.log('Passed:', response.data.passed);
    console.log('Results:', response.data.results);

    return response.data;
  } catch (error) {
    console.error('Quality gate failed:', error);
    throw error;
  }
}
```

### Python

```python
import requests
import json

BASE_URL = "http://localhost:3000/api/v1"

def process_prompt(prompt: str, workspace_id: str):
    """Process a prompt with context enrichment."""
    response = requests.post(
        f"{BASE_URL}/prompts/process",
        json={
            "prompt": prompt,
            "workspaceId": workspace_id,
            "stream": False
        },
        timeout=30
    )
    response.raise_for_status()

    data = response.json()
    print(f"Response: {data['response']['content']}")
    print(f"Quality Score: {data['response']['qualityScore']}")
    print(f"Latency: {data['latency']['total']}ms")

    return data

def execute_quality_gate(project_path: str):
    """Execute quality gate checks."""
    response = requests.post(
        f"{BASE_URL}/quality-gate/execute",
        json={
            "projectPath": project_path,
            "checks": {
                "runTests": True,
                "runLinting": True,
                "runTypeCheck": True
            }
        },
        timeout=60
    )
    response.raise_for_status()

    data = response.json()
    print(f"Quality Score: {data['score']}")
    print(f"Passed: {data['passed']}")

    return data

if __name__ == "__main__":
    # Example usage
    result = process_prompt(
        "How do I handle errors in async functions?",
        "ws_123abc"
    )
```

### Bash/cURL

```bash
#!/bin/bash

BASE_URL="http://localhost:3000/api/v1"

# Process prompt (non-streaming)
process_prompt() {
  local prompt="$1"
  local workspace_id="$2"

  curl -X POST "$BASE_URL/prompts/process" \
    -H "Content-Type: application/json" \
    -d "{
      \"prompt\": \"$prompt\",
      \"workspaceId\": \"$workspace_id\",
      \"stream\": false
    }" | jq '.'
}

# Execute quality gate
run_quality_gate() {
  local project_path="$1"

  curl -X POST "$BASE_URL/quality-gate/execute" \
    -H "Content-Type: application/json" \
    -d "{
      \"projectPath\": \"$project_path\",
      \"checks\": {
        \"runTests\": true,
        \"runLinting\": true,
        \"runTypeCheck\": true
      }
    }" | jq '.'
}

# Check health
health_check() {
  curl "$BASE_URL/health" | jq '.'
}

# Example usage
health_check
process_prompt "How do I use async/await?" "ws_123abc"
run_quality_gate "/path/to/project"
```

---

## OpenAPI Specification

The complete OpenAPI 3.0 specification is available at:

**File**: [`openapi.yaml`](./openapi.yaml)

### Viewing the Specification

#### Swagger UI (Local)

Coming soon: Swagger UI will be available at `http://localhost:3000/api-docs`

#### Swagger Editor

1. Go to [editor.swagger.io](https://editor.swagger.io/)
2. Click **File** → **Import File**
3. Select `openapi.yaml`

#### Redoc

```bash
npx @redocly/cli preview-docs openapi.yaml
```

---

## Postman Collection

**Coming Soon**: A Postman collection with example requests will be available for download.

---

## Support

- **Documentation**: [docs/](../)
- **Issues**: [GitHub Issues](https://github.com/TheFakeCreator/Axon/issues)
- **Discussions**: [GitHub Discussions](https://github.com/TheFakeCreator/Axon/discussions)

---

**Last Updated**: November 7, 2025  
**API Version**: v1.0.0 (MVP)
