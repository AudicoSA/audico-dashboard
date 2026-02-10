-- Migration 007: Execution Tracking
-- Adds execution tracking fields to squad_tasks table for autonomous task execution

-- Add execution tracking columns to squad_tasks
ALTER TABLE squad_tasks ADD COLUMN IF NOT EXISTS
  execution_attempts INTEGER DEFAULT 0;

ALTER TABLE squad_tasks ADD COLUMN IF NOT EXISTS
  last_execution_attempt TIMESTAMPTZ;

ALTER TABLE squad_tasks ADD COLUMN IF NOT EXISTS
  execution_error TEXT;

ALTER TABLE squad_tasks ADD COLUMN IF NOT EXISTS
  requires_approval BOOLEAN DEFAULT FALSE;

ALTER TABLE squad_tasks ADD COLUMN IF NOT EXISTS
  approved_by TEXT;

ALTER TABLE squad_tasks ADD COLUMN IF NOT EXISTS
  approved_at TIMESTAMPTZ;

ALTER TABLE squad_tasks ADD COLUMN IF NOT EXISTS
  rejected_by TEXT;

ALTER TABLE squad_tasks ADD COLUMN IF NOT EXISTS
  rejected_at TIMESTAMPTZ;

ALTER TABLE squad_tasks ADD COLUMN IF NOT EXISTS
  rejection_reason TEXT;

-- Create index for fast executable task queries
CREATE INDEX IF NOT EXISTS idx_tasks_executable
  ON squad_tasks(status, requires_approval, approved_at)
  WHERE status = 'new';

-- Create index for approval queue queries
CREATE INDEX IF NOT EXISTS idx_tasks_approval_queue
  ON squad_tasks(requires_approval, approved_at)
  WHERE requires_approval = TRUE AND approved_at IS NULL;

-- Create alerts table for system alerts
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create dashboard_notifications table
CREATE TABLE IF NOT EXISTS dashboard_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT,
  read BOOLEAN DEFAULT FALSE,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create agent_configs table for global settings
CREATE TABLE IF NOT EXISTS agent_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create execution_snapshots table for rollback capability
CREATE TABLE IF NOT EXISTS execution_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES squad_tasks(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  task_state JSONB NOT NULL,
  related_records JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(type);
CREATE INDEX IF NOT EXISTS idx_dashboard_notifications_unread ON dashboard_notifications(read) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_execution_snapshots_task_id ON execution_snapshots(task_id);

-- Insert default agent configs
INSERT INTO agent_configs (key, value, updated_at)
VALUES ('global_pause', 'false'::jsonb, NOW())
ON CONFLICT (key) DO NOTHING;

-- Add comments
COMMENT ON COLUMN squad_tasks.execution_attempts IS 'Number of times task execution has been attempted';
COMMENT ON COLUMN squad_tasks.last_execution_attempt IS 'Timestamp of last execution attempt';
COMMENT ON COLUMN squad_tasks.execution_error IS 'Error message from last failed execution';
COMMENT ON COLUMN squad_tasks.requires_approval IS 'Whether task requires manual approval before execution';
COMMENT ON COLUMN squad_tasks.approved_by IS 'Who approved the task (e.g., Kenny)';
COMMENT ON COLUMN squad_tasks.approved_at IS 'When the task was approved';
COMMENT ON COLUMN squad_tasks.rejected_by IS 'Who rejected the task';
COMMENT ON COLUMN squad_tasks.rejected_at IS 'When the task was rejected';
COMMENT ON COLUMN squad_tasks.rejection_reason IS 'Reason for task rejection';

COMMENT ON TABLE alerts IS 'System alerts for critical events';
COMMENT ON TABLE dashboard_notifications IS 'Real-time notifications shown in dashboard';
COMMENT ON TABLE agent_configs IS 'Global configuration settings for agent system';
COMMENT ON TABLE execution_snapshots IS 'Snapshots of task state before execution for rollback';
