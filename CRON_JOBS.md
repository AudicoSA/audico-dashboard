# Cron Jobs Documentation

This document describes all automated agent tasks running via Vercel Cron Jobs.

## Overview

The multi-agent system uses Vercel Cron Jobs to automate various tasks. Each cron job is protected by authentication and rate limiting to prevent abuse.

## Cron Jobs

### 1. Email Poll Agent

**Endpoint**: `POST /api/agents/email/poll`  
**Schedule**: `*/15 * * * *` (Every 15 minutes)  
**Rate Limit**: 96 executions per day

**Description**: Polls Gmail API for new unread messages and logs them to the database.

**What it does**:
- Fetches up to 10 unread emails from Gmail
- Parses email headers (from, subject)
- Extracts email body content
- Stores emails in `email_logs` table
- Logs activity to `squad_messages` table

**Response**:
```json
{
  "success": true,
  "messagesFound": 5,
  "messages": [...],
  "remaining": 95
}
```

### 2. Email Classify Agent

**Endpoint**: `POST /api/agents/email/classify`  
**Schedule**: `*/20 * * * *` (Every 20 minutes)  
**Rate Limit**: 72 executions per day

**Description**: Automatically classifies unprocessed emails into categories.

**What it does**:
- Reads unclassified emails from database
- Analyzes subject and body content
- Assigns category: order, support, inquiry, complaint, spam, other
- Assigns priority: low, medium, high, urgent
- Creates records in `email_classifications` table

**Request Body**:
```json
{
  "email_id": "uuid",
  "gmail_message_id": "message_id"
}
```

**Response**:
```json
{
  "success": true,
  "email": {...},
  "classification": {
    "category": "support",
    "priority": "high"
  },
  "remaining": 71
}
```

### 3. Stock Check Agent

**Endpoint**: `GET /api/cron/stock/check`  
**Schedule**: `0 */6 * * *` (Every 6 hours)  
**Rate Limit**: 4 executions per day

**Description**: Checks for pending price changes in the queue.

**What it does**:
- Queries `price_change_queue` for pending items
- Retrieves up to 50 items
- Logs results to `squad_messages`

**Response**:
```json
{
  "success": true,
  "itemsFound": 12,
  "remaining": 3
}
```

### 4. Analytics Update Agent

**Endpoint**: `GET /api/cron/analytics/update`  
**Schedule**: `0 0 * * *` (Daily at midnight UTC)  
**Rate Limit**: 1 execution per day

**Description**: Updates daily analytics and metrics.

**What it does**:
- Counts emails processed in last 24 hours
- Counts classifications created
- Counts agent log entries
- Stores metrics in execution log

**Response**:
```json
{
  "success": true,
  "metrics": {
    "emails": 120,
    "classifications": 95,
    "agentLogs": 450
  },
  "remaining": 0
}
```

### 5. Maintenance Cleanup Agent

**Endpoint**: `GET /api/cron/maintenance/cleanup`  
**Schedule**: `0 2 * * *` (Daily at 2 AM UTC)  
**Rate Limit**: 1 execution per day

**Description**: Cleans up old logs and archives processed emails.

**What it does**:
- Deletes `agent_logs` older than 30 days
- Deletes `squad_messages` older than 30 days
- Archives emails with `draft_created` status older than 30 days

**Response**:
```json
{
  "success": true,
  "cleaned": {
    "logs": 450,
    "messages": 890,
    "emails": 23
  },
  "remaining": 0
}
```

### 6. Supplier Learning Analysis

**Endpoint**: `GET /api/cron/supplier-learning/analyze`  
**Schedule**: `0 6 * * 1` (Weekly on Mondays at 6 AM UTC)  
**Max Duration**: 300 seconds

**Description**: Comprehensive supplier pattern learning from email interactions.

**What it does**:
- Analyzes response time patterns and preferred contact methods
- Tracks pricing trends from successful quotes
- Measures stock reliability accuracy
- Calculates supplier response quality scores
- Identifies emerging supplier relationships
- Generates category-specific supplier insights
- Updates supplier_products.avg_markup_percentage from successful quotes
- Integrates findings into SupplierAgent ranking algorithm

**Analysis Windows**:
- Response patterns: Last 90 days
- Pricing trends: Last 60 days
- Stock reliability: Last 90 days
- Quality scores: Last 90 days
- Emerging relationships: Last 60 days (30-day comparison)
- Markup updates: Last 30 days

**Response**:
```json
{
  "success": true,
  "timestamp": "2024-01-15T06:00:00Z",
  "response_patterns_analyzed": 45,
  "pricing_trends_identified": 12,
  "stock_reliability_updated": 78,
  "quality_scores_updated": 45,
  "emerging_relationships": 3,
  "category_insights_generated": 8,
  "supplier_products_updated": 56
}
```

**See**: `lib/SUPPLIER_LEARNING_ENGINE.md` for detailed documentation

## Authentication

All cron endpoints require the `CRON_SECRET` environment variable:

```bash
Authorization: Bearer <CRON_SECRET>
```

### Testing Locally

```bash
# Set your secret
export CRON_SECRET="your_secret_here"

# Test email poll
curl -X POST http://localhost:3001/api/agents/email/poll \
  -H "Authorization: Bearer $CRON_SECRET"

# Test stock check
curl http://localhost:3001/api/cron/stock/check \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Rate Limiting

Rate limits are enforced using Vercel KV:

- **Window**: 24 hours (86400 seconds)
- **Storage**: Keys expire after window
- **Tracking**: `rate-limit:{agent_name}` keys

### Checking Rate Limit Status

```typescript
import { getAgentExecutionCount } from '@/lib/rate-limiter'

const count = await getAgentExecutionCount('email_poll')
console.log(`Email poll has executed ${count} times in last 24 hours`)
```

### Resetting Rate Limits (Development Only)

```typescript
import { resetRateLimit } from '@/lib/rate-limiter'

await resetRateLimit('email_poll')
```

## Monitoring

### Vercel Dashboard

1. Go to your project in Vercel
2. Navigate to **Deployments** → Select latest
3. Click **Functions** → Select cron function
4. View execution logs and metrics

### Supabase Logs

Query `squad_messages` table:

```sql
SELECT * FROM squad_messages
WHERE from_agent = 'email_agent'
ORDER BY created_at DESC
LIMIT 100;
```

Query `agent_logs` table:

```sql
SELECT * FROM agent_logs
WHERE agent = 'email_poll'
ORDER BY created_at DESC
LIMIT 100;
```

### Vercel KV Logs

Check agent execution logs:

```bash
# Get recent executions
vercel kv keys "agent-log:*"

# Get specific execution
vercel kv get "agent-log:email_poll:1234567890"
```

## Error Handling

Each cron job handles errors gracefully:

1. **Try-catch blocks**: All operations wrapped in error handlers
2. **Error logging**: Errors logged to `squad_messages`
3. **Rate limit fallback**: Returns success with warning if rate limit check fails
4. **HTTP status codes**: Proper status codes for different error types

### Common Error Responses

**Unauthorized**:
```json
{
  "error": "Unauthorized"
}
```
Status: 401

**Rate Limit Exceeded**:
```json
{
  "error": "Rate limit exceeded",
  "remaining": 0,
  "resetAt": "2024-01-15T12:00:00Z"
}
```
Status: 429

**Internal Error**:
```json
{
  "error": "Failed to poll Gmail",
  "details": "Error message here"
}
```
Status: 500

## Modifying Cron Jobs

### Changing Schedule

Edit `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/agents/email/poll",
      "schedule": "*/30 * * * *"  // Change to 30 minutes
    }
  ]
}
```

Redeploy to Vercel:

```bash
vercel --prod
```

### Changing Rate Limits

Edit `lib/rate-limiter.ts`:

```typescript
export const AGENT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  email_poll: {
    agentName: 'email_poll',
    maxExecutions: 48,  // Change from 96 to 48
    windowSeconds: 86400,
  },
}
```

Redeploy to Vercel.

## Best Practices

1. **Monitor execution logs**: Regularly check Vercel function logs
2. **Watch rate limits**: Set up alerts when approaching limits
3. **Test before deploying**: Use local testing with curl
4. **Backup data**: Ensure Supabase backups are enabled
5. **Rotate secrets**: Change `CRON_SECRET` periodically
6. **Review metrics**: Check `squad_messages` for agent activity
7. **Optimize schedules**: Adjust based on actual usage patterns

## Troubleshooting

### Cron job not executing

1. Check Vercel deployment status
2. Verify cron is defined in `vercel.json`
3. Check function logs for errors
4. Ensure `CRON_SECRET` is set in environment

### Rate limit errors

1. Check current execution count in KV
2. Verify rate limit configuration
3. Reset rate limit if needed (dev only)
4. Adjust rate limits in configuration

### Gmail API errors

1. Verify Gmail credentials are valid
2. Check `GMAIL_REFRESH_TOKEN` is not expired
3. Ensure Gmail API is enabled
4. Review OAuth consent screen settings

### Supabase errors

1. Check database connection
2. Verify tables exist
3. Check service role key permissions
4. Review Supabase logs

## Performance Optimization

### Reduce Execution Time

- Limit number of emails processed per run
- Use database indexes on frequently queried fields
- Optimize email parsing logic
- Cache frequently accessed data

### Reduce Costs

- Adjust cron schedules to run less frequently
- Reduce rate limits if not needed
- Archive old data more aggressively
- Use database connection pooling

## Security Considerations

1. **Protect CRON_SECRET**: Never expose in client code
2. **Use HTTPS**: All API calls over secure connections
3. **Validate inputs**: Check all request parameters
4. **Limit permissions**: Use least privilege for database access
5. **Monitor access**: Log all cron executions
6. **Rate limiting**: Prevents abuse and cost overruns
