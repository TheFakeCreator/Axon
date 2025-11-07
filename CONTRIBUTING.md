# Contributing to Axon

Thank you for your interest in contributing to Axon! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [Project Structure](#project-structure)

---

## Code of Conduct

By participating in this project, you agree to abide by our code of conduct:

- **Be Respectful**: Treat everyone with respect and kindness
- **Be Collaborative**: Work together constructively
- **Be Professional**: Keep discussions focused and productive
- **Be Inclusive**: Welcome contributors of all backgrounds and skill levels

---

## Getting Started

### Prerequisites

- **Node.js**: 20+ (LTS recommended)
- **pnpm**: 8+ (package manager)
- **MongoDB**: 6+ (local or Atlas)
- **Redis**: 7+ (local or cloud)
- **Qdrant**: Latest (vector database)
- **Git**: Latest version

### Initial Setup

1. **Fork the repository**

   Click the "Fork" button in the top right of the GitHub repository page.

2. **Clone your fork**

   ```bash
   git clone https://github.com/YOUR_USERNAME/Axon.git
   cd Axon
   ```

3. **Add upstream remote**

   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/Axon.git
   ```

4. **Install dependencies**

   ```bash
   pnpm install
   ```

5. **Set up environment variables**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

6. **Start databases** (if using Docker)

   ```bash
   docker-compose up -d mongodb redis qdrant
   ```

7. **Build all packages**

   ```bash
   pnpm build
   ```

8. **Run tests**

   ```bash
   pnpm test
   ```

9. **Start development server**

   ```bash
   pnpm dev
   ```

---

## Development Workflow

### 1. Create a Feature Branch

Always create a new branch for your changes:

```bash
git checkout -b feature/your-feature-name
```

Branch naming conventions:

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions/improvements
- `chore/` - Maintenance tasks

### 2. Make Your Changes

- Write clean, readable code
- Follow the coding standards (see below)
- Add tests for new functionality
- Update documentation as needed

### 3. Test Your Changes

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter @axon/middleware test

# Run linting
pnpm lint

# Run type checking
pnpm type-check

# Run all quality checks
pnpm quality-gate
```

### 4. Commit Your Changes

```bash
git add .
git commit -m "feat: add amazing feature"
```

See [Commit Messages](#commit-messages) for conventions.

### 5. Keep Your Branch Updated

```bash
git fetch upstream
git rebase upstream/main
```

### 6. Push to Your Fork

```bash
git push origin feature/your-feature-name
```

### 7. Create a Pull Request

Go to your fork on GitHub and click "New Pull Request".

---

## Coding Standards

### TypeScript Style

- **Strict Mode**: Always use `strict: true` in tsconfig
- **No `any`**: Avoid `any` type without justification
- **Explicit Types**: Use explicit return types for functions
- **Interfaces**: Prefer interfaces over types for object shapes
- **Naming**: PascalCase for types/interfaces, camelCase for variables/functions

**Example**:

```typescript
// ✅ Good
interface UserData {
  id: string;
  name: string;
  email: string;
}

function getUser(id: string): Promise<UserData> {
  // ...
}

// ❌ Bad
function getUser(id: any): any {
  // ...
}
```

### File Organization

- **One export per file**: Prefer single-responsibility files
- **Index files**: Use `index.ts` for barrel exports
- **Co-located tests**: Place tests in `__tests__` or `*.test.ts` alongside code

**Example Structure**:

```
src/
├── services/
│   ├── user-service.ts
│   ├── user-service.test.ts
│   └── index.ts
```

### Error Handling

- **Always handle errors**: Use try-catch or error callbacks
- **Custom errors**: Create typed error classes
- **Meaningful messages**: Provide context in error messages

**Example**:

```typescript
class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value: unknown
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

try {
  validateInput(data);
} catch (error) {
  if (error instanceof ValidationError) {
    logger.error('Validation failed', { field: error.field });
  }
  throw error;
}
```

### Logging

- **Structured logging**: Use JSON format
- **Appropriate levels**: error, warn, info, debug
- **Include context**: Request ID, user ID, workspace ID

**Example**:

```typescript
logger.info('Context retrieved', {
  requestId,
  workspaceId,
  contextCount: contexts.length,
  latency: Date.now() - startTime,
});
```

### Async/Await

- **Prefer async/await**: Over raw promises
- **Handle rejections**: Always catch errors
- **Avoid blocking**: Use parallel execution where possible

**Example**:

```typescript
// ✅ Good
async function processPrompt(prompt: string): Promise<Response> {
  try {
    const [analysis, contexts] = await Promise.all([
      analyzePrompt(prompt),
      retrieveContexts(prompt),
    ]);
    return synthesize(analysis, contexts);
  } catch (error) {
    logger.error('Processing failed', { error });
    throw error;
  }
}

// ❌ Bad
function processPrompt(prompt: string) {
  return analyzePrompt(prompt).then((analysis) =>
    retrieveContexts(prompt).then((contexts) => synthesize(analysis, contexts))
  );
}
```

---

## Testing Guidelines

### Test Structure

- **Arrange-Act-Assert**: Follow AAA pattern
- **Descriptive names**: Test names should explain what they test
- **One assertion**: Prefer one logical assertion per test
- **Isolated tests**: Tests should not depend on each other

**Example**:

```typescript
describe('ContextRetriever', () => {
  describe('retrieve', () => {
    it('should return contexts sorted by relevance score', async () => {
      // Arrange
      const query = 'fix authentication bug';
      const mockContexts = [
        { id: '1', relevanceScore: 0.8 },
        { id: '2', relevanceScore: 0.9 },
      ];

      // Act
      const result = await retriever.retrieve(query);

      // Assert
      expect(result[0].id).toBe('2'); // Highest score first
    });
  });
});
```

### Mocking

- **Mock external dependencies**: APIs, databases, LLMs
- **Use factories**: Create test data with factories
- **Realistic mocks**: Mocks should behave like real implementations

**Example**:

```typescript
vi.mock('@axon/llm-gateway', () => ({
  LLMGateway: vi.fn().mockImplementation(() => ({
    complete: vi.fn().mockResolvedValue({
      content: 'Mocked response',
      tokens: { input: 10, output: 20 },
    }),
  })),
}));
```

### Coverage Requirements

- **Critical paths**: ≥80% coverage
- **New features**: Must include tests
- **Bug fixes**: Add regression tests

---

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification:

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Test additions or fixes
- `chore`: Maintenance tasks (deps, build, etc.)
- `ci`: CI/CD changes

### Examples

```bash
feat(middleware): add streaming support for prompt processing

Implement AsyncGenerator-based streaming for real-time responses.
Includes SSE support in API gateway.

Closes #123
```

```bash
fix(context-engine): correct relevance score calculation

Previously used incorrect weight distribution in 4-factor re-ranking.
Now matches specification: 60% similarity, 20% freshness, 10% usage, 10% confidence.

Fixes #456
```

```bash
docs(architecture): add data flow diagrams

Created comprehensive diagrams for:
- Prompt processing flow
- Workspace initialization
- Context evolution
- Streaming responses
```

---

## Pull Request Process

### Before Submitting

- [ ] All tests pass (`pnpm test`)
- [ ] No linting errors (`pnpm lint`)
- [ ] Type checking passes (`pnpm type-check`)
- [ ] Code is formatted (`pnpm format`)
- [ ] Documentation updated (if applicable)
- [ ] Commit messages follow convention
- [ ] Branch is up-to-date with main

### PR Template

Use this template for your PR description:

```markdown
## Description

Brief description of the changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Related Issue

Closes #(issue number)

## Changes Made

- Change 1
- Change 2
- Change 3

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Screenshots (if applicable)

Add screenshots or GIFs

## Checklist

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests pass locally
```

### Review Process

1. **Automated Checks**: CI/CD will run tests and linting
2. **Code Review**: Maintainer will review your code
3. **Feedback**: Address any requested changes
4. **Approval**: Once approved, PR will be merged

### After Merge

- Delete your feature branch
- Pull latest changes from upstream
- Celebrate! 🎉

---

## Project Structure

```
axon/
├── packages/              # Microservices (monorepo)
│   ├── middleware/        # Core orchestration
│   ├── context-engine/    # Context management (CREE)
│   ├── prompt-analyzer/   # Prompt analysis
│   ├── llm-gateway/       # LLM abstraction
│   ├── workspace-manager/ # Workspace handling
│   ├── quality-gate/      # QA orchestration
│   └── shared/            # Common utilities
├── apps/
│   └── api/               # REST API gateway
├── docs/                  # Documentation
│   ├── architecture/      # Architecture docs
│   ├── api/               # API specifications
│   └── guides/            # User guides
├── scripts/               # Build & utility scripts
├── docker/                # Docker configurations
├── .github/               # GitHub Actions
├── turbo.json             # Turbo config
├── pnpm-workspace.yaml    # pnpm workspaces
└── package.json           # Root package
```

### Key Directories

- **`packages/*/src/`**: Service source code
- **`packages/*/tests/`**: Service tests
- **`apps/api/src/`**: API application code
- **`docs/`**: All documentation
- **`scripts/`**: Automation scripts

---

## Common Tasks

### Add a New Package

```bash
# Create package structure
mkdir -p packages/new-package/src
cd packages/new-package

# Initialize package.json
pnpm init

# Add to workspace
# Edit pnpm-workspace.yaml to include package
```

### Add a Dependency

```bash
# To workspace root
pnpm add <package> -w

# To specific package
pnpm --filter @axon/middleware add <package>

# Dev dependency
pnpm --filter @axon/middleware add -D <package>
```

### Run Specific Service

```bash
# Development mode
pnpm --filter @axon/api dev

# Build only
pnpm --filter @axon/middleware build

# Test only
pnpm --filter @axon/context-engine test
```

### Debug

```bash
# Debug specific package
node --inspect-brk node_modules/.bin/vitest packages/middleware

# VS Code launch.json example
{
  "type": "node",
  "request": "launch",
  "name": "Debug Tests",
  "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
  "args": ["packages/middleware"],
  "console": "integratedTerminal"
}
```

---

## Getting Help

- **Documentation**: Check `/docs` for guides
- **Issues**: Search existing issues or create a new one
- **Discussions**: Ask questions in GitHub Discussions
- **Discord**: Join our community (link in README)

---

## Recognition

Contributors will be recognized in:

- CONTRIBUTORS.md file
- GitHub contributors page
- Release notes (for significant contributions)

---

## License

By contributing to Axon, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing to Axon!** 🚀

Your contributions help make AI assistants more contextually intelligent.
