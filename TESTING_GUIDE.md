# Axon - Complete Testing Guide

> A comprehensive guide for testing the Axon MVP from a QA perspective

**Last Updated:** November 7, 2025  
**Version:** MVP 1.0  
**Estimated Time:** 30-45 minutes

---

## 📋 Pre-Test Checklist

Before you start testing, ensure the following:

- [ ] Node.js v20+ installed
- [ ] pnpm installed
- [ ] Docker Desktop running
- [ ] Git repository cloned
- [ ] All dependencies installed (`pnpm install`)
- [ ] All packages built (`pnpm build`)
- [ ] OpenAI API key configured OR Ollama installed

---

## 🎯 Test Levels

This guide covers **5 test levels** in order:

1. **Infrastructure Tests** - Verify all services are running
2. **API Health Tests** - Test health and readiness endpoints
3. **Unit Tests** - Run automated test suites
4. **Functional Tests** - Test core features via API
5. **End-to-End Tests** - Test complete workflows

---

## Level 1: Infrastructure Tests

### Test 1.1: Start Infrastructure Services

**Objective:** Verify Docker services start correctly

```powershell
# Navigate to project root
cd d:\Sanskar\programming\projects\Axon

# Start all infrastructure services
docker-compose -f docker/docker-compose.dev.yml up -d

# Wait 10 seconds for services to initialize
Start-Sleep -Seconds 10

# Check service status
docker-compose -f docker/docker-compose.dev.yml ps
```

**Expected Result:**

```
NAME            STATUS          PORTS
axon-mongodb    Up             0.0.0.0:27017->27017/tcp
axon-redis      Up             0.0.0.0:6379->6379/tcp
axon-qdrant     Up             0.0.0.0:6333->6333/tcp
```

**Pass Criteria:** ✅ All 3 services show "Up" status

---

### Test 1.2: MongoDB Health Check

**Objective:** Verify MongoDB is accessible and responding

```powershell
# Test MongoDB connection
docker exec -it axon-mongodb mongosh -u admin -p password --eval "db.adminCommand('ping')"
```

**Expected Result:**

```json
{ "ok": 1 }
```

**Pass Criteria:** ✅ Returns `{ ok: 1 }`

---

### Test 1.3: Redis Health Check

**Objective:** Verify Redis is accessible and responding

```powershell
# Test Redis connection
docker exec -it axon-redis redis-cli ping
```

**Expected Result:**

```
PONG
```

**Pass Criteria:** ✅ Returns "PONG"

---

### Test 1.4: Qdrant Health Check

**Objective:** Verify Qdrant vector database is accessible

```powershell
# Test Qdrant health endpoint
curl http://localhost:6333/healthz
```

**Expected Result:**

```json
{ "status": "ok" }
```

**Alternative:** Open `http://localhost:6333/dashboard` in browser

**Pass Criteria:** ✅ Returns 200 status with `{"status":"ok"}`

---

### Test 1.5: Infrastructure Logs Check

**Objective:** Verify no critical errors in service logs

```powershell
# Check MongoDB logs (last 20 lines)
docker logs --tail 20 axon-mongodb

# Check Redis logs (last 20 lines)
docker logs --tail 20 axon-redis

# Check Qdrant logs (last 20 lines)
docker logs --tail 20 axon-qdrant
```

**Pass Criteria:** ✅ No ERROR or FATAL messages in logs

---

## Level 2: API Health Tests

### Test 2.1: Build Application

**Objective:** Verify all TypeScript packages build successfully

```powershell
# Build all packages
pnpm build
```

**Expected Result:**

```
Tasks:    8 successful, 8 total
Time:    ~15-30s
```

**Pass Criteria:** ✅ All tasks successful, no errors

---

### Test 2.2: Start API Server

**Objective:** Start the Axon API gateway

```powershell
# Start API server in background
# Open a new terminal and run:
pnpm --filter @axon/api dev
```

**Expected Result:**

```
[INFO] Starting Axon API Gateway...
[INFO] Environment: development
[INFO] Port: 3000
[INFO] Server running at http://localhost:3000
[INFO] Health check: http://localhost:3000/health
```

**Pass Criteria:** ✅ Server starts without errors on port 3000

---

### Test 2.3: Basic Health Check

**Objective:** Verify API server is responding

```powershell
# Test basic health endpoint
curl http://localhost:3000/health
```

**Expected Result:**

```json
{
  "status": "ok",
  "uptime": 5.123,
  "version": "0.1.0",
  "timestamp": "2025-11-07T..."
}
```

**Pass Criteria:** ✅ Status 200, `"status": "ok"`

---

### Test 2.4: Readiness Check

**Objective:** Verify all services initialized successfully

```powershell
# Test readiness endpoint
curl http://localhost:3000/health/ready
```

**Expected Result:**

```json
{
  "success": true,
  "data": {
    "ready": true,
    "services": {
      "promptOrchestrator": true,
      "workspaceManager": true,
      "qualityGate": true
    },
    "timestamp": "2025-11-07T..."
  }
}
```

**Note:** In MVP, services are initialized per-request. This checks if the service container is available.

**Pass Criteria:** ✅ `"ready": true` and all services return `true`

---

### Test 2.5: Liveness Check

**Objective:** Verify server is alive and not hung

```powershell
# Test liveness endpoint
curl http://localhost:3000/health/live
```

**Expected Result:**

```json
{
  "status": "alive"
}
```

**Pass Criteria:** ✅ Returns `"status": "alive"`

---

## Level 3: Unit Tests

### Test 3.1: Shared Package Tests

**Objective:** Run tests for shared utilities

```powershell
pnpm --filter @axon/shared test
```

**Expected Result:**

- Unit tests: 70/70 passing ✅
- Integration tests: 12 may fail (embedding model initialization)

**Note:** Integration tests for semantic search require `@xenova/transformers` model download. These may fail on first run or in restricted environments. This is **expected** and **not critical** for MVP.

**Pass Criteria:** ✅ Unit tests pass (70+ tests), coverage ≥80%

**Skip Integration Tests (Optional):**

```powershell
# Run only unit tests (skip integration tests)
pnpm --filter @axon/shared test --exclude tests/integration/**
```

---

### Test 3.2: Prompt Analyzer Tests

**Objective:** Run tests for prompt analysis service

```powershell
pnpm --filter @axon/prompt-analyzer test
```

**Pass Criteria:** ✅ All tests pass, coverage ≥80%

---

### Test 3.3: Context Engine Tests

**Objective:** Run tests for context management service

```powershell
pnpm --filter @axon/context-engine test
```

**Pass Criteria:** ✅ All tests pass, coverage ≥80%

---

### Test 3.4: LLM Gateway Tests

**Objective:** Run tests for LLM interface service

```powershell
pnpm --filter @axon/llm-gateway test
```

**Pass Criteria:** ✅ All tests pass, coverage ≥80%

---

### Test 3.5: Middleware Tests

**Objective:** Run tests for middleware orchestration

```powershell
pnpm --filter @axon/middleware test
```

**Expected Result:**

- PromptCollector: 16/16 tests passing
- ContextSynthesizer: 26/26 tests passing
- PromptInjector: 25/25 tests passing
- ResponsePostProcessor: 30/30 tests passing
- PromptOrchestrator: 31/31 tests passing

**Pass Criteria:** ✅ 128/128 tests passing, coverage ≥96%

---

### Test 3.6: Quality Gate Tests

**Objective:** Run tests for quality gate service

```powershell
pnpm --filter @axon/quality-gate test
```

**Pass Criteria:** ✅ Tests pass, core functionality verified

---

### Test 3.7: Workspace Manager Tests

**Objective:** Run tests for workspace management

```powershell
pnpm --filter @axon/workspace-manager test
```

**Pass Criteria:** ✅ Tests pass, workspace types verified

---

### Test 3.8: Run All Tests

**Objective:** Execute entire test suite

```powershell
# Run all tests in all packages
pnpm test
```

**Pass Criteria:** ✅ 400+ tests passing across all packages

---

## Level 4: Functional Tests (API)

### Test 4.1: Invalid Request Handling

**Objective:** Verify API validates requests properly

```powershell
# Test with missing prompt field
curl -X POST http://localhost:3000/api/v1/prompts/process `
  -H "Content-Type: application/json" `
  -d '{}'
```

**Expected Result:**

```json
{
  "error": "Validation Error",
  "details": ["prompt is required"]
}
```

**Pass Criteria:** ✅ Returns 400 status with validation error

---

### Test 4.2: Basic Prompt Processing (No LLM)

**Objective:** Test prompt analysis without LLM call

```powershell
# Test prompt analysis pipeline
curl -X POST http://localhost:3000/api/v1/prompts/process `
  -H "Content-Type: application/json" `
  -d '{
    "prompt": "How do I fix the bug in the login function?",
    "workspaceId": "550e8400-e29b-41d4-a716-446655440000",
    "source": "api"
  }'
```

**Expected Result:**

- Status: 200 or 500 (depending on LLM configuration)
- If no LLM: Error message about missing API key
- If LLM configured: Full response with context

**Pass Criteria:** ✅ Request is processed, prompt analysis occurs

---

### Test 4.3: Prompt with Metadata

**Objective:** Test context extraction from metadata

```powershell
curl -X POST http://localhost:3000/api/v1/prompts/process `
  -H "Content-Type: application/json" `
  -d '{
    "prompt": "Refactor this function for better performance",
    "workspaceId": "550e8400-e29b-41d4-a716-446655440000",
    "source": "api",
    "metadata": {
      "fileName": "src/utils/helper.ts",
      "language": "typescript",
      "cursorPosition": {
        "line": 42,
        "column": 10
      }
    }
  }'
```

**Pass Criteria:** ✅ Metadata is included in prompt analysis

---

### Test 4.4: Quality Gate Execution

**Objective:** Test quality gate with test command

```powershell
curl -X POST http://localhost:3000/api/v1/quality-gate/execute `
  -H "Content-Type: application/json" `
  -d '{
    "projectPath": "d:/Sanskar/programming/projects/Axon",
    "checks": {
      "test": true,
      "lint": false,
      "typeCheck": false
    },
    "config": {
      "testCommand": "pnpm test",
      "testFramework": "vitest"
    }
  }'
```

**Expected Result:**

```json
{
  "success": true,
  "qualityScore": 85.5,
  "results": {
    "test": {
      "passed": true,
      "totalTests": 128,
      "passedTests": 128,
      ...
    }
  }
}
```

**Pass Criteria:** ✅ Quality gate executes and returns results

---

### Test 4.5: Streaming Response (With LLM)

**Objective:** Test Server-Sent Events streaming

**Prerequisites:** OpenAI API key configured OR Ollama running

```powershell
curl -X POST http://localhost:3000/api/v1/prompts/process `
  -H "Content-Type: application/json" `
  -d '{
    "prompt": "What is TypeScript?",
    "workspaceId": "550e8400-e29b-41d4-a716-446655440000",
    "stream": true
  }'
```

**Expected Result:**
Stream of SSE events:

```
data: {"type":"token","content":"TypeScript"}
data: {"type":"token","content":" is"}
data: {"type":"token","content":" a"}
...
data: {"type":"done"}
```

**Pass Criteria:** ✅ Streaming response received with multiple events

---

### Test 4.6: Workspace Routes (Placeholders)

**Objective:** Verify workspace endpoints exist

```powershell
# Test GET /workspaces
curl http://localhost:3000/api/v1/workspaces

# Test GET /workspaces/:id
curl http://localhost:3000/api/v1/workspaces/550e8400-e29b-41d4-a716-446655440000
```

**Expected Result:**

```json
{
  "message": "Not implemented yet",
  "hint": "Workspace management coming in post-MVP"
}
```

**Pass Criteria:** ✅ Endpoints respond (even if not implemented)

---

### Test 4.7: Context Routes (Placeholders)

**Objective:** Verify context endpoints exist

```powershell
# Test GET /contexts
curl http://localhost:3000/api/v1/contexts?workspaceId=550e8400-e29b-41d4-a716-446655440000
```

**Expected Result:**

```json
{
  "message": "Not implemented yet",
  "hint": "Context management routes coming in post-MVP"
}
```

**Pass Criteria:** ✅ Endpoints respond (even if not implemented)

---

### Test 4.8: Error Handling

**Objective:** Test API error handling

```powershell
# Test with invalid JSON
curl -X POST http://localhost:3000/api/v1/prompts/process `
  -H "Content-Type: application/json" `
  -d 'invalid json'
```

**Expected Result:**

```json
{
  "error": "Invalid JSON",
  "status": 400
}
```

**Pass Criteria:** ✅ Returns proper error response

---

### Test 4.9: Rate Limiting

**Objective:** Verify rate limiting is active

```powershell
# Make 101 requests rapidly (exceeds 100 req/15min limit)
for ($i = 1; $i -le 101; $i++) {
  curl -s http://localhost:3000/health | Out-Null
  Write-Host "Request $i"
}
```

**Expected Result:**
After 100 requests, subsequent requests return:

```json
{
  "error": "Too many requests",
  "status": 429
}
```

**Pass Criteria:** ✅ Rate limiting blocks excess requests

---

### Test 4.10: CORS Headers

**Objective:** Verify CORS is configured

```powershell
curl -I http://localhost:3000/health
```

**Expected Result:**
Headers include:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
```

**Pass Criteria:** ✅ CORS headers present

---

## Level 5: End-to-End Tests

### Test 5.1: Complete Bug Fix Workflow

**Objective:** Simulate real-world bug fixing scenario

**Scenario:**
You're a developer working on an Express.js app. You have a bug in your authentication middleware and need help fixing it.

```powershell
curl -X POST http://localhost:3000/api/v1/prompts/process `
  -H "Content-Type: application/json" `
  -d '{
    "prompt": "I have a bug in my authentication middleware. The JWT token verification is failing with \"invalid signature\" error even though the token is valid. Can you help me debug this?",
    "workspaceId": "coding-workspace-001",
    "source": "vscode",
    "metadata": {
      "fileName": "src/middleware/auth.ts",
      "language": "typescript",
      "projectType": "express-api",
      "cursorPosition": {
        "line": 25,
        "column": 15
      },
      "diagnostics": [
        {
          "message": "JWT verification failed",
          "severity": "error",
          "line": 25
        }
      ]
    }
  }'
```

**Expected Flow:**

1. ✅ Prompt collected and validated
2. ✅ Prompt analyzed → Intent: Bug Fix, Task: Bug Fix, Entities: JWT, auth
3. ✅ Context retrieved from workspace (if exists)
4. ✅ Context synthesized with token budget
5. ✅ Prompt enriched with context
6. ✅ LLM generates solution
7. ✅ Response post-processed
8. ✅ Actions extracted (e.g., "Check JWT secret")

**Pass Criteria:** ✅ Complete pipeline executes, response is contextually relevant

---

### Test 5.2: Feature Addition Workflow

**Objective:** Test adding new feature guidance

```powershell
curl -X POST http://localhost:3000/api/v1/prompts/process `
  -H "Content-Type: application/json" `
  -d '{
    "prompt": "I want to add user roles and permissions to my application. Show me how to implement RBAC (Role-Based Access Control) in Express.js with TypeScript.",
    "workspaceId": "coding-workspace-001",
    "source": "vscode",
    "metadata": {
      "fileName": "src/routes/users.ts",
      "language": "typescript",
      "projectType": "express-api"
    }
  }'
```

**Expected Flow:**

1. ✅ Intent: Feature Addition
2. ✅ Task: Feature Add
3. ✅ Entities: RBAC, Express, TypeScript
4. ✅ Context includes project architecture
5. ✅ Response includes implementation steps

**Pass Criteria:** ✅ Response provides step-by-step implementation

---

### Test 5.3: Code Review Workflow

**Objective:** Test code review assistance

```powershell
curl -X POST http://localhost:3000/api/v1/prompts/process `
  -H "Content-Type: application/json" `
  -d '{
    "prompt": "Review this code for security vulnerabilities and best practices:\n\nfunction login(username, password) {\n  const query = \"SELECT * FROM users WHERE username='\'' + username + '\'' AND password='\'' + password + '\''\";\n  return db.execute(query);\n}",
    "workspaceId": "coding-workspace-001",
    "source": "api",
    "metadata": {
      "language": "javascript"
    }
  }'
```

**Expected Issues Identified:**

- SQL injection vulnerability
- Plain text password storage
- Missing input validation

**Pass Criteria:** ✅ LLM identifies security issues

---

### Test 5.4: Architecture Query Workflow

**Objective:** Test architecture guidance

```powershell
curl -X POST http://localhost:3000/api/v1/prompts/process `
  -H "Content-Type: application/json" `
  -d '{
    "prompt": "Should I use microservices or monolithic architecture for my e-commerce platform? We expect 10k users in the first year.",
    "workspaceId": "coding-workspace-001",
    "source": "api"
  }'
```

**Expected Response:**

- Consideration of scale (10k users)
- Trade-offs discussed
- Recommendation based on context

**Pass Criteria:** ✅ Response is balanced and considers stated requirements

---

### Test 5.5: Testing Guidance Workflow

**Objective:** Test testing assistance

```powershell
curl -X POST http://localhost:3000/api/v1/prompts/process `
  -H "Content-Type: application/json" `
  -d '{
    "prompt": "Write unit tests for my authentication service using Jest and TypeScript",
    "workspaceId": "coding-workspace-001",
    "source": "vscode",
    "metadata": {
      "fileName": "src/services/auth.service.ts",
      "language": "typescript"
    }
  }'
```

**Expected Response:**

- Test structure with `describe` and `it` blocks
- Mock setup for dependencies
- Multiple test cases (success, failure, edge cases)

**Pass Criteria:** ✅ Response includes working test code

---

### Test 5.6: Quality Gate Integration

**Objective:** Test full quality gate execution

```powershell
curl -X POST http://localhost:3000/api/v1/quality-gate/execute `
  -H "Content-Type: application/json" `
  -d '{
    "projectPath": "d:/Sanskar/programming/projects/Axon",
    "checks": {
      "test": true,
      "lint": true,
      "typeCheck": true
    },
    "config": {
      "testCommand": "pnpm --filter @axon/middleware test",
      "testFramework": "vitest",
      "lintCommand": "pnpm --filter @axon/middleware lint",
      "linter": "eslint",
      "typeCheckCommand": "pnpm --filter @axon/middleware exec tsc --noEmit"
    }
  }'
```

**Expected Result:**

```json
{
  "success": true,
  "qualityScore": 92.5,
  "results": {
    "test": {
      "passed": true,
      "totalTests": 128,
      "passedTests": 128,
      "coverage": 96.15
    },
    "lint": {
      "passed": true,
      "totalIssues": 0
    },
    "typeCheck": {
      "passed": true,
      "errors": 0
    }
  }
}
```

**Pass Criteria:** ✅ All checks pass, quality score ≥85

---

## 🎯 Performance Tests

### Test P.1: Response Latency

**Objective:** Measure end-to-end response time

```powershell
# Measure request time
Measure-Command {
  curl -X POST http://localhost:3000/api/v1/prompts/process `
    -H "Content-Type: application/json" `
    -d '{
      "prompt": "What is Express.js?",
      "workspaceId": "test-workspace",
      "source": "api"
    }' | Out-Null
}
```

**Target:** <3 seconds (without LLM) or <5 seconds (with LLM)

**Pass Criteria:** ✅ Response time within target

---

### Test P.2: Prompt Analysis Speed

**Objective:** Measure prompt analyzer performance

**Check logs for timing:**
Look for `[PromptAnalyzer]` timing logs in API console

**Target:** <200ms for prompt analysis

**Pass Criteria:** ✅ Analysis completes in <200ms

---

### Test P.3: Context Retrieval Speed

**Objective:** Measure context retrieval performance

**Check logs for timing:**
Look for `[ContextRetriever]` timing logs

**Target:** <500ms for context retrieval

**Pass Criteria:** ✅ Retrieval completes in <500ms

---

### Test P.4: Concurrent Requests

**Objective:** Test API under concurrent load

```powershell
# Make 10 concurrent requests
1..10 | ForEach-Object -Parallel {
  curl -X POST http://localhost:3000/api/v1/prompts/process `
    -H "Content-Type: application/json" `
    -d "{
      \"prompt\": \"Test prompt $_\",
      \"workspaceId\": \"test-workspace\",
      \"source\": \"api\"
    }"
} -ThrottleLimit 10
```

**Target:** All requests succeed, no crashes

**Pass Criteria:** ✅ API handles concurrent requests gracefully

---

## 🔍 Negative Tests

### Test N.1: Invalid Workspace ID

```powershell
curl -X POST http://localhost:3000/api/v1/prompts/process `
  -H "Content-Type: application/json" `
  -d '{
    "prompt": "Test",
    "workspaceId": "invalid-workspace-id-format!!!",
    "source": "api"
  }'
```

**Expected:** Validation error or graceful handling

**Pass Criteria:** ✅ No server crash, proper error response

---

### Test N.2: Empty Prompt

```powershell
curl -X POST http://localhost:3000/api/v1/prompts/process `
  -H "Content-Type: application/json" `
  -d '{
    "prompt": "",
    "workspaceId": "test-workspace",
    "source": "api"
  }'
```

**Expected:** Validation error

**Pass Criteria:** ✅ Returns 400 with validation message

---

### Test N.3: Extremely Long Prompt

```powershell
$longPrompt = "A" * 50000  # 50,000 characters

curl -X POST http://localhost:3000/api/v1/prompts/process `
  -H "Content-Type: application/json" `
  -d "{
    \"prompt\": \"$longPrompt\",
    \"workspaceId\": \"test-workspace\",
    \"source\": \"api\"
  }"
```

**Expected:** Handled gracefully (may truncate or reject)

**Pass Criteria:** ✅ No server crash, proper response

---

### Test N.4: Malformed JSON

```powershell
curl -X POST http://localhost:3000/api/v1/prompts/process `
  -H "Content-Type: application/json" `
  -d '{prompt: "test", workspaceId: "test"}'  # Missing quotes
```

**Expected:** JSON parse error

**Pass Criteria:** ✅ Returns 400 with JSON error

---

### Test N.5: SQL Injection Attempt

```powershell
curl -X POST http://localhost:3000/api/v1/prompts/process `
  -H "Content-Type: application/json" `
  -d '{
    "prompt": "'\'' OR 1=1; DROP TABLE users;--",
    "workspaceId": "test-workspace",
    "source": "api"
  }'
```

**Expected:** Sanitized and processed safely

**Pass Criteria:** ✅ No database errors, prompt sanitized

---

### Test N.6: XSS Attempt

```powershell
curl -X POST http://localhost:3000/api/v1/prompts/process `
  -H "Content-Type: application/json" `
  -d '{
    "prompt": "<script>alert('\''XSS'\'')</script>",
    "workspaceId": "test-workspace",
    "source": "api"
  }'
```

**Expected:** Script tags removed or escaped

**Pass Criteria:** ✅ XSS attempt neutralized

---

## 📊 Test Summary Report

After completing all tests, fill out this summary:

### Infrastructure (6 tests)

- [ ] Test 1.1: Docker services start ✅/❌
- [ ] Test 1.2: MongoDB health ✅/❌
- [ ] Test 1.3: Redis health ✅/❌
- [ ] Test 1.4: Qdrant health ✅/❌
- [ ] Test 1.5: No critical errors ✅/❌

### API Health (5 tests)

- [ ] Test 2.1: Build success ✅/❌
- [ ] Test 2.2: API server starts ✅/❌
- [ ] Test 2.3: Basic health ✅/❌
- [ ] Test 2.4: Readiness check ✅/❌
- [ ] Test 2.5: Liveness check ✅/❌

### Unit Tests (8 test suites)

- [ ] Test 3.1: Shared tests ✅/❌
- [ ] Test 3.2: Prompt analyzer tests ✅/❌
- [ ] Test 3.3: Context engine tests ✅/❌
- [ ] Test 3.4: LLM gateway tests ✅/❌
- [ ] Test 3.5: Middleware tests ✅/❌
- [ ] Test 3.6: Quality gate tests ✅/❌
- [ ] Test 3.7: Workspace manager tests ✅/❌
- [ ] Test 3.8: All tests together ✅/❌

### Functional Tests (10 API tests)

- [ ] Test 4.1: Invalid request ✅/❌
- [ ] Test 4.2: Basic prompt ✅/❌
- [ ] Test 4.3: Prompt with metadata ✅/❌
- [ ] Test 4.4: Quality gate ✅/❌
- [ ] Test 4.5: Streaming ✅/❌
- [ ] Test 4.6: Workspace routes ✅/❌
- [ ] Test 4.7: Context routes ✅/❌
- [ ] Test 4.8: Error handling ✅/❌
- [ ] Test 4.9: Rate limiting ✅/❌
- [ ] Test 4.10: CORS ✅/❌

### E2E Tests (6 workflows)

- [ ] Test 5.1: Bug fix workflow ✅/❌
- [ ] Test 5.2: Feature addition ✅/❌
- [ ] Test 5.3: Code review ✅/❌
- [ ] Test 5.4: Architecture query ✅/❌
- [ ] Test 5.5: Testing guidance ✅/❌
- [ ] Test 5.6: Quality gate integration ✅/❌

### Performance Tests (4 tests)

- [ ] Test P.1: Response latency ✅/❌
- [ ] Test P.2: Analysis speed ✅/❌
- [ ] Test P.3: Retrieval speed ✅/❌
- [ ] Test P.4: Concurrent requests ✅/❌

### Negative Tests (6 tests)

- [ ] Test N.1: Invalid workspace ID ✅/❌
- [ ] Test N.2: Empty prompt ✅/❌
- [ ] Test N.3: Long prompt ✅/❌
- [ ] Test N.4: Malformed JSON ✅/❌
- [ ] Test N.5: SQL injection ✅/❌
- [ ] Test N.6: XSS attempt ✅/❌

---

## 🐛 Known Issues & Limitations

Based on MVP scope, these are known limitations (NOT bugs):

1. **Workspace Management**: API routes are placeholders (post-MVP)
2. **Context Management**: API routes are placeholders (post-MVP)
3. **Authentication**: No API key auth yet (post-MVP)
4. **Multi-user**: Not supported in MVP
5. **Frontend**: No UI, API only
6. **E2E Tests**: Not automated (manual testing only)
7. **LLM Required**: Full workflow requires OpenAI API key or Ollama
8. **Integration Tests**: Semantic search integration tests may fail due to ML model initialization (expected, not critical for MVP)

---

## 📝 Test Results Interpretation

### Unit Tests vs Integration Tests

**Unit Tests** (Critical for MVP):

- Test individual functions and classes in isolation
- Use mocks for external dependencies
- Should ALL pass (100%)
- Examples: cache.test.ts, query-builder.test.ts, logger.test.ts

**Integration Tests** (Nice-to-have for MVP):

- Test integration with external services (ML models, databases)
- May fail due to environment issues (network, model downloads, etc.)
- Failing integration tests are **acceptable** for MVP if unit tests pass
- Example: semantic-search.integration.test.ts (12 tests)

### Expected Test Results

**Shared Package**: 70+ unit tests passing, 12 integration tests may fail ⚠️  
**Prompt Analyzer**: All tests should pass ✅  
**Context Engine**: All tests should pass ✅  
**LLM Gateway**: All tests should pass ✅  
**Middleware**: 128/128 tests should pass ✅  
**Quality Gate**: Most tests should pass ✅  
**Workspace Manager**: Most tests should pass ✅

**Overall Target**: ≥90% of tests passing (excluding known integration test issues)

---

## 🔧 Troubleshooting Failed Tests

### If infrastructure tests fail:

```powershell
# Restart Docker Desktop
# Then restart services
docker-compose -f docker/docker-compose.dev.yml down
docker-compose -f docker/docker-compose.dev.yml up -d
```

### If API tests fail:

```powershell
# Check API logs
# Restart API server
# Verify .env configuration
```

### If unit tests fail:

```powershell
# Clean and rebuild
pnpm clean
pnpm install
pnpm build
pnpm test
```

### If LLM tests fail:

- Verify OpenAI API key is set in `.env`
- Or ensure Ollama is running: `ollama serve`
- Check API key has credits (OpenAI)

---

## ✅ Test Completion Criteria

**MVP is considered WORKING if:**

1. ✅ All infrastructure services running
2. ✅ All unit tests passing (≥90% of 400+ tests)
3. ✅ API health checks passing
4. ✅ At least one E2E workflow completes successfully
5. ✅ No critical bugs in functional tests
6. ✅ Performance within target ranges
7. ✅ Security tests pass (XSS/SQL injection handled)

**Optional (for production):**

8. ⏳ Authentication implemented
9. ⏳ Rate limiting per user
10. ⏳ Monitoring dashboards setup
11. ⏳ Production deployment successful

---

## 📞 Reporting Issues

If you find bugs during testing:

1. **Document the issue:**
   - Test that failed
   - Expected result
   - Actual result
   - Steps to reproduce
   - Error logs (if any)

2. **Check known limitations** (see section above)

3. **Create GitHub issue** with "Bug" label

4. **Include test environment:**
   - OS version
   - Node.js version
   - Docker version
   - API logs

---

## 🎉 Success!

If all core tests pass (Infrastructure + API Health + Unit Tests + at least 2 E2E workflows), **congratulations!** 🎊

**Axon MVP is working correctly and ready for:**

- Further development
- Production deployment preparation
- User acceptance testing
- Integration with IDEs/editors

---

**Happy Testing!** 🧪

**Axon** - Intelligent, context-aware AI assistance through sophisticated context management.
