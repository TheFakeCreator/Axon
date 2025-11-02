/**
 * Task type definitions and mappings
 */

import { TaskCategory, WorkspaceType } from '../types';

/**
 * Task types per workspace
 */
export const WORKSPACE_TASK_TYPES: Record<WorkspaceType, TaskCategory[]> = {
  [WorkspaceType.CODING]: [
    TaskCategory.GENERAL_QUERY,
    TaskCategory.BUG_FIX,
    TaskCategory.FEATURE_ADD,
    TaskCategory.FEATURE_REMOVE,
    TaskCategory.REFACTOR,
    TaskCategory.CODE_REVIEW,
    TaskCategory.DOCUMENTATION,
    TaskCategory.TESTING,
    TaskCategory.DEPLOYMENT,
    TaskCategory.OPTIMIZATION,
    TaskCategory.SECURITY,
    TaskCategory.ROADMAP,
  ],
  [WorkspaceType.PKM]: [
    TaskCategory.GENERAL_QUERY,
    TaskCategory.NOTE_OPERATIONS,
    TaskCategory.REFERENCE_MANAGEMENT,
    TaskCategory.PROJECT_MANAGEMENT,
    TaskCategory.TEMPLATING,
    TaskCategory.DOCUMENTATION,
  ],
  [WorkspaceType.ROOT]: [
    TaskCategory.GENERAL_QUERY,
    TaskCategory.ROADMAP,
  ],
};

/**
 * Default task category per workspace type
 */
export const DEFAULT_TASK_CATEGORY: Record<WorkspaceType, TaskCategory> = {
  [WorkspaceType.CODING]: TaskCategory.GENERAL_QUERY,
  [WorkspaceType.PKM]: TaskCategory.GENERAL_QUERY,
  [WorkspaceType.ROOT]: TaskCategory.GENERAL_QUERY,
};

/**
 * Task category display names
 */
export const TASK_CATEGORY_NAMES: Record<TaskCategory, string> = {
  [TaskCategory.GENERAL_QUERY]: 'General Query',
  [TaskCategory.BUG_FIX]: 'Bug Fix',
  [TaskCategory.FEATURE_ADD]: 'Feature Addition',
  [TaskCategory.FEATURE_REMOVE]: 'Feature Removal',
  [TaskCategory.REFACTOR]: 'Refactoring',
  [TaskCategory.CODE_REVIEW]: 'Code Review',
  [TaskCategory.DOCUMENTATION]: 'Documentation',
  [TaskCategory.TESTING]: 'Testing',
  [TaskCategory.DEPLOYMENT]: 'Deployment',
  [TaskCategory.OPTIMIZATION]: 'Optimization',
  [TaskCategory.SECURITY]: 'Security',
  [TaskCategory.ROADMAP]: 'Roadmap Planning',
  [TaskCategory.NOTE_OPERATIONS]: 'Note Operations',
  [TaskCategory.REFERENCE_MANAGEMENT]: 'Reference Management',
  [TaskCategory.PROJECT_MANAGEMENT]: 'Project Management',
  [TaskCategory.TEMPLATING]: 'Templating',
};

/**
 * Task category descriptions
 */
export const TASK_CATEGORY_DESCRIPTIONS: Record<TaskCategory, string> = {
  [TaskCategory.GENERAL_QUERY]: 'General questions and information requests',
  [TaskCategory.BUG_FIX]: 'Identifying and fixing bugs or errors',
  [TaskCategory.FEATURE_ADD]: 'Adding new functionality to the project',
  [TaskCategory.FEATURE_REMOVE]: 'Removing existing functionality',
  [TaskCategory.REFACTOR]: 'Improving code structure without changing functionality',
  [TaskCategory.CODE_REVIEW]: 'Reviewing code quality and suggesting improvements',
  [TaskCategory.DOCUMENTATION]: 'Writing or updating documentation',
  [TaskCategory.TESTING]: 'Creating or running tests',
  [TaskCategory.DEPLOYMENT]: 'Deploying or configuring deployment',
  [TaskCategory.OPTIMIZATION]: 'Improving performance or efficiency',
  [TaskCategory.SECURITY]: 'Security-related tasks and audits',
  [TaskCategory.ROADMAP]: 'Planning and roadmap discussions',
  [TaskCategory.NOTE_OPERATIONS]: 'Creating, editing, or organizing notes',
  [TaskCategory.REFERENCE_MANAGEMENT]: 'Managing references and citations',
  [TaskCategory.PROJECT_MANAGEMENT]: 'Project tracking and management',
  [TaskCategory.TEMPLATING]: 'Creating or using templates',
};
