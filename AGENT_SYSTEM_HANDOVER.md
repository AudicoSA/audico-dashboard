# Agent System Handover & Diagnostic Guide

**Date:** February 9, 2026
**Project:** Audico Dashboard - Mission Control Agent System
**Live URL:** https://audico-dashboard.vercel.app/squad
**Status:** Agents running but NOT completing work

---

## 🔴 CURRENT PROBLEM

**Symptoms:**
- ✅ Agents appear online in dashboard
- ✅ Cron jobs are configured and running
- ✅ Tasks are being created
- ❌ **0 tasks completed**
- ❌ **No emails being processed** (user reports 100+ emails received, none found)
- ❌ **No visible progress in Live Activity Feed**

---

## 📊 SYSTEM ARCHITECTURE

### Agent Squad (6 Agents Total):
1. **Jarvis** (Master Orchestrator) - Uses Claude 3.5 Sonnet to analyze situation and delegate tasks
2. **Email Agent** - Polls Gmail, classifies emails
3. **Social Media Agent** - Creates posts (Twitter connected via OAuth 2.0)
4. **Google Ads Agent** - Monitors campaigns (not yet configured)
5. **SEO Agent** - Audits products (not yet configured)
6. **Marketing Agent** - Processes resellers (not yet configured)

### Cron Schedule (Vercel):
```
- Jarvis Orchestrate:    Every 10 minutes
- Email Poll:           Every 15 minutes
- Email Classify:       Every 20 minutes (JUST FIXED - was broken)
- Stock Check:          Every 6 hours
- Analytics Update:     Daily at midnight
- Maintenance Cleanup:  Daily at 2 AM
```

### Database Tables (Supabase):
- `squad_agents` - Agent profiles and status
- `squad_tasks` - Kanban board items
- `squad_messages` - Inter-agent communication log
- `email_logs` - Processed emails
- `agent_logs` - Detailed agent activity logs

---

## ✅ WHAT'S WORKING

1. **Vercel Deployment**
   - Pro plan with cron jobs configured
   - Redis connection via RedisLabs (using ioredis)
   - Rate limiting active (96 calls/day limit per agent)

2. **Twitter OAuth 2.0**
   - Successfully connected
   - OAuth 2.0 implementation complete
   - Can post tweets via Social Media Agent

3. **Database Schema**
   - All migrations run (002, 003, 004, 005, 006)
   - Tables created with correct schema
   - RLS disabled for service role access

4. **Recent Fixes Applied (Today)**
   - Email Classify agent now batch-processes all unclassified emails
   - Twitter OAuth switched from 1.0a to 2.0
   - Quote chat cron job disabled (was causing errors)
   - Debug endpoint added: `/api/debug/agents`

---

## 🔍 DIAGNOSTIC CHECKLIST

### 1. Verify Environment Variables (Vercel)

**Critical Variables:**
```bash
# Supabase (REQUIRED)
✓ NEXT_PUBLIC_SUPABASE_URL=https://ajdehycoypilsegmxbto.supabase.co
✓ NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
✓ SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Cron Authentication (REQUIRED)
? CRON_SECRET=[secure random string]

# Redis (REQUIRED)
? REDIS_URL=[RedisLabs connection string]

# Gmail API (REQUIRED for Email Agent)
? GMAIL_CLIENT_ID=...
? GMAIL_CLIENT_SECRET=...
? GMAIL_REFRESH_TOKEN=...
? GMAIL_REDIRECT_URI=http://localhost:3001/api/auth/gmail/callback

# Anthropic Claude (REQUIRED for Jarvis)
? ANTHROPIC_API_KEY=...

# App URL (REQUIRED for OAuth)
? NEXT_PUBLIC_APP_URL=https://audico-dashboard.vercel.app

# Twitter OAuth 2.0 (OPTIONAL)
? TWITTER_CLIENT_ID=...
? TWITTER_CLIENT_SECRET=...
```

**How to Check:**
1. Go to Vercel → audico-dashboard → Settings → Environment Variables
2. Verify ALL variables with `?` above are present
3. **CRITICAL:** Check if `GMAIL_REFRESH_TOKEN` is expired

---

### 2. Check Vercel Deployment Logs

**Where:** Vercel → Deployments → Latest → Logs tab

**Look for:**
```
✓ "Starting Gmail poll"
✓ "Found X unread messages"
✓ "Classifying X emails"
✓ "Jarvis orchestration started"

✗ "Gmail API error"
✗ "401 Unauthorized"
✗ "Rate limit exceeded"
✗ "invalid_grant" (token expired)
```

**If you see errors:**
- Gmail token expired → Regenerate OAuth token
- 401 errors → Check Supabase keys
- Rate limit → Wait for reset or increase limits

---

### 3. Verify Cron Jobs Are Running

**Manual Test:**
```bash
# Test Email Poll (should return 200)
curl -X POST https://audico-dashboard.vercel.app/api/agents/email/poll \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Test Email Classify (should return 200)
curl -X POST https://audico-dashboard.vercel.app/api/agents/email/classify \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Test Jarvis Orchestrate (should return 200)
curl -X POST https://audico-dashboard.vercel.app/api/agents/jarvis/orchestrate \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Expected Response:**
```json
{
  "success": true,
  "messagesFound": 10,
  "remaining": 95
}
```

---

### 4. Check Database for Activity

**Supabase SQL Editor - Run these queries:**

```sql
-- Check recent agent messages (should show activity)
SELECT from_agent, message, created_at
FROM squad_messages
ORDER BY created_at DESC
LIMIT 20;

-- Check email logs (are emails being found?)
SELECT from_email, subject, status, category, created_at
FROM email_logs
ORDER BY created_at DESC
LIMIT 20;

-- Check task completion (WHY IS THIS 0?)
SELECT status, COUNT(*)
FROM squad_tasks
GROUP BY status;

-- Check agent logs for errors
SELECT agent_name, log_level, message, created_at
FROM agent_logs
WHERE log_level = 'error'
ORDER BY created_at DESC
LIMIT 20;
```

---

### 5. Use Debug Endpoint

**URL:** https://audico-dashboard.vercel.app/api/debug/agents

**Returns:**
- Recent messages from all agents
- Task breakdown by status
- Unread email count
- Agent logs
- Environment variable status (without showing values)

**Example:**
```json
{
  "summary": {
    "unread_emails": 0,
    "tasks_by_status": {
      "new": 8,
      "in_progress": 2,
      "completed": 0
    }
  },
  "environment": {
    "has_gmail_token": true,
    "has_anthropic_key": true,
    "has_cron_secret": true
  }
}
```

---

## 🐛 KNOWN ISSUES & FIXES

### Issue 1: Email Agent Not Finding Emails

**Symptoms:** "Found 0 unread messages" despite 100+ emails received

**Possible Causes:**
1. **Gmail OAuth token expired**
   - Fix: Regenerate Gmail OAuth token
   - Check Vercel logs for "invalid_grant" error

2. **Emails already marked as read**
   - Email Agent only looks for `is:unread` emails
   - Fix: Check Gmail manually - are emails actually unread?

3. **Gmail API quota exceeded**
   - Fix: Check Google Cloud Console quota page

4. **Wrong Gmail account**
   - Fix: Verify `GMAIL_REFRESH_TOKEN` is for correct account

**How to Fix:**
```bash
# Regenerate Gmail OAuth token
# 1. Go to Google Cloud Console
# 2. APIs & Services → Credentials
# 3. Create new OAuth 2.0 Client ID (Web application)
# 4. Add authorized redirect: https://audico-dashboard.vercel.app/api/auth/gmail/callback
# 5. Use OAuth Playground to get refresh token
# 6. Update GMAIL_REFRESH_TOKEN in Vercel
```

---

### Issue 2: Tasks Never Complete

**Symptoms:** Tasks stuck in "in_progress", 0% completion rate

**Root Cause:** **Agents don't mark tasks as completed**

**Current Behavior:**
- Jarvis creates tasks ✓
- Email Agent finds/classifies emails ✓
- **BUT:** No agent calls `updateTaskStatus(taskId, 'completed')` ✗

**Fix Required:**
Agents need to update task status after completing work. Example:

```typescript
// After email is classified and handled:
await supabase
  .from('squad_tasks')
  .update({ status: 'completed', updated_at: new Date().toISOString() })
  .eq('id', taskId)
```

**This is NOT implemented yet!**

---

### Issue 3: No Visible Agent Activity

**Symptoms:** Live Activity Feed shows old messages, nothing recent

**Possible Causes:**
1. Cron jobs not running (check Vercel logs)
2. Agents running but failing silently
3. Frontend not refreshing (check browser console)
4. squad_messages table not being updated

**Fix:** Check `/api/debug/agents` endpoint to see raw data

---

## 🔧 IMMEDIATE ACTION ITEMS

### Priority 1: Verify Gmail Token
```bash
# Test Gmail API access manually
curl https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1 \
  -H "Authorization: Bearer $(gcloud auth print-access-token)"
```

If this fails → Gmail token is expired or invalid

### Priority 2: Check Vercel Cron Execution
1. Vercel → Deployments → Latest → Functions tab
2. Look for `/api/agents/email/poll` executions
3. Check logs for each execution
4. Verify they're running every 15 minutes

### Priority 3: Manually Trigger Agent
```bash
# Force Email Poll to run NOW
curl -X POST https://audico-dashboard.vercel.app/api/agents/email/poll \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

Check response - does it find emails?

---

## 📝 NEXT STEPS FOR NEW SESSION

1. **Start Here:**
   - Visit `/api/debug/agents` endpoint
   - Share the full output

2. **Check Vercel Logs:**
   - Go to latest deployment logs
   - Search for "Gmail poll" or "Email Agent"
   - Share any errors

3. **Verify Gmail Access:**
   - Can the app actually read Gmail?
   - Is token valid?
   - Try manual curl with token

4. **Database Query:**
   ```sql
   -- Are emails being logged at all?
   SELECT COUNT(*), MAX(created_at) FROM email_logs;

   -- Are agents logging activity?
   SELECT COUNT(*), MAX(created_at) FROM agent_logs;
   ```

5. **Fix Task Completion:**
   - Once agents are working, add task completion logic
   - Each agent needs to mark its tasks as done

---

## 🎯 SUCCESS CRITERIA

**System is working when:**
- ✅ Email Agent finds emails (> 0 unread)
- ✅ Email Agent classifies emails (status: 'classified')
- ✅ Jarvis creates relevant tasks based on emails
- ✅ Tasks move to "completed" status
- ✅ Live Activity Feed shows recent activity (< 5 min old)
- ✅ At least ONE task completes per hour

---

## 📚 KEY FILES

**Agent Routes:**
- `app/api/agents/email/poll/route.ts` - Finds emails
- `app/api/agents/email/classify/route.ts` - Classifies emails (JUST FIXED)
- `app/api/agents/jarvis/orchestrate/route.ts` - Master orchestrator

**Configuration:**
- `vercel.json` - Cron schedule
- `lib/rate-limiter.ts` - Redis rate limiting
- `lib/logger.ts` - Agent activity logging

**Frontend:**
- `app/squad/page.tsx` - Mission Control dashboard
- `app/squad/components/ActivityFeed.tsx` - Live activity display

**Database:**
- `supabase/migrations/006_replace_demo_agents_with_real_agents.sql` - Latest schema

---

## 💡 DEBUGGING TIPS

1. **Always check Vercel logs first** - Most errors show here
2. **Use `/api/debug/agents`** - Fast overview of system state
3. **Check Gmail manually** - Are emails actually unread?
4. **Verify cron secret** - Wrong secret = 401 errors = silent failure
5. **Check rate limits** - May be hitting 96 calls/day limit

---

## 🆘 EMERGENCY RESET

If everything is broken, reset the system:

```sql
-- Clear all tasks
DELETE FROM squad_tasks;

-- Clear all messages
DELETE FROM squad_messages;

-- Clear email logs
DELETE FROM email_logs;

-- Reset agent status
UPDATE squad_agents SET status = 'idle', last_active = NOW();
```

Then wait for next cron run (max 10 minutes).

---

---

## 🔄 OPTIONAL: Re-enable Quote Chat Sync

Quote chat sync was disabled because credentials weren't configured. If user wants it back and uses the same database:

### Update Code to Use Existing Credentials

**File:** `app/api/cron/quote-chat/sync/route.ts`

Change from:
```typescript
const supabase = createClient(
  process.env.AUDICO_CHAT_QUOTE_SUPABASE_URL!,
  process.env.AUDICO_CHAT_QUOTE_SUPABASE_KEY!
)
```

To:
```typescript
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

### Re-enable Cron Job

**File:** `vercel.json`

Add back:
```json
{
  "path": "/api/cron/quote-chat/sync",
  "schedule": "0 */4 * * *"
}
```

### Commit and Push
```bash
git add -A
git commit -m "Re-enable quote chat sync with existing database"
git push origin HEAD
```

---

**Good luck! The system SHOULD work, something is blocking it.** 🔍
