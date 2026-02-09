# Integration Testing Framework

Comprehensive integration testing framework for the Agent Orchestration System using Vitest.

## Overview

This testing framework provides end-to-end integration tests for all agents and workflows, including:

- **Social Media Agent**: Post creation, scheduling, and visual content generation
- **Google Ads Agent**: Campaign monitoring, performance analysis, and bid adjustments
- **SEO Agent**: OpenCart product audits and automated SEO fixes
- **Marketing Agent**: Business verification, reseller management, and influencer outreach
- **Orchestrator**: Agent coordination, token budgeting, and conflict detection
- **NotebookLM Integration**: Visual content generation and artifact management
- **Visual Content Automation**: Automated workflows for social visuals and newsletters

## Structure

```
tests/
├── integration/          # Integration test suites
│   ├── agents/          # Agent-specific tests
│   │   ├── social-agent.test.ts
│   │   ├── ads-agent.test.ts
│   │   ├── seo-agent.test.ts
│   │   └── marketing-agent.test.ts
│   ├── orchestrator/    # Orchestrator coordination tests
│   │   └── orchestrator.test.ts
│   ├── integrations/    # External service integration tests
│   │   └── notebooklm.test.ts
│   └── workflows/       # Automated workflow tests
│       └── visual-content-automation.test.ts
├── mocks/               # Mock services for external APIs
│   ├── supabase.ts      # Supabase client mock
│   ├── gmail-api.ts     # Gmail API mock
│   ├── google-apis.ts   # Google Ads/Places/YouTube mocks
│   ├── anthropic.ts     # Anthropic Claude API mock
│   ├── mysql.ts         # MySQL OpenCart database mock
│   └── notebooklm.ts    # NotebookLM service mock
├── fixtures/            # Test data fixtures
│   ├── test-data.ts     # Common test data
│   ├── gmail-data.ts    # Gmail message fixtures
│   ├── google-ads-data.ts # Google Ads campaign fixtures
│   └── opencart-data.ts # OpenCart product fixtures
├── helpers/             # Test utilities
│   └── database.ts      # Database setup/teardown
├── setup.ts             # Unit test setup
└── setup.integration.ts # Integration test setup
```

## Running Tests

### All Tests
```bash
npm test
```

### Integration Tests Only
```bash
npm run test:integration
```

### Watch Mode
```bash
npm run test:integration:watch
```

### With Coverage
```bash
npm run test:coverage
```

### UI Mode
```bash
npm run test:ui
```

## Configuration

### Vitest Configuration

**Unit Tests**: `vitest.config.ts`
- Fast, isolated tests
- Mocked external dependencies
- 30-second timeout

**Integration Tests**: `vitest.config.integration.ts`
- Longer-running tests
- Real or test database connections
- 60-second timeout
- Single-threaded execution

### Coverage Thresholds

Minimum coverage: **70%** for:
- Lines
- Functions
- Branches
- Statements

Coverage is enforced in CI/CD pipeline and will fail the build if thresholds are not met.

## Mock Services

### Supabase Mock
Simulates Supabase client with in-memory data storage:
```typescript
import { mockSupabase } from './mocks/supabase'

mockSupabase._setMockData('social_posts', [/* test data */])
const posts = mockSupabase._getMockData('social_posts')
mockSupabase._clearMockData()
```

### Gmail API Mock
Simulates Gmail API operations:
```typescript
import { mockGmailAPI } from './mocks/gmail-api'

mockGmailAPI.setMessages([/* mock messages */])
const client = mockGmailAPI.createMockClient()
```

### Google Ads API Mock
Simulates Google Ads queries and campaign updates:
```typescript
import { mockGoogleAdsAPI } from './mocks/google-apis'

mockGoogleAdsAPI.setQueryResults([/* campaign data */])
const client = mockGoogleAdsAPI.createMockClient()
```

### Anthropic API Mock
Simulates Claude AI responses:
```typescript
import { mockAnthropicAPI } from './mocks/anthropic'

mockAnthropicAPI.setDefaultResponse('AI generated content')
const client = mockAnthropicAPI.createMockClient()
```

### MySQL Mock
Simulates OpenCart database:
```typescript
import { createMockMySQLConnection } from './mocks/mysql'

const connection = createMockMySQLConnection()
connection.setTableData('oc_product', [/* products */])
```

### NotebookLM Mock
Simulates NotebookLM service:
```typescript
import { mockNotebookLM } from './mocks/notebooklm'

const notebook = await mockNotebookLM.createNotebook('Title', 'Purpose')
await mockNotebookLM.addSources(notebook.notebookId, sources)
```

## Test Data Fixtures

All test data is centralized in `fixtures/` directory:

- **test-data.ts**: Common data (products, posts, campaigns, etc.)
- **gmail-data.ts**: Email messages and classifications
- **google-ads-data.ts**: Campaign performance data
- **opencart-data.ts**: Product catalog and SEO audit data

## Writing Integration Tests

### Basic Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AgentClass } from '@/services/agents/agent-name'
import { mockSupabase } from '../../mocks/supabase'
import { testData } from '../../fixtures/test-data'

// Mock dependencies
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase)
}))

describe('Agent Integration Tests', () => {
  let agent: AgentClass

  beforeEach(() => {
    agent = new AgentClass()
    mockSupabase._clearMockData()
    mockSupabase._setMockData('table_name', testData)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('feature name', () => {
    it('should perform expected behavior', async () => {
      const result = await agent.someMethod()

      expect(result).toBeDefined()
      expect(result.property).toBe('expected_value')
    })
  })
})
```

### Testing with Real Supabase

For tests requiring real database:

1. Set environment variables:
   ```bash
   TEST_SUPABASE_URL=your_test_supabase_url
   TEST_SUPABASE_SERVICE_KEY=your_test_service_key
   ```

2. Database setup runs automatically in `setup.integration.ts`
3. Test data is seeded before tests
4. Database is cleaned up after tests

### Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Always clean up test data in `afterEach`
3. **Mocking**: Use mocks for external APIs to avoid rate limits
4. **Assertions**: Test both success and error scenarios
5. **Coverage**: Aim for comprehensive coverage of all code paths

## CI/CD Integration

### GitHub Actions Workflow

The test suite runs automatically on:
- Pull requests to `main` or `develop`
- Pushes to `main` or `develop`
- Manual workflow dispatch

**Pipeline Stages**:
1. **Lint**: Code quality checks
2. **Unit Tests**: Fast isolated tests
3. **Integration Tests**: Full integration test suite
4. **Coverage**: Verify 70% threshold
5. **Build**: Application build verification
6. **Deploy Preview**: Vercel preview deployment (PRs only)

### Environment Variables

Required for CI:
```yaml
TEST_SUPABASE_URL: Test database URL
TEST_SUPABASE_SERVICE_KEY: Test database service key
CODECOV_TOKEN: Code coverage reporting (optional)
VERCEL_TOKEN: Deployment token (optional)
```

### Coverage Reporting

Coverage reports are:
- Uploaded to Codecov
- Posted as PR comments
- Stored as artifacts for 30 days
- Enforced with 70% minimum threshold

## Debugging Tests

### Run Specific Test File
```bash
npm run test:integration -- tests/integration/agents/social-agent.test.ts
```

### Run Specific Test Suite
```bash
npm run test:integration -- -t "Social Media Agent"
```

### Verbose Output
```bash
npm run test:integration -- --reporter=verbose
```

### Debug Mode
```bash
node --inspect-brk ./node_modules/.bin/vitest --run
```

## Common Issues

### Test Timeout
Increase timeout in test file:
```typescript
it('long running test', async () => {
  // test code
}, 120000) // 2 minutes
```

### Mock Not Working
Ensure mocks are set up before importing:
```typescript
vi.mock('@supabase/supabase-js')
import { Agent } from '@/services/agents/agent'
```

### Database Connection Issues
Check environment variables:
```bash
echo $TEST_SUPABASE_URL
echo $TEST_SUPABASE_SERVICE_KEY
```

## Contributing

When adding new features:

1. Write integration tests first (TDD approach)
2. Add necessary mock services
3. Create test data fixtures
4. Ensure coverage meets 70% threshold
5. Update this README if needed

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [GitHub Actions](https://docs.github.com/en/actions)
- [Codecov](https://docs.codecov.io/)
