import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestExecutor } from '../src/test-executor.js';
import type { TestExecutorConfig } from '../src/types.js';

// Mock execa
vi.mock('execa', () => ({
  execa: vi.fn(),
}));

const { execa } = await import('execa');
const mockedExeca = vi.mocked(execa);

describe('TestExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Jest/Vitest Framework', () => {
    it('should execute Jest tests successfully with JSON output', async () => {
      const jestOutput = JSON.stringify({
        numTotalTests: 10,
        numPassedTests: 8,
        numFailedTests: 2,
        numPendingTests: 0,
        testResults: [
          {
            name: 'test-suite-1',
            assertionResults: [
              {
                title: 'should pass test 1',
                status: 'passed',
                duration: 100,
              },
              {
                title: 'should fail test 1',
                status: 'failed',
                duration: 50,
                failureMessages: ['Expected true to be false'],
              },
            ],
          },
        ],
      });

      mockedExeca.mockResolvedValueOnce({
        stdout: jestOutput,
        stderr: '',
        exitCode: 1,
      } as any);

      const config: TestExecutorConfig = {
        framework: 'jest',
        workingDirectory: '/test/dir',
      };

      const executor = new TestExecutor(config);
      const result = await executor.executeTests();

      expect(result.framework).toBe('jest');
      expect(result.totalTests).toBe(10);
      expect(result.passedTests).toBe(8);
      expect(result.failedTests).toBe(2);
      expect(result.skippedTests).toBe(0);
      expect(result.suites).toHaveLength(1);
      expect(result.suites[0].tests).toHaveLength(2);
      expect(result.exitCode).toBe(1);
    });

    it('should parse Vitest text output when JSON parsing fails', async () => {
      const vitestTextOutput = `
 ✓ test-suite-1 (2)
   ✓ should pass test 1 100ms
   × should fail test 1 50ms

Test Files  1 passed (1)
     Tests  1 passed | 1 failed (2)
      Start at 10:00:00
      Duration  150ms
`;

      mockedExeca.mockResolvedValueOnce({
        stdout: vitestTextOutput,
        stderr: '',
        exitCode: 1,
      } as any);

      const config: TestExecutorConfig = {
        framework: 'vitest',
        workingDirectory: '/test/dir',
      };

      const executor = new TestExecutor(config);
      const result = await executor.executeTests();

      expect(result.framework).toBe('vitest');
      expect(result.totalTests).toBeGreaterThan(0);
      expect(result.exitCode).toBe(1);
    });

    it('should extract coverage from output', async () => {
      const jestOutputWithCoverage = `
{"numTotalTests": 5, "numPassedTests": 5, "numFailedTests": 0, "numPendingTests": 0, "testResults": []}

Coverage summary:
Statements   : 85.5% ( 100/117 )
Branches     : 75.2% ( 45/60 )
Functions    : 90.1% ( 25/28 )
Lines        : 88.3% ( 95/108 )
`;

      mockedExeca.mockResolvedValueOnce({
        stdout: jestOutputWithCoverage,
        stderr: '',
        exitCode: 0,
      } as any);

      const config: TestExecutorConfig = {
        framework: 'jest',
        workingDirectory: '/test/dir',
        collectCoverage: true,
      };

      const executor = new TestExecutor(config);
      const result = await executor.executeTests();

      expect(result.coverage).toBeDefined();
      expect(result.coverage?.statements).toBeCloseTo(85.5, 1);
      expect(result.coverage?.branches).toBeCloseTo(75.2, 1);
      expect(result.coverage?.functions).toBeCloseTo(90.1, 1);
      expect(result.coverage?.lines).toBeCloseTo(88.3, 1);
    });
  });

  describe('Mocha Framework', () => {
    it('should parse Mocha output correctly', async () => {
      const mochaOutput = `
  Suite 1
    ✓ should pass test 1 (100ms)
    1) should fail test 1

  Suite 2
    ✓ should pass test 2 (50ms)
    - should skip test 1


  3 passing (200ms)
  1 failing
  1 pending
`;

      mockedExeca.mockResolvedValueOnce({
        stdout: mochaOutput,
        stderr: '',
        exitCode: 1,
      } as any);

      const config: TestExecutorConfig = {
        framework: 'mocha',
        workingDirectory: '/test/dir',
      };

      const executor = new TestExecutor(config);
      const result = await executor.executeTests();

      expect(result.framework).toBe('mocha');
      expect(result.passedTests).toBe(3);
      expect(result.failedTests).toBe(1);
      expect(result.skippedTests).toBe(1);
      expect(result.totalTests).toBe(5);
    });
  });

  describe('AVA Framework', () => {
    it('should parse AVA output correctly', async () => {
      const avaOutput = `
  ✔ test 1 passed
  ✔ test 2 passed
  × test 3 failed

  2 tests passed
  1 test failed
`;

      mockedExeca.mockResolvedValueOnce({
        stdout: avaOutput,
        stderr: '',
        exitCode: 1,
      } as any);

      const config: TestExecutorConfig = {
        framework: 'ava',
        workingDirectory: '/test/dir',
      };

      const executor = new TestExecutor(config);
      const result = await executor.executeTests();

      expect(result.framework).toBe('ava');
      expect(result.passedTests).toBe(2);
      expect(result.failedTests).toBe(1);
      expect(result.totalTests).toBe(3);
    });
  });

  describe('TAP Framework', () => {
    it('should parse TAP output correctly', async () => {
      const tapOutput = `
TAP version 13
1..5
ok 1 - test 1
ok 2 - test 2
not ok 3 - test 3
  ---
  message: Expected value to be true
  ...
ok 4 - test 4 # SKIP
ok 5 - test 5
`;

      mockedExeca.mockResolvedValueOnce({
        stdout: tapOutput,
        stderr: '',
        exitCode: 1,
      } as any);

      const config: TestExecutorConfig = {
        framework: 'tap',
        workingDirectory: '/test/dir',
      };

      const executor = new TestExecutor(config);
      const result = await executor.executeTests();

      expect(result.framework).toBe('tap');
      expect(result.totalTests).toBeGreaterThan(0);
      expect(result.failedTests).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should throw on timeout errors', async () => {
      const timeoutError = new Error('Command timed out');
      (timeoutError as any).timedOut = true;

      mockedExeca.mockRejectedValueOnce(timeoutError);

      const config: TestExecutorConfig = {
        framework: 'jest',
        workingDirectory: '/test/dir',
        timeout: 1000,
      };

      const executor = new TestExecutor(config);

      await expect(executor.executeTests()).rejects.toThrow(/timed out/);
    });

    it('should throw on command execution errors', async () => {
      const execError = new Error('Command not found');

      mockedExeca.mockRejectedValueOnce(execError);

      const config: TestExecutorConfig = {
        framework: 'jest',
        workingDirectory: '/test/dir',
      };

      const executor = new TestExecutor(config);

      await expect(executor.executeTests()).rejects.toThrow(/failed/);
    });
  });

  describe('Custom Configuration', () => {
    it('should use custom command and arguments', async () => {
      mockedExeca.mockResolvedValueOnce({
        stdout: '{"numTotalTests": 1, "numPassedTests": 1, "numFailedTests": 0, "numPendingTests": 0, "testResults": []}',
        stderr: '',
        exitCode: 0,
      } as any);

      const config: TestExecutorConfig = {
        framework: 'jest',
        workingDirectory: '/test/dir',
        command: 'custom-test-runner',
        args: ['--custom-flag'],
      };

      const executor = new TestExecutor(config);
      await executor.executeTests();

      expect(mockedExeca).toHaveBeenCalledWith(
        'custom-test-runner',
        expect.arrayContaining(['--custom-flag']),
        expect.objectContaining({
          cwd: '/test/dir',
        })
      );
    });

    it('should pass environment variables', async () => {
      mockedExeca.mockResolvedValueOnce({
        stdout: '{"numTotalTests": 1, "numPassedTests": 1, "numFailedTests": 0, "numPendingTests": 0, "testResults": []}',
        stderr: '',
        exitCode: 0,
      } as any);

      const config: TestExecutorConfig = {
        framework: 'jest',
        workingDirectory: '/test/dir',
        env: {
          NODE_ENV: 'test',
          CUSTOM_VAR: 'value',
        },
      };

      const executor = new TestExecutor(config);
      await executor.executeTests();

      expect(mockedExeca).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            CI: 'true',
            NODE_ENV: 'test',
            CUSTOM_VAR: 'value',
          }),
        })
      );
    });

    it('should collect coverage when enabled', async () => {
      mockedExeca.mockResolvedValueOnce({
        stdout: '{"numTotalTests": 1, "numPassedTests": 1, "numFailedTests": 0, "numPendingTests": 0, "testResults": []}',
        stderr: '',
        exitCode: 0,
      } as any);

      const config: TestExecutorConfig = {
        framework: 'jest',
        workingDirectory: '/test/dir',
        collectCoverage: true,
      };

      const executor = new TestExecutor(config);
      await executor.executeTests();

      expect(mockedExeca).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['--coverage']),
        expect.any(Object)
      );
    });
  });

  describe('Default Commands', () => {
    it('should use correct default command for each framework', async () => {
      const frameworks: Array<'jest' | 'vitest' | 'mocha' | 'ava' | 'tap'> = [
        'jest',
        'vitest',
        'mocha',
        'ava',
        'tap',
      ];

      for (const framework of frameworks) {
        vi.clearAllMocks();

        mockedExeca.mockResolvedValueOnce({
          stdout: framework === 'jest' || framework === 'vitest' 
            ? '{"numTotalTests": 1, "numPassedTests": 1, "numFailedTests": 0, "numPendingTests": 0, "testResults": []}'
            : '1 passing',
          stderr: '',
          exitCode: 0,
        } as any);

        const config: TestExecutorConfig = {
          framework,
          workingDirectory: '/test/dir',
        };

        const executor = new TestExecutor(config);
        await executor.executeTests();

        expect(mockedExeca).toHaveBeenCalledWith(
          expect.stringContaining(framework),
          expect.any(Array),
          expect.any(Object)
        );
      }
    });
  });
});
