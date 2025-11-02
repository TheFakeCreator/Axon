/**
 * Tests for WorkspaceManager base class
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ContextStorage } from '@axon/context-engine';
import type { IContext } from '@axon/shared';
import { ContextTier, ContextType } from '@axon/shared';
import { WorkspaceManager, type WorkspaceManagerConfig } from '../src/workspace-manager.js';
import type {
  WorkspaceMetadata,
  ContextExtractionRequest,
  ContextExtractionResult,
  ProjectStructure,
  DirectoryNode,
  WorkspaceType,
} from '../src/types.js';

// Mock implementation of WorkspaceManager for testing
class MockWorkspaceManager extends WorkspaceManager {
  async buildMetadata(): Promise<WorkspaceMetadata> {
    return {
      id: 'test-workspace',
      type: 'coding' as WorkspaceType,
      name: 'Test Workspace',
      rootPath: '/test/path',
      createdAt: new Date(),
      lastModified: new Date(),
    };
  }

  async extractContexts(request: ContextExtractionRequest): Promise<ContextExtractionResult> {
    const mockContext: IContext = {
      id: 'test-context-1',
      workspaceId: request.workspaceId,
      type: ContextType.FILE,
      content: 'test content',
      metadata: {},
      tier: ContextTier.WORKSPACE,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return {
      workspaceId: request.workspaceId,
      contexts: [mockContext],
      stats: {
        filesScanned: 1,
        contextsExtracted: 1,
        processingTimeMs: 100,
      },
    };
  }

  async getProjectStructure(rootPath: string): Promise<ProjectStructure> {
    const mockNode: DirectoryNode = {
      name: 'test',
      path: rootPath,
      children: [],
      files: ['test.ts'],
    };

    return {
      root: rootPath,
      directories: mockNode,
      fileCountByExtension: { '.ts': 1 },
      totalFiles: 1,
      totalDirectories: 1,
    };
  }

  getWorkspaceType(): WorkspaceType {
    return 'coding' as WorkspaceType;
  }
}

describe('WorkspaceManager', () => {
  let mockContextStorage: ContextStorage;
  let config: WorkspaceManagerConfig;
  let workspaceManager: MockWorkspaceManager;

  beforeEach(() => {
    // Mock ContextStorage
    mockContextStorage = {
      createContextsBatch: vi.fn().mockResolvedValue([{ id: 'context-1' }]),
    } as any;

    config = {
      contextStorage: mockContextStorage,
      enableLogging: false,
      autoIndex: false,
      reIndexInterval: 0,
    };

    workspaceManager = new MockWorkspaceManager(config);
  });

  describe('initialization', () => {
    it('should initialize workspace with metadata', async () => {
      await workspaceManager.initialize('/test/path', 'test-workspace');

      expect(workspaceManager.isInitialized()).toBe(true);
      
      const metadata = workspaceManager.getMetadata();
      expect(metadata).toBeDefined();
      expect(metadata?.id).toBe('test-workspace');
      expect(metadata?.rootPath).toBe('/test/path');
    });

    it('should not auto-index when autoIndex is false', async () => {
      const spy = vi.spyOn(workspaceManager, 'indexWorkspace');
      
      await workspaceManager.initialize('/test/path', 'test-workspace');

      expect(spy).not.toHaveBeenCalled();
    });

    it('should auto-index when autoIndex is true', async () => {
      config.autoIndex = true;
      workspaceManager = new MockWorkspaceManager(config);
      
      const spy = vi.spyOn(workspaceManager, 'indexWorkspace');
      
      await workspaceManager.initialize('/test/path', 'test-workspace');

      expect(spy).toHaveBeenCalled();
    });

    it('should throw error if already initialized', async () => {
      await workspaceManager.initialize('/test/path', 'test-workspace');

      await expect(
        workspaceManager.initialize('/test/path', 'test-workspace')
      ).rejects.toThrow('Workspace already initialized');
    });
  });

  describe('indexWorkspace', () => {
    beforeEach(async () => {
      await workspaceManager.initialize('/test/path', 'test-workspace');
    });

    it('should index workspace and store contexts', async () => {
      await workspaceManager.indexWorkspace({
        workspaceId: 'test-workspace',
      });

      expect(mockContextStorage.createContextsBatch).toHaveBeenCalled();
    });

    it('should call progress callback during indexing', async () => {
      const progressCallback = vi.fn();

      await workspaceManager.indexWorkspace(
        { workspaceId: 'test-workspace' },
        progressCallback
      );

      expect(progressCallback).toHaveBeenCalled();
      
      // Check that progress phases are reported
      const calls = progressCallback.mock.calls;
      expect(calls.some(call => call[0].phase === 'scanning')).toBe(true);
      expect(calls.some(call => call[0].phase === 'complete')).toBe(true);
    });

    it('should throw error if indexing already in progress', async () => {
      // Start indexing (don't await)
      const promise = workspaceManager.indexWorkspace({
        workspaceId: 'test-workspace',
      });

      // Try to start another indexing operation
      await expect(
        workspaceManager.indexWorkspace({
          workspaceId: 'test-workspace',
        })
      ).rejects.toThrow('Indexing already in progress');

      // Wait for first indexing to complete
      await promise;
    });

    it('should batch contexts before storing', async () => {
      await workspaceManager.indexWorkspace({
        workspaceId: 'test-workspace',
      });

      // Should be called once for single context
      expect(mockContextStorage.createContextsBatch).toHaveBeenCalledTimes(1);
      
      const call = (mockContextStorage.createContextsBatch as any).mock.calls[0][0];
      expect(Array.isArray(call)).toBe(true);
    });
  });

  describe('getMetadata', () => {
    it('should return undefined before initialization', () => {
      expect(workspaceManager.getMetadata()).toBeUndefined();
    });

    it('should return metadata after initialization', async () => {
      await workspaceManager.initialize('/test/path', 'test-workspace');

      const metadata = workspaceManager.getMetadata();
      expect(metadata).toBeDefined();
      expect(metadata?.id).toBe('test-workspace');
    });
  });

  describe('isInitialized', () => {
    it('should return false before initialization', () => {
      expect(workspaceManager.isInitialized()).toBe(false);
    });

    it('should return true after initialization', async () => {
      await workspaceManager.initialize('/test/path', 'test-workspace');

      expect(workspaceManager.isInitialized()).toBe(true);
    });
  });

  describe('configuration', () => {
    it('should use default configuration values', () => {
      const managerWithDefaults = new MockWorkspaceManager({
        contextStorage: mockContextStorage,
      });

      // Internal config should have defaults
      expect((managerWithDefaults as any).config.enableLogging).toBe(true);
      expect((managerWithDefaults as any).config.autoIndex).toBe(false);
      expect((managerWithDefaults as any).config.reIndexInterval).toBe(0);
    });

    it('should use provided configuration values', () => {
      expect((workspaceManager as any).config.enableLogging).toBe(false);
      expect((workspaceManager as any).config.autoIndex).toBe(false);
      expect((workspaceManager as any).config.reIndexInterval).toBe(0);
    });
  });
});
