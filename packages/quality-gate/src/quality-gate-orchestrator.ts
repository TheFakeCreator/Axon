/**
 * Quality Gate Orchestrator
 * 
 * Coordinates and executes all quality checks.
 */

import { execa } from 'execa';
import { TestExecutor } from './test-executor.js';
import { LintingService } from './linting-service.js';
import type {
  QualityGateConfig,
  QualityGateResult,
  QualityCheckResult,
  QualityCheckStatus,
  QualityGateCallback,
  CustomCheck,
} from './types.js';

/**
 * Quality Gate Orchestrator
 * 
 * Runs multiple quality checks and aggregates results.
 */
export class QualityGateOrchestrator {
  private config: Required<QualityGateConfig>;

  constructor(config: QualityGateConfig) {
    this.config = {
      workingDirectory: config.workingDirectory,
      parallel: config.parallel ?? true,
      timeout: config.timeout ?? 300000, // 5 minutes default
      minPassingScore: config.minPassingScore ?? 70,
      skipTests: config.skipTests ?? false,
      skipLinting: config.skipLinting ?? false,
      skipTypeCheck: config.skipTypeCheck ?? false,
      customChecks: config.customChecks ?? [],
    };
  }

  /**
   * Execute all quality gates
   */
  async executeQualityGate(callback?: QualityGateCallback): Promise<QualityGateResult> {
    const startTime = Date.now();
    const checks: QualityCheckResult[] = [];

    callback?.('start', { timestamp: new Date() });

    try {
      if (this.config.parallel) {
        // Run checks in parallel
        const checkPromises: Promise<QualityCheckResult>[] = [];

        if (!this.config.skipTests) {
          checkPromises.push(this.runTestCheck(callback));
        }

        if (!this.config.skipLinting) {
          checkPromises.push(this.runLintCheck(callback));
        }

        if (!this.config.skipTypeCheck) {
          checkPromises.push(this.runTypeCheck(callback));
        }

        for (const customCheck of this.config.customChecks) {
          checkPromises.push(this.runCustomCheck(customCheck, callback));
        }

        // Wait for all checks with timeout
        const results = await Promise.allSettled(checkPromises);

        for (const result of results) {
          if (result.status === 'fulfilled') {
            checks.push(result.value);
          } else {
            // Check failed with error
            checks.push({
              type: 'custom',
              name: 'Unknown Check',
              status: 'failed',
              score: 0,
              duration: 0,
              message: result.reason?.message || 'Check failed',
              error: result.reason?.message,
            });
          }
        }
      } else {
        // Run checks sequentially
        if (!this.config.skipTests) {
          checks.push(await this.runTestCheck(callback));
        }

        if (!this.config.skipLinting) {
          checks.push(await this.runLintCheck(callback));
        }

        if (!this.config.skipTypeCheck) {
          checks.push(await this.runTypeCheck(callback));
        }

        for (const customCheck of this.config.customChecks) {
          checks.push(await this.runCustomCheck(customCheck, callback));
        }
      }

      const totalDuration = Date.now() - startTime;

      // Calculate overall score and status
      const overallScore = this.calculateOverallScore(checks);
      const status = this.determineOverallStatus(checks, overallScore);

      const result: QualityGateResult = {
        status,
        overallScore,
        checks,
        totalDuration,
        timestamp: new Date(),
      };

      callback?.('complete', result);

      return result;
    } catch (error: any) {
      callback?.('error', { error: error.message });
      throw error;
    }
  }

  /**
   * Run test check
   */
  private async runTestCheck(callback?: QualityGateCallback): Promise<QualityCheckResult> {
    callback?.('check-start', { name: 'Tests' });

    const startTime = Date.now();

    try {
      // Auto-detect test framework
      const framework = await this.detectTestFramework();

      if (!framework) {
        return {
          type: 'tests',
          name: 'Tests',
          status: 'skipped',
          score: 0,
          duration: 0,
          message: 'No test framework detected',
        };
      }

      const testExecutor = new TestExecutor({
        framework,
        workingDirectory: this.config.workingDirectory,
        collectCoverage: true,
      });

      const result = await testExecutor.executeTests();
      const duration = Date.now() - startTime;

      // Calculate score based on pass rate
      const passRate = result.totalTests > 0
        ? (result.passedTests / result.totalTests) * 100
        : 0;

      const status: QualityCheckStatus =
        result.failedTests === 0 ? 'passed' :
        passRate >= 50 ? 'warning' : 'failed';

      const check: QualityCheckResult = {
        type: 'tests',
        name: 'Tests',
        status,
        score: Math.round(passRate),
        duration,
        message: `${result.passedTests}/${result.totalTests} tests passed`,
        testResults: result,
      };

      callback?.('check-complete', check);

      return check;
    } catch (error: any) {
      const duration = Date.now() - startTime;

      const check: QualityCheckResult = {
        type: 'tests',
        name: 'Tests',
        status: 'failed',
        score: 0,
        duration,
        message: 'Test execution failed',
        error: error.message,
      };

      callback?.('check-complete', check);

      return check;
    }
  }

  /**
   * Run lint check
   */
  private async runLintCheck(callback?: QualityGateCallback): Promise<QualityCheckResult> {
    callback?.('check-start', { name: 'Linting' });

    const startTime = Date.now();

    try {
      // Auto-detect linter
      const linter = await this.detectLinter();

      if (!linter) {
        return {
          type: 'linting',
          name: 'Linting',
          status: 'skipped',
          score: 0,
          duration: 0,
          message: 'No linter detected',
        };
      }

      const lintingService = new LintingService({
        linter,
        workingDirectory: this.config.workingDirectory,
      });

      const result = await lintingService.executeLinting();
      const duration = Date.now() - startTime;

      // Calculate score (penalize errors more than warnings)
      const errorPenalty = result.errorCount * 5;
      const warningPenalty = result.warningCount * 2;
      const totalPenalty = errorPenalty + warningPenalty;
      const score = Math.max(0, 100 - totalPenalty);

      const status: QualityCheckStatus =
        result.errorCount === 0 && result.warningCount === 0 ? 'passed' :
        result.errorCount === 0 ? 'warning' : 'failed';

      const check: QualityCheckResult = {
        type: 'linting',
        name: 'Linting',
        status,
        score: Math.round(score),
        duration,
        message: `${result.errorCount} errors, ${result.warningCount} warnings`,
        lintResults: result,
      };

      callback?.('check-complete', check);

      return check;
    } catch (error: any) {
      const duration = Date.now() - startTime;

      const check: QualityCheckResult = {
        type: 'linting',
        name: 'Linting',
        status: 'failed',
        score: 0,
        duration,
        message: 'Linting failed',
        error: error.message,
      };

      callback?.('check-complete', check);

      return check;
    }
  }

  /**
   * Run type check
   */
  private async runTypeCheck(callback?: QualityGateCallback): Promise<QualityCheckResult> {
    callback?.('check-start', { name: 'Type Check' });

    const startTime = Date.now();

    try {
      // Run TypeScript compiler
      const result = await execa('npx', ['tsc', '--noEmit'], {
        cwd: this.config.workingDirectory,
        timeout: 60000,
        reject: false,
      });

      const duration = Date.now() - startTime;

      const status: QualityCheckStatus = result.exitCode === 0 ? 'passed' : 'failed';
      const score = result.exitCode === 0 ? 100 : 0;

      const errorCount = (result.stdout?.match(/error TS/g) || []).length;

      const check: QualityCheckResult = {
        type: 'type-check',
        name: 'Type Check',
        status,
        score,
        duration,
        message: result.exitCode === 0
          ? 'No type errors found'
          : `${errorCount} type errors found`,
        error: result.exitCode !== 0 ? result.stdout : undefined,
      };

      callback?.('check-complete', check);

      return check;
    } catch (error: any) {
      const duration = Date.now() - startTime;

      const check: QualityCheckResult = {
        type: 'type-check',
        name: 'Type Check',
        status: 'failed',
        score: 0,
        duration,
        message: 'Type check failed',
        error: error.message,
      };

      callback?.('check-complete', check);

      return check;
    }
  }

  /**
   * Run custom check
   */
  private async runCustomCheck(
    customCheck: CustomCheck,
    callback?: QualityGateCallback
  ): Promise<QualityCheckResult> {
    callback?.('check-start', { name: customCheck.name });

    const startTime = Date.now();

    try {
      const result = await execa(customCheck.command, customCheck.args || [], {
        cwd: this.config.workingDirectory,
        timeout: customCheck.timeout || 30000,
        reject: false,
      });

      const duration = Date.now() - startTime;

      const successCodes = customCheck.successCodes || [0];
      const passed = successCodes.includes(result.exitCode || 0);

      const check: QualityCheckResult = {
        type: 'custom',
        name: customCheck.name,
        status: passed ? 'passed' : 'failed',
        score: passed ? 100 : 0,
        duration,
        message: passed ? 'Check passed' : 'Check failed',
        error: passed ? undefined : result.stderr || result.stdout,
      };

      callback?.('check-complete', check);

      return check;
    } catch (error: any) {
      const duration = Date.now() - startTime;

      const check: QualityCheckResult = {
        type: 'custom',
        name: customCheck.name,
        status: 'failed',
        score: 0,
        duration,
        message: 'Custom check failed',
        error: error.message,
      };

      callback?.('check-complete', check);

      return check;
    }
  }

  /**
   * Calculate overall score
   */
  private calculateOverallScore(checks: QualityCheckResult[]): number {
    if (checks.length === 0) return 0;

    // Weighted average
    const weights: Record<string, number> = {
      tests: 0.4,
      linting: 0.3,
      'type-check': 0.2,
      custom: 0.1,
    };

    let totalScore = 0;
    let totalWeight = 0;

    for (const check of checks) {
      if (check.status !== 'skipped') {
        const weight = weights[check.type] || 0.1;
        totalScore += check.score * weight;
        totalWeight += weight;
      }
    }

    return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
  }

  /**
   * Determine overall status
   */
  private determineOverallStatus(
    checks: QualityCheckResult[],
    overallScore: number
  ): QualityCheckStatus {
    // If any check failed critically, overall is failed
    const hasCriticalFailure = checks.some(
      c => c.status === 'failed' && c.type === 'tests'
    );

    if (hasCriticalFailure) {
      return 'failed';
    }

    // Based on score
    if (overallScore >= this.config.minPassingScore) {
      return 'passed';
    } else if (overallScore >= 50) {
      return 'warning';
    } else {
      return 'failed';
    }
  }

  /**
   * Auto-detect test framework
   */
  private async detectTestFramework() {
    const { execa } = await import('execa');

    try {
      // Check for Jest
      const jestResult = await execa('npm', ['list', 'jest'], {
        cwd: this.config.workingDirectory,
        reject: false,
      });
      if (jestResult.exitCode === 0) return 'jest';
    } catch (e) {}

    try {
      // Check for Vitest
      const vitestResult = await execa('npm', ['list', 'vitest'], {
        cwd: this.config.workingDirectory,
        reject: false,
      });
      if (vitestResult.exitCode === 0) return 'vitest';
    } catch (e) {}

    return undefined;
  }

  /**
   * Auto-detect linter
   */
  private async detectLinter() {
    const { execa } = await import('execa');

    try {
      // Check for ESLint
      const eslintResult = await execa('npm', ['list', 'eslint'], {
        cwd: this.config.workingDirectory,
        reject: false,
      });
      if (eslintResult.exitCode === 0) return 'eslint';
    } catch (e) {}

    try {
      // Check for Biome
      const biomeResult = await execa('npm', ['list', '@biomejs/biome'], {
        cwd: this.config.workingDirectory,
        reject: false,
      });
      if (biomeResult.exitCode === 0) return 'biome';
    } catch (e) {}

    return undefined;
  }
}
