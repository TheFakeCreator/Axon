/**
 * Linting Service
 * 
 * Executes linters and parses results.
 */

import { execa } from 'execa';
import type {
  LintingConfig,
  LintingResult,
  LintIssue,
  Linter,
  LintSeverity,
} from './types.js';

/**
 * Linting Service
 * 
 * Runs linters and parses their output.
 */
export class LintingService {
  private config: Required<LintingConfig>;

  constructor(config: LintingConfig) {
    this.config = {
      linter: config.linter,
      workingDirectory: config.workingDirectory,
      command: config.command ?? this.getDefaultCommand(config.linter),
      args: config.args ?? this.getDefaultArgs(config.linter, config.fix, config.patterns),
      timeout: config.timeout ?? 30000, // 30 seconds default
      fix: config.fix ?? false,
      patterns: config.patterns ?? ['.'],
    };
  }

  /**
   * Execute linter
   */
  async executeLinting(): Promise<LintingResult> {
    const startTime = Date.now();

    try {
      const result = await execa(this.config.command, this.config.args, {
        cwd: this.config.workingDirectory,
        timeout: this.config.timeout,
        reject: false, // Don't throw on non-zero exit codes (linting errors)
        all: true,
      });

      const duration = Date.now() - startTime;

      // Parse results based on linter
      const parsedResult = this.parseLintOutput(
        result.stdout || '',
        result.stderr || '',
        result.exitCode || 0
      );

      return {
        ...parsedResult,
        duration,
        exitCode: result.exitCode || 0,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      // Handle timeout
      if (error.timedOut) {
        throw new Error(`Linting timed out after ${this.config.timeout}ms`);
      }

      // Handle other errors
      throw new Error(`Linting failed: ${error.message}`);
    }
  }

  /**
   * Parse lint output based on linter
   */
  private parseLintOutput(
    stdout: string,
    stderr: string,
    exitCode: number
  ): Omit<LintingResult, 'duration' | 'exitCode'> {
    switch (this.config.linter) {
      case 'eslint':
        return this.parseESLintOutput(stdout, stderr);
      case 'tslint':
        return this.parseTSLintOutput(stdout, stderr);
      case 'biome':
        return this.parseBiomeOutput(stdout, stderr);
      case 'oxlint':
        return this.parseOxlintOutput(stdout, stderr);
      default:
        return this.parseGenericLintOutput(stdout, stderr, exitCode);
    }
  }

  /**
   * Parse ESLint output (JSON format)
   */
  private parseESLintOutput(stdout: string, stderr: string): any {
    const issues: LintIssue[] = [];
    const filesWithIssues = new Set<string>();
    let errorCount = 0;
    let warningCount = 0;
    let infoCount = 0;

    try {
      // ESLint JSON format
      const results = JSON.parse(stdout);

      if (Array.isArray(results)) {
        for (const fileResult of results) {
          const filePath = fileResult.filePath || 'unknown';

          if (fileResult.messages && fileResult.messages.length > 0) {
            filesWithIssues.add(filePath);

            for (const message of fileResult.messages) {
              const severity: LintSeverity =
                message.severity === 2 ? 'error' :
                message.severity === 1 ? 'warning' : 'info';

              if (severity === 'error') errorCount++;
              else if (severity === 'warning') warningCount++;
              else infoCount++;

              issues.push({
                filePath,
                line: message.line || 0,
                column: message.column || 0,
                severity,
                ruleId: message.ruleId || 'unknown',
                message: message.message || '',
                fix: message.fix ? JSON.stringify(message.fix) : undefined,
              });
            }
          }
        }
      }
    } catch (e) {
      // Failed to parse JSON, try text format
      return this.parseESLintTextOutput(stdout);
    }

    return {
      linter: 'eslint',
      filesLinted: filesWithIssues.size,
      totalIssues: issues.length,
      errorCount,
      warningCount,
      infoCount,
      issues,
      filesWithIssues: Array.from(filesWithIssues),
    };
  }

  /**
   * Parse ESLint text output (fallback)
   */
  private parseESLintTextOutput(output: string): any {
    const issues: LintIssue[] = [];
    const filesWithIssues = new Set<string>();
    let errorCount = 0;
    let warningCount = 0;

    const lines = output.split('\n');
    let currentFile = '';

    for (const line of lines) {
      // File path line
      if (line.match(/^[/\\]/) || line.match(/^\w:/)) {
        currentFile = line.trim();
        continue;
      }

      // Issue line: "  10:5  error  Missing semicolon  semi"
      const issueMatch = line.match(/^\s*(\d+):(\d+)\s+(error|warning)\s+(.+?)\s+(\S+)$/);
      if (issueMatch && currentFile) {
        const [, line, column, severity, message, ruleId] = issueMatch;
        const severityLevel: LintSeverity = severity === 'error' ? 'error' : 'warning';

        if (severityLevel === 'error') errorCount++;
        else warningCount++;

        filesWithIssues.add(currentFile);

        issues.push({
          filePath: currentFile,
          line: parseInt(line, 10),
          column: parseInt(column, 10),
          severity: severityLevel,
          ruleId,
          message,
        });
      }
    }

    return {
      linter: 'eslint',
      filesLinted: filesWithIssues.size,
      totalIssues: issues.length,
      errorCount,
      warningCount,
      infoCount: 0,
      issues,
      filesWithIssues: Array.from(filesWithIssues),
    };
  }

  /**
   * Parse TSLint output
   */
  private parseTSLintOutput(stdout: string, stderr: string): any {
    const issues: LintIssue[] = [];
    const filesWithIssues = new Set<string>();
    let errorCount = 0;
    let warningCount = 0;

    // TSLint format: "ERROR: /path/to/file.ts:10:5 - message (rule-name)"
    const lines = stdout.split('\n');

    for (const line of lines) {
      const match = line.match(/(ERROR|WARNING):\s+(.+?):(\d+):(\d+)\s+-\s+(.+?)\s+\((.+?)\)/);
      if (match) {
        const [, severity, filePath, line, column, message, ruleId] = match;
        const severityLevel: LintSeverity = severity === 'ERROR' ? 'error' : 'warning';

        if (severityLevel === 'error') errorCount++;
        else warningCount++;

        filesWithIssues.add(filePath);

        issues.push({
          filePath,
          line: parseInt(line, 10),
          column: parseInt(column, 10),
          severity: severityLevel,
          ruleId,
          message,
        });
      }
    }

    return {
      linter: 'tslint',
      filesLinted: filesWithIssues.size,
      totalIssues: issues.length,
      errorCount,
      warningCount,
      infoCount: 0,
      issues,
      filesWithIssues: Array.from(filesWithIssues),
    };
  }

  /**
   * Parse Biome output
   */
  private parseBiomeOutput(stdout: string, stderr: string): any {
    const issues: LintIssue[] = [];
    const filesWithIssues = new Set<string>();
    let errorCount = 0;
    let warningCount = 0;

    try {
      const result = JSON.parse(stdout);

      if (result.diagnostics) {
        for (const diagnostic of result.diagnostics) {
          const filePath = diagnostic.location?.path || 'unknown';
          const severity: LintSeverity = diagnostic.severity === 'error' ? 'error' : 'warning';

          if (severity === 'error') errorCount++;
          else warningCount++;

          filesWithIssues.add(filePath);

          issues.push({
            filePath,
            line: diagnostic.location?.span?.start || 0,
            column: 0,
            severity,
            ruleId: diagnostic.category || 'unknown',
            message: diagnostic.message || '',
          });
        }
      }
    } catch (e) {
      // JSON parsing failed
    }

    return {
      linter: 'biome',
      filesLinted: filesWithIssues.size,
      totalIssues: issues.length,
      errorCount,
      warningCount,
      infoCount: 0,
      issues,
      filesWithIssues: Array.from(filesWithIssues),
    };
  }

  /**
   * Parse Oxlint output
   */
  private parseOxlintOutput(stdout: string, stderr: string): any {
    // Oxlint uses similar format to ESLint
    return this.parseESLintTextOutput(stdout);
  }

  /**
   * Parse generic lint output
   */
  private parseGenericLintOutput(stdout: string, stderr: string, exitCode: number): any {
    return {
      linter: this.config.linter,
      filesLinted: 0,
      totalIssues: exitCode === 0 ? 0 : 1,
      errorCount: exitCode === 0 ? 0 : 1,
      warningCount: 0,
      infoCount: 0,
      issues: [],
      filesWithIssues: [],
    };
  }

  /**
   * Get default command for linter
   */
  private getDefaultCommand(linter: Linter): string {
    switch (linter) {
      case 'eslint':
        return 'npx';
      case 'tslint':
        return 'npx';
      case 'biome':
        return 'npx';
      case 'oxlint':
        return 'npx';
      default:
        return 'npx';
    }
  }

  /**
   * Get default arguments for linter
   */
  private getDefaultArgs(linter: Linter, fix?: boolean, patterns?: string[]): string[] {
    const baseArgs: Record<Linter, string[]> = {
      eslint: ['eslint', '--format=json'],
      tslint: ['tslint', '--format=verbose'],
      biome: ['biome', 'check', '--reporter=json'],
      oxlint: ['oxlint'],
    };

    const args = [...baseArgs[linter]];

    if (fix) {
      if (linter === 'eslint') {
        args.push('--fix');
      } else if (linter === 'biome') {
        args.push('--apply');
      } else if (linter === 'tslint') {
        args.push('--fix');
      }
    }

    if (patterns && patterns.length > 0) {
      args.push(...patterns);
    }

    return args;
  }
}
