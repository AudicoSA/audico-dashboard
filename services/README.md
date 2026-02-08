# Agent Orchestrator

The Agent Orchestrator is a centralized service that manages and coordinates all agent activities in the system.

## Features

### 1. Centralized Scheduling
- Uses `node-cron` for agent execution intervals
- Schedules:
  - Email polling: Every 5 minutes
  - Email classification: Every 10 minutes
  - Email response: Every 15 minutes
  - Agent status updates: Every minute
  - Conflict checks: Every 2 minutes
  - Token monitoring: Every 5 minutes
  - Token budget reset: Daily at midnight

### 2. Inter-Agent Communication
- All communication routed through `squad_messages` table
- Message structure includes:
  - from_agent: Source agent
  - to_agent: Target agent (nullable for broadcasts)
  - message: Human-readable message
  - task_id: Related task (optional)
  - data: JSON payload for structured data

### 3. Conflict Detection
- Tracks active operations to prevent duplicate work
- Detects conflicts when multiple agents target same:
  - Email ID
  - Customer ID
- 30-second conflict window
- Automatic cleanup of stale operations (60 seconds)

### 4. Token Budget Management
- Configurable daily token budget (default: 100,000)
- Per-agent token usage tracking
- Automatic budget reset at configured hour (default: midnight)
- Warning alerts at 75% and 90% usage
- Blocks operations when budget exhausted

### 5. Real-time Status Updates
- Updates `squad_agents` table status field
- Status levels:
  - `active`: Currently processing
  - `idle`: Available but not processing (< 10 min inactive)
  - `offline`: Not responding (> 60 min inactive)
- Automatic status inference from last_active timestamp

## API Usage

### Initialize Orchestrator
```bash
POST /api/squad
{
  "action": "orchestrator-init"
}
```

### Shutdown Orchestrator
```bash
POST /api/squad
{
  "action": "orchestrator-shutdown"
}
```

### Send Message
```bash
POST /api/squad
{
  "action": "orchestrator-message",
  "fromAgent": "email_agent",
  "toAgent": "orchestrator",
  "message": "Email classified",
  "taskId": "uuid-optional",
  "data": { "emailId": "123", "category": "support" }
}
```

### Get Status
```bash
GET /api/squad?action=orchestrator-status
```

Returns:
```json
{
  "tokenBudget": {
    "total": 100000,
    "used": 5000,
    "remaining": 95000,
    "agentUsage": {
      "email_agent": 5000
    }
  },
  "activeOperations": [
    {
      "emailId": "abc123",
      "timestamp": "2024-01-01T12:00:00Z",
      "agents": ["email_agent"],
      "action": "respond"
    }
  ],
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## Programmatic Usage

```typescript
import orchestrator from '@/services/orchestrator'

// Initialize
await orchestrator.initialize()

// Send message
await orchestrator.sendMessage(
  'my_agent',
  'other_agent',
  'Hello from my_agent',
  'task-id-123',
  { custom: 'data' }
)

// Get status
const agents = await orchestrator.getAgentStatuses()
const budget = orchestrator.getTokenBudget()
const conflicts = orchestrator.getActiveOperations()

// Shutdown
await orchestrator.shutdown()
```

## Configuration

Environment variables:
- `NEXT_PUBLIC_API_URL`: Base URL for API calls (default: http://localhost:3001)
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key

Token budget can be adjusted in `services/orchestrator.ts`:
```typescript
private tokenBudget: TokenBudget = {
  total: 100000,  // Adjust this value
  used: 0,
  remaining: 100000,
  agentUsage: {}
}
```

## Extension Points

### Adding New Scheduled Jobs

```typescript
private async setupScheduledJobs() {
  // ... existing jobs ...
  
  this.scheduledJobs.set('my_job', cron.schedule('*/10 * * * *', async () => {
    await this.executeAgentTask('my_agent', 'my_task', '/api/agents/my-agent/task')
  }))
}
```

### Custom Conflict Detection

```typescript
private async detectConflict(newOperation: ConflictDetection): Promise<ConflictDetection | null> {
  // Add custom conflict detection logic
  // Example: Check for quote conflicts
  if (newOperation.quoteId) {
    const existing = this.activeOperations.get(newOperation.quoteId)
    if (existing && this.isWithinTimeWindow(existing, newOperation)) {
      return existing
    }
  }
  
  // ... existing logic ...
}
```

## Architecture

The orchestrator follows a singleton pattern and maintains:
- `isRunning`: Boolean flag for orchestrator state
- `scheduledJobs`: Map of cron jobs
- `tokenBudget`: Token usage tracking
- `activeOperations`: In-flight operation tracking

All state is synchronized with the database through the `squad_agents` and `squad_messages` tables.
