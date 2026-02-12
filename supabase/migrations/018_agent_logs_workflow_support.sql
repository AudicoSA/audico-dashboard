-- Agent Logs Workflow Support
-- Adds workflow_id and timestamp columns to agent_logs for workflow tracking

-- Add workflow_id column to agent_logs
ALTER TABLE agent_logs
ADD COLUMN IF NOT EXISTS workflow_id TEXT;

-- Add timestamp column to agent_logs (for custom timestamps)
ALTER TABLE agent_logs
ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ;

-- Add index for workflow_id lookups
CREATE INDEX IF NOT EXISTS idx_agent_logs_workflow_id 
ON agent_logs(workflow_id);

-- Add index for timestamp
CREATE INDEX IF NOT EXISTS idx_agent_logs_timestamp 
ON agent_logs(timestamp DESC);
