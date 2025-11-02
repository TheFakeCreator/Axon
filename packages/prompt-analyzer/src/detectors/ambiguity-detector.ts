/**
 * Ambiguity Detector
 * 
 * Detects various types of ambiguity in prompts:
 * - Underspecification (missing critical information)
 * - Vagueness (too general or unclear)
 * - Multiple interpretations
 * - Incomplete context
 * - Conflicting requirements
 */

import { AmbiguityType, DetectedAmbiguity, AmbiguityResult, DetectorConfig } from '../types';
import { logger } from '@axon/shared';
import nlp from 'compromise';

/**
 * Question words that often indicate missing information
 */
const QUESTION_INDICATORS = [
  'how', 'what', 'why', 'when', 'where', 'which', 'who',
  '?', // Direct question mark
];

/**
 * Vague terms that indicate lack of specificity
 */
const VAGUE_TERMS = [
  'something', 'somehow', 'somewhere', 'someone',
  'thing', 'stuff', 'things', 'some', 'any',
  'better', 'good', 'nice', 'cool', 'awesome',
  'simple', 'easy', 'quick', 'fast',
];

/**
 * Pronouns without clear antecedents
 */
const AMBIGUOUS_PRONOUNS = [
  'it', 'this', 'that', 'these', 'those',
  'they', 'them', 'their',
];

/**
 * Conflicting indicators
 */
const CONFLICTING_PAIRS = [
  ['add', 'remove'],
  ['create', 'delete'],
  ['enable', 'disable'],
  ['show', 'hide'],
  ['increase', 'decrease'],
  ['fast', 'slow'],
  ['simple', 'complex'],
];

/**
 * Critical information indicators for coding tasks
 */
const CRITICAL_INFO_INDICATORS = {
  BUG_FIX: ['error message', 'stack trace', 'expected behavior', 'actual behavior'],
  FEATURE_ADD: ['requirement', 'specification', 'use case', 'acceptance criteria'],
  REFACTOR: ['current structure', 'desired structure', 'reason'],
  OPTIMIZATION: ['bottleneck', 'metric', 'target performance'],
};

/**
 * Ambiguity Detector
 */
export class AmbiguityDetector {
  private config: DetectorConfig;

  constructor(config: Partial<DetectorConfig> = {}) {
    this.config = {
      severityThreshold: 'low',
      enableNLP: true,
      maxAmbiguities: 10,
      ...config,
    };
  }

  /**
   * Detect all types of ambiguities in a prompt
   */
  detect(prompt: string, taskType?: string): AmbiguityResult {
    const ambiguities: DetectedAmbiguity[] = [];

    // Detect different types of ambiguities
    ambiguities.push(...this.detectUnderspecification(prompt, taskType));
    ambiguities.push(...this.detectVagueness(prompt));
    ambiguities.push(...this.detectMultipleInterpretations(prompt));
    ambiguities.push(...this.detectIncompleteContext(prompt));
    ambiguities.push(...this.detectConflictingRequirements(prompt));

    // Filter by severity threshold if configured
    const filteredAmbiguities = this.filterBySeverity(ambiguities);

    // Calculate overall clarity score (inverse of ambiguity)
    const overallScore = this.calculateClarityScore(filteredAmbiguities, prompt);

    // Limit to max ambiguities
    const limitedAmbiguities = filteredAmbiguities.slice(0, this.config.maxAmbiguities);

    return {
      isAmbiguous: limitedAmbiguities.length > 0,
      overallScore,
      ambiguities: limitedAmbiguities,
    };
  }

  /**
   * Detect underspecification (missing critical information)
   */
  private detectUnderspecification(prompt: string, taskType?: string): DetectedAmbiguity[] {
    const ambiguities: DetectedAmbiguity[] = [];
    const lowerPrompt = prompt.toLowerCase();

    // Check for very short prompts
    if (prompt.trim().split(/\s+/).length < 5) {
      ambiguities.push({
        type: AmbiguityType.UNDERSPECIFIED,
        description: 'Prompt is too short and lacks sufficient detail',
        severity: 'high',
        suggestions: [
          'Provide more context about what you want to achieve',
          'Include specific details about the task',
          'Mention relevant files, functions, or components',
        ],
      });
    }

    // Check for missing critical info based on task type
    if (taskType && CRITICAL_INFO_INDICATORS[taskType as keyof typeof CRITICAL_INFO_INDICATORS]) {
      const requiredInfo = CRITICAL_INFO_INDICATORS[taskType as keyof typeof CRITICAL_INFO_INDICATORS];
      const missingInfo = requiredInfo.filter(info => !lowerPrompt.includes(info.toLowerCase()));

      if (missingInfo.length > 0) {
        ambiguities.push({
          type: AmbiguityType.UNDERSPECIFIED,
          description: `Missing critical information for ${taskType} task`,
          severity: 'medium',
          suggestions: missingInfo.map(info => `Consider providing: ${info}`),
        });
      }
    }

    // Check for pronouns without clear references at the start
    const startsWithPronoun = AMBIGUOUS_PRONOUNS.some(pronoun =>
      new RegExp(`^${pronoun}\\b`, 'i').test(prompt.trim())
    );

    if (startsWithPronoun) {
      ambiguities.push({
        type: AmbiguityType.UNDERSPECIFIED,
        description: 'Prompt starts with a pronoun without clear reference',
        severity: 'medium',
        suggestions: [
          'Specify what "it", "this", or "that" refers to',
          'Provide the full name of the component or file you\'re referring to',
        ],
        affectedText: prompt.split(' ')[0],
      });
    }

    return ambiguities;
  }

  /**
   * Detect vagueness (too general or unclear)
   */
  private detectVagueness(prompt: string): DetectedAmbiguity[] {
    const ambiguities: DetectedAmbiguity[] = [];
    const lowerPrompt = prompt.toLowerCase();

    // Count vague terms
    const vaguenessCount = VAGUE_TERMS.filter(term =>
      new RegExp(`\\b${term}\\b`, 'i').test(lowerPrompt)
    ).length;

    if (vaguenessCount >= 3) {
      ambiguities.push({
        type: AmbiguityType.VAGUE,
        description: 'Prompt contains multiple vague or non-specific terms',
        severity: 'medium',
        suggestions: [
          'Replace vague terms with specific details',
          'Be more concrete about what you want to achieve',
          'Provide examples or specific values',
        ],
      });
    }

    // Check for overly general questions
    const isOnlyQuestion = QUESTION_INDICATORS.some(q => lowerPrompt.trim().startsWith(q)) &&
      prompt.trim().split(/\s+/).length < 10;

    if (isOnlyQuestion) {
      ambiguities.push({
        type: AmbiguityType.VAGUE,
        description: 'Question is too general without specific context',
        severity: 'low',
        suggestions: [
          'Add context about your specific situation',
          'Include code examples or file names',
          'Mention what you\'ve already tried',
        ],
      });
    }

    return ambiguities;
  }

  /**
   * Detect multiple possible interpretations
   */
  private detectMultipleInterpretations(prompt: string): DetectedAmbiguity[] {
    const ambiguities: DetectedAmbiguity[] = [];

    // Check for multiple questions
    const questionCount = (prompt.match(/\?/g) || []).length;
    if (questionCount > 2) {
      ambiguities.push({
        type: AmbiguityType.MULTIPLE_INTERPRETATIONS,
        description: 'Multiple questions in one prompt may have different priorities',
        severity: 'medium',
        suggestions: [
          'Focus on one main question or task',
          'Number your questions by priority',
          'Split into separate prompts if questions are unrelated',
        ],
      });
    }

    // Check for OR statements without clear priority
    const hasOrStatements = /\bor\b/gi.test(prompt);
    const orCount = (prompt.match(/\bor\b/gi) || []).length;

    if (hasOrStatements && orCount >= 2) {
      ambiguities.push({
        type: AmbiguityType.MULTIPLE_INTERPRETATIONS,
        description: 'Multiple "or" statements create ambiguity about which option to choose',
        severity: 'low',
        suggestions: [
          'Specify which option is preferred',
          'Clarify decision criteria',
          'Break down into separate requests',
        ],
      });
    }

    return ambiguities;
  }

  /**
   * Detect incomplete context
   */
  private detectIncompleteContext(prompt: string): DetectedAmbiguity[] {
    const ambiguities: DetectedAmbiguity[] = [];

    // Check for references without context
    const hasReferences = /\b(the|this|that)\s+(function|class|file|component|method)/i.test(prompt);
    const hasSpecificName = /\b(function|class|file|component|method)\s+\w+/i.test(prompt);

    if (hasReferences && !hasSpecificName) {
      ambiguities.push({
        type: AmbiguityType.INCOMPLETE_CONTEXT,
        description: 'References to code elements without specific names',
        severity: 'high',
        suggestions: [
          'Include the specific name of the function, class, or file',
          'Provide the file path or import statement',
          'Add a code snippet showing the relevant code',
        ],
      });
    }

    // Check for mentions of errors without details
    const mentionsError = /\b(error|bug|issue|problem|broken|fail)/i.test(prompt);
    const hasErrorDetails = /error[:]\s*\w+|exception[:]\s*\w+|stack trace/i.test(prompt);

    if (mentionsError && !hasErrorDetails) {
      ambiguities.push({
        type: AmbiguityType.INCOMPLETE_CONTEXT,
        description: 'Error or issue mentioned without specific error messages or details',
        severity: 'high',
        suggestions: [
          'Include the exact error message',
          'Provide the stack trace',
          'Describe what you expected vs. what actually happened',
        ],
      });
    }

    return ambiguities;
  }

  /**
   * Detect conflicting requirements
   */
  private detectConflictingRequirements(prompt: string): DetectedAmbiguity[] {
    const ambiguities: DetectedAmbiguity[] = [];
    const lowerPrompt = prompt.toLowerCase();

    // Check for conflicting action pairs
    for (const [action1, action2] of CONFLICTING_PAIRS) {
      const hasAction1 = new RegExp(`\\b${action1}\\b`, 'i').test(lowerPrompt);
      const hasAction2 = new RegExp(`\\b${action2}\\b`, 'i').test(lowerPrompt);

      if (hasAction1 && hasAction2) {
        ambiguities.push({
          type: AmbiguityType.CONFLICTING_REQUIREMENTS,
          description: `Conflicting actions detected: "${action1}" and "${action2}"`,
          severity: 'high',
          suggestions: [
            `Clarify whether you want to ${action1} or ${action2}`,
            'Specify the order if both actions are needed',
            'Explain the relationship between these conflicting actions',
          ],
          affectedText: `${action1}, ${action2}`,
        });
      }
    }

    return ambiguities;
  }

  /**
   * Calculate overall clarity score (0-1, higher is clearer)
   */
  private calculateClarityScore(ambiguities: DetectedAmbiguity[], prompt: string): number {
    if (ambiguities.length === 0) {
      return 1.0;
    }

    // Base score
    let score = 1.0;

    // Penalize for each ambiguity based on severity
    for (const ambiguity of ambiguities) {
      switch (ambiguity.severity) {
        case 'high':
          score -= 0.3;
          break;
        case 'medium':
          score -= 0.15;
          break;
        case 'low':
          score -= 0.05;
          break;
      }
    }

    // Bonus for length (longer prompts tend to be clearer)
    const wordCount = prompt.trim().split(/\s+/).length;
    if (wordCount > 20) {
      score += 0.1;
    }

    // Clamp between 0 and 1
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Filter ambiguities by severity threshold
   */
  private filterBySeverity(ambiguities: DetectedAmbiguity[]): DetectedAmbiguity[] {
    const severityLevels: Record<'low' | 'medium' | 'high', number> = { low: 1, medium: 2, high: 3 };
    const threshold = severityLevels[this.config.severityThreshold || 'low'];

    return ambiguities.filter(amb => severityLevels[amb.severity] >= threshold);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<DetectorConfig>): void {
    this.config = { ...this.config, ...config };
    logger.debug('Ambiguity detector config updated', this.config);
  }
}
