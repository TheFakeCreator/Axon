/**
 * Intent Classifier
 * 
 * Classifies user prompts into intent categories (Coding, PKM, General, etc.)
 * using keyword-based pattern matching.
 */

import nlp from 'compromise';
import { logger } from '@axon/shared';
import {
  IntentCategory,
  IntentResult,
  ConfidenceScore,
  KeywordPattern,
  IntentPatterns,
} from '../types';

/**
 * Intent classification patterns
 */
const INTENT_PATTERNS: IntentPatterns = {
  [IntentCategory.CODING]: [
    {
      keywords: ['code', 'function', 'class', 'method', 'variable', 'bug', 'error', 'debug'],
      weight: 0.8,
    },
    {
      keywords: ['implement', 'refactor', 'optimize', 'test', 'deploy'],
      weight: 0.7,
    },
    {
      keywords: ['typescript', 'javascript', 'python', 'java', 'react', 'node'],
      weight: 0.9,
    },
    {
      keywords: ['api', 'endpoint', 'database', 'query', 'schema'],
      weight: 0.6,
    },
    {
      keywords: ['component', 'module', 'package', 'library', 'framework'],
      weight: 0.7,
    },
  ],
  [IntentCategory.PKM]: [
    {
      keywords: ['note', 'notes', 'document', 'organize', 'link', 'reference'],
      weight: 0.8,
    },
    {
      keywords: ['knowledge', 'research', 'idea', 'concept', 'topic'],
      weight: 0.7,
    },
  ],
  [IntentCategory.GENERAL]: [
    {
      keywords: ['what', 'how', 'why', 'when', 'where', 'explain', 'tell'],
      weight: 0.5,
    },
    {
      keywords: ['help', 'question', 'ask', 'wondering'],
      weight: 0.4,
    },
  ],
};

/**
 * Intent Classifier
 */
export class IntentClassifier {
  private patterns: IntentPatterns;

  constructor(customPatterns?: Partial<IntentPatterns>) {
    this.patterns = {
      ...INTENT_PATTERNS,
      ...customPatterns,
    };

    logger.info('Intent Classifier initialized');
  }

  /**
   * Classify intent of a prompt
   */
  classify(prompt: string): IntentResult {
    const normalizedPrompt = prompt.toLowerCase();
    const scores: Record<IntentCategory, number> = {
      [IntentCategory.CODING]: 0,
      [IntentCategory.PKM]: 0,
      [IntentCategory.GENERAL]: 0,
    };

    const allIndicators: Record<IntentCategory, string[]> = {
      [IntentCategory.CODING]: [],
      [IntentCategory.PKM]: [],
      [IntentCategory.GENERAL]: [],
    };

    // Calculate scores for each intent category
    for (const [category, patterns] of Object.entries(this.patterns)) {
      const categoryKey = category as IntentCategory;
      
      for (const pattern of patterns) {
        const { keywords, weight, mustMatchAll } = pattern;
        const matches = keywords.filter((keyword: string) =>
          normalizedPrompt.includes(keyword.toLowerCase())
        );

        if (mustMatchAll && matches.length === keywords.length) {
          scores[categoryKey] += weight;
          allIndicators[categoryKey].push(...matches);
        } else if (!mustMatchAll && matches.length > 0) {
          const matchRatio = matches.length / keywords.length;
          scores[categoryKey] += weight * matchRatio;
          allIndicators[categoryKey].push(...matches);
        }
      }
    }

    // Additional heuristics
    this.applyHeuristics(prompt, scores, allIndicators);

    // Find category with highest score
    const maxScore = Math.max(...Object.values(scores));
    const category = (Object.keys(scores) as IntentCategory[]).find(
      (key) => scores[key] === maxScore
    )!;

    // Normalize confidence to 0-1 range
    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
    const confidence: ConfidenceScore = totalScore > 0 ? maxScore / totalScore : 0;

    logger.debug('Intent classification result', {
      category,
      confidence,
      scores,
      indicatorCount: allIndicators[category].length,
    });

    return {
      category,
      confidence: Math.min(confidence, 1),
      indicators: [...new Set(allIndicators[category])], // Remove duplicates
    };
  }

  /**
   * Apply additional heuristics for better classification
   */
  private applyHeuristics(
    prompt: string,
    scores: Record<IntentCategory, number>,
    indicators: Record<IntentCategory, string[]>
  ): void {
    const doc = nlp(prompt);

    // Check for code-like syntax
    if (this.hasCodeSyntax(prompt)) {
      scores[IntentCategory.CODING] += 0.5;
      indicators[IntentCategory.CODING].push('code syntax detected');
    }

    // Check for file paths
    if (this.hasFilePaths(prompt)) {
      scores[IntentCategory.CODING] += 0.3;
      indicators[IntentCategory.CODING].push('file path detected');
    }

    // Check for technical verbs
    const verbs = doc.verbs().out('array');
    const technicalVerbs = ['implement', 'debug', 'fix', 'optimize', 'refactor', 'test', 'deploy'];
    const hasTechnicalVerbs = verbs.some((verb: string) =>
      technicalVerbs.includes(verb.toLowerCase())
    );
    
    if (hasTechnicalVerbs) {
      scores[IntentCategory.CODING] += 0.4;
      indicators[IntentCategory.CODING].push('technical verbs detected');
    }

    // Check for question patterns
    if (prompt.includes('?') || /^(what|how|why|when|where|who)\b/i.test(prompt)) {
      scores[IntentCategory.GENERAL] += 0.2;
      indicators[IntentCategory.GENERAL].push('question pattern');
    }
  }

  /**
   * Check if prompt contains code syntax
   */
  private hasCodeSyntax(prompt: string): boolean {
    const codePatterns = [
      /```[\s\S]*```/, // Code blocks
      /`[^`]+`/, // Inline code
      /[a-zA-Z_][a-zA-Z0-9_]*\s*\(/, // Function calls
      /[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*/, // Assignments
      /[{}\[\];]/, // Common syntax characters
      /\bconst\b|\blet\b|\bvar\b|\bfunction\b|\bclass\b/, // Keywords
    ];

    return codePatterns.some((pattern) => pattern.test(prompt));
  }

  /**
   * Check if prompt contains file paths
   */
  private hasFilePaths(prompt: string): boolean {
    const filePathPatterns = [
      /[a-zA-Z]:\\[\w\\]+/, // Windows path
      /\/[\w\/]+\.[\w]+/, // Unix path with extension
      /[\w]+\/[\w\/]+/, // Relative path
      /\.\/[\w\/]+/, // Current directory path
      /\.\.\/[\w\/]+/, // Parent directory path
    ];

    return filePathPatterns.some((pattern) => pattern.test(prompt));
  }

  /**
   * Add custom patterns for a category
   */
  addPatterns(category: IntentCategory, patterns: KeywordPattern[]): void {
    if (!this.patterns[category]) {
      this.patterns[category] = [];
    }
    this.patterns[category].push(...patterns);
    logger.debug(`Added ${patterns.length} patterns to ${category}`);
  }

  /**
   * Get current patterns
   */
  getPatterns(): IntentPatterns {
    return { ...this.patterns };
  }
}
