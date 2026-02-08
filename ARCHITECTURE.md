# Monitoring System Architecture

## System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Agent Operations                          │
│  (Email Agent, Orders Agent, Stock Agent, etc.)                 │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ Success/Error Events
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    lib/logger.ts                                 │
│              logAgentActivity()                                  │
│  • Logs to Supabase agent_logs table                            │
│  • Checks log level                                              │
└────────────┬────────────────────────────┬─────────────────────┘
             │                            │
             │ All Logs                   │ Error/Critical Only
             ▼                            ▼
┌──────────────────────────┐   ┌─────────────────────────────────┐
│  Supabase Database       │   │  /api/alerts/send               │
│  agent_logs table        │   │  • Send SMS via Twilio          │
│  • agent_name            │   │  • Send Email alerts            │
│  • log_level             │   └─────────────────────────────────┘
│  • event_type            │
│  • message               │
│  • error_details         │
│  • context               │
│  • created_at            │
└──────────┬───────────────┘
           │
           │ Queried every 30s
           ▼
┌─────────────────────────────────────────────────────────────────┐
│                 /api/agents/health (GET)                         │
│  • Query squad_agents table                                      │
│  • Query agent_logs (last 24h)                                   │
│  • Calculate uptime %                                            │
│  • Calculate error rate                                          │
│  • Determine agent health status                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ JSON Response
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│          SystemHealthWidget.tsx (Dashboard)                      │
│  • Display 24h uptime                                            │
│  • Show active/idle agents                                       │
│  • Show error rate                                               │
│  • List recent errors                                            │
│  • Auto-refresh every 30s                                        │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Logging Flow (Server-Side)
```typescript
Agent Operation → logAgentActivity() → Supabase agent_logs
                                    ↓
                          (if error/critical)
                                    ↓
                          /api/alerts/send → Twilio SMS + Email
```

### 2. Logging Flow (Client-Side)
```typescript
Client Component → logClientError() → /api/logs/create → logAgentActivity()
                                                              ↓
                                                    Supabase agent_logs
                                                              ↓
                                                   (if error/critical)
                                                              ↓
                                                   /api/alerts/send
```

### 3. Health Monitoring Flow
```typescript
SystemHealthWidget (every 30s)
    ↓
/api/agents/health
    ↓
Query Supabase (squad_agents + agent_logs)
    ↓
Calculate Metrics
    ↓
Return JSON Response
    ↓
Update Widget UI
```

## Component Responsibilities

### Database Layer (Supabase)
- **Tables**:
  - `agent_logs`: All agent activity and error logs
  - `squad_agents`: Agent status and metadata
  - `squad_messages`: Inter-agent communication

### API Layer
- **Health Endpoint** (`/api/agents/health`):
  - Aggregate agent data
  - Calculate health metrics
  - Provide monitoring data
  
- **Alert Endpoint** (`/api/alerts/send`):
  - Send Twilio SMS alerts
  - Send email alerts
  - Handle alert delivery
  
- **Log Creation** (`/api/logs/create`):
  - Accept client-side logs
  - Forward to server logger
  - Validate input

### Application Layer
- **Server Logger** (`lib/logger.ts`):
  - Write to database
  - Trigger alerts
  - Handle errors
  
- **Client Logger** (`lib/client-logger.ts`):
  - Call API endpoint
  - Handle client errors
  - Non-blocking

### UI Layer
- **SystemHealthWidget**:
  - Poll health endpoint
  - Display metrics
  - Show recent errors
  - Auto-refresh

## Integration Points

### Adding Logging to a New Agent

```typescript
import { logAgentActivity } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    // Log start
    await logAgentActivity({
      agentName: 'new_agent',
      logLevel: 'info',
      eventType: 'operation_start',
      message: 'Starting new operation',
      context: { /* data */ }
    })
    
    // Do work...
    
    // Log success
    await logAgentActivity({
      agentName: 'new_agent',
      logLevel: 'info',
      eventType: 'operation_complete',
      message: 'Operation completed successfully',
      context: { /* results */ }
    })
    
  } catch (error: any) {
    // Log error (auto-triggers alert)
    await logAgentActivity({
      agentName: 'new_agent',
      logLevel: 'error',
      eventType: 'operation_failed',
      message: error.message,
      errorDetails: {
        error: error.message,
        stack: error.stack
      },
      context: { /* failure context */ }
    })
  }
}
```

## Alert Configuration

### Twilio SMS Setup
1. Create Twilio account
2. Get Account SID and Auth Token
3. Purchase phone number
4. Add to `.env.local`:
   ```
   TWILIO_ACCOUNT_SID=ACxxxxx
   TWILIO_AUTH_TOKEN=xxxxx
   TWILIO_PHONE_NUMBER=+1234567890
   ALERT_PHONE_NUMBER=+0987654321
   ```

### Email Alerts
- Uses existing email system
- Configure `ALERT_EMAIL` in `.env.local`
- Integrates with `/api/agents/email/send`

## Health Status Thresholds

### Agent Health Status
- **Healthy**: 0 errors in 24h, active/idle status
- **Degraded**: 1-5 errors in 24h OR inactive >60 min
- **Critical**: >5 errors in 24h
- **Offline**: Status = offline

### Alert Triggers
- **Error**: Immediate SMS + Email
- **Critical**: Immediate SMS + Email
- **Warning**: Logged only
- **Info**: Logged only

## Performance Considerations

### Database Queries
- Agent logs indexed on: `agent_name`, `log_level`, `created_at`
- Health endpoint queries last 24h only
- Efficient filtering with WHERE clauses

### Widget Refresh
- 30-second polling interval (configurable)
- Minimal payload size
- Error handling for failed requests

### Alert Rate Limiting
- Consider implementing rate limiting for alerts
- Prevent alert storms
- Group similar errors

## Security

### API Endpoints
- Use Supabase service role key for server operations
- Validate input on `/api/logs/create`
- Protect Twilio credentials

### Data Access
- RLS enabled on all tables
- Service role bypasses RLS for system operations
- Client queries use anon key

## Scalability

### Current Limitations
- 30s polling may not scale to 100+ agents
- Consider WebSocket/SSE for real-time updates
- Alert system has no rate limiting

### Future Improvements
- Implement alert aggregation
- Add alert muting/snoozing
- Create alert rules engine
- Add webhook support
- Implement metrics dashboard
- Add log retention policies
