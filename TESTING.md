# Testing Guide

This project uses [Vitest](https://vitest.dev/) for unit testing on both frontend and backend with comprehensive coverage reporting.

## Quick Start

### Frontend Tests

```bash
cd frontend

# Run tests in watch mode (interactive)
npm test

# Run tests once
npm run test:run

# Run tests with coverage report
npm run test:coverage

# Open interactive test UI
npm run test:ui
```

### Backend Tests

```bash
cd backend

# Run tests in watch mode (interactive)
npm test

# Run tests once
npm run test:run

# Run tests with coverage report
npm run test:coverage

# Open interactive test UI
npm run test:ui
```

## Coverage Thresholds

Current minimum coverage thresholds:

**Frontend**: 50% for lines, functions, branches, and statements
**Backend**: 10% for lines, functions, branches, and statements

Tests will fail if coverage falls below these thresholds. These are initial thresholds that will be gradually increased as test coverage improves.

## Viewing Coverage Reports

After running tests with coverage (`npm run test:coverage`), coverage reports are generated in multiple formats:

- **Terminal**: Text summary displayed immediately
- **HTML**: Open `coverage/index.html` in a browser for detailed interactive report
- **LCOV**: `coverage/lcov.info` for CI/CD integration (e.g., Codecov)
- **JSON**: `coverage/coverage-final.json` for programmatic access

## Writing Tests

### Frontend Tests (React Components)

Example test for a React component:

```typescript
// src/components/MyComponent.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
```

### Backend Tests (Services/Functions)

Example test for a backend service:

```typescript
// src/services/myService.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { MyService } from './myService';

describe('MyService', () => {
  let service: MyService;

  beforeEach(() => {
    service = new MyService();
  });

  it('should perform operation correctly', () => {
    const result = service.doSomething('input');
    expect(result).toBe('expected output');
  });
});
```

## CI/CD Integration

### Pull Requests

When you create a pull request:
1. Tests automatically run for both frontend and backend
2. Coverage reports are generated
3. Coverage summary is posted as a PR comment
4. PRs cannot be merged if tests fail

### Deployments

Before deploying to production:
1. All tests must pass
2. Coverage thresholds must be met
3. Both frontend and backend are tested
4. Only then will the build and deploy process begin

## Test Configuration

### Frontend (vite.config.ts)

```typescript
test: {
  globals: true,
  environment: 'jsdom',
  setupFiles: './src/test/setup.ts',
  coverage: {
    provider: 'v8',
    reporter: ['text', 'json', 'html', 'lcov'],
    thresholds: {
      lines: 50,
      functions: 50,
      branches: 50,
      statements: 50,
    },
  },
}
```

### Backend (vitest.config.ts)

```typescript
test: {
  globals: true,
  environment: 'node',
  coverage: {
    provider: 'v8',
    reporter: ['text', 'json', 'html', 'lcov'],
    thresholds: {
      lines: 10,
      functions: 10,
      branches: 10,
      statements: 10,
    },
  },
}
```

## Best Practices

### ✅ Do's

- Write tests for all new features and bug fixes
- Aim for meaningful test coverage, not just hitting percentages
- Test edge cases and error conditions
- Keep tests focused and readable
- Use descriptive test names
- Mock external dependencies (API calls, databases, etc.)

### ❌ Don'ts

- Don't skip tests to meet deadlines (they save time later)
- Don't test implementation details (test behavior)
- Don't write flaky tests that pass/fail randomly
- Don't commit code without running tests locally first
- Don't lower coverage thresholds without discussion

## Available Testing Libraries

### Frontend
- **Vitest**: Test runner and assertion library
- **@testing-library/react**: React component testing utilities
- **@testing-library/user-event**: User interaction simulation
- **@testing-library/jest-dom**: Custom DOM matchers
- **jsdom**: DOM implementation for Node.js

### Backend
- **Vitest**: Test runner and assertion library
- **@vitest/coverage-v8**: Coverage reporting

## Debugging Tests

### Run specific test file
```bash
npm test -- path/to/test-file.test.ts
```

### Run tests matching pattern
```bash
npm test -- -t "test name pattern"
```

### Debug with breakpoints
1. Add `debugger` statement in your test
2. Run: `node --inspect-brk node_modules/.bin/vitest --no-coverage`
3. Open Chrome DevTools: `chrome://inspect`

### Use Vitest UI for visual debugging
```bash
npm run test:ui
```

## Continuous Improvement

We track test coverage over time. Goals:
- **Current threshold**: Frontend 50%, Backend 10%
- **Short-term target**: 60% for both
- **Long-term target**: 80%
- **Aspirational**: 90%+

Gradually increase coverage by:
1. Adding tests for untested code
2. Improving test quality
3. Regular test maintenance
4. Code reviews focusing on testability
5. Incrementally raising coverage thresholds

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library Documentation](https://testing-library.com/)
- [Kent C. Dodds Testing Blog](https://kentcdodds.com/blog?q=test)

## Getting Help

If you have questions about testing:
1. Check this guide
2. Review existing tests for examples
3. Check Vitest/Testing Library docs
4. Ask in code reviews
