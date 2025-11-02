/**
 * Embedding generation service using Transformers.js
 * Uses local models for privacy and cost efficiency
 */

import { pipeline } from '@xenova/transformers';
import { logger } from './logger';
import { DatabaseError } from './errors';

/**
 * Embedding service configuration
 */
export interface EmbeddingServiceConfig {
  modelName?: string; // Default: 'Xenova/all-MiniLM-L6-v2'
  maxLength?: number; // Maximum token length
  normalize?: boolean; // Normalize embeddings
}

/**
 * Embedding result
 */
export interface EmbeddingResult {
  embedding: number[];
  dimensions: number;
}

/**
 * Batch embedding result
 */
export interface BatchEmbeddingResult {
  embeddings: number[][];
  dimensions: number;
}

/**
 * Embedding generation service
 */
export class EmbeddingService {
  private model: string;
  private maxLength: number;
  private normalize: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pipeline: any | null = null;
  private initializationPromise: Promise<void> | null = null;

  constructor(config: EmbeddingServiceConfig = {}) {
    this.model = config.modelName || 'Xenova/all-MiniLM-L6-v2';
    this.maxLength = config.maxLength || 512;
    this.normalize = config.normalize !== undefined ? config.normalize : true;
  }

  /**
   * Initialize the embedding model
   * Lazy initialization - model loads on first use
   */
  private async initialize(): Promise<void> {
    if (this.pipeline) {
      return; // Already initialized
    }

    if (this.initializationPromise) {
      return this.initializationPromise; // Initialization in progress
    }

    this.initializationPromise = (async () => {
      try {
        logger.info('Initializing embedding model', { model: this.model });
        const startTime = Date.now();

        this.pipeline = await pipeline('feature-extraction', this.model);

        const duration = Date.now() - startTime;
        logger.info('Embedding model initialized successfully', {
          model: this.model,
          duration: `${duration}ms`,
        });
      } catch (error) {
        logger.error('Failed to initialize embedding model', { model: this.model, error });
        this.initializationPromise = null; // Reset for retry
        throw new DatabaseError('Failed to initialize embedding model', { model: this.model, error });
      }
    })();

    return this.initializationPromise;
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    try {
      await this.initialize();

      if (!this.pipeline) {
        throw new DatabaseError('Embedding pipeline not initialized');
      }

      logger.debug('Generating embedding', { textLength: text.length });
      const startTime = Date.now();

      // Generate embedding
      const output = await this.pipeline(text, {
        pooling: 'mean',
        normalize: this.normalize,
      });

      // Extract embedding array
      const embedding = Array.from(output.data) as number[];
      const duration = Date.now() - startTime;

      logger.debug('Embedding generated', {
        dimensions: embedding.length,
        duration: `${duration}ms`,
      });

      return {
        embedding,
        dimensions: embedding.length,
      };
    } catch (error) {
      logger.error('Failed to generate embedding', { error });
      throw new DatabaseError('Failed to generate embedding', { error });
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   * More efficient than calling generateEmbedding multiple times
   */
  async generateBatchEmbeddings(texts: string[]): Promise<BatchEmbeddingResult> {
    try {
      await this.initialize();

      if (!this.pipeline) {
        throw new DatabaseError('Embedding pipeline not initialized');
      }

      logger.debug('Generating batch embeddings', { count: texts.length });
      const startTime = Date.now();

      // Generate embeddings in batch
      const outputs = await Promise.all(
        texts.map(text =>
          this.pipeline!(text, {
            pooling: 'mean',
            normalize: this.normalize,
          })
        )
      );

      // Extract embedding arrays
      const embeddings = outputs.map(output => Array.from(output.data) as number[]);
      const duration = Date.now() - startTime;

      logger.debug('Batch embeddings generated', {
        count: embeddings.length,
        dimensions: embeddings[0]?.length || 0,
        duration: `${duration}ms`,
        avgPerEmbedding: `${(duration / embeddings.length).toFixed(2)}ms`,
      });

      return {
        embeddings,
        dimensions: embeddings[0]?.length || 0,
      };
    } catch (error) {
      logger.error('Failed to generate batch embeddings', { count: texts.length, error });
      throw new DatabaseError('Failed to generate batch embeddings', { count: texts.length, error });
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  static cosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimensions');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Normalize an embedding vector
   */
  static normalizeEmbedding(embedding: number[]): number[] {
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return magnitude === 0 ? embedding : embedding.map(val => val / magnitude);
  }

  /**
   * Get model information
   */
  getModelInfo(): { model: string; maxLength: number; normalize: boolean } {
    return {
      model: this.model,
      maxLength: this.maxLength,
      normalize: this.normalize,
    };
  }

  /**
   * Check if model is initialized
   */
  isInitialized(): boolean {
    return this.pipeline !== null;
  }
}

/**
 * Singleton instance (optional pattern)
 */
let embeddingServiceInstance: EmbeddingService | null = null;

export const getEmbeddingService = (config?: EmbeddingServiceConfig): EmbeddingService => {
  if (!embeddingServiceInstance) {
    embeddingServiceInstance = new EmbeddingService(config);
  }
  return embeddingServiceInstance;
};
