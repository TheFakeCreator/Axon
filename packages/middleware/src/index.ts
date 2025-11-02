/**
 * Axon Middleware Package
 * 
 * Orchestration layer that chains all Axon services together.
 * 
 * @packageDocumentation
 */

// Export services
export { PromptCollector, ValidationError } from './services/prompt-collector.js';
export { ContextSynthesizer } from './services/context-synthesizer.js';
export { PromptInjector, TokenLimitError } from './services/prompt-injector.js';
export { ResponsePostProcessor } from './services/response-post-processor.js';
export { PromptOrchestrator } from './orchestrator.js';

// Export types
export type {
  PromptRequest,
  EnrichedPrompt,
  SynthesizedContext,
  ContextSection,
  ContextSource,
  ConstructedPrompt,
  ProcessedResponse,
  ExtractedAction,
  NewKnowledge,
  OrchestrationResult,
  StreamingChunk,
  TokenBudget,
  InjectionStrategy,
  MiddlewareConfig,
} from './types.js';

// Export service configs
export type { PromptCollectorConfig } from './services/prompt-collector.js';
export type { ContextSynthesizerConfig } from './services/context-synthesizer.js';
export type { PromptInjectorConfig } from './services/prompt-injector.js';
export type { ResponsePostProcessorConfig } from './services/response-post-processor.js';
export type { OrchestratorConfig } from './orchestrator.js';
