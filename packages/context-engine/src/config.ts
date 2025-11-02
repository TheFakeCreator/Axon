/**
 * Context Engine Configuration
 * 
 * Default configuration values for context retrieval and evolution.
 */

import type {
  ContextRetrievalConfig,
  ContextEvolutionConfig,
  ReRankingWeights,
} from './types.js';

/**
 * Default re-ranking weights based on research paper specifications
 */
export const DEFAULT_RERANKING_WEIGHTS: ReRankingWeights = {
  semanticSimilarity: 0.6, // 60% weight
  freshness: 0.2,          // 20% weight
  usage: 0.1,              // 10% weight
  confidence: 0.1,         // 10% weight
};

/**
 * Default context retrieval configuration
 */
export const DEFAULT_RETRIEVAL_CONFIG: ContextRetrievalConfig = {
  defaultLimit: 10,
  defaultMinSimilarity: 0.7,
  reRankingWeights: DEFAULT_RERANKING_WEIGHTS,
  enableQueryExpansion: true,
  enableDiversitySelection: true,
  maxContextAge: 0, // No age limit by default
};

/**
 * Default context evolution configuration
 */
export const DEFAULT_EVOLUTION_CONFIG: ContextEvolutionConfig = {
  temporalDecayRate: 0.01, // 1% decay per day
  minConfidenceThreshold: 0.3,
  consolidationSimilarityThreshold: 0.95,
  autoEvolutionEnabled: false, // Manual evolution for MVP
  evolutionIntervalHours: 24,
};

/**
 * Context cache TTL (in seconds)
 */
export const CONTEXT_CACHE_TTL = 3600; // 1 hour

/**
 * Embedding cache TTL (in seconds)
 */
export const EMBEDDING_CACHE_TTL = 86400; // 24 hours

/**
 * Maximum batch size for embedding generation
 */
export const MAX_EMBEDDING_BATCH_SIZE = 32;

/**
 * Maximum contexts to store in a single batch operation
 */
export const MAX_CONTEXT_BATCH_SIZE = 50;

/**
 * Vector search result limit (before re-ranking)
 */
export const VECTOR_SEARCH_LIMIT = 50;

/**
 * Minimum number of contexts for diversity selection
 */
export const MIN_CONTEXTS_FOR_DIVERSITY = 3;
