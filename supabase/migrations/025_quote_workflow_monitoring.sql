-- Quote Workflow Monitoring System
-- Tracks workflow executions with detailed step timing, diagnostics, and recovery actions

-- Create quote_workflow_executions table
CREATE TABLE IF NOT EXISTS quote_workflow_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id TEXT NOT NULL UNIQUE,
  email_log_id TEXT,
  quote_request_id TEXT,
  workflow_type TEXT NOT NULL DEFAULT 'quote_automation' CHECK (workflow_type IN ('quote_automation', 'manual_quote', 'approval', 'follow_up')),
  status TEXT NOT NULL DEFAULT 'initializing' CHECK (status IN (
    'initializing', 
    'detecting', 
    'supplier_contacted', 
    'awaiting_responses', 
    'generating_quote', 
    'pending_approval', 
    'quote_sent', 
    'failed', 
    'completed',
    'stuck',
    'recovering'
  )),
  
  -- Step-by-step tracking
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_step TEXT,
  
  -- Timing metrics
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  total_duration_seconds INTEGER,
  
  -- Step durations (in seconds)
  detection_duration INTEGER,
  supplier_contact_duration INTEGER,
  response_wait_duration INTEGER,
  quote_generation_duration INTEGER,
  approval_duration INTEGER,
  send_duration INTEGER,
  
  -- Performance metrics
  suppliers_contacted INTEGER DEFAULT 0,
  suppliers_responded INTEGER DEFAULT 0,
  response_rate DECIMAL(5,2),
  
  -- Failure tracking
  failure_reason TEXT,
  failure_step TEXT,
  failure_count INTEGER DEFAULT 0,
  last_error TEXT,
  error_stack JSONB DEFAULT '[]'::jsonb,
  
  -- Bottleneck detection
  bottleneck_detected BOOLEAN DEFAULT FALSE,
  bottleneck_step TEXT,
  bottleneck_duration INTEGER,
  bottleneck_threshold_exceeded_by INTEGER,
  
  -- Recovery tracking
  recovery_attempted BOOLEAN DEFAULT FALSE,
  recovery_actions JSONB DEFAULT '[]'::jsonb,
  recovery_successful BOOLEAN,
  
  -- Automated diagnostics
  diagnostic_results JSONB DEFAULT '{}'::jsonb,
  suggested_fixes JSONB DEFAULT '[]'::jsonb,
  
  -- Alerting
  alert_triggered BOOLEAN DEFAULT FALSE,
  alert_type TEXT,
  alert_sent_at TIMESTAMPTZ,
  alert_resolved_at TIMESTAMPTZ,
  
  -- Circuit breaker state
  circuit_breaker_triggered BOOLEAN DEFAULT FALSE,
  circuit_breaker_service TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_quote_workflow_executions_workflow_id ON quote_workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_quote_workflow_executions_quote_request_id ON quote_workflow_executions(quote_request_id);
CREATE INDEX IF NOT EXISTS idx_quote_workflow_executions_status ON quote_workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_quote_workflow_executions_started_at ON quote_workflow_executions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_quote_workflow_executions_workflow_type ON quote_workflow_executions(workflow_type);
CREATE INDEX IF NOT EXISTS idx_quote_workflow_executions_bottleneck ON quote_workflow_executions(bottleneck_detected) WHERE bottleneck_detected = TRUE;
CREATE INDEX IF NOT EXISTS idx_quote_workflow_executions_alerts ON quote_workflow_executions(alert_triggered, alert_type) WHERE alert_triggered = TRUE;
CREATE INDEX IF NOT EXISTS idx_quote_workflow_executions_failed ON quote_workflow_executions(status) WHERE status = 'failed';
CREATE INDEX IF NOT EXISTS idx_quote_workflow_executions_stuck ON quote_workflow_executions(status) WHERE status = 'stuck';

-- Create workflow health metrics view
CREATE OR REPLACE VIEW quote_workflow_health_metrics AS
SELECT 
  workflow_type,
  status,
  COUNT(*) as execution_count,
  AVG(total_duration_seconds) as avg_duration_seconds,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_duration_seconds) as median_duration_seconds,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY total_duration_seconds) as p95_duration_seconds,
  
  -- Step timing averages
  AVG(detection_duration) as avg_detection_duration,
  AVG(supplier_contact_duration) as avg_supplier_contact_duration,
  AVG(response_wait_duration) as avg_response_wait_duration,
  AVG(quote_generation_duration) as avg_quote_generation_duration,
  AVG(approval_duration) as avg_approval_duration,
  AVG(send_duration) as avg_send_duration,
  
  -- Success rates
  ROUND(
    CAST(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS DECIMAL) / 
    NULLIF(COUNT(*), 0) * 100, 2
  ) as success_rate,
  
  ROUND(
    CAST(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS DECIMAL) / 
    NULLIF(COUNT(*), 0) * 100, 2
  ) as failure_rate,
  
  -- Supplier response metrics
  AVG(response_rate) as avg_supplier_response_rate,
  AVG(suppliers_contacted) as avg_suppliers_contacted,
  AVG(suppliers_responded) as avg_suppliers_responded,
  
  -- Bottleneck metrics
  SUM(CASE WHEN bottleneck_detected THEN 1 ELSE 0 END) as bottleneck_count,
  ROUND(
    CAST(SUM(CASE WHEN bottleneck_detected THEN 1 ELSE 0 END) AS DECIMAL) / 
    NULLIF(COUNT(*), 0) * 100, 2
  ) as bottleneck_rate,
  
  -- Recovery metrics
  SUM(CASE WHEN recovery_attempted THEN 1 ELSE 0 END) as recovery_attempt_count,
  ROUND(
    CAST(SUM(CASE WHEN recovery_successful THEN 1 ELSE 0 END) AS DECIMAL) / 
    NULLIF(SUM(CASE WHEN recovery_attempted THEN 1 ELSE 0 END), 0) * 100, 2
  ) as recovery_success_rate,
  
  -- Alert metrics
  SUM(CASE WHEN alert_triggered THEN 1 ELSE 0 END) as alert_count,
  
  -- Latest executions
  MAX(started_at) as last_execution_at
FROM quote_workflow_executions
GROUP BY workflow_type, status;

-- Create workflow bottleneck analysis view
CREATE OR REPLACE VIEW quote_workflow_bottlenecks AS
SELECT 
  bottleneck_step,
  COUNT(*) as occurrence_count,
  AVG(bottleneck_duration) as avg_bottleneck_duration,
  MAX(bottleneck_duration) as max_bottleneck_duration,
  AVG(bottleneck_threshold_exceeded_by) as avg_threshold_exceeded_by,
  
  -- Associated failures
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as led_to_failure_count,
  
  -- Recent occurrences
  MAX(started_at) as last_occurrence_at,
  
  -- Common diagnostic patterns
  STRING_AGG(DISTINCT failure_reason, ', ') as common_failure_reasons
FROM quote_workflow_executions
WHERE bottleneck_detected = TRUE
GROUP BY bottleneck_step
ORDER BY occurrence_count DESC;

-- Create workflow failure analysis view
CREATE OR REPLACE VIEW quote_workflow_failure_analysis AS
SELECT 
  failure_step,
  failure_reason,
  COUNT(*) as failure_count,
  AVG(failure_count) as avg_retry_count,
  
  -- Recovery analysis
  SUM(CASE WHEN recovery_attempted THEN 1 ELSE 0 END) as recovery_attempted_count,
  SUM(CASE WHEN recovery_successful THEN 1 ELSE 0 END) as recovery_successful_count,
  
  -- Timing
  AVG(total_duration_seconds) as avg_duration_before_failure,
  MAX(started_at) as last_failure_at,
  
  -- Circuit breaker correlation
  SUM(CASE WHEN circuit_breaker_triggered THEN 1 ELSE 0 END) as circuit_breaker_count,
  
  -- Common suggested fixes
  (
    SELECT JSONB_AGG(DISTINCT fix)
    FROM quote_workflow_executions e,
    JSONB_ARRAY_ELEMENTS(e.suggested_fixes) fix
    WHERE e.failure_step = quote_workflow_executions.failure_step
    AND e.failure_reason = quote_workflow_executions.failure_reason
    LIMIT 5
  ) as common_suggested_fixes
FROM quote_workflow_executions
WHERE status = 'failed'
GROUP BY failure_step, failure_reason
ORDER BY failure_count DESC;

-- Create workflow alert summary view
CREATE OR REPLACE VIEW quote_workflow_alert_summary AS
SELECT 
  alert_type,
  COUNT(*) as alert_count,
  SUM(CASE WHEN alert_resolved_at IS NOT NULL THEN 1 ELSE 0 END) as resolved_count,
  SUM(CASE WHEN alert_resolved_at IS NULL THEN 1 ELSE 0 END) as unresolved_count,
  AVG(EXTRACT(EPOCH FROM (alert_resolved_at - alert_sent_at))) as avg_resolution_time_seconds,
  MAX(alert_sent_at) as last_alert_at,
  
  -- Related workflows
  ARRAY_AGG(workflow_id ORDER BY alert_sent_at DESC) FILTER (WHERE alert_resolved_at IS NULL) as unresolved_workflow_ids
FROM quote_workflow_executions
WHERE alert_triggered = TRUE
GROUP BY alert_type
ORDER BY alert_count DESC;

-- Create supplier response rate trends view
CREATE OR REPLACE VIEW quote_workflow_supplier_trends AS
SELECT 
  DATE_TRUNC('day', started_at) as date,
  AVG(response_rate) as avg_response_rate,
  AVG(suppliers_contacted) as avg_suppliers_contacted,
  AVG(suppliers_responded) as avg_suppliers_responded,
  AVG(response_wait_duration) as avg_response_wait_duration,
  COUNT(*) as workflow_count,
  
  -- Success correlation
  ROUND(
    CAST(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS DECIMAL) / 
    NULLIF(COUNT(*), 0) * 100, 2
  ) as success_rate_for_day
FROM quote_workflow_executions
WHERE suppliers_contacted > 0
GROUP BY DATE_TRUNC('day', started_at)
ORDER BY date DESC;

-- Create PDF generation success tracking view
CREATE OR REPLACE VIEW quote_workflow_pdf_generation_stats AS
SELECT 
  DATE_TRUNC('day', started_at) as date,
  COUNT(*) as total_pdf_attempts,
  SUM(CASE 
    WHEN status IN ('quote_sent', 'completed') 
    OR (current_step = 'generate_quote_pdf' AND failure_step != 'generate_quote_pdf')
    THEN 1 ELSE 0 
  END) as successful_generations,
  SUM(CASE WHEN failure_step = 'generate_quote_pdf' THEN 1 ELSE 0 END) as failed_generations,
  AVG(quote_generation_duration) as avg_generation_duration,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY quote_generation_duration) as p95_generation_duration,
  
  -- Success rate
  ROUND(
    CAST(SUM(CASE 
      WHEN status IN ('quote_sent', 'completed') 
      OR (current_step = 'generate_quote_pdf' AND failure_step != 'generate_quote_pdf')
      THEN 1 ELSE 0 
    END) AS DECIMAL) / 
    NULLIF(COUNT(*), 0) * 100, 2
  ) as pdf_success_rate
FROM quote_workflow_executions
WHERE current_step IN ('generate_quote_pdf', 'pending_approval', 'quote_sent') 
   OR status IN ('generating_quote', 'pending_approval', 'quote_sent', 'completed')
   OR failure_step = 'generate_quote_pdf'
GROUP BY DATE_TRUNC('day', started_at)
ORDER BY date DESC;

-- Create customer acceptance tracking view
CREATE OR REPLACE VIEW quote_workflow_customer_acceptance_patterns AS
SELECT 
  DATE_TRUNC('week', qwe.started_at) as week,
  COUNT(DISTINCT qwe.quote_request_id) as quotes_sent,
  COUNT(DISTINCT qr.id) FILTER (WHERE qr.status = 'accepted') as quotes_accepted,
  COUNT(DISTINCT qr.id) FILTER (WHERE qr.status = 'rejected') as quotes_rejected,
  
  -- Acceptance rate
  ROUND(
    CAST(COUNT(DISTINCT qr.id) FILTER (WHERE qr.status = 'accepted') AS DECIMAL) / 
    NULLIF(COUNT(DISTINCT qwe.quote_request_id), 0) * 100, 2
  ) as acceptance_rate,
  
  -- Average quote value
  AVG((qr.metadata->>'total_quoted_amount')::DECIMAL) as avg_quote_value,
  SUM((qr.metadata->>'total_quoted_amount')::DECIMAL) FILTER (WHERE qr.status = 'accepted') as total_accepted_value,
  
  -- Timing impact
  AVG(qwe.total_duration_seconds) as avg_time_to_send_seconds,
  CORR(qwe.total_duration_seconds, CASE WHEN qr.status = 'accepted' THEN 1 ELSE 0 END) as time_acceptance_correlation
FROM quote_workflow_executions qwe
LEFT JOIN quote_requests qr ON qwe.quote_request_id = qr.id
WHERE qwe.status IN ('quote_sent', 'completed')
GROUP BY DATE_TRUNC('week', qwe.started_at)
ORDER BY week DESC;

-- Add trigger to update updated_at and calculate durations
CREATE OR REPLACE FUNCTION update_quote_workflow_execution()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  
  -- Calculate total duration if completed
  IF NEW.completed_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
    NEW.total_duration_seconds = EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at))::INTEGER;
  END IF;
  
  -- Calculate response rate
  IF NEW.suppliers_contacted > 0 THEN
    NEW.response_rate = (NEW.suppliers_responded::DECIMAL / NEW.suppliers_contacted::DECIMAL) * 100;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_quote_workflow_execution_update
  BEFORE UPDATE ON quote_workflow_executions
  FOR EACH ROW
  EXECUTE FUNCTION update_quote_workflow_execution();

-- Grant permissions
ALTER TABLE quote_workflow_executions ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role has full access to quote_workflow_executions"
  ON quote_workflow_executions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to read
CREATE POLICY "Authenticated users can read quote_workflow_executions"
  ON quote_workflow_executions
  FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON TABLE quote_workflow_executions IS 'Tracks quote workflow executions with detailed step timing, diagnostics, and recovery actions';
COMMENT ON COLUMN quote_workflow_executions.workflow_id IS 'Unique identifier for the workflow run';
COMMENT ON COLUMN quote_workflow_executions.steps IS 'Array of step objects with timing and status';
COMMENT ON COLUMN quote_workflow_executions.bottleneck_detected IS 'Whether a performance bottleneck was detected';
COMMENT ON COLUMN quote_workflow_executions.recovery_actions IS 'Array of automated recovery actions taken';
COMMENT ON COLUMN quote_workflow_executions.diagnostic_results IS 'Automated diagnostic analysis results';
COMMENT ON COLUMN quote_workflow_executions.suggested_fixes IS 'AI-generated suggestions for fixing failures';
