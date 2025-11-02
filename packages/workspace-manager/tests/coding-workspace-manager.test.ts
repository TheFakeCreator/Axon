/**
 * Tests for CodingWorkspaceManager
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { ContextTier, ContextType } from '@axon/shared';
import type { ContextStorage } from '@axon/context-engine';
import { CodingWorkspaceManager } from '../src/coding-workspace-manager.js';
import type { WorkspaceManagerConfig } from '../src/workspace-manager.js';
import type { CodingWorkspaceMetadata } from '../src/types.js';

// Mock fs module
vi.mock('fs', () => ({
  promises: {
    readdir: vi.fn(),
    readFile: vi.fn(),
    stat: vi.fn(),
  },
}));

describe('CodingWorkspaceManager', () => {
  let mockContextStorage: ContextStorage;
  let config: WorkspaceManagerConfig;
  let codingWorkspaceManager: CodingWorkspaceManager;
  const testRootPath = '/test/workspace';
  const testWorkspaceId = 'test-coding-workspace';

  beforeEach(() => {
    mockContextStorage = {
      createContextsBatch: vi.fn().mockResolvedValue([{ id: 'context-1' }]),
    } as any;

    config = {
      contextStorage: mockContextStorage,
      enableLogging: false,
      autoIndex: false,
    };

    codingWorkspaceManager = new CodingWorkspaceManager(config);

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('workspace type', () => {
    it('should return CODING workspace type', () => {
      const type = codingWorkspaceManager.getWorkspaceType();
      expect(type).toBe('coding');
    });
  });

  describe('buildMetadata', () => {
    beforeEach(() => {
      // Mock fs.readdir for scanning
      (fs.readdir as any).mockResolvedValue([
        { name: 'src', isDirectory: () => true, isFile: () => false },
        { name: 'package.json', isDirectory: () => false, isFile: () => true },
        { name: 'pnpm-lock.yaml', isDirectory: () => false, isFile: () => true },
        { name: 'vite.config.ts', isDirectory: () => false, isFile: () => true },
        { name: '.git', isDirectory: () => true, isFile: () => false },
        { name: 'index.ts', isDirectory: () => false, isFile: () => true },
      ]);

      // Mock package.json content
      (fs.readFile as any).mockResolvedValue(
        JSON.stringify({
          dependencies: {
            react: '^18.0.0',
            express: '^4.18.0',
          },
          devDependencies: {
            typescript: '^5.0.0',
          },
        })
      );

      // Mock fs.stat
      (fs.stat as any).mockResolvedValue({
        isDirectory: () => false,
        isFile: () => true,
      });
    });

    it('should detect languages from file extensions', async () => {
      await codingWorkspaceManager.initialize(testRootPath, testWorkspaceId);

      const metadata = codingWorkspaceManager.getMetadata() as CodingWorkspaceMetadata;
      expect(metadata?.languages).toBeDefined();
      expect(metadata?.languages).toContain('TypeScript');
    });

    it('should detect frameworks from package.json', async () => {
      await codingWorkspaceManager.initialize(testRootPath, testWorkspaceId);

      const metadata = codingWorkspaceManager.getMetadata() as CodingWorkspaceMetadata;
      expect(metadata?.frameworks).toBeDefined();
      expect(metadata?.frameworks).toContain('React');
      expect(metadata?.frameworks).toContain('Express');
    });

    it('should detect package manager from lock files', async () => {
      await codingWorkspaceManager.initialize(testRootPath, testWorkspaceId);

      const metadata = codingWorkspaceManager.getMetadata() as CodingWorkspaceMetadata;
      expect(metadata?.packageManager).toBe('pnpm');
    });

    it('should detect build tool from config files', async () => {
      await codingWorkspaceManager.initialize(testRootPath, testWorkspaceId);

      const metadata = codingWorkspaceManager.getMetadata() as CodingWorkspaceMetadata;
      expect(metadata?.buildTool).toBe('vite');
    });

    it('should detect VCS from markers', async () => {
      await codingWorkspaceManager.initialize(testRootPath, testWorkspaceId);

      const metadata = codingWorkspaceManager.getMetadata() as CodingWorkspaceMetadata;
      expect(metadata?.vcs).toBe('git');
    });
  });

  describe('extractContexts', () => {
    beforeEach(async () => {
      // Setup mock file system
      (fs.readdir as any).mockImplementation((dirPath: string) => {
        if (dirPath === testRootPath) {
          return Promise.resolve([
            { name: 'src', isDirectory: () => true, isFile: () => false },
            { name: 'index.ts', isDirectory: () => false, isFile: () => true },
            { name: 'README.md', isDirectory: () => false, isFile: () => true },
          ]);
        } else if (dirPath === path.join(testRootPath, 'src')) {
          return Promise.resolve([
            { name: 'main.ts', isDirectory: () => false, isFile: () => true },
          ]);
        }
        return Promise.resolve([]);
      });

      (fs.stat as any).mockImplementation((filePath: string) => {
        return Promise.resolve({
          isDirectory: () => filePath.endsWith('src'),
          isFile: () => !filePath.endsWith('src'),
          size: 1024,
          birthtime: new Date(),
          mtime: new Date(),
        });
      });

      (fs.readFile as any).mockResolvedValue('// Test file content');

      await codingWorkspaceManager.initialize(testRootPath, testWorkspaceId);
    });

    it('should extract contexts from files', async () => {
      const result = await codingWorkspaceManager.extractContexts({
        workspaceId: testWorkspaceId,
        paths: [path.join(testRootPath, 'index.ts')],
      });

      expect(result.contexts).toBeDefined();
      expect(result.contexts.length).toBeGreaterThan(0);
      expect(result.stats.filesScanned).toBeGreaterThan(0);
    });

    it('should respect file size limits', async () => {
      const largeFileManager = new CodingWorkspaceManager(config, {
        maxFileSize: 100, // Very small limit
      });

      await largeFileManager.initialize(testRootPath, testWorkspaceId);

      (fs.stat as any).mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
        size: 2048, // Exceeds limit
      });

      const result = await largeFileManager.extractContexts({
        workspaceId: testWorkspaceId,
        paths: [path.join(testRootPath, 'index.ts')],
      });

      // Large file should be skipped
      expect(result.contexts.length).toBe(0);
    });

    it('should extract from directories recursively', async () => {
      const result = await codingWorkspaceManager.extractContexts({
        workspaceId: testWorkspaceId,
        paths: [testRootPath],
      });

      expect(result.contexts.length).toBeGreaterThan(1);
    });

    it('should include file metadata in contexts', async () => {
      const result = await codingWorkspaceManager.extractContexts({
        workspaceId: testWorkspaceId,
        paths: [path.join(testRootPath, 'index.ts')],
      });

      const context = result.contexts[0];
      expect(context.metadata).toBeDefined();
      expect((context.metadata as any).filePath).toBeDefined();
      expect((context.metadata as any).language).toBeDefined();
    });

    it('should use correct context types', async () => {
      const result = await codingWorkspaceManager.extractContexts({
        workspaceId: testWorkspaceId,
        paths: [path.join(testRootPath, 'README.md')],
      });

      const context = result.contexts[0];
      expect(context.type).toBe(ContextType.DOCUMENTATION);
    });
  });

  describe('getProjectStructure', () => {
    beforeEach(() => {
      (fs.readdir as any).mockImplementation((dirPath: string) => {
        if (dirPath === testRootPath) {
          return Promise.resolve([
            { name: 'src', isDirectory: () => true, isFile: () => false },
            { name: 'tests', isDirectory: () => true, isFile: () => false },
            { name: 'index.ts', isDirectory: () => false, isFile: () => true },
            { name: 'README.md', isDirectory: () => false, isFile: () => true },
            { name: 'node_modules', isDirectory: () => true, isFile: () => false },
          ]);
        } else if (dirPath.endsWith('src')) {
          return Promise.resolve([
            { name: 'main.ts', isDirectory: () => false, isFile: () => true },
            { name: 'utils.ts', isDirectory: () => false, isFile: () => true },
          ]);
        } else if (dirPath.endsWith('tests')) {
          return Promise.resolve([
            { name: 'main.test.ts', isDirectory: () => false, isFile: () => true },
          ]);
        }
        return Promise.resolve([]);
      });
    });

    it('should build directory tree', async () => {
      const structure = await codingWorkspaceManager.getProjectStructure(testRootPath);

      expect(structure.directories).toBeDefined();
      expect(structure.directories.name).toBe(path.basename(testRootPath));
      expect(structure.directories.children.length).toBeGreaterThan(0);
    });

    it('should count files by extension', async () => {
      const structure = await codingWorkspaceManager.getProjectStructure(testRootPath);

      expect(structure.fileCountByExtension).toBeDefined();
      expect(structure.fileCountByExtension['.ts']).toBeGreaterThan(0);
      expect(structure.fileCountByExtension['.md']).toBeGreaterThan(0);
    });

    it('should exclude configured directories', async () => {
      const structure = await codingWorkspaceManager.getProjectStructure(testRootPath);

      // node_modules should be excluded
      const hasNodeModules = structure.directories.children.some(
        child => child.name === 'node_modules'
      );
      expect(hasNodeModules).toBe(false);
    });

    it('should count total files and directories', async () => {
      const structure = await codingWorkspaceManager.getProjectStructure(testRootPath);

      expect(structure.totalFiles).toBeGreaterThan(0);
      expect(structure.totalDirectories).toBeGreaterThan(0);
    });
  });

  describe('configuration', () => {
    it('should use custom file extensions', async () => {
      const customManager = new CodingWorkspaceManager(config, {
        includeExtensions: ['.rs', '.toml'],
      });

      expect((customManager as any).codingConfig.includeExtensions).toEqual([
        '.rs',
        '.toml',
      ]);
    });

    it('should use custom exclude directories', async () => {
      const customManager = new CodingWorkspaceManager(config, {
        excludeDirectories: ['custom-exclude'],
      });

      expect((customManager as any).codingConfig.excludeDirectories).toEqual([
        'custom-exclude',
      ]);
    });

    it('should use custom max file size', async () => {
      const customManager = new CodingWorkspaceManager(config, {
        maxFileSize: 5000,
      });

      expect((customManager as any).codingConfig.maxFileSize).toBe(5000);
    });
  });
});
