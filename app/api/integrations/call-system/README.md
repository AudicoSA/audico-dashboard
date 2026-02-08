# Call System Integration API

This API endpoint receives call transcripts and customer inquiries from the `audico-call-system`, processes them, generates follow-up tasks, and syncs customer interaction history to a unified timeline.

## Endpoint

**POST** `/api/integrations/call-system`

## Authentication

The endpoint supports optional webhook authentication using a Bearer token:

```
Authorization: Bearer <CALL_SYSTEM_WEBHOOK_SECRET>
```

Set the `CALL_SYSTEM_WEBHOOK_SECRET` environment variable to enable authentication.

## Request Payload

```typescript
{
  call_id: string                    // Required: Unique call identifier
  customer_phone: string             // Required: Customer phone number
  customer_name?: string             // Optional: Customer name
  customer_email?: string            // Optional: Customer email
  call_duration?: number             // Optional: Call duration in seconds
  call_start_time: string            // Required: ISO 8601 timestamp
  call_end_time?: string             // Optional: ISO 8601 timestamp
  transcript: string                 // Required: Full call transcript
  summary?: string                   // Optional: AI-generated summary
  sentiment?: string                 // Optional: positive | neutral | negative | mixed
  call_outcome?: string              // Optional: resolved | follow_up_needed | escalation | inquiry | order | complaint | other
  customer_intent?: string           // Optional: Detected customer intent
  key_topics?: string[]              // Optional: Array of key discussion topics
  metadata?: Record<string, any>     // Optional: Additional metadata
}
```

## Response

### Success (200)

```json
{
  "success": true,
  "transcript": {
    "id": "uuid",
    "call_id": "call-123"
  },
  "tasks_generated": 2,
  "timeline_synced": true,
  "timeline_entry_id": "uuid"
}
```

### Error Responses

- **400 Bad Request**: Missing required fields
- **401 Unauthorized**: Invalid or missing authentication token
- **409 Conflict**: Call transcript already exists
- **500 Internal Server Error**: Processing failed

## Features

### 1. Call Transcript Storage

All call transcripts are stored in the `call_transcripts` table with full metadata including:
- Customer information
- Call duration and timestamps
- Full transcript text
- AI-generated summary and sentiment analysis
- Call outcome classification
- Key topics discussed

### 2. Automatic Task Generation

The system intelligently generates follow-up tasks for various agents based on call outcomes:

#### Customer Service Tasks (Sizwe)
- **Escalations**: Urgent priority tasks for escalated calls
- **Complaints**: Urgent priority tasks for negative sentiment calls
- **Follow-ups**: High priority tasks for follow-up requests

#### Order Management Tasks (Mpho)
- **Order Inquiries**: High priority tasks when customers express purchase intent
- Orders detected via call outcome or customer intent keywords

#### Email/Marketing Tasks (Naledi)
- **Follow-up Emails**: Medium priority tasks for inquiries with customer email
- **Marketing Campaigns**: Low priority tasks for positive interactions with email

### 3. Customer Timeline Sync

Every call is automatically synced to the unified customer timeline (`customer_interactions` table) with:
- Customer identification (email, phone, or custom ID)
- Interaction classification
- Sentiment and outcome tracking
- Priority and status assignment
- Reference to full call transcript
- Rich metadata in JSONB format

### 4. Squad Activity Logging

All webhook processing events are logged to `squad_messages` for:
- Webhook receipt confirmation
- Task creation tracking
- Timeline sync confirmation
- Error logging

## GET Endpoint

**GET** `/api/integrations/call-system`

Retrieve call transcripts and customer timeline data.

### Query Parameters

- `call_id`: Get specific call by ID
- `customer_phone`: Get all calls for a customer phone number
- `customer_email`: Get all calls for a customer email
- `customer_id`: Get customer timeline by ID
- `limit`: Maximum results to return (default: 50)

### Example Requests

```bash
# Get specific call
GET /api/integrations/call-system?call_id=call-123

# Get customer's calls by phone
GET /api/integrations/call-system?customer_phone=%2B27123456789

# Get customer timeline by email
GET /api/integrations/call-system?customer_email=john@example.com&limit=100
```

## Database Schema

### call_transcripts
- Stores complete call records with transcripts
- Indexed by call_id, customer_phone, customer_email, outcome, sentiment
- Full-text search capability on transcripts

### customer_interactions
- Unified timeline for all customer touchpoints
- Supports multiple interaction types: call, email, chat, social, order, support_ticket
- Rich JSONB details field for flexible metadata
- Indexed for fast customer timeline queries

## Integration Example

```typescript
// From audico-call-system
const response = await fetch('https://dashboard.audico.co.za/api/integrations/call-system', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.WEBHOOK_SECRET}`
  },
  body: JSON.stringify({
    call_id: 'call-' + Date.now(),
    customer_phone: '+27123456789',
    customer_name: 'John Doe',
    customer_email: 'john@example.com',
    call_duration: 245,
    call_start_time: new Date().toISOString(),
    call_end_time: new Date().toISOString(),
    transcript: 'Full call transcript here...',
    summary: 'Customer inquired about product availability...',
    sentiment: 'positive',
    call_outcome: 'inquiry',
    customer_intent: 'product information',
    key_topics: ['product', 'availability', 'pricing'],
    metadata: {
      recording_url: 'https://...',
      agent_id: 'agent-123'
    }
  })
})

const result = await response.json()
console.log(`Created ${result.tasks_generated} tasks`)
```

## Helper Functions

The `lib/call-system.ts` module provides utility functions:

- `getCallTranscriptByCallId(callId)`: Fetch specific call transcript
- `getCallTranscriptsByCustomer(phone, email)`: Get customer's call history
- `getCustomerTimeline(customerId, email, phone)`: Get unified timeline
- `getCustomerTimelineByType(customerId, type)`: Filter timeline by interaction type
- `getRecentCallsByOutcome(outcome)`: Query calls by outcome
- `getRecentCallsBySentiment(sentiment)`: Query calls by sentiment
- `getCustomerInteractionStats(customerId)`: Get customer interaction statistics
- `searchCallsByKeywords(keywords)`: Search calls by topics

## Environment Variables

```bash
# Required for Supabase connection
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional webhook security
CALL_SYSTEM_WEBHOOK_SECRET=your_webhook_secret
```

## Migration

Run the database migration to create required tables:

```bash
# Execute supabase/migrations/004_call_system_integration.sql
```

This creates:
- `call_transcripts` table
- `customer_interactions` table
- All necessary indexes
- RLS policies
- Updated_at triggers
