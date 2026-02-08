# Quote Chat Integration - Quick Start Guide

Get the Quote Chat Integration up and running in 5 minutes.

## 1. Prerequisites

- Access to AUDICO-CHAT-QUOTE-X Supabase instance
- Dashboard deployed on Vercel
- Email Agent configured and running

## 2. Configuration

### Step 1: Get Supabase Credentials

From your AUDICO-CHAT-QUOTE-X Supabase dashboard:

1. Go to Settings → API
2. Copy the Project URL
3. Copy the service_role key (or anon key if service_role not available)

### Step 2: Add Environment Variables

Add to Vercel dashboard or `.env.local`:

```bash
AUDICO_CHAT_QUOTE_SUPABASE_URL=https://your-instance.supabase.co
AUDICO_CHAT_QUOTE_SUPABASE_KEY=your_key_here
```

### Step 3: Deploy Changes

```bash
git add .
git commit -m "Add quote chat integration"
git push origin main
```

Vercel will automatically deploy with the new cron job.

## 3. Verify Integration

### Test API Connection

```bash
curl https://your-app.vercel.app/api/integrations/quote-chat?action=active
```

Expected response:
```json
{
  "success": true,
  "sessions": [...],
  "count": 0
}
```

### Test Quote Detection

Create a test email in your email system with subject "Request for Quote" - the Email Agent will automatically detect it and link it to quote sessions.

### Check Logs

```bash
# View integration logs
curl https://your-app.vercel.app/api/logs?agent=quote_chat_integration
```

## 4. Create Database Tables

### In Dashboard Supabase

Run this SQL:

```sql
CREATE TABLE IF NOT EXISTS quote_requests (
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

CREATE INDEX idx_quote_requests_session_id ON quote_requests(session_id);
CREATE INDEX idx_quote_requests_email_id ON quote_requests(email_id);
CREATE INDEX idx_quote_requests_customer_email ON quote_requests(customer_email);
CREATE INDEX idx_quote_requests_status ON quote_requests(status);
```

### In AUDICO-CHAT-QUOTE-X Supabase

Ensure these tables exist:

```sql
CREATE TABLE IF NOT EXISTS quote_sessions (
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

CREATE TABLE IF NOT EXISTS quote_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT REFERENCES quote_sessions(session_id),
  sender_type TEXT NOT NULL,
  sender_name TEXT,
  message TEXT NOT NULL,
  attachments TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quote_sessions_customer_email ON quote_sessions(customer_email);
CREATE INDEX idx_quote_sessions_status ON quote_sessions(status);
CREATE INDEX idx_quote_messages_session_id ON quote_messages(session_id);
```

## 5. Usage Examples

### Fetch Active Sessions

```typescript
const response = await fetch('/api/integrations/quote-chat?action=active')
const data = await response.json()
console.log(`${data.count} active sessions`)
```

### Process Email for Quote

```typescript
await fetch('/api/integrations/quote-chat', {
  method: 'POST',
  body: JSON.stringify({
    action: 'process_email_quote',
    email_id: 'xxx',
    email_sender: 'customer@example.com',
    email_subject: 'Quote Request',
    email_body: 'I need pricing for...'
  })
})
```

### Create Quote from Session

```typescript
await fetch('/api/integrations/quote-chat', {
  method: 'POST',
  body: JSON.stringify({
    action: 'create_quote',
    session_id: 'session-123'
  })
})
```

## 6. Monitoring

### Check Squad Messages

```sql
SELECT * FROM squad_messages 
WHERE from_agent = 'quote_chat_integration' 
ORDER BY created_at DESC 
LIMIT 10;
```

### Check Agent Logs

```sql
SELECT * FROM agent_logs 
WHERE agent_name = 'quote_chat_integration' 
ORDER BY created_at DESC 
LIMIT 10;
```

### Check Customer Interactions

```sql
SELECT * FROM customer_interactions 
WHERE reference_type = 'quote_chat_session' 
ORDER BY interaction_date DESC 
LIMIT 10;
```

## 7. Testing

### Test Email Detection

Send an email with these keywords to test detection:
- Subject: "Request for Quote"
- Body: "I need pricing for 10x Product A"

The Email Agent should:
1. Detect it as a quote request
2. Find or create a quote session
3. Create a quote request
4. Trigger PDF generation

### Test Manual Sync

```bash
curl -X GET https://your-app.vercel.app/api/integrations/quote-chat?action=sync
```

### Test Cron Job

The cron job runs every 4 hours. To test immediately:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-app.vercel.app/api/cron/quote-chat/sync
```

## 8. Common Issues

### "Quote chat Supabase credentials not configured"

**Solution**: Verify environment variables are set in Vercel dashboard

### "Sessions not appearing"

**Solution**: 
1. Check table permissions in AUDICO-CHAT-QUOTE-X
2. Verify service_role key has proper access
3. Check table names match (quote_sessions, quote_messages)

### "Email not linking to session"

**Solution**:
1. Ensure customer email matches between email and session
2. Check session status is not 'abandoned'
3. Verify email_logs table has the email record

## 9. Next Steps

- [Full API Documentation](./app/api/integrations/quote-chat/README.md)
- [Detailed Integration Guide](./QUOTE_CHAT_INTEGRATION.md)
- [Usage Examples](./app/api/integrations/quote-chat/example.ts)

## 10. Support

If you encounter issues:

1. Check `agent_logs` table for errors
2. Review `squad_messages` for integration events
3. Verify all environment variables are set
4. Ensure database tables exist with correct schema
5. Check Supabase permissions and RLS policies

## Quick Reference

### API Endpoints

- `GET /api/integrations/quote-chat?action=active` - Get active sessions
- `GET /api/integrations/quote-chat?action=session&session_id=xxx` - Get session details
- `GET /api/integrations/quote-chat?action=search&email=xxx` - Search by customer
- `GET /api/integrations/quote-chat?action=sync` - Sync all sessions
- `POST /api/integrations/quote-chat` - Various POST actions (link_email, create_quote, etc.)

### Cron Schedule

- Quote chat sync: Every 4 hours (`0 */4 * * *`)

### Key Tables

- `quote_sessions` (AUDICO-CHAT-QUOTE-X)
- `quote_messages` (AUDICO-CHAT-QUOTE-X)
- `quote_requests` (Dashboard)
- `customer_interactions` (Dashboard)
- `squad_messages` (Dashboard)
- `agent_logs` (Dashboard)
