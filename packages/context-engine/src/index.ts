/**
 * Context Engine - Main Entry Point
 * 
 * Exports all context engine services and types.
 */

// Types
export * from './types';
export * from './config';

// Services
export { EmbeddingService } from './services/embedding.service';
export { VectorStoreAdapter } from './services/vector-store.adapter';

// Retrieval
export { ContextRetriever } from './retrieval/context-retriever';
