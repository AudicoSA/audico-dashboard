# Database Setup for Integration Tests

## Overview

Integration tests can run in two modes:
1. **Mock Mode**: Uses in-memory mocks (default, no setup required)
2. **Real Database Mode**: Uses actual Supabase test instance

## Mock Mode (Default)

No setup required. Tests use mock services that simulate database operations in memory.

**Advantages**:
- Fast execution
- No external dependencies
- Works in any environment
- No rate limits or quotas

**Usage**:
```bash
npm run test:integration
```

## Real Database Mode

For testing with actual Supabase instance.

### Prerequisites

1. Create a Supabase test project
2. Run the following SQL to create test schema:

```sql
-- Create test tables (if not exists)
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2),
  cost DECIMAL(10,2),
  category TEXT,
  brand TEXT,
  sku TEXT,
  features TEXT[],
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS social_posts (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL,
  scheduled_for TIMESTAMP,
  published_at TIMESTAMP,
  visual_content_url TEXT,
  created_by TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ad_campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  status TEXT NOT NULL,
  budget_total DECIMAL(10,2),
  budget_spent DECIMAL(10,2),
  currency TEXT DEFAULT 'ZAR',
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  performance_metrics JSONB,
  managed_by TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seo_audits (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  audit_type TEXT NOT NULL,
  status TEXT NOT NULL,
  score INTEGER,
  issues_found JSONB,
  recommendations JSONB,
  metrics JSONB,
  performed_by TEXT,
  completed_at TIMESTAMP,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_logs (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  from_address TEXT,
  to_address TEXT,
  subject TEXT,
  body TEXT,
  category TEXT,
  status TEXT,
  received_at TIMESTAMP,
  processed_at TIMESTAMP,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS squad_agents (
  name TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  capabilities TEXT[],
  last_active TIMESTAMP,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS squad_messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  from_agent TEXT NOT NULL,
  to_agent TEXT,
  message TEXT NOT NULL,
  task_id TEXT,
  data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS squad_tasks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  assigned_agent TEXT,
  priority TEXT,
  mentions_kenny BOOLEAN DEFAULT FALSE,
  deliverable_url TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notebooklm_notebooks (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  notebook_id TEXT NOT NULL UNIQUE,
  purpose TEXT,
  sources_count INTEGER DEFAULT 0,
  status TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notebooklm_artifacts (
  id SERIAL PRIMARY KEY,
  notebook_id INTEGER REFERENCES notebooklm_notebooks(id),
  artifact_type TEXT NOT NULL,
  storage_path TEXT,
  generation_prompt TEXT,
  status TEXT NOT NULL,
  linked_social_post_id TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reseller_applications (
  id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  status TEXT NOT NULL,
  business_details JSONB,
  reviewed_by TEXT,
  reviewed_at TIMESTAMP,
  approval_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS approved_resellers (
  id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  status TEXT NOT NULL,
  discount_tier TEXT NOT NULL,
  commission_rate DECIMAL(5,2),
  total_orders INTEGER DEFAULT 0,
  total_revenue DECIMAL(10,2) DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reseller_orders (
  id TEXT PRIMARY KEY,
  reseller_id TEXT REFERENCES approved_resellers(id),
  status TEXT NOT NULL,
  items JSONB,
  order_date TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);

CREATE TABLE IF NOT EXISTS newsletter_drafts (
  id TEXT PRIMARY KEY,
  title TEXT,
  subject_line TEXT NOT NULL,
  content TEXT,
  html_content TEXT,
  status TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(status);
CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled ON social_posts(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_status ON ad_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_seo_audits_status ON seo_audits(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_category ON email_logs(category);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_squad_messages_from ON squad_messages(from_agent);
CREATE INDEX IF NOT EXISTS idx_squad_tasks_status ON squad_tasks(status);
```

### Environment Setup

1. Create `.env.test` file:
```bash
TEST_SUPABASE_URL=https://your-project.supabase.co
TEST_SUPABASE_SERVICE_KEY=your-service-role-key
TEST_SUPABASE_ANON_KEY=your-anon-key
```

2. Load environment variables:
```bash
# Linux/Mac
export $(cat .env.test | xargs)

# Windows PowerShell
Get-Content .env.test | ForEach-Object {
  $name, $value = $_.split('=')
  Set-Content env:\$name $value
}
```

3. Run integration tests:
```bash
npm run test:integration
```

### Database Cleanup

Tests automatically clean up test data:
- **Before tests**: Seed fresh test data
- **After tests**: Remove all test records

To manually clean test database:
```sql
DELETE FROM squad_messages WHERE from_agent LIKE 'test_%';
DELETE FROM squad_tasks WHERE assigned_agent LIKE 'test_%';
DELETE FROM social_posts WHERE created_by = 'test_user';
DELETE FROM ad_campaigns WHERE metadata->>'test' = 'true';
DELETE FROM seo_audits WHERE performed_by = 'test_agent';
DELETE FROM email_logs WHERE metadata->>'test' = 'true';
DELETE FROM notebooklm_artifacts WHERE metadata->>'test' = 'true';
DELETE FROM notebooklm_notebooks WHERE metadata->>'test' = 'true';
DELETE FROM products WHERE id LIKE 'test-%';
```

## CI/CD Configuration

### GitHub Actions Secrets

Add to repository secrets:

```
TEST_SUPABASE_URL
TEST_SUPABASE_SERVICE_KEY
TEST_SUPABASE_ANON_KEY
```

### Local Development

For local development with real database:

1. Copy test environment template:
```bash
cp .env.local.example .env.test
```

2. Update with test credentials
3. Run tests with test environment:
```bash
npm run test:integration
```

## Troubleshooting

### Connection Issues

**Problem**: Cannot connect to Supabase
```
Error: fetch failed - ECONNREFUSED
```

**Solution**:
- Verify TEST_SUPABASE_URL is correct
- Check network/firewall settings
- Ensure service role key has proper permissions

### Permission Denied

**Problem**: Permission denied on table operations
```
Error: permission denied for table products
```

**Solution**:
- Use service role key (not anon key) for tests
- Verify RLS policies allow service role access
- Check table ownership and permissions

### Timeout Errors

**Problem**: Tests timeout waiting for database
```
Error: Test timeout of 60000ms exceeded
```

**Solution**:
- Increase timeout in test file
- Check database performance
- Consider using mock mode for faster tests

### Stale Test Data

**Problem**: Tests fail due to existing data
```
Error: unique constraint violation
```

**Solution**:
- Run database cleanup SQL
- Restart test suite
- Ensure cleanup runs in afterEach hooks

## Best Practices

1. **Use Mock Mode by Default**: Faster, more reliable
2. **Real DB for Critical Tests**: Use real database for critical workflows
3. **Isolate Test Data**: Always prefix test IDs with 'test-'
4. **Clean Up**: Ensure cleanup runs even on test failure
5. **Connection Pooling**: Reuse database connections where possible
6. **Parallel Execution**: Avoid with real database (use single-thread)

## Performance Tips

### Speed Up Tests

1. Use mock mode for most tests
2. Batch database operations
3. Use transactions for cleanup
4. Limit test data size
5. Use connection pooling

### Optimize Database Queries

```typescript
// Good: Single query with filters
const posts = await supabase
  .from('social_posts')
  .select('*')
  .eq('status', 'draft')
  .limit(10)

// Bad: Multiple queries
const allPosts = await supabase.from('social_posts').select('*')
const draftPosts = allPosts.filter(p => p.status === 'draft')
```

## Migration Guide

### Moving from Mock to Real Database

1. Set environment variables
2. Run database setup SQL
3. Update test assertions for real data
4. Adjust timeouts if needed
5. Monitor for flaky tests

### Switching Back to Mocks

1. Unset environment variables
2. Tests automatically use mocks
3. Verify mock data matches expectations
4. Update fixtures if needed
