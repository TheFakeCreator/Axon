/**
 * Context Engine Types
 * 
 * Core type definitions for context retrieval, storage, and evolution.
 */

import type { IContext, ContextTier, IEntity, TaskCategory } from '@axon/shared';

/**
 * Context retrieval request
 */
export interface ContextRetrievalRequest {
  /** The search query or prompt */
  query: string;
  /** Workspace ID to search within */
  workspaceId: string;
  /** Task type for context filtering */
  taskType: TaskCategory;
  /** Extracted entities for query expansion */
  entities?: IEntity[];
  /** Context tier to search (default: hierarchical across all tiers) */
  tier?: ContextTier;
  /** Maximum number of contexts to retrieve */
  limit?: number;
  /** Minimum similarity threshold (0-1) */
  minSimilarity?: number;
}

/**
 * Retrieved context with scoring metadata
 */
export interface ScoredContext extends IContext {
  /** Composite relevance score (0-1) */
  score: number;
  /** Breakdown of score components */
  scoreBreakdown: {
    /** Semantic similarity score (0-1) */
    semanticSimilarity: number;
    /** Freshness score based on age (0-1) */
    freshness: number;
    /** Usage frequency boost (0-1) */
    usageBoost: number;
    /** Confidence boost (0-1) */
    confidenceBoost: number;
  };
  /** Matching entities (if any) */
  matchedEntities?: IEntity[];
}

/**
 * Context retrieval result
 */
export interface ContextRetrievalResult {
  /** Retrieved contexts sorted by relevance */
  contexts: ScoredContext[];
  /** Query used for retrieval */
  query: string;
  /** Total contexts found before limiting */
  totalFound: number;
  /** Retrieval latency in milliseconds */
  latencyMs: number;
  /** Context tiers searched */
  tiersSearched: ContextTier[];
}

/**
 * Context storage request
 */
export interface ContextStorageRequest {
  /** Context data to store */
  context: Omit<IContext, 'id' | 'createdAt' | 'updatedAt'>;
  /** Generate embeddings automatically */
  generateEmbeddings?: boolean;
  /** Index in vector database */
  indexInVectorDB?: boolean;
}

/**
 * Context update request
 */
export interface ContextUpdateRequest {
  /** Context ID to update */
  contextId: string;
  /** Fields to update */
  updates: Partial<Omit<IContext, 'id' | 'createdAt'>>;
  /** Regenerate embeddings if content changed */
  regenerateEmbeddings?: boolean;
}

/**
 * Context feedback for evolution
 */
export interface ContextFeedback {
  /** Context ID that was used */
  contextId: string;
  /** Workspace ID */
  workspaceId: string;
  /** Was the context helpful? */
  helpful: boolean;
  /** Was the context used in the response? */
  used: boolean;
  /** User rating (1-5, optional) */
  rating?: number;
  /** Feedback timestamp */
  timestamp: Date;
  /** Interaction ID for tracking */
  interactionId?: string;
}

/**
 * Context evolution request
 */
export interface ContextEvolutionRequest {
  /** Workspace ID */
  workspaceId: string;
  /** Feedback data */
  feedback?: ContextFeedback[];
  /** Apply temporal decay */
  applyTemporalDecay?: boolean;
  /** Consolidate similar contexts */
  consolidateSimilar?: boolean;
  /** Resolve conflicts */
  resolveConflicts?: boolean;
}

/**
 * Context evolution result
 */
export interface ContextEvolutionResult {
  /** Number of contexts updated */
  contextsUpdated: number;
  /** Number of contexts consolidated */
  contextsConsolidated: number;
  /** Number of conflicts resolved */
  conflictsResolved: number;
  /** Evolution latency in milliseconds */
  latencyMs: number;
  /** Evolution summary */
  summary: string;
}

/**
 * Re-ranking weights for context scoring
 */
export interface ReRankingWeights {
  /** Semantic similarity weight (default: 0.6) */
  semanticSimilarity: number;
  /** Freshness weight (default: 0.2) */
  freshness: number;
  /** Usage frequency weight (default: 0.1) */
  usage: number;
  /** Confidence weight (default: 0.1) */
  confidence: number;
}

/**
 * Context retrieval configuration
 */
export interface ContextRetrievalConfig {
  /** Default context limit */
  defaultLimit: number;
  /** Default minimum similarity threshold */
  defaultMinSimilarity: number;
  /** Re-ranking weights */
  reRankingWeights: ReRankingWeights;
  /** Enable query expansion with entities */
  enableQueryExpansion: boolean;
  /** Enable diversity-aware selection */
  enableDiversitySelection: boolean;
  /** Maximum age for contexts (in days, 0 = no limit) */
  maxContextAge: number;
}

/**
 * Context evolution configuration
 */
export interface ContextEvolutionConfig {
  /** Temporal decay rate (per day) */
  temporalDecayRate: number;
  /** Minimum confidence threshold for keeping contexts */
  minConfidenceThreshold: number;
  /** Similarity threshold for consolidation */
  consolidationSimilarityThreshold: number;
  /** Enable automatic evolution */
  autoEvolutionEnabled: boolean;
  /** Evolution interval in hours */
  evolutionIntervalHours: number;
}

/**
 * Vector search filter
 */
export interface VectorSearchFilter {
  /** Workspace ID filter */
  workspaceId?: string;
  /** Context tier filter */
  tier?: ContextTier;
  /** Task type filter */
  taskType?: TaskCategory;
  /** Source filter (file path, URL, etc.) */
  source?: string;
  /** Minimum confidence filter */
  minConfidence?: number;
  /** Tags filter */
  tags?: string[];
}

/**
 * Batch embedding request
 */
export interface BatchEmbeddingRequest {
  /** Texts to embed */
  texts: string[];
  /** Cache key prefix */
  cacheKeyPrefix?: string;
}

/**
 * Batch embedding result
 */
export interface BatchEmbeddingResult {
  /** Generated embeddings */
  embeddings: number[][];
  /** Texts that were embedded */
  texts: string[];
  /** Cache hits (indices) */
  cacheHits: number[];
  /** Generation latency in milliseconds */
  latencyMs: number;
}
