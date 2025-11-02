/**
 * Environment configuration schema validation using envalid
 */

import { cleanEnv, str, num, bool, url } from 'envalid';

/**
 * Validate and parse environment variables
 */
export function validateEnv() {
  return cleanEnv(process.env, {
    // Node environment
    NODE_ENV: str({
      choices: ['development', 'staging', 'production', 'test'],
      default: 'development',
    }),

    // Server configuration
    PORT: num({ default: 3000 }),
    HOST: str({ default: 'localhost' }),

    // MongoDB configuration
    MONGODB_URI: url({
      desc: 'MongoDB connection string',
      example: 'mongodb://localhost:27017',
    }),
    MONGODB_DB_NAME: str({
      desc: 'MongoDB database name',
      default: 'axon',
    }),

    // Redis configuration
    REDIS_HOST: str({ default: 'localhost' }),
    REDIS_PORT: num({ default: 6379 }),
    REDIS_PASSWORD: str({ default: '', devDefault: '' }),

    // Qdrant vector database configuration
    QDRANT_URL: url({
      desc: 'Qdrant server URL',
      default: 'http://localhost:6333',
    }),
    QDRANT_API_KEY: str({
      desc: 'Qdrant API key (optional for local)',
      default: '',
      devDefault: '',
    }),
    QDRANT_COLLECTION_NAME: str({
      desc: 'Qdrant collection name',
      default: 'axon-contexts',
    }),
    QDRANT_VECTOR_SIZE: num({
      desc: 'Embedding vector dimension size',
      default: 384, // all-MiniLM-L6-v2 dimension
    }),

    // Vector database configuration (Pinecone - alternative)
    PINECONE_API_KEY: str({
      desc: 'Pinecone API key',
      default: '',
      devDefault: '',
    }),
    PINECONE_ENVIRONMENT: str({
      desc: 'Pinecone environment',
      default: '',
      devDefault: '',
    }),
    PINECONE_INDEX_NAME: str({
      desc: 'Pinecone index name',
      default: 'axon-contexts',
    }),

    // LLM Provider configuration
    LLM_PROVIDER: str({
      desc: 'LLM provider to use',
      choices: ['openai', 'ollama', 'anthropic'],
      default: 'ollama',
    }),

    // OpenAI configuration
    OPENAI_API_KEY: str({
      desc: 'OpenAI API key',
      default: '',
      devDefault: '',
    }),
    OPENAI_MODEL: str({
      desc: 'Default OpenAI model',
      default: 'gpt-4',
    }),

    // Ollama configuration (local LLM)
    OLLAMA_BASE_URL: str({
      desc: 'Ollama API base URL',
      default: 'http://localhost:11434',
    }),
    OLLAMA_MODEL: str({
      desc: 'Ollama model name',
      default: 'llama3.2:1b',
    }),

    // Anthropic configuration
    ANTHROPIC_API_KEY: str({
      desc: 'Anthropic API key',
      default: '',
      devDefault: '',
    }),

    // Logging
    LOG_LEVEL: str({
      choices: ['error', 'warn', 'info', 'debug'],
      default: 'info',
    }),

    // Feature flags
    ENABLE_CONTEXT_EVOLUTION: bool({ default: false }),
    ENABLE_GRAPH_RETRIEVAL: bool({ default: false }),
    ENABLE_STREAMING: bool({ default: true }),

    // Token limits
    MAX_CONTEXT_TOKENS: num({ default: 4000 }),
    MAX_RESPONSE_TOKENS: num({ default: 2000 }),
  });
}

/**
 * Environment configuration type
 */
export type EnvConfig = ReturnType<typeof validateEnv>;
