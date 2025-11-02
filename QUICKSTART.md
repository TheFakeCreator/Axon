# Axon - Quick Start Guide

> Get Axon up and running in under 10 minutes!

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** v20+ ([Download](https://nodejs.org/))
- **pnpm** v10+ (`npm install -g pnpm`)
- **Docker Desktop** ([Download](https://www.docker.com/products/docker-desktop/))
- **Git** ([Download](https://git-scm.com/))

**Optional:**

- **OpenAI API Key** (for cloud LLM) - Get one at [platform.openai.com](https://platform.openai.com/)
- **Ollama** (for local LLM) - Free alternative to OpenAI ([Download](https://ollama.com/download))

> **💡 Recommended:** Use Ollama for local, free LLM instead of OpenAI. See [Ollama Setup](#ollama-setup-recommended) below.

---

## 🚀 Quick Setup (5 Steps)

### Step 1: Clone and Install

```bash
# Clone the repository
git clone https://github.com/YourOrg/Axon.git
cd Axon

# Install all dependencies
pnpm install
```

### Step 2: Start Infrastructure Services

Start MongoDB, Redis, and Qdrant using Docker:

```bash
# Start all infrastructure services in the background
docker-compose -f docker/docker-compose.dev.yml up -d

# Verify services are running
docker-compose -f docker/docker-compose.dev.yml ps
```

**Expected output:**

```
NAME            STATUS          PORTS
axon-mongodb    Up             0.0.0.0:27017->27017/tcp
axon-redis      Up             0.0.0.0:6379->6379/tcp
axon-qdrant     Up             0.0.0.0:6333->6333/tcp, 6334/tcp
```

### Step 2.5: Ollama Setup (Recommended)

**Use Ollama for free, local LLM instead of OpenAI!**

#### Install Ollama

1. Download from [ollama.com/download](https://ollama.com/download)
2. Install and start Ollama
3. Pull the recommended model:

```bash
# Pull llama3.2 1B model (1.3GB - fast and efficient)
ollama pull llama3.2:1b

# Verify installation
ollama list
```

#### Test Ollama

```bash
# Quick test
ollama run llama3.2:1b "What is TypeScript?"

# Verify API is accessible
curl http://localhost:11434/api/tags
```

**✅ Benefits:**

- 🆓 **Free** - No API costs
- 🏠 **Private** - Data stays on your machine
- ⚡ **Fast** - Low latency for local inference
- 🔌 **Offline** - Works without internet

### Step 3: Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env file
# For Windows: notepad .env
# For Linux/Mac: nano .env
```

**Option A: With Ollama (Recommended - Free)**

```env
# Server
NODE_ENV=development
PORT=3000

# MongoDB
MONGODB_URI=mongodb://admin:password@localhost:27017
MONGODB_DB_NAME=axon

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Qdrant
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION_NAME=axon-contexts

# LLM Provider - Use Ollama
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:1b

# Logging
LOG_LEVEL=info
ENABLE_STREAMING=true
```

**Option B: With OpenAI (Requires API Key)**

```env
# Server
NODE_ENV=development
PORT=3000

# MongoDB (matches Docker compose)
MONGODB_URI=mongodb://admin:password@localhost:27017
MONGODB_DB_NAME=axon

# Redis (matches Docker compose)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Qdrant (matches Docker compose)
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION_NAME=axon-contexts
QDRANT_VECTOR_SIZE=384

# LLM Provider - Use OpenAI
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_MODEL=gpt-4

# Logging
LOG_LEVEL=info

# Features
ENABLE_STREAMING=true
```

### Step 4: Build All Packages

```bash
# Build all TypeScript packages
pnpm build
```

**Expected output:**

```
Tasks:    8 successful, 8 total
Cached:    0 cached, 8 total
Time:    ~15s
```

### Step 5: Start the API Server

```bash
# Start the API server in development mode
pnpm --filter @axon/api dev
```

**Expected output:**

```
[INFO] Starting Axon API Gateway...
[INFO] Environment: development
[INFO] Port: 3000
[INFO] Server running at http://localhost:3000
[INFO] Health check: http://localhost:3000/health
```

---

## ✅ Verify Installation

### Test 1: Health Check

```bash
curl http://localhost:3000/health
```

**Expected response:**

```json
{
  "status": "ok",
  "uptime": 5.123,
  "version": "0.1.0",
  "timestamp": "2025-11-02T..."
}
```

### Test 2: Readiness Check

```bash
curl http://localhost:3000/health/ready
```

**Expected response:**

```json
{
  "status": "ready",
  "services": {
    "api": true,
    "middleware": true,
    "workspaceManager": true,
    "qualityGate": true
  }
}
```

### Test 3: Infrastructure Health

```bash
# MongoDB
docker exec -it axon-mongodb mongosh --eval "db.adminCommand('ping')"

# Redis
docker exec -it axon-redis redis-cli ping

# Qdrant
curl http://localhost:6333/healthz
```

---

## 🎯 Test the Application

### Example 1: Basic Prompt Processing (Without LLM)

**Note:** This will fail gracefully if OpenAI API key is not configured, but will demonstrate the request pipeline.

```bash
curl -X POST http://localhost:3000/api/v1/prompts/process \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "How do I implement authentication in Express.js?",
    "workspaceId": "550e8400-e29b-41d4-a716-446655440000",
    "source": "api"
  }'
```

### Example 2: Prompt Processing with Context (Requires OpenAI API Key)

```bash
curl -X POST http://localhost:3000/api/v1/prompts/process \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Fix the authentication bug in login function",
    "workspaceId": "550e8400-e29b-41d4-a716-446655440000",
    "source": "api",
    "metadata": {
      "fileName": "auth.ts",
      "language": "typescript",
      "cursorPosition": {
        "line": 42,
        "column": 10
      }
    }
  }'
```

### Example 3: Streaming Response (Requires OpenAI API Key)

```bash
curl -X POST http://localhost:3000/api/v1/prompts/process \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Explain how to use React hooks",
    "workspaceId": "550e8400-e29b-41d4-a716-446655440000",
    "stream": true
  }'
```

---

## 🔧 Development Workflow

### Running in Development Mode

```bash
# Start API server with hot reload
pnpm --filter @axon/api dev

# Or use Turbo to run all packages in dev mode
pnpm dev
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter @axon/middleware test

# Run tests in watch mode
pnpm --filter @axon/middleware test -- --watch
```

### Building

```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter @axon/middleware build
```

### Linting and Formatting

```bash
# Lint all code
pnpm lint

# Format all code
pnpm format

# Check formatting without changes
pnpm format:check
```

---

## 📊 Current Implementation Status

### ✅ Fully Implemented (Ready to Use)

- **Phase 0**: Project Setup & Infrastructure (100%)
- **Phase 1**: Database Infrastructure (100%)
  - MongoDB connection & schemas
  - Redis cache & queue
  - Qdrant vector database
- **Phase 2**: LLM Gateway (100%)
  - OpenAI integration with streaming
  - Retry logic & error handling
- **Phase 3**: Prompt Analyzer (100%)
  - Intent classification
  - Task type identification
  - Entity extraction
  - Ambiguity detection
- **Phase 4**: Context Engine (100%)
  - Context retrieval with 4-factor re-ranking
  - Context storage with versioning
  - Context evolution (feedback + temporal decay)
  - Embedding service with caching
- **Phase 5**: Middleware Orchestration (100%)
  - PromptCollector (16/16 tests ✅)
  - ContextSynthesizer (26/26 tests ✅)
  - PromptInjector (25/25 tests ✅)
  - ResponsePostProcessor (needs tests)
  - PromptOrchestrator (needs tests)
- **Phase 6**: Workspace Manager (100%)
  - Coding workspace support
  - PKM workspace support
  - Root workspace coordination
- **Phase 7**: Quality Gate (100%)
  - Test execution (5 frameworks)
  - Linting (4 linters)
  - Quality orchestration
- **Phase 8**: API Gateway (100%)
  - REST API with Express
  - Health checks
  - Prompt processing endpoints (full integration)
  - Workspace/Context routes (placeholders)
  - Quality gate routes (full integration)

### 🔄 In Progress

- **Phase 9**: Testing & Quality Assurance (60%)
  - Unit tests: 67/67 tests passing (3/5 services complete)
  - Integration tests: Not started
  - E2E tests: Not started

### ⏳ Not Started

- **Phase 10**: Documentation
- **Phase 11**: Performance Optimization
- **Phase 12**: Deployment Preparation

---

## 🏗️ Architecture Overview

```
User Request
    ↓
API Gateway (Express.js) - Port 3000
    ↓
PromptOrchestrator (Middleware)
    ↓
    ├─→ PromptAnalyzer → Intent & Task Classification
    ├─→ ContextRetriever → Semantic Search (Qdrant)
    ├─→ ContextSynthesizer → Token Budget Management
    ├─→ PromptInjector → Context Injection Strategy
    ├─→ LLMGateway → OpenAI API (GPT-4)
    └─→ ResponsePostProcessor → Quality Assessment
            ↓
        Response with Actions & Knowledge
```

### Infrastructure Services

- **MongoDB** (Port 27017): Workspaces, contexts, interactions
- **Redis** (Port 6379): Caching, job queue (BullMQ)
- **Qdrant** (Port 6333): Vector embeddings for semantic search

---

## 🛠️ Troubleshooting

### Port Already in Use

**Error:** `EADDRINUSE: address already in use :::3000`

```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3000 | xargs kill -9
```

### Docker Services Not Starting

```bash
# Check Docker is running
docker ps

# Restart Docker Desktop, then:
docker-compose -f docker/docker-compose.dev.yml down
docker-compose -f docker/docker-compose.dev.yml up -d
```

### MongoDB Connection Failed

```bash
# Verify MongoDB is running
docker ps | grep mongodb

# Check MongoDB logs
docker logs axon-mongodb

# Test connection
docker exec -it axon-mongodb mongosh -u admin -p password --eval "db.adminCommand('ping')"
```

### Redis Connection Failed

```bash
# Verify Redis is running
docker ps | grep redis

# Test connection
docker exec -it axon-redis redis-cli ping
```

### Qdrant Connection Failed

```bash
# Verify Qdrant is running
docker ps | grep qdrant

# Test connection
curl http://localhost:6333/healthz

# Access dashboard
# Open http://localhost:6333/dashboard in browser
```

### Build Errors

```bash
# Clean all build artifacts
pnpm --filter @axon/api exec rm -rf dist
pnpm --filter @axon/middleware exec rm -rf dist
# ... repeat for other packages

# Rebuild
pnpm build
```

### TypeScript Errors

```bash
# Check TypeScript version
pnpm --filter @axon/api exec tsc --version

# Clean and rebuild
rm -rf node_modules
pnpm install
pnpm build
```

### Missing Environment Variables

If you get errors about missing environment variables:

1. Ensure `.env` file exists in the root directory
2. Check that all required variables are set (see `.env.example`)
3. Restart the API server after updating `.env`

---

## 📚 Next Steps

### 1. Explore the API

- Read `apps/api/README.md` for full API documentation
- Test endpoints with Postman or curl
- Try streaming responses with SSE

### 2. Run the Tests

```bash
# Run middleware tests
pnpm --filter @axon/middleware test

# Current status: 67/67 tests passing
```

### 3. Add a Workspace

**Note:** Workspace management is currently placeholder. Full implementation coming in post-MVP.

### 4. Review the Codebase

- **Middleware**: `packages/middleware/src/` - Core orchestration
- **Context Engine**: `packages/context-engine/src/` - Context management
- **Prompt Analyzer**: `packages/prompt-analyzer/src/` - NLP analysis
- **LLM Gateway**: `packages/llm-gateway/src/` - OpenAI integration

### 5. Read the Documentation

- `mvp-roadmap.md` - Development progress and phases
- `IMPLEMENTATION_GUIDE.md` - Detailed technical guide
- `.copilot-instructions.md` - Architecture principles
- `axon_research_paper.md` - Research foundation

---

## 🎓 Learning Resources

### Understanding Axon

1. **Research Paper**: Read `axon_research_paper.md` for the conceptual foundation
2. **Architecture**: Review `.copilot-instructions.md` for design principles
3. **Roadmap**: Check `mvp-roadmap.md` for implementation status

### Key Concepts

- **Context Tiers**: Workspace → Hybrid → Global
- **Prompt Analysis**: Intent → Task Type → Entities → Ambiguity
- **Context Retrieval**: Semantic (60%) + Freshness (20%) + Usage (10%) + Confidence (10%)
- **Injection Strategies**: Prefix, Inline, Suffix, Hybrid
- **Quality Assessment**: Error detection, structure validation, completeness

---

## 🤝 Contributing

We're currently in MVP development (Phase 9). Here's how you can help:

1. **Complete Unit Tests**: ResponsePostProcessor and PromptOrchestrator need tests
2. **Integration Tests**: Test end-to-end workflows
3. **Documentation**: Improve API examples and guides
4. **Bug Fixes**: Report and fix issues

See `mvp-roadmap.md` for the current development status.

---

## 📞 Getting Help

### Common Questions

**Q: Can I run without Docker?**
A: Yes, but you'll need to install MongoDB, Redis, and Qdrant manually. Not recommended for development.

**Q: Do I need an OpenAI API key?**
A: For testing the full pipeline (yes). For testing individual services without LLM (no).

**Q: Which database is required?**
A: MongoDB (metadata), Redis (cache), and Qdrant (vectors) are all required.

**Q: Can I use a different LLM provider?**
A: Currently only OpenAI is fully implemented. Anthropic and Ollama have stubs for future support.

**Q: Is the workspace manager working?**
A: Yes, but the API routes are placeholders. You can use workspace managers directly from code.

### Need More Help?

- Check the troubleshooting section above
- Review package-specific README files
- Open an issue on GitHub
- Check the logs: API logs are printed to console

---

## 🎉 Success!

If you've made it this far, you should have:

- ✅ All infrastructure services running
- ✅ API server responding on port 3000
- ✅ Health checks passing
- ✅ Test endpoint working

**You're ready to start developing with Axon!**

---

**Axon** - Intelligent, context-aware AI assistance through sophisticated context management.

**Version:** MVP v1.0  
**Last Updated:** November 2, 2025
