# Quick Start Guide: Monitoring & Alerting System

## Step 1: Database Setup

Run the migration in your Supabase SQL Editor:

```sql
-- Copy and paste the entire contents of:
supabase/migrations/003_schema_extensions.sql
```

This creates the `agent_logs` table and all necessary indexes.

## Step 2: Environment Configuration

Add these variables to your `.env.local` file:

```bash
# Twilio Configuration (for SMS alerts)
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890

# Alert Recipients
ALERT_PHONE_NUMBER=+0987654321
ALERT_EMAIL=alerts@yourcompany.com
```

**Note**: If you don't have Twilio credentials yet, the system will still work for logging and health monitoring. Alerts just won't be sent until configured.

## Step 3: Verify Installation

Start your dev server:
```bash
npm run dev
```

Visit these URLs to verify:

1. **Health Endpoint**: http://localhost:3001/api/agents/health
   - Should return JSON with agent status

2. **Main Dashboard**: http://localhost:3001/
   - Should see System Health Widget in right sidebar

## Step 4: Test Logging

Create a test script or use existing agent endpoints:

```typescript
// In any API route
import { logAgentActivity } from '@/lib/logger'

await logAgentActivity({
  agentName: 'test_agent',
  logLevel: 'info',
  eventType: 'test',
  message: 'Testing the logging system',
  context: { timestamp: new Date().toISOString() }
})
```

## Step 5: Test Alerts (Optional)

To test SMS/Email alerts, trigger an error:

```typescript
await logAgentActivity({
  agentName: 'test_agent',
  logLevel: 'error',
  eventType: 'test_error',
  message: 'Testing alert system',
  errorDetails: { test: true }
})
```

If configured correctly, you should receive:
- SMS to `ALERT_PHONE_NUMBER`
- Email to `ALERT_EMAIL`

## Common Use Cases

### Log Agent Success
```typescript
await logAgentActivity({
  agentName: 'email_agent',
  logLevel: 'info',
  eventType: 'email_sent',
  message: 'Successfully sent email to customer',
  context: { emailId: '12345', to: 'customer@example.com' }
})
```

### Log Agent Warning
```typescript
await logAgentActivity({
  agentName: 'stock_agent',
  logLevel: 'warning',
  eventType: 'low_stock',
  message: 'Product stock below threshold',
  context: { productId: 'SKU123', currentStock: 5 }
})
```

### Log Agent Error (triggers alert)
```typescript
try {
  // Some operation
} catch (error: any) {
  await logAgentActivity({
    agentName: 'orders_agent',
    logLevel: 'error',
    eventType: 'order_failed',
    message: `Order processing failed: ${error.message}`,
    errorDetails: {
      error: error.message,
      stack: error.stack
    },
    context: { orderId: 'ORD-12345' }
  })
}
```

### Log Critical System Failure (triggers alert)
```typescript
await logAgentActivity({
  agentName: 'database_agent',
  logLevel: 'critical',
  eventType: 'connection_lost',
  message: 'Lost connection to database',
  errorDetails: { lastSeen: new Date().toISOString() },
  context: { database: 'production', retries: 3 }
})
```

## Monitoring the Dashboard

The System Health Widget shows:

- **24h Uptime**: Percentage of agents that are not offline
- **Active/Idle Agents**: Count of agents by status
- **Error Rate**: Percentage of errors vs total events in last 24h
- **Recent Errors**: Last 3 errors with timestamps

Widget auto-refreshes every 30 seconds.

## Troubleshooting

### Widget shows "Failed to load health data"
- Check that migration was run successfully
- Verify Supabase connection is working
- Check browser console for errors

### No SMS alerts received
- Verify Twilio credentials in `.env.local`
- Check Twilio account has sufficient balance
- Verify phone numbers are in correct format (+countrycode)

### Health endpoint returns 500 error
- Check that `agent_logs` table exists
- Verify `squad_agents` table has data
- Check Supabase service role key is set

## Next Steps

1. Add logging to all existing agent endpoints
2. Set up monitoring dashboards in Supabase
3. Configure alert preferences
4. Set up log retention policies
5. Add custom health checks for specific agents

## Documentation

- **Full Documentation**: See `MONITORING.md`
- **Architecture**: See `ARCHITECTURE.md`
- **Implementation Details**: See `IMPLEMENTATION_SUMMARY.md`
