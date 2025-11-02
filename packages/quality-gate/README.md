# @axon/quality-gate

Quality assurance services for automated testing, linting, and code quality checks.

## Overview

The Quality Gate package provides automated quality checks for code projects:

- **Test Execution**: Run tests with various frameworks (Jest, Vitest, Mocha, AVA, TAP)
- **Linting**: Execute linters (ESLint, TSLint, Biome, Oxlint) and parse results
- **Type Checking**: Run TypeScript compiler checks
- **Custom Checks**: Execute custom quality validation commands
- **Orchestration**: Coordinate multiple quality checks in parallel or sequentially

## Installation

```bash
pnpm add @axon/quality-gate
```

## Usage

### Test Execution

```typescript
import { TestExecutor } from '@axon/quality-gate';

// Create test executor
const testExecutor = new TestExecutor({
  framework: 'vitest',
  workingDirectory: '/path/to/project',
  collectCoverage: true,
  timeout: 60000, // 60 seconds
});

// Execute tests
const result = await testExecutor.executeTests();

console.log(`Tests: ${result.passedTests}/${result.totalTests} passed`);
console.log(`Coverage: ${result.coverage?.lines}% lines`);
console.log(`Duration: ${result.totalDuration}ms`);

// Check individual test results
for (const suite of result.suites) {
  console.log(`\nSuite: ${suite.name}`);
  for (const test of suite.tests) {
    console.log(`  ${test.status}: ${test.name} (${test.duration}ms)`);
    if (test.error) {
      console.log(`    Error: ${test.error}`);
    }
  }
}
```

### Linting

```typescript
import { LintingService } from '@axon/quality-gate';

// Create linting service
const linter = new LintingService({
  linter: 'eslint',
  workingDirectory: '/path/to/project',
  patterns: ['src/**/*.ts'],
  fix: false, // Set to true to auto-fix issues
});

// Execute linting
const result = await linter.executeLinting();

console.log(`Linting: ${result.errorCount} errors, ${result.warningCount} warnings`);
console.log(`Files: ${result.filesLinted} linted`);

// Check issues
for (const issue of result.issues) {
  console.log(
    `${issue.severity}: ${issue.filePath}:${issue.line}:${issue.column}`,
    `- ${issue.message} (${issue.ruleId})`
  );
}
```

### Quality Gate Orchestrator

```typescript
import { QualityGateOrchestrator } from '@axon/quality-gate';

// Create orchestrator
const qualityGate = new QualityGateOrchestrator({
  workingDirectory: '/path/to/project',
  parallel: true, // Run checks in parallel
  minPassingScore: 70, // Minimum score to pass
  skipTests: false,
  skipLinting: false,
  skipTypeCheck: false,
  customChecks: [
    {
      name: 'Security Audit',
      command: 'npm',
      args: ['audit', '--audit-level=moderate'],
      successCodes: [0],
    },
  ],
});

// Execute all quality checks with progress callback
const result = await qualityGate.executeQualityGate((event, data) => {
  if (event === 'check-start') {
    console.log(`Starting check: ${data.name}`);
  } else if (event === 'check-complete') {
    console.log(`Completed: ${data.name} - ${data.status} (${data.score}/100)`);
  }
});

console.log(`\nOverall Status: ${result.status}`);
console.log(`Overall Score: ${result.overallScore}/100`);
console.log(`Total Duration: ${result.totalDuration}ms`);

// Check individual results
for (const check of result.checks) {
  console.log(`\n${check.name}:`);
  console.log(`  Status: ${check.status}`);
  console.log(`  Score: ${check.score}/100`);
  console.log(`  Duration: ${check.duration}ms`);
  console.log(`  Message: ${check.message}`);

  if (check.testResults) {
    console.log(`  Tests: ${check.testResults.passedTests}/${check.testResults.totalTests}`);
  }

  if (check.lintResults) {
    console.log(`  Errors: ${check.lintResults.errorCount}`);
    console.log(`  Warnings: ${check.lintResults.warningCount}`);
  }
}

// Determine if quality gate passed
if (result.status === 'passed') {
  console.log('\n✅ Quality gate PASSED');
  process.exit(0);
} else {
  console.log('\n❌ Quality gate FAILED');
  process.exit(1);
}
```

## Supported Frameworks

### Test Frameworks

- **Jest**: `framework: 'jest'`
- **Vitest**: `framework: 'vitest'`
- **Mocha**: `framework: 'mocha'`
- **AVA**: `framework: 'ava'`
- **TAP**: `framework: 'tap'`

### Linters

- **ESLint**: `linter: 'eslint'` (with JSON output support)
- **TSLint**: `linter: 'tslint'` (legacy)
- **Biome**: `linter: 'biome'`
- **Oxlint**: `linter: 'oxlint'`

## API Reference

### TestExecutor

#### Configuration

```typescript
interface TestExecutorConfig {
  framework: TestFramework;
  workingDirectory: string;
  command?: string; // Override default command
  args?: string[]; // Custom arguments
  timeout?: number; // Default: 60000ms
  env?: Record<string, string>; // Environment variables
  collectCoverage?: boolean; // Default: false
}
```

#### Methods

- `executeTests(): Promise<TestExecutionResult>` - Run tests and return results

### LintingService

#### Configuration

```typescript
interface LintingConfig {
  linter: Linter;
  workingDirectory: string;
  command?: string; // Override default command
  args?: string[]; // Custom arguments
  timeout?: number; // Default: 30000ms
  fix?: boolean; // Enable auto-fix
  patterns?: string[]; // File patterns to lint
}
```

#### Methods

- `executeLinting(): Promise<LintingResult>` - Execute linter and return results

### QualityGateOrchestrator

#### Configuration

```typescript
interface QualityGateConfig {
  workingDirectory: string;
  parallel?: boolean; // Run checks in parallel (default: true)
  timeout?: number; // Total timeout (default: 300000ms)
  minPassingScore?: number; // Minimum score 0-100 (default: 70)
  skipTests?: boolean;
  skipLinting?: boolean;
  skipTypeCheck?: boolean;
  customChecks?: CustomCheck[];
}
```

#### Methods

- `executeQualityGate(callback?: QualityGateCallback): Promise<QualityGateResult>` - Execute all checks

#### Events

```typescript
type QualityGateEvent =
  | 'start' // Quality gate started
  | 'check-start' // Individual check started
  | 'check-complete' // Individual check completed
  | 'complete' // All checks completed
  | 'error'; // Error occurred
```

## Auto-Detection

The Quality Gate Orchestrator automatically detects:

- **Test Framework**: Checks `package.json` for jest, vitest, mocha, etc.
- **Linter**: Checks for eslint, biome, etc. in dependencies

If you have custom setups, you can manually specify the framework/linter in the configuration.

## Scoring System

### Individual Checks

- **Tests**: `(passedTests / totalTests) * 100`
- **Linting**: `max(0, 100 - (errorCount * 5) - (warningCount * 2))`
- **Type Check**: `100` if passed, `0` if failed
- **Custom**: `100` if success code, `0` otherwise

### Overall Score

Weighted average of all non-skipped checks:

- Tests: 40%
- Linting: 30%
- Type Check: 20%
- Custom: 10%

### Status Determination

- **passed**: Score ≥ minPassingScore (default 70) and no critical failures
- **warning**: Score ≥ 50 but < minPassingScore
- **failed**: Score < 50 or critical test failures
- **skipped**: Check was not executed

## Custom Checks

Add custom quality checks for security audits, performance tests, etc.:

```typescript
const customChecks = [
  {
    name: 'Security Audit',
    command: 'npm',
    args: ['audit', '--audit-level=high'],
    timeout: 30000,
    successCodes: [0], // Exit codes that indicate success
  },
  {
    name: 'Bundle Size Check',
    command: 'npx',
    args: ['bundlesize'],
    timeout: 60000,
  },
  {
    name: 'License Check',
    command: 'npx',
    args: ['license-checker', '--failOn', 'GPL'],
    timeout: 30000,
  },
];
```

## Integration with CI/CD

### GitHub Actions

```yaml
name: Quality Gate

on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'
      
      - run: pnpm install
      - run: pnpm quality-gate
      
      - name: Upload Results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: quality-gate-results
          path: quality-results.json
```

### Pre-Commit Hook

```typescript
// scripts/pre-commit.ts
import { QualityGateOrchestrator } from '@axon/quality-gate';

const qualityGate = new QualityGateOrchestrator({
  workingDirectory: process.cwd(),
  parallel: true,
  skipTests: true, // Skip slow tests on pre-commit
  minPassingScore: 80,
});

const result = await qualityGate.executeQualityGate();

if (result.status !== 'passed') {
  console.error('❌ Quality gate failed - commit blocked');
  process.exit(1);
}
```

## Performance

### Typical Execution Times

- **Test Execution**: 5-60s (depends on test suite size)
- **Linting**: 2-10s (depends on file count)
- **Type Checking**: 3-15s (depends on project size)
- **Overall (Parallel)**: ~max(individual checks) + overhead (~1s)
- **Overall (Sequential)**: ~sum(individual checks)

### Optimization Tips

1. **Use Parallel Mode**: Enable `parallel: true` for faster execution
2. **Skip Heavy Checks**: Use `skipTests` on pre-commit, run full suite in CI
3. **Selective Linting**: Use `patterns` to lint only changed files
4. **Adjust Timeouts**: Set appropriate timeouts for your project size
5. **Cache Dependencies**: Ensure test frameworks and linters are cached

## Error Handling

```typescript
try {
  const result = await qualityGate.executeQualityGate();
  
  if (result.status === 'failed') {
    // Quality checks failed, but execution completed
    for (const check of result.checks) {
      if (check.status === 'failed') {
        console.error(`❌ ${check.name}: ${check.message}`);
        if (check.error) {
          console.error(check.error);
        }
      }
    }
  }
} catch (error) {
  // Execution error (timeout, command not found, etc.)
  console.error('Quality gate execution failed:', error.message);
  process.exit(1);
}
```

## Best Practices

1. **Use in CI/CD**: Run full quality gate on every push
2. **Pre-Commit Checks**: Run linting and type-checking before commit
3. **Parallel Execution**: Enable parallel mode for faster feedback
4. **Adjust Thresholds**: Set `minPassingScore` based on your quality standards
5. **Custom Checks**: Add project-specific quality requirements
6. **Monitor Trends**: Track scores over time to identify quality degradation
7. **Fix Auto-Fixable Issues**: Enable `fix: true` for linting in development

## Roadmap

### Current (Phase 1) ✅
- [x] Test execution (Jest, Vitest, Mocha, AVA, TAP)
- [x] Linting (ESLint, Biome, Oxlint, TSLint)
- [x] Type checking (TypeScript)
- [x] Custom checks
- [x] Parallel execution
- [x] Scoring and status determination
- [x] Progress callbacks

### Future (Phase 2)
- [ ] Code coverage thresholds
- [ ] Performance regression detection
- [ ] Security vulnerability scanning
- [ ] Complexity analysis
- [ ] Dead code detection
- [ ] Dependency health checks
- [ ] Report generation (HTML, JSON, XML)
- [ ] Historical trend analysis
- [ ] Integration with quality platforms (SonarQube, Code Climate)

## Contributing

Contributions are welcome! Please see the main Axon repository for contribution guidelines.

## License

MIT
