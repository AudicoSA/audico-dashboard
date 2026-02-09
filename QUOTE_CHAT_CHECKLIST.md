# Quote Chat Integration - Deployment Checklist

Use this checklist to verify the Quote Chat Integration is properly deployed.

## ✅ Pre-Deployment Checklist

### Files Created
- [x] `/app/api/integrations/quote-chat/route.ts` - Main API route (14,069 bytes)
- [x] `/app/api/integrations/quote-chat/README.md` - API documentation (9,410 bytes)
- [x] `/app/api/integrations/quote-chat/example.ts` - Usage examples (9,694 bytes)
- [x] `/app/api/cron/quote-chat/sync/route.ts` - Cron sync job (2,011 bytes)
- [x] `/lib/quote-chat.ts` - Core library (7,226 bytes)
- [x] `/lib/email-quote-handler.ts` - Email integration (4,569 bytes)
- [x] `/lib/supabase.ts` - Updated with new types
- [x] `.env.local.example` - Updated with quote chat vars
- [x] `vercel.json` - Updated with cron job and env vars
- [x] `QUOTE_CHAT_INTEGRATION.md` - Complete guide (12,781 bytes)
- [x] `QUOTE_CHAT_QUICKSTART.md` - Quick start guide (7,100 bytes)
- [x] `QUOTE_CHAT_FILES.md` - File reference (7,266 bytes)
- [x] `IMPLEMENTATION_QUOTE_CHAT.md` - Implementation summary

### Code Review
- [x] All TypeScript types properly defined
- [x] Error handling implemented throughout
- [x] Logging added to all operations
- [x] Security considerations addressed
- [x] API endpoints documented
- [x] Database schemas defined

## 🚀 Deployment Steps

### 1. Environment Configuration
```bash
# Add to Vercel Dashboard or .env.local:
AUDICO_CHAT_QUOTE_SUPABASE_URL=https://your-instance.supabase.co
AUDICO_CHAT_QUOTE_SUPABASE_KEY=your_service_role_key
```

- [ ] Environment variables added to Vercel
- [ ] Variables verified in Vercel dashboard
- [ ] NEXT_PUBLIC_APP_URL is set correctly

### 2. Database Setup

#### Dashboard Supabase
Run this SQL in the SQL Editor:

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

- [ ] `quote_requests` table created
- [ ] Indexes created
- [ ] Table permissions verified

#### AUDICO-CHAT-QUOTE-X Supabase
Verify these tables exist:

- [ ] `quote_sessions` table exists
- [ ] `quote_messages` table exists
- [ ] Service role key has read access
- [ ] Table structure matches schema

### 3. Deploy Code
```bash
git add .
git commit -m "Add quote chat integration"
git push origin main
```

- [ ] Code committed to repository
- [ ] Pushed to main branch
- [ ] Vercel deployment triggered
- [ ] Build completed successfully

### 4. Verify Deployment

#### Check Cron Job
- [ ] Cron job appears in Vercel dashboard
- [ ] Schedule shows "0 */4 * * *" (every 4 hours)
- [ ] Path is `/api/cron/quote-chat/sync`

#### Test API Endpoints
```bash
# Test 1: Get active sessions
curl https://your-app.vercel.app/api/integrations/quote-chat?action=active

# Expected: {"success": true, "sessions": [...], "count": N}
```

- [ ] Active sessions endpoint works
- [ ] Returns valid JSON
- [ ] No error messages

```bash
# Test 2: Test sync
curl https://your-app.vercel.app/api/integrations/quote-chat?action=sync

# Expected: {"success": true, "synced": N, "total": N}
```

- [ ] Sync endpoint works
- [ ] Returns sync count
- [ ] No errors in logs

```bash
# Test 3: Test search
curl https://your-app.vercel.app/api/integrations/quote-chat?action=search&email=test@example.com

# Expected: {"success": true, "sessions": [], "count": 0}
```

- [ ] Search endpoint works
- [ ] Returns empty results correctly
- [ ] No errors

## 📊 Post-Deployment Verification

### 1. Logs Check

#### Agent Logs
```sql
SELECT * FROM agent_logs 
WHERE agent_name = 'quote_chat_integration' 
ORDER BY created_at DESC 
LIMIT 10;
```

- [ ] Logs are being created
- [ ] No critical errors
- [ ] Events are properly logged

#### Squad Messages
```sql
SELECT * FROM squad_messages 
WHERE from_agent = 'quote_chat_integration' 
ORDER BY created_at DESC 
LIMIT 10;
```

- [ ] Messages are being logged
- [ ] Integration events recorded
- [ ] No error messages

### 2. Cron Job Execution

Wait for next scheduled run (every 4 hours) or trigger manually:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-app.vercel.app/api/cron/quote-chat/sync
```

- [ ] Cron job executed successfully
- [ ] Sync completed without errors
- [ ] Agent logs show execution

### 3. Email Integration Test

Send test email with:
- **To:** Your configured email
- **Subject:** "Request for Quote"
- **Body:** "I need a quote for 10x Product A. Please send pricing."

Wait for Email Agent to poll (runs every 15 minutes).

- [ ] Email received by Email Agent
- [ ] Quote request detected
- [ ] Session searched/created
- [ ] Quote request logged
- [ ] Customer interactions updated

Check results:
```sql
-- Check email was processed
SELECT * FROM email_logs 
WHERE subject LIKE '%Quote%' 
ORDER BY created_at DESC 
LIMIT 1;

-- Check quote request created
SELECT * FROM quote_requests 
ORDER BY created_at DESC 
LIMIT 1;

-- Check customer interaction
SELECT * FROM customer_interactions 
WHERE reference_type = 'quote_chat_session' 
ORDER BY created_at DESC 
LIMIT 1;
```

### 4. Integration Health Check

Run this query to verify integration health:

```sql
-- Check recent activity
SELECT 
  COUNT(*) as total_sessions_synced,
  MAX(created_at) as last_sync
FROM customer_interactions 
WHERE reference_type = 'quote_chat_session' 
AND created_at > NOW() - INTERVAL '7 days';

-- Check quote requests
SELECT 
  status,
  COUNT(*) as count
FROM quote_requests 
GROUP BY status;

-- Check recent errors
SELECT 
  COUNT(*) as error_count
FROM agent_logs 
WHERE agent_name = 'quote_chat_integration' 
AND log_level IN ('error', 'critical')
AND created_at > NOW() - INTERVAL '24 hours';
```

Expected results:
- [ ] Sessions are being synced
- [ ] Quote requests are being created
- [ ] Error count is 0 or minimal

## 🔧 Troubleshooting

### Issue: "Quote chat Supabase credentials not configured"

**Check:**
- [ ] AUDICO_CHAT_QUOTE_SUPABASE_URL is set
- [ ] AUDICO_CHAT_QUOTE_SUPABASE_KEY is set
- [ ] Variables are in Vercel dashboard
- [ ] Redeploy after adding variables

### Issue: "Sessions not appearing"

**Check:**
- [ ] Table permissions in AUDICO-CHAT-QUOTE-X
- [ ] Service role key has proper access
- [ ] Table names match (quote_sessions, quote_messages)
- [ ] Data exists in external Supabase

### Issue: "Emails not linking"

**Check:**
- [ ] Customer email matches between email and session
- [ ] Session status is not 'abandoned'
- [ ] Email exists in email_logs table
- [ ] Email Agent is running

### Issue: "Cron job not running"

**Check:**
- [ ] Cron job visible in Vercel dashboard
- [ ] CRON_SECRET environment variable set
- [ ] Check Vercel function logs
- [ ] Verify schedule is correct

### Issue: "Customer data not syncing"

**Check:**
- [ ] Customer has email or phone in session
- [ ] customer_interactions table exists
- [ ] Review cron job logs
- [ ] Check sync endpoint manually

## 📈 Success Metrics

After 24 hours, verify:

- [ ] At least 1 cron job execution (every 4 hours = 6 runs/day)
- [ ] 0 critical errors in agent_logs
- [ ] Active sessions being tracked
- [ ] Customer interactions being created
- [ ] Email quotes being processed (if any emails received)

## 📝 Documentation Review

Verify documentation is accessible:

- [ ] QUOTE_CHAT_INTEGRATION.md - Complete guide
- [ ] QUOTE_CHAT_QUICKSTART.md - Quick start
- [ ] /app/api/integrations/quote-chat/README.md - API docs
- [ ] /app/api/integrations/quote-chat/example.ts - Examples
- [ ] QUOTE_CHAT_FILES.md - File reference
- [ ] IMPLEMENTATION_QUOTE_CHAT.md - Summary

## ✨ Final Verification

Run this comprehensive test:

1. **API Test**
   ```bash
   curl https://your-app.vercel.app/api/integrations/quote-chat?action=active
   ```
   - [ ] Returns success

2. **Sync Test**
   ```bash
   curl https://your-app.vercel.app/api/integrations/quote-chat?action=sync
   ```
   - [ ] Syncs successfully

3. **Email Test**
   - Send quote request email
   - [ ] Email processed
   - [ ] Quote detected
   - [ ] Session linked

4. **Logs Test**
   - Check agent_logs
   - [ ] No critical errors
   - [ ] Events logged

5. **Database Test**
   - Check quote_requests
   - [ ] Table exists
   - [ ] Can query data

## 🎉 Deployment Complete

When all items are checked:
- ✅ Files deployed
- ✅ Environment configured
- ✅ Database setup
- ✅ API endpoints working
- ✅ Cron job running
- ✅ Logs clean
- ✅ Integration tested

**Status: READY FOR PRODUCTION** 🚀

---

## Quick Reference

**Main API:** `/api/integrations/quote-chat`
**Cron Job:** `/api/cron/quote-chat/sync`
**Schedule:** Every 4 hours
**Documentation:** `QUOTE_CHAT_INTEGRATION.md`

**Environment Variables:**
- `AUDICO_CHAT_QUOTE_SUPABASE_URL`
- `AUDICO_CHAT_QUOTE_SUPABASE_KEY`

**Key Tables:**
- `quote_requests` (Dashboard)
- `quote_sessions` (AUDICO-CHAT-QUOTE-X)
- `customer_interactions` (Dashboard)

**Monitoring:**
- Check agent_logs
- Check squad_messages
- Check customer_interactions
- Review Vercel function logs
