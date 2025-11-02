/**
 * Prompt Analyzer Type Definitions
 * 
 * Defines interfaces and types for prompt analysis including
 * intent classification, task type identification, entity extraction,
 * and ambiguity detection.
 */

import { TaskCategory, IntentType, IEntity } from '@axon/shared';

/**
 * Workspace-specific intent categories
 */
export enum IntentCategory {
  CODING = 'coding',
  PKM = 'pkm',
  GENERAL = 'general',
}

/**
 * Extended task types (aliases to TaskCategory for backwards compatibility)
 */
export const TaskType = TaskCategory;
export type TaskType = TaskCategory;

/**
 * Confidence score (0-1)
 */
export type ConfidenceScore = number;

/**
 * Intent classification result
 */
export interface IntentResult {
  category: IntentCategory;
  confidence: ConfidenceScore;
  indicators: string[]; // Keywords/patterns that led to this classification
}

/**
 * Task type identification result
 */
export interface TaskTypeResult {
  taskType: TaskType; // Primary task type (renamed from primaryType)
  confidence: ConfidenceScore;
  indicators: string[]; // Keywords/patterns that led to this classification
  isMultiTask: boolean; // True if multiple task types detected
  secondaryTasks?: TaskType[]; // Additional task types if multi-task (renamed from additionalTypes)
}

/**
 * Intent classifier configuration
 */
export interface ClassifierConfig {
  confidenceThreshold?: number; // Minimum confidence to accept a classification
}

/**
 * Task type identifier configuration
 */
export interface IdentifierConfig {
  confidenceThreshold?: number; // Minimum confidence to include a task type
  maxTaskTypes?: number; // Maximum number of task types to return
}


/**
 * Entity type enumeration
 */
export enum EntityType {
  FILE_PATH = 'file_path',
  FUNCTION_NAME = 'function_name',
  CLASS_NAME = 'class_name',
  VARIABLE_NAME = 'variable_name',
  TECHNOLOGY = 'technology',
  LIBRARY = 'library',
  FRAMEWORK = 'framework',
  CONCEPT = 'concept',
  ERROR_MESSAGE = 'error_message',
  CODE_SNIPPET = 'code_snippet',
}

/**
 * Extracted entity with metadata (extends base IEntity from shared)
 */
export interface ExtractedEntity {
  type: EntityType;
  value: string;
  confidence: ConfidenceScore;
  context: string; // Surrounding text for context
  position?: {
    start: number;
    end: number;
  };
}

/**
 * Ambiguity type enumeration
 */
export enum AmbiguityType {
  UNDERSPECIFIED = 'underspecified', // Lacks critical information
  VAGUE = 'vague', // Too general or unclear
  MULTIPLE_INTERPRETATIONS = 'multiple_interpretations', // Can be understood in multiple ways
  INCOMPLETE_CONTEXT = 'incomplete_context', // Missing contextual information
  CONFLICTING_REQUIREMENTS = 'conflicting_requirements', // Contains contradictory information
}

/**
 * Detected ambiguity
 */
export interface DetectedAmbiguity {
  type: AmbiguityType;
  description: string;
  severity: 'low' | 'medium' | 'high';
  suggestions: string[]; // Clarifying questions or suggestions
  affectedText?: string; // Specific portion of text that's ambiguous
}

/**
 * Ambiguity detection result
 */
export interface AmbiguityResult {
  isAmbiguous: boolean;
  overallScore: ConfidenceScore; // How clear/unambiguous the prompt is (0=very ambiguous, 1=very clear)
  ambiguities: DetectedAmbiguity[];
}

/**
 * Complete prompt analysis result
 */
export interface PromptAnalysis {
  // Original prompt
  prompt: string;
  
  // Intent classification
  intent: IntentResult;
  
  // Task type identification
  taskType: TaskTypeResult;
  
  // Entity extraction
  entities: ExtractedEntity[];
  
  // Ambiguity detection
  ambiguity: AmbiguityResult;
  
  // Metadata
  metadata: {
    language: string; // Detected language (en, es, etc.)
    wordCount: number;
    hasCodeSnippets: boolean;
    hasQuestions: boolean;
    complexity: 'simple' | 'moderate' | 'complex';
  };
  
  // Processing metrics
  metrics: {
    processingTimeMs: number;
    timestamp: Date;
  };
}

/**
 * Analyzer configuration
 */
export interface AnalyzerConfig {
  // Intent classification config
  intent: {
    minConfidence: ConfidenceScore;
    enableMultiIntent: boolean;
  };
  
  // Task type config
  taskType: {
    minConfidence: ConfidenceScore;
    enableMultiTask: boolean;
  };
  
  // Entity extraction config
  entities: {
    minConfidence: ConfidenceScore;
    maxEntitiesPerType: number;
    enabledTypes: EntityType[];
  };
  
  // Ambiguity detection config
  ambiguity: {
    enabled: boolean;
    minSeverity: 'low' | 'medium' | 'high';
  };
  
  // General config
  cacheResults: boolean;
  cacheTTL: number; // seconds
}

/**
 * Pattern for keyword-based detection
 */
export interface KeywordPattern {
  keywords: string[];
  weight: number; // Importance of this pattern (0-1)
  mustMatchAll?: boolean; // If true, all keywords must be present
}

/**
 * Task type detection patterns
 */
export interface TaskTypePatterns {
  [TaskType.GENERAL_QUERY]: KeywordPattern[];
  [TaskType.BUG_FIX]: KeywordPattern[];
  [TaskType.FEATURE_ADD]: KeywordPattern[];
  [TaskType.FEATURE_REMOVE]: KeywordPattern[];
  [TaskType.DOCUMENTATION]: KeywordPattern[];
  [TaskType.REFACTOR]: KeywordPattern[];
  [TaskType.CODE_REVIEW]: KeywordPattern[];
  [TaskType.TESTING]: KeywordPattern[];
  [TaskType.DEPLOYMENT]: KeywordPattern[];
  [TaskType.OPTIMIZATION]: KeywordPattern[];
  [TaskType.SECURITY]: KeywordPattern[];
  [TaskType.ROADMAP]: KeywordPattern[];
}

/**
 * Intent detection patterns
 */
export interface IntentPatterns {
  [IntentCategory.CODING]: KeywordPattern[];
  [IntentCategory.PKM]: KeywordPattern[];
  [IntentCategory.GENERAL]: KeywordPattern[];
}

/**
 * Regular expression patterns for entity extraction
 */
export interface EntityPatterns {
  [EntityType.FILE_PATH]: RegExp[];
  [EntityType.FUNCTION_NAME]: RegExp[];
  [EntityType.CLASS_NAME]: RegExp[];
  [EntityType.VARIABLE_NAME]: RegExp[];
  [EntityType.TECHNOLOGY]: string[]; // Known technology names
  [EntityType.LIBRARY]: string[]; // Known library names
  [EntityType.FRAMEWORK]: string[]; // Known framework names
  [EntityType.CONCEPT]: string[]; // Programming concepts
  [EntityType.ERROR_MESSAGE]: RegExp[];
  [EntityType.CODE_SNIPPET]: RegExp[];
}
