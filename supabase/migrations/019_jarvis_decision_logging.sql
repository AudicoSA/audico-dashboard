-- Jarvis Decision Logging System
-- Tracks Jarvis AI decisions for learning and optimization

-- ============================================
-- JARVIS_DECISIONS: Track AI orchestration decisions
-- ============================================
CREATE TABLE IF NOT EXISTS jarvis_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_type TEXT NOT NULL CHECK (decision_type IN (
        'task_priority', 
        'supplier_escalation', 
        'auto_approval', 
        'supplier_pattern', 
        'workflow_optimization',
        'resource_allocation'
    )),
    situation_context JSONB NOT NULL DEFAULT '{}'::jsonb,
    decision_made JSONB NOT NULL DEFAULT '{}'::jsonb,
    reasoning TEXT NOT NULL,
    confidence_score NUMERIC(3, 2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    outcome TEXT CHECK (outcome IN ('pending', 'successful', 'failed', 'overridden')),
    outcome_details JSONB DEFAULT '{}'::jsonb,
    related_quote_request_id UUID REFERENCES quote_requests(id) ON DELETE SET NULL,
    related_task_id UUID REFERENCES squad_tasks(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    evaluated_at TIMESTAMPTZ
);

-- Indexes for jarvis_decisions
CREATE INDEX IF NOT EXISTS idx_jarvis_decisions_type ON jarvis_decisions(decision_type);
CREATE INDEX IF NOT EXISTS idx_jarvis_decisions_outcome ON jarvis_decisions(outcome);
CREATE INDEX IF NOT EXISTS idx_jarvis_decisions_quote_request ON jarvis_decisions(related_quote_request_id);
CREATE INDEX IF NOT EXISTS idx_jarvis_decisions_task ON jarvis_decisions(related_task_id);
CREATE INDEX IF NOT EXISTS idx_jarvis_decisions_created ON jarvis_decisions(created_at DESC);

-- Enable RLS
ALTER TABLE jarvis_decisions ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Allow all for authenticated" ON jarvis_decisions FOR ALL USING (true);

-- ============================================
-- SUPPLIER_PATTERNS: Learned patterns about supplier behavior
-- ============================================
CREATE TABLE IF NOT EXISTS supplier_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    pattern_type TEXT NOT NULL CHECK (pattern_type IN (
        'product_specialty',
        'response_time',
        'availability_pattern',
        'pricing_pattern',
        'reliability_issue'
    )),
    pattern_description TEXT NOT NULL,
    supporting_evidence JSONB DEFAULT '[]'::jsonb,
    confidence_level TEXT NOT NULL CHECK (confidence_level IN ('low', 'medium', 'high', 'verified')),
    occurrences INTEGER DEFAULT 1,
    last_observed TIMESTAMPTZ DEFAULT NOW(),
    actionable_insight TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for supplier_patterns
CREATE INDEX IF NOT EXISTS idx_supplier_patterns_supplier ON supplier_patterns(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_patterns_type ON supplier_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_supplier_patterns_confidence ON supplier_patterns(confidence_level);
CREATE INDEX IF NOT EXISTS idx_supplier_patterns_last_observed ON supplier_patterns(last_observed DESC);

-- Enable RLS
ALTER TABLE supplier_patterns ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Allow all for authenticated" ON supplier_patterns FOR ALL USING (true);

-- Updated_at trigger
CREATE TRIGGER update_supplier_patterns_updated_at
    BEFORE UPDATE ON supplier_patterns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
