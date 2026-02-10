# Phase 4: Testing Guide

**Date:** February 10, 2026
**Status:** Ready to Test
**Prerequisites:** ✅ BREVO_API_KEY and BREVO_LIST_ID added to Vercel

---

## 🎯 Testing Objectives

Verify that Phase 4 (Marketing & Newsletters) works correctly:
- ✅ Brevo API connection successful
- ✅ Newsletter sending works (dry-run mode)
- ✅ Influencer outreach works (dry-run mode)
- ✅ Database tables created and accessible
- ✅ Rate limiting configured correctly

---

## 📋 Step-by-Step Testing

### Step 1: Verify Vercel Deployment ✅

**Check Deployment Status:**
1. Go to https://vercel.com/audicos-projects/audico-dashboard
2. Check latest deployment status (should be "Ready")
3. Verify build completed successfully
4. Click "View Function Logs" to check for errors

**Expected Result:**
- ✅ Deployment shows "Ready" status
- ✅ No build errors
- ✅ New files visible in deployment

**If Failed:**
- Check build logs for TypeScript errors
- Verify all imports resolved correctly
- Check for missing dependencies

---

### Step 2: Run Database Migration 📊

**Execute Migration SQL:**

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Click **"New query"**
3. Copy the SQL below:

```sql
-- ================================================
-- Marketing Tables for Phase 4
-- ================================================

-- Newsletter Drafts Table
CREATE TABLE IF NOT EXISTS newsletter_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by TEXT REFERENCES squad_agents(name),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Influencer Opportunities Table
CREATE TABLE IF NOT EXISTS influencer_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'identified' CHECK (status IN ('identified', 'contacted', 'replied', 'partnered', 'declined')),
  contacted_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by TEXT REFERENCES squad_agents(name),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Outreach Tracking Table
CREATE TABLE IF NOT EXISTS outreach_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID REFERENCES influencer_opportunities(id),
  channel TEXT NOT NULL CHECK (channel IN ('email', 'twitter', 'instagram', 'linkedin')),
  message_sent TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'opened', 'replied', 'bounced')),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  opened_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_newsletter_drafts_status ON newsletter_drafts(status);
CREATE INDEX IF NOT EXISTS idx_newsletter_drafts_created_at ON newsletter_drafts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_influencer_opportunities_status ON influencer_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_outreach_tracking_influencer ON outreach_tracking(influencer_id);
CREATE INDEX IF NOT EXISTS idx_outreach_tracking_sent_at ON outreach_tracking(sent_at DESC);

-- RLS (disable for service role access)
ALTER TABLE newsletter_drafts DISABLE ROW LEVEL SECURITY;
ALTER TABLE influencer_opportunities DISABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_tracking DISABLE ROW LEVEL SECURITY;

-- Grant permissions to anon role (for frontend access)
GRANT SELECT, INSERT, UPDATE, DELETE ON newsletter_drafts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON influencer_opportunities TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON outreach_tracking TO anon;
```

4. Click **"Run"** (or press F5)

**Expected Result:**
```
Success. No rows returned
```

**Verify Tables Created:**
```sql
-- Run this to verify:
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('newsletter_drafts', 'influencer_opportunities', 'outreach_tracking');
```

**Expected Output:**
```
table_name                    | column_count
------------------------------|-------------
newsletter_drafts             | 8
influencer_opportunities      | 8
outreach_tracking             | 9
```

---

### Step 3: Test Brevo Connection 🔌

**Option A: Via API Endpoint (Recommended)**

```bash
# Test Brevo newsletter endpoint
curl https://audico-dashboard.vercel.app/api/agents/marketing/send-newsletter

# Expected response:
{
  "status": "operational",
  "endpoint": "/api/agents/marketing/send-newsletter",
  "method": "POST",
  "required_fields": ["draft_id"],
  "description": "Send newsletter via Brevo"
}
```

**Option B: Test Brevo Account Directly**

```bash
# Replace YOUR_API_KEY with actual key
curl -X GET "https://api.brevo.com/v3/account" \
  -H "api-key: YOUR_API_KEY"

# Expected response:
{
  "email": "your@email.com",
  "firstName": "...",
  "lastName": "...",
  "companyName": "Audico",
  ...
}
```

**If Connection Fails:**
- Verify BREVO_API_KEY is correct in Vercel
- Check Brevo account is active
- Verify API key hasn't expired

---

### Step 4: Create Test Newsletter Draft 📝

**Insert Test Newsletter:**

```sql
-- In Supabase SQL Editor:
INSERT INTO newsletter_drafts (status, data, created_by)
VALUES (
  'draft',
  '{
    "subject_line": "Test Newsletter - Phase 4 Verification",
    "content": "<h1>Hello from Mission Control!</h1><p>This is a test newsletter to verify Phase 4 is working correctly. 🚀</p><p>If you receive this, everything is operational!</p>",
    "preview_text": "Testing Phase 4 newsletter distribution system"
  }'::jsonb,
  'Marketing Agent'
)
RETURNING id, status, data->>'subject_line' as subject;
```

**Expected Output:**
```
id                                    | status | subject
--------------------------------------|--------|----------------------------------
a1b2c3d4-e5f6-7890-abcd-ef1234567890 | draft  | Test Newsletter - Phase 4 Verification
```

**Copy the UUID** - you'll need it for the next step.

---

### Step 5: Create Test Task (Dry-Run) 🧪

**IMPORTANT:** Make sure `AGENT_DRY_RUN=true` in Vercel before this step!

**Insert Test Task:**

```sql
-- Replace DRAFT_UUID_HERE with the UUID from Step 4
INSERT INTO squad_tasks (
  title,
  description,
  status,
  assigned_agent,
  priority,
  requires_approval,
  metadata
) VALUES (
  'Test newsletter distribution (DRY RUN)',
  'Phase 4 testing - verifying newsletter sending works in dry-run mode',
  'new',
  'Marketing Agent',
  'medium',
  false,  -- No approval needed for dry-run test
  '{"task_type": "send_newsletter", "draft_id": "DRAFT_UUID_HERE"}'::jsonb
)
RETURNING id, title, status, assigned_agent;
```

**Expected Output:**
```
id                                    | title                                  | status | assigned_agent
--------------------------------------|----------------------------------------|--------|----------------
b2c3d4e5-f6a7-8901-bcde-f12345678901 | Test newsletter distribution (DRY RUN) | new    | Marketing Agent
```

---

### Step 6: Wait for Task Executor ⏱️

**The task executor runs every 2 minutes.**

**Monitor Progress:**

1. **Check Task Status** (refresh every 30 seconds):
```sql
SELECT
  id,
  title,
  status,
  execution_attempts,
  last_execution_attempt,
  deliverable_url,
  execution_error
FROM squad_tasks
WHERE title LIKE '%DRY RUN%'
ORDER BY created_at DESC
LIMIT 1;
```

2. **Check Squad Messages:**
```sql
SELECT
  from_agent,
  message,
  data,
  created_at
FROM squad_messages
WHERE message LIKE '%DRY RUN%' OR message LIKE '%newsletter%'
ORDER BY created_at DESC
LIMIT 5;
```

3. **Check Agent Logs:**
```sql
SELECT
  agent_name,
  event_type,
  message,
  log_level,
  created_at
FROM agent_logs
WHERE agent_name = 'Marketing Agent'
ORDER BY created_at DESC
LIMIT 10;
```

**Expected Results After ~2 Minutes:**

**Task Status:**
```
status: completed
execution_attempts: 1
deliverable_url: /marketing/dry-run-preview
execution_error: null
```

**Squad Messages:**
```
from_agent: Marketing Agent
message: [DRY RUN] Would execute: Test newsletter distribution (DRY RUN)
```

**Agent Logs:**
```
agent_name: Marketing Agent
event_type: task_execution
message: [DRY RUN] Would execute marketing task
log_level: info
```

**If Task Stays "new" After 5 Minutes:**
- Check Vercel cron job logs: `/api/cron/tasks/execute`
- Verify CRON_SECRET is set correctly
- Check task executor is running

**If Task Shows "failed":**
- Check `execution_error` column for details
- Review Vercel function logs
- Verify marketing handler imported correctly

---

### Step 7: Test Influencer Outreach (Dry-Run) 📧

**Create Test Influencer:**

```sql
INSERT INTO influencer_opportunities (status, data, created_by)
VALUES (
  'identified',
  '{
    "name": "Test Influencer",
    "email": "test@example.com",
    "platform": "youtube",
    "follower_count": 10000,
    "niche": "electronics",
    "preferred_contact": "email"
  }'::jsonb,
  'Marketing Agent'
)
RETURNING id, data->>'name' as name, status;
```

**Create Outreach Task:**

```sql
-- Replace INFLUENCER_UUID_HERE with UUID from above
INSERT INTO squad_tasks (
  title,
  description,
  status,
  assigned_agent,
  priority,
  requires_approval,
  metadata
) VALUES (
  'Test influencer outreach (DRY RUN)',
  'Phase 4 testing - verifying outreach works in dry-run mode',
  'new',
  'Marketing Agent',
  'medium',
  false,
  '{
    "task_type": "influencer_outreach",
    "influencer_id": "INFLUENCER_UUID_HERE",
    "message_template": "Hi there,\n\nWe at Audico would love to explore a partnership opportunity with you.\n\nThis is a test message from our automated system.\n\nBest regards,\nAudico Team"
  }'::jsonb
)
RETURNING id, title, status;
```

**Wait 2 Minutes and Verify:**

```sql
-- Check task completed
SELECT status, deliverable_url, execution_error
FROM squad_tasks
WHERE title LIKE '%influencer outreach%'
ORDER BY created_at DESC
LIMIT 1;

-- Expected:
-- status: completed
-- deliverable_url: /marketing/dry-run-preview
-- execution_error: null
```

---

### Step 8: Verify Rate Limiting ⚡

**Check Rate Limit Configuration:**

```sql
-- This query won't work directly, but you can check Redis keys via Vercel logs
```

**Test Rate Limit (Optional):**

If you want to verify rate limits work, create 11 influencer outreach tasks (limit is 10/day):

```sql
-- Create 11 tasks quickly
DO $$
DECLARE
  i INT;
BEGIN
  FOR i IN 1..11 LOOP
    INSERT INTO squad_tasks (
      title,
      description,
      status,
      assigned_agent,
      priority,
      requires_approval,
      metadata
    ) VALUES (
      'Rate limit test ' || i,
      'Testing rate limiter',
      'new',
      'Marketing Agent',
      'low',
      false,
      '{"task_type": "influencer_outreach", "influencer_id": "test-id", "message_template": "test"}'::jsonb
    );
  END LOOP;
END $$;
```

**Expected:** First 10 tasks execute, 11th task fails with rate limit error.

---

## ✅ Success Criteria

Phase 4 is working correctly if:

1. **Deployment:**
   - ✅ Vercel deployment shows "Ready"
   - ✅ No build errors in logs

2. **Database:**
   - ✅ 3 new tables created successfully
   - ✅ Indexes created
   - ✅ RLS disabled correctly
   - ✅ Anon role has permissions

3. **Brevo Connection:**
   - ✅ API endpoint returns 200 status
   - ✅ Account info retrieved successfully

4. **Newsletter (Dry-Run):**
   - ✅ Task moves from "new" → "completed"
   - ✅ Squad message shows "[DRY RUN] Would execute"
   - ✅ No actual newsletter sent
   - ✅ Deliverable URL populated

5. **Influencer Outreach (Dry-Run):**
   - ✅ Task moves from "new" → "completed"
   - ✅ Squad message shows "[DRY RUN] Would execute"
   - ✅ No actual email sent
   - ✅ Deliverable URL populated

6. **Rate Limiting:**
   - ✅ Newsletter: 1/day limit configured
   - ✅ Outreach: 10/day limit configured

---

## 🚨 Troubleshooting

### Issue: Tables Not Created

**Symptoms:**
- SQL query returns "relation does not exist"

**Solution:**
```sql
-- Check if tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '%newsletter%';

-- If empty, re-run migration SQL from Step 2
```

---

### Issue: Task Stays "new" Forever

**Symptoms:**
- Task doesn't change status after 5 minutes

**Possible Causes:**
1. Task executor cron not running
2. CRON_SECRET mismatch
3. Marketing handler error

**Solution:**
```bash
# Check Vercel function logs for task executor
# Look for: "Task executor: Found X tasks to execute"

# Manual trigger (if needed):
curl -X POST https://audico-dashboard.vercel.app/api/cron/tasks/execute \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

### Issue: "Missing task_type in task metadata"

**Symptoms:**
- Task fails with this error in `execution_error` column

**Solution:**
- Verify metadata JSON has `task_type` field
- Should be: `{"task_type": "send_newsletter", "draft_id": "..."}`
- Re-insert task with correct metadata

---

### Issue: "BREVO_API_KEY not configured"

**Symptoms:**
- Task fails with Brevo configuration error

**Solution:**
1. Go to Vercel Dashboard → Project Settings → Environment Variables
2. Verify `BREVO_API_KEY` is set for Production environment
3. Redeploy if added after last deployment
4. Test API key with curl command from Step 3

---

## 🎯 Next Steps After Successful Testing

Once all tests pass:

1. **Keep Dry-Run Active:**
   - Leave `AGENT_DRY_RUN=true` for now
   - Test with real data for a few days

2. **Monitor Closely:**
   - Watch agent_logs for errors
   - Check squad_messages for unexpected behavior
   - Review task completion rates

3. **Real Newsletter Test:**
   - When ready, set `AGENT_DRY_RUN=false`
   - Create real newsletter with approval required
   - Send to small test list first (5-10 people)

4. **Proceed to Phase 5:**
   - Once Phase 4 stable for 2-3 days
   - Begin SEO & Ads implementation
   - See [REMAINING_WORK_PLAN.md](REMAINING_WORK_PLAN.md)

---

## 📊 Test Results Checklist

Mark completed tests:

- [ ] Vercel deployment verified
- [ ] Database migration run successfully
- [ ] Tables created and accessible
- [ ] Brevo connection tested
- [ ] Newsletter draft created
- [ ] Newsletter task executed (dry-run)
- [ ] Task completed successfully
- [ ] Squad messages logged correctly
- [ ] Influencer created
- [ ] Outreach task executed (dry-run)
- [ ] Rate limiting verified
- [ ] No errors in logs

**Date Tested:** _____________
**Tested By:** _____________
**Result:** ⬜ PASS  ⬜ FAIL  ⬜ PARTIAL

**Notes:**
```
(Add any issues encountered or observations here)
```

---

**Good luck with testing! Phase 4 should work smoothly.** 🚀
