# Integration Testing Framework Documentation

## Overview

This document provides a comprehensive overview of the integration testing framework implemented for the Agent Orchestration System.

## Framework Components

### 1. Test Infrastructure

**Testing Library**: Vitest
- Fast, Vite-native test runner
- Native TypeScript support
- Jest-compatible API
- Built-in coverage reporting

**Configuration Files**:
- `vitest.config.ts` - Unit test configuration
- `vitest.config.integration.ts` - Integration test configuration

### 2. Test Coverage

**Coverage Requirements**: Minimum 70% across all metrics
- Lines: 70%
- Functions: 70%
- Branches: 70%
- Statements: 70%

**Coverage Reporting**:
- HTML reports in `coverage/` directory
- LCOV format for CI/CD integration
- JSON summary for threshold validation
- Codecov integration for visual reports

### 3. Test Suites

#### Agent Tests (`tests/integration/agents/`)

**Social Media Agent** (`social-agent.test.ts`)
- ✅ Product catalog fetching
- ✅ Post content generation with Claude AI
- ✅ Post draft creation and scheduling
- ✅ Visual content generation (infographic, slides, video)
- ✅ Post approval and publishing workflows
- ✅ Bulk post generation

**Google Ads Agent** (`ads-agent.test.ts`)
- ✅ Campaign performance monitoring
- ✅ Metric calculation and analysis
- ✅ Performance issue detection (low CTR, high CPA, low ROAS)
- ✅ Automatic campaign pausing for critical issues
- ✅ Bid adjustment suggestions
- ✅ Performance report generation

**SEO Agent** (`seo-agent.test.ts`)
- ✅ OpenCart product auditing
- ✅ SEO issue identification (missing meta tags, poor descriptions, image issues)
- ✅ Issue severity classification
- ✅ SEO content generation with Claude AI
- ✅ Automated fix application
- ✅ Audit result storage

**Marketing Agent** (`marketing-agent.test.ts`)
- ✅ Business verification via Google Places API
- ✅ Reseller application processing
- ✅ Automatic approval for verified businesses
- ✅ Reseller pricing calculation
- ✅ Trending product identification from SEO data
- ✅ Newsletter generation with AI
- ✅ Influencer search across platforms (YouTube, Twitter, Instagram, LinkedIn)
- ✅ Reseller kit generation with NotebookLM

#### Workflow Tests (`tests/integration/workflows/`)

**Visual Content Automation** (`visual-content-automation.test.ts`)
- ✅ Weekly social visual generation
- ✅ Monthly newsletter asset creation
- ✅ Reseller onboarding kit generation
- ✅ Platform-optimized visual formats
- ✅ Error handling and recovery

#### Orchestrator Tests (`tests/integration/orchestrator/`)

**Orchestrator** (`orchestrator.test.ts`)
- ✅ System initialization
- ✅ Agent status tracking
- ✅ Token budget management
- ✅ Conflict detection
- ✅ Inter-agent messaging
- ✅ Graceful shutdown

#### Integration Tests (`tests/integration/integrations/`)

**NotebookLM Service** (`notebooklm.test.ts`)
- ✅ Notebook creation
- ✅ Source management (text, URL, PDF)
- ✅ Infographic generation (multiple orientations)
- ✅ Slide deck generation
- ✅ Video overview generation
- ✅ Artifact download

### 4. Mock Services

#### Database Mocks
- **Supabase Mock** (`tests/mocks/supabase.ts`)
  - In-memory data storage
  - Full CRUD operations
  - Storage bucket simulation
  - Query filtering and ordering

#### API Mocks
- **Gmail API Mock** (`tests/mocks/gmail-api.ts`)
  - Message listing and retrieval
  - Label management
  - Message modification
  - Email sending

- **Google APIs Mock** (`tests/mocks/google-apis.ts`)
  - Google Ads campaign queries
  - Google Places business lookup
  - YouTube channel search

- **Anthropic API Mock** (`tests/mocks/anthropic.ts`)
  - Claude message generation
  - Custom response mapping
  - Call history tracking

- **MySQL Mock** (`tests/mocks/mysql.ts`)
  - OpenCart database simulation
  - Query execution tracking
  - Table data management

- **NotebookLM Mock** (`tests/mocks/notebooklm.ts`)
  - Notebook and source management
  - Artifact generation simulation
  - File download mocking

### 5. Test Fixtures

**Common Data** (`tests/fixtures/test-data.ts`)
- Products
- Social posts
- Ad campaigns
- SEO audits
- Reseller applications
- Squad messages

**Specialized Fixtures**:
- `gmail-data.ts` - Email messages and classifications
- `google-ads-data.ts` - Campaign performance metrics
- `opencart-data.ts` - Product catalog and SEO audit results

### 6. Test Helpers

**Database Helper** (`tests/helpers/database.ts`)
- Test database setup
- Data seeding
- Cleanup utilities
- Supabase client management

## Running Tests

### Local Development

```bash
# Run all tests
npm test

# Run integration tests
npm run test:integration

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
npm run test:integration:watch

# UI mode
npm run test:ui
```

### CI/CD Pipeline

**GitHub Actions Workflow** (`.github/workflows/ci.yml`)

Pipeline stages:
1. **Lint** - Code quality checks
2. **Unit Tests** - Fast isolated tests
3. **Integration Tests** - Full integration suite
4. **Coverage** - Verify 70% threshold and upload reports
5. **Build** - Application build verification
6. **Deploy Preview** - Vercel preview (PRs only)

**Triggers**:
- Pull requests to `main` or `develop`
- Pushes to `main` or `develop`
- Manual workflow dispatch

**Required Secrets**:
```
TEST_SUPABASE_URL          # Test database URL
TEST_SUPABASE_SERVICE_KEY  # Test database key
CODECOV_TOKEN              # Coverage reporting (optional)
VERCEL_TOKEN               # Deployment (optional)
```

## Test Coverage Metrics

### Current Coverage Goals

| Metric | Threshold | Target |
|--------|-----------|--------|
| Lines | 70% | 80% |
| Functions | 70% | 80% |
| Branches | 70% | 75% |
| Statements | 70% | 80% |

### Coverage Reporting

**Local Reports**:
- HTML: `coverage/index.html`
- Terminal: Displayed after test run
- JSON: `coverage/coverage-summary.json`

**CI/CD Reports**:
- Codecov dashboard
- PR comments with coverage diff
- Artifacts stored for 30 days

## Best Practices

### Writing Tests

1. **Isolation**: Each test should be independent
   ```typescript
   beforeEach(() => {
     mockSupabase._clearMockData()
     agent = new Agent()
   })
   ```

2. **Descriptive Names**: Use clear, descriptive test names
   ```typescript
   it('should generate platform-optimized visuals for Instagram posts', async () => {
     // test code
   })
   ```

3. **Arrange-Act-Assert**: Follow AAA pattern
   ```typescript
   // Arrange
   mockSupabase._setMockData('posts', testPosts)
   
   // Act
   const result = await agent.processPost('post-1')
   
   // Assert
   expect(result.success).toBe(true)
   ```

4. **Error Testing**: Test both success and failure paths
   ```typescript
   it('should handle API errors gracefully', async () => {
     vi.spyOn(agent, 'callAPI').mockRejectedValue(new Error('API error'))
     
     await expect(agent.process()).rejects.toThrow('API error')
   })
   ```

5. **Cleanup**: Always clean up in afterEach
   ```typescript
   afterEach(() => {
     vi.clearAllMocks()
     mockSupabase._clearMockData()
   })
   ```

### Performance Optimization

1. **Use Mocks**: Prefer mocks over real APIs
2. **Parallel Execution**: Run independent tests in parallel
3. **Selective Testing**: Run only affected tests during development
4. **Connection Pooling**: Reuse database connections
5. **Batch Operations**: Group database operations

### Debugging

**Run Specific Tests**:
```bash
npm run test:integration -- tests/integration/agents/social-agent.test.ts
npm run test:integration -- -t "should generate post content"
```

**Verbose Output**:
```bash
npm run test:integration -- --reporter=verbose
```

**Debug Mode**:
```bash
node --inspect-brk ./node_modules/.bin/vitest --run
```

## Documentation

### Available Documents

1. **README.md** (`tests/README.md`)
   - Framework overview
   - Test structure
   - Running tests
   - Mock services guide

2. **DATABASE_SETUP.md** (`tests/DATABASE_SETUP.md`)
   - Database configuration
   - SQL schema setup
   - Environment setup
   - Troubleshooting

3. **TESTING_FRAMEWORK.md** (this document)
   - Complete framework documentation
   - Coverage metrics
   - Best practices
   - CI/CD integration

## Maintenance

### Adding New Tests

1. Create test file in appropriate directory
2. Import required mocks and fixtures
3. Set up mock dependencies
4. Write test cases
5. Verify coverage meets threshold
6. Update documentation

### Updating Mocks

1. Locate mock service in `tests/mocks/`
2. Add new methods or update existing
3. Update fixture data if needed
4. Test across all affected tests
5. Document new functionality

### Database Schema Changes

1. Update `DATABASE_SETUP.md` with new schema
2. Modify `tests/helpers/database.ts` seed data
3. Update fixtures with new fields
4. Verify all tests pass
5. Update mock services if needed

## Troubleshooting

### Common Issues

**Test Timeouts**
```typescript
it('long running test', async () => {
  // test code
}, 120000) // 2 minutes
```

**Mock Not Working**
```typescript
// Mock before import
vi.mock('@supabase/supabase-js')
import { Agent } from '@/services/agents/agent'
```

**Coverage Below Threshold**
- Add tests for uncovered branches
- Test error handling paths
- Include edge cases
- Check for unused code

**Flaky Tests**
- Remove time dependencies
- Use deterministic mock data
- Avoid parallel execution conflicts
- Add proper cleanup

## Future Enhancements

### Planned Improvements

1. **Visual Regression Testing**
   - Screenshot comparison for generated visuals
   - Percy.io or similar integration

2. **Performance Testing**
   - Load testing for high-volume scenarios
   - Memory leak detection
   - Response time benchmarks

3. **E2E Testing**
   - Full workflow testing with real UI
   - Playwright integration
   - User journey coverage

4. **Contract Testing**
   - API contract validation
   - Schema verification
   - Breaking change detection

5. **Test Data Management**
   - Automated fixture generation
   - Dynamic test data
   - Snapshot testing

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://testingjavascript.com/)
- [GitHub Actions](https://docs.github.com/en/actions)
- [Codecov Documentation](https://docs.codecov.io/)
- [Test-Driven Development](https://martinfowler.com/bliki/TestDrivenDevelopment.html)

## Support

For questions or issues:
1. Check documentation in `tests/` directory
2. Review GitHub Actions logs
3. Examine mock service implementations
4. Consult team lead or senior developers

---

**Last Updated**: 2024
**Version**: 1.0.0
**Maintainers**: Development Team
