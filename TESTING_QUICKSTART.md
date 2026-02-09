# Testing Framework - Quick Start Guide

Get up and running with the integration testing framework in minutes.

## Prerequisites

- Node.js 20+
- npm 9+
- Git

## Installation

```bash
# Install dependencies (if not already done)
npm install
```

That's it! All testing dependencies are included in package.json.

## Running Tests

### Quick Commands

```bash
# Run all tests (unit + integration)
npm test

# Run integration tests only
npm run test:integration

# Run with coverage report
npm run test:coverage

# Run in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with UI (interactive mode)
npm run test:ui
```

### Run Specific Tests

```bash
# Run a specific test file
npm run test:integration -- tests/integration/agents/social-agent.test.ts

# Run tests matching a pattern
npm run test:integration -- -t "Social Media Agent"

# Run with verbose output
npm run test:integration -- --reporter=verbose
```

## Understanding Test Output

### Success Output
```
✓ tests/integration/agents/social-agent.test.ts (15)
  ✓ Social Media Agent Integration Tests (15)
    ✓ should fetch product catalog from database
    ✓ should generate post content using Claude API
    ...

Test Files  1 passed (1)
Tests  15 passed (15)
```

### Coverage Output
```
-----------------------|---------|----------|---------|---------|
File                   | % Stmts | % Branch | % Funcs | % Lines |
-----------------------|---------|----------|---------|---------|
All files              |   75.23 |    68.45 |   72.11 |   76.89 |
 services/agents       |   82.15 |    75.32 |   78.90 |   83.45 |
  social-agent.ts      |   85.67 |    80.21 |   82.14 |   87.32 |
  ads-agent.ts         |   78.45 |    71.23 |   75.67 |   79.58 |
-----------------------|---------|----------|---------|---------|
```

## Writing Your First Test

### 1. Create Test File

Create `tests/integration/agents/my-agent.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MyAgent } from '@/services/agents/my-agent'
import { mockSupabase } from '../../mocks/supabase'

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase)
}))

describe('My Agent Integration Tests', () => {
  let agent: MyAgent

  beforeEach(() => {
    agent = new MyAgent()
    mockSupabase._clearMockData()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should perform basic operation', async () => {
    // Arrange
    const testData = { id: 'test-1', name: 'Test' }
    mockSupabase._setMockData('my_table', [testData])

    // Act
    const result = await agent.processData()

    // Assert
    expect(result).toBeDefined()
    expect(result.success).toBe(true)
  })
})
```

### 2. Run Your Test

```bash
npm run test:integration -- tests/integration/agents/my-agent.test.ts
```

### 3. Check Coverage

```bash
npm run test:coverage
```

Open `coverage/index.html` in browser to see detailed coverage report.

## Common Test Patterns

### Testing with Mock Data

```typescript
import { testProducts } from '../../fixtures/test-data'

beforeEach(() => {
  mockSupabase._setMockData('products', testProducts)
})

it('should fetch products', async () => {
  const products = await agent.getProducts()
  expect(products.length).toBeGreaterThan(0)
})
```

### Testing API Calls

```typescript
import { mockAnthropicAPI } from '../../mocks/anthropic'

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(() => mockAnthropicAPI.createMockClient())
}))

beforeEach(() => {
  mockAnthropicAPI.setDefaultResponse('AI generated response')
})

it('should generate content with AI', async () => {
  const content = await agent.generateContent('prompt')
  expect(content).toBeDefined()
  expect(typeof content).toBe('string')
})
```

### Testing Error Handling

```typescript
it('should handle errors gracefully', async () => {
  vi.spyOn(agent, 'riskyOperation').mockRejectedValue(
    new Error('Operation failed')
  )

  await expect(agent.process()).rejects.toThrow('Operation failed')
})
```

### Testing Async Operations

```typescript
it('should complete async operation', async () => {
  const promise = agent.asyncOperation()
  
  // Wait for operation
  const result = await promise
  
  expect(result.completed).toBe(true)
})
```

## Debugging Tests

### Enable Debug Logging

```typescript
it('should debug operation', async () => {
  console.log('Starting test...')
  const result = await agent.process()
  console.log('Result:', result)
  expect(result).toBeDefined()
})
```

### Use Breakpoints

```bash
# Run with Node inspector
node --inspect-brk ./node_modules/.bin/vitest --run

# Then open chrome://inspect in Chrome
```

### Isolate Test

```typescript
// Run only this test
it.only('should run this test only', async () => {
  // test code
})

// Skip this test
it.skip('should skip this test', async () => {
  // test code
})
```

## Troubleshooting

### Test Fails: "Cannot find module"

**Solution**: Check import paths use `@/` alias
```typescript
// Good
import { Agent } from '@/services/agents/agent'

// Bad
import { Agent } from '../../../services/agents/agent'
```

### Test Fails: "Timeout of 60000ms exceeded"

**Solution**: Increase timeout for slow tests
```typescript
it('slow test', async () => {
  // test code
}, 120000) // 2 minutes
```

### Coverage Below 70%

**Solution**: Add more test cases
```typescript
describe('complete coverage', () => {
  it('should test success path', async () => { /* ... */ })
  it('should test error path', async () => { /* ... */ })
  it('should test edge cases', async () => { /* ... */ })
})
```

### Mock Not Working

**Solution**: Mock before importing
```typescript
// Correct order
vi.mock('@supabase/supabase-js')
import { Agent } from '@/services/agents/agent'

// Wrong order - mock won't work
import { Agent } from '@/services/agents/agent'
vi.mock('@supabase/supabase-js')
```

## CI/CD Integration

### GitHub Actions

Tests run automatically on:
- Every pull request
- Every push to main/develop
- Manual workflow trigger

### View Test Results

1. Go to GitHub repository
2. Click "Actions" tab
3. Select workflow run
4. View test results and coverage

### Coverage Reports

Coverage reports are:
- Posted as PR comments
- Uploaded to Codecov
- Available as artifacts (30 days)

## Best Practices

### ✅ DO

- Write descriptive test names
- Test both success and error paths
- Clean up in afterEach hooks
- Use mocks for external APIs
- Keep tests isolated and independent
- Aim for 70%+ coverage

### ❌ DON'T

- Write tests that depend on other tests
- Use real API keys in tests
- Commit coverage reports
- Skip cleanup
- Test implementation details
- Leave console.logs in tests

## Next Steps

1. ✅ Run existing tests: `npm run test:integration`
2. ✅ Check coverage: `npm run test:coverage`
3. ✅ Write your first test
4. ✅ Add test data to fixtures
5. ✅ Create custom mocks if needed
6. ✅ Review test documentation

## Resources

- **Full Documentation**: `TESTING_FRAMEWORK.md`
- **Test Structure**: `tests/README.md`
- **Database Setup**: `tests/DATABASE_SETUP.md`
- **Mock Services**: `tests/mocks/`
- **Test Fixtures**: `tests/fixtures/`
- **Example Tests**: `tests/integration/`

## Getting Help

- Check documentation in `tests/` directory
- Review existing test examples
- Ask team members
- Check Vitest documentation

---

**Happy Testing! 🧪**
