-- Migration 011: Fix Approval & Execution Workflow
-- MUST BE RUN IN SUPABASE SQL EDITOR
-- Adds missing columns from migration 007 (execution tracking + approval workflow)
-- Also resets rate-limit-killed emails so they can be reprocessed

-- ============================================
-- FIX 1: Add execution tracking columns to squad_tasks
-- These were defined in migration 007 but never applied
-- ============================================

ALTER TABLE squad_tasks ADD COLUMN IF NOT EXISTS execution_attempts INTEGER DEFAULT 0;
ALTER TABLE squad_tasks ADD COLUMN IF NOT EXISTS last_execution_attempt TIMESTAMPTZ;
ALTER TABLE squad_tasks ADD COLUMN IF NOT EXISTS execution_error TEXT;

-- ============================================
-- FIX 2: Add approval workflow columns to squad_tasks
-- Without these, approve/reject silently fail
-- ============================================

ALTER TABLE squad_tasks ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT FALSE;
ALTER TABLE squad_tasks ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE squad_tasks ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE squad_tasks ADD COLUMN IF NOT EXISTS rejected_by TEXT;
ALTER TABLE squad_tasks ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE squad_tasks ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- ============================================
-- FIX 3: Add handled_by column to email_logs
-- Referenced by code but never created in any migration
-- ============================================

ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS handled_by TEXT;

-- ============================================
-- FIX 4: Create indexes for execution and approval queries
-- ============================================

CREATE INDEX IF NOT EXISTS idx_tasks_executable
  ON squad_tasks(status, requires_approval, approved_at)
  WHERE status = 'new';

CREATE INDEX IF NOT EXISTS idx_tasks_approval_queue
  ON squad_tasks(requires_approval, approved_at)
  WHERE requires_approval = TRUE AND approved_at IS NULL;

-- ============================================
-- FIX 4: Create supporting tables if missing
-- ============================================

CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dashboard_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT,
  read BOOLEAN DEFAULT FALSE,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS execution_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES squad_tasks(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  task_state JSONB NOT NULL,
  related_records JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(type);
CREATE INDEX IF NOT EXISTS idx_dashboard_notifications_unread ON dashboard_notifications(read) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_execution_snapshots_task_id ON execution_snapshots(task_id);

-- Default config
INSERT INTO agent_configs (key, value, updated_at)
VALUES ('global_pause', 'false'::jsonb, NOW())
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- FIX 5: Grant permissions for new tables
-- ============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON alerts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON alerts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON dashboard_notifications TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON dashboard_notifications TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON agent_configs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON agent_configs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON execution_snapshots TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON execution_snapshots TO service_role;

-- ============================================
-- FIX 6: Reset emails that were permanently failed due to rate limiting
-- These were valid emails killed by HTTP 429 errors, not real failures
-- ============================================

UPDATE email_logs
SET status = 'classified',
    metadata = metadata - 'error' - 'failed_at' - 'fail_count',
    updated_at = NOW()
WHERE status = 'handled'
  AND metadata->>'error' LIKE '%Rate limit%';

-- ============================================
-- FIX 7: Update status constraint to include 'failed' and 'rejected' for squad_tasks
-- (Already done in migration 009, but safe to re-run)
-- ============================================

ALTER TABLE squad_tasks DROP CONSTRAINT IF EXISTS squad_tasks_status_check;
UPDATE squad_tasks SET status = 'new'
WHERE status IS NULL
   OR status NOT IN ('new', 'in_progress', 'completed', 'failed', 'rejected');
ALTER TABLE squad_tasks ADD CONSTRAINT squad_tasks_status_check
  CHECK (status IN ('new', 'in_progress', 'completed', 'failed', 'rejected'));

-- ============================================
-- CRITICAL: Reload PostgREST schema cache
-- Without this, new columns won't be visible via Supabase client
-- ============================================

NOTIFY pgrst, 'reload schema';

-- ============================================
-- VERIFY: Check that all columns exist
-- ============================================

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'squad_tasks'
ORDER BY ordinal_position;
