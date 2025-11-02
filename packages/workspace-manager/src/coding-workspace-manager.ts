/**
 * Coding Workspace Manager
 * 
 * Manages context extraction for software development workspaces.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { ContextTier, ContextType, type IContext } from '@axon/shared';
import { WorkspaceManager, type WorkspaceManagerConfig } from './workspace-manager.js';
import {
  WorkspaceType,
  type CodingWorkspaceMetadata,
  type ContextExtractionRequest,
  type ContextExtractionResult,
  type ProjectStructure,
  type DirectoryNode,
  type FileContextMetadata,
} from './types.js';

/**
 * Coding workspace manager configuration
 */
export interface CodingWorkspaceConfig {
  /** File extensions to include */
  includeExtensions?: string[];
  /** Directories to exclude */
  excludeDirectories?: string[];
  /** Maximum file size to process (bytes) */
  maxFileSize?: number;
  /** Extract imports/dependencies */
  extractDependencies?: boolean;
}

/**
 * Coding Workspace Manager
 * 
 * Extracts contexts from coding workspaces including:
 * - Source code files
 * - Configuration files
 * - Documentation
 * - Dependencies
 * - Project structure
 */
export class CodingWorkspaceManager extends WorkspaceManager {
  private codingConfig: Required<CodingWorkspaceConfig>;

  constructor(
    config: WorkspaceManagerConfig,
    codingConfig: CodingWorkspaceConfig = {}
  ) {
    super(config);
    
    this.codingConfig = {
      includeExtensions: codingConfig.includeExtensions ?? [
        '.ts', '.js', '.tsx', '.jsx',
        '.py', '.java', '.cpp', '.c', '.h',
        '.go', '.rs', '.rb', '.php',
        '.md', '.json', '.yaml', '.yml',
        '.toml', '.xml', '.html', '.css',
      ],
      excludeDirectories: codingConfig.excludeDirectories ?? [
        'node_modules', 'dist', 'build', '.git',
        '__pycache__', 'venv', '.venv', 'target',
      ],
      maxFileSize: codingConfig.maxFileSize ?? 1024 * 1024, // 1MB
      extractDependencies: codingConfig.extractDependencies ?? true,
    };
  }

  getWorkspaceType(): WorkspaceType {
    return WorkspaceType.CODING;
  }

  /**
   * Build coding workspace metadata
   */
  protected async buildMetadata(
    rootPath: string,
    workspaceId: string
  ): Promise<CodingWorkspaceMetadata> {
    this.log('Building workspace metadata', { rootPath });

    const structure = await this.getProjectStructure(rootPath);
    
    // Detect languages
    const languages = this.detectLanguages(structure);
    
    // Detect frameworks
    const frameworks = await this.detectFrameworks(rootPath);
    
    // Detect package manager
    const packageManager = await this.detectPackageManager(rootPath);
    
    // Detect build tool
    const buildTool = await this.detectBuildTool(rootPath);
    
    // Detect VCS
    const vcs = await this.detectVCS(rootPath);

    return {
      id: workspaceId,
      type: WorkspaceType.CODING,
      name: path.basename(rootPath),
      rootPath,
      createdAt: new Date(),
      lastModified: new Date(),
      languages,
      frameworks,
      packageManager,
      buildTool,
      vcs,
    };
  }

  /**
   * Extract contexts from workspace
   */
  async extractContexts(
    request: ContextExtractionRequest
  ): Promise<ContextExtractionResult> {
    if (!this.workspaceMetadata) {
      throw new Error('Workspace not initialized');
    }

    const startTime = Date.now();
    const contexts: IContext[] = [];
    let filesScanned = 0;

    const rootPath = this.workspaceMetadata.rootPath;
    const paths = request.paths || [rootPath];

    for (const scanPath of paths) {
      const fullPath = path.isAbsolute(scanPath) ? scanPath : path.join(rootPath, scanPath);
      
      const fileContexts = await this.extractFileContexts(
        fullPath,
        request.workspaceId,
        request.includePatterns,
        request.excludePatterns
      );

      contexts.push(...fileContexts);
      filesScanned += fileContexts.length;

      if (request.limit && contexts.length >= request.limit) {
        break;
      }
    }

    // Limit results if specified
    const limitedContexts = request.limit
      ? contexts.slice(0, request.limit)
      : contexts;

    return {
      workspaceId: request.workspaceId,
      contexts: limitedContexts,
      stats: {
        filesScanned,
        contextsExtracted: limitedContexts.length,
        processingTimeMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Extract contexts from files recursively
   */
  private async extractFileContexts(
    dirPath: string,
    workspaceId: string,
    includePatterns?: string[],
    excludePatterns?: string[]
  ): Promise<IContext[]> {
    const contexts: IContext[] = [];

    try {
      const stats = await fs.stat(dirPath);

      if (stats.isFile()) {
        // Process single file
        const context = await this.extractFileContext(dirPath, workspaceId);
        if (context) {
          contexts.push(context);
        }
      } else if (stats.isDirectory()) {
        // Process directory recursively
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);

          // Skip excluded directories
          if (entry.isDirectory() && this.codingConfig.excludeDirectories.includes(entry.name)) {
            continue;
          }

          // Recursively process
          const subContexts = await this.extractFileContexts(
            fullPath,
            workspaceId,
            includePatterns,
            excludePatterns
          );
          contexts.push(...subContexts);
        }
      }
    } catch (error) {
      this.log(`Error processing ${dirPath}:`, error);
    }

    return contexts;
  }

  /**
   * Extract context from a single file
   */
  private async extractFileContext(
    filePath: string,
    workspaceId: string
  ): Promise<IContext | null> {
    try {
      const stats = await fs.stat(filePath);
      const extension = path.extname(filePath);

      // Check file extension
      if (!this.codingConfig.includeExtensions.includes(extension)) {
        return null;
      }

      // Check file size
      if (stats.size > this.codingConfig.maxFileSize) {
        this.log(`Skipping large file: ${filePath} (${stats.size} bytes)`);
        return null;
      }

      // Read file content
      const content = await fs.readFile(filePath, 'utf-8');

      // Detect language
      const language = this.detectFileLanguage(extension);

      // Create file metadata
      const metadata: FileContextMetadata = {
        filePath: path.relative(this.workspaceMetadata!.rootPath, filePath),
        extension,
        language,
        size: stats.size,
        lines: content.split('\n').length,
        lastModified: stats.mtime,
      };

      return {
        id: '', // Will be generated by storage
        workspaceId,
        type: this.getContextType(extension),
        content,
        metadata: metadata as any,
        tier: ContextTier.WORKSPACE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      this.log(`Error extracting context from ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Get project structure
   */
  async getProjectStructure(rootPath: string): Promise<ProjectStructure> {
    const directories = await this.buildDirectoryTree(rootPath);
    const fileCountByExtension: Record<string, number> = {};
    let totalFiles = 0;
    let totalDirectories = 0;

    const countFiles = (node: DirectoryNode) => {
      totalDirectories++;
      totalFiles += node.files.length;

      node.files.forEach(file => {
        const ext = path.extname(file);
        fileCountByExtension[ext] = (fileCountByExtension[ext] || 0) + 1;
      });

      node.children.forEach(child => countFiles(child));
    };

    countFiles(directories);

    return {
      root: rootPath,
      directories,
      fileCountByExtension,
      totalFiles,
      totalDirectories,
    };
  }

  /**
   * Build directory tree recursively
   */
  private async buildDirectoryTree(dirPath: string): Promise<DirectoryNode> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const node: DirectoryNode = {
      name: path.basename(dirPath),
      path: dirPath,
      children: [],
      files: [],
    };

    for (const entry of entries) {
      // Skip excluded directories
      if (entry.isDirectory() && this.codingConfig.excludeDirectories.includes(entry.name)) {
        continue;
      }

      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        const childNode = await this.buildDirectoryTree(fullPath);
        node.children.push(childNode);
      } else {
        node.files.push(entry.name);
      }
    }

    return node;
  }

  /**
   * Detect programming languages used
   */
  private detectLanguages(structure: ProjectStructure): string[] {
    const languageMap: Record<string, string> = {
      '.ts': 'TypeScript',
      '.tsx': 'TypeScript',
      '.js': 'JavaScript',
      '.jsx': 'JavaScript',
      '.py': 'Python',
      '.java': 'Java',
      '.cpp': 'C++',
      '.c': 'C',
      '.go': 'Go',
      '.rs': 'Rust',
      '.rb': 'Ruby',
      '.php': 'PHP',
    };

    const languages = new Set<string>();
    
    Object.keys(structure.fileCountByExtension).forEach(ext => {
      if (languageMap[ext]) {
        languages.add(languageMap[ext]);
      }
    });

    return Array.from(languages);
  }

  /**
   * Detect frameworks used in the project
   */
  private async detectFrameworks(rootPath: string): Promise<string[]> {
    const frameworks: string[] = [];

    try {
      const packageJsonPath = path.join(rootPath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      const frameworkMap: Record<string, string> = {
        'react': 'React',
        'vue': 'Vue',
        'angular': 'Angular',
        '@angular/core': 'Angular',
        'next': 'Next.js',
        'nuxt': 'Nuxt',
        'express': 'Express',
        'fastify': 'Fastify',
        'nest': 'NestJS',
        '@nestjs/core': 'NestJS',
      };

      Object.keys(allDeps).forEach(dep => {
        if (frameworkMap[dep]) {
          frameworks.push(frameworkMap[dep]);
        }
      });
    } catch (error) {
      // No package.json or error reading it
    }

    return frameworks;
  }

  /**
   * Detect package manager
   */
  private async detectPackageManager(rootPath: string): Promise<string | undefined> {
    const lockFiles = {
      'pnpm-lock.yaml': 'pnpm',
      'yarn.lock': 'yarn',
      'package-lock.json': 'npm',
      'bun.lockb': 'bun',
    };

    for (const [lockFile, manager] of Object.entries(lockFiles)) {
      try {
        await fs.access(path.join(rootPath, lockFile));
        return manager;
      } catch {
        // File doesn't exist
      }
    }

    return undefined;
  }

  /**
   * Detect build tool
   */
  private async detectBuildTool(rootPath: string): Promise<string | undefined> {
    const configFiles = {
      'turbo.json': 'turbo',
      'vite.config.ts': 'vite',
      'vite.config.js': 'vite',
      'webpack.config.js': 'webpack',
      'rollup.config.js': 'rollup',
      'tsup.config.ts': 'tsup',
    };

    for (const [configFile, tool] of Object.entries(configFiles)) {
      try {
        await fs.access(path.join(rootPath, configFile));
        return tool;
      } catch {
        // File doesn't exist
      }
    }

    return undefined;
  }

  /**
   * Detect version control system
   */
  private async detectVCS(rootPath: string): Promise<'git' | 'svn' | 'mercurial' | undefined> {
    const vcsMarkers = {
      '.git': 'git' as const,
      '.svn': 'svn' as const,
      '.hg': 'mercurial' as const,
    };

    for (const [marker, vcs] of Object.entries(vcsMarkers)) {
      try {
        await fs.access(path.join(rootPath, marker));
        return vcs;
      } catch {
        // Marker doesn't exist
      }
    }

    return undefined;
  }

  /**
   * Detect file language from extension
   */
  private detectFileLanguage(extension: string): string | undefined {
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescriptreact',
      '.js': 'javascript',
      '.jsx': 'javascriptreact',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.go': 'go',
      '.rs': 'rust',
      '.rb': 'ruby',
      '.php': 'php',
      '.md': 'markdown',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.toml': 'toml',
      '.xml': 'xml',
      '.html': 'html',
      '.css': 'css',
    };

    return languageMap[extension];
  }

  /**
   * Get context type from file extension
   */
  private getContextType(extension: string): ContextType {
    if (['.md', '.txt'].includes(extension)) {
      return ContextType.DOCUMENTATION;
    }
    if (['.json', '.yaml', '.yml', '.toml', '.xml'].includes(extension)) {
      return ContextType.FILE; // Use FILE for configuration files
    }
    return ContextType.FILE;
  }
}
