/**
 * Workspace Manager Type Definitions
 * 
 * Defines interfaces for workspace-specific context extraction and management.
 */

import type { IContext } from '@axon/shared';

/**
 * Workspace type enumeration
 */
export enum WorkspaceType {
  CODING = 'coding',
  PKM = 'pkm',
  ROOT = 'root',
}

/**
 * Workspace metadata
 */
export interface WorkspaceMetadata {
  /** Workspace ID */
  id: string;
  /** Workspace type */
  type: WorkspaceType;
  /** Workspace name */
  name: string;
  /** Root directory path */
  rootPath: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last modified timestamp */
  lastModified: Date;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Coding workspace specific metadata
 */
export interface CodingWorkspaceMetadata extends WorkspaceMetadata {
  type: WorkspaceType.CODING;
  /** Programming languages detected */
  languages: string[];
  /** Frameworks/libraries used */
  frameworks: string[];
  /** Package manager (npm, pnpm, yarn, etc.) */
  packageManager?: string;
  /** Build tool (webpack, vite, turbo, etc.) */
  buildTool?: string;
  /** Version control system */
  vcs?: 'git' | 'svn' | 'mercurial';
  /** Main entry point */
  entryPoint?: string;
}

/**
 * PKM workspace specific metadata
 */
export interface PKMWorkspaceMetadata extends WorkspaceMetadata {
  type: WorkspaceType.PKM;
  /** Note format (markdown, org, etc.) */
  noteFormat: string;
  /** Total note count */
  noteCount: number;
  /** Tag count */
  tagCount: number;
  /** Link/backlink count */
  linkCount: number;
}

/**
 * Root workspace metadata
 */
export interface RootWorkspaceMetadata extends WorkspaceMetadata {
  type: WorkspaceType.ROOT;
  /** Number of sub-workspaces */
  workspaceCount: number;
  /** Sub-workspace IDs */
  workspaceIds: string[];
}

/**
 * Context extraction request
 */
export interface ContextExtractionRequest {
  /** Workspace ID */
  workspaceId: string;
  /** Specific paths to extract from (optional) */
  paths?: string[];
  /** File patterns to include */
  includePatterns?: string[];
  /** File patterns to exclude */
  excludePatterns?: string[];
  /** Maximum contexts to extract */
  limit?: number;
  /** Extract dependencies/imports */
  extractDependencies?: boolean;
  /** Extract symbols (functions, classes) */
  extractSymbols?: boolean;
  /** Extract documentation */
  extractDocs?: boolean;
}

/**
 * Context extraction result
 */
export interface ContextExtractionResult {
  /** Workspace ID */
  workspaceId: string;
  /** Extracted contexts */
  contexts: IContext[];
  /** Extraction statistics */
  stats: {
    /** Total files scanned */
    filesScanned: number;
    /** Contexts extracted */
    contextsExtracted: number;
    /** Processing time in ms */
    processingTimeMs: number;
  };
}

/**
 * File context metadata
 */
export interface FileContextMetadata {
  /** File path */
  filePath: string;
  /** File extension */
  extension: string;
  /** Programming language */
  language?: string;
  /** File size in bytes */
  size: number;
  /** Line count */
  lines: number;
  /** Last modified timestamp */
  lastModified: Date;
}

/**
 * Symbol context metadata (function, class, variable)
 */
export interface SymbolContextMetadata extends FileContextMetadata {
  /** Symbol name */
  symbolName: string;
  /** Symbol type */
  symbolType: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'constant';
  /** Start line */
  startLine: number;
  /** End line */
  endLine: number;
  /** Is exported */
  isExported: boolean;
  /** JSDoc/docstring */
  documentation?: string;
}

/**
 * Dependency context metadata
 */
export interface DependencyContextMetadata {
  /** Package name */
  packageName: string;
  /** Version */
  version: string;
  /** Is dev dependency */
  isDev: boolean;
  /** Import locations */
  importedBy: string[];
}

/**
 * Project structure
 */
export interface ProjectStructure {
  /** Root directory */
  root: string;
  /** Directory tree */
  directories: DirectoryNode;
  /** File count by extension */
  fileCountByExtension: Record<string, number>;
  /** Total file count */
  totalFiles: number;
  /** Total directories */
  totalDirectories: number;
}

/**
 * Directory node in project tree
 */
export interface DirectoryNode {
  /** Directory name */
  name: string;
  /** Full path */
  path: string;
  /** Child directories */
  children: DirectoryNode[];
  /** Files in this directory */
  files: string[];
}

/**
 * Workspace indexing progress
 */
export interface IndexingProgress {
  /** Current phase */
  phase: 'scanning' | 'extracting' | 'embedding' | 'storing' | 'complete';
  /** Progress percentage (0-100) */
  progress: number;
  /** Current file being processed */
  currentFile?: string;
  /** Files processed */
  filesProcessed: number;
  /** Total files */
  totalFiles: number;
  /** Estimated time remaining (ms) */
  estimatedTimeMs?: number;
}
