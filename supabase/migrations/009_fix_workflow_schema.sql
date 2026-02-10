-- Migration 009: Fix Workflow Schema
-- Fixes ALL schema issues preventing the email workflow from completing end-to-end
-- MUST BE RUN IN SUPABASE SQL EDITOR

-- ============================================
-- FIX 1: Add missing columns to email_logs
-- ============================================

-- Add metadata column (used by respond route to store draft_id, scheduled_for, etc.)
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add priority column (used by classify route)
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium';

-- ============================================
-- FIX 2: Fix email_logs status CHECK constraint
-- The old constraint only allows: unread, classified, draft_created, sent, archived
-- But the workflow needs: scheduled, awaiting_approval, handled
-- ============================================

-- Drop the old constraint
ALTER TABLE email_logs DROP CONSTRAINT IF EXISTS email_logs_status_check;

-- Add new constraint with all needed statuses
ALTER TABLE email_logs ADD CONSTRAINT email_logs_status_check
  CHECK (status IN ('unread', 'classified', 'draft_created', 'scheduled', 'awaiting_approval', 'handled', 'sent', 'archived'));

-- ============================================
-- FIX 3: Add missing metadata column to squad_tasks
-- (used by respond route for email_id, draft_id, email_category)
-- ============================================

ALTER TABLE squad_tasks ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- ============================================
-- FIX 4: Fix squad_tasks status CHECK constraint
-- The old constraint only allows: new, in_progress, completed
-- But the workflow needs: failed, rejected
-- ============================================

-- Drop the old constraint
ALTER TABLE squad_tasks DROP CONSTRAINT IF EXISTS squad_tasks_status_check;

-- Add new constraint with all needed statuses
ALTER TABLE squad_tasks ADD CONSTRAINT squad_tasks_status_check
  CHECK (status IN ('new', 'in_progress', 'completed', 'failed', 'rejected'));

-- ============================================
-- FIX 5: Add completed_at column to squad_tasks
-- (used by task-executor.ts markTaskComplete)
-- ============================================

ALTER TABLE squad_tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- ============================================
-- FIX 6: Ensure RLS does not block service role
-- Grant explicit permissions to anon and service_role
-- ============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON email_logs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON email_logs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON squad_tasks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON squad_tasks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON squad_messages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON squad_messages TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON squad_agents TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON squad_agents TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON agent_logs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON agent_logs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON alerts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON alerts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON dashboard_notifications TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON dashboard_notifications TO service_role;

-- ============================================
-- FIX 7: Create indexes for new columns
-- ============================================

CREATE INDEX IF NOT EXISTS idx_email_logs_priority ON email_logs(priority);
CREATE INDEX IF NOT EXISTS idx_email_logs_metadata ON email_logs USING gin(metadata);
CREATE INDEX IF NOT EXISTS idx_squad_tasks_metadata ON squad_tasks USING gin(metadata);

-- ============================================
-- VERIFY: Check the fixes worked
-- ============================================

-- This should return all columns including metadata and priority
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'email_logs'
ORDER BY ordinal_position;

-- This should return all columns including metadata
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'squad_tasks'
ORDER BY ordinal_position;
