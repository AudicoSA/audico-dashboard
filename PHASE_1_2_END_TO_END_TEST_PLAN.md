# Phase 1 & 2 End-to-End Test Plan
**Created:** February 10, 2026, 6:45 PM
**Status:** System deployed but NOT verified working
**Purpose:** Prove the autonomous email workflow actually works or identify what's broken

---

## ⚠️ CURRENT STATE

### What Was Built Today:
- ✅ Phase 1: Core Infrastructure (task executor, approval workflow, cron jobs)
- ✅ Phase 2: Email Execution (Gmail integration, auto-send, approval tasks)
- ✅ ApprovalQueue UI component
- ✅ Email draft preview pages
- ✅ Cron authentication fixes
- ✅ Jarvis model fix (claude-3-5-sonnet → claude-sonnet-4-5)

### What Was Fixed:
- ✅ Vercel Cron authentication (now supports x-vercel-cron header)
- ✅ Jarvis model 404 error (updated to Sonnet 4.5)
- ✅ ApprovalQueue deployment (was never pushed to GitHub)

### What Has NOT Been Proven:
- ❌ Email polling actually stores emails in database
- ❌ Classification categorizes emails correctly
- ❌ Jarvis reads classified emails and triggers responses
- ❌ Email Agent creates drafts and approval tasks
- ❌ Task executor picks up and executes approved tasks
- ❌ **END-TO-END WORKFLOW HAS NEVER COMPLETED**

### Known Issues:
- Email poll manually triggered today - said it captured 30 emails
- Database query shows NO emails in last 2 hours
- Either emails are older, never inserted, or there's a bug
- Only 1 test approval task was created manually - not from real workflow
- User frustrated: "nothing actually works, other than anthropic munching tokens"

---

## 🎯 TEST PLAN OBJECTIVES

**Goal:** Prove each step of the workflow works OR identify the exact failure point

**Success Criteria:**
1. Email polling captures and stores emails in `email_logs` table
2. Classification sets correct `category` for each email
3. Jarvis reads classified emails and creates response tasks
4. Email Agent creates Gmail drafts and approval tasks
5. Approval tasks appear on dashboard with correct metadata
6. Task executor picks up approved tasks and executes them
7. DRY_RUN logs appear showing emails "would be sent"

---

## 📋 STEP-BY-STEP TEST PROCEDURE

### STEP 0: Pre-Test Verification

**Environment Check:**
```bash
# Vercel Environment Variables (check in Vercel Dashboard → Settings → Env Vars)
AGENT_DRY_RUN=true                    # MUST BE TRUE for testing
ENABLE_AUTO_EXECUTION=true            # Enable task executor
CRON_SECRET=<your-secret>             # For cron authentication
GMAIL_CLIENT_ID=<your-id>
GMAIL_CLIENT_SECRET=<your-secret>
GMAIL_REFRESH_TOKEN=<your-token>
GMAIL_REDIRECT_URI=<your-uri>
SUPABASE_SERVICE_ROLE_KEY=<your-key>
NEXT_PUBLIC_SUPABASE_URL=<your-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-key>
REDIS_URL=<your-redis-url>
ANTHROPIC_API_KEY=<your-key>          # For Jarvis AI
```

**Database Schema Check:**
```sql
-- Run in Supabase SQL Editor
-- Verify all required tables exist with correct columns

\d email_logs
-- Expected columns: id, gmail_message_id, from_email, subject, category,
--                   status, handled_by, payload, metadata, created_at, updated_at

\d squad_tasks
-- Expected columns: id, title, description, status, assigned_agent, priority,
--                   mentions_kenny, requires_approval, approved_by, approved_at,
--                   execution_attempts, last_execution_attempt, execution_error,
--                   metadata, deliverable_url, created_at, updated_at

\d squad_messages
-- Expected columns: id, from_agent, to_agent, message, task_id, data, created_at

\d agent_logs
-- Expected columns: id, agent_name, log_level, event_type, message, context, created_at
```

**Deployment Check:**
```bash
# Verify latest commit is deployed
git log --oneline -1
# Should show: e53bb6f FIX: Update Jarvis to use correct Claude Sonnet 4.5 model

# Check Vercel deployment status
# Go to: https://vercel.com/dashboard → Deployments
# Latest deployment should be: e53bb6f with status "Ready"
```

---

### STEP 1: Email Polling Test

**Purpose:** Verify emails are captured from Gmail and stored in database

**Manual Trigger:**
```bash
curl -X POST https://audico-dashboard.vercel.app/api/agents/email/poll \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "messagesFound": <number>,
  "messages": [{"id": "...", "from": "...", "subject": "..."}],
  "remaining": <number>
}
```

**Verification Query:**
```sql
-- Check if emails were actually inserted
SELECT
  COUNT(*) as total_emails,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM email_logs;

-- View recent emails
SELECT
  id,
  from_email,
  subject,
  category,
  status,
  created_at
FROM email_logs
ORDER BY created_at DESC
LIMIT 10;
```

**Success Criteria:**
- ✅ API returns `success: true`
- ✅ `messagesFound` > 0
- ✅ SQL query shows emails with recent `created_at` timestamps
- ✅ `category` is 'unclassified' (will be set in next step)
- ✅ `status` is 'unread'

**If This Fails:**
- Check Gmail OAuth credentials in Vercel env vars
- Check Gmail API quota limits
- Check Vercel logs for error messages
- Verify `email_logs` table exists and has correct permissions

---

### STEP 2: Email Classification Test

**Purpose:** Verify emails are categorized as order/support/inquiry/complaint/spam

**Manual Trigger:**
```bash
curl -X POST https://audico-dashboard.vercel.app/api/agents/email/classify \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "classified": <number>,
  "message": "Successfully classified X emails",
  "remaining": <number>
}
```

**Verification Query:**
```sql
-- Check classification results
SELECT
  category,
  COUNT(*) as count,
  AVG(CASE
    WHEN priority = 'urgent' THEN 4
    WHEN priority = 'high' THEN 3
    WHEN priority = 'medium' THEN 2
    ELSE 1
  END) as avg_priority
FROM email_logs
WHERE category != 'unclassified'
GROUP BY category
ORDER BY count DESC;

-- View classified emails by category
SELECT
  id,
  from_email,
  subject,
  category,
  priority,
  status
FROM email_logs
WHERE category != 'unclassified'
ORDER BY
  CASE priority
    WHEN 'urgent' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    ELSE 4
  END,
  created_at DESC
LIMIT 20;
```

**Success Criteria:**
- ✅ API returns `success: true`
- ✅ `classified` > 0
- ✅ SQL shows emails with categories: order, support, inquiry, complaint, spam, other
- ✅ Complaints have `priority = 'urgent'`
- ✅ Orders/support have `priority = 'high'`
- ✅ Inquiries have `priority = 'medium'`

**If This Fails:**
- If `classified: 0`, check if emails exist with `category = 'unclassified'`
- Check classification logic in `app/api/agents/email/classify/route.ts`
- Check Vercel logs for errors

---

### STEP 3: Jarvis Orchestration Test

**Purpose:** Verify Jarvis reads classified emails and triggers Email Agent

**Manual Trigger:**
```bash
curl -X POST https://audico-dashboard.vercel.app/api/agents/jarvis/orchestrate \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "emailsProcessed": <number>,
  "tasksCreated": <number>,
  "tasks": [{"title": "...", "agent": "..."}],
  "reasoning": "..."
}
```

**Verification Query:**
```sql
-- Check Jarvis activity
SELECT
  created_at,
  from_agent,
  to_agent,
  message,
  data
FROM squad_messages
WHERE from_agent = 'Jarvis'
ORDER BY created_at DESC
LIMIT 20;

-- Check if Email Agent was triggered
SELECT
  created_at,
  agent_name,
  event_type,
  message,
  context
FROM agent_logs
WHERE agent_name = 'email_agent'
  OR agent_name = 'Jarvis'
ORDER BY created_at DESC
LIMIT 20;
```

**Success Criteria:**
- ✅ API returns `success: true`
- ✅ `emailsProcessed` > 0
- ✅ `tasksCreated` > 0 (or 0 if no actionable emails)
- ✅ SQL shows messages from Jarvis in `squad_messages`
- ✅ SQL shows event_type = 'orchestrate_complete' in `agent_logs`

**If This Fails:**
- Check if Jarvis returns 404 model error → model name is wrong
- Check `ANTHROPIC_API_KEY` in Vercel env vars
- Check Anthropic API usage/quota
- Check if classified emails exist with status != 'handled'

---

### STEP 4: Email Response Test

**Purpose:** Verify Email Agent creates draft responses and approval tasks

**Note:** This is usually triggered by Jarvis, but can be tested manually

**Check if Email Agent Created Tasks:**
```sql
-- Check for response tasks created by Email Agent
SELECT
  id,
  title,
  description,
  assigned_agent,
  priority,
  requires_approval,
  metadata,
  created_at
FROM squad_tasks
WHERE assigned_agent = 'Email Agent'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

**Check Email Logs Status:**
```sql
-- Check if emails were marked as handled
SELECT
  id,
  from_email,
  subject,
  category,
  status,
  handled_by,
  metadata->>'draft_id' as draft_id
FROM email_logs
WHERE handled_by = 'email_agent'
  OR status IN ('scheduled', 'awaiting_approval', 'draft_created')
ORDER BY updated_at DESC
LIMIT 20;
```

**Success Criteria:**
- ✅ `squad_tasks` shows tasks with `assigned_agent = 'Email Agent'`
- ✅ Complaint emails have `requires_approval = true` and `priority = 'urgent'`
- ✅ Order/support emails have `requires_approval = true` and `priority = 'high'`
- ✅ Inquiry emails have `requires_approval = false` (auto-send)
- ✅ Tasks have `metadata` with `email_id` and `draft_id`
- ✅ `email_logs` shows `status = 'awaiting_approval'` or `'scheduled'`

**If This Fails:**
- Check if Email Agent route exists: `app/api/agents/email/respond/route.ts`
- Check Gmail API draft creation permissions
- Check Vercel logs for email respond errors
- Verify Jarvis actually triggered Email Agent (check logs)

---

### STEP 5: Approval Queue UI Test

**Purpose:** Verify approval tasks appear on dashboard

**Navigate to Dashboard:**
```
https://audico-dashboard.vercel.app/squad
```

**What to Look For:**
1. **ApprovalQueue component should be visible** between metrics and agent tabs
2. **If no approval tasks exist:** Should show green "All Clear!" box
3. **If approval tasks exist:** Should show yellow/orange box with:
   - Task count: "Pending Approvals (N)"
   - Task cards with:
     - Title: "Approve email response to [email]"
     - Description: Preview of response
     - Category badge: complaint/order/support
     - Priority badge: urgent/high
     - From email badge
     - Time ago badge
     - Preview draft link
     - ✅ Approve button (green)
     - ❌ Reject button (red)

**Verification Query:**
```sql
-- Get approval tasks that should appear on dashboard
SELECT
  id,
  title,
  description,
  assigned_agent,
  priority,
  requires_approval,
  approved_at,
  rejected_at,
  metadata,
  deliverable_url,
  created_at
FROM squad_tasks
WHERE requires_approval = true
  AND approved_at IS NULL
  AND rejected_at IS NULL
ORDER BY
  CASE priority
    WHEN 'urgent' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    ELSE 4
  END,
  created_at DESC;
```

**Success Criteria:**
- ✅ ApprovalQueue component renders on page
- ✅ SQL query matches what's shown on dashboard
- ✅ Task cards show correct metadata
- ✅ Clicking "Preview draft" opens `/emails/[id]/draft` page
- ✅ Preview page shows email details and draft response
- ✅ Approve/Reject buttons are functional

**If This Fails:**
- Clear browser cache: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
- Check browser console (F12) for JavaScript errors
- Verify Vercel deployment includes commit: 9d14386 (ApprovalQueue)
- Check if `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set in Vercel

---

### STEP 6: Task Approval Test

**Purpose:** Verify approving a task updates database correctly

**Approve a Task via Dashboard:**
1. Go to dashboard: https://audico-dashboard.vercel.app/squad
2. Find an approval task (urgent complaint or high priority order)
3. Click "✅ Approve" button
4. Should see: "✅ Task approved! It will be executed within 2 minutes."

**Verification Query:**
```sql
-- Check task was approved
SELECT
  id,
  title,
  status,
  requires_approval,
  approved_by,
  approved_at,
  execution_attempts,
  last_execution_attempt
FROM squad_tasks
WHERE approved_at IS NOT NULL
ORDER BY approved_at DESC
LIMIT 5;
```

**Success Criteria:**
- ✅ Task disappears from approval queue on dashboard
- ✅ SQL shows `approved_by = 'Kenny'`
- ✅ SQL shows `approved_at` has timestamp
- ✅ Task status is still 'new' (will change to 'in_progress' when executed)

**If This Fails:**
- Check browser console for errors
- Check if Supabase anon key has UPDATE permissions on `squad_tasks`
- Verify RLS policies allow frontend updates

---

### STEP 7: Task Execution Test

**Purpose:** Verify task executor picks up approved tasks and executes them

**Wait for Automatic Execution:**
- Task executor runs every 2 minutes via Vercel Cron
- Wait 2-5 minutes after approving

**OR Manual Trigger:**
```bash
curl -X POST https://audico-dashboard.vercel.app/api/cron/tasks/execute \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "executed": <number>,
  "failed": 0,
  "results": [{"taskId": "...", "status": "completed"}]
}
```

**Verification Query:**
```sql
-- Check if approved task was executed
SELECT
  id,
  title,
  status,
  approved_at,
  execution_attempts,
  last_execution_attempt,
  execution_error
FROM squad_tasks
WHERE approved_at IS NOT NULL
  AND execution_attempts > 0
ORDER BY last_execution_attempt DESC
LIMIT 10;

-- Check for DRY RUN execution logs
SELECT
  created_at,
  from_agent,
  message,
  data
FROM squad_messages
WHERE message LIKE '%DRY RUN%'
  OR message LIKE '%Would send email%'
ORDER BY created_at DESC
LIMIT 10;
```

**Vercel Logs Check:**
```
Search for: "[TASK EXECUTOR]"
Look for: "Executing task: [task-id]"
Look for: "[DRY RUN] Would send email: [subject]"
```

**Success Criteria:**
- ✅ SQL shows `execution_attempts = 1` (or higher if retried)
- ✅ SQL shows `last_execution_attempt` has recent timestamp
- ✅ SQL shows `status = 'completed'` (if successful)
- ✅ `squad_messages` shows "[DRY RUN] Would send email..." message
- ✅ Vercel logs show task execution activity
- ✅ No `execution_error` in database

**If This Fails:**
- Check `ENABLE_AUTO_EXECUTION=true` in Vercel env vars
- Check if task executor cron is configured in `vercel.json`
- Check Vercel logs for task executor errors
- Verify `AGENT_DRY_RUN=true` (if false, will actually send email!)
- Check if task handler exists: `services/execution-handlers/email-handler.ts`

---

### STEP 8: End-to-End Automatic Flow Test

**Purpose:** Verify the ENTIRE workflow runs automatically without manual triggers

**Setup:**
1. Send a test email to `support@audicoonline.co.za`
2. Subject: "TEST - Urgent complaint about delayed order"
3. Body: "I ordered product X two weeks ago and still haven't received it. This is unacceptable."

**Expected Timeline:**
- **T+0 min:** Email sent
- **T+15 min:** Email poll cron runs → email captured
- **T+20 min:** Email classify cron runs → email categorized as 'complaint'
- **T+30 min:** Jarvis orchestrate cron runs → triggers Email Agent
- **T+35 min:** Email Agent creates draft and approval task
- **T+40 min:** Approval task appears on dashboard
- **[Manual]** User approves task
- **T+42 min:** Task executor cron runs → executes task (DRY RUN log)

**Verification Queries:**

```sql
-- Track your test email through the system
SELECT
  id,
  from_email,
  subject,
  category,
  status,
  handled_by,
  created_at,
  updated_at
FROM email_logs
WHERE subject LIKE '%TEST%'
ORDER BY created_at DESC
LIMIT 5;

-- Check if task was created for your test email
SELECT
  t.id,
  t.title,
  t.status,
  t.requires_approval,
  t.approved_at,
  t.execution_attempts,
  t.created_at,
  e.from_email,
  e.subject
FROM squad_tasks t
LEFT JOIN email_logs e ON (t.metadata->>'email_id')::uuid = e.id
WHERE e.subject LIKE '%TEST%'
ORDER BY t.created_at DESC;
```

**Success Criteria:**
- ✅ Email appears in `email_logs` within 15 minutes
- ✅ Email is classified as 'complaint' within 20 minutes
- ✅ Jarvis creates message about email within 30 minutes
- ✅ Approval task appears on dashboard within 40 minutes
- ✅ After manual approval, task executes within 2 minutes
- ✅ DRY RUN log appears in `squad_messages`
- ✅ **ENTIRE FLOW COMPLETES WITHOUT MANUAL INTERVENTION** (except approval step)

**If This Fails:**
- Check Vercel Cron Jobs are configured and enabled
- Check Vercel logs for each cron job endpoint
- Verify all environment variables are set correctly
- Check if any cron job is returning 401 Unauthorized
- Verify cron authentication fix is deployed (commit: 88afc1b)

---

## 🚨 COMMON FAILURE POINTS

### 1. Email Polling Returns No Emails
**Symptoms:** API returns `messagesFound: 0` even though unread emails exist

**Possible Causes:**
- Gmail OAuth token expired/invalid
- Gmail API quota exceeded
- Query filter too restrictive (`q: 'is:unread'`)
- Emails already marked as read

**Debug:**
```bash
# Test Gmail API access directly
curl -H "Authorization: Bearer $GMAIL_ACCESS_TOKEN" \
  "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread"
```

---

### 2. Classification Returns 0 Classified
**Symptoms:** API returns `classified: 0` even though unclassified emails exist

**Possible Causes:**
- No emails with `category = 'unclassified'` in database
- Query logic bug in classify route
- All emails already classified

**Debug:**
```sql
-- Check for unclassified emails
SELECT COUNT(*)
FROM email_logs
WHERE category = 'unclassified'
  OR category IS NULL;
```

---

### 3. Jarvis Returns 404 Model Error
**Symptoms:** API returns 404 with "model: claude-3-5-sonnet-20241022"

**Fix Applied:** Commit e53bb6f updated model to `claude-sonnet-4-5-20250929`

**Verify Fix:**
```bash
grep -n "model:" app/api/agents/jarvis/orchestrate/route.ts
# Should show: model: 'claude-sonnet-4-5-20250929'
```

---

### 4. Cron Jobs Return 401 Unauthorized
**Symptoms:** Vercel logs show 401 errors on cron endpoints

**Fix Applied:** Commit 88afc1b added support for `x-vercel-cron` header

**Verify Fix:**
```bash
grep -n "verifyCronRequest" app/api/agents/email/poll/route.ts
# Should import and use verifyCronRequest function
```

---

### 5. ApprovalQueue Not Visible on Dashboard
**Symptoms:** Dashboard doesn't show approval queue component

**Possible Causes:**
- Code not deployed (commit 9d14386 missing)
- Browser cache showing old version
- Component rendering but showing "All Clear!" (no approval tasks)
- JavaScript error preventing render

**Debug:**
- Check browser console (F12) for errors
- Hard refresh: Ctrl+Shift+R
- Verify deployment includes ApprovalQueue files
- Run SQL query to check if approval tasks actually exist

---

### 6. Task Executor Doesn't Pick Up Approved Tasks
**Symptoms:** Approved tasks stay in 'new' status, never executed

**Possible Causes:**
- `ENABLE_AUTO_EXECUTION=false` in env vars
- Task executor cron not running
- Query not finding approved tasks
- Handler doesn't exist for task type

**Debug:**
```bash
# Check Vercel logs for task executor
# Search for: "[TASK EXECUTOR]"
# Should run every 2 minutes

# Check env var
echo $ENABLE_AUTO_EXECUTION  # Should be 'true'
```

---

## 📊 SUCCESS METRICS

**After completing this test plan, the system should demonstrate:**

1. **Email Capture Rate:** 90%+ of unread emails captured within 15 minutes
2. **Classification Accuracy:** 80%+ emails correctly categorized
3. **Orchestration Success:** Jarvis processes 100% of classified emails
4. **Response Generation:** 100% of actionable emails get draft responses
5. **Approval Flow:** 100% of approval tasks appear on dashboard within 40 minutes
6. **Execution Success:** 100% of approved tasks execute within 2 minutes
7. **Error Rate:** <5% of tasks fail with `execution_error`

---

## 🎯 FINAL VALIDATION

**Run this comprehensive health check query:**

```sql
SELECT
  'Emails Captured (Last 24h)' as metric,
  COUNT(*) as value
FROM email_logs
WHERE created_at > NOW() - INTERVAL '24 hours'

UNION ALL

SELECT
  'Emails Classified',
  COUNT(*)
FROM email_logs
WHERE category != 'unclassified'
  AND created_at > NOW() - INTERVAL '24 hours'

UNION ALL

SELECT
  'Tasks Created (Last 24h)',
  COUNT(*)
FROM squad_tasks
WHERE created_at > NOW() - INTERVAL '24 hours'

UNION ALL

SELECT
  'Approval Tasks Pending',
  COUNT(*)
FROM squad_tasks
WHERE requires_approval = true
  AND approved_at IS NULL
  AND rejected_at IS NULL

UNION ALL

SELECT
  'Tasks Executed (Last 24h)',
  COUNT(*)
FROM squad_tasks
WHERE execution_attempts > 0
  AND last_execution_attempt > NOW() - INTERVAL '24 hours'

UNION ALL

SELECT
  'Failed Tasks',
  COUNT(*)
FROM squad_tasks
WHERE execution_error IS NOT NULL
  AND created_at > NOW() - INTERVAL '24 hours'

UNION ALL

SELECT
  'DRY RUN Logs (Last 24h)',
  COUNT(*)
FROM squad_messages
WHERE message LIKE '%DRY RUN%'
  AND created_at > NOW() - INTERVAL '24 hours';
```

**Expected Healthy Results:**
```
Emails Captured (Last 24h)       | 50-200
Emails Classified                | 40-190
Tasks Created (Last 24h)         | 10-50
Approval Tasks Pending           | 0-10
Tasks Executed (Last 24h)        | 5-40
Failed Tasks                     | 0-2
DRY RUN Logs (Last 24h)          | 5-40
```

---

## 🔄 HANDOFF CHECKLIST

**Before handing this to a new chat, verify:**

- [ ] All code is committed and pushed to GitHub
- [ ] Latest deployment (commit e53bb6f) is live on Vercel
- [ ] All environment variables are set in Vercel
- [ ] Database migrations are run (007_execution_tracking.sql)
- [ ] Cron jobs are configured in Vercel dashboard
- [ ] This test plan document is saved in project root

**Provide to new chat:**
1. This test plan document
2. Link to GitHub repo: https://github.com/AudicoSA/audico-dashboard
3. Link to Vercel project: https://vercel.com/[your-project]
4. Supabase project URL and credentials
5. List of environment variables (redacted values)

---

## 💡 WHAT WAS ACTUALLY BUILT

**Infrastructure (Phase 1):**
- Task executor service with retry logic
- Approval workflow system
- Cron job endpoints for automation
- Alert service for notifications
- Database schema with execution tracking

**Email Workflow (Phase 2):**
- Gmail OAuth integration for reading/sending emails
- Email polling service (every 15 min)
- Email classification service (every 20 min)
- Jarvis AI orchestrator (every 10 min)
- Email response generation with Claude AI
- Draft creation in Gmail
- Approval workflow (complaints, orders, support)
- Auto-send workflow (inquiries, spam)
- Task executor (every 2 min)

**UI (Phase 6 - Partial):**
- ApprovalQueue component on dashboard
- Email draft preview pages
- Real-time updates via Supabase subscriptions

**What's NOT Built:**
- Social media posting (Phase 3)
- Marketing automation (Phase 4)
- Analytics dashboard (Phase 5)
- Full UI features (Phase 6)

---

## ⚠️ KNOWN LIMITATIONS

1. **DRY_RUN Mode:** System only logs actions, doesn't actually send emails
2. **Rate Limiting:** Limited to 96 API calls per day per agent
3. **Classification:** Simple keyword-based, not AI-powered
4. **No Email Body Analysis:** Only subject line used for classification
5. **Single Gmail Account:** No multi-account support
6. **No Attachments:** Email responses don't support attachments
7. **English Only:** No multi-language support

---

## 📞 SUPPORT

**If test fails and you can't fix it:**

1. Check MEMORY.md for common issues and solutions
2. Review Vercel logs for specific error messages
3. Run diagnostic SQL queries to pinpoint failure step
4. Check GitHub commit history for recent changes
5. Create new Claude Code chat with this test plan

**Critical Files:**
- `vercel.json` - Cron job configuration
- `lib/cron-auth.ts` - Cron authentication logic
- `app/api/agents/jarvis/orchestrate/route.ts` - Jarvis AI
- `app/api/agents/email/poll/route.ts` - Email polling
- `app/api/agents/email/classify/route.ts` - Email classification
- `app/api/agents/email/respond/route.ts` - Draft generation
- `app/api/cron/tasks/execute/route.ts` - Task executor
- `services/task-executor.ts` - Task execution logic
- `services/execution-handlers/email-handler.ts` - Email execution

---

**Test Plan End**
*Good luck! The infrastructure is solid. It just needs to be proven working.*
