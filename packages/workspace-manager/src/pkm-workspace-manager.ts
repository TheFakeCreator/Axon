/**
 * PKM (Personal Knowledge Management) Workspace Manager
 * 
 * Manages context extraction for personal knowledge management workspaces
 * (e.g., Obsidian vaults, Notion databases, Logseq graphs).
 */

import { promises as fs } from 'fs';
import path from 'path';
import { ContextTier, ContextType, type IContext } from '@axon/shared';
import { WorkspaceManager, type WorkspaceManagerConfig } from './workspace-manager.js';
import {
  WorkspaceType,
  type PKMWorkspaceMetadata,
  type ContextExtractionRequest,
  type ContextExtractionResult,
  type ProjectStructure,
  type DirectoryNode,
} from './types.js';

/**
 * Configuration for PKM workspace manager
 */
export interface PKMWorkspaceConfig {
  /** Note file extensions to include (default: .md, .org, .txt) */
  includeExtensions?: string[];
  
  /** Directories to exclude (default: .obsidian, .git, node_modules) */
  excludeDirectories?: string[];
  
  /** Maximum file size in bytes (default: 5MB for notes) */
  maxFileSize?: number;
  
  /** Extract tags from frontmatter and content (default: true) */
  extractTags?: boolean;
  
  /** Extract links and backlinks (default: true) */
  extractLinks?: boolean;
  
  /** Note format detection (default: auto-detect) */
  noteFormat?: 'markdown' | 'org-mode' | 'plain-text' | 'auto';
}

/**
 * Extracted note metadata
 */
interface NoteMetadata {
  notePath: string;
  title: string;
  tags: string[];
  links: string[];
  backlinks: string[];
  wordCount: number;
  createdDate?: Date;
  modifiedDate?: Date;
  frontmatter?: Record<string, any>;
}

/**
 * PKM Workspace Manager
 * 
 * Handles context extraction for personal knowledge management systems.
 */
export class PKMWorkspaceManager extends WorkspaceManager {
  private pkmConfig: Required<PKMWorkspaceConfig>;
  private noteIndex: Map<string, NoteMetadata> = new Map();

  constructor(
    config: WorkspaceManagerConfig,
    pkmConfig: PKMWorkspaceConfig = {}
  ) {
    super(config);

    this.pkmConfig = {
      includeExtensions: pkmConfig.includeExtensions ?? ['.md', '.org', '.txt'],
      excludeDirectories: pkmConfig.excludeDirectories ?? [
        '.obsidian',
        '.trash',
        '.git',
        'node_modules',
        '.vscode',
      ],
      maxFileSize: pkmConfig.maxFileSize ?? 5 * 1024 * 1024, // 5MB
      extractTags: pkmConfig.extractTags ?? true,
      extractLinks: pkmConfig.extractLinks ?? true,
      noteFormat: pkmConfig.noteFormat ?? 'auto',
    };
  }

  /**
   * Get workspace type
   */
  getWorkspaceType(): WorkspaceType {
    return WorkspaceType.PKM;
  }

  /**
   * Build PKM workspace metadata
   */
  protected async buildMetadata(): Promise<PKMWorkspaceMetadata> {
    const rootPath = this.workspaceMetadata?.rootPath;
    const workspaceId = this.workspaceMetadata?.id;

    if (!rootPath || !workspaceId) {
      throw new Error('Workspace not initialized');
    }

    // Scan for notes
    await this.scanNotes(rootPath);

    // Detect note format
    const noteFormat = await this.detectNoteFormat(rootPath);

    // Count tags and links
    let totalTags = 0;
    let totalLinks = 0;
    const allTags = new Set<string>();

    for (const note of this.noteIndex.values()) {
      note.tags.forEach(tag => allTags.add(tag));
      totalTags += note.tags.length;
      totalLinks += note.links.length;
    }

    return {
      id: workspaceId,
      type: WorkspaceType.PKM,
      name: path.basename(rootPath),
      rootPath,
      createdAt: new Date(),
      lastModified: new Date(),
      noteFormat,
      noteCount: this.noteIndex.size,
      tagCount: allTags.size,
      linkCount: totalLinks,
    };
  }

  /**
   * Extract contexts from PKM workspace
   */
  async extractContexts(
    request: ContextExtractionRequest
  ): Promise<ContextExtractionResult> {
    const startTime = Date.now();
    const contexts: IContext[] = [];

    if (!this.workspaceMetadata) {
      throw new Error('Workspace not initialized');
    }

    const rootPath = this.workspaceMetadata.rootPath;
    const paths = request.paths ?? [rootPath];

    for (const targetPath of paths) {
      const absolutePath = path.isAbsolute(targetPath)
        ? targetPath
        : path.join(rootPath, targetPath);

      const stat = await fs.stat(absolutePath);

      if (stat.isDirectory()) {
        const noteContexts = await this.extractNotesFromDirectory(
          absolutePath,
          request.workspaceId
        );
        contexts.push(...noteContexts);
      } else if (stat.isFile()) {
        const noteContext = await this.extractNoteContext(
          absolutePath,
          request.workspaceId
        );
        if (noteContext) {
          contexts.push(noteContext);
        }
      }

      if (request.limit && contexts.length >= request.limit) {
        break;
      }
    }

    const processingTimeMs = Date.now() - startTime;

    return {
      workspaceId: request.workspaceId,
      contexts: request.limit ? contexts.slice(0, request.limit) : contexts,
      stats: {
        filesScanned: contexts.length,
        contextsExtracted: contexts.length,
        processingTimeMs,
      },
    };
  }

  /**
   * Get project structure
   */
  async getProjectStructure(rootPath?: string): Promise<ProjectStructure> {
    const basePath = rootPath ?? this.workspaceMetadata?.rootPath;
    
    if (!basePath) {
      throw new Error('Workspace not initialized and no rootPath provided');
    }

    const root = await this.buildDirectoryTree(basePath);
    const directories: DirectoryNode[] = [];
    const fileCountByExtension: Record<string, number> = {};
    let totalFiles = 0;
    let totalDirectories = 0;

    const traverse = (node: DirectoryNode) => {
      if (node.children.length > 0) {
        totalDirectories++;
        directories.push(node);

        for (const child of node.children) {
          traverse(child);
        }
      }

      for (const file of node.files) {
        totalFiles++;
        const ext = path.extname(file);
        fileCountByExtension[ext] = (fileCountByExtension[ext] ?? 0) + 1;
      }
    };

    traverse(root);

    return {
      root: basePath,
      directories: root,
      fileCountByExtension,
      totalFiles,
      totalDirectories,
    };
  }

  /**
   * Scan notes in the workspace
   */
  private async scanNotes(rootPath: string): Promise<void> {
    this.noteIndex.clear();

    const scanDirectory = async (dirPath: string) => {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Skip excluded directories
          if (this.pkmConfig.excludeDirectories.includes(entry.name)) {
            continue;
          }
          await scanDirectory(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (this.pkmConfig.includeExtensions.includes(ext)) {
            try {
              const metadata = await this.extractNoteMetadata(fullPath);
              this.noteIndex.set(fullPath, metadata);
            } catch (error) {
              if (this.config.enableLogging) {
                console.error(`Error extracting note metadata: ${fullPath}`, error);
              }
            }
          }
        }
      }
    };

    await scanDirectory(rootPath);

    // Build backlinks after all notes are indexed
    this.buildBacklinks();
  }

  /**
   * Extract note metadata
   */
  private async extractNoteMetadata(notePath: string): Promise<NoteMetadata> {
    const content = await fs.readFile(notePath, 'utf-8');
    const stat = await fs.stat(notePath);

    // Extract title (from frontmatter or first heading)
    const title = this.extractTitle(content, notePath);

    // Extract tags
    const tags = this.pkmConfig.extractTags
      ? this.extractTags(content)
      : [];

    // Extract links
    const links = this.pkmConfig.extractLinks
      ? this.extractLinks(content)
      : [];

    // Extract frontmatter
    const frontmatter = this.extractFrontmatter(content);

    // Word count
    const wordCount = content.split(/\s+/).length;

    return {
      notePath,
      title,
      tags,
      links,
      backlinks: [], // Will be populated by buildBacklinks()
      wordCount,
      createdDate: stat.birthtime,
      modifiedDate: stat.mtime,
      frontmatter,
    };
  }

  /**
   * Extract title from note
   */
  private extractTitle(content: string, notePath: string): string {
    // Try frontmatter title first
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const titleMatch = frontmatterMatch[1].match(/title:\s*(.+)/);
      if (titleMatch) {
        return titleMatch[1].trim();
      }
    }

    // Try first heading
    const headingMatch = content.match(/^#\s+(.+)/m);
    if (headingMatch) {
      return headingMatch[1].trim();
    }

    // Fallback to filename
    return path.basename(notePath, path.extname(notePath));
  }

  /**
   * Extract tags from note
   */
  private extractTags(content: string): string[] {
    const tags = new Set<string>();

    // Frontmatter tags
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const tagsMatch = frontmatterMatch[1].match(/tags:\s*\[(.+?)\]/);
      if (tagsMatch) {
        tagsMatch[1].split(',').forEach(tag => {
          tags.add(tag.trim().replace(/['"]/g, ''));
        });
      }
    }

    // Inline tags (#tag)
    const inlineTagRegex = /#([\w-]+)/g;
    let match;
    while ((match = inlineTagRegex.exec(content)) !== null) {
      tags.add(match[1]);
    }

    return Array.from(tags);
  }

  /**
   * Extract links from note
   */
  private extractLinks(content: string): string[] {
    const links = new Set<string>();

    // Wiki-style links [[link]]
    const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
    let match;
    while ((match = wikiLinkRegex.exec(content)) !== null) {
      links.add(match[1].split('|')[0].trim());
    }

    // Markdown links [text](link)
    const mdLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    while ((match = mdLinkRegex.exec(content)) !== null) {
      const link = match[2].trim();
      // Only include internal links (not URLs)
      if (!link.startsWith('http://') && !link.startsWith('https://')) {
        links.add(link);
      }
    }

    return Array.from(links);
  }

  /**
   * Extract frontmatter
   */
  private extractFrontmatter(content: string): Record<string, any> | undefined {
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      return undefined;
    }

    const frontmatter: Record<string, any> = {};
    const lines = frontmatterMatch[1].split('\n');

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        frontmatter[key] = value;
      }
    }

    return frontmatter;
  }

  /**
   * Build backlinks for all notes
   */
  private buildBacklinks(): void {
    for (const [notePath, metadata] of this.noteIndex.entries()) {
      for (const link of metadata.links) {
        // Find the linked note
        for (const [linkedPath, linkedMetadata] of this.noteIndex.entries()) {
          if (
            linkedPath.includes(link) ||
            linkedMetadata.title === link ||
            path.basename(linkedPath, path.extname(linkedPath)) === link
          ) {
            linkedMetadata.backlinks.push(notePath);
          }
        }
      }
    }
  }

  /**
   * Detect note format
   */
  private async detectNoteFormat(
    rootPath: string
  ): Promise<'markdown' | 'org-mode' | 'plain-text'> {
    if (this.pkmConfig.noteFormat !== 'auto') {
      return this.pkmConfig.noteFormat;
    }

    // Count file extensions
    const extensionCounts: Record<string, number> = {};

    for (const metadata of this.noteIndex.values()) {
      const ext = path.extname(metadata.notePath);
      extensionCounts[ext] = (extensionCounts[ext] ?? 0) + 1;
    }

    // Determine primary format
    if (extensionCounts['.md'] > 0) {
      return 'markdown';
    } else if (extensionCounts['.org'] > 0) {
      return 'org-mode';
    } else {
      return 'plain-text';
    }
  }

  /**
   * Extract notes from directory recursively
   */
  private async extractNotesFromDirectory(
    dirPath: string,
    workspaceId: string
  ): Promise<IContext[]> {
    const contexts: IContext[] = [];
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        if (!this.pkmConfig.excludeDirectories.includes(entry.name)) {
          const subContexts = await this.extractNotesFromDirectory(
            fullPath,
            workspaceId
          );
          contexts.push(...subContexts);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (this.pkmConfig.includeExtensions.includes(ext)) {
          const context = await this.extractNoteContext(fullPath, workspaceId);
          if (context) {
            contexts.push(context);
          }
        }
      }
    }

    return contexts;
  }

  /**
   * Extract context from a single note
   */
  private async extractNoteContext(
    notePath: string,
    workspaceId: string
  ): Promise<IContext | null> {
    try {
      const stat = await fs.stat(notePath);

      // Check file size
      if (stat.size > this.pkmConfig.maxFileSize) {
        if (this.config.enableLogging) {
          console.warn(`Skipping large note: ${notePath} (${stat.size} bytes)`);
        }
        return null;
      }

      const content = await fs.readFile(notePath, 'utf-8');
      const metadata = this.noteIndex.get(notePath);

      if (!metadata) {
        // Extract metadata if not in index
        const extractedMetadata = await this.extractNoteMetadata(notePath);
        this.noteIndex.set(notePath, extractedMetadata);
      }

      const noteMetadata = this.noteIndex.get(notePath)!;

      return {
        id: '', // Generated by storage
        workspaceId,
        type: ContextType.DOCUMENTATION,
        content,
        metadata: {
          notePath,
          title: noteMetadata.title,
          tags: noteMetadata.tags,
          links: noteMetadata.links,
          backlinks: noteMetadata.backlinks,
          wordCount: noteMetadata.wordCount,
          createdDate: noteMetadata.createdDate,
          modifiedDate: noteMetadata.modifiedDate,
          frontmatter: noteMetadata.frontmatter,
        },
        tier: ContextTier.WORKSPACE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      if (this.config.enableLogging) {
        console.error(`Error extracting note context: ${notePath}`, error);
      }
      return null;
    }
  }

  /**
   * Build directory tree
   */
  private async buildDirectoryTree(dirPath: string): Promise<DirectoryNode> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const children: DirectoryNode[] = [];
    const files: string[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!this.pkmConfig.excludeDirectories.includes(entry.name)) {
          const childNode = await this.buildDirectoryTree(
            path.join(dirPath, entry.name)
          );
          children.push(childNode);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (this.pkmConfig.includeExtensions.includes(ext)) {
          files.push(entry.name);
        }
      }
    }

    return {
      name: path.basename(dirPath),
      path: dirPath,
      children,
      files,
    };
  }
}
