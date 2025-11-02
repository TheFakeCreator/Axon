/**
 * Test Executor Service
 * 
 * Executes test suites and parses results.
 */

import { execa } from 'execa';
import type {
  TestExecutorConfig,
  TestExecutionResult,
  TestFramework,
  TestSuiteResult,
  TestResult,
  TestStatus,
} from './types.js';

/**
 * Test Executor
 * 
 * Runs test suites using various testing frameworks.
 */
export class TestExecutor {
  private config: Required<TestExecutorConfig>;

  constructor(config: TestExecutorConfig) {
    this.config = {
      framework: config.framework,
      workingDirectory: config.workingDirectory,
      command: config.command ?? this.getDefaultCommand(config.framework),
      args: config.args ?? this.getDefaultArgs(config.framework, config.collectCoverage),
      timeout: config.timeout ?? 60000, // 60 seconds default
      env: config.env ?? {},
      collectCoverage: config.collectCoverage ?? false,
    };
  }

  /**
   * Execute tests
   */
  async executeTests(): Promise<TestExecutionResult> {
    const startTime = Date.now();

    try {
      const result = await execa(this.config.command, this.config.args, {
        cwd: this.config.workingDirectory,
        env: {
          ...process.env,
          ...this.config.env,
          CI: 'true', // Force CI mode for consistent output
        },
        timeout: this.config.timeout,
        reject: false, // Don't throw on non-zero exit codes
        all: true,
      });

      const duration = Date.now() - startTime;

      // Parse results based on framework
      const parsedResult = this.parseTestOutput(
        result.stdout || '',
        result.stderr || '',
        result.exitCode || 0
      );

      return {
        ...parsedResult,
        totalDuration: duration,
        exitCode: result.exitCode || 0,
        stdout: result.stdout,
        stderr: result.stderr,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      // Handle timeout
      if (error.timedOut) {
        throw new Error(`Test execution timed out after ${this.config.timeout}ms`);
      }

      // Handle other errors
      throw new Error(`Test execution failed: ${error.message}`);
    }
  }

  /**
   * Parse test output based on framework
   */
  private parseTestOutput(
    stdout: string,
    stderr: string,
    exitCode: number
  ): Omit<TestExecutionResult, 'totalDuration' | 'exitCode' | 'stdout' | 'stderr'> {
    switch (this.config.framework) {
      case 'jest':
      case 'vitest':
        return this.parseJestVitestOutput(stdout, stderr);
      case 'mocha':
        return this.parseMochaOutput(stdout, stderr);
      case 'ava':
        return this.parseAvaOutput(stdout, stderr);
      case 'tap':
        return this.parseTapOutput(stdout, stderr);
      default:
        return this.parseGenericOutput(stdout, stderr, exitCode);
    }
  }

  /**
   * Parse Jest/Vitest output
   */
  private parseJestVitestOutput(stdout: string, stderr: string): any {
    const suites: TestSuiteResult[] = [];
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;
    let skippedTests = 0;

    // Try to find test summary in output
    const summaryMatch = stdout.match(/Tests:\s+(\d+)\s+passed.*?(\d+)\s+total/);
    if (summaryMatch) {
      passedTests = parseInt(summaryMatch[1], 10);
      totalTests = parseInt(summaryMatch[2], 10);
      failedTests = totalTests - passedTests;
    }

    // Try to parse JSON output if available
    const jsonMatch = stdout.match(/\{[\s\S]*"testResults"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const jsonResult = JSON.parse(jsonMatch[0]);
        if (jsonResult.testResults) {
          for (const suite of jsonResult.testResults) {
            const tests: TestResult[] = (suite.assertionResults || []).map((test: any) => ({
              name: test.title || test.name || 'Unknown',
              status: test.status === 'passed' ? 'passed' : test.status === 'failed' ? 'failed' : 'skipped',
              duration: test.duration || 0,
              error: test.failureMessages?.[0],
              stackTrace: test.failureMessages?.join('\n'),
              filePath: suite.name,
            }));

            suites.push({
              name: suite.name || 'Unknown Suite',
              tests,
              duration: suite.perfStats?.runtime || 0,
              filePath: suite.name || '',
            });
          }

          totalTests = jsonResult.numTotalTests || 0;
          passedTests = jsonResult.numPassedTests || 0;
          failedTests = jsonResult.numFailedTests || 0;
          skippedTests = jsonResult.numPendingTests || 0;
        }
      } catch (e) {
        // JSON parsing failed, use fallback
      }
    }

    return {
      framework: this.config.framework,
      totalTests,
      passedTests,
      failedTests,
      skippedTests,
      suites,
      coverage: this.parseCoverage(stdout),
    };
  }

  /**
   * Parse Mocha output
   */
  private parseMochaOutput(stdout: string, stderr: string): any {
    const suites: TestSuiteResult[] = [];
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;
    let skippedTests = 0;

    // Parse Mocha output format
    const passMatch = stdout.match(/(\d+)\s+passing/);
    const failMatch = stdout.match(/(\d+)\s+failing/);
    const skipMatch = stdout.match(/(\d+)\s+pending/);

    if (passMatch) passedTests = parseInt(passMatch[1], 10);
    if (failMatch) failedTests = parseInt(failMatch[1], 10);
    if (skipMatch) skippedTests = parseInt(skipMatch[1], 10);

    totalTests = passedTests + failedTests + skippedTests;

    return {
      framework: 'mocha',
      totalTests,
      passedTests,
      failedTests,
      skippedTests,
      suites,
    };
  }

  /**
   * Parse AVA output
   */
  private parseAvaOutput(stdout: string, stderr: string): any {
    const suites: TestSuiteResult[] = [];
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;

    // Parse AVA output
    const passMatch = stdout.match(/(\d+)\s+passed/);
    const failMatch = stdout.match(/(\d+)\s+failed/);

    if (passMatch) passedTests = parseInt(passMatch[1], 10);
    if (failMatch) failedTests = parseInt(failMatch[1], 10);

    totalTests = passedTests + failedTests;

    return {
      framework: 'ava',
      totalTests,
      passedTests,
      failedTests,
      skippedTests: 0,
      suites,
    };
  }

  /**
   * Parse TAP output
   */
  private parseTapOutput(stdout: string, stderr: string): any {
    const suites: TestSuiteResult[] = [];
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;

    // Parse TAP format
    const lines = stdout.split('\n');
    for (const line of lines) {
      if (line.startsWith('ok ')) passedTests++;
      if (line.startsWith('not ok ')) failedTests++;
    }

    totalTests = passedTests + failedTests;

    return {
      framework: 'tap',
      totalTests,
      passedTests,
      failedTests,
      skippedTests: 0,
      suites,
    };
  }

  /**
   * Parse generic test output
   */
  private parseGenericOutput(stdout: string, stderr: string, exitCode: number): any {
    return {
      framework: this.config.framework,
      totalTests: 0,
      passedTests: exitCode === 0 ? 1 : 0,
      failedTests: exitCode === 0 ? 0 : 1,
      skippedTests: 0,
      suites: [],
    };
  }

  /**
   * Parse coverage summary from output
   */
  private parseCoverage(output: string): any {
    const coverageMatch = output.match(
      /All files.*?\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)/
    );

    if (coverageMatch) {
      return {
        statements: parseFloat(coverageMatch[1]),
        branches: parseFloat(coverageMatch[2]),
        functions: parseFloat(coverageMatch[3]),
        lines: parseFloat(coverageMatch[4]),
      };
    }

    return undefined;
  }

  /**
   * Get default command for framework
   */
  private getDefaultCommand(framework: TestFramework): string {
    switch (framework) {
      case 'jest':
        return 'npx';
      case 'vitest':
        return 'npx';
      case 'mocha':
        return 'npx';
      case 'ava':
        return 'npx';
      case 'tap':
        return 'npx';
      default:
        return 'npm';
    }
  }

  /**
   * Get default arguments for framework
   */
  private getDefaultArgs(framework: TestFramework, collectCoverage?: boolean): string[] {
    const baseArgs: Record<TestFramework, string[]> = {
      jest: ['jest', '--ci', '--json', '--testLocationInResults'],
      vitest: ['vitest', 'run', '--reporter=json'],
      mocha: ['mocha'],
      ava: ['ava'],
      tap: ['tap'],
    };

    const args = [...baseArgs[framework]];

    if (collectCoverage) {
      if (framework === 'jest' || framework === 'vitest') {
        args.push('--coverage');
      }
    }

    return args;
  }
}
