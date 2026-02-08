# Orchestrator Usage Examples

## Basic Setup

### 1. Initialize on Application Start

Create an API endpoint or middleware to initialize:

```typescript
// app/api/startup/route.ts
import { NextResponse } from 'next/server'
import { initializeOrchestrator } from '@/lib/orchestrator-init'

export async function POST() {
  try {
    await initializeOrchestrator()
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to initialize' }, { status: 500 })
  }
}
```

### 2. Frontend Integration

```typescript
// In your React component or dashboard
async function initOrchestrator() {
  const response = await fetch('/api/squad', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'orchestrator-init' })
  })
  
  const data = await response.json()
  console.log(data.message) // "Orchestrator initialized"
}
```

## Monitoring Dashboard

### Fetch Real-time Status

```typescript
async function fetchOrchestratorStatus() {
  const response = await fetch('/api/squad?action=orchestrator-status')
  const data = await response.json()
  
  return {
    tokenBudget: data.tokenBudget,
    activeOperations: data.activeOperations,
    timestamp: data.timestamp
  }
}

// Usage in React
function OrchestratorDashboard() {
  const [status, setStatus] = useState(null)
  
  useEffect(() => {
    const interval = setInterval(async () => {
      const newStatus = await fetchOrchestratorStatus()
      setStatus(newStatus)
    }, 5000) // Update every 5 seconds
    
    return () => clearInterval(interval)
  }, [])
  
  return (
    <div>
      <h2>Token Usage</h2>
      <p>Used: {status?.tokenBudget.used} / {status?.tokenBudget.total}</p>
      
      <h2>Active Operations</h2>
      <ul>
        {status?.activeOperations.map(op => (
          <li key={op.emailId || op.customerId}>
            {op.action} by {op.agents.join(', ')}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

## Agent Integration

### Email Agent Example

```typescript
// app/api/agents/email/custom/route.ts
import { NextRequest, NextResponse } from 'next/server'
import orchestrator from '@/services/orchestrator'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { emailId } = body
  
  // Check for conflicts
  const conflict = orchestrator.getActiveOperations().find(
    op => op.emailId === emailId
  )
  
  if (conflict) {
    await orchestrator.sendMessage(
      'email_agent',
      'orchestrator',
      `Conflict detected for email ${emailId}`,
      null,
      { emailId, conflictingAgents: conflict.agents }
    )
    
    return NextResponse.json({
      error: 'Email is being processed by another agent',
      conflictingAgents: conflict.agents
    }, { status: 409 })
  }
  
  // Check token budget
  const budget = orchestrator.getTokenBudget()
  if (budget.remaining < 500) {
    await orchestrator.sendMessage(
      'email_agent',
      'orchestrator',
      'Insufficient tokens for email processing',
      null,
      { emailId, tokensNeeded: 500, tokensRemaining: budget.remaining }
    )
    
    return NextResponse.json({
      error: 'Insufficient token budget'
    }, { status: 429 })
  }
  
  // Process email...
  
  // Log completion
  await orchestrator.sendMessage(
    'email_agent',
    null,
    `Processed email ${emailId}`,
    null,
    { emailId, tokensUsed: 450 }
  )
  
  return NextResponse.json({ success: true })
}
```

### Quote Chat Agent Example

```typescript
// app/api/agents/quote-chat/route.ts
import { NextRequest, NextResponse } from 'next/server'
import orchestrator from '@/services/orchestrator'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { customerId, message } = body
  
  // Check if email agent is already handling this customer
  const conflict = orchestrator.getActiveOperations().find(
    op => op.customerId === customerId && op.agents.includes('email_agent')
  )
  
  if (conflict) {
    // Coordinate with email agent
    await orchestrator.sendMessage(
      'quote_chat_agent',
      'email_agent',
      `Customer ${customerId} active in both channels`,
      null,
      { customerId, action: 'coordinate_response' }
    )
    
    // Wait or defer to email agent
    return NextResponse.json({
      status: 'deferred',
      message: 'Email agent is handling this customer'
    })
  }
  
  // Register operation to prevent conflicts
  // Note: This should be done in the orchestrator, shown here for illustration
  
  // Process quote chat...
  
  return NextResponse.json({ success: true })
}
```

## Custom Scheduled Jobs

### Adding a New Agent Job

```typescript
// In services/orchestrator.ts, add to setupScheduledJobs():

this.scheduledJobs.set('quote_check', cron.schedule('*/20 * * * *', async () => {
  await this.executeAgentTask('quote_agent', 'check_quotes', '/api/agents/quote/check')
}))

this.scheduledJobs.set('seo_audit', cron.schedule('0 2 * * *', async () => {
  await this.executeAgentTask('seo_agent', 'daily_audit', '/api/agents/seo/audit')
}))
```

## Token Budget Management

### Adjusting Token Allocation

```typescript
// In services/orchestrator.ts, modify the constructor:

private tokenBudget: TokenBudget = {
  total: 200000,  // Increased from 100,000
  used: 0,
  remaining: 200000,
  agentUsage: {}
}
```

### Per-Agent Token Limits

```typescript
// Add to orchestrator.ts:

private readonly AGENT_TOKEN_LIMITS: Record<string, number> = {
  'email_agent': 50000,
  'quote_agent': 30000,
  'seo_agent': 20000,
  'content_agent': 40000
}

private async checkTokenBudget(agentName: string, tokensNeeded: number): Promise<boolean> {
  // Check global budget
  if (this.tokenBudget.remaining < tokensNeeded) {
    return false
  }
  
  // Check per-agent limit
  const agentLimit = this.AGENT_TOKEN_LIMITS[agentName] || Infinity
  const agentUsed = this.tokenBudget.agentUsage[agentName] || 0
  
  if (agentUsed + tokensNeeded > agentLimit) {
    await this.logMessage('orchestrator', 
      `Agent ${agentName} reached token limit`,
      { agentUsed, agentLimit, tokensNeeded }
    )
    return false
  }
  
  return true
}
```

## Error Handling

### Graceful Degradation

```typescript
// In your API routes:
export async function POST(request: NextRequest) {
  try {
    const { orchestrator } = await import('@/services/orchestrator')
    
    // Use orchestrator features
    const budget = orchestrator.getTokenBudget()
    
    // ... your code
  } catch (error) {
    // Orchestrator not initialized, continue without it
    console.warn('Orchestrator not available:', error)
    
    // ... fallback logic
  }
}
```

## Testing

### Mock Orchestrator for Tests

```typescript
// tests/mocks/orchestrator.ts
export const mockOrchestrator = {
  initialize: jest.fn(),
  shutdown: jest.fn(),
  getTokenBudget: jest.fn(() => ({
    total: 100000,
    used: 0,
    remaining: 100000,
    agentUsage: {}
  })),
  getActiveOperations: jest.fn(() => []),
  sendMessage: jest.fn()
}
```

## Deployment Considerations

### Environment Variables

Ensure these are set:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_API_URL=https://your-domain.com  # or http://localhost:3001 for dev
```

### Production Initialization

Consider initializing on first API request rather than on server start:

```typescript
// lib/orchestrator-lazy-init.ts
let initPromise: Promise<void> | null = null

export async function ensureOrchestratorInitialized() {
  if (!initPromise) {
    initPromise = import('@/services/orchestrator').then(
      ({ orchestrator }) => orchestrator.initialize()
    )
  }
  
  await initPromise
}
```

Then use in API routes:
```typescript
export async function POST(request: NextRequest) {
  await ensureOrchestratorInitialized()
  
  // ... rest of your code
}
```
