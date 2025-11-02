/**
 * Context Engine - Main Entry Point
 * 
 * Exports all context engine services and types.
 */

// Types
export * from './types.js';
export * from './config.js';

// Services
export { EmbeddingService } from './services/embedding.service.js';
export { VectorStoreAdapter } from './services/vector-store.adapter.js';

// Retrieval
export { ContextRetriever } from './retrieval/context-retriever.js';

// Storage
export { ContextStorage } from './storage/context-storage.js';
export type { ContextVersion } from './storage/context-storage.js';

// Evolution
export { ContextEvolutionEngine } from './evolution/context-evolution.engine.js';
