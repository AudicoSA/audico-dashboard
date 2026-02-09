-- Analytics Reports Table
-- Stores generated executive reports and historical analytics
CREATE TABLE IF NOT EXISTS analytics_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL,
  report_date DATE NOT NULL,
  report_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_report_per_day UNIQUE (report_type, report_date)
);

CREATE INDEX idx_analytics_reports_date ON analytics_reports(report_date DESC);
CREATE INDEX idx_analytics_reports_type ON analytics_reports(report_type);

-- Product Search Analytics Table (for product recommendation engine)
-- Track product searches, views, cart adds, and purchases
CREATE TABLE IF NOT EXISTS product_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id INTEGER NOT NULL,
  product_name TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('search', 'view', 'cart_add', 'purchase')),
  event_date TIMESTAMPTZ DEFAULT NOW(),
  session_id TEXT,
  customer_id TEXT,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_product_analytics_product ON product_analytics(product_id, event_type);
CREATE INDEX idx_product_analytics_date ON product_analytics(event_date DESC);
CREATE INDEX idx_product_analytics_event ON product_analytics(event_type);

-- Anomaly Alerts Table
-- Store detected anomalies for historical tracking
CREATE TABLE IF NOT EXISTS anomaly_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('order', 'support_ticket', 'ad_spend', 'revenue', 'traffic')),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  expected_value NUMERIC NOT NULL,
  actual_value NUMERIC NOT NULL,
  deviation_percentage NUMERIC NOT NULL,
  description TEXT NOT NULL,
  potential_causes JSONB DEFAULT '[]',
  recommended_actions JSONB DEFAULT '[]',
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_anomaly_alerts_date ON anomaly_alerts(detected_at DESC);
CREATE INDEX idx_anomaly_alerts_severity ON anomaly_alerts(severity);
CREATE INDEX idx_anomaly_alerts_acknowledged ON anomaly_alerts(acknowledged);

-- Churn Risk History Table
-- Track customer churn risk over time
CREATE TABLE IF NOT EXISTS churn_risk_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id TEXT NOT NULL,
  customer_email TEXT,
  customer_name TEXT,
  churn_probability NUMERIC NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  contributing_factors JSONB DEFAULT '[]',
  recommended_actions JSONB DEFAULT '[]',
  last_interaction_days INTEGER,
  last_order_days INTEGER,
  interaction_frequency_trend TEXT,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_churn_risk_customer ON churn_risk_history(customer_id, calculated_at DESC);
CREATE INDEX idx_churn_risk_level ON churn_risk_history(risk_level);
CREATE INDEX idx_churn_risk_date ON churn_risk_history(calculated_at DESC);

-- Inventory Stockout Predictions Table
-- Track inventory predictions over time
CREATE TABLE IF NOT EXISTS stockout_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  current_stock INTEGER NOT NULL,
  daily_velocity NUMERIC NOT NULL,
  predicted_stockout_date TIMESTAMPTZ,
  days_until_stockout INTEGER,
  recommended_reorder_point INTEGER NOT NULL,
  recommended_reorder_quantity INTEGER NOT NULL,
  confidence NUMERIC NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stockout_predictions_product ON stockout_predictions(product_id, calculated_at DESC);
CREATE INDEX idx_stockout_predictions_risk ON stockout_predictions(risk_level);
CREATE INDEX idx_stockout_predictions_date ON stockout_predictions(calculated_at DESC);

-- Comments
COMMENT ON TABLE analytics_reports IS 'Stores daily/weekly/monthly analytics reports';
COMMENT ON TABLE product_analytics IS 'Tracks product interaction events for recommendation engine';
COMMENT ON TABLE anomaly_alerts IS 'Stores detected anomalies in business metrics';
COMMENT ON TABLE churn_risk_history IS 'Historical customer churn risk assessments';
COMMENT ON TABLE stockout_predictions IS 'Historical inventory stockout predictions';

-- Enable Row Level Security
ALTER TABLE analytics_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomaly_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE churn_risk_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE stockout_predictions ENABLE ROW LEVEL SECURITY;

-- Create policies (allow service role access)
CREATE POLICY "Allow service role full access on analytics_reports" ON analytics_reports
  FOR ALL USING (true);

CREATE POLICY "Allow service role full access on product_analytics" ON product_analytics
  FOR ALL USING (true);

CREATE POLICY "Allow service role full access on anomaly_alerts" ON anomaly_alerts
  FOR ALL USING (true);

CREATE POLICY "Allow service role full access on churn_risk_history" ON churn_risk_history
  FOR ALL USING (true);

CREATE POLICY "Allow service role full access on stockout_predictions" ON stockout_predictions
  FOR ALL USING (true);
