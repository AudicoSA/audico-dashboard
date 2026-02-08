# Quote Chat Integration API

This API provides a bridge between the Audico Dashboard and the AUDICO-CHAT-QUOTE-X Supabase instance, enabling seamless integration of quote chat sessions with email agents, customer data, and PDF quote generation.

## Overview

The Quote Chat Integration enables:
- Fetching active quote sessions from the AUDICO-CHAT-QUOTE-X Supabase
- Linking Email Agent responses to quote chat conversations
- Automated PDF quote generation triggered from email requests
- Customer data synchronization between systems
- Session status tracking and updates

## Configuration

Add these environment variables to your `.env.local`:

```bash
# Quote Chat Supabase Configuration
AUDICO_CHAT_QUOTE_SUPABASE_URL=https://your-quote-chat-instance.supabase.co
AUDICO_CHAT_QUOTE_SUPABASE_KEY=your_quote_chat_supabase_key
```

## API Endpoints

### GET Endpoints

#### Get Active Quote Sessions
```http
GET /api/integrations/quote-chat?action=active&limit=50
```

Returns all active and pending quote sessions.

**Response:**
```json
{
  "success": true,
  "sessions": [...],
  "count": 10
}
```

#### Get Single Session with Messages
```http
GET /api/integrations/quote-chat?action=session&session_id=xxx
```

Returns complete session details including messages and statistics.

**Response:**
```json
{
  "success": true,
  "session": {...},
  "messages": [...],
  "stats": {
    "total_messages": 15,
    "customer_messages": 8,
    "agent_messages": 7,
    "duration_minutes": 45
  }
}
```

#### Search Sessions by Customer
```http
GET /api/integrations/quote-chat?action=search&email=customer@example.com
GET /api/integrations/quote-chat?action=search&phone=+1234567890
GET /api/integrations/quote-chat?action=search&name=John
```

Search for sessions by customer email, phone, or name.

**Response:**
```json
{
  "success": true,
  "sessions": [...],
  "count": 3
}
```

#### Sync All Active Sessions
```http
GET /api/integrations/quote-chat?action=sync
```

Syncs all active quote sessions to the customer interactions timeline.

**Response:**
```json
{
  "success": true,
  "synced": 10,
  "total": 10
}
```

### POST Endpoints

#### Link Email to Quote Session
```http
POST /api/integrations/quote-chat
Content-Type: application/json

{
  "action": "link_email",
  "email_id": "email_log_id",
  "session_id": "quote_session_id",
  "email_sender": "customer@example.com"
}
```

Links an email log entry to a quote chat session.

**Response:**
```json
{
  "success": true,
  "linked": true,
  "session_id": "xxx",
  "email_id": "yyy"
}
```

#### Process Email Quote Request
```http
POST /api/integrations/quote-chat
Content-Type: application/json

{
  "action": "process_email_quote",
  "email_id": "email_log_id",
  "email_sender": "customer@example.com",
  "email_subject": "Quote Request for Products",
  "email_body": "I need a quote for..."
}
```

Automatically detects quote requests in emails, links them to existing sessions, and triggers quote generation if appropriate.

**Response:**
```json
{
  "success": true,
  "linked": true,
  "session": {...},
  "quote_request": {...}
}
```

#### Create Quote Request from Session
```http
POST /api/integrations/quote-chat
Content-Type: application/json

{
  "action": "create_quote",
  "session_id": "quote_session_id",
  "email_id": "email_log_id" // optional
}
```

Creates a formal quote request and triggers PDF generation.

**Response:**
```json
{
  "success": true,
  "quote_request": {
    "id": "xxx",
    "quote_number": "Q-20240208-1234",
    "status": "processing",
    ...
  },
  "pdf_generation_triggered": true
}
```

#### Sync Customer Data
```http
POST /api/integrations/quote-chat
Content-Type: application/json

{
  "action": "sync_customer",
  "session_id": "quote_session_id"
}
```

Manually sync a single session to customer interactions.

**Response:**
```json
{
  "success": true,
  "synced": true,
  "session_id": "xxx"
}
```

#### Update Session Status
```http
POST /api/integrations/quote-chat
Content-Type: application/json

{
  "action": "update_status",
  "session_id": "quote_session_id",
  "status": "quote_sent",
  "metadata": {
    "additional": "data"
  }
}
```

Updates the status of a quote session.

**Response:**
```json
{
  "success": true,
  "session": {...}
}
```

#### Add Message to Session
```http
POST /api/integrations/quote-chat
Content-Type: application/json

{
  "action": "add_message",
  "session_id": "quote_session_id",
  "sender_type": "agent",
  "sender_name": "Support Agent",
  "message": "Your quote is ready",
  "attachments": ["url1", "url2"],
  "metadata": {}
}
```

Adds a message to a quote chat session.

**Response:**
```json
{
  "success": true,
  "message": {...}
}
```

## Integration with Email Agent

The Quote Chat Integration can be used by the Email Agent to:

1. **Detect Quote Requests**: Automatically identify quote requests in incoming emails
2. **Link to Sessions**: Match emails to existing quote chat sessions by customer email
3. **Trigger Quotes**: Create quote requests and trigger PDF generation automatically
4. **Sync Customer Data**: Keep customer interaction timelines up to date

### Example Email Agent Integration

```typescript
import { extractQuoteRequestFromEmail } from '@/lib/quote-chat'

// In your email processing logic
const quoteAnalysis = extractQuoteRequestFromEmail(
  email.subject,
  email.body,
  email.from
)

if (quoteAnalysis.isQuoteRequest) {
  await fetch('/api/integrations/quote-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'process_email_quote',
      email_id: email.id,
      email_sender: email.from,
      email_subject: email.subject,
      email_body: email.body,
    }),
  })
}
```

## Database Tables

### AUDICO-CHAT-QUOTE-X Supabase

**quote_sessions**
- `id`: UUID primary key
- `session_id`: Unique session identifier
- `customer_name`: Customer name
- `customer_email`: Customer email
- `customer_phone`: Customer phone
- `company_name`: Company name
- `status`: Session status (active, pending_quote, quote_sent, completed, abandoned)
- `messages`: JSON array of messages
- `quote_items`: JSON array of requested items
- `total_amount`: Quote total amount
- `currency`: Currency code
- `metadata`: Additional metadata
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp
- `last_activity_at`: Last activity timestamp

**quote_messages**
- `id`: UUID primary key
- `session_id`: Reference to quote_sessions
- `sender_type`: Message sender type (customer, agent, system)
- `sender_name`: Sender name
- `message`: Message content
- `attachments`: Array of attachment URLs
- `metadata`: Additional metadata
- `created_at`: Creation timestamp

### Dashboard Supabase

**quote_requests**
- `id`: UUID primary key
- `session_id`: Reference to quote chat session
- `email_id`: Reference to email log
- `customer_name`: Customer name
- `customer_email`: Customer email
- `customer_phone`: Customer phone
- `company_name`: Company name
- `items`: JSON array of items
- `notes`: Additional notes
- `status`: Request status (pending, processing, sent, accepted, rejected)
- `quote_number`: Generated quote number
- `quote_amount`: Total quote amount
- `quote_pdf_url`: URL to generated PDF
- `valid_until`: Quote expiration date
- `generated_by`: Agent that generated the quote
- `metadata`: Additional metadata
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

**customer_interactions** (synced from quote sessions)
- Links quote chat sessions to customer timeline
- `reference_type`: 'quote_chat_session'
- `reference_id`: Session ID
- `interaction_type`: 'chat'
- `interaction_source`: 'audico-quote-chat'

## Squad Messages Integration

The integration logs all activities to `squad_messages` table:

- Session sync events
- Quote request creation
- PDF generation triggers
- Email linking events
- Error events

These messages enable the Squad Orchestrator to coordinate actions across agents.

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error description",
  "details": "Detailed error message"
}
```

Common error codes:
- `400`: Bad request (missing parameters)
- `404`: Resource not found
- `500`: Internal server error

## Usage Examples

### Syncing Active Sessions Daily

```typescript
// In a cron job or scheduled task
const response = await fetch('/api/integrations/quote-chat?action=sync')
const result = await response.json()
console.log(`Synced ${result.synced} of ${result.total} sessions`)
```

### Processing Incoming Email for Quote

```typescript
// When email agent receives a new email
const response = await fetch('/api/integrations/quote-chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'process_email_quote',
    email_id: emailLog.id,
    email_sender: emailLog.from_email,
    email_subject: emailLog.subject,
    email_body: emailLog.payload.body,
  }),
})

const result = await response.json()
if (result.quote_request) {
  console.log(`Quote ${result.quote_request.quote_number} created`)
}
```

### Getting Customer's Quote History

```typescript
const response = await fetch(
  `/api/integrations/quote-chat?action=search&email=${customerEmail}`
)
const result = await response.json()
console.log(`Found ${result.count} quote sessions for customer`)
```
