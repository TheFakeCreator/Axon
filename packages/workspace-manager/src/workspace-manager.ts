/**
 * Base Workspace Manager
 * 
 * Abstract base class for workspace-specific context extraction.
 */

import type { IContext } from '@axon/shared';
import type { ContextStorage } from '@axon/context-engine';
import type {
  WorkspaceType,
  WorkspaceMetadata,
  ContextExtractionRequest,
  ContextExtractionResult,
  ProjectStructure,
  IndexingProgress,
} from './types.js';

/**
 * Base configuration for workspace managers
 */
export interface WorkspaceManagerConfig {
  /** Context storage service */
  contextStorage: ContextStorage;
  /** Enable logging */
  enableLogging?: boolean;
  /** Auto-index on initialization */
  autoIndex?: boolean;
  /** Re-index interval in ms (0 = disabled) */
  reIndexInterval?: number;
}

/**
 * Abstract base class for workspace managers
 * 
 * Provides common functionality for all workspace types.
 * Subclasses implement workspace-specific extraction logic.
 */
export abstract class WorkspaceManager {
  protected config: Required<WorkspaceManagerConfig>;
  protected contextStorage: ContextStorage;
  protected workspaceMetadata?: WorkspaceMetadata;
  protected indexingInProgress: boolean = false;

  constructor(config: WorkspaceManagerConfig) {
    this.config = {
      contextStorage: config.contextStorage,
      enableLogging: config.enableLogging ?? true,
      autoIndex: config.autoIndex ?? false,
      reIndexInterval: config.reIndexInterval ?? 0,
    };
    this.contextStorage = config.contextStorage;
  }

  /**
   * Get workspace type (implemented by subclasses)
   */
  abstract getWorkspaceType(): WorkspaceType;

  /**
   * Initialize workspace
   * 
   * @param rootPath - Root directory path
   * @param workspaceId - Workspace ID
   */
  async initialize(rootPath: string, workspaceId: string): Promise<void> {
    if (this.config.enableLogging) {
      console.log(`[WorkspaceManager] Initializing ${this.getWorkspaceType()} workspace at ${rootPath}`);
    }

    // Scan workspace and build metadata
    this.workspaceMetadata = await this.buildMetadata(rootPath, workspaceId);

    // Auto-index if enabled
    if (this.config.autoIndex) {
      await this.indexWorkspace({ workspaceId });
    }

    // Set up re-indexing if interval configured
    if (this.config.reIndexInterval > 0) {
      this.setupReIndexing(workspaceId);
    }
  }

  /**
   * Build workspace metadata (implemented by subclasses)
   * 
   * @param rootPath - Root directory path
   * @param workspaceId - Workspace ID
   * @returns Workspace metadata
   */
  protected abstract buildMetadata(
    rootPath: string,
    workspaceId: string
  ): Promise<WorkspaceMetadata>;

  /**
   * Extract contexts from workspace
   * 
   * @param request - Extraction request
   * @returns Extraction result
   */
  abstract extractContexts(
    request: ContextExtractionRequest
  ): Promise<ContextExtractionResult>;

  /**
   * Index entire workspace
   * 
   * Extracts all relevant contexts and stores them in the context base.
   * 
   * @param request - Extraction request
   * @param onProgress - Progress callback
   * @returns Extraction result
   */
  async indexWorkspace(
    request: ContextExtractionRequest,
    onProgress?: (progress: IndexingProgress) => void
  ): Promise<ContextExtractionResult> {
    if (this.indexingInProgress) {
      throw new Error('Indexing already in progress');
    }

    this.indexingInProgress = true;

    try {
      // Extract contexts
      const result = await this.extractContexts(request);

      // Store contexts in batches (convert to storage requests)
      const batchSize = 50;
      for (let i = 0; i < result.contexts.length; i += batchSize) {
        const batch = result.contexts.slice(i, i + batchSize);
        
        // Convert contexts to storage requests
        const storageRequests = batch.map(context => ({
          context: {
            workspaceId: context.workspaceId,
            type: context.type,
            content: context.content,
            metadata: context.metadata,
            tier: context.tier,
          },
          generateEmbeddings: true,
          indexInVectorDB: true,
        }));
        
        // Store batch
        await this.contextStorage.createContextsBatch(storageRequests);

        // Report progress
        if (onProgress) {
          onProgress({
            phase: 'storing',
            progress: Math.floor(((i + batch.length) / result.contexts.length) * 100),
            filesProcessed: i + batch.length,
            totalFiles: result.contexts.length,
          });
        }
      }

      if (onProgress) {
        onProgress({
          phase: 'complete',
          progress: 100,
          filesProcessed: result.contexts.length,
          totalFiles: result.contexts.length,
        });
      }

      if (this.config.enableLogging) {
        console.log(`[WorkspaceManager] Indexed ${result.contexts.length} contexts in ${result.stats.processingTimeMs}ms`);
      }

      return result;
    } finally {
      this.indexingInProgress = false;
    }
  }

  /**
   * Get project structure
   * 
   * @param rootPath - Root directory path
   * @returns Project structure
   */
  abstract getProjectStructure(rootPath: string): Promise<ProjectStructure>;

  /**
   * Get workspace metadata
   * 
   * @returns Workspace metadata
   */
  getMetadata(): WorkspaceMetadata | undefined {
    return this.workspaceMetadata;
  }

  /**
   * Check if workspace is initialized
   * 
   * @returns True if initialized
   */
  isInitialized(): boolean {
    return this.workspaceMetadata !== undefined;
  }

  /**
   * Set up automatic re-indexing
   * 
   * @param workspaceId - Workspace ID
   */
  private setupReIndexing(workspaceId: string): void {
    setInterval(async () => {
      if (!this.indexingInProgress) {
        if (this.config.enableLogging) {
          console.log(`[WorkspaceManager] Auto re-indexing workspace ${workspaceId}`);
        }
        
        try {
          await this.indexWorkspace({ workspaceId });
        } catch (error) {
          console.error('[WorkspaceManager] Re-indexing failed:', error);
        }
      }
    }, this.config.reIndexInterval);
  }

  /**
   * Log message if logging enabled
   * 
   * @param message - Log message
   * @param data - Additional data
   */
  protected log(message: string, data?: any): void {
    if (this.config.enableLogging) {
      console.log(`[${this.getWorkspaceType()}Manager]`, message, data || '');
    }
  }
}
