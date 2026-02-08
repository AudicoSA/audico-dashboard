# Email Agent API Routes

This directory contains the API routes for the Email Agent, which handles automated email management via the Gmail API.

## Routes

### `/poll` - POST
Triggers a Gmail check to fetch unread messages and log them to the database.

**Request:**
```json
POST /api/agents/email/poll
```

**Response:**
```json
{
  "success": true,
  "messagesFound": 5,
  "messages": [
    {
      "id": "gmail_message_id",
      "from": "sender@example.com",
      "subject": "Email Subject",
      "snippet": "Email preview text..."
    }
  ]
}
```

**Actions:**
- Fetches up to 10 unread emails from Gmail
- Logs new emails to `email_logs` table
- Logs all actions to `squad_messages` table

### `/classify` - POST
Manually classifies an email based on its content.

**Request:**
```json
POST /api/agents/email/classify
Content-Type: application/json

{
  "email_id": "uuid-of-email-log",
  // OR
  "gmail_message_id": "gmail_message_id"
}
```

**Response:**
```json
{
  "success": true,
  "email": {
    "id": "uuid",
    "category": "support",
    "status": "classified",
    // ... other fields
  },
  "classification": {
    "id": "uuid",
    "classification": "support",
    "priority": "high",
    "assigned_agent": "email_agent",
    // ... other fields
  }
}
```

**Classification Categories:**
- `order` - Order-related emails
- `support` - Support requests
- `inquiry` - General inquiries
- `complaint` - Customer complaints
- `spam` - Spam or promotional emails
- `other` - Uncategorized

**Priority Levels:**
- `low` - Low priority
- `medium` - Medium priority
- `high` - High priority
- `urgent` - Urgent attention required

**Actions:**
- Analyzes email content (subject + body)
- Updates `email_logs` with category and status
- Creates entry in `email_classifications` table
- Logs all actions to `squad_messages` table

### `/respond` - POST
Creates a draft response in Gmail for a given email.

**Request:**
```json
POST /api/agents/email/respond
Content-Type: application/json

{
  "email_id": "uuid-of-email-log",
  // OR
  "gmail_message_id": "gmail_message_id",
  
  // Optional: custom response text
  "response_text": "Custom response message..."
}
```

**Response:**
```json
{
  "success": true,
  "draft": {
    "id": "draft_id",
    "message": {
      // Gmail message object
    }
  },
  "email": {
    // Email log object
  },
  "response_preview": "The generated response text..."
}
```

**Actions:**
- Retrieves email from `email_logs`
- Fetches original message from Gmail
- Generates appropriate response based on category (or uses provided text)
- Creates draft in Gmail (does not send)
- Updates email status to `draft_created`
- Logs all actions to `squad_messages` table

## Environment Variables

Required environment variables (see `.env.local.example`):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Gmail API
GMAIL_CLIENT_ID=your_client_id
GMAIL_CLIENT_SECRET=your_client_secret
GMAIL_REDIRECT_URI=http://localhost:3001/api/auth/gmail/callback
GMAIL_REFRESH_TOKEN=your_refresh_token
```

## Database Tables

### `email_logs`
Stores all emails fetched from Gmail.

Fields:
- `id` (uuid)
- `gmail_message_id` (text)
- `from_email` (text)
- `subject` (text)
- `category` (text)
- `status` (text)
- `handled_by` (text, nullable)
- `payload` (jsonb)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### `email_classifications`
Stores detailed classification data for emails.

Fields:
- `id` (uuid)
- `email_id` (text) - Gmail message ID
- `sender` (text)
- `subject` (text)
- `body` (text, nullable)
- `classification` (enum: order, support, inquiry, complaint, spam, other)
- `priority` (enum: low, medium, high, urgent)
- `assigned_agent` (text, nullable)
- `status` (enum: unread, read, replied, archived)
- `metadata` (jsonb)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### `squad_messages`
Logs all agent actions and inter-agent communications.

Fields:
- `id` (uuid)
- `from_agent` (text)
- `to_agent` (text, nullable)
- `message` (text)
- `task_id` (text, nullable)
- `data` (jsonb)
- `created_at` (timestamp)

## Phase 1 Implementation

Current implementation:
- ✅ Gmail polling for unread messages
- ✅ Email classification with keyword-based logic
- ✅ Draft creation in Gmail (not auto-sending)
- ✅ All actions logged to `squad_messages`

Future phases may include:
- AI-powered classification
- Automatic response sending
- Multi-language support
- Advanced email threading
- Sentiment analysis
