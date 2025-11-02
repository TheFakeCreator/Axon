/**
 * Context Evolution Engine
 * 
 * Handles context evolution based on feedback, usage patterns, and temporal decay.
 * MVP implementation focuses on basic feedback integration and temporal decay.
 */

import { logger, MongoDBConnection } from '@axon/shared';
import type { IContext } from '@axon/shared';
import type {
  ContextFeedback,
  ContextEvolutionRequest,
  ContextEvolutionResult,
  ContextEvolutionConfig,
} from '../types.js';
import type { ContextStorage } from '../storage/context-storage.js';
import type { VectorStoreAdapter } from '../services/vector-store.adapter.js';
import { DEFAULT_EVOLUTION_CONFIG } from '../config.js';

export class ContextEvolutionEngine {
  private mongodb: MongoDBConnection;
  private contextStorage: ContextStorage;
  private vectorStore: VectorStoreAdapter;
  private config: ContextEvolutionConfig;

  constructor(
    mongodb: MongoDBConnection,
    contextStorage: ContextStorage,
    vectorStore: VectorStoreAdapter,
    config: Partial<ContextEvolutionConfig> = {}
  ) {
    this.mongodb = mongodb;
    this.contextStorage = contextStorage;
    this.vectorStore = vectorStore;
    this.config = { ...DEFAULT_EVOLUTION_CONFIG, ...config };
  }

  /**
   * Process user feedback for a context
   */
  async processFeedback(feedback: ContextFeedback): Promise<void> {
    try {
      logger.info('Processing context feedback', { 
        contextId: feedback.contextId, 
        helpful: feedback.helpful 
      });

      // Get current context
      const context = await this.contextStorage.getContext(feedback.contextId);
      if (!context) {
        logger.warn('Context not found for feedback', { contextId: feedback.contextId });
        return;
      }

      // Store feedback
      await this.storeFeedback(feedback);

      // Update context confidence based on feedback
      const newConfidence = this.calculateConfidence(context, feedback);

      // Update usage count if context was used
      const updates: Partial<IContext> = {
        metadata: {
          ...context.metadata,
          confidence: newConfidence,
        },
      };

      if (feedback.used) {
        updates.metadata!.usageCount = (context.metadata.usageCount || 0) + 1;
      }

      await this.contextStorage.updateContext({
        contextId: feedback.contextId,
        updates,
        regenerateEmbeddings: false, // Content didn't change
      });

      logger.info('Feedback processed successfully', { 
        contextId: feedback.contextId,
        newConfidence 
      });
    } catch (error) {
      logger.error('Failed to process feedback', { feedback, error });
      throw error;
    }
  }

  /**
   * Apply temporal decay to contexts
   */
  async applyTemporalDecay(request: ContextEvolutionRequest): Promise<ContextEvolutionResult> {
    const startTime = Date.now();

    try {
      logger.info('Applying temporal decay', { 
        workspaceId: request.workspaceId 
      });

      // Get contexts to decay
      const contexts = await this.contextStorage.getContextsByWorkspace(
        request.workspaceId
      );

      const now = Date.now();
      const updatedContexts: string[] = [];

      for (const context of contexts) {
        const ageInDays = (now - context.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
        const currentConfidence = Number(context.metadata.confidence) || 1.0;

        // Calculate decay
        const decay = this.config.temporalDecayRate * ageInDays;
        const newConfidence = Math.max(
          this.config.minConfidenceThreshold,
          currentConfidence - decay
        );

        // Update if confidence changed significantly
        if (Math.abs(newConfidence - currentConfidence) > 0.01) {
          await this.contextStorage.updateContext({
            contextId: context.id,
            updates: {
              metadata: {
                ...context.metadata,
                confidence: newConfidence,
              },
            },
            regenerateEmbeddings: false,
          });

          updatedContexts.push(context.id);

          // Delete if below minimum threshold
          if (newConfidence <= this.config.minConfidenceThreshold) {
            await this.contextStorage.deleteContext(context.id);
            logger.info('Context removed due to low confidence', { 
              contextId: context.id,
              confidence: newConfidence 
            });
          }
        }
      }

      const latencyMs = Date.now() - startTime;
      logger.info('Temporal decay applied', { 
        processed: contexts.length,
        updated: updatedContexts.length,
        latencyMs 
      });

      return {
        contextsUpdated: updatedContexts.length,
        contextsConsolidated: 0,
        conflictsResolved: 0,
        latencyMs,
        summary: `Applied temporal decay to ${contexts.length} contexts, updated ${updatedContexts.length}`,
      };
    } catch (error) {
      logger.error('Failed to apply temporal decay', { request, error });
      throw error;
    }
  }

  /**
   * Consolidate similar contexts (MVP stub - full implementation post-MVP)
   */
  async consolidateSimilarContexts(
    workspaceId: string
  ): Promise<number> {
    try {
      logger.info('Consolidating similar contexts (stub)', { workspaceId });

      // MVP: Return 0, full implementation requires:
      // 1. Find similar contexts using vector similarity
      // 2. Merge content and metadata
      // 3. Keep highest confidence version
      // 4. Delete duplicates
      
      return 0;
    } catch (error) {
      logger.error('Failed to consolidate contexts', { workspaceId, error });
      throw error;
    }
  }

  /**
   * Resolve conflicting contexts (MVP stub - full implementation post-MVP)
   */
  async resolveConflicts(
    workspaceId: string
  ): Promise<number> {
    try {
      logger.info('Resolving context conflicts (stub)', { workspaceId });

      // MVP: Return 0, full implementation requires:
      // 1. Detect contradictory contexts
      // 2. Compare timestamps, confidence, usage
      // 3. Keep most reliable version
      // 4. Mark others as deprecated
      
      return 0;
    } catch (error) {
      logger.error('Failed to resolve conflicts', { workspaceId, error });
      throw error;
    }
  }

  /**
   * Run full evolution cycle
   */
  async evolve(request: ContextEvolutionRequest): Promise<ContextEvolutionResult> {
    const startTime = Date.now();

    try {
      logger.info('Running evolution cycle', { 
        workspaceId: request.workspaceId 
      });

      // Apply temporal decay
      const decayResult = await this.applyTemporalDecay(request);

      // Consolidate similar contexts (MVP stub)
      const consolidated = await this.consolidateSimilarContexts(
        request.workspaceId
      );

      // Resolve conflicts (MVP stub)
      const conflictsResolved = await this.resolveConflicts(
        request.workspaceId
      );

      const latencyMs = Date.now() - startTime;
      logger.info('Evolution cycle completed', { 
        workspaceId: request.workspaceId,
        latencyMs 
      });

      return {
        contextsUpdated: decayResult.contextsUpdated,
        contextsConsolidated: consolidated,
        conflictsResolved,
        latencyMs,
        summary: `Evolution cycle complete: ${decayResult.contextsUpdated} updated, ${consolidated} consolidated, ${conflictsResolved} conflicts resolved`,
      };
    } catch (error) {
      logger.error('Failed to run evolution cycle', { request, error });
      throw error;
    }
  }

  /**
   * Get evolution statistics
   */
  async getEvolutionStats(workspaceId: string): Promise<{
    totalContexts: number;
    averageConfidence: number;
    lowConfidenceContexts: number;
    recentFeedbackCount: number;
  }> {
    try {
      const db = this.mongodb.getDb();
      const contextsCollection = db.collection<IContext>('contexts');

      // Get all contexts for workspace
      const contexts = await contextsCollection
        .find({ workspaceId })
        .toArray();

      const totalContexts = contexts.length;
      const averageConfidence = contexts.length > 0
        ? contexts.reduce((sum, c) => sum + (Number(c.metadata.confidence) || 1.0), 0) / contexts.length
        : 0;
      const lowConfidenceContexts = contexts.filter(
        c => (Number(c.metadata.confidence) || 1.0) < this.config.minConfidenceThreshold
      ).length;

      // Get recent feedback count (last 7 days)
      const feedbackCollection = db.collection('context_feedback');
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentFeedbackCount = await feedbackCollection.countDocuments({
        timestamp: { $gte: sevenDaysAgo },
      });

      return {
        totalContexts,
        averageConfidence,
        lowConfidenceContexts,
        recentFeedbackCount,
      };
    } catch (error) {
      logger.error('Failed to get evolution stats', { workspaceId, error });
      throw error;
    }
  }

  /**
   * Calculate new confidence based on feedback
   */
  private calculateConfidence(context: IContext, feedback: ContextFeedback): number {
    const currentConfidence = Number(context.metadata.confidence) || 1.0;
    const usageCount = context.metadata.usageCount || 0;

    // Weighted average approach
    // More usage = more weight on new feedback
    const weight = Math.min(0.3, usageCount * 0.01); // Max 30% weight

    let feedbackScore = 0.5; // Neutral
    if (feedback.helpful === true) feedbackScore = 1.0;
    if (feedback.helpful === false) feedbackScore = 0.0;
    if (feedback.rating !== undefined) {
      feedbackScore = feedback.rating / 5.0; // Normalize 0-5 to 0-1
    }

    // Calculate new confidence
    const newConfidence = currentConfidence * (1 - weight) + feedbackScore * weight;

    // Clamp between min threshold and 1.0
    return Math.max(
      this.config.minConfidenceThreshold,
      Math.min(1.0, newConfidence)
    );
  }

  /**
   * Store feedback in database
   */
  private async storeFeedback(feedback: ContextFeedback): Promise<void> {
    try {
      const db = this.mongodb.getDb();
      const feedbackCollection = db.collection('context_feedback');

      await feedbackCollection.insertOne({
        ...feedback,
        timestamp: feedback.timestamp || new Date(),
      } as any);
    } catch (error) {
      logger.error('Failed to store feedback', { feedback, error });
      // Don't throw - feedback storage is non-critical
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const db = this.mongodb.getDb();
      await db.command({ ping: 1 });
      return true;
    } catch (error) {
      logger.error('Context evolution health check failed', error);
      return false;
    }
  }
}
