/**
 * Prompt analysis and processing types
 */

import { IContext } from './context';

/**
 * Task categories for prompt classification
 */
export enum TaskCategory {
  GENERAL_QUERY = 'general_query',
  BUG_FIX = 'bug_fix',
  FEATURE_ADD = 'feature_add',
  FEATURE_REMOVE = 'feature_remove',
  REFACTOR = 'refactor',
  CODE_REVIEW = 'code_review',
  DOCUMENTATION = 'documentation',
  TESTING = 'testing',
  DEPLOYMENT = 'deployment',
  OPTIMIZATION = 'optimization',
  SECURITY = 'security',
  ROADMAP = 'roadmap',
  // PKM specific
  NOTE_OPERATIONS = 'note_operations',
  REFERENCE_MANAGEMENT = 'reference_management',
  PROJECT_MANAGEMENT = 'project_management',
  TEMPLATING = 'templating',
}

/**
 * Intent types
 */
export enum IntentType {
  QUESTION = 'question',
  COMMAND = 'command',
  EXPLANATION = 'explanation',
  CREATION = 'creation',
  MODIFICATION = 'modification',
  DELETION = 'deletion',
  NAVIGATION = 'navigation',
}

/**
 * Raw user prompt with metadata
 */
export interface IPrompt {
  id: string;
  workspaceId: string;
  userId: string;
  content: string;
  metadata: IPromptMetadata;
  timestamp: Date;
}

/**
 * Prompt metadata
 */
export interface IPromptMetadata {
  activeFile?: string;
  selectedText?: string;
  cursorPosition?: { line: number; column: number };
  openFiles?: string[];
  gitBranch?: string;
  recentCommands?: string[];
  diagnostics?: IDiagnostic[];
  conversationHistory?: string[]; // Recent interaction IDs
  [key: string]: unknown;
}

/**
 * Diagnostic information (errors, warnings)
 */
export interface IDiagnostic {
  severity: 'error' | 'warning' | 'info';
  message: string;
  filePath: string;
  lineRange: { start: number; end: number };
  source?: string;
}

/**
 * Prompt analysis result
 */
export interface IPromptAnalysis {
  promptId: string;
  intent: IntentType;
  taskCategory: TaskCategory;
  confidence: number;
  entities: IEntity[];
  ambiguities: IAmbiguity[];
  suggestedContextTypes: string[];
  tokenCount: number;
}

/**
 * Extracted entities from prompt
 */
export interface IEntity {
  type: 'file' | 'function' | 'class' | 'variable' | 'concept' | 'technology';
  value: string;
  confidence: number;
  position?: { start: number; end: number };
}

/**
 * Detected ambiguities
 */
export interface IAmbiguity {
  type: 'reference' | 'scope' | 'intent' | 'terminology';
  description: string;
  suggestions?: string[];
}

/**
 * Enriched prompt ready for LLM
 */
export interface IEnrichedPrompt {
  originalPrompt: string;
  enrichedPrompt: string;
  analysis: IPromptAnalysis;
  injectedContext: IContext[];
  totalTokens: number;
  strategy: 'prepend' | 'append' | 'sandwich' | 'system-message';
}
