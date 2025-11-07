/**
 * Prompt Orchestrator Tests
 *
 * Tests for the main orchestration service that chains all middleware
 * components together through the complete Axon pipeline.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PromptOrchestrator } from '../src/orchestrator';
import type { PromptRequest, StreamingChunk } from '../src/types';
import type { PromptAnalysis, IntentCategory } from '@axon/prompt-analyzer';
import type { TaskCategory } from '@axon/shared';

// Mock dependencies
const mockPromptAnalyzer = {
  analyze: vi.fn(),
};

const mockContextRetriever = {
  retrieve: vi.fn(),
};

const mockContextStorage = {
  store: vi.fn(),
  retrieve: vi.fn(),
  search: vi.fn(),
};

const mockLLMGateway = {
  complete: vi.fn(),
  completeStream: vi.fn(),
  isAvailable: vi.fn(),
};

describe('PromptOrchestrator', () => {
  let orchestrator: PromptOrchestrator;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Set up default mock behaviors
    mockPromptAnalyzer.analyze.mockResolvedValue(createMockAnalysis());
    mockContextRetriever.retrieve.mockResolvedValue(createMockRetrievalResult());
    mockLLMGateway.complete.mockResolvedValue(createMockLLMResponse());
    mockLLMGateway.completeStream.mockImplementation(async function* () {
      yield { id: 'chunk-1', delta: 'Hello ', createdAt: new Date() };
      yield { id: 'chunk-2', delta: 'world!', createdAt: new Date() };
    });

    orchestrator = new PromptOrchestrator({
      promptAnalyzer: mockPromptAnalyzer as any,
      contextRetriever: mockContextRetriever as any,
      contextStorage: mockContextStorage as any,
      llmGateway: mockLLMGateway as any,
      tokenBudget: {
        total: 8192,
        responseReserve: 2048,
        contextBudget: 6144,
        allocation: {
          file: 2048,
          symbol: 1536,
          documentation: 1024,
          conversation: 768,
          error: 512,
          architecture: 256,
        },
      },
      defaultInjectionStrategy: 'hybrid',
      enableStreaming: true,
      timeout: 30000,
      maxRetries: 3,
    } as any);
  });

  describe('Constructor & Configuration', () => {
    it('should create orchestrator with provided config', () => {
      expect(orchestrator).toBeDefined();
    });

    it('should create orchestrator with default token budget', () => {
      const orch = new PromptOrchestrator({
        promptAnalyzer: mockPromptAnalyzer as any,
        contextRetriever: mockContextRetriever as any,
        llmGateway: mockLLMGateway as any,
        tokenBudget: {
          total: 4096,
          responseReserve: 1024,
          contextBudget: 3072,
          allocation: {
            file: 1024,
            symbol: 768,
            documentation: 512,
            conversation: 384,
            error: 256,
            architecture: 128,
          },
        },
        defaultInjectionStrategy: 'hybrid',
        enableStreaming: true,
        timeout: 30000,
        maxRetries: 3,
      });
      expect(orch).toBeDefined();
    });

    it('should create orchestrator with custom injection strategy', () => {
      const orch = new PromptOrchestrator({
        promptAnalyzer: mockPromptAnalyzer as any,
        contextRetriever: mockContextRetriever as any,
        llmGateway: mockLLMGateway as any,
        tokenBudget: {
          total: 4096,
          responseReserve: 1024,
          contextBudget: 3072,
          allocation: {
            file: 1024,
            symbol: 768,
            documentation: 512,
            conversation: 384,
            error: 256,
            architecture: 128,
          },
        },
        defaultInjectionStrategy: 'prefix',
        enableStreaming: true,
        timeout: 30000,
        maxRetries: 3,
      });
      expect(orch).toBeDefined();
    });
  });

  describe('Non-Streaming Pipeline', () => {
    it('should process complete pipeline successfully', async () => {
      const request = createMockRequest('Fix the authentication bug');

      const result = await orchestrator.process(request);

      // Verify all stages executed
      expect(mockPromptAnalyzer.analyze).toHaveBeenCalledWith('Fix the authentication bug');
      expect(mockContextRetriever.retrieve).toHaveBeenCalled();
      expect(mockLLMGateway.complete).toHaveBeenCalled();

      // Verify result structure
      expect(result).toBeDefined();
      expect(result.requestId).toBeDefined();
      expect(result.originalPrompt).toBe('Fix the authentication bug');
      expect(result.analysis).toBeDefined();
      expect(result.retrievedContexts).toBeDefined();
      expect(result.synthesizedContext).toBeDefined();
      expect(result.constructedPrompt).toBeDefined();
      expect(result.llmResponse).toBeDefined();
      expect(result.processedResponse).toBeDefined();
      expect(result.totalLatencyMs).toBeGreaterThan(0);
      expect(result.latencyBreakdown).toBeDefined();
    });

    it('should measure latency for each pipeline stage', async () => {
      const request = createMockRequest('Test latency tracking');

      const result = await orchestrator.process(request);

      // Verify latency breakdown
      expect(result.latencyBreakdown).toBeDefined();
      expect(result.latencyBreakdown.collection).toBeGreaterThanOrEqual(0);
      expect(result.latencyBreakdown.analysis).toBeGreaterThanOrEqual(0);
      expect(result.latencyBreakdown.retrieval).toBeGreaterThanOrEqual(0);
      expect(result.latencyBreakdown.synthesis).toBeGreaterThanOrEqual(0);
      expect(result.latencyBreakdown.injection).toBeGreaterThanOrEqual(0);
      expect(result.latencyBreakdown.llm).toBeGreaterThanOrEqual(0);
      expect(result.latencyBreakdown.postProcessing).toBeGreaterThanOrEqual(0);

      // Total should be sum of all stages (approximately)
      const sum = Object.values(result.latencyBreakdown).reduce((a, b) => a + b, 0);
      expect(Math.abs(result.totalLatencyMs - sum)).toBeLessThan(10); // Allow small variance
    });

    it('should pass workspace ID through pipeline', async () => {
      const request = createMockRequest('Test prompt', '987e6543-e21b-34c5-a654-426614174999');

      await orchestrator.process(request);

      expect(mockContextRetriever.retrieve).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: '987e6543-e21b-34c5-a654-426614174999',
        })
      );
    });

    it('should pass task type to context retrieval', async () => {
      const request = createMockRequest('Fix bug');

      await orchestrator.process(request);

      expect(mockContextRetriever.retrieve).toHaveBeenCalledWith(
        expect.objectContaining({
          taskType: 'bug-fix',
        })
      );
    });

    it('should construct LLM request with correct messages', async () => {
      const request = createMockRequest('Test prompt');

      await orchestrator.process(request);

      expect(mockLLMGateway.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({ role: 'user' }),
          ]),
        })
      );
    });

    it('should respect token budget in LLM request', async () => {
      const request = createMockRequest('Test prompt');

      await orchestrator.process(request);

      expect(mockLLMGateway.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          maxTokens: 2048, // responseReserve from config
        })
      );
    });

    it('should include quality score in result', async () => {
      const request = createMockRequest('Test prompt');

      const result = await orchestrator.process(request);

      expect(result.processedResponse.qualityScore).toBeDefined();
      expect(result.processedResponse.qualityScore).toBeGreaterThanOrEqual(0);
      expect(result.processedResponse.qualityScore).toBeLessThanOrEqual(1);
    });

    it('should extract actions from response', async () => {
      mockLLMGateway.complete.mockResolvedValue(
        createMockLLMResponse('Update the file `src/test.ts` with new code')
      );

      const request = createMockRequest('Add feature');

      const result = await orchestrator.process(request);

      expect(result.processedResponse.actions).toBeDefined();
      // Actions should be extracted if response contains actionable content
    });
  });

  describe('Streaming Pipeline', () => {
    it('should process streaming pipeline successfully', async () => {
      const request = createMockRequest('Test streaming');

      const chunks: StreamingChunk[] = [];
      for await (const chunk of orchestrator.processStreaming(request)) {
        chunks.push(chunk);
      }

      // Should receive multiple chunks
      expect(chunks.length).toBeGreaterThan(0);

      // Should have different chunk types
      const chunkTypes = new Set(chunks.map((c) => c.type));
      expect(chunkTypes.has('analysis')).toBe(true);
      expect(chunkTypes.has('retrieval')).toBe(true);
      expect(chunkTypes.has('context')).toBe(true);
      expect(chunkTypes.has('llm-start')).toBe(true);
      expect(chunkTypes.has('llm-chunk')).toBe(true);
      expect(chunkTypes.has('llm-end')).toBe(true);
      expect(chunkTypes.has('complete')).toBe(true);
    });

    it('should emit analysis chunks with intent and task type', async () => {
      const request = createMockRequest('Test analysis');

      const chunks: StreamingChunk[] = [];
      for await (const chunk of orchestrator.processStreaming(request)) {
        chunks.push(chunk);
      }

      const analysisChunks = chunks.filter((c) => c.type === 'analysis' && c.data !== null);
      expect(analysisChunks.length).toBeGreaterThan(0);

      const analysisData = analysisChunks[0].data as any;
      expect(analysisData.intent).toBeDefined();
      expect(analysisData.taskType).toBeDefined();
    });

    it('should emit retrieval chunks with context count', async () => {
      const request = createMockRequest('Test retrieval');

      const chunks: StreamingChunk[] = [];
      for await (const chunk of orchestrator.processStreaming(request)) {
        chunks.push(chunk);
      }

      const retrievalChunks = chunks.filter((c) => c.type === 'retrieval' && c.data !== null);
      expect(retrievalChunks.length).toBeGreaterThan(0);

      const retrievalData = retrievalChunks[0].data as any;
      expect(retrievalData.contextsFound).toBeDefined();
      expect(retrievalData.contextsFound).toBeGreaterThanOrEqual(0);
    });

    it('should emit context chunks with section count', async () => {
      const request = createMockRequest('Test context');

      const chunks: StreamingChunk[] = [];
      for await (const chunk of orchestrator.processStreaming(request)) {
        chunks.push(chunk);
      }

      const contextChunks = chunks.filter((c) => c.type === 'context' && c.data !== null);
      expect(contextChunks.length).toBeGreaterThan(0);

      const contextData = contextChunks[0].data as any;
      expect(contextData.sections).toBeDefined();
      expect(contextData.sections).toBeGreaterThanOrEqual(0);
    });

    it('should stream LLM response chunks', async () => {
      const request = createMockRequest('Test LLM streaming');

      const chunks: StreamingChunk[] = [];
      for await (const chunk of orchestrator.processStreaming(request)) {
        chunks.push(chunk);
      }

      const llmChunks = chunks.filter((c) => c.type === 'llm-chunk');
      expect(llmChunks.length).toBeGreaterThan(0);

      // Should have content
      llmChunks.forEach((chunk) => {
        expect(chunk.data).toBeDefined();
        expect((chunk.data as any).content).toBeDefined();
      });
    });

    it('should emit llm-start before chunks and llm-end after', async () => {
      const request = createMockRequest('Test LLM boundaries');

      const chunks: StreamingChunk[] = [];
      for await (const chunk of orchestrator.processStreaming(request)) {
        chunks.push(chunk);
      }

      const llmStartIndex = chunks.findIndex((c) => c.type === 'llm-start');
      const llmChunkIndex = chunks.findIndex((c) => c.type === 'llm-chunk');
      const llmEndIndex = chunks.findIndex((c) => c.type === 'llm-end');

      expect(llmStartIndex).toBeGreaterThan(-1);
      expect(llmChunkIndex).toBeGreaterThan(llmStartIndex);
      expect(llmEndIndex).toBeGreaterThan(llmChunkIndex);
    });

    it('should emit complete chunk at the end', async () => {
      const request = createMockRequest('Test completion');

      const chunks: StreamingChunk[] = [];
      for await (const chunk of orchestrator.processStreaming(request)) {
        chunks.push(chunk);
      }

      const lastChunk = chunks[chunks.length - 1];
      expect(lastChunk.type).toBe('complete');
      expect(lastChunk.data).toBeDefined();
      expect((lastChunk.data as any).requestId).toBeDefined();
      expect((lastChunk.data as any).totalLatencyMs).toBeGreaterThanOrEqual(0);
      expect((lastChunk.data as any).qualityScore).toBeDefined();
    });

    it('should assemble full response from chunks', async () => {
      const request = createMockRequest('Test assembly');

      let fullResponse = '';
      for await (const chunk of orchestrator.processStreaming(request)) {
        if (chunk.type === 'llm-chunk') {
          fullResponse += (chunk.data as any).content;
        }
      }

      expect(fullResponse).toBe('Hello world!');
    });

    it('should include timestamp in all chunks', async () => {
      const request = createMockRequest('Test timestamps');

      const chunks: StreamingChunk[] = [];
      for await (const chunk of orchestrator.processStreaming(request)) {
        chunks.push(chunk);
      }

      chunks.forEach((chunk) => {
        expect(chunk.timestamp).toBeInstanceOf(Date);
      });
    });
  });

  describe('Error Handling', () => {
    it('should throw error when prompt analysis fails', async () => {
      mockPromptAnalyzer.analyze.mockRejectedValue(new Error('Analysis failed'));

      const request = createMockRequest('Test error');

      await expect(orchestrator.process(request)).rejects.toThrow('Analysis failed');
    });

    it('should throw error when context retrieval fails', async () => {
      mockContextRetriever.retrieve.mockRejectedValue(new Error('Retrieval failed'));

      const request = createMockRequest('Test error');

      await expect(orchestrator.process(request)).rejects.toThrow('Retrieval failed');
    });

    it('should throw error when LLM call fails', async () => {
      mockLLMGateway.complete.mockRejectedValue(new Error('LLM failed'));

      const request = createMockRequest('Test error');

      await expect(orchestrator.process(request)).rejects.toThrow('LLM failed');
    });

    it('should emit error chunk in streaming mode', async () => {
      mockPromptAnalyzer.analyze.mockRejectedValue(new Error('Streaming error'));

      const request = createMockRequest('Test streaming error');

      const chunks: StreamingChunk[] = [];
      try {
        for await (const chunk of orchestrator.processStreaming(request)) {
          chunks.push(chunk);
        }
      } catch {
        // Expected to throw
      }

      const errorChunk = chunks.find((c) => c.type === 'error');
      expect(errorChunk).toBeDefined();
      expect((errorChunk?.data as any).error).toBeDefined();
    });
  });

  describe('Context Retrieval Integration', () => {
    it('should pass correct query to context retriever', async () => {
      const request = createMockRequest('Find authentication bug');

      await orchestrator.process(request);

      expect(mockContextRetriever.retrieve).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'Find authentication bug',
        })
      );
    });

    it('should limit context retrieval results', async () => {
      const request = createMockRequest('Test limit');

      await orchestrator.process(request);

      expect(mockContextRetriever.retrieve).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
        })
      );
    });

    it('should handle empty context retrieval', async () => {
      mockContextRetriever.retrieve.mockResolvedValue({
        contexts: [],
        totalResults: 0,
        retrievalTimeMs: 10,
      });

      const request = createMockRequest('Test empty context');

      const result = await orchestrator.process(request);

      expect(result.retrievedContexts).toHaveLength(0);
      expect(result.synthesizedContext).toBeDefined();
    });
  });

  describe('Token Budget Management', () => {
    it('should pass token budget to synthesizer', async () => {
      const request = createMockRequest('Test token budget');

      const result = await orchestrator.process(request);

      // Synthesized context should respect token budget
      expect(result.synthesizedContext).toBeDefined();
      expect(result.synthesizedContext.sections).toBeDefined();
    });

    it('should reserve tokens for response', async () => {
      const request = createMockRequest('Test response reserve');

      await orchestrator.process(request);

      expect(mockLLMGateway.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          maxTokens: 2048, // From config.tokenBudget.responseReserve
        })
      );
    });
  });

  describe('Message Construction', () => {
    it('should build system and user messages', async () => {
      const request = createMockRequest('Test messages');

      await orchestrator.process(request);

      const callArgs = mockLLMGateway.complete.mock.calls[0][0];
      expect(callArgs.messages).toHaveLength(2);
      expect(callArgs.messages[0].role).toBe('system');
      expect(callArgs.messages[1].role).toBe('user');
    });

    it('should include synthesized context in system prompt', async () => {
      const request = createMockRequest('Test context in prompt');

      await orchestrator.process(request);

      const callArgs = mockLLMGateway.complete.mock.calls[0][0];
      const systemMessage = callArgs.messages[0];
      expect(systemMessage.content).toBeDefined();
      expect(systemMessage.content.length).toBeGreaterThan(0);
    });
  });
});

// Helper functions

function createMockRequest(
  prompt: string,
  workspaceId: string = '123e4567-e89b-12d3-a456-426614174000'
): PromptRequest {
  return {
    prompt,
    workspaceId,
    userId: '123e4567-e89b-12d3-a456-426614174001',
    sessionId: '123e4567-e89b-12d3-a456-426614174002',
    metadata: {
      source: 'api' as const,
    },
  };
}

function createMockAnalysis(): PromptAnalysis {
  return {
    prompt: 'Test prompt',
    intent: {
      category: 'coding' as IntentCategory,
      confidence: 0.9,
      indicators: ['fix', 'bug'],
    },
    taskType: {
      primary: {
        category: 'bug-fix' as TaskCategory,
        confidence: 0.85,
      },
      indicators: ['bug', 'fix'],
      isMultiTask: false,
    },
    entities: [],
    ambiguity: {
      isAmbiguous: false,
      overallScore: 0.9,
      ambiguities: [],
    },
    metadata: {
      language: 'en',
      wordCount: 10,
      hasCodeSnippets: false,
      hasQuestions: false,
      complexity: 'simple' as const,
    },
    metrics: {
      processingTimeMs: 50,
      timestamp: new Date(),
    },
  };
}

function createMockRetrievalResult() {
  return {
    contexts: [
      {
        id: 'context-1',
        type: 'file' as const,
        content: 'Mock file content',
        source: 'src/test.ts',
        relevanceScore: 0.9,
        metadata: {},
      },
      {
        id: 'context-2',
        type: 'documentation' as const,
        content: 'Mock documentation',
        source: 'README.md',
        relevanceScore: 0.8,
        metadata: {},
      },
    ],
    totalResults: 2,
    retrievalTimeMs: 50,
  };
}

function createMockLLMResponse(content: string = 'This is the LLM response.') {
  return {
    id: 'llm-response-id',
    model: 'gpt-4o',
    content,
    finishReason: 'stop' as const,
    usage: {
      promptTokens: 200,
      completionTokens: 100,
      totalTokens: 300,
    },
    createdAt: new Date(),
  };
}
