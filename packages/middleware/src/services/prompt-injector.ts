/**
 * Prompt Injector Service
 * 
 * Constructs final prompts by injecting synthesized contexts using various strategies.
 * This is the fifth stage in the orchestration pipeline (after synthesis).
 */

import type { Message } from '@axon/llm-gateway';
import { TaskCategory } from '@axon/shared';
import type {
  SynthesizedContext,
  ConstructedPrompt,
  EnrichedPrompt,
  InjectionStrategy,
} from '../types.js';

/**
 * Configuration for PromptInjector
 */
export interface PromptInjectorConfig {
  /** Default injection strategy */
  defaultStrategy?: InjectionStrategy;
  /** Maximum total tokens */
  maxTokens?: number;
  /** Enable logging */
  enableLogging?: boolean;
}

/**
 * PromptInjector Service
 * 
 * Responsibilities:
 * - Select injection strategy based on task type
 * - Construct system and user messages
 * - Inject context using appropriate strategy
 * - Validate token limits
 * - Format for LLM consumption
 */
export class PromptInjector {
  private config: Required<PromptInjectorConfig>;

  constructor(config: PromptInjectorConfig = {}) {
    this.config = {
      defaultStrategy: config.defaultStrategy ?? 'hybrid',
      maxTokens: config.maxTokens ?? 8192,
      enableLogging: config.enableLogging ?? true,
    };
  }

  /**
   * Inject context into prompt
   * 
   * @param enrichedPrompt - Enriched user prompt
   * @param synthesizedContext - Synthesized context sections
   * @param taskType - Task category
   * @param customStrategy - Optional custom injection strategy
   * @returns Constructed prompt ready for LLM
   */
  async inject(
    enrichedPrompt: EnrichedPrompt,
    synthesizedContext: SynthesizedContext,
    taskType: TaskCategory,
    customStrategy?: InjectionStrategy
  ): Promise<ConstructedPrompt> {
    // Select strategy
    const strategy = customStrategy ?? this.selectStrategy(taskType);

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt(taskType, synthesizedContext, strategy);

    // Build user prompt
    const userPrompt = this.buildUserPrompt(enrichedPrompt, synthesizedContext, strategy);

    // Estimate total tokens
    const totalTokens = this.estimateTokens(systemPrompt) + this.estimateTokens(userPrompt);

    // Validate token limits
    if (totalTokens > this.config.maxTokens) {
      throw new TokenLimitError(
        `Prompt exceeds token limit: ${totalTokens} > ${this.config.maxTokens}`,
        totalTokens,
        this.config.maxTokens
      );
    }

    // Log if enabled
    if (this.config.enableLogging) {
      this.logInjection({
        requestId: enrichedPrompt.requestId,
        strategy,
        taskType,
        totalTokens,
        contextSections: synthesizedContext.sections.length,
      });
    }

    return {
      systemPrompt,
      userPrompt,
      totalTokens,
      contextSections: synthesizedContext.sections,
    };
  }

  /**
   * Select injection strategy based on task type
   * 
   * @param taskType - Task category
   * @returns Injection strategy
   */
  private selectStrategy(taskType: TaskCategory): InjectionStrategy {
    // Task-specific strategy mapping
    const strategyMap: Record<TaskCategory, InjectionStrategy> = {
      [TaskCategory.GENERAL_QUERY]: 'prefix',
      [TaskCategory.BUG_FIX]: 'hybrid',
      [TaskCategory.FEATURE_ADD]: 'hybrid',
      [TaskCategory.FEATURE_REMOVE]: 'hybrid',
      [TaskCategory.DOCUMENTATION]: 'prefix',
      [TaskCategory.REFACTOR]: 'hybrid',
      [TaskCategory.CODE_REVIEW]: 'inline',
      [TaskCategory.TESTING]: 'hybrid',
      [TaskCategory.DEPLOYMENT]: 'prefix',
      [TaskCategory.OPTIMIZATION]: 'hybrid',
      [TaskCategory.SECURITY]: 'hybrid',
      [TaskCategory.ROADMAP]: 'prefix',
      // PKM-specific
      [TaskCategory.NOTE_OPERATIONS]: 'prefix',
      [TaskCategory.REFERENCE_MANAGEMENT]: 'prefix',
      [TaskCategory.PROJECT_MANAGEMENT]: 'prefix',
      [TaskCategory.TEMPLATING]: 'inline',
    };

    return strategyMap[taskType] || this.config.defaultStrategy;
  }

  /**
   * Build system prompt with context injection
   * 
   * @param taskType - Task category
   * @param context - Synthesized context
   * @param strategy - Injection strategy
   * @returns System prompt
   */
  private buildSystemPrompt(
    taskType: TaskCategory,
    context: SynthesizedContext,
    strategy: InjectionStrategy
  ): string {
    let systemPrompt = this.getBaseSystemPrompt(taskType);

    // Inject context based on strategy
    if (strategy === 'prefix' || strategy === 'hybrid') {
      systemPrompt += '\n\n' + this.formatContextSections(context, 'system');
    }

    // Add task-specific instructions
    systemPrompt += '\n\n' + this.getTaskInstructions(taskType);

    return systemPrompt;
  }

  /**
   * Build user prompt with context injection
   * 
   * @param enrichedPrompt - Enriched user prompt
   * @param context - Synthesized context
   * @param strategy - Injection strategy
   * @returns User prompt
   */
  private buildUserPrompt(
    enrichedPrompt: EnrichedPrompt,
    context: SynthesizedContext,
    strategy: InjectionStrategy
  ): string {
    let userPrompt = '';

    // Inject context based on strategy
    if (strategy === 'inline') {
      userPrompt = this.formatContextSections(context, 'inline');
      userPrompt += '\n\n**User Request:**\n' + enrichedPrompt.originalPrompt;
    } else if (strategy === 'suffix') {
      userPrompt = enrichedPrompt.originalPrompt;
      userPrompt += '\n\n' + this.formatContextSections(context, 'suffix');
    } else if (strategy === 'hybrid') {
      // Hybrid: Some context in system, some inline with user prompt
      userPrompt = this.formatContextSections(context, 'inline', 2); // Limit to 2 sections
      userPrompt += '\n\n**User Request:**\n' + enrichedPrompt.originalPrompt;
    } else {
      // Prefix: All context in system, just user prompt here
      userPrompt = enrichedPrompt.originalPrompt;
    }

    return userPrompt;
  }

  /**
   * Get base system prompt for task type
   * 
   * @param taskType - Task category
   * @returns Base system prompt
   */
  private getBaseSystemPrompt(taskType: TaskCategory): string {
    const basePrompts: Record<TaskCategory, string> = {
      [TaskCategory.GENERAL_QUERY]: 'You are an expert AI programming assistant. Answer the user\'s question accurately and concisely.',
      [TaskCategory.BUG_FIX]: 'You are an expert debugging assistant. Analyze the error, identify root causes, and provide clear fixes.',
      [TaskCategory.FEATURE_ADD]: 'You are an expert software engineer. Design and implement features following best practices and project conventions.',
      [TaskCategory.FEATURE_REMOVE]: 'You are an expert software engineer. Safely remove features while maintaining code integrity and dependencies.',
      [TaskCategory.DOCUMENTATION]: 'You are a technical documentation expert. Create clear, comprehensive documentation following industry standards.',
      [TaskCategory.REFACTOR]: 'You are a code quality expert. Refactor code to improve readability, maintainability, and performance.',
      [TaskCategory.CODE_REVIEW]: 'You are a senior code reviewer. Provide constructive feedback on code quality, bugs, and improvements.',
      [TaskCategory.TESTING]: 'You are a testing expert. Write comprehensive tests with good coverage and edge case handling.',
      [TaskCategory.DEPLOYMENT]: 'You are a DevOps expert. Guide deployment processes, CI/CD, and infrastructure setup.',
      [TaskCategory.OPTIMIZATION]: 'You are a performance optimization expert. Identify bottlenecks and implement efficient solutions.',
      [TaskCategory.SECURITY]: 'You are a security expert. Identify vulnerabilities and implement secure coding practices.',
      [TaskCategory.ROADMAP]: 'You are a technical architect. Plan features, milestones, and technical decisions strategically.',
      // PKM-specific
      [TaskCategory.NOTE_OPERATIONS]: 'You are a personal knowledge management assistant. Help organize, link, and maintain notes effectively.',
      [TaskCategory.REFERENCE_MANAGEMENT]: 'You are a research assistant. Manage references, citations, and source materials efficiently.',
      [TaskCategory.PROJECT_MANAGEMENT]: 'You are a project management assistant. Track tasks, milestones, and project progress.',
      [TaskCategory.TEMPLATING]: 'You are a template design expert. Create reusable, flexible templates for various use cases.',
    };

    return basePrompts[taskType] || basePrompts[TaskCategory.GENERAL_QUERY];
  }

  /**
   * Get task-specific instructions
   * 
   * @param taskType - Task category
   * @returns Task instructions
   */
  private getTaskInstructions(taskType: TaskCategory): string {
    const instructions: Partial<Record<TaskCategory, string>> = {
      [TaskCategory.BUG_FIX]: '**Instructions:**\n1. Analyze the error carefully\n2. Identify root cause\n3. Provide a clear fix\n4. Explain why this solves the issue',
      [TaskCategory.FEATURE_ADD]: '**Instructions:**\n1. Follow project conventions and architecture\n2. Write clean, tested code\n3. Update documentation\n4. Consider edge cases',
      [TaskCategory.CODE_REVIEW]: '**Instructions:**\n1. Check for bugs and logic errors\n2. Evaluate code quality and style\n3. Suggest improvements\n4. Be constructive and specific',
      [TaskCategory.TESTING]: '**Instructions:**\n1. Write comprehensive test cases\n2. Cover edge cases and error paths\n3. Follow testing best practices\n4. Aim for high coverage',
    };

    return instructions[taskType] || '';
  }

  /**
   * Format context sections for injection
   * 
   * @param context - Synthesized context
   * @param location - Where context is being injected
   * @param maxSections - Maximum number of sections to include
   * @returns Formatted context
   */
  private formatContextSections(
    context: SynthesizedContext,
    location: 'system' | 'inline' | 'suffix',
    maxSections?: number
  ): string {
    const sections = maxSections
      ? context.sections.slice(0, maxSections)
      : context.sections;

    if (sections.length === 0) {
      return '';
    }

    let formatted = '## Relevant Context\n\n';

    for (const section of sections) {
      formatted += `### ${section.title}\n\n`;
      formatted += section.content;
      formatted += '\n\n';
    }

    // Add source attribution
    if (context.sources.length > 0 && location === 'suffix') {
      formatted += '**Sources:**\n';
      context.sources.forEach(source => {
        formatted += `- ${source.source} (relevance: ${(source.score * 100).toFixed(1)}%)\n`;
      });
    }

    return formatted.trim();
  }

  /**
   * Estimate token count
   * 
   * @param text - Text to estimate
   * @returns Token count
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Log injection metrics
   * 
   * @param metrics - Injection metrics
   */
  private logInjection(metrics: {
    requestId: string;
    strategy: InjectionStrategy;
    taskType: TaskCategory;
    totalTokens: number;
    contextSections: number;
  }): void {
    console.log('[PromptInjector]', metrics);
  }
}

/**
 * Token limit error
 */
export class TokenLimitError extends Error {
  constructor(
    message: string,
    public actualTokens: number,
    public maxTokens: number
  ) {
    super(message);
    this.name = 'TokenLimitError';
    Object.setPrototypeOf(this, TokenLimitError.prototype);
  }
}
