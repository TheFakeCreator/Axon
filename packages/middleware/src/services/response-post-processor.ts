/**
 * Response Post-Processor Service
 * 
 * Processes LLM responses to extract actions, assess quality, and capture new knowledge.
 * This is the final stage in the orchestration pipeline.
 */

import type { CompletionResponse } from '@axon/llm-gateway';
import type { ContextStorage } from '@axon/context-engine';
import type {
  ProcessedResponse,
  ExtractedAction,
  NewKnowledge,
  EnrichedPrompt,
} from '../types.js';

/**
 * Configuration for ResponsePostProcessor
 */
export interface ResponsePostProcessorConfig {
  /** Enable quality assessment */
  enableQualityAssessment?: boolean;
  /** Enable action extraction */
  enableActionExtraction?: boolean;
  /** Enable knowledge capture */
  enableKnowledgeCapture?: boolean;
  /** Minimum confidence for actions */
  minActionConfidence?: number;
  /** Minimum confidence for knowledge */
  minKnowledgeConfidence?: number;
  /** Enable logging */
  enableLogging?: boolean;
}

/**
 * ResponsePostProcessor Service
 * 
 * Responsibilities:
 * - Assess response quality and completeness
 * - Extract actionable items (code changes, file operations, etc.)
 * - Capture new knowledge for context evolution
 * - Provide feedback loop to context engine
 */
export class ResponsePostProcessor {
  private config: Required<ResponsePostProcessorConfig>;
  private contextStorage?: ContextStorage;

  constructor(
    config: ResponsePostProcessorConfig = {},
    contextStorage?: ContextStorage
  ) {
    this.config = {
      enableQualityAssessment: config.enableQualityAssessment ?? true,
      enableActionExtraction: config.enableActionExtraction ?? true,
      enableKnowledgeCapture: config.enableKnowledgeCapture ?? true,
      minActionConfidence: config.minActionConfidence ?? 0.6,
      minKnowledgeConfidence: config.minKnowledgeConfidence ?? 0.7,
      enableLogging: config.enableLogging ?? true,
    };
    this.contextStorage = contextStorage;
  }

  /**
   * Process LLM response
   * 
   * @param response - LLM completion response
   * @param enrichedPrompt - Original enriched prompt
   * @param workspaceId - Workspace ID for knowledge capture
   * @returns Processed response with extracted actions and knowledge
   */
  async process(
    response: CompletionResponse,
    enrichedPrompt: EnrichedPrompt,
    workspaceId: string
  ): Promise<ProcessedResponse> {
    const responseText = response.content;

    // Assess quality
    const qualityScore = this.config.enableQualityAssessment
      ? this.assessQuality(responseText, enrichedPrompt)
      : 1.0;

    const isComplete = this.checkCompleteness(responseText);

    // Extract actions
    const actions = this.config.enableActionExtraction
      ? await this.extractActions(responseText)
      : [];

    // Capture new knowledge
    const newKnowledge = this.config.enableKnowledgeCapture
      ? await this.extractKnowledge(responseText, enrichedPrompt)
      : undefined;

    const knowledgeArray: NewKnowledge[] = newKnowledge ? [newKnowledge] : [];

    // Store knowledge in context base (async, don't wait)
    if (newKnowledge && this.contextStorage) {
      this.storeKnowledge(newKnowledge, workspaceId).catch(err => {
        console.error('[ResponsePostProcessor] Failed to store knowledge:', err);
      });
    }

    // Log if enabled
    if (this.config.enableLogging) {
      this.logProcessing({
        requestId: enrichedPrompt.requestId,
        qualityScore,
        isComplete,
        actionsCount: actions.length,
        hasNewKnowledge: !!newKnowledge,
      });
    }

    return {
      response: responseText,
      actions,
      newKnowledge: knowledgeArray,
      qualityScore,
      isComplete,
    };
  }

  /**
   * Assess response quality
   * 
   * Evaluates:
   * - Completeness (addresses all parts of the prompt)
   * - Clarity (well-structured, readable)
   * - Relevance (stays on topic)
   * - Actionability (provides concrete next steps)
   * 
   * @param response - Response text
   * @param prompt - Original prompt
   * @returns Quality score (0-1)
   */
  private assessQuality(response: string, prompt: EnrichedPrompt): number {
    let score = 1.0;

    // Check for error indicators
    const errorIndicators = [
      'I don\'t know',
      'I\'m not sure',
      'I cannot',
      'insufficient information',
      'unclear',
    ];

    for (const indicator of errorIndicators) {
      if (response.toLowerCase().includes(indicator.toLowerCase())) {
        score -= 0.2;
      }
    }

    // Check for code blocks if expected (heuristic: prompt mentions code-related terms)
    const codeRelatedTerms = ['function', 'class', 'code', 'implement', 'bug', 'error'];
    const promptMentionsCode = codeRelatedTerms.some(term =>
      prompt.originalPrompt.toLowerCase().includes(term)
    );

    if (promptMentionsCode && !response.includes('```')) {
      score -= 0.15;
    }

    // Check length (too short might be incomplete)
    if (response.length < 100) {
      score -= 0.2;
    }

    // Check for structured response (headings, lists)
    const hasStructure = /^#+\s/m.test(response) || /^[-*]\s/m.test(response);
    if (!hasStructure && response.length > 500) {
      score -= 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Check if response is complete
   * 
   * @param response - Response text
   * @returns True if response appears complete
   */
  private checkCompleteness(response: string): boolean {
    // Check for incompleteness indicators
    const incompleteIndicators = [
      'to be continued',
      '...',
      '[incomplete]',
      '[truncated]',
      'more to come',
    ];

    for (const indicator of incompleteIndicators) {
      if (response.toLowerCase().includes(indicator.toLowerCase())) {
        return false;
      }
    }

    // Check if response ends abruptly (no proper punctuation)
    const lastChar = response.trim().slice(-1);
    const properEndings = ['.', '!', '?', '`', '}', ']', ')'];

    return properEndings.includes(lastChar);
  }

  /**
   * Extract actionable items from response
   * 
   * Detects:
   * - Code changes (file modifications)
   * - File creation/deletion
   * - Documentation updates
   * - Test creation
   * - Commands to run
   * 
   * @param response - Response text
   * @returns Extracted actions
   */
  private async extractActions(response: string): Promise<ExtractedAction[]> {
    const actions: ExtractedAction[] = [];

    // Extract code blocks (potential code changes)
    const codeBlockRegex = /```[\w]*\n([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockRegex.exec(response)) !== null) {
      const code = match[1];
      
      // Try to determine file path from context
      const filePathMatch = response
        .slice(Math.max(0, match.index - 200), match.index)
        .match(/(?:file|path|in)\s+`([^`]+)`/i);

      actions.push({
        type: 'code-change',
        target: filePathMatch ? filePathMatch[1] : 'unknown',
        description: 'Code modification detected',
        confidence: filePathMatch ? 0.8 : 0.6,
      });
    }

    // Extract file operations
    const fileOpPatterns = [
      { regex: /create\s+(?:a\s+)?(?:new\s+)?file\s+`([^`]+)`/gi, type: 'file-create' as const },
      { regex: /delete\s+(?:the\s+)?file\s+`([^`]+)`/gi, type: 'file-delete' as const },
      { regex: /update\s+(?:the\s+)?(?:file\s+)?`([^`]+)`/gi, type: 'code-change' as const },
    ];

    for (const pattern of fileOpPatterns) {
      let opMatch;
      while ((opMatch = pattern.regex.exec(response)) !== null) {
        actions.push({
          type: pattern.type,
          target: opMatch[1],
          description: `${pattern.type} operation`,
          confidence: 0.75,
        });
      }
    }

    // Extract test creation
    if (/write\s+(?:a\s+)?test|create\s+test|add\s+test/i.test(response)) {
      const testFileMatch = response.match(/test\s+(?:file\s+)?`([^`]+)`/i);
      actions.push({
        type: 'test-create',
        target: testFileMatch ? testFileMatch[1] : 'unknown',
        description: 'Test creation suggested',
        confidence: testFileMatch ? 0.8 : 0.6,
      });
    }

    // Extract documentation updates
    if (/update\s+(?:the\s+)?documentation|document\s+(?:the|this)/i.test(response)) {
      actions.push({
        type: 'doc-update',
        target: 'documentation',
        description: 'Documentation update suggested',
        confidence: 0.7,
      });
    }

    // Filter by confidence threshold
    return actions.filter(action => action.confidence >= this.config.minActionConfidence);
  }

  /**
   * Extract new knowledge from response
   * 
   * Captures:
   * - Patterns (coding patterns, best practices)
   * - Solutions (bug fixes, implementations)
   * - Decisions (architectural choices)
   * - Error fixes (error resolutions)
   * 
   * @param response - Response text
   * @param prompt - Original prompt
   * @returns New knowledge to store
   */
  private async extractKnowledge(
    response: string,
    prompt: EnrichedPrompt
  ): Promise<NewKnowledge | undefined> {
    // Determine knowledge type based on response content
    let knowledgeType: NewKnowledge['type'] | undefined;
    let confidence = 0.7;

    if (/(?:pattern|approach|best practice)/i.test(response)) {
      knowledgeType = 'pattern';
      confidence = 0.8;
    } else if (/(?:fix|solution|resolve)/i.test(response)) {
      knowledgeType = 'solution';
      confidence = 0.85;
    } else if (/(?:decision|chose|selected|prefer)/i.test(response)) {
      knowledgeType = 'decision';
      confidence = 0.75;
    } else if (/(?:error|bug|issue).*(?:fix|resolve|solution)/i.test(response)) {
      knowledgeType = 'error-fix';
      confidence = 0.9;
    }

    if (!knowledgeType) {
      return undefined;
    }

    // Extract entities (files, functions, classes mentioned)
    const entities: string[] = [];

    // Extract file paths
    const fileMatches = response.matchAll(/`([^`]+\.(?:ts|js|py|java|cpp|go|rs))`/g);
    for (const match of fileMatches) {
      entities.push(match[1]);
    }

    // Extract function/class names
    const symbolMatches = response.matchAll(/`([A-Z][a-zA-Z0-9]*|[a-z][a-zA-Z0-9]*\(\))`/g);
    for (const match of symbolMatches) {
      entities.push(match[1]);
    }

    if (confidence < this.config.minKnowledgeConfidence) {
      return undefined;
    }

    return {
      type: knowledgeType,
      content: response,
      entities: [...new Set(entities)], // Deduplicate
      confidence,
    };
  }

  /**
   * Store knowledge in context base
   * 
   * @param knowledge - Knowledge to store
   * @param workspaceId - Workspace ID
   */
  private async storeKnowledge(
    knowledge: NewKnowledge,
    workspaceId: string
  ): Promise<void> {
    if (!this.contextStorage) {
      return;
    }

    // Convert to context format and store
    // This would integrate with the ContextStorage service
    // For now, just log
    console.log('[ResponsePostProcessor] Would store knowledge:', {
      type: knowledge.type,
      confidence: knowledge.confidence,
      entitiesCount: knowledge.entities.length,
      workspaceId,
    });

    // TODO: Implement actual storage
    // await this.contextStorage.store({
    //   workspaceId,
    //   type: knowledge.type,
    //   content: knowledge.content,
    //   metadata: { ...knowledge.metadata, entities: knowledge.entities },
    // });
  }

  /**
   * Log processing metrics
   * 
   * @param metrics - Processing metrics
   */
  private logProcessing(metrics: {
    requestId: string;
    qualityScore: number;
    isComplete: boolean;
    actionsCount: number;
    hasNewKnowledge: boolean;
  }): void {
    console.log('[ResponsePostProcessor]', metrics);
  }
}
