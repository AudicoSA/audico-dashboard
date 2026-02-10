-- EMERGENCY DIAGNOSTIC - Run these queries in Supabase SQL Editor
-- Copy each section and run separately

-- ==========================================
-- 1. CHECK IF EMAILS ARE BEING POLLED
-- ==========================================
-- Should show emails from today
SELECT
  id,
  from_email,
  subject,
  category,
  status,
  created_at
FROM email_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 20;

-- Expected: Should see your complaint email and other recent emails
-- If EMPTY: Email polling is NOT working!


-- ==========================================
-- 2. CHECK TOTAL EMAILS TODAY
-- ==========================================
SELECT COUNT(*) as total_emails_today
FROM email_logs
WHERE created_at > CURRENT_DATE;

-- Expected: Should show 100+ emails if you received that many
-- If 0: Email polling completely broken!


-- ==========================================
-- 3. CHECK IF TASKS ARE BEING CREATED
-- ==========================================
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
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 20;

-- Expected: Should see tasks for email responses
-- If EMPTY: Email respond route is NOT creating tasks!


-- ==========================================
-- 4. CHECK AGENT ACTIVITY LOGS
-- ==========================================
SELECT
  created_at,
  agent_name,
  event_type,
  log_level,
  message,
  context
FROM agent_logs
WHERE created_at > NOW() - INTERVAL '2 hours'
ORDER BY created_at DESC
LIMIT 50;

-- Expected: Should see email_poll, email_classify, email_respond, jarvis_orchestrate
-- If EMPTY: No agent activity at all!


-- ==========================================
-- 5. CHECK SQUAD MESSAGES (AGENT CHATTER)
-- ==========================================
SELECT
  created_at,
  from_agent,
  to_agent,
  message,
  data
FROM squad_messages
WHERE created_at > NOW() - INTERVAL '2 hours'
ORDER BY created_at DESC
LIMIT 30;

-- Expected: Should see messages about emails being processed
-- If EMPTY: Agents aren't communicating at all!


-- ==========================================
-- 6. CHECK YOUR COMPLAINT EMAIL SPECIFICALLY
-- ==========================================
SELECT
  id,
  from_email,
  subject,
  category,
  status,
  handled_by,
  metadata,
  created_at
FROM email_logs
WHERE from_email LIKE '%kenny%'
  OR subject ILIKE '%complaint%'
ORDER BY created_at DESC
LIMIT 5;

-- This will show if your test complaint email was captured


-- ==========================================
-- 7. CHECK IF CLASSIFIED EMAILS EXIST
-- ==========================================
SELECT
  COUNT(*) as classified_count,
  category,
  status
FROM email_logs
WHERE category IS NOT NULL
  AND created_at > CURRENT_DATE
GROUP BY category, status
ORDER BY classified_count DESC;

-- Shows how many emails were classified by category
-- If all NULL: Classification not working!


-- ==========================================
-- 8. CHECK FOR EMAILS NEEDING RESPONSE
-- ==========================================
SELECT
  id,
  from_email,
  subject,
  category,
  status,
  created_at
FROM email_logs
WHERE status IN ('classified', 'new')
  AND category IS NOT NULL
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 20;

-- These are emails waiting to be handled by Jarvis


-- ==========================================
-- 9. SYSTEM HEALTH CHECK
-- ==========================================
SELECT
  'Emails Today' as metric,
  COUNT(*) as count
FROM email_logs
WHERE created_at > CURRENT_DATE

UNION ALL

SELECT
  'Classified Emails',
  COUNT(*)
FROM email_logs
WHERE category IS NOT NULL
  AND created_at > CURRENT_DATE

UNION ALL

SELECT
  'Tasks Created Today',
  COUNT(*)
FROM squad_tasks
WHERE created_at > CURRENT_DATE

UNION ALL

SELECT
  'Pending Approvals',
  COUNT(*)
FROM squad_tasks
WHERE requires_approval = true
  AND approved_at IS NULL

UNION ALL

SELECT
  'Agent Logs (Last Hour)',
  COUNT(*)
FROM agent_logs
WHERE created_at > NOW() - INTERVAL '1 hour'

UNION ALL

SELECT
  'Squad Messages (Last Hour)',
  COUNT(*)
FROM squad_messages
WHERE created_at > NOW() - INTERVAL '1 hour';

-- This gives you a quick overview of system activity
