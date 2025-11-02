/**
 * Middleware Types and Interfaces
 * 
 * Defines the orchestration types for the Axon middleware layer.
 */

import type { IContext, TaskCategory } from '@axon/shared';
import type { PromptAnalysis } from '@axon/prompt-analyzer';
import type { ContextRetrievalResult, ScoredContext } from '@axon/context-engine';
import type { CompletionResponse, Message } from '@axon/llm-gateway';

/**
 * Raw incoming prompt request
 */
export interface PromptRequest {
  /** User's prompt text */
  prompt: string;
  /** Workspace identifier */
  workspaceId: string;
  /** Optional user identifier */
  userId?: string;
  /** Optional session identifier */
  sessionId?: string;
  /** Request metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Enriched prompt with metadata
 */
export interface EnrichedPrompt {
  /** Original prompt text */
  originalPrompt: string;
  /** Workspace ID */
  workspaceId: string;
  /** User ID */
  userId?: string;
  /** Session ID */
  sessionId?: string;
  /** Request timestamp */
  timestamp: Date;
  /** Request ID for tracking */
  requestId: string;
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * Synthesized context ready for injection
 */
export interface SynthesizedContext {
  /** Formatted context sections */
  sections: ContextSection[];
  /** Total tokens used */
  totalTokens: number;
  /** Token budget available */
  budgetRemaining: number;
  /** Context sources */
  sources: ContextSource[];
}

/**
 * Context section for structured injection
 */
export interface ContextSection {
  /** Section type */
  type: 'file' | 'symbol' | 'documentation' | 'conversation' | 'error' | 'architecture';
  /** Section title */
  title: string;
  /** Section content */
  content: string;
  /** Tokens used */
  tokens: number;
  /** Relevance score */
  relevance: number;
  /** Source context ID */
  contextId: string;
}

/**
 * Context source attribution
 */
export interface ContextSource {
  /** Context ID */
  contextId: string;
  /** Source file or location */
  source: string;
  /** Relevance score */
  score: number;
}

/**
 * Final constructed prompt
 */
export interface ConstructedPrompt {
  /** System prompt */
  systemPrompt: string;
  /** User prompt with injected context */
  userPrompt: string;
  /** Total tokens in prompt */
  totalTokens: number;
  /** Context sections used */
  contextSections: ContextSection[];
}

/**
 * Processed response with actions
 */
export interface ProcessedResponse {
  /** Original LLM response */
  response: string;
  /** Extracted actions */
  actions: ExtractedAction[];
  /** New knowledge to add to context */
  newKnowledge: NewKnowledge[];
  /** Quality score */
  qualityScore: number;
  /** Completeness flag */
  isComplete: boolean;
}

/**
 * Extracted action from response
 */
export interface ExtractedAction {
  /** Action type */
  type: 'code-change' | 'file-create' | 'file-delete' | 'doc-update' | 'test-create';
  /** Target file/entity */
  target: string;
  /** Action description */
  description: string;
  /** Confidence */
  confidence: number;
}

/**
 * New knowledge to add to context base
 */
export interface NewKnowledge {
  /** Knowledge type */
  type: 'pattern' | 'solution' | 'decision' | 'error-fix';
  /** Knowledge content */
  content: string;
  /** Related entities */
  entities: string[];
  /** Confidence */
  confidence: number;
}

/**
 * Complete orchestration result
 */
export interface OrchestrationResult {
  /** Request ID */
  requestId: string;
  /** Original prompt */
  originalPrompt: string;
  /** Analysis result */
  analysis: PromptAnalysis;
  /** Retrieved contexts */
  retrievedContexts: ScoredContext[];
  /** Synthesized context */
  synthesizedContext: SynthesizedContext;
  /** Constructed prompt */
  constructedPrompt: ConstructedPrompt;
  /** LLM response */
  llmResponse: CompletionResponse;
  /** Processed response */
  processedResponse: ProcessedResponse;
  /** Total latency in milliseconds */
  totalLatencyMs: number;
  /** Latency breakdown */
  latencyBreakdown: LatencyBreakdown;
}

/**
 * Latency breakdown by stage
 */
export interface LatencyBreakdown {
  collection: number;
  analysis: number;
  retrieval: number;
  synthesis: number;
  injection: number;
  llm: number;
  postProcessing: number;
}

/**
 * Streaming orchestration chunk
 */
export interface StreamingChunk {
  /** Chunk type */
  type: 'analysis' | 'retrieval' | 'context' | 'llm-start' | 'llm-chunk' | 'llm-end' | 'complete' | 'error';
  /** Chunk data */
  data: any;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Token budget configuration
 */
export interface TokenBudget {
  /** Total available tokens */
  total: number;
  /** Reserved for response */
  responseReserve: number;
  /** Available for context */
  contextBudget: number;
  /** Allocation by section type */
  allocation: {
    file: number;
    symbol: number;
    documentation: number;
    conversation: number;
    error: number;
    architecture: number;
  };
}

/**
 * Injection strategy
 */
export type InjectionStrategy = 'prefix' | 'inline' | 'suffix' | 'hybrid';

/**
 * Middleware configuration
 */
export interface MiddlewareConfig {
  /** Token budget configuration */
  tokenBudget: TokenBudget;
  /** Default injection strategy */
  defaultInjectionStrategy: InjectionStrategy;
  /** Enable streaming */
  enableStreaming: boolean;
  /** Timeout in milliseconds */
  timeout: number;
  /** Max retries for LLM calls */
  maxRetries: number;
}
