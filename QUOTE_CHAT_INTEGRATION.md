# Quote Chat System Integration

This document describes the integration between the Audico Dashboard and the AUDICO-CHAT-QUOTE-X Supabase instance, enabling seamless quote management across email, chat, and customer systems.

## Overview

The Quote Chat Integration provides a comprehensive bridge between:
- **AUDICO-CHAT-QUOTE-X**: External quote chat system with customer conversations
- **Audico Dashboard**: Main dashboard with email agents, customer timeline, and quote management
- **Email Agent**: Automated email processing with quote detection
- **PDF Generation**: Automated quote document generation

## Features

### 1. Quote Session Fetching
- Retrieve active quote sessions from the AUDICO-CHAT-QUOTE-X Supabase
- Filter sessions by status (active, pending_quote, quote_sent, etc.)
- Search sessions by customer email, phone, or name
- Get detailed session information including messages and statistics

### 2. Email-to-Chat Linking
- Automatically detect quote requests in incoming emails
- Link emails to existing quote chat sessions by customer
- Create quote requests from email interactions
- Track email history within quote sessions

### 3. Automated PDF Quote Generation
- Trigger PDF generation when quote requests are detected
- Queue quotes for processing via squad messages
- Track quote generation status
- Link generated PDFs to sessions and emails

### 4. Customer Data Synchronization
- Sync quote sessions to customer interaction timeline
- Maintain unified customer view across systems
- Track all quote-related activities
- Enable cross-system customer analytics

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AUDICO-CHAT-QUOTE-X                      │
│                      (Supabase)                             │
│  ┌─────────────────┐        ┌──────────────────┐          │
│  │ quote_sessions  │        │ quote_messages   │          │
│  └─────────────────┘        └──────────────────┘          │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ API Bridge
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              /api/integrations/quote-chat                   │
│                    (API Route)                              │
│  - Fetch active sessions                                    │
│  - Link emails to sessions                                  │
│  - Trigger quote generation                                 │
│  - Sync customer data                                       │
└─────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴────────────┐
                │                        │
                ▼                        ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│  Dashboard Supabase      │  │  Email Agent             │
│  - quote_requests        │  │  - Email polling         │
│  - customer_interactions │  │  - Quote detection       │
│  - email_logs            │  │  - Auto-response         │
│  - squad_messages        │  │  - PDF trigger           │
└──────────────────────────┘  └──────────────────────────┘
```

## Setup

### 1. Environment Configuration

Add to `.env.local`:

```bash
# Quote Chat Integration
AUDICO_CHAT_QUOTE_SUPABASE_URL=https://your-quote-chat.supabase.co
AUDICO_CHAT_QUOTE_SUPABASE_KEY=your_service_role_key
```

### 2. Database Tables

#### AUDICO-CHAT-QUOTE-X Supabase

Ensure these tables exist:

```sql
-- quote_sessions table
CREATE TABLE quote_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT UNIQUE NOT NULL,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  company_name TEXT,
  status TEXT DEFAULT 'active',
  messages JSONB DEFAULT '[]',
  quote_items JSONB DEFAULT '[]',
  total_amount NUMERIC,
  currency TEXT DEFAULT 'USD',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW()
);

-- quote_messages table
CREATE TABLE quote_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT REFERENCES quote_sessions(session_id),
  sender_type TEXT NOT NULL,
  sender_name TEXT,
  message TEXT NOT NULL,
  attachments TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Dashboard Supabase

Ensure this table exists:

```sql
-- quote_requests table
CREATE TABLE quote_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT,
  email_id TEXT,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  company_name TEXT,
  items JSONB DEFAULT '[]',
  notes TEXT,
  status TEXT DEFAULT 'pending',
  quote_number TEXT UNIQUE,
  quote_amount NUMERIC,
  quote_pdf_url TEXT,
  valid_until TIMESTAMPTZ,
  generated_by TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3. Cron Job Setup

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/quote-chat/sync",
      "schedule": "0 */4 * * *"
    }
  ]
}
```

This syncs quote sessions every 4 hours.

## Usage

### Fetching Active Quote Sessions

```typescript
const response = await fetch('/api/integrations/quote-chat?action=active')
const data = await response.json()
console.log(`${data.count} active sessions`)
```

### Processing Email Quote Request

```typescript
// In email agent processing logic
import { processEmailForQuoteRequest } from '@/lib/email-quote-handler'

const result = await processEmailForQuoteRequest(emailLog)

if (result.isQuoteRequest && result.processed) {
  console.log(`Quote request created: ${result.quoteRequestId}`)
}
```

### Linking Email to Existing Session

```typescript
await fetch('/api/integrations/quote-chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'link_email',
    email_id: 'email-uuid',
    session_id: 'session-123',
    email_sender: 'customer@example.com'
  })
})
```

### Creating Quote from Session

```typescript
await fetch('/api/integrations/quote-chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'create_quote',
    session_id: 'session-123'
  })
})
```

### Syncing Customer Data

```typescript
// Manual sync for single session
await fetch('/api/integrations/quote-chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'sync_customer',
    session_id: 'session-123'
  })
})

// Sync all active sessions
await fetch('/api/integrations/quote-chat?action=sync')
```

## Integration with Email Agent

### Automatic Quote Detection

The Email Agent automatically detects quote requests using keyword analysis:

**Quote Keywords:**
- "quote", "quotation", "price", "pricing", "cost", "estimate"
- "how much", "what would it cost", "can you provide"
- "need a quote", "send quote", "quote please"

### Email Processing Flow

1. **Email Received** → Email Agent polls Gmail
2. **Quote Detection** → Analyze subject and body
3. **Session Matching** → Find existing quote session by email
4. **Link Email** → Connect email to session
5. **Create Quote Request** → Generate formal quote
6. **Trigger PDF** → Queue PDF generation
7. **Customer Sync** → Update customer timeline

### Example Integration

```typescript
// app/api/agents/email/poll/route.ts
import { processEmailForQuoteRequest } from '@/lib/email-quote-handler'

// After classifying email
const quoteResult = await processEmailForQuoteRequest(emailLog)

if (quoteResult.isQuoteRequest) {
  await supabase
    .from('email_logs')
    .update({ 
      category: 'inquiry',
      status: 'quote_processing' 
    })
    .eq('id', emailLog.id)
}
```

## PDF Quote Generation

When a quote request is created, the system:

1. Creates `quote_request` record with status 'pending'
2. Sends message to `squad_messages` table
3. Updates status to 'processing'
4. Quote Agent (separate service) picks up the task
5. Generates PDF using quote template
6. Updates `quote_pdf_url` field
7. Updates status to 'sent'
8. Sends PDF to customer email

### Quote Number Format

Quotes are numbered automatically: `Q-YYYYMMDD-XXXX`

Example: `Q-20240208-1234`

## Customer Data Synchronization

### What Gets Synced

Every quote session creates/updates a `customer_interactions` record:

```typescript
{
  customer_id: customer_email,
  interaction_type: 'chat',
  interaction_source: 'audico-quote-chat',
  reference_type: 'quote_chat_session',
  reference_id: session_id,
  details: {
    session_id,
    quote_items,
    total_amount,
    currency,
    company_name,
    messages_count
  }
}
```

### Sync Schedule

- **Automatic**: When quote requests are created
- **Cron**: Every 4 hours via `/api/cron/quote-chat/sync`
- **Manual**: Via API call with `action=sync`

## API Reference

See detailed API documentation in:
- `/app/api/integrations/quote-chat/README.md`

## Monitoring

All integration activities are logged to:

1. **squad_messages** - Integration events, errors, status updates
2. **agent_logs** - Detailed logging with error tracking
3. **customer_interactions** - Customer-facing activity timeline

### Key Events Logged

- `quote_chat_session_sync` - Session synchronized
- `quote_request_created` - New quote request
- `pdf_generation_triggered` - PDF queued
- `email_linked_to_session` - Email-session link
- `customer_data_synced` - Customer timeline update

## Error Handling

The integration includes comprehensive error handling:

- **Connection Failures**: Graceful degradation, retry logic
- **Missing Data**: Validation with clear error messages
- **Sync Errors**: Individual session failures don't block batch
- **Logging**: All errors logged to agent_logs table

## Security

- API endpoints use internal authentication
- Supabase service role keys for cross-instance access
- No customer data exposed in logs
- All connections use HTTPS/TLS

## Testing

### Test Active Sessions

```bash
curl http://localhost:3001/api/integrations/quote-chat?action=active
```

### Test Quote Detection

```typescript
import { extractQuoteRequestFromEmail } from '@/lib/quote-chat'

const result = extractQuoteRequestFromEmail(
  'Request for Quote',
  'I need pricing for 10x Product A',
  'customer@example.com'
)

console.log(result.isQuoteRequest) // true
console.log(result.items) // ['10x Product A']
```

### Test Sync

```bash
curl http://localhost:3001/api/integrations/quote-chat?action=sync
```

## Troubleshooting

### Sessions Not Appearing

1. Check environment variables are set
2. Verify Supabase URL and key
3. Check table permissions
4. Review agent_logs for errors

### Emails Not Linking

1. Verify customer email matches session
2. Check email_logs table for email record
3. Ensure session is not abandoned
4. Review squad_messages for link attempts

### PDF Not Generating

1. Check quote_requests table for status
2. Verify squad_messages contains trigger
3. Ensure Quote Agent is running
4. Check PDF service availability

### Customer Data Not Syncing

1. Verify customer has email or phone
2. Check customer_interactions table
3. Review cron job execution
4. Check sync endpoint logs

## Future Enhancements

- Real-time session updates via webhooks
- Advanced quote templating system
- Multi-currency support
- Quote version tracking
- Customer preference management
- Automated follow-up reminders
- Quote acceptance workflow
- Integration with accounting systems
