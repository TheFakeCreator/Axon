/**
 * MongoDB schema definitions and collection names
 */

import { Document } from 'mongodb';
import { IWorkspace, IContext, IInteraction } from '../types';

/**
 * Collection names
 */
export const COLLECTIONS = {
  WORKSPACES: 'workspaces',
  CONTEXTS: 'contexts',
  INTERACTIONS: 'interactions',
  PROMPT_PATTERNS: 'prompt_patterns',
} as const;

/**
 * Workspace document schema
 */
export interface WorkspaceDocument extends Document {
  _id: string;
  type: string;
  name: string;
  description?: string;
  rootPath: string;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
}

/**
 * Context document schema
 */
export interface ContextDocument extends Document {
  _id: string;
  workspaceId: string;
  tier: string;
  type: string;
  content: string;
  metadata: Record<string, unknown>;
  embedding?: number[];
  score?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interaction document schema
 */
export interface InteractionDocument extends Document {
  _id: string;
  workspaceId: string;
  userId: string;
  promptId: string;
  status: string;
  request: Record<string, unknown>;
  response?: Record<string, unknown>;
  feedback?: Record<string, unknown>;
  createdAt: Date;
  completedAt?: Date;
  error?: Record<string, unknown>;
}

/**
 * Prompt pattern document schema (for context evolution)
 */
export interface PromptPatternDocument extends Document {
  _id: string;
  workspaceId: string;
  pattern: string;
  taskCategory: string;
  frequency: number;
  contextIds: string[];
  successRate: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * MongoDB index definitions
 */
export const INDEXES = {
  workspaces: [
    { key: { type: 1 } },
    { key: { createdAt: -1 } },
    { key: { rootPath: 1 }, unique: true },
  ],
  contexts: [
    { key: { workspaceId: 1, tier: 1 } },
    { key: { workspaceId: 1, type: 1 } },
    { key: { createdAt: -1 } },
    { key: { updatedAt: -1 } },
    { key: { 'metadata.filePath': 1 } },
    { key: { 'metadata.tags': 1 } },
  ],
  interactions: [
    { key: { workspaceId: 1, createdAt: -1 } },
    { key: { userId: 1, createdAt: -1 } },
    { key: { status: 1 } },
    { key: { createdAt: -1 } },
  ],
  prompt_patterns: [
    { key: { workspaceId: 1, taskCategory: 1 } },
    { key: { frequency: -1 } },
    { key: { successRate: -1 } },
    { key: { updatedAt: -1 } },
  ],
} as const;

/**
 * Export individual index arrays for migration utilities
 */
export const workspaceIndexes = INDEXES.workspaces;
export const contextIndexes = INDEXES.contexts;
export const interactionIndexes = INDEXES.interactions;
export const promptPatternIndexes = INDEXES.prompt_patterns;
