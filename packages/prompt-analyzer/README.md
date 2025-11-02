# @axon/prompt-analyzer

Comprehensive prompt analysis service for the Axon intelligent copilot system. Analyzes user prompts through multiple stages to extract intent, task types, entities, and detect ambiguity.

## Features

- **Intent Classification**: Categorizes prompts into Coding, PKM, or General intents
- **Task Type Identification**: Identifies 12 task categories (bug fix, feature add, refactor, etc.)
- **Entity Extraction**: Extracts 10 entity types (files, functions, classes, technologies, etc.)
- **Ambiguity Detection**: Detects 5 types of ambiguity with severity levels and suggestions
- **Metadata Extraction**: Language detection, word count, code presence, complexity analysis
- **Caching**: Built-in caching for repeated prompts with TTL and LRU eviction
- **Performance**: Optimized for <200ms latency on typical prompts

## Installation

```bash
pnpm add @axon/prompt-analyzer
```

## Quick Start

```typescript
import { PromptAnalyzer } from '@axon/prompt-analyzer';

// Initialize analyzer
const analyzer = new PromptAnalyzer();

// Analyze a prompt
const result = await analyzer.analyze(
  'Fix the bug in handleClick function that throws TypeError'
);

console.log(result.intent.category);      // 'coding'
console.log(result.taskType.primary);     // { category: 'BUG_FIX', confidence: 0.85 }
console.log(result.entities.length);      // 2 (function_name, error_message)
console.log(result.ambiguity.isAmbiguous); // false
console.log(result.metrics.processingTimeMs); // ~50ms
```

## Architecture

The PromptAnalyzer orchestrates 4 main analysis stages:

```
User Prompt
    ↓
┌───────────────────────┐
│ 1. Intent Classifier  │ → IntentResult (coding/pkm/general)
└───────────────────────┘
    ↓
┌───────────────────────┐
│ 2. Task Identifier    │ → TaskTypeResult (12 categories)
└───────────────────────┘
    ↓
┌───────────────────────┐
│ 3. Entity Extractor   │ → ExtractedEntity[] (10 types)
└───────────────────────┘
    ↓
┌───────────────────────┐
│ 4. Ambiguity Detector │ → AmbiguityResult (5 types)
└───────────────────────┘
    ↓
┌───────────────────────┐
│ 5. Metadata Extraction│ → language, complexity, word count
└───────────────────────┘
    ↓
Complete PromptAnalysis
```

## Usage

### Basic Analysis

```typescript
const analyzer = new PromptAnalyzer();

const result = await analyzer.analyze('Add user authentication to the API');

// Access results
console.log(result.intent);     // { category: 'coding', confidence: 0.9, indicators: [...] }
console.log(result.taskType);   // { primary: { category: 'FEATURE_ADD', confidence: 0.85 }, ... }
console.log(result.entities);   // [{ type: 'concept', value: 'authentication', ... }]
console.log(result.ambiguity);  // { isAmbiguous: false, overallScore: 0.8, ... }
console.log(result.metadata);   // { language: 'en', wordCount: 7, complexity: 'simple', ... }
```

### Custom Configuration

```typescript
const analyzer = new PromptAnalyzer({
  // Intent classification config
  intent: {
    minConfidence: 0.7,
    enableMultiIntent: false,
  },
  
  // Task type config
  taskType: {
    minConfidence: 0.6,
    enableMultiTask: true,
  },
  
  // Entity extraction config
  entities: {
    minConfidence: 0.7,
    maxEntitiesPerType: 5,
    enabledTypes: [
      EntityType.FILE_PATH,
      EntityType.FUNCTION_NAME,
      EntityType.CLASS_NAME,
    ],
  },
  
  // Ambiguity detection config
  ambiguity: {
    enabled: true,
    minSeverity: 'medium', // Only report medium/high severity
  },
  
  // Caching config
  caching: {
    enabled: true,
    ttlMinutes: 30,
    maxEntries: 1000,
  },
  
  // Logging config
  logging: {
    enabled: true,
    logLevel: 'info',
    includeMetrics: true,
  },
});
```

### Batch Analysis

```typescript
const prompts = [
  'Fix the login bug',
  'Add OAuth integration',
  'Refactor database queries',
];

const results = await analyzer.analyzeBatch(prompts);

results.forEach((result, i) => {
  console.log(`Prompt ${i + 1}: ${result.taskType.primary.category}`);
});
```

### Workspace Context

```typescript
const result = await analyzer.analyze(
  'Create a new note about React hooks',
  {
    workspaceType: 'pkm',  // coding | pkm | root
    sessionId: 'session-123',
    previousPrompts: ['List all notes about React'],
  }
);
```

### Custom Patterns

```typescript
import { TaskCategory, KeywordPattern } from '@axon/prompt-analyzer';

// Add custom patterns for a task type
const customPatterns: KeywordPattern[] = [
  {
    keywords: ['speedup', 'accelerate', 'make faster'],
    weight: 0.8,
  },
];

analyzer.addTaskTypePatterns(TaskCategory.OPTIMIZATION, customPatterns);

// Or use the simplified helper
analyzer.addTaskTypeKeywords(
  TaskCategory.OPTIMIZATION,
  ['boost', 'turbocharge'],
  0.7  // weight
);
```

### Cache Management

```typescript
// Get cache statistics
const stats = analyzer.getCacheStats();
console.log(`Cache size: ${stats.size}/${stats.maxSize}`);

// Clear cache
analyzer.clearCache();

// Disable caching temporarily
analyzer.updateConfig({ caching: { enabled: false } });
```

## API Reference

### PromptAnalyzer

Main orchestrator class for prompt analysis.

#### Constructor

```typescript
constructor(config?: Partial<AnalyzerConfig>)
```

#### Methods

- `analyze(prompt: string, context?: AnalysisContext): Promise<PromptAnalysis>`
  - Analyze a single prompt
  
- `analyzeBatch(prompts: string[]): Promise<PromptAnalysis[]>`
  - Analyze multiple prompts in parallel

- `addTaskTypePatterns(category: TaskCategory, patterns: KeywordPattern[]): void`
  - Add custom keyword patterns for task type detection

- `addTaskTypeKeywords(category: TaskCategory, keywords: string[], weight?: number): void`
  - Simplified helper to add keyword patterns

- `clearCache(): void`
  - Clear the analysis cache

- `getCacheStats(): CacheStats`
  - Get cache statistics (size, max size)

- `getConfig(): AnalyzerConfig`
  - Get current configuration

- `updateConfig(config: Partial<AnalyzerConfig>): void`
  - Update configuration

### Types

#### PromptAnalysis

Complete analysis result:

```typescript
interface PromptAnalysis {
  prompt: string;
  intent: IntentResult;
  taskType: TaskTypeResult;
  entities: ExtractedEntity[];
  ambiguity: AmbiguityResult;
  metadata: {
    language: string;
    wordCount: number;
    hasCodeSnippets: boolean;
    hasQuestions: boolean;
    complexity: 'simple' | 'moderate' | 'complex';
  };
  metrics: {
    processingTimeMs: number;
    timestamp: Date;
  };
}
```

#### IntentResult

```typescript
interface IntentResult {
  category: IntentCategory; // 'coding' | 'pkm' | 'general'
  confidence: ConfidenceScore; // 0-1
  indicators: string[]; // Keywords that led to classification
}
```

#### TaskTypeResult

```typescript
interface TaskTypeResult {
  primary: {
    category: TaskCategory; // Primary task type
    confidence: ConfidenceScore;
  };
  indicators: string[];
  isMultiTask: boolean;
  secondaryTasks?: Array<{
    category: TaskCategory;
    confidence: ConfidenceScore;
  }>;
}
```

#### TaskCategory

12 task categories:
- `GENERAL_QUERY`: Information requests
- `BUG_FIX`: Debugging and error fixing
- `FEATURE_ADD`: Adding new functionality
- `FEATURE_REMOVE`: Removing functionality
- `REFACTOR`: Code restructuring
- `CODE_REVIEW`: Code review requests
- `DOCUMENTATION`: Documentation tasks
- `TESTING`: Test-related tasks
- `DEPLOYMENT`: Deployment operations
- `OPTIMIZATION`: Performance optimization
- `SECURITY`: Security-related tasks
- `ROADMAP`: Planning and roadmap tasks

#### ExtractedEntity

```typescript
interface ExtractedEntity {
  type: EntityType;
  value: string;
  confidence: ConfidenceScore;
  context: string; // Surrounding text
  position?: {
    start: number;
    end: number;
  };
}
```

#### EntityType

10 entity types:
- `FILE_PATH`: File and directory paths
- `FUNCTION_NAME`: Function and method names
- `CLASS_NAME`: Class and interface names
- `VARIABLE_NAME`: Variable and constant names
- `TECHNOLOGY`: Programming languages, platforms
- `LIBRARY`: Libraries and packages
- `FRAMEWORK`: Frameworks and tools
- `CONCEPT`: Technical concepts
- `ERROR_MESSAGE`: Error types and messages
- `CODE_SNIPPET`: Code blocks and snippets

#### AmbiguityResult

```typescript
interface AmbiguityResult {
  isAmbiguous: boolean;
  overallScore: number; // Clarity score (0-1, higher is clearer)
  ambiguities: DetectedAmbiguity[];
}

interface DetectedAmbiguity {
  type: AmbiguityType;
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestion: string; // How to improve
  context: string; // Where the ambiguity occurs
}
```

#### AmbiguityType

5 ambiguity types:
- `UNDERSPECIFIED`: Missing critical information
- `VAGUE`: Too general or unclear
- `MULTIPLE_INTERPRETATIONS`: Can be understood multiple ways
- `INCOMPLETE_CONTEXT`: Missing contextual information
- `CONFLICTING_REQUIREMENTS`: Contradictory information

## Examples

### Example 1: Bug Fix Analysis

```typescript
const result = await analyzer.analyze(
  'The handleSubmit function in UserForm.tsx throws a TypeError when user.email is null'
);

// Result:
{
  intent: { category: 'coding', confidence: 0.95 },
  taskType: {
    primary: { category: 'BUG_FIX', confidence: 0.90 },
    isMultiTask: false
  },
  entities: [
    { type: 'FUNCTION_NAME', value: 'handleSubmit', confidence: 0.9 },
    { type: 'FILE_PATH', value: 'UserForm.tsx', confidence: 0.95 },
    { type: 'ERROR_MESSAGE', value: 'TypeError', confidence: 0.85 },
    { type: 'VARIABLE_NAME', value: 'user.email', confidence: 0.7 }
  ],
  ambiguity: { isAmbiguous: false, overallScore: 0.85 },
  metadata: {
    language: 'en',
    wordCount: 13,
    hasCodeSnippets: false,
    hasQuestions: false,
    complexity: 'moderate'
  }
}
```

### Example 2: Feature Addition

```typescript
const result = await analyzer.analyze(
  'Add OAuth authentication using Google and GitHub providers to the login page'
);

// Result:
{
  intent: { category: 'coding', confidence: 0.92 },
  taskType: {
    primary: { category: 'FEATURE_ADD', confidence: 0.88 },
    isMultiTask: false
  },
  entities: [
    { type: 'CONCEPT', value: 'OAuth authentication', confidence: 0.9 },
    { type: 'TECHNOLOGY', value: 'Google', confidence: 0.75 },
    { type: 'TECHNOLOGY', value: 'GitHub', confidence: 0.75 },
    { type: 'CONCEPT', value: 'login', confidence: 0.7 }
  ],
  ambiguity: { isAmbiguous: false, overallScore: 0.80 }
}
```

### Example 3: Ambiguous Request

```typescript
const result = await analyzer.analyze('Make it better');

// Result:
{
  intent: { category: 'general', confidence: 0.60 },
  taskType: {
    primary: { category: 'GENERAL_QUERY', confidence: 0.70 },
    isMultiTask: false
  },
  entities: [],
  ambiguity: {
    isAmbiguous: true,
    overallScore: 0.25,  // Low clarity
    ambiguities: [
      {
        type: 'UNDERSPECIFIED',
        severity: 'high',
        description: 'Missing critical information about what needs improvement',
        suggestion: 'Specify what you want to improve (e.g., "Make the login form faster")',
        context: 'Make it better'
      },
      {
        type: 'VAGUE',
        severity: 'high',
        description: 'Uses vague terms: better',
        suggestion: 'Be more specific about desired improvements',
        context: 'better'
      }
    ]
  }
}
```

## Performance

Target latency: **<200ms** for typical prompts

Actual performance (measured):
- Simple prompts (5-10 words): ~30-50ms
- Moderate prompts (10-30 words): ~60-120ms
- Complex prompts (50+ words, code): ~150-250ms

Cache hits: ~1-5ms

## Development

### Building

```bash
pnpm build
```

### Testing

```bash
# Run all tests
pnpm test

# Run integration tests
pnpm test prompt-analyzer.integration.test.ts

# Watch mode
pnpm test --watch
```

### Linting

```bash
pnpm lint
```

## Dependencies

### Runtime Dependencies
- **natural** (v8.1.0): NLP utilities for text processing
- **compromise** (v14.14.4): Lightweight NLP for entity extraction
- **@axon/shared**: Shared types and utilities

### Development Dependencies
- **typescript** (v5.7.2): TypeScript compiler
- **vitest** (v4.0.6): Testing framework
- **eslint** (v9.18.0): Code linting

## Architecture Patterns

### Dependency Injection
Each component (classifier, extractor, detector) is independently instantiated with its own configuration, enabling:
- Easy testing with mocks
- Component replacement
- Configuration isolation

### Caching Strategy
- **MD5 hashing** for cache keys
- **LRU eviction** when cache is full
- **TTL-based expiration** (configurable)
- **Cache statistics** for monitoring

### Logging
- Structured JSON logging
- Configurable log levels (debug, info, warn, error)
- Performance metrics included
- Integration-ready (winston, pino)

## Future Enhancements

- [ ] ML-based intent classification (beyond pattern matching)
- [ ] Multi-language support (currently English-only)
- [ ] Proper language detection library (franc, langdetect)
- [ ] Context-aware entity linking
- [ ] Confidence calibration based on feedback
- [ ] Real-time streaming analysis
- [ ] Advanced NLP with transformers (optional)
- [ ] User-specific pattern learning

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

Proprietary - Internal Axon Project

---

**Axon Prompt Analyzer** - Intelligent prompt analysis for context-aware AI assistance.
