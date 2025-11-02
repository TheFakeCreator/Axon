/**
 * Root Workspace Manager
 * 
 * Manages multiple sub-workspaces and provides cross-workspace coordination.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { ContextTier, type IContext } from '@axon/shared';
import { WorkspaceManager, type WorkspaceManagerConfig } from './workspace-manager.js';
import { CodingWorkspaceManager, type CodingWorkspaceConfig } from './coding-workspace-manager.js';
import { PKMWorkspaceManager, type PKMWorkspaceConfig } from './pkm-workspace-manager.js';
import {
  WorkspaceType,
  type RootWorkspaceMetadata,
  type ContextExtractionRequest,
  type ContextExtractionResult,
  type ProjectStructure,
  type DirectoryNode,
} from './types.js';

/**
 * Configuration for root workspace manager
 */
export interface RootWorkspaceConfig {
  /** Auto-detect sub-workspaces (default: true) */
  autoDetectWorkspaces?: boolean;
  
  /** Manually specified workspace paths */
  workspacePaths?: string[];
  
  /** Default workspace type for auto-detection */
  defaultWorkspaceType?: WorkspaceType;
  
  /** Coding workspace configuration */
  codingConfig?: CodingWorkspaceConfig;
  
  /** PKM workspace configuration */
  pkmConfig?: PKMWorkspaceConfig;
}

/**
 * Sub-workspace information
 */
interface SubWorkspace {
  id: string;
  type: WorkspaceType;
  name: string;
  rootPath: string;
  manager: WorkspaceManager;
}

/**
 * Root Workspace Manager
 * 
 * Coordinates multiple sub-workspaces and provides unified context management.
 */
export class RootWorkspaceManager extends WorkspaceManager {
  private rootConfig: Required<RootWorkspaceConfig>;
  private subWorkspaces: Map<string, SubWorkspace> = new Map();

  constructor(
    config: WorkspaceManagerConfig,
    rootConfig: RootWorkspaceConfig = {}
  ) {
    super(config);

    this.rootConfig = {
      autoDetectWorkspaces: rootConfig.autoDetectWorkspaces ?? true,
      workspacePaths: rootConfig.workspacePaths ?? [],
      defaultWorkspaceType: rootConfig.defaultWorkspaceType ?? WorkspaceType.CODING,
      codingConfig: rootConfig.codingConfig ?? {},
      pkmConfig: rootConfig.pkmConfig ?? {},
    };
  }

  /**
   * Get workspace type
   */
  getWorkspaceType(): WorkspaceType {
    return WorkspaceType.ROOT;
  }

  /**
   * Build root workspace metadata
   */
  protected async buildMetadata(): Promise<RootWorkspaceMetadata> {
    const rootPath = this.workspaceMetadata?.rootPath;
    const workspaceId = this.workspaceMetadata?.id;

    if (!rootPath || !workspaceId) {
      throw new Error('Workspace not initialized');
    }

    // Detect or load sub-workspaces
    if (this.rootConfig.autoDetectWorkspaces) {
      await this.detectSubWorkspaces(rootPath);
    } else {
      await this.loadManualWorkspaces(rootPath);
    }

    const workspaceIds = Array.from(this.subWorkspaces.keys());

    return {
      id: workspaceId,
      type: WorkspaceType.ROOT,
      name: path.basename(rootPath),
      rootPath,
      createdAt: new Date(),
      lastModified: new Date(),
      workspaceCount: this.subWorkspaces.size,
      workspaceIds,
    };
  }

  /**
   * Extract contexts from root workspace (delegates to sub-workspaces)
   */
  async extractContexts(
    request: ContextExtractionRequest
  ): Promise<ContextExtractionResult> {
    const startTime = Date.now();
    const allContexts: IContext[] = [];
    let totalFilesScanned = 0;

    // If specific paths provided, route to appropriate sub-workspace
    if (request.paths && request.paths.length > 0) {
      for (const targetPath of request.paths) {
        const subWorkspace = this.findWorkspaceForPath(targetPath);
        
        if (subWorkspace) {
          const result = await subWorkspace.manager.extractContexts({
            ...request,
            paths: [targetPath],
          });
          
          allContexts.push(...result.contexts);
          totalFilesScanned += result.stats.filesScanned;
        }
      }
    } else {
      // Extract from all sub-workspaces
      for (const subWorkspace of this.subWorkspaces.values()) {
        const result = await subWorkspace.manager.extractContexts({
          ...request,
          workspaceId: subWorkspace.id,
        });
        
        allContexts.push(...result.contexts);
        totalFilesScanned += result.stats.filesScanned;
        
        if (request.limit && allContexts.length >= request.limit) {
          break;
        }
      }
    }

    const processingTimeMs = Date.now() - startTime;

    return {
      workspaceId: request.workspaceId,
      contexts: request.limit ? allContexts.slice(0, request.limit) : allContexts,
      stats: {
        filesScanned: totalFilesScanned,
        contextsExtracted: allContexts.length,
        processingTimeMs,
      },
    };
  }

  /**
   * Get project structure (aggregated from sub-workspaces)
   */
  async getProjectStructure(rootPath?: string): Promise<ProjectStructure> {
    const basePath = rootPath ?? this.workspaceMetadata?.rootPath;
    
    if (!basePath) {
      throw new Error('Workspace not initialized and no rootPath provided');
    }

    const rootDirNode: DirectoryNode = {
      name: path.basename(basePath),
      path: basePath,
      children: [],
      files: [],
    };

    const fileCountByExtension: Record<string, number> = {};
    let totalFiles = 0;
    let totalDirectories = 0;

    // Aggregate structures from all sub-workspaces
    for (const subWorkspace of this.subWorkspaces.values()) {
      const structure = await subWorkspace.manager.getProjectStructure(subWorkspace.rootPath);
      
      // Add sub-workspace root as child
      const subRoot: DirectoryNode = {
        name: path.basename(structure.root),
        path: structure.root,
        children: structure.directories.children,
        files: structure.directories.files,
      };
      
      rootDirNode.children.push(subRoot);
      
      // Merge file counts
      for (const [ext, count] of Object.entries(structure.fileCountByExtension)) {
        fileCountByExtension[ext] = (fileCountByExtension[ext] ?? 0) + count;
      }
      
      totalFiles += structure.totalFiles;
      totalDirectories += structure.totalDirectories;
    }

    return {
      root: basePath,
      directories: rootDirNode,
      fileCountByExtension,
      totalFiles,
      totalDirectories,
    };
  }

  /**
   * Get sub-workspace by ID
   */
  getSubWorkspace(workspaceId: string): SubWorkspace | undefined {
    return this.subWorkspaces.get(workspaceId);
  }

  /**
   * Get all sub-workspaces
   */
  getAllSubWorkspaces(): SubWorkspace[] {
    return Array.from(this.subWorkspaces.values());
  }

  /**
   * Add a sub-workspace manually
   */
  async addSubWorkspace(
    workspacePath: string,
    type: WorkspaceType,
    workspaceId?: string
  ): Promise<SubWorkspace> {
    const id = workspaceId ?? this.generateWorkspaceId(workspacePath);
    const name = path.basename(workspacePath);

    // Create appropriate manager based on type
    const manager = this.createWorkspaceManager(type);

    // Initialize the workspace
    await manager.initialize(workspacePath, id);

    const subWorkspace: SubWorkspace = {
      id,
      type,
      name,
      rootPath: workspacePath,
      manager,
    };

    this.subWorkspaces.set(id, subWorkspace);

    return subWorkspace;
  }

  /**
   * Remove a sub-workspace
   */
  removeSubWorkspace(workspaceId: string): boolean {
    return this.subWorkspaces.delete(workspaceId);
  }

  /**
   * Detect sub-workspaces automatically
   */
  private async detectSubWorkspaces(rootPath: string): Promise<void> {
    const entries = await fs.readdir(rootPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const fullPath = path.join(rootPath, entry.name);

      // Skip common non-workspace directories
      if (this.shouldSkipDirectory(entry.name)) {
        continue;
      }

      // Detect workspace type
      const type = await this.detectWorkspaceType(fullPath);

      if (type) {
        const id = this.generateWorkspaceId(fullPath);
        const manager = this.createWorkspaceManager(type);

        await manager.initialize(fullPath, id);

        this.subWorkspaces.set(id, {
          id,
          type,
          name: entry.name,
          rootPath: fullPath,
          manager,
        });

        if (this.config.enableLogging) {
          console.log(`Detected ${type} workspace: ${entry.name}`);
        }
      }
    }
  }

  /**
   * Load manually specified workspaces
   */
  private async loadManualWorkspaces(rootPath: string): Promise<void> {
    for (const workspacePath of this.rootConfig.workspacePaths) {
      const absolutePath = path.isAbsolute(workspacePath)
        ? workspacePath
        : path.join(rootPath, workspacePath);

      const type = await this.detectWorkspaceType(absolutePath);
      const workspaceType = type ?? this.rootConfig.defaultWorkspaceType;

      await this.addSubWorkspace(absolutePath, workspaceType);
    }
  }

  /**
   * Detect workspace type from directory
   */
  private async detectWorkspaceType(
    dirPath: string
  ): Promise<WorkspaceType | null> {
    try {
      const entries = await fs.readdir(dirPath);

      // Coding workspace indicators
      const codingIndicators = [
        'package.json',
        'pom.xml',
        'build.gradle',
        'Cargo.toml',
        'go.mod',
        'requirements.txt',
        'pyproject.toml',
        'Gemfile',
        'composer.json',
      ];

      const hasCodingIndicator = entries.some(entry =>
        codingIndicators.includes(entry)
      );

      if (hasCodingIndicator) {
        return WorkspaceType.CODING;
      }

      // PKM workspace indicators
      const pkmIndicators = [
        '.obsidian',
        'logseq',
        '.foam',
      ];

      const hasPKMIndicator = entries.some(entry =>
        pkmIndicators.includes(entry)
      );

      if (hasPKMIndicator) {
        return WorkspaceType.PKM;
      }

      // Check for markdown files (potential PKM workspace)
      const hasMarkdownFiles = entries.some(entry =>
        entry.endsWith('.md')
      );

      if (hasMarkdownFiles) {
        return WorkspaceType.PKM;
      }

      return null;
    } catch (error) {
      if (this.config.enableLogging) {
        console.error(`Error detecting workspace type: ${dirPath}`, error);
      }
      return null;
    }
  }

  /**
   * Create workspace manager based on type
   */
  private createWorkspaceManager(type: WorkspaceType): WorkspaceManager {
    switch (type) {
      case WorkspaceType.CODING:
        return new CodingWorkspaceManager(
          this.config,
          this.rootConfig.codingConfig
        );
      
      case WorkspaceType.PKM:
        return new PKMWorkspaceManager(
          this.config,
          this.rootConfig.pkmConfig
        );
      
      default:
        throw new Error(`Unsupported workspace type: ${type}`);
    }
  }

  /**
   * Find which sub-workspace a path belongs to
   */
  private findWorkspaceForPath(targetPath: string): SubWorkspace | undefined {
    const absolutePath = path.resolve(targetPath);

    for (const workspace of this.subWorkspaces.values()) {
      const workspacePath = path.resolve(workspace.rootPath);
      if (absolutePath.startsWith(workspacePath)) {
        return workspace;
      }
    }

    return undefined;
  }

  /**
   * Generate workspace ID from path
   */
  private generateWorkspaceId(workspacePath: string): string {
    const name = path.basename(workspacePath);
    const timestamp = Date.now();
    return `${name}-${timestamp}`;
  }

  /**
   * Check if directory should be skipped
   */
  private shouldSkipDirectory(dirName: string): boolean {
    const skipDirs = [
      'node_modules',
      'dist',
      'build',
      'out',
      '.git',
      '.svn',
      '__pycache__',
      'venv',
      '.venv',
      'target',
      'bin',
      'obj',
    ];

    return skipDirs.includes(dirName) || dirName.startsWith('.');
  }
}
