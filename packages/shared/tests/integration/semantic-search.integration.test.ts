/**
 * Integration tests for semantic search functionality
 * 
 * These tests require Qdrant and embedding service to be available
 * Run with: pnpm test:integration
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { QdrantVectorStore } from '../../src/utils/qdrant';
import { EmbeddingService } from '../../src/utils/embedding';

describe('Semantic Search Integration', () => {
  let vectorStore: QdrantVectorStore;
  let embeddingService: EmbeddingService;
  const testCollectionName = 'test-semantic-search';

  beforeAll(async () => {
    // Initialize services
    vectorStore = new QdrantVectorStore({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      collectionName: testCollectionName,
      vectorSize: 384,
      distance: 'Cosine',
    });

    embeddingService = new EmbeddingService();

    // Initialize collection
    await vectorStore.initializeCollection();
  });

  afterAll(async () => {
    // Cleanup: delete test collection
    try {
      await vectorStore.deleteByFilter({});
    } catch (error) {
      // Collection might not exist, ignore
    }
  });

  describe('End-to-End Semantic Search', () => {
    it('should index and retrieve semantically similar documents', async () => {
      // Sample documents
      const documents = [
        {
          id: 'doc-1',
          text: 'React is a JavaScript library for building user interfaces',
          metadata: { type: 'tech-stack', category: 'frontend' },
        },
        {
          id: 'doc-2',
          text: 'Vue.js is a progressive framework for building web applications',
          metadata: { type: 'tech-stack', category: 'frontend' },
        },
        {
          id: 'doc-3',
          text: 'MongoDB is a NoSQL database that stores data in JSON-like documents',
          metadata: { type: 'tech-stack', category: 'database' },
        },
        {
          id: 'doc-4',
          text: 'Express.js is a minimal web framework for Node.js applications',
          metadata: { type: 'tech-stack', category: 'backend' },
        },
        {
          id: 'doc-5',
          text: 'TypeScript adds static typing to JavaScript for better tooling',
          metadata: { type: 'tech-stack', category: 'language' },
        },
      ];

      // Generate embeddings for all documents
      const texts = documents.map((d) => d.text);
      const { embeddings } = await embeddingService.generateBatchEmbeddings(texts);

      expect(embeddings).toHaveLength(documents.length);
      expect(embeddings[0]).toHaveLength(384);

      // Index all documents
      const points = embeddings.map((embedding: number[], index: number) => ({
        id: documents[index].id,
        vector: embedding,
        payload: {
          text: documents[index].text,
          ...documents[index].metadata,
        },
      }));

      await vectorStore.upsertBatch(points);

      // Wait a bit for indexing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Test 1: Search for frontend framework
      const query1 = 'JavaScript framework for building UI components';
      const { embedding: queryEmbedding1 } =
        await embeddingService.generateEmbedding(query1);

      const results1 = await vectorStore.search(queryEmbedding1, 3, {}, 0.5);

      expect(results1.length).toBeGreaterThan(0);
      // React should be most similar
      expect(results1[0].payload.text).toContain('React');
      expect(results1[0].score).toBeGreaterThan(0.5);
    }, 15000); // Longer timeout for integration test

    it('should filter results by metadata', async () => {
      const query = 'database technology';
      const { embedding } = await embeddingService.generateEmbedding(query);

      // Search only in database category
      const results = await vectorStore.search(
        embedding,
        5,
        { category: 'database' },
        0.3
      );

      expect(results.length).toBeGreaterThan(0);
      results.forEach((result) => {
        expect((result.payload as { category?: string }).category).toBe('database');
      });
    }, 10000);

    it('should respect similarity threshold', async () => {
      const query = 'machine learning algorithms';
      const { embedding } = await embeddingService.generateEmbedding(query);

      // High threshold should return fewer results
      const highThresholdResults = await vectorStore.search(embedding, 10, {}, 0.8);

      const lowThresholdResults = await vectorStore.search(embedding, 10, {}, 0.3);

      expect(lowThresholdResults.length).toBeGreaterThanOrEqual(
        highThresholdResults.length
      );
    }, 10000);

    it('should calculate cosine similarity correctly', async () => {
      const text1 = 'React is a frontend library';
      const text2 = 'React is a UI library';
      const text3 = 'MongoDB is a database';

      const { embedding: emb1 } = await embeddingService.generateEmbedding(text1);
      const { embedding: emb2 } = await embeddingService.generateEmbedding(text2);
      const { embedding: emb3 } = await embeddingService.generateEmbedding(text3);

      const similarity12 = EmbeddingService.cosineSimilarity(emb1, emb2);
      const similarity13 = EmbeddingService.cosineSimilarity(emb1, emb3);

      // Similar texts should have higher similarity
      expect(similarity12).toBeGreaterThan(similarity13);
      expect(similarity12).toBeGreaterThan(0.8); // Very similar
      expect(similarity13).toBeLessThan(0.7); // Less similar
    }, 10000);
  });

  describe('Batch Operations', () => {
    it('should handle batch embedding generation efficiently', async () => {
      const texts = [
        'First document about React',
        'Second document about Vue',
        'Third document about Angular',
        'Fourth document about Svelte',
        'Fifth document about Next.js',
      ];

      const startTime = Date.now();
      const result = await embeddingService.generateBatchEmbeddings(texts);
      const endTime = Date.now();
      const { embeddings } = result;

      expect(embeddings).toHaveLength(texts.length);
      expect(endTime - startTime).toBeGreaterThan(0);

      // All embeddings should have correct dimensions
      embeddings.forEach((embedding: number[]) => {
        expect(embedding).toHaveLength(384);
        expect(embedding.every((val: number) => typeof val === 'number')).toBe(true);
      });
    }, 15000);

    it('should handle batch vector upsert', async () => {
      const testDocs = Array.from({ length: 10 }, (_, i) => ({
        id: `batch-doc-${i}`,
        text: `Document ${i} about testing batch operations`,
      }));

      const texts = testDocs.map((d) => d.text);
      const { embeddings } = await embeddingService.generateBatchEmbeddings(texts);

      const points = embeddings.map((embedding: number[], index: number) => ({
        id: testDocs[index].id,
        vector: embedding,
        payload: { text: testDocs[index].text },
      }));

      await vectorStore.upsertBatch(points);

      // Wait for indexing
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify all documents are indexed
      const count = await vectorStore.count({});
      expect(count).toBeGreaterThanOrEqual(10); // At least our 10 docs
    }, 20000);
  });

  describe('Edge Cases', () => {
    it('should handle empty query gracefully', async () => {
      const { embedding } = await embeddingService.generateEmbedding('');

      expect(embedding).toHaveLength(384);
      expect(embedding.every((val: number) => typeof val === 'number')).toBe(true);
    }, 5000);

    it('should handle very long text', async () => {
      const longText = 'test '.repeat(1000); // 5000 characters

      const { embedding } = await embeddingService.generateEmbedding(longText);

      expect(embedding).toHaveLength(384);
    }, 10000);

    it('should handle special characters', async () => {
      const specialText = 'Test with émojis 🚀 and spëcial çharacters!';

      const { embedding } = await embeddingService.generateEmbedding(specialText);

      expect(embedding).toHaveLength(384);
    }, 5000);

    it('should return empty array when no results match filter', async () => {
      const query = 'test query';
      const { embedding } = await embeddingService.generateEmbedding(query);

      const results = await vectorStore.search(
        embedding,
        10,
        { nonExistentField: 'nonExistentValue' },
        0.5
      );

      expect(results).toEqual([]);
    }, 5000);
  });

  describe('Performance', () => {
    it('should search within acceptable time', async () => {
      const query = 'performance test query';
      const { embedding } = await embeddingService.generateEmbedding(query);

      const startTime = Date.now();
      await vectorStore.search(embedding, 10, {}, 0.5);
      const duration = Date.now() - startTime;

      // Should complete within 500ms
      expect(duration).toBeLessThan(500);
    }, 10000);

    it('should generate embeddings within acceptable time', async () => {
      const text = 'This is a test sentence for embedding generation';

      const startTime = Date.now();
      await embeddingService.generateEmbedding(text);
      const duration = Date.now() - startTime;

      // First run might be slower (model loading), but should still be reasonable
      expect(duration).toBeLessThan(2000);

      // Second run should be much faster
      const startTime2 = Date.now();
      await embeddingService.generateEmbedding(text);
      const duration2 = Date.now() - startTime2;

      expect(duration2).toBeLessThan(100);
    }, 15000);
  });
});
