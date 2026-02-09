# API Resilience Layer - Quick Start Guide

## 🚀 Getting Started in 5 Minutes

### 1. Automatic Initialization

The resilience layer is automatically initialized when the app starts. No manual setup required!

```typescript
// Already included in app/layout.tsx
import '../lib/resilience/init'
```

### 2. Wrap Your API Calls

Replace direct API calls with resilient versions:

#### Before:
```typescript
const result = await fetch('https://api.example.com/data')
const data = await result.json()
```

#### After:
```typescript
import { withResilience } from '@/lib/resilience'

const data = await withResilience('service-name', async () => {
  const result = await fetch('https://api.example.com/data')
  return await result.json()
})
```

### 3. Use Pre-Built Resilient Services

#### Social Media (Facebook, Instagram, Twitter)

```typescript
import { 
  ResilientFacebookConnector,
  ResilientInstagramConnector,
  ResilientTwitterConnector 
} from '@/lib/resilience/resilient-social-connectors'

// Use exactly like the original connectors
const facebook = new ResilientFacebookConnector(accessToken, pageId)
const result = await facebook.post('Hello world!', ['image.jpg'])
```

#### NotebookLM

```typescript
import ResilientNotebookLMService from '@/services/integrations/resilient-notebooklm-service'

// Drop-in replacement for NotebookLMService
const notebookLM = new ResilientNotebookLMService()
const notebook = await notebookLM.createNotebook('Title', 'Purpose')
```

#### Google Ads

```typescript
import { resilientAdsAgent } from '@/services/agents/resilient-ads-agent'

// Use instead of regular adsAgent
await resilientAdsAgent.monitorCampaignPerformance()
```

### 4. View the Dashboard

Navigate to `/resilience` in your browser to see:
- ✅ Real-time health status of all services
- 📊 Circuit breaker states (CLOSED/HALF_OPEN/OPEN)
- 📈 Success and error rates
- 🔄 Retry counts and circuit breaker trips
- ⚡ Manual reset controls

### 5. Set Up Database (Optional but Recommended)

Run the migration to store metrics:

```bash
# Using Supabase CLI
supabase migration up

# Or run the SQL directly in Supabase dashboard
# File: supabase/migrations/20240101000000_create_resilience_metrics.sql
```

## 📋 Common Use Cases

### Use Case 1: Social Media Posting with Auto-Retry

```typescript
import { ResilientFacebookConnector } from '@/lib/resilience/resilient-social-connectors'

const facebook = new ResilientFacebookConnector(token, pageId)

// Automatically retries on transient failures
// Falls back to draft if Facebook is down
const result = await facebook.post(
  'Check out our latest products! 🚀',
  ['product-image.jpg']
)

if (!result.success) {
  console.log('Post saved as draft:', result.error)
}
```

### Use Case 2: Gmail with Queueing

```typescript
import { withResilience } from '@/lib/resilience'

const sendEmail = async (to: string, subject: string, body: string) => {
  return withResilience('gmail-api', async () => {
    // Your Gmail API call here
    return await gmailAPI.send({ to, subject, body })
  })
}

// If Gmail API is down, emails are queued automatically
await sendEmail('customer@example.com', 'Welcome!', 'Thanks for signing up')
```

### Use Case 3: Google Ads with Stale Data Fallback

```typescript
import { withResilience } from '@/lib/resilience'

const getCampaignMetrics = async (campaignId: string) => {
  return withResilience(
    'google-ads-api',
    async () => await googleAds.getCampaign(campaignId),
    {
      fallbackValue: getCachedCampaign(campaignId) // Use cached data if API is down
    }
  )
}
```

### Use Case 4: Database Query with Fast Retry

```typescript
import { withResilience } from '@/lib/resilience'

const getProducts = async () => {
  return withResilience(
    'opencart-mysql',
    async () => {
      const connection = await mysql.createConnection(config)
      const [rows] = await connection.execute('SELECT * FROM products')
      return rows
    },
    {
      fallbackValue: [] // Return empty array if DB is down
    }
  )
}
```

## 🎯 Configuration Cheat Sheet

All services are pre-configured with sensible defaults:

| Service | Timeout | Max Retries | Failure Threshold | Degradation |
|---------|---------|-------------|-------------------|-------------|
| Gmail API | 15s | 3 | 3 failures | Queue emails |
| Facebook API | 30s | 3 | 5 failures | Save as draft |
| Instagram API | 30s | 3 | 5 failures | Save as draft |
| Twitter API | 25s | 3 | 5 failures | Save as draft |
| Google Ads | 45s | 4 | 4 failures | Stale data |
| OpenCart MySQL | 10s | 3 | 3 failures | Cached data |
| NotebookLM | 90s | 2 | 4 failures | Postpone |

## 🛠️ Monitoring & Maintenance

### Check Health Status

```typescript
import { resilienceManager } from '@/lib/resilience'

// Get all services health
const health = resilienceManager.getAllServicesHealth()

// Get specific service
const gmailHealth = resilienceManager.getServiceHealth('gmail-api')
console.log(gmailHealth.state) // 'CLOSED', 'HALF_OPEN', or 'OPEN'
```

### Reset Circuit Breakers

Via Dashboard:
- Navigate to `/resilience`
- Click "Reset" button on any service card
- Or click "Reset All" to reset all circuit breakers

Via API:
```bash
# Reset specific service
curl -X POST http://localhost:3001/api/resilience/reset \
  -H "Content-Type: application/json" \
  -d '{"serviceName": "gmail-api"}'

# Reset all services
curl -X POST http://localhost:3001/api/resilience/reset \
  -H "Content-Type: application/json" \
  -d '{}'
```

### View Metrics

```bash
# Get all metrics
curl http://localhost:3001/api/resilience/metrics

# Get specific service metrics
curl http://localhost:3001/api/resilience/metrics?service=gmail-api
```

## 🔔 Set Up Alerts (Optional)

```typescript
import { resilienceMonitoring, sendSlackAlert } from '@/lib/resilience/monitoring'

// Configure alerts
resilienceMonitoring.configure({
  onCircuitOpen: async (serviceName) => {
    await sendSlackAlert(serviceName, 'Circuit breaker opened!')
  },
  onHighErrorRate: async (serviceName, errorRate) => {
    if (errorRate > 75) {
      await sendSlackAlert(serviceName, `High error rate: ${errorRate}%`)
    }
  }
})

// Start health checks every minute
resilienceMonitoring.startHealthChecks(60000)
```

Add `SLACK_WEBHOOK_URL` to your environment variables.

## 🧪 Testing

Test circuit breaker behavior:

```typescript
// Force circuit breaker to open
for (let i = 0; i < 5; i++) {
  try {
    await withResilience('test-service', async () => {
      throw new Error('Simulated failure')
    })
  } catch (error) {
    console.log(`Attempt ${i + 1} failed`)
  }
}

// Check state
const health = resilienceManager.getServiceHealth('test-service')
console.log(health.state) // Should be 'OPEN'

// Reset for next test
resilienceManager.resetService('test-service')
```

## ❓ Troubleshooting

### "Circuit breaker is OPEN" error
**Cause**: Service has failed repeatedly  
**Solution**: 
1. Check if the external service is actually down
2. Wait for the reset timeout (varies by service)
3. Or manually reset via dashboard

### Requests timing out
**Cause**: Service timeout is too short  
**Solution**: Configure longer timeout in service config

### Too many retries
**Cause**: Retry policy is too aggressive  
**Solution**: Reduce maxRetries in service config

### Dashboard not updating
**Cause**: Auto-refresh disabled  
**Solution**: Enable auto-refresh checkbox in dashboard

## 📚 Next Steps

1. ✅ Read full documentation: `lib/resilience/README.md`
2. ✅ View implementation details: `RESILIENCE_IMPLEMENTATION.md`
3. ✅ Check usage examples: `lib/resilience/usage-examples.ts`
4. ✅ Set up monitoring dashboard: Navigate to `/resilience`
5. ✅ Configure alerts for critical services
6. ✅ Run health checks: `npx ts-node scripts/resilience-health-check.ts`

## 🎉 You're Done!

Your application now has enterprise-grade API resilience with:
- ✅ Circuit breaker protection
- ✅ Automatic retries with exponential backoff
- ✅ Request timeouts
- ✅ Graceful degradation
- ✅ Real-time monitoring
- ✅ Automatic health checks

All external API calls are now protected against failures! 🛡️
