/**
 * Context Synthesizer Service
 * 
 * Transforms retrieved contexts into LLM-optimized format with token budget management.
 * This is the fourth stage in the orchestration pipeline (after retrieval).
 */

import { TaskCategory } from '@axon/shared';
import type { ScoredContext } from '@axon/context-engine';
import type {
  SynthesizedContext,
  ContextSection,
  ContextSource,
  TokenBudget,
} from '../types.js';

/**
 * Configuration for ContextSynthesizer
 */
export interface ContextSynthesizerConfig {
  /** Default token budget */
  defaultTokenBudget?: TokenBudget;
  /** Enable context compression */
  enableCompression?: boolean;
  /** Compression threshold (when to start compressing) */
  compressionThreshold?: number;
  /** Enable logging */
  enableLogging?: boolean;
}

/**
 * Context type for allocation
 */
export type ContextType = 
  | 'file'
  | 'symbol'
  | 'documentation'
  | 'conversation'
  | 'error'
  | 'architecture';

/**
 * ContextSynthesizer Service
 * 
 * Responsibilities:
 * - Allocate token budget based on task type
 * - Select and prioritize contexts within budget
 * - Format contexts for LLM consumption (Markdown)
 * - Compress contexts when needed (summarization, truncation)
 * - Provide source attribution
 */
export class ContextSynthesizer {
  private config: Required<ContextSynthesizerConfig>;

  constructor(config: ContextSynthesizerConfig = {}) {
    this.config = {
      defaultTokenBudget: config.defaultTokenBudget ?? this.createDefaultBudget(),
      enableCompression: config.enableCompression ?? true,
      compressionThreshold: config.compressionThreshold ?? 0.8,
      enableLogging: config.enableLogging ?? true,
    };
  }

  /**
   * Synthesize contexts into LLM-optimized format
   * 
   * @param contexts - Retrieved contexts with scores
   * @param taskType - Task type for allocation strategy
   * @param customBudget - Optional custom token budget
   * @returns Synthesized context ready for injection
   */
  async synthesize(
    contexts: ScoredContext[],
    taskType: TaskCategory,
    customBudget?: TokenBudget
  ): Promise<SynthesizedContext> {
    const budget = customBudget ?? this.config.defaultTokenBudget;

    // Allocate token budget based on task type
    const allocation = this.allocateTokensByTaskType(budget, taskType);

    // Select contexts within budget
    const selectedContexts = this.selectContextsWithinBudget(contexts, allocation);

    // Format contexts into sections
    const sections = await this.formatContexts(selectedContexts, taskType);

    // Calculate token usage
    const totalTokens = sections.reduce((sum, section) => sum + section.tokens, 0);
    const budgetRemaining = budget.contextBudget - totalTokens;

    // Extract sources
    const sources = this.extractSources(selectedContexts);

    // Log if enabled
    if (this.config.enableLogging) {
      this.logSynthesis({
        totalContexts: contexts.length,
        selectedContexts: selectedContexts.length,
        totalTokens,
        budgetRemaining,
        taskType,
      });
    }

    return {
      sections,
      totalTokens,
      budgetRemaining,
      sources,
    };
  }

  /**
   * Allocate token budget based on task type
   * 
   * Different task types require different context distributions:
   * - Bug Fix: More error context, less documentation
   * - Feature Add: More architecture, less conversation
   * - Documentation: More existing docs, less code
   * 
   * @param budget - Token budget
   * @param taskType - Task category
   * @returns Adjusted budget allocation
   */
  private allocateTokensByTaskType(
    budget: TokenBudget,
    taskType: TaskCategory
  ): TokenBudget['allocation'] {
    const { allocation } = budget;

    // Task-specific adjustments (percentages)
    const adjustments: Record<TaskCategory, Partial<TokenBudget['allocation']>> = {
      [TaskCategory.GENERAL_QUERY]: {}, // Use default allocation
      [TaskCategory.BUG_FIX]: {
        error: Math.floor(allocation.error * 1.5),
        file: Math.floor(allocation.file * 1.2),
        documentation: Math.floor(allocation.documentation * 0.7),
      },
      [TaskCategory.FEATURE_ADD]: {
        architecture: Math.floor(allocation.architecture * 1.4),
        symbol: Math.floor(allocation.symbol * 1.3),
        conversation: Math.floor(allocation.conversation * 0.8),
      },
      [TaskCategory.FEATURE_REMOVE]: {
        architecture: Math.floor(allocation.architecture * 1.3),
        file: Math.floor(allocation.file * 1.2),
      },
      [TaskCategory.DOCUMENTATION]: {
        documentation: Math.floor(allocation.documentation * 1.5),
        file: Math.floor(allocation.file * 1.2),
        symbol: Math.floor(allocation.symbol * 0.8),
      },
      [TaskCategory.REFACTOR]: {
        architecture: Math.floor(allocation.architecture * 1.3),
        symbol: Math.floor(allocation.symbol * 1.3),
        conversation: Math.floor(allocation.conversation * 0.8),
      },
      [TaskCategory.CODE_REVIEW]: {
        file: Math.floor(allocation.file * 1.4),
        symbol: Math.floor(allocation.symbol * 1.2),
        architecture: Math.floor(allocation.architecture * 1.1),
      },
      [TaskCategory.TESTING]: {
        symbol: Math.floor(allocation.symbol * 1.3),
        file: Math.floor(allocation.file * 1.2),
        documentation: Math.floor(allocation.documentation * 1.1),
      },
      [TaskCategory.DEPLOYMENT]: {
        architecture: Math.floor(allocation.architecture * 1.4),
        documentation: Math.floor(allocation.documentation * 1.3),
        file: Math.floor(allocation.file * 0.8),
      },
      [TaskCategory.OPTIMIZATION]: {
        file: Math.floor(allocation.file * 1.3),
        symbol: Math.floor(allocation.symbol * 1.3),
        architecture: Math.floor(allocation.architecture * 1.1),
      },
      [TaskCategory.SECURITY]: {
        file: Math.floor(allocation.file * 1.3),
        architecture: Math.floor(allocation.architecture * 1.2),
        documentation: Math.floor(allocation.documentation * 1.1),
      },
      [TaskCategory.ROADMAP]: {
        architecture: Math.floor(allocation.architecture * 1.5),
        documentation: Math.floor(allocation.documentation * 1.3),
        conversation: Math.floor(allocation.conversation * 1.2),
      },
      // PKM-specific task types
      [TaskCategory.NOTE_OPERATIONS]: {
        documentation: Math.floor(allocation.documentation * 1.4),
        conversation: Math.floor(allocation.conversation * 1.2),
      },
      [TaskCategory.REFERENCE_MANAGEMENT]: {
        documentation: Math.floor(allocation.documentation * 1.5),
        architecture: Math.floor(allocation.architecture * 1.1),
      },
      [TaskCategory.PROJECT_MANAGEMENT]: {
        architecture: Math.floor(allocation.architecture * 1.4),
        documentation: Math.floor(allocation.documentation * 1.2),
        conversation: Math.floor(allocation.conversation * 1.2),
      },
      [TaskCategory.TEMPLATING]: {
        documentation: Math.floor(allocation.documentation * 1.3),
        file: Math.floor(allocation.file * 1.2),
      },
    };

    return {
      ...allocation,
      ...adjustments[taskType],
    };
  }

  /**
   * Select contexts that fit within token budget
   * 
   * @param contexts - All retrieved contexts
   * @param allocation - Token allocation by type
   * @returns Selected contexts within budget
   */
  private selectContextsWithinBudget(
    contexts: ScoredContext[],
    allocation: TokenBudget['allocation']
  ): ScoredContext[] {
    // Group contexts by type
    const contextsByType = this.groupContextsByType(contexts);

    const selected: ScoredContext[] = [];

    // Select contexts for each type within allocation
    for (const [type, typeContexts] of Object.entries(contextsByType)) {
      const typeAllocation = allocation[type as ContextType] ?? 0;
      let tokensUsed = 0;

      // Sort by score descending
      const sortedContexts = typeContexts.sort((a, b) => b.score - a.score);

      for (const context of sortedContexts) {
        const contextTokens = this.estimateTokens(context.content);
        if (tokensUsed + contextTokens <= typeAllocation) {
          selected.push(context);
          tokensUsed += contextTokens;
        }
      }
    }

    return selected;
  }

  /**
   * Format contexts into structured sections
   * 
   * @param contexts - Selected contexts
   * @param taskType - Task type for formatting strategy
   * @returns Formatted context sections
   */
  private async formatContexts(
    contexts: ScoredContext[],
    taskType: TaskCategory
  ): Promise<ContextSection[]> {
    const sections: ContextSection[] = [];

    for (const context of contexts) {
      const content = await this.formatContext(context, taskType);
      const tokens = this.estimateTokens(content);

      sections.push({
        type: this.mapContextTypeToSectionType(context.type),
        title: this.generateSectionTitle(context),
        content,
        tokens,
        relevance: context.score,
        contextId: context.id,
      });
    }

    return sections;
  }

  /**
   * Format a single context with Markdown
   * 
   * @param context - Context to format
   * @param taskType - Task type
   * @returns Formatted content
   */
  private async formatContext(
    context: ScoredContext,
    taskType: TaskCategory
  ): Promise<string> {
    const { type, content, metadata } = context;

    // Apply compression if needed
    let formattedContent = content;
    if (this.shouldCompress(content)) {
      formattedContent = await this.compressContent(content, type);
    }

    // Add metadata
    let markdown = '';

    if (metadata?.filePath) {
      markdown += `**File:** \`${metadata.filePath}\`\n\n`;
    }

    if (metadata?.language) {
      markdown += `**Language:** ${metadata.language}\n\n`;
    }

    // Format content based on type
    if (type === 'file' || type === 'symbol') {
      const lang = metadata?.language || '';
      markdown += `\`\`\`${lang}\n${formattedContent}\n\`\`\`\n`;
    } else {
      markdown += `${formattedContent}\n`;
    }

    return markdown;
  }

  /**
   * Compress content if needed
   * 
   * @param content - Content to compress
   * @param type - Context type
   * @returns Compressed content
   */
  private async compressContent(content: string, type: string): Promise<string> {
    // Simple compression: truncate with ellipsis
    // In production, use LLM-based summarization for better quality
    const maxLength = 1000; // characters

    if (content.length <= maxLength) {
      return content;
    }

    // Keep beginning and end, truncate middle
    const keepChars = Math.floor(maxLength / 2);
    const start = content.slice(0, keepChars);
    const end = content.slice(-keepChars);

    return `${start}\n\n... [Content truncated for brevity] ...\n\n${end}`;
  }

  /**
   * Check if content should be compressed
   * 
   * @param content - Content to check
   * @returns True if should compress
   */
  private shouldCompress(content: string): boolean {
    if (!this.config.enableCompression) {
      return false;
    }

    const tokens = this.estimateTokens(content);
    const threshold = this.config.compressionThreshold * this.config.defaultTokenBudget.total;

    return tokens > threshold;
  }

  /**
   * Estimate token count for content
   * 
   * Uses rough heuristic: 1 token ≈ 4 characters
   * For production, use proper tokenizer (tiktoken)
   * 
   * @param content - Content to estimate
   * @returns Estimated token count
   */
  private estimateTokens(content: string): number {
    return Math.ceil(content.length / 4);
  }

  /**
   * Group contexts by type
   * 
   * @param contexts - Contexts to group
   * @returns Contexts grouped by type
   */
  private groupContextsByType(
    contexts: ScoredContext[]
  ): Record<string, ScoredContext[]> {
    const grouped: Record<string, ScoredContext[]> = {
      file: [],
      symbol: [],
      documentation: [],
      conversation: [],
      error: [],
      architecture: [],
    };

    for (const context of contexts) {
      const type = this.mapContextTypeToSectionType(context.type);
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(context);
    }

    return grouped;
  }

  /**
   * Map context type to section type
   * 
   * @param contextType - Context type from storage
   * @returns Section type
   */
  private mapContextTypeToSectionType(contextType: string): ContextType {
    const mapping: Record<string, ContextType> = {
      code: 'file',
      file: 'file',
      function: 'symbol',
      class: 'symbol',
      symbol: 'symbol',
      documentation: 'documentation',
      docs: 'documentation',
      conversation: 'conversation',
      chat: 'conversation',
      error: 'error',
      diagnostic: 'error',
      architecture: 'architecture',
      design: 'architecture',
    };

    return mapping[contextType.toLowerCase()] || 'file';
  }

  /**
   * Generate section title from context
   * 
   * @param context - Context
   * @returns Section title
   */
  private generateSectionTitle(context: ScoredContext): string {
    const { metadata } = context;

    if (metadata?.symbolName) {
      return `${metadata.symbolName} (${metadata.filePath || 'Unknown file'})`;
    }

    if (metadata?.filePath) {
      return metadata.filePath as string;
    }

    return `${context.type} Context`;
  }

  /**
   * Extract sources from contexts
   * 
   * @param contexts - Selected contexts
   * @returns Context sources
   */
  private extractSources(contexts: ScoredContext[]): ContextSource[] {
    return contexts.map(context => ({
      contextId: context.id,
      source: context.metadata?.filePath as string || context.type,
      score: context.score,
    }));
  }

  /**
   * Create default token budget
   * 
   * @returns Default budget
   */
  private createDefaultBudget(): TokenBudget {
    return {
      total: 8192, // GPT-4 context window
      responseReserve: 2048, // Reserve for response
      contextBudget: 6144, // Available for context
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

  /**
   * Log synthesis metrics
   * 
   * @param metrics - Synthesis metrics
   */
  private logSynthesis(metrics: {
    totalContexts: number;
    selectedContexts: number;
    totalTokens: number;
    budgetRemaining: number;
    taskType: TaskCategory;
  }): void {
    console.log('[ContextSynthesizer]', metrics);
  }
}
