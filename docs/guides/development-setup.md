# Development Setup Guide

This guide will help you set up your local development environment for Axon.

## Prerequisites

Before you begin, ensure you have the following installed:

| Tool        | Version   | Purpose            | Download                                |
| ----------- | --------- | ------------------ | --------------------------------------- |
| **Node.js** | 20+ (LTS) | JavaScript runtime | [nodejs.org](https://nodejs.org/)       |
| **pnpm**    | 8+        | Package manager    | [pnpm.io](https://pnpm.io/)             |
| **MongoDB** | 6+        | Document database  | [mongodb.com](https://www.mongodb.com/) |
| **Redis**   | 7+        | Cache & queue      | [redis.io](https://redis.io/)           |
| **Qdrant**  | Latest    | Vector database    | [qdrant.tech](https://qdrant.tech/)     |
| **Git**     | Latest    | Version control    | [git-scm.com](https://git-scm.com/)     |

### Verify Installations

```bash
node --version   # Should be v20 or higher
pnpm --version   # Should be 8 or higher
git --version    # Any recent version
```

---

## Installation Methods

### Method 1: Local Installation (Recommended for Development)

#### 1. Install Node.js and pnpm

```bash
# Install Node.js 20 LTS (via nvm recommended)
nvm install 20
nvm use 20

# Install pnpm globally
npm install -g pnpm
```

#### 2. Install MongoDB

**macOS** (via Homebrew):

```bash
brew tap mongodb/brew
brew install mongodb-community@6.0
brew services start mongodb-community@6.0
```

**Linux** (Ubuntu/Debian):

```bash
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
```

**Windows**:

- Download from [MongoDB Download Center](https://www.mongodb.com/try/download/community)
- Run installer and follow instructions
- MongoDB runs as a Windows service automatically

#### 3. Install Redis

**macOS**:

```bash
brew install redis
brew services start redis
```

**Linux**:

```bash
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis
```

**Windows**:

- Download from [Redis Windows](https://github.com/microsoftarchive/redis/releases)
- Or use WSL2 and install Linux version

#### 4. Install Qdrant

**Via Docker** (Recommended):

```bash
docker pull qdrant/qdrant
docker run -p 6333:6333 -v $(pwd)/qdrant_storage:/qdrant/storage qdrant/qdrant
```

**Standalone**:

```bash
# Download latest release from https://github.com/qdrant/qdrant/releases
# Extract and run
./qdrant
```

#### 5. Verify Database Connections

```bash
# MongoDB
mongosh --eval "db.version()"

# Redis
redis-cli ping  # Should return PONG

# Qdrant
curl http://localhost:6333/collections  # Should return empty array
```

---

### Method 2: Docker Compose (Fastest for Getting Started)

#### 1. Install Docker

- Download from [Docker Desktop](https://www.docker.com/products/docker-desktop)
- Or install Docker Engine on Linux

#### 2. Start All Databases

```bash
cd Axon
docker-compose up -d
```

This will start:

- MongoDB on port 27017
- Redis on port 6379
- Qdrant on port 6333

#### 3. Verify

```bash
docker-compose ps  # All services should be "Up"
```

---

## Project Setup

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/Axon.git
cd Axon
```

### 2. Install Dependencies

```bash
# Install all workspace dependencies
pnpm install

# This will install dependencies for:
# - Root workspace
# - All packages (middleware, context-engine, etc.)
# - All apps (api)
```

**Expected output**:

```
Scope: all 8 workspace projects
....................
Progress: resolved 450, reused 420, downloaded 30, added 450, done
```

### 3. Configure Environment Variables

```bash
# Copy example env file
cp .env.example .env

# Edit .env with your configuration
nano .env  # or use your preferred editor
```

**Required Environment Variables**:

```bash
# API Configuration
PORT=3000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/axon
MONGODB_DB_NAME=axon

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# Qdrant (Vector DB)
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=contexts

# OpenAI (Required for LLM)
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_MODEL=gpt-4

# Anthropic (Optional)
ANTHROPIC_API_KEY=your-api-key-here

# Logging
LOG_LEVEL=debug
LOG_FORMAT=json

# Security
JWT_SECRET=your-secret-key-for-jwt
API_RATE_LIMIT=100

# Embedding Model
EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2
EMBEDDING_CACHE_TTL=86400
```

**Getting API Keys**:

- **OpenAI**: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- **Anthropic**: [console.anthropic.com](https://console.anthropic.com/)

### 4. Build All Packages

```bash
# Build everything (uses Turbo for caching)
pnpm build

# This builds in dependency order:
# 1. shared
# 2. llm-gateway, prompt-analyzer, context-engine, etc.
# 3. middleware
# 4. api
```

**Expected output**:

```
• Packages in scope: @axon/shared, @axon/llm-gateway, ...
• Running build in 8 packages
• Remote caching disabled
@axon/shared:build: cache miss, executing...
@axon/shared:build: Done
@axon/middleware:build: cache miss, executing...
...
```

### 5. Run Database Migrations (Initial Setup)

```bash
# Create MongoDB indexes
pnpm run db:migrate

# Seed sample data (optional)
pnpm run db:seed
```

### 6. Run Tests (Verify Setup)

```bash
# Run all tests
pnpm test

# Run specific package tests
pnpm --filter @axon/middleware test
pnpm --filter @axon/context-engine test
```

**Expected output**:

```
✓ All 250+ tests passing
Coverage: 85%+ for critical paths
```

---

## Development Workflow

### Starting the Development Server

```bash
# Start all services in watch mode
pnpm dev

# Or start specific services
pnpm --filter @axon/api dev              # API only
pnpm --filter @axon/middleware dev        # Middleware only
```

**What `pnpm dev` does**:

1. Starts API server on http://localhost:3000
2. Watches for file changes
3. Auto-recompiles TypeScript
4. Hot-reloads on changes

### Working with Multiple Terminals

**Terminal 1** - API Server:

```bash
pnpm --filter @axon/api dev
```

**Terminal 2** - Test Watcher:

```bash
pnpm --filter @axon/middleware test:watch
```

**Terminal 3** - Logs:

```bash
tail -f logs/combined.log
```

### Making Changes

1. **Edit a file** in `packages/middleware/src/`
2. **Save** - TypeScript recompiles automatically
3. **Test** - Run tests manually or use watch mode
4. **Verify** - Check http://localhost:3000/health

### Running Quality Checks

```bash
# Lint all packages
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Type check
pnpm type-check

# Run all quality gates
pnpm quality-gate
```

---

## IDE Setup

### VS Code (Recommended)

#### 1. Install Extensions

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next",
    "vitest.explorer",
    "mongodb.mongodb-vscode",
    "redis.redis-for-vscode"
  ]
}
```

#### 2. Workspace Settings

Create `.vscode/settings.json`:

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.turbo": true
  }
}
```

#### 3. Debug Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug API",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["--filter", "@axon/api", "dev"],
      "console": "integratedTerminal"
    },
    {
      "name": "Debug Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
      "args": ["${file}"],
      "console": "integratedTerminal"
    }
  ]
}
```

---

## Troubleshooting

### MongoDB Connection Issues

**Error**: `MongoNetworkError: connect ECONNREFUSED`

**Solution**:

```bash
# Check if MongoDB is running
ps aux | grep mongod  # Linux/macOS
# or
Get-Process mongod    # Windows PowerShell

# Start MongoDB
brew services start mongodb-community  # macOS
sudo systemctl start mongod            # Linux
net start MongoDB                      # Windows
```

### Redis Connection Issues

**Error**: `Error: Redis connection to localhost:6379 failed`

**Solution**:

```bash
# Check if Redis is running
redis-cli ping  # Should return PONG

# Start Redis
brew services start redis    # macOS
sudo systemctl start redis   # Linux
redis-server                 # Manual start
```

### Qdrant Connection Issues

**Error**: `Error: connect ECONNREFUSED 127.0.0.1:6333`

**Solution**:

```bash
# Check if Qdrant is running
curl http://localhost:6333/collections

# Start Qdrant (Docker)
docker start qdrant

# Or start standalone
./qdrant
```

### Build Failures

**Error**: `TypeError: Cannot read property 'X' of undefined`

**Solution**:

```bash
# Clear all caches
pnpm clean

# Reinstall dependencies
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Rebuild everything
pnpm build
```

### TypeScript Errors

**Error**: `Cannot find module '@axon/shared'`

**Solution**:

```bash
# Build dependencies first
pnpm --filter @axon/shared build

# Then build dependent packages
pnpm build
```

### Test Failures

**Error**: `MongoDB Memory Server download timeout`

**Solution**:

```bash
# Pre-download MongoDB binary
node -e "const { MongoMemoryServer } = require('mongodb-memory-server'); (async () => { const server = await MongoMemoryServer.create(); await server.stop(); })()"

# Then run tests
pnpm test
```

### Port Already in Use

**Error**: `EADDRINUSE: address already in use :::3000`

**Solution**:

```bash
# Find process using port
lsof -ti:3000 | xargs kill -9  # macOS/Linux
netstat -ano | findstr :3000   # Windows

# Or change port in .env
PORT=3001
```

---

## Database Management

### MongoDB

**Access MongoDB Shell**:

```bash
mongosh
use axon
db.contexts.find().limit(5)
```

**View Collections**:

```bash
db.getCollectionNames()
```

**Drop Database** (careful!):

```bash
db.dropDatabase()
```

### Redis

**Access Redis CLI**:

```bash
redis-cli
```

**View Keys**:

```bash
KEYS *
```

**Flush Database** (careful!):

```bash
FLUSHDB
```

### Qdrant

**View Collections**:

```bash
curl http://localhost:6333/collections
```

**View Collection Info**:

```bash
curl http://localhost:6333/collections/contexts
```

**Delete Collection** (careful!):

```bash
curl -X DELETE http://localhost:6333/collections/contexts
```

---

## Useful Commands

### Package Management

```bash
# Add dependency to specific package
pnpm --filter @axon/middleware add lodash

# Add dev dependency
pnpm --filter @axon/middleware add -D @types/lodash

# Remove dependency
pnpm --filter @axon/middleware remove lodash

# Update all dependencies
pnpm update -r
```

### Build & Development

```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter @axon/middleware build

# Clean build artifacts
pnpm clean

# Development mode (watch)
pnpm dev
```

### Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run integration tests only
pnpm test:integration

# Run unit tests only
pnpm test:unit
```

### Code Quality

```bash
# Lint all code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Type check
pnpm type-check
```

---

## Next Steps

Now that your environment is set up:

1. **Explore the Codebase**
   - Start with `README.md` for project overview
   - Read `docs/architecture/` for system design
   - Check out individual package READMEs

2. **Make Your First Change**
   - Pick a "good first issue" from GitHub
   - Create a feature branch
   - Make changes and test
   - Submit a pull request

3. **Join the Community**
   - GitHub Discussions for questions
   - Discord for real-time chat
   - Follow contribution guidelines in `CONTRIBUTING.md`

---

## Additional Resources

- **Architecture Docs**: `/docs/architecture/`
- **API Docs**: `/docs/api/`
- **Contributing Guide**: `CONTRIBUTING.md`
- **Troubleshooting**: `/docs/guides/troubleshooting.md`

---

**Happy coding!** 🚀

If you run into any issues not covered here, please open an issue on GitHub.
