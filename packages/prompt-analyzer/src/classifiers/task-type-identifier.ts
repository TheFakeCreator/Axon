/**
 * Task Type Identifier
 * 
 * Identifies the specific task type(s) from a prompt using keyword pattern matching.
 * Supports multi-label classification for prompts that involve multiple tasks.
 */

import { TaskCategory } from '@axon/shared';
import { TaskTypeResult, KeywordPattern, IdentifierConfig } from '../types';
import { logger } from '@axon/shared';

/**
 * Task-specific patterns for detection
 */
interface TaskTypePatterns {
  [TaskCategory.GENERAL_QUERY]: KeywordPattern[];
  [TaskCategory.BUG_FIX]: KeywordPattern[];
  [TaskCategory.FEATURE_ADD]: KeywordPattern[];
  [TaskCategory.FEATURE_REMOVE]: KeywordPattern[];
  [TaskCategory.REFACTOR]: KeywordPattern[];
  [TaskCategory.CODE_REVIEW]: KeywordPattern[];
  [TaskCategory.DOCUMENTATION]: KeywordPattern[];
  [TaskCategory.TESTING]: KeywordPattern[];
  [TaskCategory.DEPLOYMENT]: KeywordPattern[];
  [TaskCategory.OPTIMIZATION]: KeywordPattern[];
  [TaskCategory.SECURITY]: KeywordPattern[];
  [TaskCategory.ROADMAP]: KeywordPattern[];
  // Index signature for dynamic access
  [key: string]: KeywordPattern[];
}

/**
 * Default task type patterns
 */
const TASK_TYPE_PATTERNS: TaskTypePatterns = {
  [TaskCategory.GENERAL_QUERY]: [
    { keywords: ['how', 'what', 'why', 'when', 'where', 'explain', 'understand'], weight: 0.7 },
    { keywords: ['help', 'guide', 'tutorial', 'example', 'show me', 'demonstrate'], weight: 0.6 },
    { keywords: ['difference', 'compare', 'vs', 'versus', 'better'], weight: 0.5 },
  ],

  [TaskCategory.BUG_FIX]: [
    { keywords: ['bug', 'error', 'issue', 'problem', 'broken', 'not working', 'failing'], weight: 0.9 },
    { keywords: ['fix', 'resolve', 'solve', 'debug', 'troubleshoot'], weight: 0.8 },
    { keywords: ['crash', 'exception', 'stack trace', 'traceback', 'throws'], weight: 0.85 },
    { keywords: ['unexpected', 'incorrect', 'wrong', 'invalid', 'fails'], weight: 0.7 },
  ],

  [TaskCategory.FEATURE_ADD]: [
    { keywords: ['add', 'create', 'implement', 'build', 'develop', 'feature'], weight: 0.9 },
    { keywords: ['new', 'functionality', 'capability', 'enhancement'], weight: 0.7 },
    { keywords: ['integrate', 'support', 'enable', 'allow'], weight: 0.6 },
  ],

  [TaskCategory.FEATURE_REMOVE]: [
    { keywords: ['remove', 'delete', 'deprecate', 'disable', 'drop'], weight: 0.9 },
    { keywords: ['unused', 'legacy', 'obsolete', 'old', 'outdated'], weight: 0.7 },
    { keywords: ['cleanup', 'clean up', 'prune'], weight: 0.6 },
  ],

  [TaskCategory.REFACTOR]: [
    { keywords: ['refactor', 'restructure', 'reorganize', 'redesign', 'improve'], weight: 0.9 },
    { keywords: ['clean', 'simplify', 'modularize', 'rewrite'], weight: 0.8 },
    { keywords: ['extract', 'split', 'merge', 'consolidate'], weight: 0.7 },
    { keywords: ['architecture', 'pattern', 'design', 'structure'], weight: 0.6 },
  ],

  [TaskCategory.CODE_REVIEW]: [
    { keywords: ['review', 'check', 'verify', 'validate', 'inspect'], weight: 0.8 },
    { keywords: ['best practice', 'convention', 'standard', 'guideline'], weight: 0.7 },
    { keywords: ['code quality', 'maintainability', 'readability'], weight: 0.6 },
  ],

  [TaskCategory.DOCUMENTATION]: [
    { keywords: ['document', 'documentation', 'readme', 'comment', 'doc'], weight: 0.9 },
    { keywords: ['jsdoc', 'tsdoc', 'docstring', 'api docs'], weight: 0.8 },
    { keywords: ['explain code', 'describe', 'annotate'], weight: 0.6 },
  ],

  [TaskCategory.TESTING]: [
    { keywords: ['test', 'testing', 'unit test', 'integration test', 'e2e'], weight: 0.9 },
    { keywords: ['jest', 'vitest', 'mocha', 'chai', 'playwright', 'cypress'], weight: 0.8 },
    { keywords: ['mock', 'stub', 'spy', 'coverage'], weight: 0.7 },
    { keywords: ['assert', 'expect', 'should', 'describe'], weight: 0.6 },
  ],

  [TaskCategory.DEPLOYMENT]: [
    { keywords: ['deploy', 'deployment', 'release', 'publish', 'ship'], weight: 0.9 },
    { keywords: ['docker', 'kubernetes', 'k8s', 'container', 'ci/cd'], weight: 0.8 },
    { keywords: ['production', 'staging', 'environment'], weight: 0.6 },
  ],

  [TaskCategory.OPTIMIZATION]: [
    { keywords: ['optimize', 'optimization', 'performance', 'faster', 'speed'], weight: 0.9 },
    { keywords: ['slow', 'lag', 'bottleneck', 'inefficient'], weight: 0.8 },
    { keywords: ['cache', 'memory', 'cpu', 'latency', 'throughput'], weight: 0.7 },
    { keywords: ['improve performance', 'reduce', 'minimize'], weight: 0.6 },
  ],

  [TaskCategory.SECURITY]: [
    { keywords: ['security', 'vulnerability', 'exploit', 'attack', 'threat'], weight: 0.9 },
    { keywords: ['authentication', 'authorization', 'auth', 'permission'], weight: 0.8 },
    { keywords: ['encrypt', 'decrypt', 'hash', 'sanitize', 'validate'], weight: 0.7 },
    { keywords: ['xss', 'csrf', 'injection', 'sql injection'], weight: 0.85 },
  ],

  [TaskCategory.ROADMAP]: [
    { keywords: ['roadmap', 'plan', 'milestone', 'timeline', 'strategy'], weight: 0.9 },
    { keywords: ['future', 'upcoming', 'next', 'vision', 'goal'], weight: 0.7 },
    { keywords: ['priority', 'prioritize', 'backlog'], weight: 0.6 },
  ],
};

/**
 * Task Type Identifier
 */
export class TaskTypeIdentifier {
  private patterns: TaskTypePatterns;
  private config: IdentifierConfig;

  constructor(config: Partial<IdentifierConfig> = {}) {
    this.patterns = { ...TASK_TYPE_PATTERNS };
    this.config = {
      confidenceThreshold: 0.3,
      maxTaskTypes: 3,
      ...config,
    };
  }

  /**
   * Identify task type(s) from a prompt
   */
  identify(prompt: string): TaskTypeResult {
    const normalizedPrompt = prompt.toLowerCase();
    
    // Calculate score for each task type
    const scores = new Map<TaskCategory, number>();
    const indicators = new Map<TaskCategory, string[]>();

    for (const [taskType, patterns] of Object.entries(this.patterns)) {
      const { score, matches } = this.calculateTaskScore(normalizedPrompt, patterns);
      if (score > 0) {
        scores.set(taskType as TaskCategory, score);
        indicators.set(taskType as TaskCategory, matches);
      }
    }

    // Normalize scores (0-1 range)
    const maxScore = Math.max(...Array.from(scores.values()), 1);
    const normalizedScores = new Map<TaskCategory, number>();
    scores.forEach((score, taskType) => {
      normalizedScores.set(taskType, score / maxScore);
    });

    // Filter by confidence threshold and get top N
    const validTasks = Array.from(normalizedScores.entries())
      .filter(([_, confidence]) => confidence >= (this.config.confidenceThreshold ?? 0.3))
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.config.maxTaskTypes ?? 3);

    // Determine primary and additional task types
    if (validTasks.length === 0) {
      return {
        primary: {
          category: TaskCategory.GENERAL_QUERY,
          confidence: 0.5,
        },
        isMultiTask: false,
        indicators: [],
      };
    }

    const [primaryTask, primaryConfidence] = validTasks[0];
    const secondaryTasks = validTasks.slice(1).map(([type, conf]) => ({
      category: type,
      confidence: conf,
    }));

    return {
      primary: {
        category: primaryTask,
        confidence: primaryConfidence,
      },
      secondaryTasks: secondaryTasks.length > 0 ? secondaryTasks : undefined,
      isMultiTask: validTasks.length > 1,
      indicators: indicators.get(primaryTask) || [],
    };
  }

  /**
   * Calculate score for a specific task type
   */
  private calculateTaskScore(
    prompt: string,
    patterns: KeywordPattern[]
  ): { score: number; matches: string[] } {
    let score = 0;
    const matches: string[] = [];

    for (const pattern of patterns) {
      for (const keyword of pattern.keywords) {
        if (prompt.includes(keyword.toLowerCase())) {
          score += pattern.weight;
          matches.push(keyword);
        }
      }
    }

    return { score, matches };
  }

  /**
   * Add custom patterns for a task type
   */
  addPatterns(taskType: TaskCategory, patterns: KeywordPattern[]): void {
    const typedPatterns = this.patterns as Record<string, KeywordPattern[]>;
    if (!typedPatterns[taskType]) {
      typedPatterns[taskType] = [];
    }
    typedPatterns[taskType].push(...patterns);
    logger.debug('Added custom patterns for task type', { taskType, count: patterns.length });
  }

  /**
   * Get current patterns for a task type
   */
  getPatterns(taskType: TaskCategory): KeywordPattern[] {
    const typedPatterns = this.patterns as Record<string, KeywordPattern[]>;
    return typedPatterns[taskType] || [];
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<IdentifierConfig>): void {
    this.config = { ...this.config, ...config };
    logger.debug('Task type identifier config updated', this.config);
  }
}
