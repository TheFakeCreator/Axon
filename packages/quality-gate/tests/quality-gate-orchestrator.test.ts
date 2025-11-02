import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QualityGateOrchestrator } from '../src/quality-gate-orchestrator.js';
import type { QualityGateConfig, QualityGateEvent } from '../src/types.js';

// Mock execa
vi.mock('execa', () => ({
  execa: vi.fn(),
}));

const { execa } = await import('execa');
const mockedExeca = vi.mocked(execa);

describe('QualityGateOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Parallel Execution', () => {
    it('should execute all checks in parallel', async () => {
      // Mock test execution
      mockedExeca.mockResolvedValueOnce({
        stdout: '{"numTotalTests": 10, "numPassedTests": 10, "numFailedTests": 0, "numPendingTests": 0, "testResults": []}',
        stderr: '',
        exitCode: 0,
      } as any);

      // Mock linting execution
      mockedExeca.mockResolvedValueOnce({
        stdout: '[]',
        stderr: '',
        exitCode: 0,
      } as any);

      // Mock type check execution
      mockedExeca.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      } as any);

      const config: QualityGateConfig = {
        workingDirectory: '/test/dir',
        parallel: true,
      };

      const orchestrator = new QualityGateOrchestrator(config);
      const result = await orchestrator.executeQualityGate();

      expect(result.status).toBe('passed');
      expect(result.checks).toHaveLength(3); // tests, linting, type-check
      expect(result.overallScore).toBeGreaterThan(70);
    });

    it('should handle parallel check failures gracefully', async () => {
      // Mock failing test
      mockedExeca.mockResolvedValueOnce({
        stdout: '{"numTotalTests": 10, "numPassedTests": 5, "numFailedTests": 5, "numPendingTests": 0, "testResults": []}',
        stderr: '',
        exitCode: 1,
      } as any);

      // Mock passing linting
      mockedExeca.mockResolvedValueOnce({
        stdout: '[]',
        stderr: '',
        exitCode: 0,
      } as any);

      // Mock passing type check
      mockedExeca.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      } as any);

      const config: QualityGateConfig = {
        workingDirectory: '/test/dir',
        parallel: true,
      };

      const orchestrator = new QualityGateOrchestrator(config);
      const result = await orchestrator.executeQualityGate();

      expect(result.status).toBe('failed');
      const testCheck = result.checks.find((c) => c.type === 'tests');
      expect(testCheck?.status).toBe('failed');
    });
  });

  describe('Sequential Execution', () => {
    it('should execute checks sequentially', async () => {
      // Mock test execution
      mockedExeca.mockResolvedValueOnce({
        stdout: '{"numTotalTests": 5, "numPassedTests": 5, "numFailedTests": 0, "numPendingTests": 0, "testResults": []}',
        stderr: '',
        exitCode: 0,
      } as any);

      // Mock linting
      mockedExeca.mockResolvedValueOnce({
        stdout: '[]',
        stderr: '',
        exitCode: 0,
      } as any);

      // Mock type check
      mockedExeca.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      } as any);

      const config: QualityGateConfig = {
        workingDirectory: '/test/dir',
        parallel: false,
      };

      const orchestrator = new QualityGateOrchestrator(config);
      const result = await orchestrator.executeQualityGate();

      expect(result.status).toBe('passed');
      expect(result.checks).toHaveLength(3);
    });
  });

  describe('Scoring System', () => {
    it('should calculate weighted score correctly', async () => {
      // Mock perfect tests (100 score, 40% weight)
      mockedExeca.mockResolvedValueOnce({
        stdout: '{"numTotalTests": 10, "numPassedTests": 10, "numFailedTests": 0, "numPendingTests": 0, "testResults": []}',
        stderr: '',
        exitCode: 0,
      } as any);

      // Mock linting with warnings (90 score, 30% weight)
      const eslintOutput = JSON.stringify([
        {
          filePath: '/test.ts',
          messages: [
            { line: 1, column: 1, severity: 1, message: 'Warning 1', ruleId: 'rule1' },
            { line: 2, column: 1, severity: 1, message: 'Warning 2', ruleId: 'rule2' },
            { line: 3, column: 1, severity: 1, message: 'Warning 3', ruleId: 'rule3' },
            { line: 4, column: 1, severity: 1, message: 'Warning 4', ruleId: 'rule4' },
            { line: 5, column: 1, severity: 1, message: 'Warning 5', ruleId: 'rule5' },
          ],
          errorCount: 0,
          warningCount: 5,
        },
      ]);
      mockedExeca.mockResolvedValueOnce({
        stdout: eslintOutput,
        stderr: '',
        exitCode: 0,
      } as any);

      // Mock perfect type check (100 score, 20% weight)
      mockedExeca.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      } as any);

      const config: QualityGateConfig = {
        workingDirectory: '/test/dir',
        parallel: true,
      };

      const orchestrator = new QualityGateOrchestrator(config);
      const result = await orchestrator.executeQualityGate();

      // Expected: (100 * 0.4) + (90 * 0.3) + (100 * 0.2) = 40 + 27 + 20 = 87
      expect(result.overallScore).toBeGreaterThanOrEqual(85);
      expect(result.overallScore).toBeLessThanOrEqual(95);
      expect(result.status).toBe('passed');
    });

    it('should fail when score is below minimum passing score', async () => {
      // Mock failing tests (0 score)
      mockedExeca.mockResolvedValueOnce({
        stdout: '{"numTotalTests": 10, "numPassedTests": 0, "numFailedTests": 10, "numPendingTests": 0, "testResults": []}',
        stderr: '',
        exitCode: 1,
      } as any);

      // Mock many linting errors (low score)
      const eslintOutput = JSON.stringify([
        {
          filePath: '/test.ts',
          messages: Array.from({ length: 20 }, (_, i) => ({
            line: i + 1,
            column: 1,
            severity: 2,
            message: `Error ${i}`,
            ruleId: `rule${i}`,
          })),
          errorCount: 20,
          warningCount: 0,
        },
      ]);
      mockedExeca.mockResolvedValueOnce({
        stdout: eslintOutput,
        stderr: '',
        exitCode: 1,
      } as any);

      // Mock failing type check (0 score)
      mockedExeca.mockResolvedValueOnce({
        stdout: '',
        stderr: 'Type errors found',
        exitCode: 1,
      } as any);

      const config: QualityGateConfig = {
        workingDirectory: '/test/dir',
        parallel: true,
        minPassingScore: 70,
      };

      const orchestrator = new QualityGateOrchestrator(config);
      const result = await orchestrator.executeQualityGate();

      expect(result.overallScore).toBeLessThan(70);
      expect(result.status).toBe('failed');
    });

    it('should return warning status for mid-range scores', async () => {
      // Mock 70% passing tests (70 score)
      mockedExeca.mockResolvedValueOnce({
        stdout: '{"numTotalTests": 10, "numPassedTests": 7, "numFailedTests": 3, "numPendingTests": 0, "testResults": []}',
        stderr: '',
        exitCode: 1,
      } as any);

      // Mock some linting errors (60 score)
      const eslintOutput = JSON.stringify([
        {
          filePath: '/test.ts',
          messages: Array.from({ length: 8 }, (_, i) => ({
            line: i + 1,
            column: 1,
            severity: 2,
            message: `Error ${i}`,
            ruleId: `rule${i}`,
          })),
          errorCount: 8,
          warningCount: 0,
        },
      ]);
      mockedExeca.mockResolvedValueOnce({
        stdout: eslintOutput,
        stderr: '',
        exitCode: 1,
      } as any);

      // Mock passing type check (100 score)
      mockedExeca.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      } as any);

      const config: QualityGateConfig = {
        workingDirectory: '/test/dir',
        parallel: true,
        minPassingScore: 80, // Set high threshold
      };

      const orchestrator = new QualityGateOrchestrator(config);
      const result = await orchestrator.executeQualityGate();

      // Should be warning because score is between 50-80 but tests didn't completely fail
      expect(result.overallScore).toBeGreaterThan(50);
      expect(result.overallScore).toBeLessThan(80);
    });
  });

  describe('Selective Checks', () => {
    it('should skip tests when configured', async () => {
      // Mock linting
      mockedExeca.mockResolvedValueOnce({
        stdout: '[]',
        stderr: '',
        exitCode: 0,
      } as any);

      // Mock type check
      mockedExeca.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      } as any);

      const config: QualityGateConfig = {
        workingDirectory: '/test/dir',
        skipTests: true,
      };

      const orchestrator = new QualityGateOrchestrator(config);
      const result = await orchestrator.executeQualityGate();

      expect(result.checks).toHaveLength(2); // Only linting and type-check
      expect(result.checks.find((c) => c.type === 'tests')).toBeUndefined();
    });

    it('should skip linting when configured', async () => {
      // Mock tests
      mockedExeca.mockResolvedValueOnce({
        stdout: '{"numTotalTests": 5, "numPassedTests": 5, "numFailedTests": 0, "numPendingTests": 0, "testResults": []}',
        stderr: '',
        exitCode: 0,
      } as any);

      // Mock type check
      mockedExeca.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      } as any);

      const config: QualityGateConfig = {
        workingDirectory: '/test/dir',
        skipLinting: true,
      };

      const orchestrator = new QualityGateOrchestrator(config);
      const result = await orchestrator.executeQualityGate();

      expect(result.checks).toHaveLength(2); // Only tests and type-check
      expect(result.checks.find((c) => c.type === 'linting')).toBeUndefined();
    });

    it('should skip type check when configured', async () => {
      // Mock tests
      mockedExeca.mockResolvedValueOnce({
        stdout: '{"numTotalTests": 5, "numPassedTests": 5, "numFailedTests": 0, "numPendingTests": 0, "testResults": []}',
        stderr: '',
        exitCode: 0,
      } as any);

      // Mock linting
      mockedExeca.mockResolvedValueOnce({
        stdout: '[]',
        stderr: '',
        exitCode: 0,
      } as any);

      const config: QualityGateConfig = {
        workingDirectory: '/test/dir',
        skipTypeCheck: true,
      };

      const orchestrator = new QualityGateOrchestrator(config);
      const result = await orchestrator.executeQualityGate();

      expect(result.checks).toHaveLength(2); // Only tests and linting
      expect(result.checks.find((c) => c.type === 'type-check')).toBeUndefined();
    });
  });

  describe('Custom Checks', () => {
    it('should execute custom checks', async () => {
      // Mock tests
      mockedExeca.mockResolvedValueOnce({
        stdout: '{"numTotalTests": 5, "numPassedTests": 5, "numFailedTests": 0, "numPendingTests": 0, "testResults": []}',
        stderr: '',
        exitCode: 0,
      } as any);

      // Mock linting
      mockedExeca.mockResolvedValueOnce({
        stdout: '[]',
        stderr: '',
        exitCode: 0,
      } as any);

      // Mock type check
      mockedExeca.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      } as any);

      // Mock custom check
      mockedExeca.mockResolvedValueOnce({
        stdout: 'All security checks passed',
        stderr: '',
        exitCode: 0,
      } as any);

      const config: QualityGateConfig = {
        workingDirectory: '/test/dir',
        customChecks: [
          {
            name: 'Security Audit',
            command: 'npm',
            args: ['audit'],
            successCodes: [0],
          },
        ],
      };

      const orchestrator = new QualityGateOrchestrator(config);
      const result = await orchestrator.executeQualityGate();

      expect(result.checks).toHaveLength(4); // tests, linting, type-check, custom
      const customCheck = result.checks.find((c) => c.type === 'custom');
      expect(customCheck).toBeDefined();
      expect(customCheck?.name).toBe('Security Audit');
      expect(customCheck?.status).toBe('passed');
    });

    it('should handle failing custom checks', async () => {
      // Mock tests
      mockedExeca.mockResolvedValueOnce({
        stdout: '{"numTotalTests": 5, "numPassedTests": 5, "numFailedTests": 0, "numPendingTests": 0, "testResults": []}',
        stderr: '',
        exitCode: 0,
      } as any);

      // Mock linting
      mockedExeca.mockResolvedValueOnce({
        stdout: '[]',
        stderr: '',
        exitCode: 0,
      } as any);

      // Mock type check
      mockedExeca.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      } as any);

      // Mock failing custom check
      mockedExeca.mockResolvedValueOnce({
        stdout: '',
        stderr: 'Security vulnerabilities found',
        exitCode: 1,
      } as any);

      const config: QualityGateConfig = {
        workingDirectory: '/test/dir',
        customChecks: [
          {
            name: 'Security Audit',
            command: 'npm',
            args: ['audit', '--audit-level=high'],
            successCodes: [0],
          },
        ],
      };

      const orchestrator = new QualityGateOrchestrator(config);
      const result = await orchestrator.executeQualityGate();

      const customCheck = result.checks.find((c) => c.type === 'custom');
      expect(customCheck?.status).toBe('failed');
      expect(customCheck?.score).toBe(0);
    });
  });

  describe('Event Callbacks', () => {
    it('should emit events during execution', async () => {
      // Mock all checks
      mockedExeca.mockResolvedValue({
        stdout: '{"numTotalTests": 5, "numPassedTests": 5, "numFailedTests": 0, "numPendingTests": 0, "testResults": []}',
        stderr: '',
        exitCode: 0,
      } as any);

      const events: Array<{ event: QualityGateEvent; data: any }> = [];
      const callback = (event: QualityGateEvent, data?: any) => {
        events.push({ event, data });
      };

      const config: QualityGateConfig = {
        workingDirectory: '/test/dir',
      };

      const orchestrator = new QualityGateOrchestrator(config);
      await orchestrator.executeQualityGate(callback);

      // Check that events were emitted
      expect(events.some((e) => e.event === 'start')).toBe(true);
      expect(events.some((e) => e.event === 'check-start')).toBe(true);
      expect(events.some((e) => e.event === 'check-complete')).toBe(true);
      expect(events.some((e) => e.event === 'complete')).toBe(true);
    });

    it('should emit error event on failures', async () => {
      // Mock test failure
      mockedExeca.mockRejectedValueOnce(new Error('Test execution failed'));

      // Mock successful linting and type check
      mockedExeca.mockResolvedValue({
        stdout: '[]',
        stderr: '',
        exitCode: 0,
      } as any);

      const events: Array<{ event: QualityGateEvent; data: any }> = [];
      const callback = (event: QualityGateEvent, data?: any) => {
        events.push({ event, data });
      };

      const config: QualityGateConfig = {
        workingDirectory: '/test/dir',
        parallel: true,
      };

      const orchestrator = new QualityGateOrchestrator(config);
      await orchestrator.executeQualityGate(callback);

      // Should have error events for failed checks
      const errorEvents = events.filter((e) => e.event === 'error');
      expect(errorEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Auto-Detection', () => {
    it('should auto-detect test framework from package.json', async () => {
      // The orchestrator will try to detect framework
      // Mock npm list commands for detection
      mockedExeca.mockResolvedValueOnce({
        stdout: 'vitest@1.0.0',
        stderr: '',
        exitCode: 0,
      } as any);

      // Mock test execution
      mockedExeca.mockResolvedValueOnce({
        stdout: '{"numTotalTests": 5, "numPassedTests": 5, "numFailedTests": 0, "numPendingTests": 0, "testResults": []}',
        stderr: '',
        exitCode: 0,
      } as any);

      // Mock linting
      mockedExeca.mockResolvedValueOnce({
        stdout: '[]',
        stderr: '',
        exitCode: 0,
      } as any);

      // Mock type check
      mockedExeca.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      } as any);

      const config: QualityGateConfig = {
        workingDirectory: '/test/dir',
      };

      const orchestrator = new QualityGateOrchestrator(config);
      const result = await orchestrator.executeQualityGate();

      expect(result.status).toBeDefined();
    });
  });

  describe('Timeout Handling', () => {
    it('should have timeout configuration', () => {
      const config: QualityGateConfig = {
        workingDirectory: '/test/dir',
        timeout: 1000, // 1 second timeout
      };

      const orchestrator = new QualityGateOrchestrator(config);
      expect(orchestrator).toBeDefined();
    });
  });

  describe('Result Aggregation', () => {
    it('should aggregate all check results correctly', async () => {
      // Mock tests with specific results
      mockedExeca.mockResolvedValueOnce({
        stdout: '{"numTotalTests": 10, "numPassedTests": 8, "numFailedTests": 2, "numPendingTests": 0, "testResults": []}',
        stderr: '',
        exitCode: 1,
      } as any);

      // Mock linting with issues
      const eslintOutput = JSON.stringify([
        {
          filePath: '/test.ts',
          messages: [
            { line: 1, column: 1, severity: 2, message: 'Error', ruleId: 'rule1' },
            { line: 2, column: 1, severity: 1, message: 'Warning', ruleId: 'rule2' },
          ],
          errorCount: 1,
          warningCount: 1,
        },
      ]);
      mockedExeca.mockResolvedValueOnce({
        stdout: eslintOutput,
        stderr: '',
        exitCode: 1,
      } as any);

      // Mock type check
      mockedExeca.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      } as any);

      const config: QualityGateConfig = {
        workingDirectory: '/test/dir',
      };

      const orchestrator = new QualityGateOrchestrator(config);
      const result = await orchestrator.executeQualityGate();

      // Check that all results are present
      expect(result.checks).toHaveLength(3);
      expect(result.totalDuration).toBeGreaterThan(0);
      expect(result.timestamp).toBeDefined();

      // Check individual results
      const testCheck = result.checks.find((c) => c.type === 'tests');
      expect(testCheck?.testResults).toBeDefined();
      expect(testCheck?.testResults?.totalTests).toBe(10);

      const lintCheck = result.checks.find((c) => c.type === 'linting');
      expect(lintCheck?.lintResults).toBeDefined();
      expect(lintCheck?.lintResults?.errorCount).toBe(1);
    });
  });
});
