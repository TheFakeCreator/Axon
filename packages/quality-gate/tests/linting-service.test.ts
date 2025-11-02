import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LintingService } from '../src/linting-service.js';
import type { LintingConfig } from '../src/types.js';

// Mock execa
vi.mock('execa', () => ({
  execa: vi.fn(),
}));

const { execa } = await import('execa');
const mockedExeca = vi.mocked(execa);

describe('LintingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ESLint', () => {
    it('should parse ESLint JSON output correctly', async () => {
      const eslintOutput = JSON.stringify([
        {
          filePath: '/path/to/file1.ts',
          messages: [
            {
              line: 10,
              column: 5,
              severity: 2,
              message: 'Unexpected console statement',
              ruleId: 'no-console',
            },
            {
              line: 20,
              column: 10,
              severity: 1,
              message: 'Missing semicolon',
              ruleId: 'semi',
            },
          ],
          errorCount: 1,
          warningCount: 1,
        },
        {
          filePath: '/path/to/file2.ts',
          messages: [
            {
              line: 5,
              column: 2,
              severity: 2,
              message: 'Variable is never used',
              ruleId: 'no-unused-vars',
            },
          ],
          errorCount: 1,
          warningCount: 0,
        },
      ]);

      mockedExeca.mockResolvedValueOnce({
        stdout: eslintOutput,
        stderr: '',
        exitCode: 1,
      } as any);

      const config: LintingConfig = {
        linter: 'eslint',
        workingDirectory: '/test/dir',
      };

      const service = new LintingService(config);
      const result = await service.executeLinting();

      expect(result.linter).toBe('eslint');
      expect(result.issues).toHaveLength(3);
      expect(result.errorCount).toBe(2);
      expect(result.warningCount).toBe(1);
      expect(result.infoCount).toBe(0);
      expect(result.filesWithIssues).toEqual(['/path/to/file1.ts', '/path/to/file2.ts']);
    });

    it('should parse ESLint text output as fallback', async () => {
      const eslintTextOutput = `
/path/to/file.ts
  10:5  error    Unexpected console statement  no-console
  20:10 warning  Missing semicolon             semi

✖ 2 problems (1 error, 1 warning)
`;

      mockedExeca.mockResolvedValueOnce({
        stdout: eslintTextOutput,
        stderr: '',
        exitCode: 1,
      } as any);

      const config: LintingConfig = {
        linter: 'eslint',
        workingDirectory: '/test/dir',
      };

      const service = new LintingService(config);
      const result = await service.executeLinting();

      expect(result.linter).toBe('eslint');
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.errorCount).toBeGreaterThan(0);
    });

    it('should support auto-fix mode', async () => {
      mockedExeca.mockResolvedValueOnce({
        stdout: '[]',
        stderr: '',
        exitCode: 0,
      } as any);

      const config: LintingConfig = {
        linter: 'eslint',
        workingDirectory: '/test/dir',
        fix: true,
      };

      const service = new LintingService(config);
      await service.executeLinting();

      expect(mockedExeca).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['--fix']),
        expect.any(Object)
      );
    });

    it('should use custom file patterns', async () => {
      mockedExeca.mockResolvedValueOnce({
        stdout: '[]',
        stderr: '',
        exitCode: 0,
      } as any);

      const config: LintingConfig = {
        linter: 'eslint',
        workingDirectory: '/test/dir',
        patterns: ['src/**/*.ts', 'tests/**/*.ts'],
      };

      const service = new LintingService(config);
      await service.executeLinting();

      expect(mockedExeca).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['src/**/*.ts', 'tests/**/*.ts']),
        expect.any(Object)
      );
    });
  });

  describe('Biome', () => {
    it('should parse Biome JSON output correctly', async () => {
      const biomeOutput = JSON.stringify({
        diagnostics: [
          {
            location: {
              path: '/path/to/file.ts',
              span: {
                start: { line: 10, column: 5 },
              },
            },
            severity: 'error',
            description: 'Unexpected console statement',
            category: 'lint/suspicious/noConsoleLog',
          },
          {
            location: {
              path: '/path/to/file.ts',
              span: {
                start: { line: 20, column: 10 },
              },
            },
            severity: 'warning',
            description: 'Missing semicolon',
            category: 'lint/style/useSemicolon',
          },
        ],
      });

      mockedExeca.mockResolvedValueOnce({
        stdout: biomeOutput,
        stderr: '',
        exitCode: 1,
      } as any);

      const config: LintingConfig = {
        linter: 'biome',
        workingDirectory: '/test/dir',
      };

      const service = new LintingService(config);
      const result = await service.executeLinting();

      expect(result.linter).toBe('biome');
      expect(result.issues).toHaveLength(2);
      expect(result.errorCount).toBe(1);
      expect(result.warningCount).toBe(1);
    });

    it('should support Biome auto-fix with --apply', async () => {
      mockedExeca.mockResolvedValueOnce({
        stdout: '{"diagnostics": []}',
        stderr: '',
        exitCode: 0,
      } as any);

      const config: LintingConfig = {
        linter: 'biome',
        workingDirectory: '/test/dir',
        fix: true,
      };

      const service = new LintingService(config);
      await service.executeLinting();

      expect(mockedExeca).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['--apply']),
        expect.any(Object)
      );
    });
  });

  describe('TSLint', () => {
    it('should parse TSLint output correctly', async () => {
      const tslintOutput = `
file.ts[10, 5]: Unexpected console statement
file.ts[20, 10]: Missing semicolon

ERROR: 2 problems
`;

      mockedExeca.mockResolvedValueOnce({
        stdout: tslintOutput,
        stderr: '',
        exitCode: 2,
      } as any);

      const config: LintingConfig = {
        linter: 'tslint',
        workingDirectory: '/test/dir',
      };

      const service = new LintingService(config);
      const result = await service.executeLinting();

      expect(result.linter).toBe('tslint');
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('should support TSLint auto-fix', async () => {
      mockedExeca.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      } as any);

      const config: LintingConfig = {
        linter: 'tslint',
        workingDirectory: '/test/dir',
        fix: true,
      };

      const service = new LintingService(config);
      await service.executeLinting();

      expect(mockedExeca).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['--fix']),
        expect.any(Object)
      );
    });
  });

  describe('Oxlint', () => {
    it('should parse Oxlint output correctly', async () => {
      const oxlintOutput = JSON.stringify([
        {
          filePath: '/path/to/file.ts',
          messages: [
            {
              line: 10,
              column: 5,
              severity: 2,
              message: 'Unexpected console',
              ruleId: 'no-console',
            },
          ],
          errorCount: 1,
          warningCount: 0,
        },
      ]);

      mockedExeca.mockResolvedValueOnce({
        stdout: oxlintOutput,
        stderr: '',
        exitCode: 1,
      } as any);

      const config: LintingConfig = {
        linter: 'oxlint',
        workingDirectory: '/test/dir',
      };

      const service = new LintingService(config);
      const result = await service.executeLinting();

      expect(result.linter).toBe('oxlint');
      expect(result.issues).toHaveLength(1);
      expect(result.errorCount).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should throw on timeout errors', async () => {
      const timeoutError = new Error('Command timed out');
      (timeoutError as any).timedOut = true;

      mockedExeca.mockRejectedValueOnce(timeoutError);

      const config: LintingConfig = {
        linter: 'eslint',
        workingDirectory: '/test/dir',
        timeout: 1000,
      };

      const service = new LintingService(config);

      await expect(service.executeLinting()).rejects.toThrow(/timed out/);
    });

    it('should throw on command execution errors', async () => {
      const execError = new Error('Command not found');

      mockedExeca.mockRejectedValueOnce(execError);

      const config: LintingConfig = {
        linter: 'eslint',
        workingDirectory: '/test/dir',
      };

      const service = new LintingService(config);

      await expect(service.executeLinting()).rejects.toThrow(/failed/);
    });

    it('should handle malformed JSON gracefully', async () => {
      mockedExeca.mockResolvedValueOnce({
        stdout: 'not valid json {]',
        stderr: '',
        exitCode: 1,
      } as any);

      const config: LintingConfig = {
        linter: 'eslint',
        workingDirectory: '/test/dir',
      };

      const service = new LintingService(config);
      const result = await service.executeLinting();

      // Should fallback to text parsing
      expect(result.linter).toBe('eslint');
    });
  });

  describe('Custom Configuration', () => {
    it('should use custom command and arguments', async () => {
      mockedExeca.mockResolvedValueOnce({
        stdout: '[]',
        stderr: '',
        exitCode: 0,
      } as any);

      const config: LintingConfig = {
        linter: 'eslint',
        workingDirectory: '/test/dir',
        command: 'custom-linter',
        args: ['--custom-flag'],
      };

      const service = new LintingService(config);
      await service.executeLinting();

      expect(mockedExeca).toHaveBeenCalledWith(
        'custom-linter',
        expect.arrayContaining(['--custom-flag']),
        expect.objectContaining({
          cwd: '/test/dir',
        })
      );
    });

    it('should respect timeout configuration', async () => {
      mockedExeca.mockResolvedValueOnce({
        stdout: '[]',
        stderr: '',
        exitCode: 0,
      } as any);

      const config: LintingConfig = {
        linter: 'eslint',
        workingDirectory: '/test/dir',
        timeout: 15000,
      };

      const service = new LintingService(config);
      await service.executeLinting();

      expect(mockedExeca).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          timeout: 15000,
        })
      );
    });
  });

  describe('Severity Classification', () => {
    it('should correctly classify error severity', async () => {
      const eslintOutput = JSON.stringify([
        {
          filePath: '/test.ts',
          messages: [
            { line: 1, column: 1, severity: 2, message: 'Error', ruleId: 'rule1' },
            { line: 2, column: 1, severity: 1, message: 'Warning', ruleId: 'rule2' },
            { line: 3, column: 1, severity: 0, message: 'Info', ruleId: 'rule3' },
          ],
          errorCount: 1,
          warningCount: 2,
        },
      ]);

      mockedExeca.mockResolvedValueOnce({
        stdout: eslintOutput,
        stderr: '',
        exitCode: 1,
      } as any);

      const config: LintingConfig = {
        linter: 'eslint',
        workingDirectory: '/test/dir',
      };

      const service = new LintingService(config);
      const result = await service.executeLinting();

      const errorIssues = result.issues.filter((i) => i.severity === 'error');
      const warningIssues = result.issues.filter((i) => i.severity === 'warning');
      const infoIssues = result.issues.filter((i) => i.severity === 'info');

      expect(errorIssues.length).toBeGreaterThan(0);
      expect(warningIssues.length).toBeGreaterThan(0);
    });
  });

  describe('File Counting', () => {
    it('should count files correctly', async () => {
      const eslintOutput = JSON.stringify([
        {
          filePath: '/file1.ts',
          messages: [{ line: 1, column: 1, severity: 2, message: 'Error', ruleId: 'rule1' }],
          errorCount: 1,
          warningCount: 0,
        },
        {
          filePath: '/file2.ts',
          messages: [],
          errorCount: 0,
          warningCount: 0,
        },
        {
          filePath: '/file3.ts',
          messages: [{ line: 1, column: 1, severity: 1, message: 'Warning', ruleId: 'rule2' }],
          errorCount: 0,
          warningCount: 1,
        },
      ]);

      mockedExeca.mockResolvedValueOnce({
        stdout: eslintOutput,
        stderr: '',
        exitCode: 1,
      } as any);

      const config: LintingConfig = {
        linter: 'eslint',
        workingDirectory: '/test/dir',
      };

      const service = new LintingService(config);
      const result = await service.executeLinting();

      expect(result.filesLinted).toBe(3);
      expect(result.filesWithIssues).toHaveLength(2);
      expect(result.filesWithIssues).toEqual(['/file1.ts', '/file3.ts']);
    });
  });
});
