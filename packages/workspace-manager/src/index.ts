/**
 * Workspace Manager Package
 * 
 * Provides workspace-specific context extraction and management.
 */

// Base classes
export { WorkspaceManager, type WorkspaceManagerConfig } from './workspace-manager.js';

// Workspace implementations
export { CodingWorkspaceManager, type CodingWorkspaceConfig } from './coding-workspace-manager.js';
export { PKMWorkspaceManager, type PKMWorkspaceConfig } from './pkm-workspace-manager.js';
export { RootWorkspaceManager, type RootWorkspaceConfig } from './root-workspace-manager.js';

// Types
export type {
  WorkspaceType,
  WorkspaceMetadata,
  CodingWorkspaceMetadata,
  PKMWorkspaceMetadata,
  RootWorkspaceMetadata,
  ContextExtractionRequest,
  ContextExtractionResult,
  FileContextMetadata,
  SymbolContextMetadata,
  DependencyContextMetadata,
  ProjectStructure,
  DirectoryNode,
  IndexingProgress,
} from './types.js';

export { WorkspaceType as WorkspaceTypeEnum } from './types.js';
