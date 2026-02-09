-- Create resilience_metrics table for tracking API health over time
CREATE TABLE IF NOT EXISTS resilience_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL,
  circuit_state TEXT NOT NULL CHECK (circuit_state IN ('CLOSED', 'OPEN', 'HALF_OPEN')),
  is_healthy BOOLEAN NOT NULL DEFAULT true,
  success_rate DECIMAL(5,2) NOT NULL DEFAULT 100.00,
  error_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  recent_requests INTEGER NOT NULL DEFAULT 0,
  degradation_active BOOLEAN NOT NULL DEFAULT false,
  total_requests INTEGER NOT NULL DEFAULT 0,
  failed_requests INTEGER NOT NULL DEFAULT 0,
  retries_total INTEGER NOT NULL DEFAULT 0,
  circuit_breaker_trips INTEGER NOT NULL DEFAULT 0,
  degradation_invocations INTEGER NOT NULL DEFAULT 0,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_resilience_metrics_service_timestamp 
  ON resilience_metrics(service_name, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_resilience_metrics_timestamp 
  ON resilience_metrics(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_resilience_metrics_unhealthy 
  ON resilience_metrics(is_healthy, timestamp DESC) 
  WHERE is_healthy = false;

-- Add RLS policies
ALTER TABLE resilience_metrics ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage all records
CREATE POLICY "Service role can manage resilience metrics"
  ON resilience_metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to read metrics
CREATE POLICY "Authenticated users can read resilience metrics"
  ON resilience_metrics
  FOR SELECT
  TO authenticated
  USING (true);

-- Create a view for latest metrics per service
CREATE OR REPLACE VIEW resilience_latest_metrics AS
SELECT DISTINCT ON (service_name)
  id,
  service_name,
  circuit_state,
  is_healthy,
  success_rate,
  error_rate,
  recent_requests,
  degradation_active,
  total_requests,
  failed_requests,
  retries_total,
  circuit_breaker_trips,
  degradation_invocations,
  timestamp
FROM resilience_metrics
ORDER BY service_name, timestamp DESC;

-- Grant permissions on the view
GRANT SELECT ON resilience_latest_metrics TO authenticated;
GRANT SELECT ON resilience_latest_metrics TO service_role;

-- Create function to clean up old metrics (keep last 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_resilience_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM resilience_metrics
  WHERE timestamp < NOW() - INTERVAL '7 days';
END;
$$;

-- Create scheduled job to run cleanup daily (if pg_cron is available)
-- SELECT cron.schedule(
--   'cleanup-resilience-metrics',
--   '0 2 * * *', -- Run at 2 AM daily
--   'SELECT cleanup_old_resilience_metrics()'
-- );

-- Add comment
COMMENT ON TABLE resilience_metrics IS 'Stores historical metrics for API resilience monitoring including circuit breaker states and error rates';
