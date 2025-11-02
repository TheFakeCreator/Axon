/**
 * Context management types and interfaces
 */

/**
 * Context tier hierarchy
 */
export enum ContextTier {
  WORKSPACE = 'workspace', // Highest priority
  HYBRID = 'hybrid', // Runtime integration
  GLOBAL = 'global', // Fallback
}

/**
 * Context types
 */
export enum ContextType {
  FILE = 'file',
  DIRECTORY = 'directory',
  SYMBOL = 'symbol',
  DOCUMENTATION = 'documentation',
  DEPENDENCY = 'dependency',
  CONVERSATION = 'conversation',
  ERROR = 'error',
  TEST = 'test',
}

/**
 * Base context interface
 */
export interface IContext {
  id: string;
  workspaceId: string;
  tier: ContextTier;
  type: ContextType;
  content: string;
  metadata: IContextMetadata;
  embedding?: number[]; // Vector embedding
  score?: number; // Relevance score
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Context metadata
 */
export interface IContextMetadata {
  filePath?: string;
  lineRange?: { start: number; end: number };
  language?: string;
  tags?: string[];
  relationships?: IContextRelationship[];
  usageCount?: number;
  lastAccessed?: Date;
  source?: string; // Where the context came from
  [key: string]: unknown;
}

/**
 * Context relationships (for graph-based retrieval)
 */
export interface IContextRelationship {
  type: 'dependency' | 'reference' | 'concept' | 'temporal';
  targetContextId: string;
  strength: number; // 0-1
}

/**
 * Context retrieval query
 */
export interface IContextQuery {
  workspaceId: string;
  query: string;
  tiers?: ContextTier[];
  types?: ContextType[];
  limit?: number;
  minScore?: number;
  filters?: Record<string, unknown>;
}

/**
 * Context retrieval result
 */
export interface IContextResult {
  contexts: IContext[];
  totalTokens: number;
  retrievalTime: number;
  sources: {
    [key in ContextTier]?: number; // Count per tier
  };
}
