/**
 * Main PromptAnalyzer Orchestrator
 * 
 * Chains all analysis stages:
 * 1. Intent Classification → IntentResult
 * 2. Task Type Identification → TaskTypeResult
 * 3. Entity Extraction → ExtractedEntity[]
 * 4. Ambiguity Detection → AmbiguityResult
 * 5. Metadata Extraction
 * 
 * Implements caching for repeated prompts and comprehensive logging.
 * Target: <200ms latency for typical prompts.
 */

import { createHash } from 'crypto';
import { IntentClassifier } from './classifiers/intent-classifier';
import { TaskTypeIdentifier } from './classifiers/task-type-identifier';
import { EntityExtractor } from './extractors/entity-extractor';
import { AmbiguityDetector } from './detectors/ambiguity-detector';
import { EntityType } from './types';
import type {
  PromptAnalysis,
  AnalyzerConfig,
  IntentCategory,
  TaskCategory,
  KeywordPattern,
} from './types';

/**
 * Cache entry for analyzed prompts
 */
interface CacheEntry {
  analysis: PromptAnalysis;
  timestamp: Date;
}

/**
 * Default analyzer configuration
 */
const DEFAULT_CONFIG: AnalyzerConfig = {
  intent: {
    minConfidence: 0.5,
    enableMultiIntent: false,
  },
  taskType: {
    minConfidence: 0.5,
    enableMultiTask: true,
  },
  entities: {
    minConfidence: 0.6,
    maxEntitiesPerType: 10,
    enabledTypes: [
      EntityType.FILE_PATH,
      EntityType.FUNCTION_NAME,
      EntityType.CLASS_NAME,
      EntityType.VARIABLE_NAME,
      EntityType.TECHNOLOGY,
      EntityType.LIBRARY,
      EntityType.FRAMEWORK,
      EntityType.CONCEPT,
      EntityType.ERROR_MESSAGE,
      EntityType.CODE_SNIPPET,
    ],
  },
  ambiguity: {
    enabled: true,
    minSeverity: 'low',
  },
  metadata: {
    detectLanguage: true,
    calculateComplexity: true,
  },
  caching: {
    enabled: true,
    ttlMinutes: 30,
    maxEntries: 1000,
  },
  logging: {
    enabled: true,
    logLevel: 'info',
    includeMetrics: true,
  },
};

/**
 * Main PromptAnalyzer class
 * 
 * Orchestrates all analysis stages and provides caching/logging.
 */
export class PromptAnalyzer {
  private intentClassifier: IntentClassifier;
  private taskTypeIdentifier: TaskTypeIdentifier;
  private entityExtractor: EntityExtractor;
  private ambiguityDetector: AmbiguityDetector;
  private cache: Map<string, CacheEntry>;
  private config: AnalyzerConfig;

  constructor(config: Partial<AnalyzerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize all components
    // Intent classifier doesn't take config, uses default patterns
    this.intentClassifier = new IntentClassifier();

    // Task type identifier takes IdentifierConfig
    this.taskTypeIdentifier = new TaskTypeIdentifier({
      confidenceThreshold: this.config.taskType.minConfidence,
      maxTaskTypes: 5,
    });

    // Entity extractor takes ExtractorConfig
    this.entityExtractor = new EntityExtractor({
      confidenceThreshold: this.config.entities.minConfidence,
      maxEntities: this.config.entities.maxEntitiesPerType,
      enableNLP: true,
    });

    // Ambiguity detector takes DetectorConfig
    this.ambiguityDetector = new AmbiguityDetector({
      severityThreshold: this.config.ambiguity.minSeverity,
      enableNLP: true,
      maxAmbiguities: 10,
    });

    this.cache = new Map();

    this.log('info', 'PromptAnalyzer initialized', { config: this.config });
  }

  /**
   * Analyze a user prompt
   * 
   * Runs all analysis stages and returns comprehensive analysis result.
   * Uses cache for repeated prompts if caching is enabled.
   * 
   * @param prompt - User prompt to analyze
   * @param context - Optional context (workspace type, previous interactions, etc.)
   * @returns Complete analysis of the prompt
   */
  async analyze(
    prompt: string,
    context?: {
      workspaceType?: 'coding' | 'pkm' | 'root';
      previousPrompts?: string[];
      sessionId?: string;
    }
  ): Promise<PromptAnalysis> {
    const startTime = Date.now();

    // Input validation
    if (!prompt || prompt.trim().length === 0) {
      throw new Error('Prompt cannot be empty');
    }

    const trimmedPrompt = prompt.trim();

    // Check cache if enabled
    if (this.config.caching?.enabled) {
      const cached = this.checkCache(trimmedPrompt);
      if (cached) {
        this.log('info', 'Cache hit', { prompt: trimmedPrompt.substring(0, 50) });
        return cached;
      }
    }

    this.log('info', 'Analyzing prompt', {
      length: trimmedPrompt.length,
      workspaceType: context?.workspaceType,
    });

    // Stage 1: Intent Classification
    const intentResult = this.intentClassifier.classify(trimmedPrompt);
    this.log('debug', 'Intent classified', { intent: intentResult });

    // Stage 2: Task Type Identification
    const taskTypeResult = this.taskTypeIdentifier.identify(trimmedPrompt);
    this.log('debug', 'Task type identified', { taskType: taskTypeResult });

    // Stage 3: Entity Extraction
    const entities = this.entityExtractor.extract(trimmedPrompt);
    this.log('debug', 'Entities extracted', { count: entities.length });

    // Stage 4: Ambiguity Detection (if enabled)
    const ambiguity = this.config.ambiguity.enabled
      ? this.ambiguityDetector.detect(trimmedPrompt)
      : { isAmbiguous: false, overallScore: 1.0, ambiguities: [] };
    this.log('debug', 'Ambiguity detected', { ambiguity });

    // Stage 5: Metadata Extraction
    const metadata = this.extractMetadata(trimmedPrompt);
    this.log('debug', 'Metadata extracted', { metadata });

    // Construct complete analysis result
    const processingTimeMs = Date.now() - startTime;
    const analysis: PromptAnalysis = {
      prompt: trimmedPrompt,
      intent: intentResult,
      taskType: taskTypeResult,
      entities,
      ambiguity,
      metadata,
      metrics: {
        processingTimeMs,
        timestamp: new Date(),
      },
    };

    // Cache result if enabled
    if (this.config.caching?.enabled) {
      this.addToCache(trimmedPrompt, analysis);
    }

    this.log('info', 'Analysis complete', {
      processingTimeMs,
      intent: intentResult.category,
      taskType: taskTypeResult.primary?.category,
      entityCount: entities.length,
      isAmbiguous: ambiguity.isAmbiguous,
    });

    // Performance warning if over target
    if (processingTimeMs > 200) {
      this.log('warn', 'Analysis exceeded 200ms target', { processingTimeMs });
    }

    return analysis;
  }

  /**
   * Extract metadata from prompt
   */
  private extractMetadata(prompt: string): PromptAnalysis['metadata'] {
    const wordCount = prompt.trim().split(/\s+/).length;
    const hasCodeSnippets = /```|`[^`]+`|function\s+\w+|class\s+\w+|const\s+\w+|let\s+\w+|var\s+\w+/.test(prompt);
    const hasQuestions = /\?|what|how|why|when|where|who|which|can you|could you|would you/i.test(prompt);

    // Simple language detection (can be enhanced with proper library)
    const language = this.detectLanguage(prompt);

    // Complexity calculation
    let complexity: 'simple' | 'moderate' | 'complex';
    if (wordCount < 10 && !hasCodeSnippets) {
      complexity = 'simple';
    } else if (wordCount < 50 && (!hasCodeSnippets || prompt.split('```').length <= 3)) {
      complexity = 'moderate';
    } else {
      complexity = 'complex';
    }

    return {
      language,
      wordCount,
      hasCodeSnippets,
      hasQuestions,
      complexity,
    };
  }

  /**
   * Simple language detection
   * 
   * TODO: Enhance with proper language detection library (franc, langdetect)
   */
  private detectLanguage(prompt: string): string {
    // For now, assume English
    // Can be enhanced with language detection library
    return 'en';
  }

  /**
   * Generate cache key for a prompt
   */
  private getCacheKey(prompt: string): string {
    return createHash('md5').update(prompt).digest('hex');
  }

  /**
   * Check cache for existing analysis
   */
  private checkCache(prompt: string): PromptAnalysis | null {
    const key = this.getCacheKey(prompt);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry is expired
    const ttlMs = (this.config.caching?.ttlMinutes || 30) * 60 * 1000;
    const age = Date.now() - entry.timestamp.getTime();

    if (age > ttlMs) {
      this.cache.delete(key);
      return null;
    }

    return entry.analysis;
  }

  /**
   * Add analysis to cache
   */
  private addToCache(prompt: string, analysis: PromptAnalysis): void {
    const key = this.getCacheKey(prompt);

    // Implement LRU eviction if cache is full
    const maxEntries = this.config.caching?.maxEntries || 1000;
    if (this.cache.size >= maxEntries) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      analysis,
      timestamp: new Date(),
    });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.log('info', 'Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate?: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.config.caching?.maxEntries || 1000,
    };
  }

  /**
   * Add custom task type patterns
   * 
   * @param category - Task category to add patterns for
   * @param patterns - Keyword patterns to add
   */
  addTaskTypePatterns(category: TaskCategory, patterns: KeywordPattern[]): void {
    this.taskTypeIdentifier.addPatterns(category, patterns);
    this.log('info', 'Custom task patterns added', { category, count: patterns.length });
  }

  /**
   * Helper method to add simple keyword patterns
   * 
   * @param category - Task category
   * @param keywords - Simple keywords to add (will be converted to patterns)
   * @param weight - Weight for the patterns (default 0.7)
   */
  addTaskTypeKeywords(category: TaskCategory, keywords: string[], weight: number = 0.7): void {
    const patterns: KeywordPattern[] = [{ keywords, weight }];
    this.addTaskTypePatterns(category, patterns);
  }

  /**
   * Get current configuration
   */
  getConfig(): AnalyzerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AnalyzerConfig>): void {
    this.config = { ...this.config, ...config };
    this.log('info', 'Configuration updated', { config });
  }

  /**
   * Logging utility
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
    if (!this.config.logging?.enabled) {
      return;
    }

    const logLevel = this.config.logging.logLevel || 'info';
    const levels: Record<string, number> = { debug: 0, info: 1, warn: 2, error: 3 };

    if (levels[level] < levels[logLevel]) {
      return;
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(this.config.logging.includeMetrics && data ? { data } : {}),
    };

    // TODO: Integrate with proper logging library (winston, pino)
    console.log(JSON.stringify(logEntry));
  }

  /**
   * Batch analyze multiple prompts
   */
  async analyzeBatch(prompts: string[]): Promise<PromptAnalysis[]> {
    this.log('info', 'Batch analysis started', { count: prompts.length });

    const results = await Promise.all(
      prompts.map(prompt => this.analyze(prompt))
    );

    this.log('info', 'Batch analysis complete', { count: results.length });

    return results;
  }
}
