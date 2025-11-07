# Axon - Intelligent Context Management for AI Copilots

> **A scalable middleware architecture that enriches AI prompts with relevant context from multi-tier knowledge bases, enabling contextually-aware and architecturally-consistent responses.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## 🎯 What is Axon?

Axon is a **context management architecture** designed to solve a critical problem in AI-assisted development: **lack of project-specific context**. While modern LLMs are powerful, they lack awareness of your:

- Project structure and architecture
- Coding conventions and patterns
- Technology stack and dependencies
- Historical decisions and evolution
- Domain-specific knowledge

Axon intercepts user prompts, enriches them with relevant context from a multi-tier knowledge base, and delivers contextually-aware responses through intelligent synthesis and injection strategies.

### Key Features

✨ **Intelligent Context Retrieval**: Multi-tier (Workspace → Hybrid → Global) hierarchical search with semantic similarity and re-ranking

📊 **Smart Token Management**: Dynamic token budget allocation based on task types with compression and prioritization

🔄 **Context Evolution**: Continuous learning from feedback, usage patterns, and temporal decay

🎨 **Multiple Workspace Types**: Support for Coding, PKM (Personal Knowledge Management), and Root workspaces

🚀 **Microservices Architecture**: Independently scalable services with clear separation of concerns

⚡ **Streaming Support**: Real-time response streaming via Server-Sent Events (SSE)

🛡️ **Quality Assurance**: Integrated testing, linting, and quality gates

---

## 🏗️ Architecture Overview

Axon follows a **5-layer middleware architecture** with **7 microservices**:

```
┌─────────────────────────────────────────────────────────────────┐
│                     User Interface Layer                         │
│                   (VS Code, CLI, Web UI)                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                   Middleware Layer (Orchestration)               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Prompt     │→ │   Context    │→ │   Prompt     │          │
│  │  Collector   │  │ Synthesizer  │  │  Injector    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│         ↓                                       ↓                │
│  ┌──────────────┐                    ┌──────────────┐          │
│  │ Prompt       │                    │  Response    │          │
│  │ Analyzer     │                    │Post-Processor│          │
│  └──────────────┘                    └──────────────┘          │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│              Context Management Layer (CREE)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Context    │  │   Context    │  │   Context    │          │
│  │  Retrieval   │  │   Storage    │  │  Evolution   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  3-Tier Context Base:                                           │
│  • Workspace Context (Project-specific)                         │
│  • Hybrid Context (Runtime bridge)                              │
│  • Global Context (Cross-workspace knowledge)                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                    LLM Interface Layer                           │
│  ┌──────────────────────────────────────────────────────┐       │
│  │         LLM Gateway (Multi-Provider Support)         │       │
│  │    OpenAI | Anthropic | Ollama (Local Models)       │       │
│  └──────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

### Microservices

| Service               | Purpose            | Key Capabilities                                                 |
| --------------------- | ------------------ | ---------------------------------------------------------------- |
| **middleware**        | Core orchestration | Pipeline coordination, streaming, error handling                 |
| **context-engine**    | Context management | Retrieval, storage, evolution, 4-factor re-ranking               |
| **prompt-analyzer**   | Prompt analysis    | Intent classification, entity extraction, ambiguity detection    |
| **llm-gateway**       | LLM interface      | Multi-provider support, streaming, retry logic, circuit breakers |
| **workspace-manager** | Workspace handling | File scanning, tech stack detection, metadata extraction         |
| **quality-gate**      | QA orchestration   | Test execution, linting, type checking                           |
| **shared**            | Common utilities   | Types, database clients, logging, configuration                  |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+ (LTS recommended)
- **pnpm** 8+ (package manager)
- **MongoDB** 6+ (local or Atlas)
- **Redis** 7+ (local or cloud)
- **Qdrant** (vector database - local or cloud)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/Axon.git
cd Axon

# Install dependencies (uses pnpm workspaces)
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration (API keys, database URLs)

# Build all packages
pnpm build

# Run database setup (MongoDB + Redis + Qdrant)
pnpm run setup:db
```

### Running in Development

```bash
# Start all services in development mode (watch mode)
pnpm dev

# Or start specific services
pnpm --filter @axon/api dev
pnpm --filter @axon/middleware dev

# Run tests
pnpm test              # All tests
pnpm test:unit         # Unit tests only
pnpm test:integration  # Integration tests only

# Lint and format
pnpm lint
pnpm format
```

### API Usage

Once the API is running (default: `http://localhost:3000`), you can process prompts:

**Non-Streaming Request:**

```bash
curl -X POST http://localhost:3000/api/v1/prompts/process \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "How do I fix the bug in user authentication?",
    "workspaceId": "my-project-workspace",
    "source": "vscode",
    "stream": false
  }'
```

**Streaming Request (SSE):**

```bash
curl -N http://localhost:3000/api/v1/prompts/process \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Add a new feature for password reset",
    "workspaceId": "my-project-workspace",
    "source": "vscode",
    "stream": true
  }'
```

---

## 📖 Core Concepts

### Context Tiers

Axon organizes context into **3 hierarchical tiers**:

1. **Workspace Context** (Highest Priority): Project-specific information
   - File structure, dependencies, coding conventions
   - Architecture decisions, tech stack
   - Recent changes, common patterns

2. **Hybrid Context Bridge** (Medium Priority): Runtime integration
   - Combines workspace and global context dynamically
   - Task-specific filtering and relevance boosting

3. **Global Context** (Fallback): Cross-workspace knowledge
   - User preferences, common patterns
   - Reusable solutions, best practices

### Context Retrieval & Re-Ranking

Axon uses a **4-factor re-ranking algorithm** to prioritize context:

1. **Semantic Similarity** (60% weight): Vector embedding similarity
2. **Freshness Score** (20% weight): Exponential decay based on age
3. **Usage Frequency** (10% weight): Normalized usage count
4. **Confidence Boost** (10% weight): Quality score from feedback

### Token Budget Management

Token allocation is **task-specific** to optimize relevance:

| Task Type     | Files | Symbols | Docs | Conversation | Errors | Architecture |
| ------------- | ----- | ------- | ---- | ------------ | ------ | ------------ |
| Bug Fix       | 20%   | 15%     | 10%  | 10%          | 35%    | 10%          |
| Feature Add   | 25%   | 20%     | 15%  | 10%          | 5%     | 25%          |
| Code Review   | 30%   | 25%     | 10%  | 15%          | 5%     | 15%          |
| General Query | 20%   | 15%     | 25%  | 20%          | 5%     | 15%          |

### Injection Strategies

Axon supports **4 injection strategies**:

- **Prefix**: Context in system prompt (best for general queries)
- **Inline**: Context mixed with user prompt (best for code review)
- **Suffix**: Context after user prompt (best for documentation)
- **Hybrid**: Balanced approach (default, adapts to task type)

---

## 🛠️ Development

### Project Structure

```
axon/
├── packages/              # Microservices (monorepo)
│   ├── middleware/        # Core orchestration service
│   ├── context-engine/    # Context management (CREE)
│   ├── prompt-analyzer/   # Prompt analysis & classification
│   ├── llm-gateway/       # LLM provider abstraction
│   ├── workspace-manager/ # Workspace context extraction
│   ├── quality-gate/      # Testing & linting orchestration
│   └── shared/            # Common types, utilities, configs
├── apps/
│   └── api/               # REST API gateway (Express)
├── docs/                  # Documentation
├── scripts/               # Build & utility scripts
├── docker/                # Docker configurations
└── turbo.json             # Turbo build configuration
```

### Technology Stack

- **Runtime**: Node.js 20+, TypeScript 5.3+
- **Build Tool**: Turbo (monorepo caching)
- **Package Manager**: pnpm (workspace support)
- **Web Framework**: Express.js
- **Databases**: MongoDB (document), Redis (cache), Qdrant (vector)
- **Message Queue**: BullMQ (Redis-based)
- **Testing**: Vitest, MongoDB Memory Server
- **Linting**: ESLint, Prettier
- **LLM SDKs**: OpenAI, Anthropic

### Running Tests

```bash
# Unit tests
pnpm test:unit

# Integration tests (requires MongoDB Memory Server)
pnpm test:integration

# Coverage report
pnpm test:coverage

# Watch mode
pnpm test:watch
```

### Code Quality

```bash
# Lint all packages
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Type check
pnpm type-check

# Run all quality checks
pnpm quality-gate
```

---

## 📚 Documentation

- **[Architecture Documentation](./docs/architecture/)**: System design, data flow, sequence diagrams
- **[API Documentation](./docs/api/)**: OpenAPI specs, endpoint details
- **[Developer Guides](./docs/guides/)**: Setup, workflows, contribution guidelines
- **[Service READMEs](./packages/)**: Each service has detailed documentation

### Key Guides

- [Development Setup Guide](./docs/guides/development-setup.md)
- [Deployment Guide](./docs/guides/deployment.md)
- [Contributing Guide](./CONTRIBUTING.md)
- [Troubleshooting](./docs/guides/troubleshooting.md)

---

## 🧪 Testing

Axon has comprehensive testing at multiple levels:

- **Unit Tests**: 96.15% coverage for middleware, full coverage for critical paths
- **Integration Tests**: Database operations, service interactions
- **E2E Tests**: Complete workflows (deferred to post-MVP)

**Current Test Results** (Phase 9.2 - Integration Testing):

```
✅ 15/15 database integration tests passing
✅ MongoDB operations (CRUD, batching, indexing)
✅ Redis operations (caching, TTL, JSON storage)
✅ Combined patterns (cache integration, invalidation)
✅ Workspace management (metadata, constraints)
```

---

## 🚢 Deployment

### Docker Deployment

```bash
# Build Docker images
pnpm docker:build

# Run with docker-compose (development)
docker-compose -f docker/docker-compose.dev.yml up

# Run with docker-compose (production)
docker-compose -f docker/docker-compose.prod.yml up
```

### Environment Variables

Key environment variables (see `.env.example` for full list):

```bash
# API Configuration
PORT=3000
NODE_ENV=production

# MongoDB
MONGODB_URI=mongodb://localhost:27017/axon

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Qdrant (Vector DB)
QDRANT_URL=http://localhost:6333

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4

# Security
JWT_SECRET=your-secret-key
API_RATE_LIMIT=100
```

---

## 🎯 Roadmap

### MVP (Current Phase)

- [x] Core middleware orchestration
- [x] Multi-tier context retrieval
- [x] Prompt analysis & entity extraction
- [x] LLM gateway with streaming
- [x] Workspace management (Coding, PKM, Root)
- [x] Quality gate integration
- [x] REST API with SSE streaming
- [ ] Complete documentation ⏸️ (Phase 10 - In Progress)
- [ ] Production deployment

### Post-MVP (Phase 2)

- [ ] Advanced context evolution with ML
- [ ] Graph database integration (Neo4j)
- [ ] Multi-user support
- [ ] Web UI dashboard
- [ ] Real-time collaboration
- [ ] Advanced analytics & monitoring
- [ ] Python microservices for ML/NLP
- [ ] Custom model fine-tuning
- [ ] Plugin system for extensibility

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and linting (`pnpm test && pnpm lint`)
5. Commit with conventional commits (`git commit -m 'feat: add amazing feature'`)
6. Push to your fork (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `refactor:` Code refactoring
- `test:` Test additions/changes
- `chore:` Maintenance tasks

---

## 📊 Performance

Axon is designed for **low-latency, high-throughput** operation:

| Metric                 | Target    | Current (MVP) |
| ---------------------- | --------- | ------------- |
| Prompt Analysis        | <200ms    | ~150ms        |
| Context Retrieval      | <500ms    | ~300ms        |
| Token Synthesis        | <100ms    | ~80ms         |
| Full Pipeline (median) | <3s       | ~2.5s         |
| Full Pipeline (p95)    | <5s       | ~4s           |
| Throughput             | >10 req/s | ~15 req/s     |

_Benchmarks conducted with typical coding workspace (~1000 files, 10MB context)_

---

## 🛡️ Security

- **Input Validation**: All inputs validated with Zod schemas
- **Rate Limiting**: 100 requests per 15 minutes per IP (configurable)
- **XSS Protection**: Script tag sanitization in user inputs
- **API Authentication**: JWT-based (post-MVP)
- **Dependency Scanning**: Regular `npm audit` and security updates
- **Environment Secrets**: Never committed, use `.env` or secret managers

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Inspired by research in context-aware AI assistants
- Built with modern TypeScript and Node.js ecosystem
- Powered by OpenAI, Anthropic, and open-source LLMs
- Vector search powered by Qdrant

---

## 📞 Support

- **Documentation**: [docs/](./docs/)
- **Issues**: [GitHub Issues](https://github.com/yourusername/Axon/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/Axon/discussions)

---

**Built with ❤️ by the Axon team**

_Making AI copilots contextually intelligent, one prompt at a time._
