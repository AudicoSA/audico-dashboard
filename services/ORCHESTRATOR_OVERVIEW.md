# Agent Orchestrator - Complete Implementation

## Overview

The Agent Orchestrator is a centralized service for managing, scheduling, and coordinating all agent activities in the Audico Dashboard system. It provides:

1. **Centralized Scheduling** - Automated agent execution using node-cron
2. **Inter-Agent Communication** - Message routing via squad_messages table
3. **Conflict Detection** - Prevents duplicate work across agents
4. **Token Budget Management** - Tracks and limits LLM API usage
5. **Real-time Status Updates** - Maintains agent status in squad_agents table

## File Structure

```
services/
├── orchestrator.ts          # Main orchestrator implementation
├── types.ts                 # TypeScript type definitions
├── config.ts               # Configuration and constants
├── README.md               # Documentation
├── USAGE_EXAMPLES.md       # Code examples and patterns
└── ORCHESTRATOR_OVERVIEW.md # This file

lib/
└── orchestrator-init.ts    # Initialization helper

app/api/squad/
└── route.ts                # Extended with orchestrator endpoints

supabase/migrations/
└── 004_email_logs.sql      # Email logs table migration

package.json                # Added node-cron dependency
```

## Core Features Implementation

### 1. Centralized Scheduling (node-cron)

**Location**: `services/orchestrator.ts` - `setupScheduledJobs()`

Schedules:
- Email polling: Every 5 minutes (`*/5 * * * *`)
- Email classification: Every 10 minutes (`*/10 * * * *`)
- Email response: Every 15 minutes (`*/15 * * * *`)
- Agent status updates: Every minute (`* * * * *`)
- Conflict checks: Every 2 minutes (`*/2 * * * *`)
- Token monitoring: Every 5 minutes (`*/5 * * * *`)
- Token reset: Daily at midnight (`0 0 * * *`)

**Configuration**: `services/config.ts` - `AGENT_SCHEDULES`

### 2. Inter-Agent Communication

**Location**: `services/orchestrator.ts` - `sendMessage()`, `logMessage()`

All messages stored in `squad_messages` table with structure:
```typescript
{
  from_agent: string
  to_agent: string | null
  message: string
  task_id: string | null
  data: JSONB
  created_at: timestamp
}
```

**Usage**:
```typescript
await orchestrator.sendMessage(
  'email_agent',
  'quote_agent',
  'Customer inquiry detected',
  'task-uuid',
  { emailId: '123', customerId: '456' }
)
```

### 3. Conflict Detection

**Location**: `services/orchestrator.ts` - `detectConflict()`, `registerOperation()`, `checkForConflicts()`

Prevents conflicts by:
- Tracking active operations in memory Map
- Checking for overlapping work (same emailId, customerId, etc.)
- 30-second conflict window (configurable)
- Automatic cleanup of stale operations (60 seconds)

**Usage**:
```typescript
const conflict = await orchestrator.detectConflict({
  emailId: 'email-123',
  timestamp: new Date(),
  agents: ['email_agent'],
  action: 'respond'
})

if (conflict) {
  // Defer or coordinate with conflicting agent
}
```

### 4. Token Budget Management

**Location**: `services/orchestrator.ts` - `checkTokenBudget()`, `trackTokenUsage()`, `resetTokenBudget()`

Features:
- Global daily budget (default: 100,000 tokens)
- Per-agent usage tracking
- Automatic daily reset at midnight
- Warning thresholds at 50%, 75%, 90%
- Blocks operations when budget exhausted

**Configuration**: `services/config.ts` - `ORCHESTRATOR_CONFIG.tokenBudget`

**Usage**:
```typescript
const canExecute = await orchestrator.checkTokenBudget('email_agent', 500)
if (canExecute) {
  // Perform LLM operation
  await orchestrator.trackTokenUsage('email_agent', 450)
}
```

### 5. Real-time Status Updates

**Location**: `services/orchestrator.ts` - `updateAgentStatus()`, `updateAgentStatuses()`

Status levels:
- `active`: Currently processing a task
- `idle`: Available but not processing (< 10 min inactive)
- `offline`: Not responding (> 60 min inactive)

Updates `squad_agents` table:
```typescript
{
  id: UUID
  name: string
  role: string
  status: 'active' | 'idle' | 'offline'
  last_active: timestamp
}
```

**Automatic**: Status inferred from `last_active` timestamp every minute

## API Endpoints

All orchestrator functionality is exposed via `/api/squad` with action parameters:

### GET Endpoints

1. **Get Status**
   ```
   GET /api/squad?action=orchestrator-status
   ```
   Returns: tokenBudget, activeOperations, timestamp

2. **Get All Squad Data (includes orchestrator)**
   ```
   GET /api/squad
   ```
   Returns: tasks, activity, agents, orchestrator

### POST Endpoints

1. **Initialize Orchestrator**
   ```
   POST /api/squad
   Body: { "action": "orchestrator-init" }
   ```

2. **Shutdown Orchestrator**
   ```
   POST /api/squad
   Body: { "action": "orchestrator-shutdown" }
   ```

3. **Send Message**
   ```
   POST /api/squad
   Body: {
     "action": "orchestrator-message",
     "fromAgent": "email_agent",
     "toAgent": "orchestrator",
     "message": "Task completed",
     "taskId": "uuid",
     "data": { ... }
   }
   ```

## Database Schema

### Required Tables

1. **squad_agents** (from migration 002)
   - Stores agent metadata and status
   - Updated by orchestrator every minute

2. **squad_messages** (from migration 002, extended in 003)
   - Stores all inter-agent messages
   - Includes JSONB data column for structured payloads

3. **squad_tasks** (from migration 002)
   - Task management (not directly used by orchestrator core)

4. **email_logs** (new migration 004)
   - Tracks Gmail emails for email agent
   - Used by orchestrator's email processing jobs

### Migration Files

- `002_squad_tables.sql` - Core squad tables
- `003_schema_extensions.sql` - Email classifications, social posts, etc.
- `004_email_logs.sql` - Email logs table (NEW)

## Configuration

### Environment Variables

Required:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_API_URL=http://localhost:3001  # or production URL
```

### Configurable Parameters

File: `services/config.ts`

```typescript
export const ORCHESTRATOR_CONFIG = {
  tokenBudget: 100000,              // Daily token limit
  tokenResetHour: 0,                // Reset at midnight
  conflictWindowSeconds: 30,         // Conflict detection window
  operationTimeoutSeconds: 60,       // Operation stale timeout
  statusCheckIntervalMinutes: 1      // How often to check statuses
}
```

### Cron Schedules

File: `services/config.ts`

```typescript
export const AGENT_SCHEDULES = {
  EMAIL_POLL: '*/5 * * * *',        // Every 5 minutes
  EMAIL_CLASSIFY: '*/10 * * * *',   // Every 10 minutes
  EMAIL_RESPOND: '*/15 * * * *',    // Every 15 minutes
  STATUS_UPDATE: '* * * * *',       // Every minute
  CONFLICT_CHECK: '*/2 * * * *',    // Every 2 minutes
  TOKEN_MONITOR: '*/5 * * * *'      // Every 5 minutes
}
```

## Dependencies

Added to `package.json`:

```json
{
  "dependencies": {
    "node-cron": "^3.0.3"
  },
  "devDependencies": {
    "@types/node-cron": "^3.0.11"
  }
}
```

## Usage Patterns

### 1. Application Startup

```typescript
// In your app initialization or API route
import { initializeOrchestrator } from '@/lib/orchestrator-init'

await initializeOrchestrator()
```

### 2. Agent Integration

```typescript
// In any agent API route
import orchestrator from '@/services/orchestrator'

// Check token budget
const budget = orchestrator.getTokenBudget()
if (budget.remaining < 500) {
  return { error: 'Insufficient tokens' }
}

// Send message
await orchestrator.sendMessage(
  'my_agent',
  null,
  'Operation completed',
  null,
  { result: 'success' }
)
```

### 3. Frontend Monitoring

```typescript
// React component
const [status, setStatus] = useState(null)

useEffect(() => {
  const fetchStatus = async () => {
    const res = await fetch('/api/squad?action=orchestrator-status')
    const data = await res.json()
    setStatus(data)
  }
  
  const interval = setInterval(fetchStatus, 5000)
  return () => clearInterval(interval)
}, [])
```

## Extending the Orchestrator

### Adding New Agents

1. Create agent API routes in `app/api/agents/[agent-name]/`
2. Add agent to `squad_agents` table
3. Add scheduled job in `orchestrator.ts`:

```typescript
this.scheduledJobs.set('my_agent_job', cron.schedule('*/20 * * * *', async () => {
  await this.executeAgentTask('my_agent', 'task_name', '/api/agents/my-agent/task')
}))
```

### Custom Conflict Resolution

Extend `detectConflict()` method to handle new conflict types:

```typescript
if (newOperation.orderId) {
  const existing = this.activeOperations.get(`order-${newOperation.orderId}`)
  if (existing && this.isWithinConflictWindow(existing, newOperation)) {
    return existing
  }
}
```

### Per-Agent Token Limits

Add to `config.ts` and check in `checkTokenBudget()`:

```typescript
const AGENT_LIMITS = {
  'email_agent': 50000,
  'quote_agent': 30000
}

if (agentUsage[agentName] + tokensNeeded > AGENT_LIMITS[agentName]) {
  return false
}
```

## Testing

### Manual Testing

1. Initialize:
   ```bash
   curl -X POST http://localhost:3001/api/squad \
     -H "Content-Type: application/json" \
     -d '{"action": "orchestrator-init"}'
   ```

2. Check status:
   ```bash
   curl http://localhost:3001/api/squad?action=orchestrator-status
   ```

3. Send message:
   ```bash
   curl -X POST http://localhost:3001/api/squad \
     -H "Content-Type: application/json" \
     -d '{
       "action": "orchestrator-message",
       "fromAgent": "test_agent",
       "message": "Test message"
     }'
   ```

### Integration Testing

The orchestrator automatically:
- Polls emails every 5 minutes (if Gmail configured)
- Updates agent statuses every minute
- Monitors token usage every 5 minutes
- Checks for conflicts every 2 minutes

Watch `squad_messages` table to see activity.

## Troubleshooting

### Orchestrator Not Starting

- Check environment variables are set
- Verify Supabase connection
- Check `squad_agents` table exists

### Jobs Not Running

- Verify `initialize()` was called
- Check cron syntax in `AGENT_SCHEDULES`
- Look for errors in server logs

### High Token Usage

- Check `tokenBudget` in orchestrator status
- Review `agentUsage` breakdown
- Adjust token estimates in `config.ts`

### Conflicts Not Detected

- Verify conflict window is appropriate (30s default)
- Check `activeOperations` are being registered
- Ensure cleanup job is running (every 2 min)

## Performance Considerations

### Memory Usage

- activeOperations Map: ~1KB per operation
- Typical: 10-50 concurrent operations = 10-50KB
- Automatic cleanup prevents growth

### Database Load

- Status updates: 1 query per agent per minute
- Message inserts: Variable (depends on agent activity)
- Scheduled queries run at different intervals to spread load

### Scaling

For high-volume systems:
- Increase token budget
- Adjust cron intervals
- Consider distributed orchestrator (Redis for shared state)
- Use database connection pooling

## Security

- Uses service role key for Supabase (server-side only)
- No tokens or sensitive data in messages
- RLS policies on all tables
- No external API calls from orchestrator (agents handle those)

## Maintenance

### Daily Tasks

- Monitor token budget usage
- Check for conflict patterns
- Review agent status distribution

### Weekly Tasks

- Analyze message patterns
- Review scheduled job performance
- Check for stale operations

### Monthly Tasks

- Adjust token budgets based on usage
- Review and optimize cron schedules
- Update agent priorities

## Support

For issues or questions:
1. Check logs in `squad_messages` table
2. Review agent status in `squad_agents` table
3. Use `/api/squad?action=orchestrator-status` for diagnostics
4. Refer to USAGE_EXAMPLES.md for code patterns
