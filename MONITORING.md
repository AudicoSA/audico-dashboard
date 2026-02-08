# Agent Monitoring and Alerting System

## Overview

The monitoring and alerting system provides real-time health checks, error logging, and automated alerts for all AI agents in the Audico dashboard.

## Components

### 1. Agent Logs Table (`agent_logs`)

Database table that stores all agent activity and errors:

- **agent_name**: Name of the agent (e.g., 'email_agent', 'orders_agent')
- **log_level**: Severity level ('info', 'warning', 'error', 'critical')
- **event_type**: Type of event (e.g., 'poll_start', 'poll_error', 'classify_error')
- **message**: Human-readable log message
- **error_details**: JSON object with error stack traces and details
- **context**: JSON object with additional context
- **created_at**: Timestamp of the log entry

### 2. Health Check API (`/api/agents/health`)

**Endpoint**: `GET /api/agents/health`

Returns comprehensive health status for all agents:

```json
{
  "success": true,
  "timestamp": "2024-02-08T10:00:00.000Z",
  "summary": {
    "totalAgents": 7,
    "activeAgents": 2,
    "idleAgents": 4,
    "offlineAgents": 1,
    "uptime": "85.71%",
    "totalLogs24h": 245,
    "errorCount24h": 12,
    "errorRate": "4.90%"
  },
  "agents": [
    {
      "name": "Jarvis",
      "role": "Orchestrator",
      "status": "active",
      "healthStatus": "healthy",
      "lastActive": "2024-02-08T09:58:00.000Z",
      "errorCount24h": 0
    }
  ],
  "recentErrors": [
    {
      "id": "uuid",
      "agentName": "email_agent",
      "level": "error",
      "eventType": "poll_error",
      "message": "Gmail poll failed",
      "timestamp": "2024-02-08T09:45:00.000Z"
    }
  ]
}
```

### 3. Alert System (`/api/alerts/send`)

**Endpoint**: `POST /api/alerts/send`

Sends SMS and email alerts for critical errors using Twilio.

**Request Body**:
```json
{
  "agentName": "email_agent",
  "logLevel": "critical",
  "eventType": "poll_error",
  "message": "Gmail authentication failed",
  "errorDetails": {
    "error": "Invalid credentials",
    "stack": "..."
  }
}
```

### 4. Logging Utility (`lib/logger.ts`)

Helper function to log agent activity and automatically trigger alerts for errors:

```typescript
import { logAgentActivity } from '@/lib/logger'

await logAgentActivity({
  agentName: 'email_agent',
  logLevel: 'error',
  eventType: 'poll_error',
  message: 'Gmail poll failed',
  errorDetails: {
    error: error.message,
    stack: error.stack
  },
  context: { action: 'poll_error' }
})
```

**Auto-alerting**: Calls to `logAgentActivity` with `logLevel: 'error'` or `logLevel: 'critical'` automatically trigger alerts.

### 5. System Health Widget

React component displayed on the main dashboard showing:

- 24-hour uptime percentage with color-coded progress bar
- Active vs. idle agent counts
- Error rate over the last 24 hours
- Recent error list with timestamps
- Auto-refresh every 30 seconds

## Configuration

### Environment Variables

Add these to your `.env.local`:

```bash
# Twilio Configuration (for SMS alerts)
TWILIO_ACCOUNT_SID=your_twilio_account_sid_here
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
TWILIO_PHONE_NUMBER=your_twilio_phone_number_here

# Alert Configuration
ALERT_PHONE_NUMBER=your_alert_phone_number_here
ALERT_EMAIL=your_alert_email_here
```

### Database Migration

Run the migration to create the `agent_logs` table:

```bash
# In Supabase SQL Editor, run:
supabase/migrations/003_schema_extensions.sql
```

## Usage Examples

### Example 1: Log Info Event

```typescript
await logAgentActivity({
  agentName: 'orders_agent',
  logLevel: 'info',
  eventType: 'order_processed',
  message: 'Successfully processed order #12345',
  context: { orderId: '12345', amount: 1299.99 }
})
```

### Example 2: Log Error with Alert

```typescript
try {
  // Some agent operation
} catch (error: any) {
  await logAgentActivity({
    agentName: 'stock_agent',
    logLevel: 'critical',
    eventType: 'sync_failure',
    message: `Stock sync failed: ${error.message}`,
    errorDetails: {
      error: error.message,
      stack: error.stack
    },
    context: { operation: 'stock_sync' }
  })
}
```

### Example 3: Query Health Status

```typescript
const response = await fetch('/api/agents/health')
const health = await response.json()

console.log(`System uptime: ${health.summary.uptime}`)
console.log(`Error rate: ${health.summary.errorRate}`)
```

## Monitoring Best Practices

1. **Log all agent activities**: Use `info` level for successful operations
2. **Log warnings**: Use `warning` for recoverable issues
3. **Log errors**: Use `error` for failures that need attention
4. **Log critical events**: Use `critical` for system-breaking issues
5. **Include context**: Always provide relevant context in the `context` field
6. **Include error details**: Always provide stack traces in `errorDetails` for errors

## Alert Thresholds

The system automatically triggers alerts when:

- `logLevel: 'error'` - Sends SMS and email alerts
- `logLevel: 'critical'` - Sends SMS and email alerts
- Agent health status becomes 'critical' (>5 errors in 24h)
- Agent health status becomes 'degraded' (>0 errors or >60 min inactive)

## Dashboard Integration

The System Health Widget is displayed on the main dashboard (`app/page.tsx`) in the right sidebar, providing at-a-glance monitoring of all agents.

## Troubleshooting

### No alerts being sent

1. Check Twilio credentials in `.env.local`
2. Verify `ALERT_PHONE_NUMBER` and `ALERT_EMAIL` are set
3. Check Twilio account has sufficient balance
4. Review `/api/alerts/send` logs for errors

### Health endpoint returning errors

1. Verify `agent_logs` table exists in Supabase
2. Check Supabase service role key is set
3. Verify `squad_agents` table has data

### Widget not updating

1. Check browser console for fetch errors
2. Verify `/api/agents/health` endpoint is accessible
3. Check React component is properly imported in `app/page.tsx`
