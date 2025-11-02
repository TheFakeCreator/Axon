/**
 * Quality Gate Type Definitions
 * 
 * Types for test execution, linting, and quality assessment.
 */

/**
 * Test framework types
 */
export type TestFramework = 'jest' | 'vitest' | 'mocha' | 'ava' | 'tap';

/**
 * Linter types
 */
export type Linter = 'eslint' | 'tslint' | 'biome' | 'oxlint';

/**
 * Test result status
 */
export type TestStatus = 'passed' | 'failed' | 'skipped' | 'pending';

/**
 * Lint severity levels
 */
export type LintSeverity = 'error' | 'warning' | 'info';

/**
 * Individual test result
 */
export interface TestResult {
  /** Test name/description */
  name: string;
  /** Test status */
  status: TestStatus;
  /** Execution duration in ms */
  duration: number;
  /** Error message if failed */
  error?: string;
  /** Stack trace if failed */
  stackTrace?: string;
  /** File path where test is located */
  filePath?: string;
}

/**
 * Test suite result
 */
export interface TestSuiteResult {
  /** Suite name */
  name: string;
  /** Individual test results */
  tests: TestResult[];
  /** Total duration in ms */
  duration: number;
  /** File path */
  filePath: string;
}

/**
 * Overall test execution result
 */
export interface TestExecutionResult {
  /** Test framework used */
  framework: TestFramework;
  /** Total tests run */
  totalTests: number;
  /** Number of passed tests */
  passedTests: number;
  /** Number of failed tests */
  failedTests: number;
  /** Number of skipped tests */
  skippedTests: number;
  /** Test suites */
  suites: TestSuiteResult[];
  /** Total execution time in ms */
  totalDuration: number;
  /** Exit code */
  exitCode: number;
  /** Raw stdout */
  stdout?: string;
  /** Raw stderr */
  stderr?: string;
  /** Coverage summary (if available) */
  coverage?: CoverageSummary;
}

/**
 * Code coverage summary
 */
export interface CoverageSummary {
  /** Line coverage percentage */
  lines: number;
  /** Statement coverage percentage */
  statements: number;
  /** Function coverage percentage */
  functions: number;
  /** Branch coverage percentage */
  branches: number;
}

/**
 * Lint issue
 */
export interface LintIssue {
  /** File path */
  filePath: string;
  /** Line number */
  line: number;
  /** Column number */
  column: number;
  /** Severity level */
  severity: LintSeverity;
  /** Rule that was violated */
  ruleId: string;
  /** Issue message */
  message: string;
  /** Suggested fix (if available) */
  fix?: string;
}

/**
 * Linting result
 */
export interface LintingResult {
  /** Linter used */
  linter: Linter;
  /** Total files linted */
  filesLinted: number;
  /** Total issues found */
  totalIssues: number;
  /** Number of errors */
  errorCount: number;
  /** Number of warnings */
  warningCount: number;
  /** Number of info messages */
  infoCount: number;
  /** Individual lint issues */
  issues: LintIssue[];
  /** Exit code */
  exitCode: number;
  /** Execution duration in ms */
  duration: number;
  /** Files with issues */
  filesWithIssues: string[];
}

/**
 * Quality gate check type
 */
export type QualityCheckType = 'tests' | 'linting' | 'type-check' | 'security' | 'custom';

/**
 * Quality check status
 */
export type QualityCheckStatus = 'passed' | 'failed' | 'warning' | 'skipped';

/**
 * Individual quality check result
 */
export interface QualityCheckResult {
  /** Check type */
  type: QualityCheckType;
  /** Check name */
  name: string;
  /** Status */
  status: QualityCheckStatus;
  /** Score 0-100 */
  score: number;
  /** Duration in ms */
  duration: number;
  /** Detailed message */
  message: string;
  /** Test results (if type === 'tests') */
  testResults?: TestExecutionResult;
  /** Lint results (if type === 'linting') */
  lintResults?: LintingResult;
  /** Error details (if failed) */
  error?: string;
}

/**
 * Overall quality gate result
 */
export interface QualityGateResult {
  /** Overall status */
  status: QualityCheckStatus;
  /** Overall quality score 0-100 */
  overallScore: number;
  /** Individual check results */
  checks: QualityCheckResult[];
  /** Total duration in ms */
  totalDuration: number;
  /** Timestamp */
  timestamp: Date;
  /** Workspace ID (if applicable) */
  workspaceId?: string;
  /** Commit SHA (if applicable) */
  commitSha?: string;
}

/**
 * Test executor configuration
 */
export interface TestExecutorConfig {
  /** Test framework */
  framework: TestFramework;
  /** Working directory */
  workingDirectory: string;
  /** Test command (if not default) */
  command?: string;
  /** Command arguments */
  args?: string[];
  /** Timeout in ms (default: 60000) */
  timeout?: number;
  /** Environment variables */
  env?: Record<string, string>;
  /** Enable coverage collection */
  collectCoverage?: boolean;
}

/**
 * Linting service configuration
 */
export interface LintingConfig {
  /** Linter to use */
  linter: Linter;
  /** Working directory */
  workingDirectory: string;
  /** Lint command (if not default) */
  command?: string;
  /** Command arguments */
  args?: string[];
  /** Timeout in ms (default: 30000) */
  timeout?: number;
  /** Enable auto-fix */
  fix?: boolean;
  /** File patterns to lint */
  patterns?: string[];
}

/**
 * Quality gate orchestrator configuration
 */
export interface QualityGateConfig {
  /** Working directory */
  workingDirectory: string;
  /** Enable parallel execution */
  parallel?: boolean;
  /** Timeout for entire gate in ms (default: 300000) */
  timeout?: number;
  /** Minimum passing score (0-100) */
  minPassingScore?: number;
  /** Skip tests */
  skipTests?: boolean;
  /** Skip linting */
  skipLinting?: boolean;
  /** Skip type checking */
  skipTypeCheck?: boolean;
  /** Custom checks */
  customChecks?: CustomCheck[];
}

/**
 * Custom quality check
 */
export interface CustomCheck {
  /** Check name */
  name: string;
  /** Command to execute */
  command: string;
  /** Command arguments */
  args?: string[];
  /** Timeout in ms */
  timeout?: number;
  /** Success exit codes (default: [0]) */
  successCodes?: number[];
}

/**
 * Quality gate event types
 */
export type QualityGateEvent = 'start' | 'check-start' | 'check-complete' | 'complete' | 'error';

/**
 * Quality gate event callback
 */
export type QualityGateCallback = (event: QualityGateEvent, data?: any) => void;
