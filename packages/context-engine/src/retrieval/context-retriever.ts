/**
 * Context Retriever
 * 
 * Implements hierarchical context retrieval with semantic search and
 * multi-factor re-ranking algorithm.
 */

import { logger } from '@axon/shared';
import type { IContext, ContextTier } from '@axon/shared';
import type {
  ContextRetrievalRequest,
  ContextRetrievalResult,
  ScoredContext,
  ContextRetrievalConfig,
} from '../types.js';
import type { EmbeddingService } from '../services/embedding.service.js';
import type { VectorStoreAdapter, ContextSearchResult } from '../services/vector-store.adapter.js';
import type { MongoDBConnection } from '@axon/shared';
import { DEFAULT_RETRIEVAL_CONFIG } from '../config.js';

export class ContextRetriever {
  private embeddingService: EmbeddingService;
  private vectorStore: VectorStoreAdapter;
  private mongodb: MongoDBConnection;
  private config: ContextRetrievalConfig;

  constructor(
    embeddingService: EmbeddingService,
    vectorStore: VectorStoreAdapter,
    mongodb: MongoDBConnection,
    config: Partial<ContextRetrievalConfig> = {}
  ) {
    this.embeddingService = embeddingService;
    this.vectorStore = vectorStore;
    this.mongodb = mongodb;
    this.config = { ...DEFAULT_RETRIEVAL_CONFIG, ...config };
  }

  /**
   * Retrieve and rank contexts based on query and request parameters
   */
  async retrieve(request: ContextRetrievalRequest): Promise<ContextRetrievalResult> {
    const startTime = Date.now();
    logger.info('Starting context retrieval', { 
      workspaceId: request.workspaceId, 
      taskType: request.taskType 
    });

    try {
      // 1. Generate query embedding
      const queryEmbedding = await this.embeddingService.generateEmbedding(
        this.expandQuery(request)
      );

      // 2. Perform hierarchical search
      const searchResults = await this.hierarchicalSearch(request, queryEmbedding);

      // 3. Hydrate contexts from MongoDB (get full content)
      const hydratedContexts = await this.hydrateContexts(searchResults);

      // 4. Apply re-ranking algorithm
      const scoredContexts = this.reRankContexts(hydratedContexts, request);

      // 5. Apply diversity selection if enabled
      const finalContexts = this.config.enableDiversitySelection
        ? this.diversitySelect(scoredContexts, request.limit || this.config.defaultLimit)
        : scoredContexts.slice(0, request.limit || this.config.defaultLimit);

      const latencyMs = Date.now() - startTime;

      logger.info('Context retrieval completed', {
        totalFound: searchResults.length,
        returned: finalContexts.length,
        latencyMs,
      });

      return {
        contexts: finalContexts,
        query: request.query,
        totalFound: searchResults.length,
        latencyMs,
        tiersSearched: this.getTiersSearched(request),
      };
    } catch (error) {
      logger.error('Context retrieval failed', error);
      throw error;
    }
  }

  /**
   * Expand query with entities if enabled
   */
  private expandQuery(request: ContextRetrievalRequest): string {
    if (!this.config.enableQueryExpansion || !request.entities || request.entities.length === 0) {
      return request.query;
    }

    // Add high-confidence entities to the query
    const entityTexts = request.entities
      .filter(e => e.confidence > 0.7)
      .map(e => e.value)
      .join(' ');

    return `${request.query} ${entityTexts}`;
  }

  /**
   * Perform hierarchical search across context tiers
   */
  private async hierarchicalSearch(
    request: ContextRetrievalRequest,
    queryEmbedding: number[]
  ): Promise<ContextSearchResult[]> {
    const tiers = this.getTiersSearched(request);
    const results: ContextSearchResult[] = [];

    for (const tier of tiers) {
      logger.debug(`Searching in tier: ${tier}`);

      const tierResults = await this.vectorStore.search(
        queryEmbedding,
        {
          workspaceId: request.workspaceId,
          tier,
          taskType: request.taskType,
          minConfidence: request.minSimilarity || this.config.defaultMinSimilarity,
        },
        request.limit || this.config.defaultLimit
      );

      results.push(...tierResults);

      // If we have enough high-quality results from workspace tier, stop
      if (tier === 'workspace' && tierResults.length >= (request.limit || this.config.defaultLimit)) {
        logger.debug('Sufficient results found in workspace tier, skipping other tiers');
        break;
      }
    }

    return results;
  }

  /**
   * Hydrate search results with full context from MongoDB
   */
  private async hydrateContexts(searchResults: ContextSearchResult[]): Promise<ScoredContext[]> {
    if (searchResults.length === 0) {
      return [];
    }

    const contextIds = searchResults
      .map(r => r.context.id)
      .filter((id): id is string => id !== undefined);
    
    const db = this.mongodb.getDb();
    const contextsCollection = db.collection<IContext>('contexts');

    // Fetch full contexts from MongoDB
    const fullContexts = await contextsCollection
      .find({ id: { $in: contextIds } })
      .toArray();

    // Map full contexts with similarity scores
    const contextMap = new Map(fullContexts.map((c: IContext) => [c.id, c]));

    return searchResults
      .map(result => {
        if (!result.context.id) return null;
        
        const fullContext = contextMap.get(result.context.id);
        if (!fullContext) return null;

        return {
          ...fullContext,
          score: result.similarity,
          scoreBreakdown: {
            semanticSimilarity: result.similarity,
            freshness: 0, // Will be calculated in re-ranking
            usageBoost: 0,
            confidenceBoost: 0,
          },
        };
      })
      .filter((c): c is ScoredContext => c !== null);
  }

  /**
   * Re-rank contexts using multi-factor scoring algorithm
   * 
   * Score = (semantic * 0.6) + (freshness * 0.2) + (usage * 0.1) + (confidence * 0.1)
   */
  private reRankContexts(contexts: ScoredContext[], request: ContextRetrievalRequest): ScoredContext[] {
    const weights = this.config.reRankingWeights;
    const now = Date.now();

    return contexts
      .map(context => {
        // 1. Semantic similarity (already computed, 0-1)
        const semanticScore = context.scoreBreakdown.semanticSimilarity;

        // 2. Freshness score (exponential decay based on age)
        const ageInDays = (now - context.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
        const maxAge = this.config.maxContextAge || 365; // Default 1 year
        const freshness = Math.exp(-ageInDays / maxAge);

        // 3. Usage boost (normalized, 0-1)
        const maxUsage = Math.max(...contexts.map(c => c.metadata.usageCount || 0), 1);
        const usageBoost = (context.metadata.usageCount || 0) / maxUsage;

        // 4. Confidence boost (if available in metadata, default 1.0)
        const confidenceBoost = 1.0; // For MVP, always 1.0

        // Calculate composite score
        const compositeScore =
          semanticScore * weights.semanticSimilarity +
          freshness * weights.freshness +
          usageBoost * weights.usage +
          confidenceBoost * weights.confidence;

        return {
          ...context,
          score: compositeScore,
          scoreBreakdown: {
            semanticSimilarity: semanticScore,
            freshness,
            usageBoost,
            confidenceBoost,
          },
        };
      })
      .sort((a, b) => b.score - a.score); // Sort by composite score descending
  }

  /**
   * Select diverse contexts to avoid redundancy
   */
  private diversitySelect(contexts: ScoredContext[], limit: number): ScoredContext[] {
    if (contexts.length <= limit) {
      return contexts;
    }

    const selected: ScoredContext[] = [];
    const remaining = [...contexts];

    // Always select the top-scoring context
    selected.push(remaining.shift()!);

    while (selected.length < limit && remaining.length > 0) {
      let maxDiversity = -1;
      let maxIndex = 0;

      // Find the context with maximum diversity from already selected
      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];
        const minSimilarity = Math.min(
          ...selected.map(s => this.calculateDiversity(candidate, s))
        );

        // Combine diversity with score (70% score, 30% diversity)
        const diversityScore = candidate.score * 0.7 + minSimilarity * 0.3;

        if (diversityScore > maxDiversity) {
          maxDiversity = diversityScore;
          maxIndex = i;
        }
      }

      selected.push(remaining.splice(maxIndex, 1)[0]);
    }

    return selected;
  }

  /**
   * Calculate diversity between two contexts (0 = identical, 1 = completely different)
   */
  private calculateDiversity(ctx1: ScoredContext, ctx2: ScoredContext): number {
    // Simple diversity: different sources get higher diversity score
    if (ctx1.metadata.source !== ctx2.metadata.source) {
      return 0.8;
    }

    // Same type gets lower diversity
    if (ctx1.type === ctx2.type) {
      return 0.3;
    }

    return 0.5;
  }

  /**
   * Determine which tiers to search based on request
   */
  private getTiersSearched(request: ContextRetrievalRequest): ContextTier[] {
    if (request.tier) {
      return [request.tier];
    }

    // Default hierarchical search: workspace → hybrid → global
    return ['workspace', 'hybrid', 'global'] as ContextTier[];
  }

  /**
   * Update usage count for retrieved contexts
   */
  async updateUsageStats(contextIds: string[]): Promise<void> {
    try {
      const db = this.mongodb.getDb();
      const contextsCollection = db.collection('contexts');

      await contextsCollection.updateMany(
        { id: { $in: contextIds } },
        { 
          $inc: { 'metadata.usageCount': 1 },
          $set: { 'metadata.lastAccessed': new Date() }
        }
      );

      logger.debug(`Updated usage stats for ${contextIds.length} contexts`);
    } catch (error) {
      logger.error('Failed to update usage stats', error);
      // Don't throw - this is a non-critical operation
    }
  }
}
