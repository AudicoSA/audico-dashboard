# API Resilience Layer

Comprehensive resilience implementation for external API integrations with circuit breaker pattern, exponential backoff retry logic, and graceful degradation.

## Features

### Circuit Breaker Pattern
- **Three States**: CLOSED, OPEN, HALF_OPEN
- **Configurable Thresholds**: Set failure thresholds per service
- **Auto-Recovery**: Automatically transitions to HALF_OPEN to test recovery
- **State Monitoring**: Real-time state tracking and notifications

### Retry Logic
- **Exponential Backoff**: Progressive delay between retries
- **Jitter**: Randomized delays to prevent thundering herd
- **Configurable**: Max retries, delays, and backoff multipliers
- **Smart Error Detection**: Only retries transient failures

### Timeout Management
- **Per-Service Timeouts**: Different timeout values for each service
- **Request-Level Control**: Override timeouts for specific operations
- **Automatic Cancellation**: Prevents hanging requests

### Graceful Degradation
- **Fallback Strategies**: Custom degradation logic per service
- **Queue Support**: Queue operations when services are down
- **Cached Responses**: Return stale data when fresh data unavailable
- **User Notifications**: Inform users of degraded service

### Monitoring Dashboard
- **Real-Time Health**: Live circuit breaker states
- **Metrics**: Request counts, success/error rates, retries
- **Service Status**: Visual indicators for each service
- **Manual Control**: Reset circuit breakers manually

## Supported Services

### 1. Gmail API
- **Timeout**: 15s
- **Failure Threshold**: 3 consecutive failures
- **Retry Strategy**: 3 retries with exponential backoff
- **Degradation**: Queue emails for later delivery

### 2. Facebook API
- **Timeout**: 30s
- **Failure Threshold**: 5 consecutive failures
- **Retry Strategy**: 3 retries with exponential backoff
- **Degradation**: Save posts as drafts

### 3. Instagram API
- **Timeout**: 30s
- **Failure Threshold**: 5 consecutive failures
- **Retry Strategy**: 3 retries with exponential backoff
- **Degradation**: Save posts as drafts

### 4. Twitter API
- **Timeout**: 25s
- **Failure Threshold**: 5 consecutive failures
- **Retry Strategy**: 3 retries with exponential backoff
- **Degradation**: Save posts as drafts

### 5. Google Ads API
- **Timeout**: 45s
- **Failure Threshold**: 4 consecutive failures
- **Retry Strategy**: 4 retries with exponential backoff
- **Degradation**: Use stale campaign data

### 6. OpenCart MySQL
- **Timeout**: 10s
- **Failure Threshold**: 3 consecutive failures
- **Retry Strategy**: 3 retries with fast backoff
- **Degradation**: Use cached product data

### 7. NotebookLM API
- **Timeout**: 90s
- **Failure Threshold**: 4 consecutive failures
- **Retry Strategy**: 2 retries with long backoff
- **Degradation**: Postpone visual generation

## Installation

The resilience layer is automatically initialized on server startup.

```typescript
import { ensureResilienceInitialized } from '@/lib/resilience/init'

// Called automatically in lib/resilience/init.ts
ensureResilienceInitialized()
```

## Usage

### Basic Usage

```typescript
import { withResilience } from '@/lib/resilience'

// Execute any async operation with resilience
const result = await withResilience(
  'gmail-api',
  async () => {
    // Your API call here
    return await sendEmail()
  }
)
```

### With Fallback Value

```typescript
const products = await withResilience(
  'opencart-mysql',
  async () => await fetchProducts(),
  { fallbackValue: [] }
)
```

### Skip Retry for Fast Failures

```typescript
const isValid = await withResilience(
  'facebook-api',
  async () => await verifyToken(),
  { skipRetry: true }
)
```

### Using Resilient Connectors

#### Social Media

```typescript
import { 
  ResilientFacebookConnector,
  ResilientInstagramConnector,
  ResilientTwitterConnector 
} from '@/lib/resilience/resilient-social-connectors'

const facebook = new ResilientFacebookConnector(accessToken, pageId)
const result = await facebook.post('Hello world!', ['image.jpg'])
```

#### NotebookLM

```typescript
import ResilientNotebookLMService from '@/services/integrations/resilient-notebooklm-service'

const notebookLM = new ResilientNotebookLMService()
const notebook = await notebookLM.createNotebook('Title', 'Purpose')
```

#### Google Ads

```typescript
import { resilientAdsAgent } from '@/services/agents/resilient-ads-agent'

await resilientAdsAgent.monitorCampaignPerformance()
```

## Monitoring Dashboard

Access the monitoring dashboard at `/resilience`

Features:
- **Overall System Health**: Summary of all services
- **Per-Service Cards**: Individual circuit breaker states
- **Real-Time Updates**: Auto-refresh every 5 seconds
- **Manual Controls**: Reset individual or all circuit breakers
- **Detailed Metrics**: Success rates, error rates, retry counts

## API Endpoints

### GET /api/resilience/health
Get current health status of all services

```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "overall": {
    "healthy": true,
    "totalServices": 7,
    "healthyServices": 7,
    "degradedServices": 0,
    "unhealthyServices": 0
  },
  "services": [...]
}
```

### GET /api/resilience/metrics?service=gmail-api
Get detailed metrics for a specific service (or all if no service specified)

```json
{
  "service": "gmail-api",
  "metrics": {
    "requestsTotal": 100,
    "requestsSuccessful": 95,
    "requestsFailed": 5,
    "retriesTotal": 8,
    "circuitBreakerTrips": 0,
    "degradationInvocations": 0
  },
  "health": {
    "state": "CLOSED",
    "healthy": true,
    "successRate": 95.0,
    "errorRate": 5.0
  }
}
```

### POST /api/resilience/reset
Reset circuit breaker state

```json
// Reset specific service
{ "serviceName": "gmail-api" }

// Reset all services
{}
```

## Configuration

Service configurations are defined in `lib/resilience/service-configs.ts`:

```typescript
export const CUSTOM_SERVICE_CONFIG: ServiceConfig = {
  name: 'custom-api',
  circuitBreaker: {
    failureThreshold: 5,        // Open after 5 consecutive failures
    successThreshold: 2,        // Close after 2 consecutive successes
    timeout: 30000,             // 30s request timeout
    resetTimeout: 60000,        // Try HALF_OPEN after 60s
    monitoringWindow: 300000    // Track last 5 minutes of requests
  },
  retryPolicy: {
    maxRetries: 3,
    initialDelayMs: 1000,       // Start with 1s delay
    maxDelayMs: 30000,          // Cap at 30s
    backoffMultiplier: 2,       // Double each time
    jitterFactor: 0.1,          // +/- 10% randomization
    retryableErrors: ['ETIMEDOUT', 'ECONNRESET']
  },
  degradationStrategy: async () => {
    // Custom fallback logic
    return { success: false, cached: true }
  }
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
│  (Social Agent, Ads Agent, NotebookLM Service, etc.)       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Resilience Manager                         │
│  - Route requests to appropriate circuit breaker            │
│  - Apply retry policy                                       │
│  - Invoke degradation strategy if needed                    │
│  - Collect metrics                                          │
└─────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
     ┌──────────┐    ┌──────────┐    ┌──────────┐
     │ Circuit  │    │  Retry   │    │Degradation│
     │ Breaker  │    │  Policy  │    │ Strategy  │
     └──────────┘    └──────────┘    └──────────┘
            │               │               │
            └───────────────┼───────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   External APIs                             │
│  (Gmail, Facebook, Instagram, Twitter, Google Ads, etc.)   │
└─────────────────────────────────────────────────────────────┘
```

## Best Practices

1. **Always use resilient wrappers** for external API calls
2. **Provide fallback values** for non-critical operations
3. **Monitor the dashboard** regularly for service health
4. **Set appropriate timeouts** based on API characteristics
5. **Test degradation strategies** to ensure graceful handling
6. **Log circuit breaker trips** for alerting and investigation
7. **Reset manually** only when you're certain the issue is resolved

## Testing

```typescript
// Test circuit breaker opens on failures
for (let i = 0; i < 5; i++) {
  try {
    await withResilience('test-service', async () => {
      throw new Error('Simulated failure')
    })
  } catch (error) {
    // Expected
  }
}

// Circuit should now be OPEN
const health = resilienceManager.getServiceHealth('test-service')
console.log(health.state) // 'OPEN'
```

## Troubleshooting

### Circuit Breaker Stuck Open
- Check if the underlying service is actually down
- Review recent error logs
- Manually reset via dashboard or API
- Increase `resetTimeout` if service needs longer recovery

### Too Many Retries
- Reduce `maxRetries` for faster failure
- Increase `initialDelayMs` to reduce load
- Check if errors are actually retryable

### Degradation Not Working
- Verify degradation strategy is registered
- Check for errors in degradation function
- Ensure circuit breaker is in OPEN state

## License

Internal use only - Audico Systems
