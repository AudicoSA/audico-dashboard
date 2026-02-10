# Phase 1 & 2 Verification Tests

**Date:** February 10, 2026
**Status:** Deployed but needs verification
**Issue:** Dashboard shows no visible changes from Phase 1 & 2

---

## 🚨 Why You Don't See Changes Yet

**Phase 1 & 2 are BACKEND changes:**
- Task executor runs in background (every 2 minutes)
- Email handler executes tasks automatically
- NO frontend/UI changes were made
- Changes are in: database schema, cron jobs, API endpoints, background services

**What SHOULD be happening:**
- Task executor polls `squad_tasks` every 2 minutes
- Tasks with `requires_approval=false` get executed automatically
- Execution logs appear in `agent_logs` and Vercel logs
- Email tasks get picked up and executed (in DRY_RUN mode)

---

## ✅ Verification Checklist

### 1. Check Vercel Deployment

**Go to:** https://vercel.com/[your-project]/deployments

**Verify:**
- ✅ Latest deployment successful (commit: dffb7da)
- ✅ Deployment includes Phase 1 & 2 files
- ✅ Build completed without errors
- ✅ Deployment is live

---

### 2. Verify Environment Variables

**Go to:** Vercel Dashboard → Settings → Environment Variables

**Required Variables:**
```bash
✅ AGENT_DRY_RUN=true              # Must be set!
✅ ENABLE_AUTO_EXECUTION=true      # Must be set!
✅ CRON_SECRET=your_secret         # Must match vercel.json
✅ GMAIL_CLIENT_ID=...
✅ GMAIL_CLIENT_SECRET=...
✅ GMAIL_REFRESH_TOKEN=...
✅ SUPABASE_SERVICE_ROLE_KEY=...
✅ REDIS_URL=...
```

**If missing:** Add them and redeploy!

---

### 3. Check Cron Jobs

**Go to:** Vercel Dashboard → Settings → Cron Jobs

**Expected Cron Jobs:**

| Path | Schedule | Status |
|------|----------|--------|
| `/api/cron/tasks/execute` | `*/2 * * * *` (every 2 min) | ✅ Should exist |
| `/api/cron/email/poll` | `*/15 * * * *` | ✅ Already exists |
| `/api/cron/email/classify` | `*/20 * * * *` | ✅ Already exists |

**If `/api/cron/tasks/execute` is missing:**
- Vercel didn't pick up the updated `vercel.json`
- Force redeploy or manually add cron job

---

### 4. Check Vercel Logs (CRITICAL)

**Go to:** Vercel Dashboard → Logs (real-time)

**What to look for:**

**GOOD SIGNS (Phase 1 & 2 working):**
```
[TASK EXECUTOR] Polling for executable tasks...
[TASK EXECUTOR] Found 0 executable tasks
[DRY RUN] Would send email: ...
[EMAIL HANDLER] Executing task: ...
```

**BAD SIGNS (Not working):**
```
Error: Cannot find module 'services/task-executor'
Error: ENABLE_AUTO_EXECUTION is not set
Error: CRON_SECRET mismatch
No logs mentioning TASK EXECUTOR
```

**How to check:**
1. Go to Vercel logs
2. Filter by `/api/cron/tasks/execute`
3. Should see logs every 2 minutes
4. If no logs → cron job not running

---

### 5. Check Database Migration

**Go to:** Supabase SQL Editor

**Run this query:**
```sql
-- Check if new columns exist
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'squad_tasks'
AND column_name IN (
  'execution_attempts',
  'requires_approval',
  'approved_by',
  'approved_at'
);

-- Should return 4 rows
```

**Expected Result:**
```
execution_attempts
requires_approval
approved_by
approved_at
```

**If empty:** Migration 007 didn't run correctly

---

### 6. Check Task Executor Table

**Go to:** Supabase Table Editor → `squad_tasks`

**Look for new columns:**
- `execution_attempts` (integer)
- `last_execution_attempt` (timestamp)
- `execution_error` (text)
- `requires_approval` (boolean)
- `approved_by` (text)
- `approved_at` (timestamp)

**If missing:** Migration wasn't applied

---

### 7. Check for Executable Tasks

**Go to:** Supabase SQL Editor

**Run this query:**
```sql
-- Find tasks that should be executed
SELECT
  id,
  title,
  status,
  assigned_agent,
  requires_approval,
  approved_at,
  execution_attempts,
  created_at
FROM squad_tasks
WHERE status = 'new'
  AND (
    requires_approval = false
    OR approved_at IS NOT NULL
  )
ORDER BY created_at DESC
LIMIT 10;
```

**Expected:**
- If 0 results: No tasks ready for execution (normal if no emails came in)
- If >0 results: Tasks exist but not being executed (PROBLEM!)

---

### 8. Test Task Executor Manually

**Method 1: Trigger Cron Manually**

In your terminal:
```bash
# Trigger task executor cron job
curl -X POST https://audico-dashboard.vercel.app/api/cron/tasks/execute \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"

# Expected response:
# {"success":true,"executed":0,"failed":0,"message":"No executable tasks found"}
```

**Method 2: Create a Test Task**

In Supabase SQL Editor:
```sql
-- Create a test auto-execute task
INSERT INTO squad_tasks (
  title,
  description,
  status,
  assigned_agent,
  priority,
  requires_approval,
  metadata
) VALUES (
  'TEST - Auto-execute task',
  'This is a test task to verify the task executor works',
  'new',
  'Email Agent',
  'low',
  false,  -- Auto-execute, no approval needed
  '{"test": true, "email_id": "test_001", "draft_id": "test_draft_001"}'::jsonb
);

-- Wait 2 minutes for task executor to pick it up

-- Check if task was picked up
SELECT
  id,
  title,
  status,
  execution_attempts,
  last_execution_attempt,
  execution_error
FROM squad_tasks
WHERE title = 'TEST - Auto-execute task';

-- Expected:
-- status should change from 'new' to 'in_progress' or 'completed'
-- execution_attempts should be > 0
-- last_execution_attempt should have a timestamp
```

---

### 9. Check Agent Logs Table

**Go to:** Supabase SQL Editor

**Run this query:**
```sql
-- Check for task executor logs
SELECT
  created_at,
  agent_name,
  log_level,
  event_type,
  message,
  context
FROM agent_logs
WHERE agent_name LIKE '%task%'
  OR event_type LIKE '%execut%'
ORDER BY created_at DESC
LIMIT 20;
```

**Expected:**
- Logs from task executor
- Logs from email handler
- Event types like 'task_execution', 'email_send', etc.

**If empty:** Task executor isn't logging or isn't running

---

### 10. Check Squad Messages

**Go to:** Supabase SQL Editor

**Run this query:**
```sql
-- Check for task executor messages
SELECT
  created_at,
  from_agent,
  message,
  data
FROM squad_messages
WHERE from_agent IN ('Email Agent', 'task_executor', 'System')
ORDER BY created_at DESC
LIMIT 20;
```

**Expected:**
- Messages like "[DRY RUN] Would send email: ..."
- Messages about task execution
- Error messages if something failed

---

## 🔧 Common Issues & Fixes

### Issue 1: Cron Job Not Running

**Symptoms:**
- No logs in Vercel for `/api/cron/tasks/execute`
- No task executor activity

**Fix:**
1. Check `vercel.json` was committed and pushed
2. Redeploy from Vercel dashboard
3. Manually add cron job in Vercel Settings if needed

---

### Issue 2: Environment Variables Missing

**Symptoms:**
- Error: "ENABLE_AUTO_EXECUTION is not set"
- Error: "AGENT_DRY_RUN is not defined"

**Fix:**
1. Go to Vercel → Settings → Environment Variables
2. Add missing variables
3. Redeploy

---

### Issue 3: Migration Not Applied

**Symptoms:**
- Columns missing from squad_tasks table
- Error: "column execution_attempts does not exist"

**Fix:**
1. Run migration 007 again in Supabase SQL Editor
2. Verify columns exist with query from Test 5

---

### Issue 4: Task Executor Not Finding Tasks

**Symptoms:**
- Logs show: "Found 0 executable tasks"
- But tasks exist with status='new'

**Possible causes:**
- Tasks have `requires_approval=true` and `approved_at=NULL`
- Tasks have wrong status
- Query in task executor has bug

**Fix:**
1. Check task approval status with query from Test 7
2. Approve test task manually:
```sql
UPDATE squad_tasks
SET approved_by = 'Kenny',
    approved_at = NOW(),
    requires_approval = false
WHERE title = 'TEST - Auto-execute task';
```

---

### Issue 5: Email Handler Fails

**Symptoms:**
- Task status stuck at 'in_progress'
- execution_error has message
- No emails sent

**Possible causes:**
- Missing email_id or draft_id in metadata
- Gmail API credentials invalid
- Draft ID doesn't exist

**Fix:**
1. Check task metadata:
```sql
SELECT title, metadata, execution_error
FROM squad_tasks
WHERE status = 'in_progress';
```
2. Verify Gmail credentials in Vercel env vars
3. Check Vercel logs for detailed error

---

## 📊 Expected Behavior Summary

### When Everything Works:

**Every 2 minutes:**
1. Task executor cron runs (`/api/cron/tasks/execute`)
2. Queries for executable tasks (status='new', requires_approval=false OR approved)
3. Dispatches each task to appropriate handler
4. Handler executes (in DRY_RUN mode, just logs)
5. Updates task status to 'completed'
6. Logs to agent_logs and squad_messages

**When email comes in:**
1. Email poll (every 15 min) → stores in email_logs
2. Email classify (every 20 min) → adds category
3. Jarvis orchestrate → reads classified email
4. Email respond → creates draft + creates task
5. Task executor (every 2 min) → picks up task
6. Email handler → executes (sends or logs dry-run)
7. Task marked completed

---

## 🎯 Quick Diagnostic Command

Run this single SQL query to check overall system health:

```sql
SELECT
  'Environment' as check_type,
  'Migration 007' as check_name,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='squad_tasks'
      AND column_name='execution_attempts'
    ) THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status

UNION ALL

SELECT
  'Database',
  'Executable Tasks',
  CAST(COUNT(*) AS TEXT) || ' tasks ready'
FROM squad_tasks
WHERE status = 'new'
  AND (requires_approval = false OR approved_at IS NOT NULL)

UNION ALL

SELECT
  'Activity',
  'Recent Task Attempts',
  CAST(COUNT(*) AS TEXT) || ' attempts'
FROM squad_tasks
WHERE execution_attempts > 0

UNION ALL

SELECT
  'Logs',
  'Agent Log Entries',
  CAST(COUNT(*) AS TEXT) || ' entries'
FROM agent_logs
WHERE created_at > NOW() - INTERVAL '1 hour'

UNION ALL

SELECT
  'Messages',
  'Squad Messages',
  CAST(COUNT(*) AS TEXT) || ' messages'
FROM squad_messages
WHERE created_at > NOW() - INTERVAL '1 hour';
```

**Expected output:**
```
✅ PASS - Migration 007
X tasks ready - Executable Tasks
X attempts - Recent Task Attempts
X entries - Agent Log Entries
X messages - Squad Messages
```

---

## 🚀 If Everything Checks Out

If all tests pass but you still don't see changes:
1. **Dashboard UI hasn't been updated** - Phase 1 & 2 are backend only
2. **No tasks have been executed yet** - Normal if no emails came in
3. **DRY_RUN mode is working** - Check logs for "[DRY RUN]" messages

**Next steps:**
1. Send test inquiry email to trigger workflow
2. Wait for email → classify → respond → execute cycle
3. Check Vercel logs for execution activity
4. Verify test email draft appears in Gmail

---

## 📞 Need Help?

If verification fails, provide:
1. Screenshot of Vercel deployment page
2. Screenshot of Vercel cron jobs
3. Output of SQL diagnostic query
4. Last 50 lines from Vercel logs
5. Environment variables list (redacted values)

This will help debug the exact issue!
