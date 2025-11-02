/**
 * Prompt Orchestrator
 * 
 * Main orchestration service that chains all middleware components together.
 * Implements the complete Axon pipeline from user request to LLM response.
 */

import { PromptAnalyzer } from '@axon/prompt-analyzer';
import { ContextRetriever, ContextStorage } from '@axon/context-engine';
import { LLMGatewayService } from '@axon/llm-gateway';
import type { CompletionRequest, Message, MessageRole, StreamChunk } from '@axon/llm-gateway';
import type { TaskCategory } from '@axon/shared';
import { PromptCollector } from './services/prompt-collector.js';
import { ContextSynthesizer } from './services/context-synthesizer.js';
import { PromptInjector } from './services/prompt-injector.js';
import { ResponsePostProcessor } from './services/response-post-processor.js';
import type {
  PromptRequest,
  OrchestrationResult,
  StreamingChunk,
  MiddlewareConfig,
  TokenBudget,
} from './types.js';

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig extends MiddlewareConfig {
  /** Prompt analyzer instance */
  promptAnalyzer: PromptAnalyzer;
  /** Context retriever instance */
  contextRetriever: ContextRetriever;
  /** Context storage instance (for knowledge capture) */
  contextStorage?: ContextStorage;
  /** LLM gateway instance */
  llmGateway: LLMGatewayService;
}

/**
 * Main Prompt Orchestrator
 * 
 * Pipeline stages:
 * 1. Collection - Validate and enrich request
 * 2. Analysis - Classify intent and task type
 * 3. Retrieval - Fetch relevant contexts
 * 4. Synthesis - Format contexts within token budget
 * 5. Injection - Construct final prompt
 * 6. LLM - Generate response
 * 7. Post-processing - Extract actions and knowledge
 */
export class PromptOrchestrator {
  private collector: PromptCollector;
  private synthesizer: ContextSynthesizer;
  private injector: PromptInjector;
  private postProcessor: ResponsePostProcessor;
  private promptAnalyzer: PromptAnalyzer;
  private contextRetriever: ContextRetriever;
  private llmGateway: LLMGatewayService;
  private config: Required<MiddlewareConfig>;

  constructor(config: OrchestratorConfig) {
    this.config = {
      tokenBudget: config.tokenBudget ?? this.createDefaultTokenBudget(),
      defaultInjectionStrategy: config.defaultInjectionStrategy ?? 'hybrid',
      enableStreaming: config.enableStreaming ?? true,
      timeout: config.timeout ?? 30000,
      maxRetries: config.maxRetries ?? 3,
    };

    // Initialize services
    this.collector = new PromptCollector({ enableLogging: true });
    this.synthesizer = new ContextSynthesizer({
      defaultTokenBudget: this.config.tokenBudget,
      enableLogging: true,
    });
    this.injector = new PromptInjector({
      defaultStrategy: this.config.defaultInjectionStrategy,
      maxTokens: this.config.tokenBudget.total,
      enableLogging: true,
    });
    this.postProcessor = new ResponsePostProcessor(
      { enableLogging: true },
      config.contextStorage
    );

    // External dependencies
    this.promptAnalyzer = config.promptAnalyzer;
    this.contextRetriever = config.contextRetriever;
    this.llmGateway = config.llmGateway;
  }

  /**
   * Process a prompt request (non-streaming)
   * 
   * @param request - User prompt request
   * @returns Complete orchestration result
   */
  async process(request: PromptRequest): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const latencyBreakdown = {
      collection: 0,
      analysis: 0,
      retrieval: 0,
      synthesis: 0,
      injection: 0,
      llm: 0,
      postProcessing: 0,
    };

    try {
      // Stage 1: Collection
      const collectionStart = Date.now();
      const enrichedPrompt = await this.collector.collect(request);
      latencyBreakdown.collection = Date.now() - collectionStart;

      // Stage 2: Analysis
      const analysisStart = Date.now();
      const analysis = await this.promptAnalyzer.analyze(enrichedPrompt.originalPrompt);
      latencyBreakdown.analysis = Date.now() - analysisStart;

      const taskType = analysis.taskType.primary.category;

      // Stage 3: Retrieval
      const retrievalStart = Date.now();
      const retrievalResult = await this.contextRetriever.retrieve({
        query: enrichedPrompt.originalPrompt,
        workspaceId: request.workspaceId,
        taskType: taskType,
        limit: 10,
      });
      latencyBreakdown.retrieval = Date.now() - retrievalStart;

      // Stage 4: Synthesis
      const synthesisStart = Date.now();
      const synthesizedContext = await this.synthesizer.synthesize(
        retrievalResult.contexts,
        taskType,
        this.config.tokenBudget
      );
      latencyBreakdown.synthesis = Date.now() - synthesisStart;

      // Stage 5: Injection
      const injectionStart = Date.now();
      const constructedPrompt = await this.injector.inject(
        enrichedPrompt,
        synthesizedContext,
        taskType
      );
      latencyBreakdown.injection = Date.now() - injectionStart;

      // Stage 6: LLM
      const llmStart = Date.now();
      const llmRequest: CompletionRequest = {
        messages: this.buildMessages(
          constructedPrompt.systemPrompt,
          constructedPrompt.userPrompt
        ),
        model: 'gpt-4o' as any, // Use configured model
        temperature: 0.7,
        maxTokens: this.config.tokenBudget.responseReserve,
      };

      const llmResponse = await this.llmGateway.complete(llmRequest);
      latencyBreakdown.llm = Date.now() - llmStart;

      // Stage 7: Post-processing
      const postProcessingStart = Date.now();
      const processedResponse = await this.postProcessor.process(
        llmResponse,
        enrichedPrompt,
        request.workspaceId
      );
      latencyBreakdown.postProcessing = Date.now() - postProcessingStart;

      const totalLatencyMs = Date.now() - startTime;

      // Log orchestration metrics
      this.logOrchestration({
        requestId: enrichedPrompt.requestId,
        taskType,
        totalLatencyMs,
        latencyBreakdown,
        contextSections: synthesizedContext.sections.length,
        qualityScore: processedResponse.qualityScore,
      });

      return {
        requestId: enrichedPrompt.requestId,
        originalPrompt: enrichedPrompt.originalPrompt,
        analysis,
        retrievedContexts: retrievalResult.contexts,
        synthesizedContext,
        constructedPrompt,
        llmResponse,
        processedResponse,
        totalLatencyMs,
        latencyBreakdown,
      };
    } catch (error) {
      this.handleError(error, request);
      throw error;
    }
  }

  /**
   * Process a prompt request with streaming
   * 
   * @param request - User prompt request
   * @yields Streaming chunks as pipeline progresses
   */
  async *processStreaming(request: PromptRequest): AsyncGenerator<StreamingChunk> {
    const startTime = Date.now();

    try {
      // Stage 1: Collection
      yield { type: 'analysis', data: null, timestamp: new Date() };
      const enrichedPrompt = await this.collector.collect(request);

      // Stage 2: Analysis
      yield { type: 'analysis', data: null, timestamp: new Date() };
      const analysis = await this.promptAnalyzer.analyze(enrichedPrompt.originalPrompt);
      yield {
        type: 'analysis',
        data: {
          intent: analysis.intent.category,
          taskType: analysis.taskType.primary.category,
        },
        timestamp: new Date(),
      };

      const taskType = analysis.taskType.primary.category;

      // Stage 3: Retrieval
      yield { type: 'retrieval', data: null, timestamp: new Date() };
      const retrievalResult = await this.contextRetriever.retrieve({
        query: enrichedPrompt.originalPrompt,
        workspaceId: request.workspaceId,
        taskType: taskType,
        limit: 10,
      });
      yield {
        type: 'retrieval',
        data: { contextsFound: retrievalResult.contexts.length },
        timestamp: new Date(),
      };

      // Stage 4: Synthesis
      yield { type: 'context', data: null, timestamp: new Date() };
      const synthesizedContext = await this.synthesizer.synthesize(
        retrievalResult.contexts,
        taskType,
        this.config.tokenBudget
      );
      yield {
        type: 'context',
        data: { sections: synthesizedContext.sections.length },
        timestamp: new Date(),
      };

      // Stage 5: Injection
      const constructedPrompt = await this.injector.inject(
        enrichedPrompt,
        synthesizedContext,
        taskType
      );

      // Stage 6: LLM Streaming
      yield { type: 'llm-start', data: null, timestamp: new Date() };

      const llmRequest: CompletionRequest = {
        messages: this.buildMessages(
          constructedPrompt.systemPrompt,
          constructedPrompt.userPrompt
        ),
        model: 'gpt-4o' as any,
        temperature: 0.7,
        maxTokens: this.config.tokenBudget.responseReserve,
        stream: true,
      };

      let fullResponse = '';
      for await (const chunk of this.llmGateway.completeStream(llmRequest)) {
        fullResponse += chunk.delta;
        yield {
          type: 'llm-chunk',
          data: { content: chunk.delta },
          timestamp: new Date(),
        };
      }

      yield { type: 'llm-end', data: null, timestamp: new Date() };

      // Stage 7: Post-processing
      const processedResponse = await this.postProcessor.process(
        {
          id: enrichedPrompt.requestId,
          model: 'gpt-4o',
          content: fullResponse,
          finishReason: 'stop',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          createdAt: new Date(),
        },
        enrichedPrompt,
        request.workspaceId
      );

      const totalLatencyMs = Date.now() - startTime;

      yield {
        type: 'complete',
        data: {
          requestId: enrichedPrompt.requestId,
          totalLatencyMs,
          qualityScore: processedResponse.qualityScore,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      yield {
        type: 'error',
        data: { error: (error as Error).message },
        timestamp: new Date(),
      };
      throw error;
    }
  }

  /**
   * Build messages array for LLM
   * 
   * @param systemPrompt - System prompt
   * @param userPrompt - User prompt
   * @returns Messages array
   */
  private buildMessages(systemPrompt: string, userPrompt: string): Message[] {
    return [
      {
        role: 'system' as MessageRole,
        content: systemPrompt,
      },
      {
        role: 'user' as MessageRole,
        content: userPrompt,
      },
    ];
  }

  /**
   * Handle orchestration errors
   * 
   * @param error - Error object
   * @param request - Original request
   */
  private handleError(error: unknown, request: PromptRequest): void {
    console.error('[PromptOrchestrator] Error:', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      workspaceId: request.workspaceId,
      promptLength: request.prompt.length,
    });
  }

  /**
   * Log orchestration metrics
   * 
   * @param metrics - Orchestration metrics
   */
  private logOrchestration(metrics: {
    requestId: string;
    taskType: TaskCategory;
    totalLatencyMs: number;
    latencyBreakdown: Record<string, number>;
    contextSections: number;
    qualityScore: number;
  }): void {
    console.log('[PromptOrchestrator]', {
      ...metrics,
      avgLatencyPerStage:
        metrics.totalLatencyMs / Object.keys(metrics.latencyBreakdown).length,
    });
  }

  /**
   * Create default token budget
   * 
   * @returns Default token budget
   */
  private createDefaultTokenBudget(): TokenBudget {
    return {
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
    };
  }
}
