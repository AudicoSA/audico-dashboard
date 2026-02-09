-- Agent Intelligence Evolution System Migration
-- Creates tables and functions for continuous agent learning and optimization

-- ============================================
-- AGENT_DECISIONS: Track all agent decisions with rationale and outcomes
-- ============================================
CREATE TABLE IF NOT EXISTS agent_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_name TEXT NOT NULL,
    decision_type TEXT NOT NULL CHECK (decision_type IN (
        'email_classification',
        'social_post_generation',
        'ad_campaign_optimization',
        'seo_recommendation',
        'reseller_approval',
        'influencer_identification',
        'newsletter_generation',
        'kenny_mention_decision'
    )),
    decision_context JSONB NOT NULL DEFAULT '{}'::jsonb,
    decision_made TEXT NOT NULL,
    rationale TEXT NOT NULL,
    confidence_score DECIMAL(3, 2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    prompt_version TEXT,
    prompt_variant TEXT,
    input_data JSONB DEFAULT '{}'::jsonb,
    output_data JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for agent_decisions
CREATE INDEX IF NOT EXISTS idx_agent_decisions_agent_name ON agent_decisions(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_decisions_decision_type ON agent_decisions(decision_type);
CREATE INDEX IF NOT EXISTS idx_agent_decisions_prompt_version ON agent_decisions(prompt_version);
CREATE INDEX IF NOT EXISTS idx_agent_decisions_prompt_variant ON agent_decisions(prompt_variant);
CREATE INDEX IF NOT EXISTS idx_agent_decisions_created ON agent_decisions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_decisions_context ON agent_decisions USING gin(decision_context);

-- ============================================
-- DECISION_OUTCOMES: Track actual outcomes of agent decisions
-- ============================================
CREATE TABLE IF NOT EXISTS decision_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_id UUID NOT NULL REFERENCES agent_decisions(id) ON DELETE CASCADE,
    outcome_type TEXT NOT NULL CHECK (outcome_type IN (
        'email_accuracy',
        'social_engagement',
        'ad_roi',
        'seo_improvement',
        'human_approval',
        'human_rejection',
        'performance_metric'
    )),
    outcome_value DECIMAL(10, 2),
    outcome_data JSONB DEFAULT '{}'::jsonb,
    measured_at TIMESTAMPTZ DEFAULT NOW(),
    feedback_source TEXT CHECK (feedback_source IN ('automated', 'human', 'system')),
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for decision_outcomes
CREATE INDEX IF NOT EXISTS idx_decision_outcomes_decision_id ON decision_outcomes(decision_id);
CREATE INDEX IF NOT EXISTS idx_decision_outcomes_outcome_type ON decision_outcomes(outcome_type);
CREATE INDEX IF NOT EXISTS idx_decision_outcomes_measured ON decision_outcomes(measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_decision_outcomes_feedback_source ON decision_outcomes(feedback_source);

-- ============================================
-- PROMPT_VERSIONS: Version control for agent prompts
-- ============================================
CREATE TABLE IF NOT EXISTS prompt_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_name TEXT NOT NULL,
    decision_type TEXT NOT NULL,
    version TEXT NOT NULL,
    variant TEXT DEFAULT 'default',
    prompt_template TEXT NOT NULL,
    system_instructions TEXT,
    parameters JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'testing' CHECK (status IN ('testing', 'active', 'archived', 'rejected')),
    performance_score DECIMAL(5, 2),
    total_uses INTEGER DEFAULT 0,
    success_rate DECIMAL(5, 2),
    rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
    parent_version_id UUID REFERENCES prompt_versions(id) ON DELETE SET NULL,
    created_by TEXT DEFAULT 'system',
    approved_by TEXT,
    approved_at TIMESTAMPTZ,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(agent_name, decision_type, version, variant)
);

-- Indexes for prompt_versions
CREATE INDEX IF NOT EXISTS idx_prompt_versions_agent_name ON prompt_versions(agent_name);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_decision_type ON prompt_versions(decision_type);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_version ON prompt_versions(version);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_status ON prompt_versions(status);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_rollout ON prompt_versions(rollout_percentage);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_created ON prompt_versions(created_at DESC);

-- ============================================
-- PROMPT_EXPERIMENTS: A/B testing experiments
-- ============================================
CREATE TABLE IF NOT EXISTS prompt_experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    agent_name TEXT NOT NULL,
    decision_type TEXT NOT NULL,
    control_version_id UUID NOT NULL REFERENCES prompt_versions(id) ON DELETE CASCADE,
    test_version_id UUID NOT NULL REFERENCES prompt_versions(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed', 'cancelled')),
    traffic_split INTEGER DEFAULT 50 CHECK (traffic_split >= 0 AND traffic_split <= 100),
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    target_sample_size INTEGER DEFAULT 100,
    current_sample_size INTEGER DEFAULT 0,
    control_metrics JSONB DEFAULT '{}'::jsonb,
    test_metrics JSONB DEFAULT '{}'::jsonb,
    statistical_significance DECIMAL(5, 4),
    winner TEXT CHECK (winner IN ('control', 'test', 'inconclusive')),
    results_summary TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for prompt_experiments
CREATE INDEX IF NOT EXISTS idx_prompt_experiments_agent_name ON prompt_experiments(agent_name);
CREATE INDEX IF NOT EXISTS idx_prompt_experiments_status ON prompt_experiments(status);
CREATE INDEX IF NOT EXISTS idx_prompt_experiments_start_date ON prompt_experiments(start_date DESC);

-- ============================================
-- AGENT_LEARNING_INSIGHTS: Weekly analysis results
-- ============================================
CREATE TABLE IF NOT EXISTS agent_learning_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_name TEXT NOT NULL,
    analysis_period_start TIMESTAMPTZ NOT NULL,
    analysis_period_end TIMESTAMPTZ NOT NULL,
    decision_type TEXT,
    total_decisions INTEGER DEFAULT 0,
    avg_confidence_score DECIMAL(3, 2),
    performance_metrics JSONB DEFAULT '{}'::jsonb,
    identified_patterns JSONB DEFAULT '[]'::jsonb,
    optimization_suggestions JSONB DEFAULT '[]'::jsonb,
    generated_variants JSONB DEFAULT '[]'::jsonb,
    analysis_summary TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    analyzed_by TEXT DEFAULT 'claude',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for agent_learning_insights
CREATE INDEX IF NOT EXISTS idx_agent_learning_insights_agent_name ON agent_learning_insights(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_learning_insights_period_start ON agent_learning_insights(analysis_period_start DESC);
CREATE INDEX IF NOT EXISTS idx_agent_learning_insights_status ON agent_learning_insights(status);
CREATE INDEX IF NOT EXISTS idx_agent_learning_insights_created ON agent_learning_insights(created_at DESC);

-- ============================================
-- PROMPT_APPROVAL_QUEUE: Human approval workflow
-- ============================================
CREATE TABLE IF NOT EXISTS prompt_approval_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_version_id UUID NOT NULL REFERENCES prompt_versions(id) ON DELETE CASCADE,
    experiment_id UUID REFERENCES prompt_experiments(id) ON DELETE SET NULL,
    learning_insight_id UUID REFERENCES agent_learning_insights(id) ON DELETE SET NULL,
    request_type TEXT NOT NULL CHECK (request_type IN ('new_variant', 'kenny_mention_change', 'major_optimization', 'experiment_approval')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    change_summary TEXT NOT NULL,
    impact_analysis JSONB DEFAULT '{}'::jsonb,
    risk_assessment TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'needs_revision')),
    requested_by TEXT DEFAULT 'system',
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    reviewer_notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for prompt_approval_queue
CREATE INDEX IF NOT EXISTS idx_prompt_approval_queue_status ON prompt_approval_queue(status);
CREATE INDEX IF NOT EXISTS idx_prompt_approval_queue_priority ON prompt_approval_queue(priority);
CREATE INDEX IF NOT EXISTS idx_prompt_approval_queue_request_type ON prompt_approval_queue(request_type);
CREATE INDEX IF NOT EXISTS idx_prompt_approval_queue_created ON prompt_approval_queue(created_at DESC);

-- ============================================
-- AGENT_PERFORMANCE_SNAPSHOTS: Historical performance tracking
-- ============================================
CREATE TABLE IF NOT EXISTS agent_performance_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_name TEXT NOT NULL,
    snapshot_date DATE NOT NULL,
    decision_types JSONB DEFAULT '{}'::jsonb,
    overall_accuracy DECIMAL(5, 2),
    total_decisions INTEGER DEFAULT 0,
    successful_decisions INTEGER DEFAULT 0,
    roi_metrics JSONB DEFAULT '{}'::jsonb,
    engagement_metrics JSONB DEFAULT '{}'::jsonb,
    efficiency_metrics JSONB DEFAULT '{}'::jsonb,
    active_prompt_versions INTEGER DEFAULT 0,
    experiments_running INTEGER DEFAULT 0,
    learning_insights_generated INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(agent_name, snapshot_date)
);

-- Indexes for agent_performance_snapshots
CREATE INDEX IF NOT EXISTS idx_agent_performance_snapshots_agent_name ON agent_performance_snapshots(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_performance_snapshots_date ON agent_performance_snapshots(snapshot_date DESC);

-- ============================================
-- Enable RLS (Row Level Security)
-- ============================================
ALTER TABLE agent_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_learning_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_approval_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_performance_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow all operations for authenticated users
CREATE POLICY "Allow all for authenticated" ON agent_decisions FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON decision_outcomes FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON prompt_versions FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON prompt_experiments FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON agent_learning_insights FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON prompt_approval_queue FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON agent_performance_snapshots FOR ALL USING (true);

-- ============================================
-- Updated_at triggers
-- ============================================
DROP TRIGGER IF EXISTS update_prompt_versions_updated_at ON prompt_versions;
CREATE TRIGGER update_prompt_versions_updated_at
    BEFORE UPDATE ON prompt_versions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_prompt_experiments_updated_at ON prompt_experiments;
CREATE TRIGGER update_prompt_experiments_updated_at
    BEFORE UPDATE ON prompt_experiments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_prompt_approval_queue_updated_at ON prompt_approval_queue;
CREATE TRIGGER update_prompt_approval_queue_updated_at
    BEFORE UPDATE ON prompt_approval_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Helper Functions
-- ============================================

-- Function to calculate decision success rate
CREATE OR REPLACE FUNCTION calculate_decision_success_rate(
    p_agent_name TEXT,
    p_decision_type TEXT,
    p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
    total_decisions INTEGER,
    successful_decisions INTEGER,
    success_rate DECIMAL(5, 2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT ad.id)::INTEGER as total_decisions,
        COUNT(DISTINCT CASE 
            WHEN do.outcome_type IN ('human_approval', 'performance_metric') 
            AND do.outcome_value >= 70 
            THEN ad.id 
        END)::INTEGER as successful_decisions,
        CASE 
            WHEN COUNT(DISTINCT ad.id) > 0 
            THEN (COUNT(DISTINCT CASE 
                WHEN do.outcome_type IN ('human_approval', 'performance_metric') 
                AND do.outcome_value >= 70 
                THEN ad.id 
            END)::DECIMAL / COUNT(DISTINCT ad.id)::DECIMAL * 100)
            ELSE 0 
        END as success_rate
    FROM agent_decisions ad
    LEFT JOIN decision_outcomes do ON ad.id = do.decision_id
    WHERE ad.agent_name = p_agent_name
        AND (p_decision_type IS NULL OR ad.decision_type = p_decision_type)
        AND ad.created_at >= NOW() - (p_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Function to get active prompt version for an agent
CREATE OR REPLACE FUNCTION get_active_prompt_version(
    p_agent_name TEXT,
    p_decision_type TEXT
)
RETURNS TABLE (
    version_id UUID,
    version TEXT,
    variant TEXT,
    prompt_template TEXT,
    system_instructions TEXT,
    parameters JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pv.id,
        pv.version,
        pv.variant,
        pv.prompt_template,
        pv.system_instructions,
        pv.parameters
    FROM prompt_versions pv
    WHERE pv.agent_name = p_agent_name
        AND pv.decision_type = p_decision_type
        AND pv.status = 'active'
    ORDER BY pv.rollout_percentage DESC, pv.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;
