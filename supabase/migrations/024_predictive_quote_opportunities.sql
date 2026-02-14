-- Create predictive_quote_opportunities table
CREATE TABLE IF NOT EXISTS predictive_quote_opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  predicted_products JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  trigger_reason TEXT NOT NULL CHECK (trigger_reason IN ('repeat_purchase_due', 'seasonal_opportunity', 'product_interest_detected', 'competitor_mention')),
  suggested_discount DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (suggested_discount >= 0 AND suggested_discount <= 100),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'review_pending', 'quote_generated', 'contacted', 'converted', 'dismissed')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  identified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  actioned_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(customer_email)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_predictive_quote_opportunities_customer_email ON predictive_quote_opportunities(customer_email);
CREATE INDEX IF NOT EXISTS idx_predictive_quote_opportunities_status ON predictive_quote_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_predictive_quote_opportunities_confidence_score ON predictive_quote_opportunities(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_predictive_quote_opportunities_priority ON predictive_quote_opportunities(priority);
CREATE INDEX IF NOT EXISTS idx_predictive_quote_opportunities_trigger_reason ON predictive_quote_opportunities(trigger_reason);
CREATE INDEX IF NOT EXISTS idx_predictive_quote_opportunities_identified_at ON predictive_quote_opportunities(identified_at DESC);

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_predictive_quote_opportunities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_predictive_quote_opportunities_updated_at
  BEFORE UPDATE ON predictive_quote_opportunities
  FOR EACH ROW
  EXECUTE FUNCTION update_predictive_quote_opportunities_updated_at();

-- Create analytics view for opportunity pipeline
CREATE OR REPLACE VIEW predictive_quote_opportunities_pipeline AS
SELECT 
  status,
  trigger_reason,
  priority,
  COUNT(*) as count,
  AVG(confidence_score) as avg_confidence,
  AVG(suggested_discount) as avg_suggested_discount,
  SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) as converted_count,
  SUM(CASE WHEN status = 'dismissed' THEN 1 ELSE 0 END) as dismissed_count
FROM predictive_quote_opportunities
GROUP BY status, trigger_reason, priority;

-- Create conversion analytics view
CREATE OR REPLACE VIEW predictive_quote_opportunities_conversion_analytics AS
SELECT 
  trigger_reason,
  COUNT(*) as total_opportunities,
  SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) as converted,
  ROUND(
    CAST(SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) AS DECIMAL) / 
    NULLIF(COUNT(*), 0) * 100, 2
  ) as conversion_rate,
  AVG(confidence_score) as avg_confidence_score,
  AVG(CASE WHEN status = 'converted' THEN confidence_score END) as avg_converted_confidence,
  AVG(suggested_discount) as avg_suggested_discount
FROM predictive_quote_opportunities
GROUP BY trigger_reason;

-- Grant permissions
ALTER TABLE predictive_quote_opportunities ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role has full access to predictive_quote_opportunities"
  ON predictive_quote_opportunities
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to read
CREATE POLICY "Authenticated users can read predictive_quote_opportunities"
  ON predictive_quote_opportunities
  FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON TABLE predictive_quote_opportunities IS 'Stores AI-predicted quote opportunities based on customer behavior analysis';
COMMENT ON COLUMN predictive_quote_opportunities.customer_email IS 'Customer email address (unique)';
COMMENT ON COLUMN predictive_quote_opportunities.predicted_products IS 'Array of predicted products with confidence scores and reasoning';
COMMENT ON COLUMN predictive_quote_opportunities.confidence_score IS 'Overall confidence score (0-1) for the opportunity';
COMMENT ON COLUMN predictive_quote_opportunities.trigger_reason IS 'Primary reason for opportunity detection';
COMMENT ON COLUMN predictive_quote_opportunities.suggested_discount IS 'AI-suggested discount percentage (0-100)';
COMMENT ON COLUMN predictive_quote_opportunities.priority IS 'Priority level for follow-up';
COMMENT ON COLUMN predictive_quote_opportunities.status IS 'Current status of the opportunity';
COMMENT ON COLUMN predictive_quote_opportunities.metadata IS 'Additional metadata including purchase history, interaction signals, etc';
