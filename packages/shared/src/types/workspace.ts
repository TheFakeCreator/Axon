/**
 * Workspace-related types and interfaces
 */

/**
 * Workspace types supported by Axon
 */
export enum WorkspaceType {
  CODING = 'coding',
  PKM = 'pkm', // Personal Knowledge Management
  ROOT = 'root', // Meta-workspace
}

/**
 * Workspace metadata interface
 */
export interface IWorkspace {
  id: string;
  type: WorkspaceType;
  name: string;
  description?: string;
  rootPath: string;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
}

/**
 * Coding workspace specific metadata
 */
export interface ICodingWorkspaceMetadata {
  techStack: string[];
  primaryLanguage: string;
  framework?: string;
  projectType: string; // e.g., 'monorepo', 'web-app', 'api', 'library'
  buildTool?: string;
  packageManager?: string;
  testFramework?: string;
}

/**
 * PKM workspace specific metadata
 */
export interface IPKMWorkspaceMetadata {
  noteFormat: 'markdown' | 'org' | 'txt';
  taggingSystem?: string;
  linkingStrategy?: string;
  workflowPatterns?: string[];
}

/**
 * Root workspace specific metadata
 */
export interface IRootWorkspaceMetadata {
  linkedWorkspaces: string[]; // Array of workspace IDs
  globalPreferences: Record<string, unknown>;
}
