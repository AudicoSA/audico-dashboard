-- Pricing Optimization Insights
-- Stores learned pricing strategies from quote history analysis

-- ============================================
-- PRICING_OPTIMIZATION_INSIGHTS: Store AI-learned pricing strategies
-- ============================================
CREATE TABLE IF NOT EXISTS pricing_optimization_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    insight_type TEXT NOT NULL CHECK (insight_type IN (
        'customer_segment', 
        'product_category', 
        'order_size', 
        'urgency_level',
        'bundling_strategy',
        'price_sensitivity',
        'seasonal_pattern',
        'general_strategy'
    )),
    segment_key TEXT NOT NULL,
    optimal_markup_min NUMERIC(5, 2),
    optimal_markup_max NUMERIC(5, 2),
    optimal_markup_avg NUMERIC(5, 2) NOT NULL,
    acceptance_rate NUMERIC(5, 4) NOT NULL,
    sample_size INTEGER NOT NULL,
    confidence_score NUMERIC(3, 2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    insights_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    patterns JSONB DEFAULT '{}'::jsonb,
    recommendations TEXT,
    last_analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for pricing_optimization_insights
CREATE INDEX IF NOT EXISTS idx_pricing_optimization_insights_type ON pricing_optimization_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_pricing_optimization_insights_segment ON pricing_optimization_insights(segment_key);
CREATE INDEX IF NOT EXISTS idx_pricing_optimization_insights_type_segment ON pricing_optimization_insights(insight_type, segment_key);
CREATE INDEX IF NOT EXISTS idx_pricing_optimization_insights_confidence ON pricing_optimization_insights(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_pricing_optimization_insights_analyzed ON pricing_optimization_insights(last_analyzed_at DESC);

-- Enable RLS
ALTER TABLE pricing_optimization_insights ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Allow all for authenticated" ON pricing_optimization_insights FOR ALL USING (true);

-- Updated_at trigger
CREATE TRIGGER update_pricing_optimization_insights_updated_at
    BEFORE UPDATE ON pricing_optimization_insights
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- QUOTE_OUTCOMES: Track customer acceptance/rejection of quotes
-- ============================================
CREATE TABLE IF NOT EXISTS quote_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_request_id UUID NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
    quote_number TEXT NOT NULL,
    outcome TEXT NOT NULL CHECK (outcome IN ('accepted', 'rejected', 'negotiation', 'no_response', 'pending')),
    customer_email TEXT NOT NULL,
    customer_name TEXT,
    customer_segment TEXT,
    total_quoted_amount NUMERIC(10, 2) NOT NULL,
    final_amount NUMERIC(10, 2),
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    urgency_level TEXT CHECK (urgency_level IN ('low', 'medium', 'high', 'urgent')),
    order_size_category TEXT CHECK (order_size_category IN ('small', 'medium', 'large', 'enterprise')),
    rejection_reason TEXT,
    negotiation_details JSONB,
    response_time_hours NUMERIC(10, 2),
    metadata JSONB DEFAULT '{}'::jsonb,
    outcome_date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for quote_outcomes
CREATE INDEX IF NOT EXISTS idx_quote_outcomes_quote_request ON quote_outcomes(quote_request_id);
CREATE INDEX IF NOT EXISTS idx_quote_outcomes_outcome ON quote_outcomes(outcome);
CREATE INDEX IF NOT EXISTS idx_quote_outcomes_customer_email ON quote_outcomes(customer_email);
CREATE INDEX IF NOT EXISTS idx_quote_outcomes_customer_segment ON quote_outcomes(customer_segment);
CREATE INDEX IF NOT EXISTS idx_quote_outcomes_urgency ON quote_outcomes(urgency_level);
CREATE INDEX IF NOT EXISTS idx_quote_outcomes_order_size ON quote_outcomes(order_size_category);
CREATE INDEX IF NOT EXISTS idx_quote_outcomes_outcome_date ON quote_outcomes(outcome_date DESC);

-- Enable RLS
ALTER TABLE quote_outcomes ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Allow all for authenticated" ON quote_outcomes FOR ALL USING (true);

-- ============================================
-- Add customer_segment and metadata to quote_requests
-- ============================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'quote_requests' AND column_name = 'customer_segment'
    ) THEN
        ALTER TABLE quote_requests ADD COLUMN customer_segment TEXT;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'quote_requests' AND column_name = 'urgency_level'
    ) THEN
        ALTER TABLE quote_requests ADD COLUMN urgency_level TEXT CHECK (urgency_level IN ('low', 'medium', 'high', 'urgent'));
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'quote_requests' AND column_name = 'order_size_category'
    ) THEN
        ALTER TABLE quote_requests ADD COLUMN order_size_category TEXT CHECK (order_size_category IN ('small', 'medium', 'large', 'enterprise'));
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'quote_requests' AND column_name = 'metadata'
    ) THEN
        ALTER TABLE quote_requests ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Create indexes on new columns
CREATE INDEX IF NOT EXISTS idx_quote_requests_customer_segment ON quote_requests(customer_segment);
CREATE INDEX IF NOT EXISTS idx_quote_requests_urgency_level ON quote_requests(urgency_level);
CREATE INDEX IF NOT EXISTS idx_quote_requests_order_size_category ON quote_requests(order_size_category);
