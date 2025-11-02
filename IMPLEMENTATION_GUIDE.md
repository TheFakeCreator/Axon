# Axon Implementation Guide

## Microservices Architecture with TypeScript + Express + pnpm

> **Reference**: This guide provides detailed implementation patterns, code examples, and technical specifications for building Axon. Use this alongside the MVP roadmap for development.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Technology Stack](#technology-stack)
3. [Database Schemas](#database-schemas)
4. [Service Implementations](#service-implementations)
5. [API Design](#api-design)
6. [Code Examples](#code-examples)
7. [Configuration Management](#configuration-management)
8. [Best Practices](#best-practices)

---

## 1. Project Structure

### Complete Monorepo Layout

```
axon/
├── packages/                    # Microservices packages
│   ├── middleware/              # Core orchestration service
│   │   ├── src/
│   │   │   ├── services/
│   │   │   │   ├── PromptCollector.ts
│   │   │   │   ├── ContextSynthesizer.ts
│   │   │   │   ├── Injector.ts
│   │   │   │   ├── ResponsePostProcessor.ts
│   │   │   │   └── PromptOrchestrator.ts
│   │   │   ├── api/            # Routes (if needed)
│   │   │   ├── models/
│   │   │   ├── utils/
│   │   │   └── index.ts
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   └── integration/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── context-engine/          # Context management service
│   │   ├── src/
│   │   │   ├── retrieval/
│   │   │   │   ├── ContextRetriever.ts
│   │   │   │   └── RetrievalStrategies.ts
│   │   │   ├── evolution/
│   │   │   │   ├── ContextEvolutionEngine.ts
│   │   │   │   └── FeedbackProcessor.ts
│   │   │   ├── storage/
│   │   │   │   ├── VectorStore.ts
│   │   │   │   ├── PineconeAdapter.ts
│   │   │   │   └── QdrantAdapter.ts
│   │   │   ├── services/
│   │   │   │   ├── EmbeddingService.ts
│   │   │   │   └── ContextCache.ts
│   │   │   └── index.ts
│   │   ├── tests/
│   │   └── package.json
│   │
│   ├── prompt-analyzer/         # Prompt analysis service
│   │   ├── src/
│   │   │   ├── classifiers/
│   │   │   │   ├── IntentClassifier.ts
│   │   │   │   └── TaskTypeIdentifier.ts
│   │   │   ├── extractors/
│   │   │   │   ├── EntityExtractor.ts
│   │   │   │   └── AmbiguityDetector.ts
│   │   │   ├── models/          # ML model wrappers (future)
│   │   │   ├── services/
│   │   │   │   └── PromptAnalyzer.ts
│   │   │   └── index.ts
│   │   ├── tests/
│   │   └── package.json
│   │
│   ├── llm-gateway/             # LLM interface abstraction
│   │   ├── src/
│   │   │   ├── providers/
│   │   │   │   ├── OpenAIProvider.ts
│   │   │   │   ├── AnthropicProvider.ts
│   │   │   │   └── OllamaProvider.ts
│   │   │   ├── streaming/
│   │   │   │   └── StreamHandler.ts
│   │   │   ├── retry/
│   │   │   │   ├── RetryStrategy.ts
│   │   │   │   └── CircuitBreaker.ts
│   │   │   ├── services/
│   │   │   │   └── LLMService.ts
│   │   │   └── index.ts
│   │   ├── tests/
│   │   └── package.json
│   │
│   ├── quality-gate/            # Quality assurance service
│   │   ├── src/
│   │   │   ├── testing/
│   │   │   │   └── TestExecutor.ts
│   │   │   ├── linting/
│   │   │   │   └── LintService.ts
│   │   │   ├── validation/
│   │   │   │   └── Validator.ts
│   │   │   ├── services/
│   │   │   │   └── QualityGateOrchestrator.ts
│   │   │   └── index.ts
│   │   ├── tests/
│   │   └── package.json
│   │
│   ├── workspace-manager/       # Workspace context management
│   │   ├── src/
│   │   │   ├── coding/
│   │   │   │   ├── CodingWorkspaceHandler.ts
│   │   │   │   └── TechStackDetector.ts
│   │   │   ├── pkm/             # Future
│   │   │   │   └── PKMWorkspaceHandler.ts
│   │   │   ├── root/            # Future
│   │   │   │   └── RootWorkspaceHandler.ts
│   │   │   ├── extractors/
│   │   │   │   ├── FileStructureAnalyzer.ts
│   │   │   │   └── ConventionExtractor.ts
│   │   │   ├── services/
│   │   │   │   └── WorkspaceService.ts
│   │   │   └── index.ts
│   │   ├── tests/
│   │   └── package.json
│   │
│   ├── shared/                  # Shared types and utilities
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   ├── workspace.ts
│   │   │   │   ├── context.ts
│   │   │   │   ├── prompt.ts
│   │   │   │   ├── interaction.ts
│   │   │   │   └── index.ts
│   │   │   ├── utils/
│   │   │   │   ├── logger.ts
│   │   │   │   ├── mongodb.ts
│   │   │   │   ├── redis.ts
│   │   │   │   └── errors.ts
│   │   │   ├── constants/
│   │   │   │   ├── task-types.ts
│   │   │   │   ├── token-limits.ts
│   │   │   │   └── index.ts
│   │   │   ├── config/
│   │   │   │   └── schema.ts
│   │   │   └── index.ts
│   │   ├── tests/
│   │   └── package.json
│   │
│   └── cli/                     # CLI tool (future)
│       ├── src/
│       │   └── index.ts
│       └── package.json
│
├── apps/                        # Application entry points
│   ├── api/                     # Main API gateway
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── prompts.ts
│   │   │   │   ├── workspaces.ts
│   │   │   │   ├── contexts.ts
│   │   │   │   ├── interactions.ts
│   │   │   │   └── analytics.ts
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── validation.ts
│   │   │   │   ├── error-handler.ts
│   │   │   │   └── rate-limit.ts
│   │   │   ├── services/
│   │   │   │   └── ServiceInitializer.ts
│   │   │   └── server.ts
│   │   ├── tests/
│   │   └── package.json
│   │
│   └── web/                     # Web UI (future)
│       ├── src/
│       └── package.json
│
├── docs/                        # Documentation
│   ├── architecture/
│   │   ├── system-overview.md
│   │   ├── service-interactions.md
│   │   └── data-flow.md
│   ├── api/
│   │   └── openapi.yaml
│   └── guides/
│       ├── development.md
│       └── deployment.md
│
├── scripts/                     # Build and utility scripts
│   ├── build.sh
│   ├── build-docker.sh
│   ├── deploy-dev.sh
│   └── seed-database.ts
│
├── docker/                      # Docker configurations
│   ├── Dockerfile.api
│   ├── docker-compose.dev.yml
│   └── docker-compose.prod.yml
│
├── .github/                     # GitHub Actions
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
│
├── turbo.json                   # Turbo configuration
├── pnpm-workspace.yaml          # pnpm workspace config
├── package.json                 # Root package.json
├── tsconfig.base.json           # Base TypeScript config
├── .eslintrc.js                 # ESLint configuration
├── .prettierrc                  # Prettier configuration
├── .env.example                 # Environment variables template
└── README.md
```

### Initial Setup Commands

```bash
# Create project directory
mkdir axon && cd axon

# Initialize root package.json
pnpm init

# Create workspace config
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - 'packages/*'
  - 'apps/*'
EOF

# Install dev dependencies
pnpm add -D turbo
pnpm add -D typescript @types/node tsx
pnpm add -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
pnpm add -D prettier eslint-config-prettier
pnpm add -D vitest @vitest/ui
pnpm add -D husky lint-staged commitlint @commitlint/cli @commitlint/config-conventional

# Create base TypeScript config
cat > tsconfig.base.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": ".",
    "paths": {
      "@axon/shared": ["./packages/shared/src"],
      "@axon/middleware": ["./packages/middleware/src"],
      "@axon/context-engine": ["./packages/context-engine/src"],
      "@axon/prompt-analyzer": ["./packages/prompt-analyzer/src"],
      "@axon/llm-gateway": ["./packages/llm-gateway/src"],
      "@axon/quality-gate": ["./packages/quality-gate/src"],
      "@axon/workspace-manager": ["./packages/workspace-manager/src"]
    }
  },
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
EOF

# Create Turbo config
cat > turbo.json << 'EOF'
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": []
    },
    "lint": {
      "outputs": []
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
EOF

# Create directory structure
mkdir -p packages/{middleware,context-engine,prompt-analyzer,llm-gateway,quality-gate,workspace-manager,shared,cli}/src
mkdir -p apps/{api,web}/src
mkdir -p docs/{architecture,api,guides}
mkdir -p scripts docker .github/workflows
```

---

## 2. Technology Stack

### Core Dependencies by Package

#### **packages/shared**

```json
{
  "dependencies": {
    "mongodb": "^6.0.0",
    "ioredis": "^5.3.0",
    "winston": "^3.11.0",
    "zod": "^3.22.4",
    "envalid": "^8.0.0",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0"
  }
}
```

#### **packages/llm-gateway**

```json
{
  "dependencies": {
    "openai": "^4.20.0",
    "@anthropic-ai/sdk": "^0.9.0",
    "axios": "^1.6.0",
    "@axon/shared": "workspace:*"
  }
}
```

#### **packages/prompt-analyzer**

```json
{
  "dependencies": {
    "natural": "^6.10.0",
    "compromise": "^14.10.0",
    "@axon/shared": "workspace:*"
  }
}
```

#### **packages/context-engine**

```json
{
  "dependencies": {
    "@xenova/transformers": "^2.10.0",
    "@pinecone-database/pinecone": "^1.1.0",
    "@qdrant/js-client-rest": "^1.7.0",
    "ml-distance": "^4.0.1",
    "@axon/shared": "workspace:*"
  }
}
```

#### **packages/middleware**

```json
{
  "dependencies": {
    "@axon/shared": "workspace:*",
    "@axon/prompt-analyzer": "workspace:*",
    "@axon/context-engine": "workspace:*",
    "@axon/llm-gateway": "workspace:*",
    "@axon/quality-gate": "workspace:*"
  }
}
```

#### **apps/api**

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "morgan": "^1.10.0",
    "express-rate-limit": "^7.1.5",
    "express-validator": "^7.0.1",
    "@axon/middleware": "workspace:*",
    "@axon/workspace-manager": "workspace:*",
    "@axon/shared": "workspace:*"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/morgan": "^1.9.9",
    "supertest": "^6.3.3",
    "@types/supertest": "^6.0.2"
  }
}
```

---

## 3. Database Schemas

### MongoDB Collections

#### **workspaces Collection**

```typescript
// packages/shared/src/types/workspace.ts
import { ObjectId } from 'mongodb';

export enum WorkspaceType {
  ROOT = 'root',
  CODING = 'coding',
  PKM = 'pkm',
}

export interface TechStack {
  frontend?: string[];
  backend?: string[];
  database?: string[];
  testing?: string[];
  buildTools?: string[];
}

export interface CodingConventions {
  codeStyle?: string;
  commitFormat?: string;
  branchingStrategy?: string;
  namingConventions?: Record<string, string>;
}

export interface WorkspaceMetadata {
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt: Date;
  totalPrompts: number;
  totalContextItems: number;
}

export interface WorkspaceConfig {
  techStack?: TechStack;
  conventions?: CodingConventions;
  noteStructure?: {
    folderOrganization?: string;
    taggingSystem?: string[];
    templateNames?: string[];
  };
}

export interface WorkspacePreferences {
  contextPriority: 'workspace' | 'hybrid' | 'global';
  autoContextUpdate: boolean;
  qualityGatesEnabled: boolean;
}

export interface IWorkspace {
  _id: ObjectId;
  userId: string;
  type: WorkspaceType;
  name: string;
  path: string; // Filesystem path
  metadata: WorkspaceMetadata;
  config: WorkspaceConfig;
  preferences: WorkspacePreferences;
}
```

#### **contexts Collection**

```typescript
// packages/shared/src/types/context.ts
import { ObjectId } from 'mongodb';

export enum ContextTier {
  WORKSPACE = 'workspace',
  GLOBAL = 'global',
  HYBRID = 'hybrid',
}

export enum ContextCategory {
  CODE = 'code',
  CONFIG = 'config',
  DOCUMENTATION = 'documentation',
  PATTERN = 'pattern',
  NOTE = 'note',
  CONCEPT = 'concept',
}

export interface ContextSource {
  type: 'file' | 'interaction' | 'manual' | 'imported';
  path?: string;
  interactionId?: string;
  importedFrom?: string;
}

export interface ContextQuality {
  relevanceScore: number;
  accuracyScore: number;
  freshnessScore: number;
}

export interface IContext {
  _id: ObjectId;
  workspaceId: ObjectId | null; // null for global contexts
  type: ContextTier;
  category: ContextCategory;

  // Content
  title: string;
  description: string;
  content: string; // Full text content
  summary: string; // Compressed version

  // Metadata
  source: ContextSource;
  relatedContexts: ObjectId[];
  tags: string[];

  // Embeddings
  embeddingId: string; // Reference to vector DB

  // Evolution tracking
  confidence: number; // 0-1
  usageCount: number;
  lastUsedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  version: number;

  // Quality metrics
  quality: ContextQuality;
}
```

#### **interactions Collection**

```typescript
// packages/shared/src/types/interaction.ts
import { ObjectId } from 'mongodb';

export interface PromptMetadata {
  timestamp: Date;
  activeFile?: string;
  cursorPosition?: { line: number; column: number };
  selectedText?: string;
  mode: 'chat' | 'inline' | 'command';
}

export interface Entity {
  type: string;
  value: string;
  confidence: number;
}

export interface AnalysisResult {
  intent: 'coding' | 'pkm' | 'general';
  taskType: string;
  entities: Entity[];
  ambiguityScore: number;
  clarificationNeeded: boolean;
}

export interface ContextUsed {
  contextId: ObjectId;
  relevanceScore: number;
  tokenCount: number;
}

export interface ResponseMetrics {
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
  latency: {
    analysis: number;
    contextRetrieval: number;
    llmCall: number;
    postProcessing: number;
    total: number;
  };
}

export interface InteractionFeedback {
  userAccepted: boolean;
  userEdited: boolean;
  thumbsUp?: boolean;
  comment?: string;
  qualityScore?: number; // 1-5
}

export interface QualityGateResults {
  testsRun: string[];
  testsPassed: boolean;
  lintChecked: boolean;
  lintErrors: string[];
  documentationUpdated: boolean;
}

export interface IInteraction {
  _id: ObjectId;
  workspaceId: ObjectId;
  userId: string;

  // Request
  request: {
    rawPrompt: string;
    metadata: PromptMetadata;
  };

  // Analysis
  analysis: AnalysisResult;

  // Context used
  contextsUsed: ContextUsed[];

  // Response
  response: {
    enrichedPrompt: string;
    llmResponse: string;
    metrics: ResponseMetrics;
  };

  // Feedback
  feedback?: InteractionFeedback;

  // Quality gates
  qualityGates?: QualityGateResults;

  createdAt: Date;
}
```

### Vector Database Schema

```typescript
// packages/context-engine/src/storage/types.ts

export interface VectorMetadata {
  contextId: string; // MongoDB ObjectId as string
  workspaceId: string;
  type: 'workspace' | 'global' | 'hybrid';
  category: string;
  title: string;
  summary: string;
  tags: string[];
  createdAt: number; // Unix timestamp
  usageCount: number;
  confidence: number;
}

export interface VectorDocument {
  id: string; // UUID
  vector: number[]; // 384-dim (MiniLM) or 1536-dim (OpenAI)
  metadata: VectorMetadata;
}

export interface SearchResult {
  id: string;
  score: number;
  metadata: VectorMetadata;
}
```

### Redis Cache Structure

```typescript
// packages/shared/src/utils/redis.ts

export interface CacheKeyPatterns {
  // Context cache
  context: (contextId: string) => string; // `context:${contextId}`
  workspaceContexts: (workspaceId: string) => string; // `workspace:${workspaceId}:contexts`

  // Embedding cache
  embedding: (textHash: string) => string; // `embedding:${textHash}`

  // Prompt analysis cache
  analysis: (promptHash: string) => string; // `analysis:${promptHash}`

  // User session
  session: (userId: string) => string; // `session:${userId}`

  // Rate limiting
  rateLimit: (userId: string) => string; // `ratelimit:${userId}`
}
```

---

## 4. Service Implementations

### Shared Package - Core Utilities

#### **Logger Utility**

```typescript
// packages/shared/src/utils/logger.ts
import winston from 'winston';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        })
      ),
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
});

// Create child logger with context
export function createLogger(context: string) {
  return logger.child({ context });
}
```

#### **MongoDB Connection**

```typescript
// packages/shared/src/utils/mongodb.ts
import { MongoClient, Db } from 'mongodb';
import { logger } from './logger';

class MongoDBConnection {
  private client: MongoClient | null = null;
  private db: Db | null = null;

  async connect(uri: string, dbName: string): Promise<void> {
    try {
      this.client = new MongoClient(uri, {
        maxPoolSize: 50,
        minPoolSize: 10,
        maxIdleTimeMS: 30000,
        retryWrites: true,
        retryReads: true,
      });

      await this.client.connect();
      this.db = this.client.db(dbName);

      // Create indexes
      await this.createIndexes();

      logger.info('MongoDB connected successfully', { dbName });
    } catch (error) {
      logger.error('MongoDB connection error:', error);
      throw error;
    }
  }

  private async createIndexes(): Promise<void> {
    if (!this.db) return;

    // Workspaces indexes
    await this.db.collection('workspaces').createIndex({ userId: 1 });
    await this.db.collection('workspaces').createIndex({ type: 1 });
    await this.db.collection('workspaces').createIndex({ 'metadata.lastAccessedAt': -1 });

    // Contexts indexes
    await this.db.collection('contexts').createIndex({ workspaceId: 1 });
    await this.db.collection('contexts').createIndex({ type: 1, category: 1 });
    await this.db.collection('contexts').createIndex({ embeddingId: 1 });
    await this.db.collection('contexts').createIndex({ tags: 1 });
    await this.db.collection('contexts').createIndex({ lastUsedAt: -1 });
    await this.db.collection('contexts').createIndex({ confidence: -1 });

    // Interactions indexes
    await this.db.collection('interactions').createIndex({ workspaceId: 1 });
    await this.db.collection('interactions').createIndex({ userId: 1 });
    await this.db.collection('interactions').createIndex({ createdAt: -1 });
    await this.db.collection('interactions').createIndex({ 'analysis.taskType': 1 });

    logger.info('MongoDB indexes created');
  }

  getDb(): Db {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      logger.info('MongoDB disconnected');
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.db?.admin().ping();
      return true;
    } catch {
      return false;
    }
  }
}

export const mongodb = new MongoDBConnection();
```

#### **Redis Connection**

```typescript
// packages/shared/src/utils/redis.ts
import Redis from 'ioredis';
import { logger } from './logger';

class RedisConnection {
  private client: Redis | null = null;

  connect(url: string): void {
    this.client = new Redis(url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.client.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    this.client.on('error', (error) => {
      logger.error('Redis connection error:', error);
    });
  }

  getClient(): Redis {
    if (!this.client) {
      throw new Error('Redis not connected. Call connect() first.');
    }
    return this.client;
  }

  async get<T>(key: string): Promise<T | null> {
    const client = this.getClient();
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const client = this.getClient();
    const stringValue = JSON.stringify(value);

    if (ttl) {
      await client.setex(key, ttl, stringValue);
    } else {
      await client.set(key, stringValue);
    }
  }

  async delete(key: string): Promise<void> {
    const client = this.getClient();
    await client.del(key);
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client?.ping();
      return true;
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      logger.info('Redis disconnected');
    }
  }
}

export const redis = new RedisConnection();
```

---

## 5. API Design

### Complete REST API Specification

#### **Workspace Management Endpoints**

```typescript
// apps/api/src/routes/workspaces.ts
import { Router } from 'express';
import { z } from 'zod';
import { WorkspaceService } from '@axon/workspace-manager';

const router = Router();

// Schemas
const CreateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['root', 'coding', 'pkm']),
  path: z.string().min(1),
  config: z
    .object({
      techStack: z
        .object({
          frontend: z.array(z.string()).optional(),
          backend: z.array(z.string()).optional(),
          database: z.array(z.string()).optional(),
          testing: z.array(z.string()).optional(),
        })
        .optional(),
      conventions: z
        .object({
          codeStyle: z.string().optional(),
          commitFormat: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

const UpdateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  config: z.any().optional(),
  preferences: z.any().optional(),
});

export function createWorkspaceRoutes(workspaceService: WorkspaceService) {
  // Create workspace
  router.post('/', async (req, res, next) => {
    try {
      const data = CreateWorkspaceSchema.parse(req.body);
      const workspace = await workspaceService.createWorkspace({
        ...data,
        userId: req.user!.id, // From auth middleware
      });

      res.status(201).json({ workspace });
    } catch (error) {
      next(error);
    }
  });

  // Get workspace
  router.get('/:id', async (req, res, next) => {
    try {
      const workspace = await workspaceService.getWorkspace(req.params.id);

      if (!workspace) {
        return res.status(404).json({ error: 'Workspace not found' });
      }

      res.json({ workspace });
    } catch (error) {
      next(error);
    }
  });

  // List workspaces
  router.get('/', async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const { type, limit = 50, offset = 0 } = req.query;

      const workspaces = await workspaceService.listWorkspaces({
        userId,
        type: type as string | undefined,
        limit: Number(limit),
        offset: Number(offset),
      });

      res.json({ workspaces });
    } catch (error) {
      next(error);
    }
  });

  // Update workspace
  router.patch('/:id', async (req, res, next) => {
    try {
      const data = UpdateWorkspaceSchema.parse(req.body);
      const workspace = await workspaceService.updateWorkspace(req.params.id, data);

      res.json({ workspace });
    } catch (error) {
      next(error);
    }
  });

  // Delete workspace
  router.delete('/:id', async (req, res, next) => {
    try {
      await workspaceService.deleteWorkspace(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  // Rescan workspace for context
  router.post('/:id/scan', async (req, res, next) => {
    try {
      const result = await workspaceService.scanWorkspace(req.params.id);
      res.json({ result });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
```

#### **Prompt Processing Endpoints**

```typescript
// apps/api/src/routes/prompts.ts
import { Router } from 'express';
import { z } from 'zod';
import { PromptOrchestrator } from '@axon/middleware';

const router = Router();

const ProcessPromptSchema = z.object({
  workspaceId: z.string(),
  prompt: z.string().min(1).max(10000),
  metadata: z
    .object({
      activeFile: z.string().optional(),
      cursorPosition: z
        .object({
          line: z.number(),
          column: z.number(),
        })
        .optional(),
      selectedText: z.string().optional(),
      mode: z.enum(['chat', 'inline', 'command']).default('chat'),
    })
    .optional(),
  options: z
    .object({
      streamResponse: z.boolean().default(true),
      runQualityGates: z.boolean().default(false),
      maxTokens: z.number().min(1000).max(32000).default(8000),
    })
    .optional(),
});

export function createPromptRoutes(orchestrator: PromptOrchestrator) {
  // Process prompt (with streaming support)
  router.post('/process', async (req, res, next) => {
    try {
      const request = ProcessPromptSchema.parse(req.body);

      if (request.options?.streamResponse !== false) {
        // Server-Sent Events for streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

        for await (const event of orchestrator.orchestrateStream(request)) {
          res.write(`event: ${event.type}\n`);
          res.write(`data: ${JSON.stringify(event.data)}\n\n`);

          if (event.type === 'error') {
            break;
          }
        }

        res.end();
      } else {
        // Non-streaming response
        const result = await orchestrator.orchestrate(request);
        res.json(result);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
      } else {
        next(error);
      }
    }
  });

  return router;
}
```

---

## 6. Code Examples

### Example: Embedding Service

```typescript
// packages/context-engine/src/services/EmbeddingService.ts
import { pipeline, Pipeline } from '@xenova/transformers';
import { createLogger } from '@axon/shared';
import crypto from 'crypto';

const logger = createLogger('EmbeddingService');

export class EmbeddingService {
  private model: Pipeline | null = null;
  private readonly modelName = 'Xenova/all-MiniLM-L6-v2';
  private readonly dimension = 384;

  async initialize(): Promise<void> {
    logger.info('Initializing embedding model', { model: this.modelName });
    this.model = await pipeline('feature-extraction', this.modelName);
    logger.info('Embedding model initialized');
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.model) {
      throw new Error('Model not initialized. Call initialize() first.');
    }

    const startTime = Date.now();
    const output = await this.model(text, {
      pooling: 'mean',
      normalize: true,
    });

    const embedding = Array.from(output.data as Float32Array);
    const duration = Date.now() - startTime;

    logger.debug('Generated embedding', {
      textLength: text.length,
      duration,
      dimension: embedding.length,
    });

    return embedding;
  }

  async generateBatch(texts: string[]): Promise<number[][]> {
    const startTime = Date.now();
    const embeddings = await Promise.all(texts.map((text) => this.generateEmbedding(text)));
    const duration = Date.now() - startTime;

    logger.info('Generated batch embeddings', {
      count: texts.length,
      duration,
      avgPerText: Math.round(duration / texts.length),
    });

    return embeddings;
  }

  hashText(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  getDimension(): number {
    return this.dimension;
  }
}
```

### Example: Context Retriever

```typescript
// packages/context-engine/src/retrieval/ContextRetriever.ts
import { EmbeddingService } from '../services/EmbeddingService';
import { VectorStore, SearchResult } from '../storage/VectorStore';
import { mongodb, createLogger } from '@axon/shared';
import type { RetrievedContext, Entity } from '@axon/shared/types';

const logger = createLogger('ContextRetriever');

export interface RetrievalRequest {
  workspaceId: string;
  query: string;
  intent: string;
  taskType: string;
  entities: Entity[];
  maxResults?: number;
}

export class ContextRetriever {
  constructor(
    private embeddingService: EmbeddingService,
    private vectorStore: VectorStore
  ) {}

  async retrieve(request: RetrievalRequest): Promise<RetrievedContext[]> {
    const startTime = Date.now();
    logger.info('Starting context retrieval', {
      workspaceId: request.workspaceId,
      taskType: request.taskType,
    });

    // Step 1: Construct semantic query
    const semanticQuery = this.constructSemanticQuery(request);
    logger.debug('Semantic query constructed', { query: semanticQuery });

    // Step 2: Generate query embedding
    const queryEmbedding = await this.embeddingService.generateEmbedding(semanticQuery);

    // Step 3: Vector search with filters
    const filter = this.buildFilter(request);
    const vectorResults = await this.vectorStore.search(
      queryEmbedding,
      request.maxResults || 20,
      filter
    );

    logger.debug('Vector search completed', {
      resultsCount: vectorResults.length,
    });

    // Step 4: Fetch full contexts from MongoDB
    const contexts = await this.fetchFullContexts(vectorResults);

    // Step 5: Re-rank based on multiple factors
    const rankedContexts = this.rerank(contexts, request);

    // Step 6: Apply diversity
    const diverseContexts = this.applyDiversity(rankedContexts);

    const finalResults = diverseContexts.slice(0, request.maxResults || 10);

    logger.info('Context retrieval completed', {
      duration: Date.now() - startTime,
      resultsCount: finalResults.length,
    });

    return finalResults;
  }

  private constructSemanticQuery(request: RetrievalRequest): string {
    let query = request.query;

    // Enhance with entities
    const entityValues = request.entities.map((e) => e.value).join(' ');

    if (entityValues) {
      query += ` ${entityValues}`;
    }

    // Add task type for better context
    query += ` ${request.taskType.replace('_', ' ')}`;

    return query;
  }

  private buildFilter(request: RetrievalRequest): Record<string, any> {
    const filter: Record<string, any> = {
      workspaceId: request.workspaceId,
    };

    // Task-specific category filtering
    const categoryMap: Record<string, string[]> = {
      bug_fix: ['code', 'pattern', 'error'],
      feature_add: ['code', 'pattern', 'documentation'],
      documentation: ['documentation', 'code'],
      refactor: ['code', 'pattern'],
      testing: ['code', 'pattern', 'config'],
    };

    if (request.taskType in categoryMap) {
      filter.category = { $in: categoryMap[request.taskType] };
    }

    return filter;
  }

  private async fetchFullContexts(
    vectorResults: SearchResult[]
  ): Promise<Array<RetrievedContext & { vectorScore: number }>> {
    const db = mongodb.getDb();
    const contextsCollection = db.collection('contexts');

    const contextIds = vectorResults.map((r) => r.id);
    const contexts = await contextsCollection.find({ _id: { $in: contextIds } }).toArray();

    return contexts.map((ctx) => {
      const vectorResult = vectorResults.find((vr) => vr.id === ctx._id.toString())!;

      return {
        contextId: ctx._id.toString(),
        content: ctx.content,
        summary: ctx.summary,
        relevanceScore: vectorResult.score,
        category: ctx.category,
        metadata: ctx.metadata || {},
        vectorScore: vectorResult.score,
      };
    });
  }

  private rerank(
    contexts: Array<RetrievedContext & { vectorScore: number }>,
    request: RetrievalRequest
  ): RetrievedContext[] {
    return contexts
      .map((ctx) => {
        let score = ctx.vectorScore * 0.6; // 60% semantic similarity

        // Freshness boost (20%)
        const ageInDays = this.getAgeInDays(ctx.metadata.updatedAt);
        const freshnessBoost = Math.max(0, 1 - ageInDays / 30) * 0.2;
        score += freshnessBoost;

        // Usage boost (10%)
        const usageBoost = Math.min(ctx.metadata.usageCount / 100, 1) * 0.1;
        score += usageBoost;

        // Confidence boost (10%)
        const confidenceBoost = ctx.metadata.confidence * 0.1;
        score += confidenceBoost;

        return {
          ...ctx,
          relevanceScore: score,
        };
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  private applyDiversity(contexts: RetrievedContext[]): RetrievedContext[] {
    const diverse: RetrievedContext[] = [];
    const categoryCounts = new Map<string, number>();

    for (const ctx of contexts) {
      const count = categoryCounts.get(ctx.category) || 0;

      // Max 3 contexts per category
      if (count < 3) {
        diverse.push(ctx);
        categoryCounts.set(ctx.category, count + 1);
      }

      if (diverse.length >= 10) break;
    }

    return diverse;
  }

  private getAgeInDays(date: Date): number {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    return diff / (1000 * 60 * 60 * 24);
  }
}
```

---

## 7. Configuration Management

### Environment Variables Schema

```typescript
// packages/shared/src/config/schema.ts
import { cleanEnv, str, num, bool, url } from 'envalid';
import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

export const config = cleanEnv(process.env, {
  // Server
  NODE_ENV: str({ choices: ['development', 'test', 'staging', 'production'] }),
  PORT: num({ default: 3000 }),
  LOG_LEVEL: str({
    choices: ['error', 'warn', 'info', 'debug'],
    default: 'info',
  }),

  // MongoDB
  MONGO_URI: url(),
  MONGO_DATABASE: str(),

  // Redis
  REDIS_URL: url(),

  // Vector Database
  VECTOR_DB_TYPE: str({ choices: ['pinecone', 'qdrant'], default: 'qdrant' }),

  // Pinecone (if using)
  PINECONE_API_KEY: str({ default: '' }),
  PINECONE_ENVIRONMENT: str({ default: '' }),
  PINECONE_INDEX: str({ default: 'axon-contexts' }),

  // Qdrant (if using)
  QDRANT_URL: url({ default: 'http://localhost:6333' }),
  QDRANT_API_KEY: str({ default: '' }),
  QDRANT_COLLECTION: str({ default: 'axon_contexts' }),

  // LLM Providers
  OPENAI_API_KEY: str(),
  ANTHROPIC_API_KEY: str({ default: '' }),
  OLLAMA_URL: url({ default: 'http://localhost:11434' }),

  // Context Engine
  MAX_CONTEXT_RESULTS: num({ default: 10 }),
  DEFAULT_TOKEN_BUDGET: num({ default: 8000 }),
  CONTEXT_CACHE_TTL: num({ default: 3600 }), // 1 hour

  // Quality Gates
  RUN_TESTS_TIMEOUT: num({ default: 60000 }), // 60 seconds
  ENABLE_AUTO_QUALITY_GATES: bool({ default: false }),

  // Monitoring
  ENABLE_TELEMETRY: bool({ default: true }),
  SENTRY_DSN: str({ default: '' }),

  // Security
  JWT_SECRET: str({ default: 'dev-secret-change-in-production' }),
  API_RATE_LIMIT: num({ default: 100 }), // requests per 15 minutes
});
```

---

## 8. Best Practices

### Error Handling

```typescript
// packages/shared/src/utils/errors.ts
export class AxonError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'AxonError';
  }
}

export class ValidationError extends AxonError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AxonError {
  constructor(resource: string, id?: string) {
    super(`${resource}${id ? ` with id ${id}` : ''} not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AxonError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
    this.name = 'UnauthorizedError';
  }
}

export class RateLimitError extends AxonError {
  constructor() {
    super('Too many requests', 'RATE_LIMIT_EXCEEDED', 429);
    this.name = 'RateLimitError';
  }
}
```

### Performance Utilities

```typescript
// packages/shared/src/utils/performance.ts
export function measureAsync<T>(
  fn: () => Promise<T>,
  label: string
): Promise<T & { duration: number }> {
  return new Promise(async (resolve, reject) => {
    const startTime = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      logger.debug(`${label} completed`, { duration });
      resolve({ ...result, duration } as T & { duration: number });
    } catch (error) {
      reject(error);
    }
  });
}

export class PerformanceTracker {
  private metrics: Map<string, number[]> = new Map();

  record(label: string, duration: number): void {
    const existing = this.metrics.get(label) || [];
    existing.push(duration);
    this.metrics.set(label, existing);
  }

  getStats(label: string): {
    count: number;
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  } | null {
    const values = this.metrics.get(label);
    if (!values || values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      count,
      avg: sum / count,
      min: sorted[0],
      max: sorted[count - 1],
      p50: sorted[Math.floor(count * 0.5)],
      p95: sorted[Math.floor(count * 0.95)],
      p99: sorted[Math.floor(count * 0.99)],
    };
  }

  reset(): void {
    this.metrics.clear();
  }
}
```

---

This implementation guide provides the foundation for building Axon with a microservices architecture. Use it alongside the MVP roadmap to develop each service systematically.
